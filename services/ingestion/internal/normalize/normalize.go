package normalize

// Normalizer converts raw connector payloads into financial graph rows
type Normalizer interface {
	Normalize(raw []connectors.RawTransaction, accountID string) ([]NormalizedEvent, error)
}

type NormalizedEvent struct {
	AccountID      string
	ExternalID     string
	EventType      string // credit, debit, fee, interest, etc.
	Amount         float64
	Currency       string
	OccurredAt     time.Time
	CounterpartyID string
	Category       string
	Metadata       map[string]any
}