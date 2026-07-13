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
	"github.com/nexus-credit-passport/ingestion/internal/connectors/setu"
	"github.com/nexus-credit-passport/ingestion/internal/normalize"
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

	// Init normalizer (crypto keys from env)
	norm, err := normalize.NewNormalizer()
	if err != nil {
		log.Fatalf("Normalizer init: %v", err)
	}

	// Init Setu client (base URL from SETU_BASE_URL — mock or real)
	setuClient := setu.NewClientFromEnv()

	r := gin.Default()

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":       "ok",
			"setu_base_url": os.Getenv("SETU_BASE_URL"),
		})
	})

	// POST /v1/ingest/aa
	// Accepts: { "consentId": "...", "accountId": "...", "businessId": "..." }
	// Runs the full fetch → normalize → write pipeline.
	// Phase 2: synchronous (blocks until done). Phase 3+: async with queue.
	// TODO(phase3): move to async job queue to support large data ranges
	r.POST("/v1/ingest/aa", func(c *gin.Context) {
		var req struct {
			ConsentID  string `json:"consentId" binding:"required"`
			AccountID  string `json:"accountId" binding:"required"`
			BusinessID string `json:"businessId" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Create a data session for the last 12 months
		from := time.Now().AddDate(-1, 0, 0)
		to := time.Now()

		session, err := setuClient.CreateSession(req.ConsentID, from, to)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "create session: " + err.Error()})
			return
		}

		// For sandbox/mock: session is immediately COMPLETED
		// For real AA: may need to poll. Phase 3 will add webhook-driven flow.
		fiData, err := setuClient.GetFIData(session.ID)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "get FI data: " + err.Error()})
			return
		}

		totalInserted := 0
		totalSkipped := 0

		for _, fip := range fiData.FI {
			for _, fiAccount := range fip.Data {
				result, err := norm.NormalizeFIAccount(fiAccount, req.BusinessID, req.AccountID)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "normalize: " + err.Error()})
					return
				}

				// Upsert account summary
				if err := pg.UpsertAccount(c.Request.Context(), result.AccountUpdate); err != nil {
					log.Printf("upsert account: %v", err)
				}

				// Upsert counterparties
				for _, cp := range result.Counterparties {
					if err := pg.UpsertCounterparty(c.Request.Context(), cp); err != nil {
						log.Printf("upsert counterparty: %v", err)
					}
				}

				// Upsert transactions
				for _, txn := range result.Transactions {
					inserted, err := pg.UpsertTransaction(c.Request.Context(), txn)
					if err != nil {
						log.Printf("upsert txn: %v", err)
						continue
					}
					if inserted {
						totalInserted++
					} else {
						totalSkipped++
					}
				}
			}
		}

		c.JSON(http.StatusAccepted, gin.H{
			"status":              "ok",
			"transactionsInserted": totalInserted,
			"transactionsSkipped":  totalSkipped,
			"sessionId":           session.ID,
		})
	})

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