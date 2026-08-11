package main

import "testing"

func TestFilterReplayHeadersStripsHopByHop(t *testing.T) {
	headers := map[string]string{
		"Content-Type":         "application/json",
		"Connection":           "keep-alive",
		"Transfer-Encoding":    "chunked",
		"Content-Length":       "42",
		"X-Custom":             "yes",
		"svix-id":              "msg_1",
		"svix-timestamp":       "1700000000",
		"svix-signature":       "v1,abc",
	}
	out := filterReplayHeaders(headers, false)

	if out["Content-Type"] != "application/json" {
		t.Errorf("Content-Type should survive, got %q", out["Content-Type"])
	}
	if out["X-Custom"] != "yes" {
		t.Errorf("X-Custom should survive, got %q", out["X-Custom"])
	}
	for _, k := range []string{"Connection", "Transfer-Encoding", "Content-Length", "svix-id", "svix-timestamp", "svix-signature"} {
		if _, ok := out[k]; ok {
			t.Errorf("hop-by-hop/svix header %q should be stripped", k)
		}
	}
}

func TestFilterReplayHeadersPreserveSvix(t *testing.T) {
	headers := map[string]string{
		"Content-Type":  "application/json",
		"svix-id":       "msg_1",
		"svix-signature": "v1,abc",
	}
	out := filterReplayHeaders(headers, true)
	if out["svix-id"] != "msg_1" {
		t.Errorf("preserveSvix should keep svix-id, got %q", out["svix-id"])
	}
	if out["svix-signature"] != "v1,abc" {
		t.Errorf("preserveSvix should keep svix-signature, got %q", out["svix-signature"])
	}
}
