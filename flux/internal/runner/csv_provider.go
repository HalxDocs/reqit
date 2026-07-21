package runner

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strings"
)

// ParseDataRows parses CSV or JSON array text into rows of key-value maps.
// CSV: first row is headers, subsequent rows are data.
// JSON: array of objects [{"key":"value"}, ...]
func ParseDataRows(text string, dataType string) ([]map[string]string, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, nil
	}
	switch dataType {
	case "csv":
		return parseCSV(text)
	case "json":
		return parseJSONArray(text)
	default:
		return nil, fmt.Errorf("unsupported data type: %s", dataType)
	}
}

func parseCSV(text string) ([]map[string]string, error) {
	r := csv.NewReader(strings.NewReader(text))
	records, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("CSV parse error: %w", err)
	}
	if len(records) < 2 {
		return nil, fmt.Errorf("CSV must have a header row and at least one data row")
	}
	headers := records[0]
	var rows []map[string]string
	for i, record := range records[1:] {
		row := make(map[string]string)
		for j, h := range headers {
			if j < len(record) {
				row[strings.TrimSpace(h)] = record[j]
			}
		}
		_ = i
		rows = append(rows, row)
	}
	return rows, nil
}

func parseJSONArray(text string) ([]map[string]string, error) {
	var arr []map[string]string
	if err := json.Unmarshal([]byte(text), &arr); err != nil {
		return nil, fmt.Errorf("JSON parse error: %w", err)
	}
	if len(arr) == 0 {
		return nil, fmt.Errorf("JSON array is empty")
	}
	return arr, nil
}
