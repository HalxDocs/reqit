package main

import (
	"errors"
	"io"
	"log"
	"net/http"
	"os"

	onceo "github.com/HalxDocs/onceo-core"
	"github.com/HalxDocs/onceo-core/providers/paystack"
	"github.com/gin-gonic/gin"
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

	r := gin.Default()

	r.POST("/v1/webhooks/paystack", handlePaystack)
	r.GET("/v1/events", listEvents)

	log.Println("listening on :8080")
	r.Run(":8080")
}

func handlePaystack(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, onceo.MaxBodySize)
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "request body too large or unreadable"})
		return
	}
	defer c.Request.Body.Close()

	event, err := onceo.Process(c.Request.Context(), provider, store, c.Request.Header, body)
	if err != nil {
		switch {
		case errors.Is(err, onceo.ErrInvalidSignature):
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		case errors.Is(err, onceo.ErrDuplicateEvent):
			c.JSON(http.StatusOK, gin.H{"status": "duplicate"})
		default:
			log.Printf("processing error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		}
		return
	}

	c.JSON(http.StatusOK, event)
}

func listEvents(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "not yet implemented"})
}
