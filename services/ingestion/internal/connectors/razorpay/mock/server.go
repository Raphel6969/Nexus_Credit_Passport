package main

import (
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Payment represents a Razorpay payment record.
type Payment struct {
	ID        string `json:"id"`
	Amount    int64  `json:"amount"` // paise
	Currency  string `json:"currency"`
	Status    string `json:"status"`
	Email     string `json:"email"`
	CreatedAt int64  `json:"created_at"`
}

// Settlement represents a Razorpay settlement record.
type Settlement struct {
	ID        string `json:"id"`
	Amount    int64  `json:"amount"` // paise
	Currency  string `json:"currency"`
	CreatedAt int64  `json:"created_at"`
}

var (
	mu          sync.RWMutex
	payments    []Payment
	settlements []Settlement
)

func resetData() {
	payments = []Payment{}
	settlements = []Settlement{}
}

func randID(prefix string) string {
	const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 8)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return prefix + string(b)
}

func main() {
	rand.Seed(time.Now().UnixNano())
	resetData()

	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// ── GET /v1/payments ─────────────────────────────────────────────────────
	r.GET("/v1/payments", func(c *gin.Context) {
		mu.RLock()
		defer mu.RUnlock()
		c.JSON(http.StatusOK, gin.H{"items": payments, "count": len(payments)})
	})

	// ── POST /v1/payments/demo ────────────────────────────────────────────────
	// Demo endpoint: add a new payment to the in-memory store.
	r.POST("/v1/payments/demo", func(c *gin.Context) {
		var body struct {
			Amount   int64  `json:"amount" binding:"required,min=1"`
			Currency string `json:"currency"`
			Email    string `json:"email"`
			Status   string `json:"status"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if body.Currency == "" {
			body.Currency = "INR"
		}
		if body.Status == "" {
			body.Status = "captured"
		}
		if body.Email == "" {
			body.Email = "demo@customer.example.com"
		}

		p := Payment{
			ID:        randID("pay_"),
			Amount:    body.Amount,
			Currency:  body.Currency,
			Status:    body.Status,
			Email:     body.Email,
			CreatedAt: time.Now().Unix(),
		}

		mu.Lock()
		payments = append([]Payment{p}, payments...) // prepend so newest is first
		mu.Unlock()

		log.Printf("[demo] Added payment %s ₹%.2f from %s", p.ID, float64(p.Amount)/100.0, p.Email)
		c.JSON(http.StatusCreated, p)
	})

	// ── DELETE /v1/payments/demo/reset ───────────────────────────────────────
	r.DELETE("/v1/payments/demo/reset", func(c *gin.Context) {
		mu.Lock()
		resetData()
		mu.Unlock()
		c.JSON(http.StatusOK, gin.H{"status": "reset", "message": "All transactions cleared"})
	})

	// ── GET /v1/settlements ──────────────────────────────────────────────────
	r.GET("/v1/settlements", func(c *gin.Context) {
		mu.RLock()
		defer mu.RUnlock()
		c.JSON(http.StatusOK, gin.H{"items": settlements, "count": len(settlements)})
	})

	log.Println("Starting Razorpay demo mock on :9092")
	if err := r.Run(":9092"); err != nil {
		log.Fatal(err)
	}
}
