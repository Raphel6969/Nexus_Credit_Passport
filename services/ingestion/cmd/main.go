package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/nexus-credit-passport/ingestion/internal/connectors"
	"github.com/nexus-credit-passport/ingestion/internal/connectors/setu"
	"github.com/nexus-credit-passport/ingestion/internal/orchestrator"
	"github.com/nexus-credit-passport/ingestion/internal/pii"
	"github.com/nexus-credit-passport/ingestion/internal/store"
)

func main() {
	// Load env: try root .env.local first (local dev), then current dir (Docker)
	_ = godotenv.Load("../../.env.local")
	_ = godotenv.Load(".env.local")

	ctx := context.Background()

	// Init DB store
	pg, err := store.New(ctx)
	if err != nil {
		log.Fatalf("DB store init: %v", err)
	}
	defer pg.Close()

	// Init PII processor (crypto keys from env)
	piiProc, err := pii.NewProcessor()
	if err != nil {
		log.Fatalf("PII processor init: %v", err)
	}

	// Init orchestrator
	orch := orchestrator.New(piiProc, pg)

	r := gin.Default()

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":        "ok",
			"setu_base_url": os.Getenv("SETU_BASE_URL"),
		})
	})

	// POST /v1/ingest/aa — Setu Account Aggregator
	r.POST("/v1/ingest/aa", makeIngestHandler(orch, func() connectors.SourceConnector {
		return setu.NewAdapter()
	}, func(c *gin.Context, req *connectors.SyncRequest) {
		var body struct {
			ConsentID  string `json:"consentId" binding:"required"`
			AccountID  string `json:"accountId" binding:"required"`
			BusinessID string `json:"businessId" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		req.BusinessID = body.BusinessID
		req.AccountID = body.AccountID
		req.AuthConfig = map[string]string{"consentId": body.ConsentID}
	}))

	// POST /v1/ingest/gstn — GSTN tax returns
	r.POST("/v1/ingest/gstn", makeGenericIngestHandler(orch, "gstn"))

	// POST /v1/ingest/razorpay — Razorpay payments/settlements
	r.POST("/v1/ingest/razorpay", makeGenericIngestHandler(orch, "razorpay"))

	// POST /v1/ingest/zoho — Zoho Books invoices/bills
	r.POST("/v1/ingest/zoho", makeGenericIngestHandler(orch, "zoho"))

	srv := &http.Server{
		Addr:    ":8080",
		Handler: r,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down ingestion server...")
	shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutCtx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}
	log.Println("Ingestion server exiting")
}

// makeIngestHandler creates a Gin handler for a specific connector with custom request parsing.
func makeIngestHandler(
	orch *orchestrator.Orchestrator,
	connectorFactory func() connectors.SourceConnector,
	parseRequest func(*gin.Context, *connectors.SyncRequest),
) gin.HandlerFunc {
	return func(c *gin.Context) {
		req := connectors.SyncRequest{}
		parseRequest(c, &req)
		if c.IsAborted() {
			return
		}

		connector := connectorFactory()
		result, err := orch.Run(c.Request.Context(), connector, req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusAccepted, result)
	}
}

// makeGenericIngestHandler creates a Gin handler for connectors that accept a standard body.
func makeGenericIngestHandler(orch *orchestrator.Orchestrator, source string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			BusinessID string `json:"businessId" binding:"required"`
			AccountID  string `json:"accountId" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		req := connectors.SyncRequest{
			BusinessID: body.BusinessID,
			AccountID:  body.AccountID,
			AuthConfig: map[string]string{},
		}

		var connector connectors.SourceConnector
		switch source {
		case "gstn":
			// Dynamically import at call time to avoid circular deps
			req.AuthConfig["gstin"] = os.Getenv("BUSINESS_GSTIN")
			connector = newGSTNConnector()
		case "razorpay":
			connector = newRazorpayConnector()
		case "zoho":
			connector = newZohoConnector()
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "unknown source: " + source})
			return
		}

		result, err := orch.Run(c.Request.Context(), connector, req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusAccepted, result)
	}
}