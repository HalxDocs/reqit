package grpc

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"

	"github.com/jhump/protoreflect/desc"
	"github.com/jhump/protoreflect/dynamic"
	"github.com/jhump/protoreflect/grpcreflect"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"flux/internal/models"
)

type GRPCRequest struct {
	URL        string            `json:"url"`
	Service    string            `json:"service"`
	Method     string            `json:"method"`
	Body       string            `json:"body"`
	Headers    map[string]string `json:"headers"`
	TimeoutMs  int64             `json:"timeoutMs,omitempty"`
	ProtoFile  string            `json:"protoFile,omitempty"` // optional local .proto for offline invocation
	CACert     string            `json:"caCert,omitempty"`    // PEM CA bundle for custom roots
	ClientCert string            `json:"clientCert,omitempty"`
	ClientKey  string            `json:"clientKey,omitempty"`
}

type GRPCResponse struct {
	StatusCode  int                 `json:"statusCode"`
	Body        string              `json:"body"`
	Error       string              `json:"error,omitempty"`
	DurationMs  int64               `json:"durationMs"`
	Headers     map[string]string   `json:"headers"`
	Trailers    map[string]string   `json:"trailers"`
	GrpcCode    int                 `json:"grpcCode,omitempty"`
	GrpcStatus  string              `json:"grpcStatus,omitempty"`
}

type StreamFrame struct {
	Flags byte   `json:"flags"`
	Data  string `json:"data"`
}

type StreamResult struct {
	Frames     []StreamFrame     `json:"frames"`
	StatusCode int               `json:"statusCode"`
	Headers    map[string]string `json:"headers"`
	Trailers   map[string]string `json:"trailers"`
	Error      string            `json:"error,omitempty"`
	GrpcCode   int               `json:"grpcCode,omitempty"`
	GrpcStatus string            `json:"grpcStatus,omitempty"`
	DurationMs int64             `json:"durationMs"`
}

// parseTarget normalizes a user-supplied gRPC target and picks credentials.
// "host:port" and "grpc://" / "http://" are insecure; "grpcs://" / "https://"
// use TLS, optionally with a custom CA bundle and mTLS client certificate.
func parseTarget(raw string, tlsCfg *models.GRPCTLSConfig) (string, credentials.TransportCredentials) {
	raw = strings.TrimSpace(raw)
	if !strings.Contains(raw, "://") {
		// Bare "host:port" is insecure by default. If mTLS/CA material was
		// supplied, treat it as TLS since the user clearly expects encryption.
		if tlsCfg != nil && (tlsCfg.CACert != "" || tlsCfg.ClientCert != "") {
			return raw, tlsCredentials(tlsCfg)
		}
		return raw, insecure.NewCredentials()
	}
	u, err := url.Parse(raw)
	if err != nil {
		return raw, insecure.NewCredentials()
	}
	switch strings.ToLower(u.Scheme) {
	case "grpcs", "https":
		return u.Host, tlsCredentials(tlsCfg)
	default:
		return u.Host, insecure.NewCredentials()
	}
}

// tlsCredentials builds TLS transport credentials honoring a custom CA bundle
// and/or a client certificate (mTLS).
func tlsCredentials(cfg *models.GRPCTLSConfig) credentials.TransportCredentials {
	tlsCfg := &tls.Config{MinVersion: tls.VersionTLS12}
	if cfg != nil {
		if cfg.CACert != "" {
			pool := x509.NewCertPool()
			if pool.AppendCertsFromPEM([]byte(cfg.CACert)) {
				tlsCfg.RootCAs = pool
			}
		}
		if cfg.ClientCert != "" && cfg.ClientKey != "" {
			if cert, err := tls.X509KeyPair([]byte(cfg.ClientCert), []byte(cfg.ClientKey)); err == nil {
				tlsCfg.Certificates = []tls.Certificate{cert}
			}
		}
	}
	return credentials.NewTLS(tlsCfg)
}

func dial(ctx context.Context, raw string, tlsCfg *models.GRPCTLSConfig) (*grpc.ClientConn, error) {
	target, creds := parseTarget(raw, tlsCfg)
	return grpc.NewClient(target, grpc.WithTransportCredentials(creds))
}

// outgoingContext attaches user headers as gRPC metadata.
func outgoingContext(ctx context.Context, headers map[string]string) context.Context {
	md := metadata.MD{}
	for k, v := range headers {
		if k == "" {
			continue
		}
		md.Set(k, v)
	}
	if len(md) > 0 {
		return metadata.NewOutgoingContext(ctx, md)
	}
	return ctx
}

