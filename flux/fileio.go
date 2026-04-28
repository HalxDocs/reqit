package main

import "os"

// readFile is split out so app.go ReadFileText is trivially mockable. We keep
// the cap small (8 MB) to refuse comically large Postman exports rather than
// blow up the webview.
const maxImportBytes = 8 * 1024 * 1024

func readFile(path string) ([]byte, error) {
	stat, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if stat.Size() > maxImportBytes {
		return nil, &fileTooLargeError{size: stat.Size()}
	}
	return os.ReadFile(path)
}

type fileTooLargeError struct{ size int64 }

func (e *fileTooLargeError) Error() string {
	return "file too large to import (limit 8 MB)"
}
