package main

import (
	"reflect"
	"testing"
)

func TestReorderArgs(t *testing.T) {
	tests := []struct {
		name       string
		args       []string
		valueFlags []string
		want       []string
	}{
		{
			name:       "flags after file",
			args:       []string{"file.json", "--provider", "bachs", "--secret", "noop"},
			valueFlags: []string{"provider", "secret"},
			want:       []string{"--provider", "bachs", "--secret", "noop", "file.json"},
		},
		{
			name:       "flags first unchanged",
			args:       []string{"--provider", "bachs", "file.json"},
			valueFlags: []string{"provider", "secret"},
			want:       []string{"--provider", "bachs", "file.json"},
		},
		{
			name:       "equals form",
			args:       []string{"file.json", "--provider=bachs", "--secret=noop"},
			valueFlags: []string{"provider", "secret"},
			want:       []string{"--provider=bachs", "--secret=noop", "file.json"},
		},
		{
			name:       "single dash",
			args:       []string{"file.json", "-provider", "bachs"},
			valueFlags: []string{"provider", "secret"},
			want:       []string{"-provider", "bachs", "file.json"},
		},
		{
			name:       "double dash separator",
			args:       []string{"--provider", "bachs", "--", "file.json"},
			valueFlags: []string{"provider", "secret"},
			want:       []string{"--provider", "bachs", "--", "file.json"},
		},
		{
			name:       "multiple files kept in order",
			args:       []string{"a.json", "--secret", "x", "b.json"},
			valueFlags: []string{"secret"},
			want:       []string{"--secret", "x", "a.json", "b.json"},
		},
		{
			name:       "no args",
			args:       nil,
			valueFlags: nil,
			want:       nil,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := reorderArgs(tt.args, tt.valueFlags...); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("reorderArgs(%v) = %v, want %v", tt.args, got, tt.want)
			}
		})
	}
}
