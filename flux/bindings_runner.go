package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"flux/internal/audit"
	"flux/internal/external"
	"flux/internal/loadtest"
	"flux/internal/models"
	"flux/internal/reporter"
	"flux/internal/runner"

	curlpkg "flux/internal/curl"
	traypkg "flux/internal/tray"
)

func (a *App) RunCollection(reqs []models.RunnerRequest, assertions map[string]models.Assertion) models.CollectionRunResult {
	result := runner.RunCollection(a.ctx, reqs, assertions)
	if a.audit != nil {
		pass, fail := 0, 0
		for _, r := range result.Results {
			if r.Error != "" {
				fail++
			} else {
				pass++
			}
		}
		_ = a.audit.Log("user", audit.ActionRun, "collection", "", "", map[string]string{
			"total": fmt.Sprintf("%d", len(reqs)),
			"pass":  fmt.Sprintf("%d", pass),
			"fail":  fmt.Sprintf("%d", fail),
		})
	}
	return result
}

func (a *App) RunCollectionWithConcurrency(reqs []models.RunnerRequest, assertions map[string]models.Assertion, maxConcurrent int) models.CollectionRunResult {
	return runner.RunCollection(a.ctx, reqs, assertions, maxConcurrent)
}

func (a *App) RunLoadTest(config models.LoadTestConfig) models.LoadTestResult {
	result := loadtest.RunLoadTest(config, a.cookies)
	if a.audit != nil {
		_ = a.audit.Log("user", audit.ActionRun, "loadtest", "", "", map[string]string{
			"duration": fmt.Sprintf("%ds", config.DurationSec),
			"vus":      fmt.Sprintf("%d", config.VUs),
		})
	}
	return result
}

func (a *App) RunCollectionWithConfig(config models.RunnerConfig) models.CollectionRunResult {
	reqs := config.Requests
	assertionsMap := make(map[string]models.Assertion)
	var result models.CollectionRunResult
	if len(config.DataRows) > 0 {
		result = runner.RunCollectionDataDriven(a.ctx, reqs, assertionsMap, config.DataRows, config.Env)
	} else {
		result = runner.RunCollection(a.ctx, reqs, assertionsMap, config.MaxConcurrent)
	}
	if a.audit != nil {
		pass, fail := 0, 0
		for _, r := range result.Results {
			if r.Error != "" {
				fail++
			} else {
				pass++
			}
		}
		_ = a.audit.Log("user", audit.ActionRun, "collection", "", "", map[string]string{
			"total": fmt.Sprintf("%d", len(reqs)),
			"pass":  fmt.Sprintf("%d", pass),
			"fail":  fmt.Sprintf("%d", fail),
		})
	}
	return result
}

func (a *App) CreateTestSuite(name, description, collID string) (models.TestSuite, error) {
	if a.testSuites == nil {
		return models.TestSuite{}, errors.New("no active workspace")
	}
	return a.testSuites.Create(name, description, collID)
}

func (a *App) GetTestSuites() []models.TestSuite {
	if a.testSuites == nil {
		return []models.TestSuite{}
	}
	return a.testSuites.GetAll()
}

func (a *App) UpdateTestSuite(ts models.TestSuite) error {
	if a.testSuites == nil {
		return errors.New("no active workspace")
	}
	return a.testSuites.Update(ts)
}

func (a *App) DeleteTestSuite(id string) error {
	if a.testSuites == nil {
		return errors.New("no active workspace")
	}
	return a.testSuites.Delete(id)
}

func (a *App) AddTestGroup(suiteID, parentID string, group models.TestGroup) error {
	if a.testSuites == nil {
		return errors.New("no active workspace")
	}
	return a.testSuites.AddGroup(suiteID, parentID, group)
}

func (a *App) UpdateTestGroup(suiteID string, group models.TestGroup) error {
	if a.testSuites == nil {
		return errors.New("no active workspace")
	}
	return a.testSuites.UpdateGroup(suiteID, group)
}

func (a *App) DeleteTestGroup(suiteID, groupID string) error {
	if a.testSuites == nil {
		return errors.New("no active workspace")
	}
	return a.testSuites.DeleteGroup(suiteID, groupID)
}

