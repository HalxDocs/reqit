package main

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"

	onceo "github.com/HalxDocs/onceo-core"
	"github.com/HalxDocs/onceo-core/providers/paystack"
)

var store = onceo.NewMemoryStore()

var provider *paystack.Provider

func main() {
	secret := os.Getenv("PAYSTACK_SECRET_KEY")
	if secret == "" {
		log.Fatal("PAYSTACK_SECRET_KEY must be set")
	}
	var err error
	provider, err = paystack.New(secret)
	if err != nil {
		log.Fatalf("paystack.New: %v", err)
	}

	http.HandleFunc("/webhook/paystack", handlePaystack)

	log.Println("listening on :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal(err)
	}
}

func handlePaystack(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, onceo.MaxBodySize))
	if err != nil {
		if errors.Is(err, http.ErrHandlerTimeout) {
			http.Error(w, "request body too large", http.StatusRequestEntityTooLarge)
			return
		}
		http.Error(w, "failed to read body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	event, err := onceo.Process(r.Context(), provider, store, r.Header, body)
	if err != nil {
		if errors.Is(err, onceo.ErrInvalidSignature) {
			http.Error(w, "invalid signature", http.StatusUnauthorized)
			return
		}
		if errors.Is(err, onceo.ErrDuplicateEvent) {
			w.WriteHeader(http.StatusOK)
			return
		}
		log.Printf("processing error: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(event)
}
