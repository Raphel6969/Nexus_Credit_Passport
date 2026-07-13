package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	r.GET("/taxpayer/:gstin/gstr3b", func(c *gin.Context) {
		// Mock a single GSTR-3B return
		c.JSON(http.StatusOK, gin.H{
			"period":         "062025",
			"gross_turnover": 15000000, // 1,50,000 INR
			"tax_paid":       2700000,  // 27,000 INR
			"filing_date":    "2025-07-20",
			"status":         "FILED",
		})
	})

	r.GET("/taxpayer/:gstin/gstr1", func(c *gin.Context) {
		// Mock a single GSTR-1 return
		c.JSON(http.StatusOK, gin.H{
			"period": "062025",
			"b2b": []gin.H{
				{
					"ctin": "27AAPCU1823M1Z9",
					"name": "Tata Steel Ltd",
				},
				{
					"ctin": "29ABCDE1234F2Z5",
					"name": "Wipro Enterprises",
				},
			},
		})
	})

	log.Println("Starting GSTN mock on port 9091")
	if err := r.Run(":9091"); err != nil {
		log.Fatal(err)
	}
}
