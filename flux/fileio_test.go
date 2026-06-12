package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestReadFileSmall(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.txt")
	content := []byte("hello world")
	if err := os.WriteFile(path, content, 0644); err != nil {
		t.Fatal(err)
	}
	b, err := readFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != "hello world" {
		t.Errorf("expected 'hello world', got %q", string(b))
	}
}

func TestReadFileNotFound(t *testing.T) {
	_, err := readFile(filepath.Join(t.TempDir(), "nonexistent.txt"))
	if err == nil {
		t.Error("expected error for nonexistent file")
	}
}

func TestReadFileTooLarge(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "large.bin")
	data := make([]byte, maxImportBytes+1)
	if err := os.WriteFile(path, data, 0644); err != nil {
		t.Fatal(err)
	}
	_, err := readFile(path)
	if err == nil {
		t.Fatal("expected error for oversized file")
	}
	if _, ok := err.(*fileTooLargeError); !ok {
		t.Errorf("expected *fileTooLargeError, got %T: %v", err, err)
	}
}

func TestReadFileExactlyMax(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "max.bin")
	data := make([]byte, maxImportBytes)
	for i := range data {
		data[i] = byte(i % 256)
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		t.Fatal(err)
	}
	b, err := readFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(b) != maxImportBytes {
		t.Errorf("expected %d bytes, got %d", maxImportBytes, len(b))
	}
}
