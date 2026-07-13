package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	r.GET("/api/v3/invoices", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"invoices": []gin.H{
				{
					"invoice_id":    "inv_101",
					"customer_name": "ABC Corp",
					"total":         50000.0,
					"currency_code": "INR",
					"date":          "2025-06-01",
					"due_date":      "2025-06-15",
					"status":        "paid",
				},
				{
					"invoice_id":    "inv_102",
					"customer_name": "XYZ Inc",
					"total":         25000.0,
					"currency_code": "INR",
					"date":          "2025-07-01",
					"due_date":      "2025-07-15",
					"status":        "overdue",
				},
			},
		})
	})

	r.GET("/api/v3/bills", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"bills": []gin.H{
				{
					"bill_id":       "bill_201",
					"vendor_name":   "Supplier A",
					"total":         10000.0,
					"currency_code": "INR",
					"date":          "2025-06-10",
					"due_date":      "2025-06-20",
					"status":        "paid",
				},
				{
					"bill_id":       "bill_202",
					"vendor_name":   "Supplier B",
					"total":         15000.0,
					"currency_code": "INR",
					"date":          "2025-07-05",
					"due_date":      "2025-07-25",
					"status":        "open",
				},
			},
		})
	})

	log.Println("Starting Zoho mock on port 9093")
	if err := r.Run(":9093"); err != nil {
		log.Fatal(err)
	}
}
