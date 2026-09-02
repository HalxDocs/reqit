package benchmarks

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"testing"

	onceo "github.com/HalxDocs/onceo-core"
	"github.com/HalxDocs/onceo-core/internal/testutil"
	"github.com/HalxDocs/onceo-core/providers/paystack"
)

func BenchmarkPaystackVerify(b *testing.B) {
	secret := "sk_test_bench"
	bodyTmpl, err := os.ReadFile("../providers/paystack/testdata/charge_success.json")
	if err != nil {
		b.Fatal(err)
	}

	p, _ := paystack.New(secret)
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		store := onceo.NewMemoryStore()
		body := []byte(fmt.Sprintf(`{"event":"charge.success","data":{"id":%d,"status":"success","reference":"ref_%d","amount":50000,"currency":"NGN"}}`, i, i))
		headers := http.Header{}
		headers.Set("X-Paystack-Signature", testutil.SignHMACSHA512([]byte(secret), body))
		_, _ = onceo.Process(ctx, p, store, headers, body)
	}
	_ = bodyTmpl
}

func BenchmarkPaystackParse(b *testing.B) {
	body, err := os.ReadFile("../providers/paystack/testdata/charge_success.json")
	if err != nil {
		b.Fatal(err)
	}

	p, _ := paystack.New("sk_test_bench")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = p.Parse(body)
	}
}

func BenchmarkPaystackNormalize(b *testing.B) {
	body, err := os.ReadFile("../providers/paystack/testdata/charge_success.json")
	if err != nil {
		b.Fatal(err)
	}

	p, _ := paystack.New("sk_test_bench")
	parsed, _ := p.Parse(body)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = p.Normalize(parsed)
	}
}
