package main

import (
	"flux/internal/openapi"
	"fmt"
)

func (a *App) CreateSpec(title, version string) (string, error) {
	sd := openapi.NewSpecDesign(title, version)
	path, err := sd.Save()
	if err != nil {
		return "", fmt.Errorf("save spec: %w", err)
	}
	return path, nil
}

func (a *App) AddSpecEndpoint(specPath, method, path, summary string) error {
	sd, err := openapi.LoadSpecDesign(specPath)
	if err != nil {
		return err
	}
	sd.AddEndpoint(method, path, summary)
	_, err = sd.Save()
	return err
}

func (a *App) GetSpecEndpoints(specPath string) ([]openapi.EndpointSummary, error) {
	sd, err := openapi.LoadSpecDesign(specPath)
	if err != nil {
		return nil, err
	}
	return sd.Endpoints(), nil
}

func (a *App) RemoveSpecEndpoint(specPath, method, path string) error {
	sd, err := openapi.LoadSpecDesign(specPath)
	if err != nil {
		return err
	}
	sd.RemoveEndpoint(method, path)
	_, err = sd.Save()
	return err
}
