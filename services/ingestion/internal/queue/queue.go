package queue

import (
	"context"
	"time"
) // Queue interface for async ingestion jobs
type Queue interface {
	Enqueue(job IngestionJob) error
	Dequeue(ctx context.Context) (IngestionJob, error)
}

type IngestionJob struct {
	AccountID   string
	Connector   string
	Cursor      string
	ScheduledAt time.Time
}
