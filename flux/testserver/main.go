// Command testserver runs a local real-time protocol test server for verifying
// reqit's gRPC (reflection + all 4 streaming types), WebSocket, and SSE clients.
//
// Endpoints:
//
//	gRPC      localhost:50051  demo.EchoService (reflection enabled)
//	WebSocket ws://localhost:8080/ws            echo server (text + binary)
//	SSE       http://localhost:8080/sse         periodic events, id/event lines
//
// Run: go run ./testserver
package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/jhump/protoreflect/desc"
	"github.com/jhump/protoreflect/desc/protoparse"
	"github.com/jhump/protoreflect/dynamic"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoregistry"
)

const grpcPort = ":50051"
const httpPort = ":8080"

const demoProto = `
syntax = "proto3";
package demo;

message EchoRequest {
  string message = 1;
  int32 count = 2;
}

message EchoResponse {
  string message = 1;
  int32 count = 2;
}

service EchoService {
  rpc UnaryEcho(EchoRequest) returns (EchoResponse);
  rpc ServerStreamEcho(EchoRequest) returns (stream EchoResponse);
  rpc ClientStreamEcho(stream EchoRequest) returns (EchoResponse);
  rpc BidiEcho(stream EchoRequest) returns (stream EchoResponse);
}
`

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	// gRPC server
	go func() {
		if err := serveGRPC(); err != nil {
			log.Printf("grpc server: %v", err)
		}
	}()

	// HTTP server (WS + SSE)
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", handleWS)
	mux.HandleFunc("/sse", handleSSE)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "testserver up\n\n  gRPC: localhost%s (demo.EchoService)\n  WS:   ws://localhost%s/ws\n  SSE:  http://localhost%s/sse\n", grpcPort, httpPort, httpPort)
	})

	fmt.Println("testserver listening:")
	fmt.Printf("  gRPC  -> localhost%s (demo.EchoService, reflection enabled)\n", grpcPort)
	fmt.Printf("  WS    -> ws://localhost%s/ws\n", httpPort)
	fmt.Printf("  SSE   -> http://localhost%s/sse\n", httpPort)
	fmt.Println()
	fmt.Println("Try in reqit:")
	fmt.Println("  gRPC: server url localhost:50051, service demo.EchoService, method UnaryEcho { \"message\": \"hi\" }")
	fmt.Println("        streaming methods: ServerStreamEcho, ClientStreamEcho, BidiEcho")
	fmt.Println("  WS:   connect, send \"hello\", watch the echo")
	fmt.Println("  SSE:  HTTP tab, GET http://localhost:8080/sse with Accept: text/event-stream")
	return http.ListenAndServe(httpPort, mux)
}

// --- gRPC ---

func serveGRPC() error {
	fd, err := parseProto(demoProto)
	if err != nil {
		return err
	}
	if err := registerFile(fd); err != nil {
		return err
	}

	srv := grpc.NewServer()
	srv.RegisterService(echoServiceDesc(fd), &echoServer{})
	reflection.Register(srv)

	lis, err := netListen(grpcPort)
	if err != nil {
		return err
	}
	return srv.Serve(lis)
}

// echoServiceDesc builds the grpc.ServiceDesc for demo.EchoService from the
// parsed file descriptor.
func echoServiceDesc(fd *desc.FileDescriptor) *grpc.ServiceDesc {
	svc := fd.FindSymbol("demo.EchoService")
	serviceDesc, ok := svc.(*desc.ServiceDescriptor)
	if !ok || serviceDesc == nil {
		panic("demo.EchoService not found in proto")
	}
	reqDesc := serviceDesc.FindMethodByName("UnaryEcho").GetInputType()

	md := &grpc.ServiceDesc{
		ServiceName: "demo.EchoService",
		HandlerType: (*echoServerAPI)(nil),
		Methods: []grpc.MethodDesc{
			{
				MethodName: "UnaryEcho",
				Handler: func(srv interface{}, ctx context.Context, dec func(interface{}) error, _ grpc.UnaryServerInterceptor) (interface{}, error) {
					in := dynamic.NewMessage(reqDesc)
					if err := dec(in); err != nil {
						return nil, err
					}
					return echoReply(in)
				},
			},
		},
		Streams: []grpc.StreamDesc{
			{
				StreamName:    "ServerStreamEcho",
				ServerStreams: true,
				Handler: func(srv interface{}, stream grpc.ServerStream) error {
					in := dynamic.NewMessage(reqDesc)
					if err := stream.RecvMsg(in); err != nil {
						return err
					}
					count := fieldInt(in, "count")
					if count <= 0 {
						count = 5
					}
					for i := int32(0); i < count; i++ {
						out, _ := echoReply(in)
						out.SetFieldByName("count", int32(i+1))
						if err := stream.SendMsg(out); err != nil {
							return err
						}
						time.Sleep(300 * time.Millisecond)
					}
					return nil
				},
			},
			{
				StreamName:    "ClientStreamEcho",
				ClientStreams: true,
				Handler: func(srv interface{}, stream grpc.ServerStream) error {
					var total int32
					var last string
					for {
						in := dynamic.NewMessage(reqDesc)
						err := stream.RecvMsg(in)
						if err == io.EOF {
							break
						}
						if err != nil {
							return err
						}
						total++
						last = fieldString(in, "message")
					}
					out := dynamic.NewMessage(reqDesc)
					out.SetFieldByName("message", fmt.Sprintf("received %d messages (last: %s)", total, last))
					out.SetFieldByName("count", total)
					return stream.SendMsg(out)
				},
			},
			{
				StreamName:    "BidiEcho",
				ServerStreams: true,
				ClientStreams: true,
				Handler: func(srv interface{}, stream grpc.ServerStream) error {
					for {
						in := dynamic.NewMessage(reqDesc)
						err := stream.RecvMsg(in)
						if err == io.EOF {
							return nil
						}
						if err != nil {
							return err
						}
						out := dynamic.NewMessage(reqDesc)
						out.SetFieldByName("message", "echo: "+fieldString(in, "message"))
						out.SetFieldByName("count", int32(1))
						if err := stream.SendMsg(out); err != nil {
							return err
						}
					}
				},
			},
		},
	}
	// Metadata lets grpc-go attach the file descriptor to the service.
	md.Metadata = fd.AsFileDescriptorProto()
	return md
}
// echoServer is the empty handler type required by grpc.ServiceDesc.
type echoServer struct{}

