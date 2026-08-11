package grpc

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/jhump/protoreflect/desc"
)

func TestListProtoServices(t *testing.T) {
	tmp, err := os.MkdirTemp("", "grpcproto")
	if err != nil {
		t.Fatal(err)
	}
	defer retryRemoveAll(t, tmp)

	t.Cleanup(func() {
		protoCacheMu.Lock()
		protoCache = map[string]*desc.FileDescriptor{}
		protoErrCache = map[string]error{}
		protoCacheMu.Unlock()
	})

	mainProto := `syntax = "proto3";
package demo;

import "common/types.proto";

service Greeter {
  rpc SayHello (HelloRequest) returns (HelloReply);
  rpc Chat (stream HelloRequest) returns (stream HelloReply);
}

message HelloRequest {
  string name = 1;
  int32 age = 2;
  map<string, string> labels = 3;
  repeated common.Address addresses = 4;
}
message HelloReply {
  string message = 1;
}
`
	commonProto := `syntax = "proto3";
package common;

message Address {
  string city = 1;
}
`
	if err := os.MkdirAll(filepath.Join(tmp, "common"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(tmp, "common", "types.proto"), []byte(commonProto), 0644); err != nil {
		t.Fatal(err)
	}
	mainPath := filepath.Join(tmp, "main.proto")
	if err := os.WriteFile(mainPath, []byte(mainProto), 0644); err != nil {
		t.Fatal(err)
	}

	services, err := ListProtoServices(mainPath)
	if err != nil {
		t.Fatalf("ListProtoServices: %v", err)
	}
	if len(services) != 1 {
		t.Fatalf("expected 1 service, got %d", len(services))
	}
	if services[0].FullyQualifiedName != "demo.Greeter" {
		t.Fatalf("unexpected service name %q", services[0].FullyQualifiedName)
	}
	if len(services[0].Methods) != 2 {
		t.Fatalf("expected 2 methods, got %d", len(services[0].Methods))
	}
	chat := services[0].Methods[1]
	if !chat.ClientStreaming || !chat.ServerStreaming {
		t.Fatalf("Chat should be bidi, got client=%v server=%v", chat.ClientStreaming, chat.ServerStreaming)
	}
	if chat.ExampleJSON == "" {
		t.Fatal("expected example JSON")
	}
	t.Logf("example: %s", chat.ExampleJSON)
}

func retryRemoveAll(t *testing.T, dir string) {
	t.Helper()
	for i := 0; i < 10; i++ {
		if err := os.RemoveAll(dir); err == nil {
			return
		}
		time.Sleep(300 * time.Millisecond)
	}
}