package grpc

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"sync"

	"github.com/jhump/protoreflect/desc"
	"github.com/jhump/protoreflect/desc/protoparse"
	"google.golang.org/protobuf/types/descriptorpb"

	"flux/internal/models"
)

var (
	protoCacheMu sync.Mutex
	protoCache   = map[string]*desc.FileDescriptor{}
	protoErrCache = map[string]error{}
)

// loadProto parses a .proto file (resolving imports relative to its directory
// and any inferable paths) and caches the resulting file descriptor.
func loadProto(path string) (*desc.FileDescriptor, error) {
	path = filepath.Clean(path)
	protoCacheMu.Lock()
	defer protoCacheMu.Unlock()

	if fd, ok := protoCache[path]; ok {
		return fd, nil
	}
if err, ok := protoErrCache[path]; ok {
		return nil, err
	}

	parser := protoparse.Parser{
		ImportPaths:      []string{filepath.Dir(path)},
		InferImportPaths: true,
	}
	fds, err := parser.ParseFiles(filepath.Base(path))
	if err != nil {
		protoErrCache[path] = err
		return nil, err
	}
	if len(fds) == 0 {
		err := fmt.Errorf("proto file parsed no descriptors")
		protoErrCache[path] = err
		return nil, err
	}
	protoCache[path] = fds[0]
	return fds[0], nil
}

// resolveProtoMethod returns the method descriptor for service/method inside a parsed proto file.
func resolveProtoMethod(path, service, method string) (*desc.MethodDescriptor, error) {
	fd, err := loadProto(path)
	if err != nil {
		return nil, err
	}
	svc, ok := fd.FindSymbol(service).(*desc.ServiceDescriptor)
	if !ok || svc == nil {
		return nil, fmt.Errorf("service %q not found in proto file", service)
	}
	md := svc.FindMethodByName(method)
	if md == nil {
		return nil, fmt.Errorf("method %q not found on service %q", method, service)
	}
	return md, nil
}

// ListProtoServices parses a .proto file and returns every service it declares
// together with their methods, streaming flags, and an example request body.
func ListProtoServices(path string) ([]models.GRPCProtoService, error) {
	fd, err := loadProto(path)
	if err != nil {
		return nil, err
	}
	var out []models.GRPCProtoService
	for _, svc := range fd.GetServices() {
		ps := models.GRPCProtoService{
			FullyQualifiedName: svc.GetFullyQualifiedName(),
		}
		for _, m := range svc.GetMethods() {
			example, err := exampleBody(m.GetInputType())
			if err != nil {
				example = ""
			}
			ps.Methods = append(ps.Methods, models.GRPCProtoMethod{
				Name:            m.GetName(),
				RequestType:     m.GetInputType().GetFullyQualifiedName(),
				ResponseType:    m.GetOutputType().GetFullyQualifiedName(),
				ClientStreaming: m.IsClientStreaming(),
				ServerStreaming: m.IsServerStreaming(),
				ExampleJSON:     example,
			})
		}
		out = append(out, ps)
	}
	return out, nil
}

// exampleBody builds a JSON document with fake-but-valid values for every field
// of the given message type, so users have a working starting point.
func exampleBody(md *desc.MessageDescriptor) (string, error) {
	obj := exampleMessage(md)
	b, err := json.MarshalIndent(obj, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func exampleMessage(md *desc.MessageDescriptor) map[string]interface{} {
	out := map[string]interface{}{}
	for _, f := range md.GetFields() {
		out[f.GetJSONName()] = exampleField(f)
	}
	return out
}

func exampleField(f *desc.FieldDescriptor) interface{} {
	switch {
	case f.IsMap():
		kv := map[string]interface{}{}
		valF := f.GetMapValueType()
		if valF != nil {
			kv["key"] = mapOrScalar(valF)
		}
		return kv
	case f.IsRepeated():
		return []interface{}{mapOrScalar(f)}
	case f.GetMessageType() != nil:
		return exampleMessage(f.GetMessageType())
	case f.GetEnumType() != nil:
		if vals := f.GetEnumType().GetValues(); len(vals) > 0 {
			return vals[0].GetName()
		}
		return ""
	default:
		return scalarExample(f)
	}
}

func mapOrScalar(f *desc.FieldDescriptor) interface{} {
	if f.GetMessageType() != nil {
		return exampleMessage(f.GetMessageType())
	}
	if f.GetEnumType() != nil {
		if vals := f.GetEnumType().GetValues(); len(vals) > 0 {
			return vals[0].GetName()
		}
		return ""
	}
	return scalarExample(f)
}

func scalarExample(f *desc.FieldDescriptor) interface{} {
	switch f.GetType() {
	case descriptorpb.FieldDescriptorProto_TYPE_INT64,
		descriptorpb.FieldDescriptorProto_TYPE_UINT64,
		descriptorpb.FieldDescriptorProto_TYPE_INT32,
		descriptorpb.FieldDescriptorProto_TYPE_UINT32,
		descriptorpb.FieldDescriptorProto_TYPE_SINT64,
		descriptorpb.FieldDescriptorProto_TYPE_SINT32,
		descriptorpb.FieldDescriptorProto_TYPE_FIXED64,
		descriptorpb.FieldDescriptorProto_TYPE_FIXED32,
		descriptorpb.FieldDescriptorProto_TYPE_SFIXED64,
		descriptorpb.FieldDescriptorProto_TYPE_SFIXED32:
		return 1
	case descriptorpb.FieldDescriptorProto_TYPE_BOOL:
		return true
	case descriptorpb.FieldDescriptorProto_TYPE_STRING:
		return "string"
	case descriptorpb.FieldDescriptorProto_TYPE_BYTES:
		return ""
	case descriptorpb.FieldDescriptorProto_TYPE_DOUBLE,
		descriptorpb.FieldDescriptorProto_TYPE_FLOAT:
		return 1.0
	default:
		return ""
	}
}