func (a *App) GenerateJSONReport(result models.CollectionRunResult) (string, error) {
	return reporter.GenerateJSONReport(result)
}

func (a *App) GenerateHTMLReport(result models.CollectionRunResult, loadResult *models.LoadTestResult) (string, error) {
	return reporter.GenerateHTMLReport(result, loadResult)
}

func (a *App) ExportReportAsJSON(result models.CollectionRunResult) (string, error) {
	if a.ctx == nil {
		return "", errors.New("app context not ready")
	}
	jsonStr, err := reporter.GenerateJSONReport(result)
	if err != nil {
		return "", err
	}
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save JSON Report",
		DefaultFilename: fmt.Sprintf("report-%s.json", time.Now().Format("20060102-150405")),
		Filters:         []runtime.FileFilter{{DisplayName: "JSON", Pattern: "*.json"}},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}
	return path, os.WriteFile(path, []byte(jsonStr), 0644)
}

func (a *App) ExportReportAsHTML(result models.CollectionRunResult, loadResult *models.LoadTestResult) (string, error) {
	if a.ctx == nil {
		return "", errors.New("app context not ready")
	}
	htmlStr, err := reporter.GenerateHTMLReport(result, loadResult)
	if err != nil {
		return "", err
	}
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save HTML Report",
		DefaultFilename: fmt.Sprintf("report-%s.html", time.Now().Format("20060102-150405")),
		Filters:         []runtime.FileFilter{{DisplayName: "HTML", Pattern: "*.html"}},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}
	return path, os.WriteFile(path, []byte(htmlStr), 0644)
}

func (a *App) GeneratePlaywrightTest(collID string, useTS bool) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range all {
		if c.ID == collID {
			return external.GeneratePlaywrightTest(c, c.Requests, nil, useTS)
		}
	}
	return "", fmt.Errorf("collection not found: %s", collID)
}

func (a *App) GenerateJestTest(collID string, useTS bool) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range all {
		if c.ID == collID {
			return external.GenerateJestTest(c, c.Requests, nil, useTS)
		}
	}
	return "", fmt.Errorf("collection not found: %s", collID)
}

func (a *App) GenerateCLIRunner(collID string) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range all {
		if c.ID == collID {
			return external.GenerateCLIRunner(c, c.Requests)
		}
	}
	return "", fmt.Errorf("collection not found: %s", collID)
}

func (a *App) GenerateGitHubAction(collID, runnerFilename string) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	collections, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range collections {
		if c.ID == collID {
			return external.GenerateGitHubAction(c, runnerFilename)
		}
	}
	return "", errors.New("collection not found")
}

func (a *App) GenerateGitLabCI(collID, runnerFilename string) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	collections, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range collections {
		if c.ID == collID {
			return external.GenerateGitLabCI(c, runnerFilename)
		}
	}
	return "", errors.New("collection not found")
}

func (a *App) GenerateJenkins(collID, runnerFilename string) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	collections, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range collections {
		if c.ID == collID {
			return external.GenerateJenkins(c, runnerFilename)
		}
	}
	return "", errors.New("collection not found")
}

func (a *App) SaveGeneratedTest(content, filename string) (string, error) {
	if a.ctx == nil {
		return "", errors.New("app context not ready")
	}
	ext := filepath.Ext(filename)
	if ext == "" {
		ext = ".js"
	}
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save Generated Test",
		DefaultFilename: filename,
		Filters:         []runtime.FileFilter{{DisplayName: "All Files", Pattern: "*" + ext}},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}
	return path, os.WriteFile(path, []byte(content), 0644)
}

func (a *App) GenerateCLIRunnerScript(collectionName string) string {
	dir, _ := a.workspaces.ActiveDir()
	exe, _ := os.Executable()
	return traypkg.CLIRunnerTemplate(exe, dir, collectionName)
}

func (a *App) GenerateCurl(collID, reqID string) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range all {
		if c.ID == collID {
			for _, r := range c.Requests {
				if r.ID == reqID {
					return curlpkg.GenerateCurl(r.Payload), nil
				}
			}
		}
	}
	return "", errors.New("request not found")
}
