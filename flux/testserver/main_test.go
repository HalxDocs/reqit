package main

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/jhump/protoreflect/desc"
	"github.com/jhump/protoreflect/dynamic"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/reflection"
	reflectionpb "google.golang.org/grpc/reflection/grpc_reflection_v1"
)

var testFD *desc.FileDescriptor

// testMsg builds a dynamic EchoRequest/EchoResponse message from JSON.
func dynamicMessage(t *testing.T, json string) *dynamic.Message {
	t.Helper()
	if testFD == nil {
		fd, err := parseProto(demoProto)
		if err != nil {
			t.Fatal(err)
		}
		testFD = fd
	}
	svc := testFD.FindSymbol("demo.EchoService").(*desc.ServiceDescriptor)
	reqDesc := svc.FindMethodByName("UnaryEcho").GetInputType()
	m := dynamic.NewMessage(reqDesc)
	if err := m.UnmarshalJSON([]byte(json)); err != nil {
		t.Fatalf("build message %s: %v", json, err)
	}
	return m
}

// startServer runs the full testserver on ephemeral ports and returns the
// bound grpc + http addresses.
func startServer(t *testing.T) (grpcAddr string, httpAddr string) {
	t.Helper()

	gLis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	hLis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}

	fd, err := parseProto(demoProto)
	if err != nil {
		t.Fatal(err)
	}
	if err := registerFile(fd); err != nil {
		t.Fatal(err)
	}

	srv := grpc.NewServer()
	srv.RegisterService(echoServiceDesc(fd), &echoServer{})
	reflection.Register(srv)
	go func() { _ = srv.Serve(gLis) }()
	t.Cleanup(srv.Stop)

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", handleWS)
	mux.HandleFunc("/sse", handleSSE)
	httpSrv := &http.Server{Handler: mux}
	go func() { _ = httpSrv.Serve(hLis) }()
	t.Cleanup(func() { httpSrv.Close() })

	return gLis.Addr().String(), hLis.Addr().String()
}

func TestReflectionListsService(t *testing.T) {
	grpcAddr, _ := startServer(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cc, err := grpc.NewClient(grpcAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	defer cc.Close()

	refClient := reflectionpb.NewServerReflectionClient(cc)
	stream, err := refClient.ServerReflectionInfo(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := stream.Send(&reflectionpb.ServerReflectionRequest{
		MessageRequest: &reflectionpb.ServerReflectionRequest_ListServices{},
	}); err != nil {
		t.Fatal(err)
	}
	resp, err := stream.Recv()
	if err != nil {
		t.Fatal(err)
	}
	var found bool
	for _, s := range resp.GetListServicesResponse().GetService() {
		if s.Name == "demo.EchoService" {
			found = true
		}
	}
	if !found {
		t.Fatalf("demo.EchoService not in reflection list")
	}
}

func TestUnaryEcho(t *testing.T) {
	grpcAddr, _ := startServer(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cc, err := grpc.NewClient(grpcAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	defer cc.Close()

	in := dynamicMessage(t, `{"message":"hi","count":2}`)
	out := dynamicMessage(t, "{}")
	if err := cc.Invoke(ctx, "/demo.EchoService/UnaryEcho", in, out); err != nil {
		t.Fatal(err)
	}
	if got := fieldString(out, "message"); got != "hi" {
		t.Fatalf("expected echo 'hi', got %q", got)
	}
}

func TestServerStreamEcho(t *testing.T) {
	grpcAddr, _ := startServer(t)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	cc, err := grpc.NewClient(grpcAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	defer cc.Close()

	in := dynamicMessage(t, `{"message":"n","count":3}`)
	stream, err := cc.NewStream(ctx, &grpc.StreamDesc{ServerStreams: true}, "/demo.EchoService/ServerStreamEcho")
	if err != nil {
		t.Fatal(err)
	}
	if err := stream.SendMsg(in); err != nil {
		t.Fatal(err)
	}
	if err := stream.CloseSend(); err != nil {
		t.Fatal(err)
	}
	var got int
	for {
		out := dynamicMessage(t, "{}")
		err := stream.RecvMsg(out)
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		got++
	}
	if got != 3 {
		t.Fatalf("expected 3 server-stream frames, got %d", got)
	}
}

func TestClientStreamEcho(t *testing.T) {
	grpcAddr, _ := startServer(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cc, err := grpc.NewClient(grpcAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	defer cc.Close()

	stream, err := cc.NewStream(ctx, &grpc.StreamDesc{ClientStreams: true}, "/demo.EchoService/ClientStreamEcho")
	if err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= 3; i++ {
		if err := stream.SendMsg(dynamicMessage(t, `{"message":"m`+itoa(i)+`"}`)); err != nil {
			t.Fatal(err)
		}
	}
	if err := stream.CloseSend(); err != nil {
		t.Fatal(err)
	}
	out := dynamicMessage(t, "{}")
	if err := stream.RecvMsg(out); err != nil {
		t.Fatal(err)
	}
	if got := fieldString(out, "message"); !strings.Contains(got, "received 3 messages") {
		t.Fatalf("unexpected client-stream summary: %q", got)
	}
}

func TestBidiEcho(t *testing.T) {
	grpcAddr, _ := startServer(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cc, err := grpc.NewClient(grpcAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	defer cc.Close()

	stream, err := cc.NewStream(ctx, &grpc.StreamDesc{ServerStreams: true, ClientStreams: true}, "/demo.EchoService/BidiEcho")
	if err != nil {
		t.Fatal(err)
	}
	if err := stream.SendMsg(dynamicMessage(t, `{"message":"ping"}`)); err != nil {
		t.Fatal(err)
	}
	out := dynamicMessage(t, "{}")
	if err := stream.RecvMsg(out); err != nil {
		t.Fatal(err)
	}
	if got := fieldString(out, "message"); got != "echo: ping" {
		t.Fatalf("unexpected bidi echo: %q", got)
	}
	if err := stream.CloseSend(); err != nil {
		t.Fatal(err)
	}
}

func TestWebSocketEcho(t *testing.T) {
	_, httpAddr := startServer(t)

	conn, _, err := websocket.DefaultDialer.Dial("ws://"+httpAddr+"/ws", nil)
	if err != nil {
		t.Fatalf("ws dial: %v", err)
	}
	defer conn.Close()

	if err := conn.WriteMessage(websocket.TextMessage, []byte("hello ws")); err != nil {
		t.Fatal(err)
	}
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	if string(msg) != "hello ws" {
		t.Fatalf("ws echo mismatch: got %q", string(msg))
	}

	if err := conn.WriteMessage(websocket.BinaryMessage, []byte{0x00, 0x01, 0xff}); err != nil {
		t.Fatal(err)
	}
	mt, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	if mt != websocket.BinaryMessage || string(msg) != "\x00\x01\xff" {
		t.Fatalf("binary echo mismatch: type=%d msg=%v", mt, msg)
	}
}

func TestSSEStreamsEvents(t *testing.T) {
	_, httpAddr := startServer(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://"+httpAddr+"/sse", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Accept", "text/event-stream")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	var lines []string
	for sc.Scan() && len(lines) < 8 {
		lines = append(lines, sc.Text())
	}
	if err := sc.Err(); err != nil {
		t.Fatal(err)
	}
	joined := strings.Join(lines, "\n")
	if !strings.Contains(joined, "event:") || !strings.Contains(joined, "data:") {
		t.Fatalf("sse did not produce event lines:\n%s", joined)
	}
}

func itoa(i int) string { return fmt.Sprint(i) }