// resolveMethod returns the method descriptor for service/method using a local
// .proto file (when protoFile is set) or server reflection otherwise.
func resolveMethod(ctx context.Context, cc *grpc.ClientConn, service, method, protoFile string) (*desc.MethodDescriptor, error) {
	if service == "" || method == "" {
		return nil, errors.New("service and method are required")
	}
	if protoFile != "" {
		return resolveProtoMethod(protoFile, service, method)
	}
	refClient := grpcreflect.NewClientAuto(ctx, cc)
	defer refClient.Reset()

	fd, err := refClient.FileContainingSymbol(service)
	if err != nil {
		return nil, fmt.Errorf("server reflection: %w", err)
	}
	sd := fd.FindSymbol(service)
	if sd == nil {
		return nil, fmt.Errorf("service %q not found on server", service)
	}
	svc, ok := sd.(*desc.ServiceDescriptor)
	if !ok {
		return nil, fmt.Errorf("%q is not a service", service)
	}
	md := svc.FindMethodByName(method)
	if md == nil {
		return nil, fmt.Errorf("method %q not found on service %q", method, service)
	}
	return md, nil
}

// ListServices returns all service names exposed by the server via reflection.
func ListServices(ctx context.Context, url string, headers map[string]string, tlsCfg *models.GRPCTLSConfig) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	cc, err := dial(ctx, url, tlsCfg)
	if err != nil {
		return nil, err
	}
	defer cc.Close()

	refClient := grpcreflect.NewClientAuto(ctx, cc)
	defer refClient.Reset()

	services, err := refClient.ListServices()
	if err != nil {
		return nil, fmt.Errorf("server reflection: %w", err)
	}
	var out []string
	for _, s := range services {
		if strings.HasPrefix(s, "grpc.") || strings.HasPrefix(s, "google.protobuf.") {
			continue
		}
		out = append(out, s)
	}
	return out, nil
}

// ListMethods returns the method names for a service via reflection.
func ListMethods(ctx context.Context, url, service string, headers map[string]string, tlsCfg *models.GRPCTLSConfig) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	cc, err := dial(ctx, url, tlsCfg)
	if err != nil {
		return nil, err
	}
	defer cc.Close()

	ctx = outgoingContext(ctx, headers)
	refClient := grpcreflect.NewClientAuto(ctx, cc)
	defer refClient.Reset()

	fd, err := refClient.FileContainingSymbol(service)
	if err != nil {
		return nil, fmt.Errorf("server reflection: %w", err)
	}
	sd := fd.FindSymbol(service)
	svc, ok := sd.(*desc.ServiceDescriptor)
	if !ok || svc == nil {
		return nil, fmt.Errorf("service %q not found on server", service)
	}
	var out []string
	for _, m := range svc.GetMethods() {
		out = append(out, m.GetName())
	}
	return out, nil
}

// Invoke performs a unary gRPC call against a real server using reflection.
func Invoke(ctx context.Context, req GRPCRequest) *GRPCResponse {
	start := time.Now()
	if req.TimeoutMs <= 0 {
		req.TimeoutMs = 30000
	}
	ctx, cancel := context.WithTimeout(outgoingContext(ctx, req.Headers), time.Duration(req.TimeoutMs)*time.Millisecond)
	defer cancel()

	tlsCfg := &models.GRPCTLSConfig{CACert: req.CACert, ClientCert: req.ClientCert, ClientKey: req.ClientKey}
	cc, err := dial(ctx, req.URL, tlsCfg)
	if err != nil {
		return &GRPCResponse{Error: err.Error(), DurationMs: time.Since(start).Milliseconds()}
	}
	defer cc.Close()

	md, err := resolveMethod(ctx, cc, req.Service, req.Method, req.ProtoFile)
	if err != nil {
		return &GRPCResponse{Error: err.Error(), DurationMs: time.Since(start).Milliseconds()}
	}

	reqMsg := dynamic.NewMessage(md.GetInputType())
	if err := reqMsg.UnmarshalJSON([]byte(req.Body)); err != nil {
		return &GRPCResponse{Error: fmt.Sprintf("invalid request message: %v", err), DurationMs: time.Since(start).Milliseconds()}
	}

	respMsg := dynamic.NewMessage(md.GetOutputType())
	var hdr, trl metadata.MD
	fullMethod := fmt.Sprintf("/%s/%s", md.GetService().GetFullyQualifiedName(), md.GetName())

	err = cc.Invoke(ctx, fullMethod, reqMsg, respMsg, grpc.Header(&hdr), grpc.Trailer(&trl))
	duration := time.Since(start).Milliseconds()

	headers := metadataMap(hdr)
	trailers := metadataMap(trl)

	if err != nil {
		st, _ := status.FromError(err)
		return &GRPCResponse{
			StatusCode:  int(st.Code()),
			Error:       st.Message(),
			GrpcCode:    int(st.Code()),
			GrpcStatus:  st.Code().String(),
			DurationMs:  duration,
			Headers:     headers,
			Trailers:    trailers,
		}
	}

	body, marshalErr := respMsg.MarshalJSON()
	bodyStr := ""
	if marshalErr == nil {
		bodyStr = string(body)
	}

	return &GRPCResponse{
		StatusCode: 0,
		Body:       bodyStr,
		Headers:    headers,
		Trailers:   trailers,
		DurationMs: duration,
	}
}

