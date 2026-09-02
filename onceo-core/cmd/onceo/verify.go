package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	onceo "github.com/HalxDocs/onceo-core"
	"github.com/HalxDocs/onceo-core/internal/testutil"
	"github.com/HalxDocs/onceo-core/providers/bachs"
	"github.com/HalxDocs/onceo-core/providers/flutterwave"
	"github.com/HalxDocs/onceo-core/providers/mpesa"
	"github.com/HalxDocs/onceo-core/providers/opay"
	"github.com/HalxDocs/onceo-core/providers/paystack"
	"github.com/HalxDocs/onceo-core/providers/svix"
)

func verifyCmd(args []string) error {
	fs := flag.NewFlagSet("verify", flag.ExitOnError)
	providerName := fs.String("provider", "", "Payment provider (paystack, flutterwave, opay, mpesa, svix, bachs)")
	secret := fs.String("secret", "", "Provider secret key or hash")
	fs.Parse(reorderArgs(args, "provider", "secret"))

	if fs.NArg() < 1 {
		return fmt.Errorf("usage: onceo verify <file> --provider <provider> [--secret <secret>]")
	}

	body, err := os.ReadFile(fs.Arg(0))
	if err != nil {
		return fmt.Errorf("reading file: %w", err)
	}

	provider, err := newProvider(*providerName, *secret)
	if err != nil {
		return err
	}

	headers := buildHeaders(*providerName, *secret, body)
	event, err := onceo.Process(context.Background(), provider, noopStore{}, headers, body)
	if err != nil {
		return fmt.Errorf("processing: %w", err)
	}

	out, _ := json.MarshalIndent(event, "", "  ")
	fmt.Println(string(out))
	return nil
}

func buildHeaders(provider, secret string, body []byte) http.Header {
	headers := http.Header{}
	switch provider {
	case "paystack":
		if secret != "" {
			headers.Set("X-Paystack-Signature", testutil.SignHMACSHA512([]byte(secret), body))
		}
	case "flutterwave":
		if secret != "" {
			headers.Set("Verif-Hash", testutil.HashSHA256([]byte(secret)))
		}
	case "opay":
		if secret != "" {
			headers.Set("Authorization", testutil.SignHMACSHA512([]byte(secret), body))
		}
	case "mpesa":
		if secret != "" {
			headers.Set("X-Onceo-Mpesa-Callback-Token", secret)
		}
	case "svix":
		if secret != "" {
			msgID := "msg_" + strconv.FormatInt(time.Now().UnixNano(), 10)
			timestamp := strconv.FormatInt(time.Now().Unix(), 10)
			headers.Set("svix-id", msgID)
			headers.Set("svix-timestamp", timestamp)
			headers.Set("svix-signature", testutil.SignSvix(secret, msgID, timestamp, body))
		}
	case "bachs":
		if secret != "" {
			timestamp := strconv.FormatInt(time.Now().Unix(), 10)
			headers.Set("X-Bachs-Timestamp", timestamp)
			headers.Set("X-Bachs-Signature", testutil.SignBachs(secret, timestamp, body))
		}
	}
	return headers
}

type noopStore struct{}

func (noopStore) SaveIfNew(_ context.Context, _ onceo.Event) (bool, error) { return true, nil }

func newProvider(name, secret string) (onceo.Provider[any], error) {
	switch name {
	case "paystack":
		i, err := paystack.New(secret)
		if err != nil {
			return nil, err
		}
		return &providerWrapper[paystack.WebhookPayload]{inner: i}, nil
	case "flutterwave":
		i, err := flutterwave.New(secret)
		if err != nil {
			return nil, err
		}
		return &providerWrapper[flutterwave.WebhookPayload]{inner: i}, nil
	case "opay":
		i, err := opay.New(secret)
		if err != nil {
			return nil, err
		}
		return &providerWrapper[opay.WebhookPayload]{inner: i}, nil
	case "mpesa":
		// CLI uses a dummy token for testing; real usage routes through
		// router-injected X-Onceo-Mpesa-Callback-Token.
		i, err := mpesa.New(secret)
		if err != nil {
			return nil, err
		}
		return &providerWrapper[mpesa.STKCallbackPayload]{inner: i}, nil
	case "svix":
		i, err := svix.New(secret)
		if err != nil {
			return nil, err
		}
		return &providerWrapper[svix.WebhookPayload]{inner: i}, nil
	case "bachs":
		i, err := bachs.New(secret)
		if err != nil {
			return nil, err
		}
		return &providerWrapper[bachs.WebhookPayload]{inner: i}, nil
	default:
		return nil, fmt.Errorf("%w: %s", onceo.ErrUnknownProvider, name)
	}
}

type providerWrapper[T any] struct {
	inner onceo.Provider[T]
}

func (w *providerWrapper[T]) Name() string { return w.inner.Name() }

func (w *providerWrapper[T]) BodyBound() bool { return w.inner.BodyBound() }

func (w *providerWrapper[T]) VerifySignature(headers http.Header, body []byte) error {
	return w.inner.VerifySignature(headers, body)
}

func (w *providerWrapper[T]) Parse(body []byte) (any, error) {
	return w.inner.Parse(body)
}

func (w *providerWrapper[T]) Normalize(parsed any) (onceo.Event, error) {
	t, ok := parsed.(T)
	if !ok {
		return onceo.Event{}, onceo.ErrEventParseFailed
	}
	return w.inner.Normalize(t)
}
