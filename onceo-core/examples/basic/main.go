package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	onceo "github.com/HalxDocs/onceo-core"
	"github.com/HalxDocs/onceo-core/internal/testutil"
	"github.com/HalxDocs/onceo-core/providers/paystack"
)

func main() {
	body := []byte(`{"event":"charge.success","data":{"id":123,"status":"success","reference":"ref_001","amount":50000,"currency":"NGN"}}`)

	secret := os.Getenv("PAYSTACK_SECRET_KEY")
	if secret == "" {
		log.Fatal("PAYSTACK_SECRET_KEY must be set")
	}

	headers := http.Header{}
	headers.Set("X-Paystack-Signature", testutil.SignHMACSHA512([]byte(secret), body))

	provider, perr := paystack.New(secret)
	if perr != nil {
		log.Fatalf("paystack.New failed: %v", perr)
	}
	store := onceo.NewMemoryStore()

	event, err := onceo.Process(context.Background(), provider, store, headers, body)
	if err != nil {
		log.Fatalf("Process failed: %v", err)
	}

	fmt.Printf("Event processed successfully:\n")
	fmt.Printf("  ID:              %s\n", event.ID)
	fmt.Printf("  Provider:        %s\n", event.Provider)
	fmt.Printf("  ProviderEventID: %s\n", event.ProviderEventID)
	fmt.Printf("  Type:            %s\n", event.Type)
	fmt.Printf("  Status:          %s\n", event.Status)
	fmt.Printf("  AmountMinor:     %d\n", event.AmountMinor)
	fmt.Printf("  Currency:        %s\n", event.Currency)
	fmt.Printf("  Reference:       %s\n", event.Reference)
}
