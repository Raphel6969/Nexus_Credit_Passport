package main

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	r.GET("/v1/payments", func(c *gin.Context) {
		now := time.Now().Unix()
		c.JSON(http.StatusOK, gin.H{
			"items": []gin.H{
				{
					"id":         "pay_Mxyz123",
					"amount":     150000,
					"currency":   "INR",
					"status":     "captured",
					"email":      "customer1@example.com",
					"created_at": now - 86400,
				},
				{
					"id":         "pay_Mxyz124",
					"amount":     75000,
					"currency":   "INR",
					"status":     "captured",
					"email":      "customer2@example.com",
					"created_at": now - 172800,
				},
			},
		})
	})

	r.GET("/v1/settlements", func(c *gin.Context) {
		now := time.Now().Unix()
		c.JSON(http.StatusOK, gin.H{
			"items": []gin.H{
				{
					"id":         "setl_Mxyz999",
					"amount":     225000,
					"currency":   "INR",
					"created_at": now - 3600,
				},
			},
		})
	})

	log.Println("Starting Razorpay mock on port 9092")
	if err := r.Run(":9092"); err != nil {
		log.Fatal(err)
	}
}
