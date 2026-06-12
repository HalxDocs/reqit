package storage

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSaveAndLoad(t *testing.T) {
	dir := t.TempDir()
	data := map[string]string{"hello": "world"}
	if err := SaveTo(dir, "test.json", data); err != nil {
		t.Fatal(err)
	}

	var loaded map[string]string
	if err := LoadFrom(dir, "test.json", &loaded); err != nil {
		t.Fatal(err)
	}
	if loaded["hello"] != "world" {
		t.Errorf("expected world, got %q", loaded["hello"])
	}
}

func TestLoadMissingFile(t *testing.T) {
	var v interface{}
	err := LoadFrom(t.TempDir(), "nonexistent.json", &v)
	if err != nil {
		t.Errorf("expected nil for missing file, got %v", err)
	}
}

func TestSaveRoundTripStruct(t *testing.T) {
	type Person struct {
		Name string `json:"name"`
		Age  int    `json:"age"`
	}
	dir := t.TempDir()
	original := Person{Name: "Alice", Age: 30}
	if err := SaveTo(dir, "person.json", original); err != nil {
		t.Fatal(err)
	}

	var loaded Person
	if err := LoadFrom(dir, "person.json", &loaded); err != nil {
		t.Fatal(err)
	}
	if loaded.Name != "Alice" || loaded.Age != 30 {
		t.Errorf("round trip failed: %+v", loaded)
	}
}

func TestSaveCreatesDir(t *testing.T) {
	base := t.TempDir()
	deep := filepath.Join(base, "a", "b", "c")
	data := map[string]int{"x": 1}
	if err := SaveTo(deep, "data.json", data); err != nil {
		t.Fatal(err)
	}

	var loaded map[string]int
	if err := LoadFrom(deep, "data.json", &loaded); err != nil {
		t.Fatal(err)
	}
	if loaded["x"] != 1 {
		t.Errorf("expected 1, got %d", loaded["x"])
	}
}

func TestSaveAndLoadSlice(t *testing.T) {
	dir := t.TempDir()
	items := []string{"a", "b", "c"}
	if err := SaveTo(dir, "list.json", items); err != nil {
		t.Fatal(err)
	}

	var loaded []string
	if err := LoadFrom(dir, "list.json", &loaded); err != nil {
		t.Fatal(err)
	}
	if len(loaded) != 3 || loaded[1] != "b" {
		t.Errorf("unexpected: %v", loaded)
	}
}

func TestLoadInvalidJSON(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "bad.json")
	os.WriteFile(path, []byte("not json"), 0644)

	var v interface{}
	err := LoadFrom(dir, "bad.json", &v)
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}

func TestAtomicWrite(t *testing.T) {
	dir := t.TempDir()
	// first save
	if err := SaveTo(dir, "atomic.json", map[string]string{"status": "first"}); err != nil {
		t.Fatal(err)
	}
	// overwrite
	if err := SaveTo(dir, "atomic.json", map[string]string{"status": "second"}); err != nil {
		t.Fatal(err)
	}

	var loaded map[string]string
	if err := LoadFrom(dir, "atomic.json", &loaded); err != nil {
		t.Fatal(err)
	}
	if loaded["status"] != "second" {
		t.Errorf("expected 'second', got %q", loaded["status"])
	}
}
