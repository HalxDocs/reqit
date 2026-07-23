package security

import (
	"path/filepath"
	"runtime"
	"testing"
)

func TestValidatePathWithinDir(t *testing.T) {
	dir := t.TempDir()
	safeFile := filepath.Join(dir, "src", "main.go")
	safeNested := filepath.Join(dir, "a", "b", "c", "file.txt")

	tests := []struct {
		name    string
		path    string
		wantErr bool
	}{
		{"empty", "", true},
		{"relative safe", "src/main.go", false},
		{"absolute within", safeFile, false},
		{"nested relative", "a/b/c/file.go", false},
		{"absolute nested", safeNested, false},
		{"dot dot", "..", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePathWithinDir(dir, tt.path)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidatePathWithinDir(%q, %q) error = %v, wantErr %v", dir, tt.path, err, tt.wantErr)
			}
		})
	}

	// Platform-specific traversal tests
	t.Run("traversal relative", func(t *testing.T) {
		err := ValidatePathWithinDir(dir, filepath.Join("..", "..", "etc", "passwd"))
		if err == nil {
			t.Error("expected error for traversal")
		}
	})
	t.Run("traversal within path", func(t *testing.T) {
		err := ValidatePathWithinDir(dir, filepath.Join("src", "..", "..", "etc", "passwd"))
		if err == nil {
			t.Error("expected error for traversal within path")
		}
	})

	// Test that an absolute path OUTSIDE the dir is rejected
	if runtime.GOOS == "windows" {
		t.Run("absolute outside windows", func(t *testing.T) {
			err := ValidatePathWithinDir(dir, `C:\Windows\System32\config\sam`)
			if err == nil {
				t.Error("expected error for absolute path outside workspace")
			}
		})
	} else {
		t.Run("absolute outside unix", func(t *testing.T) {
			err := ValidatePathWithinDir(dir, "/etc/passwd")
			if err == nil {
				t.Error("expected error for absolute path outside workspace")
			}
		})
	}
}

func TestValidateURL(t *testing.T) {
	tests := []struct {
		name    string
		url     string
		wantErr bool
	}{
		{"https valid", "https://api.example.com/spec.json", false},
		{"http valid", "http://api.example.com/spec.json", false},
		{"no scheme", "api.example.com", true},
		{"ftp scheme", "ftp://example.com/file", true},
		{"localhost", "http://localhost:3000/api", true},
		{"ip loopback", "http://127.0.0.1/api", true},
		{"ip private 10", "http://10.0.0.1/api", true},
		{"ip private 172", "http://172.16.0.1/api", true},
		{"ip private 192", "http://192.168.1.1/api", true},
		{"ip link-local", "http://169.254.169.254/metadata", true},
		{"local suffix", "http://myhost.local/api", true},
		{"internal suffix", "http://db.internal:5432", true},
		{"public ip", "http://8.8.8.8/dns", false},
		{"public domain", "https://httpbin.org/get", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateURL(tt.url)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateURL(%q) error = %v, wantErr %v", tt.url, err, tt.wantErr)
			}
		})
	}
}

func TestSanitizeExecArg(t *testing.T) {
	tests := []struct {
		name    string
		arg     string
		wantErr bool
	}{
		{"empty", "", true},
		{"normal", "my-vault", false},
		{"with slash", "vault/item", false},
		{"with dot", "item.v1", false},
		{"newline", "item\n--flag", true},
		{"carriage return", "item\r--flag", true},
		{"null byte", "item\x00--flag", true},
		{"double dash", "item --injected", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := SanitizeExecArg(tt.arg)
			if (err != nil) != tt.wantErr {
				t.Errorf("SanitizeExecArg(%q) error = %v, wantErr %v", tt.arg, err, tt.wantErr)
			}
		})
	}
}