// StreamInvoke performs a streaming gRPC call. It supports server-streaming
// (the common case); client/bidi streams send the single provided message and
// then read responses until the stream ends.
func StreamInvoke(ctx context.Context, req GRPCRequest) *StreamResult {
	start := time.Now()
	if req.TimeoutMs <= 0 {
		req.TimeoutMs = 60000
	}
	ctx, cancel := context.WithTimeout(outgoingContext(ctx, req.Headers), time.Duration(req.TimeoutMs)*time.Millisecond)
	defer cancel()

	tlsCfg := &models.GRPCTLSConfig{CACert: req.CACert, ClientCert: req.ClientCert, ClientKey: req.ClientKey}
	cc, err := dial(ctx, req.URL, tlsCfg)
	if err != nil {
		return &StreamResult{Error: err.Error(), DurationMs: time.Since(start).Milliseconds()}
	}
	defer cc.Close()

	md, err := resolveMethod(ctx, cc, req.Service, req.Method, req.ProtoFile)
	if err != nil {
		return &StreamResult{Error: err.Error(), DurationMs: time.Since(start).Milliseconds()}
	}

	reqMsg := dynamic.NewMessage(md.GetInputType())
	if err := reqMsg.UnmarshalJSON([]byte(req.Body)); err != nil {
		return &StreamResult{Error: fmt.Sprintf("invalid request message: %v", err), DurationMs: time.Since(start).Milliseconds()}
	}

	fullMethod := fmt.Sprintf("/%s/%s", md.GetService().GetFullyQualifiedName(), md.GetName())
	streamDesc := &grpc.StreamDesc{
		ServerStreams: md.IsServerStreaming(),
		ClientStreams: md.IsClientStreaming(),
	}
	var hdr metadata.MD
	stream, err := cc.NewStream(ctx, streamDesc, fullMethod, grpc.Header(&hdr))
	if err != nil {
		return &StreamResult{Error: err.Error(), DurationMs: time.Since(start).Milliseconds()}
	}

	if err := stream.SendMsg(reqMsg); err != nil {
		return &StreamResult{Error: err.Error(), DurationMs: time.Since(start).Milliseconds()}
	}
	if err := stream.CloseSend(); err != nil {
		return &StreamResult{Error: err.Error(), DurationMs: time.Since(start).Milliseconds()}
	}

	var frames []StreamFrame
	var streamErr error
	for {
		respMsg := dynamic.NewMessage(md.GetOutputType())
		err := stream.RecvMsg(respMsg)
		if err == io.EOF {
			break
		}
		if err != nil {
			streamErr = err
			break
		}
		data, marshalErr := respMsg.MarshalJSON()
		if marshalErr != nil {
			data = []byte(fmt.Sprintf("{\"marshalError\":%q}", marshalErr.Error()))
		}
		frames = append(frames, StreamFrame{Data: string(data)})
	}

	duration := time.Since(start).Milliseconds()
	headers := metadataMap(hdr)
	trailers := metadataMap(stream.Trailer())

	result := &StreamResult{
		Frames:     frames,
		Headers:    headers,
		Trailers:   trailers,
		DurationMs: duration,
	}
	if streamErr != nil {
		st, _ := status.FromError(streamErr)
		result.Error = st.Message()
		result.GrpcCode = int(st.Code())
		result.GrpcStatus = st.Code().String()
	}
	return result
}

func metadataMap(md metadata.MD) map[string]string {
	out := make(map[string]string, len(md))
	for k, vs := range md {
		out[k] = strings.Join(vs, ", ")
	}
	return out
}
