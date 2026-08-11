package grpc

import (
	"context"
	"errors"
	"fmt"
	"io"
	"sync"
	"time"

	"github.com/jhump/protoreflect/desc"
	"github.com/jhump/protoreflect/dynamic"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"flux/internal/models"
)

// streamSession is one long-lived gRPC stream. All four gRPC streaming shapes
// (unary, server-stream, client-stream, bidi) are driven by the same session:
// the client sends messages, closes the send side, and the read loop emits
// frames live to the frontend.
type streamSession struct {
	id      string
	cancel  context.CancelFunc
	cc      *grpc.ClientConn
	stream  grpc.ClientStream
	md      *desc.MethodDescriptor
	done    chan struct{}
	scanMu  sync.Mutex
	cleanM  sync.Once
}

// StreamEventCallback receives every stream session event.
type StreamEventCallback func(models.GRPCStreamEvent)

var (
	sessionMu    sync.Mutex
	sessions     = map[string]*streamSession{}
	sessionEvent StreamEventCallback
)

// SetSessionEventCallback wires the callback that receives every stream event.
// The App forwards these to the frontend as Wails runtime events.
func SetSessionEventCallback(fn StreamEventCallback) {
	sessionMu.Lock()
	sessionEvent = fn
	sessionMu.Unlock()
}

func emitEvent(ev models.GRPCStreamEvent) {
	sessionMu.Lock()
	fn := sessionEvent
	sessionMu.Unlock()
	if fn != nil {
		fn(ev)
	}
}

// StartStream opens a streaming session for the given RPC. The returned id is
// used by SendStreamMessage / CloseStream / CancelStream. It does not block:
// responses are streamed through the event callback as they arrive.
func StartStream(req models.GRPCStreamRequest) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)

	tlsCfg := &models.GRPCTLSConfig{CACert: req.CACert, ClientCert: req.ClientCert, ClientKey: req.ClientKey}
	cc, err := dial(ctx, req.URL, tlsCfg)
	if err != nil {
		cancel()
		return "", err
	}

	md, err := resolveMethod(ctx, cc, req.Service, req.Method, req.ProtoFile)
	if err != nil {
		cc.Close()
		cancel()
		return "", err
	}

	fullMethod := fmt.Sprintf("/%s/%s", md.GetService().GetFullyQualifiedName(), md.GetName())
	streamDesc := &grpc.StreamDesc{
		ServerStreams: md.IsServerStreaming(),
		ClientStreams: md.IsClientStreaming(),
	}
	ctx = outgoingContext(ctx, req.Headers)
	var hdr metadata.MD
	st, err := cc.NewStream(ctx, streamDesc, fullMethod, grpc.Header(&hdr))
	if err != nil {
		cc.Close()
		cancel()
		return "", err
	}

	id := fmt.Sprintf("%d", time.Now().UnixNano())
	sess := &streamSession{
		id:     id,
		cancel: cancel,
		cc:     cc,
		stream: st,
		md:     md,
		done:   make(chan struct{}),
	}

	sessionMu.Lock()
	sessions[id] = sess
	sessionMu.Unlock()

	emitEvent(models.GRPCStreamEvent{
		SessionID: id,
		Type:      "connected",
		Headers:   metadataMap(hdr),
	})

	if req.AutoClose {
		if err := sess.SendBody(req.Body); err != nil {
			sess.finish(err)
			return id, err
		}
		if err := sess.CloseSend(); err != nil {
			sess.finish(err)
			return id, err
		}
	}

	// The read loop streams every received frame live to the frontend.
	go sess.readLoop()
	return id, nil
}

// SendBody sends one message on the stream from JSON.
func (s *streamSession) SendBody(body string) error {
	s.scanMu.Lock()
	defer s.scanMu.Unlock()
	if s.stream == nil {
		return errors.New("stream is closed")
	}
	reqMsg := dynamic.NewMessage(s.md.GetInputType())
	if err := reqMsg.UnmarshalJSON([]byte(body)); err != nil {
		return fmt.Errorf("invalid request message: %v", err)
	}
	return s.stream.SendMsg(reqMsg)
}

// CloseSend closes the client side of a client-streaming / bidi stream without
// terminating the session, allowing the server to finish sending responses.
func (s *streamSession) CloseSend() error {
	s.scanMu.Lock()
	defer s.scanMu.Unlock()
	if s.stream == nil {
		return errors.New("stream is closed")
	}
	return s.stream.CloseSend()
}

// readLoop receives frames and emits them as events until the stream ends.
func (s *streamSession) readLoop() {
	start := time.Now()
	frameNum := 0
	defer func() {
		s.cleanM.Do(func() {
			sessionMu.Lock()
			delete(sessions, s.id)
			sessionMu.Unlock()
			s.cancel()
			close(s.done)
		})
	}()
	for {
		respMsg := dynamic.NewMessage(s.md.GetOutputType())
		err := s.stream.RecvMsg(respMsg)
		if err == io.EOF {
			s.emitDone(start, nil)
			return
		}
		if err != nil {
			s.emitDone(start, err)
			return
		}
		data, marshalErr := respMsg.MarshalJSON()
		if marshalErr != nil {
			data = []byte(fmt.Sprintf("{\"marshalError\":%q}", marshalErr.Error()))
		}
		frameNum++
		emitEvent(models.GRPCStreamEvent{
			SessionID: s.id,
			Type:      "frame",
			FrameNum:  frameNum,
			Data:      string(data),
		})
	}
}

func (s *streamSession) emitDone(start time.Time, streamErr error) {
	var gcode int
	var gstatus string
	dur := time.Since(start).Milliseconds()
	if streamErr != nil {
		st, _ := status.FromError(streamErr)
		gcode = int(st.Code())
		gstatus = st.Code().String()
	}
	emitEvent(models.GRPCStreamEvent{
		SessionID:  s.id,
		Type:       "done",
		DurationMs: dur,
		GrpcCode:   gcode,
		GrpcStatus: gstatus,
		Message:    grpcStatusOrMsg(streamErr),
		Trailers:   metadataMap(s.stream.Trailer()),
	})
}

func grpcStatusOrMsg(err error) string {
	if err == nil || err == io.EOF {
		return ""
	}
	st, ok := status.FromError(err)
	if ok {
		return st.Message()
	}
	return err.Error()
}

// SendStreamMessage sends one JSON message from the frontend.
func SendStreamMessage(id, body string) error {
	sessionMu.Lock()
	s := sessions[id]
	sessionMu.Unlock()
	if s == nil {
		return errors.New("stream session not found (did it end?)")
	}
	return s.SendBody(body)
}

// CloseStreamSend finishes the client side of a stream (see streamSession.CloseSend).
func CloseStreamSend(id string) error {
	sessionMu.Lock()
	s := sessions[id]
	sessionMu.Unlock()
	if s == nil {
		return errors.New("stream session not found")
	}
	return s.CloseSend()
}

// CancelStream cancels and cleans up a session immediately.
func CancelStream(id string) {
	sessionMu.Lock()
	s := sessions[id]
	if s != nil {
		delete(sessions, id)
	}
	sessionMu.Unlock()
	if s != nil {
		s.finish(nil)
	}
}

func (s *streamSession) finish(streamErr error) {
	s.cleanM.Do(func() {
		s.cancel()
		if s.stream != nil {
			s.stream.CloseSend()
		}
		s.cc.Close()
		sessionMu.Lock()
		delete(sessions, s.id)
		sessionMu.Unlock()
		close(s.done)
	})
}