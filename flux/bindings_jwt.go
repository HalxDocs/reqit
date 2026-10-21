package main

import (
	"flux/internal/jwt"
	"flux/internal/models"
)

func (a *App) DecodeJWT(token string) *models.JWTDecoded {
	decoded := jwt.Decode(token)
	header := map[string]interface{}{
		"alg": decoded.Header.Alg,
		"typ": decoded.Header.Typ,
	}
	if decoded.Header.Kid != "" {
		header["kid"] = decoded.Header.Kid
	}
	return &models.JWTDecoded{
		Header:  header,
		Claims:  decoded.Claims,
		Valid:   decoded.Valid,
		Expired: decoded.Expired,
		Error:   decoded.Error,
	}
}

// --- Profile ---