// echoServerAPI is the interface grpc uses to validate handler signatures.
type echoServerAPI interface{}

func echoReply(in *dynamic.Message) (*dynamic.Message, error) {
	out := dynamic.NewMessage(in.GetMessageDescriptor())
	out.SetFieldByName("message", fieldString(in, "message"))
	out.SetFieldByName("count", fieldInt(in, "count"))
	return out, nil
}

func fieldString(m *dynamic.Message, name string) string {
	if v := m.GetFieldByName(name); v != nil {
		if s, ok := v.(string); ok {
			return s
		}
		return fmt.Sprint(v)
	}
	return ""
}

func fieldInt(m *dynamic.Message, name string) int32 {
	if v := m.GetFieldByName(name); v != nil {
		switch n := v.(type) {
		case int32:
			return n
		case int64:
			return int32(n)
		}
	}
	return 0
}

func parseProto(src string) (*desc.FileDescriptor, error) {
	p := protoparse.Parser{ImportPaths: []string{"."}}
	// protoparse reads from files; emulate stdin via a temp dir instead of
	// writing to disk by using the Accessor API.
	p.Accessor = protoparse.FileContentsFromMap(map[string]string{"demo.proto": src})
	files, err := p.ParseFiles("demo.proto")
	if err != nil {
		return nil, err
	}
	return files[0], nil
}

func registerFile(fd *desc.FileDescriptor) error {
	fdp := fd.AsFileDescriptorProto()
	// Already registered (tests run against the same global registry).
	if _, err := protoregistry.GlobalFiles.FindFileByPath(fdp.GetName()); err == nil {
		return nil
	}
	f, err := protodesc.NewFile(fdp, protoregistry.GlobalFiles)
	if err != nil {
		return err
	}
	// Register dependencies if missing (protobuf well-known types are already
	// in GlobalFiles, so only our file needs registering).
	return protoregistry.GlobalFiles.RegisterFile(f)
}

// netListen is split out so the test can override the listener.
var netListen = func(addr string) (net.Listener, error) {
	return net.Listen("tcp", addr)
}

// --- WebSocket ---

var upgrader = websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}

func handleWS(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer c.Close()
	for {
		mt, msg, err := c.ReadMessage()
		if err != nil {
			return
		}
		// Reply to pings automatically.
		if mt == websocket.PingMessage {
			_ = c.WriteMessage(websocket.PongMessage, msg)
			continue
		}
		// Echo text or binary frames back as-is.
		if err := c.WriteMessage(mt, msg); err != nil {
			return
		}
	}
}

// --- SSE ---

func handleSSE(w http.ResponseWriter, r *http.Request) {
	fl, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ctx := r.Context()
	i := 0
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(1 * time.Second):
		}
		i++
		// Alternate event names so the event filter can be exercised.
		name := "tick"
		if i%3 == 0 {
			name = "heartbeat"
		}
		fmt.Fprintf(w, "event: %s\n", name)
		fmt.Fprintf(w, "id: %d\n", i)
		fmt.Fprintf(w, "data: {\"index\": %d, \"time\": \"%s\"}\n\n", i, time.Now().Format(time.RFC3339))
		fl.Flush()
	}
}

var _ = io.EOF
