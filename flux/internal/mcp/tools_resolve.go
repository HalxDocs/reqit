package mcp

import (
	"flux/internal/models"
	"strings"
)

var varPattern = strings.NewReplacer("{{", "{{", "}}", "}}")

func resolvePayloadMCP(p models.RequestPayload, env map[string]string) models.RequestPayload {
	resolve := func(s string) string {
		for k, v := range env {
			s = strings.ReplaceAll(s, "{{"+k+"}}", v)
		}
		return s
	}

	p.URL = resolve(p.URL)
	for i := range p.Headers {
		if p.Headers[i].Enabled {
			p.Headers[i].Value = resolve(p.Headers[i].Value)
		}
	}
	for i := range p.Params {
		if p.Params[i].Enabled {
			p.Params[i].Value = resolve(p.Params[i].Value)
		}
	}
	p.Body = resolve(p.Body)
	p.AuthValue = resolve(p.AuthValue)
	return p
}
