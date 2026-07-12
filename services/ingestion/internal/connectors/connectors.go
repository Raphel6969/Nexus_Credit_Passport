package connectors

// Connector interface for data sources (Setu AA, GSTN, Razorpay, Tally, Zoho)
type Connector interface {
	Fetch(ctx context.Context, accountID string, since time.Time) ([]RawTransaction, error)
	Name() string
}

type RawTransaction struct {
	ExternalID   string
	Date         time.Time
	Amount       float64
	Currency     string
	Description  string
	Counterparty string
	Category     string
	RawPayload   map[string]any
}