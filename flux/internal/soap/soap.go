package soap

import (
	"encoding/xml"
	"fmt"
)

type Envelope struct {
	XMLName xml.Name `xml:"http://schemas.xmlsoap.org/soap/envelope/ Envelope"`
	Header  *Header  `xml:"http://schemas.xmlsoap.org/soap/envelope/ Header,omitempty"`
	Body    Body     `xml:"http://schemas.xmlsoap.org/soap/envelope/ Body"`
}

type Header struct {
	Data []byte `xml:",innerxml"`
}

type Body struct {
	Content string `xml:",innerxml"`
}

type WSDLInfo struct {
	TargetNamespace string   `xml:"targetNamespace,attr"`
	Services        []Service `xml:"service"`
	Bindings        []Binding `xml:"binding"`
	Messages        []Message `xml:"message"`
}

type Service struct {
	Name string `xml:"name,attr"`
	Port []Port `xml:"port"`
}

type Port struct {
	Name    string `xml:"name,attr"`
	Binding string `xml:"binding,attr"`
	Address string `xml:"address"`
}

type Binding struct {
	Name    string `xml:"name,attr"`
	Type    string `xml:"type,attr"`
	Verb    string `xml:"operation>input>body>use,attr"`
}

type Message struct {
	Name string `xml:"name,attr"`
}

type SOAPRequest struct {
	Action      string            `json:"action"`
	Body        string            `json:"body"`
	ServiceURL  string            `json:"serviceUrl"`
	SOAPVersion string            `json:"soapVersion"` // "1.1" or "1.2"
	Headers     map[string]string `json:"headers"`
}

func BuildEnvelope(req SOAPRequest) (string, string) {
	contentType := "text/xml; charset=utf-8"
	if req.SOAPVersion == "1.2" {
		contentType = "application/soap+xml; charset=utf-8"
	}

	env := fmt.Sprintf(`<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>%s</soap:Header>
  <soap:Body>
    %s
  </soap:Body>
</soap:Envelope>`, "", req.Body)

	headers := make(map[string]string)
	for k, v := range req.Headers {
		headers[k] = v
	}
	headers["Content-Type"] = contentType
	if req.Action != "" && req.SOAPVersion == "1.1" {
		headers["SOAPAction"] = req.Action
	}

	return env, contentType
}
