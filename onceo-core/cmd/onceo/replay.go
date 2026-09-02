package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

func replayCmd(args []string) error {
	fs := flag.NewFlagSet("replay", flag.ExitOnError)
	providerName := fs.String("provider", "", "Payment provider (paystack, flutterwave)")
	secret := fs.String("secret", "", "Provider secret key for signing")
	url := fs.String("url", "http://localhost:8080/v1/webhooks", "Target URL")
	fs.Parse(reorderArgs(args, "provider", "secret", "url"))

	if fs.NArg() < 1 {
		return fmt.Errorf("usage: onceo replay <file> --url <url> [--secret <secret>] [--provider <provider>]")
	}

	body, err := os.ReadFile(fs.Arg(0))
	if err != nil {
		return fmt.Errorf("reading file: %w", err)
	}

	req, err := http.NewRequest("POST", *url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}

	if *secret != "" {
		switch *providerName {
		case "paystack":
			sig := signHMACSHA512([]byte(*secret), body)
			req.Header.Set("X-Paystack-Signature", sig)
		case "flutterwave":
			sig := signHMACSHA256([]byte(*secret), body)
			req.Header.Set("Verif-Hash", sig)
		}
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	fmt.Printf("Status: %s\n", resp.Status)
	fmt.Printf("Body: %s\n", string(respBody))

	return nil
}

func signHMACSHA512(secret, body []byte) string {
	mac := hmac.New(sha512.New, secret)
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func signHMACSHA256(secret, body []byte) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}
