package main

// Connector factory functions for the generic ingest handler.
// These avoid import cycles by living in the main package.

import (
	"github.com/nexus-credit-passport/ingestion/internal/connectors"
	"github.com/nexus-credit-passport/ingestion/internal/connectors/gstn"
	"github.com/nexus-credit-passport/ingestion/internal/connectors/razorpay"
	"github.com/nexus-credit-passport/ingestion/internal/connectors/zoho"
)

func newGSTNConnector() connectors.SourceConnector {
	return gstn.NewConnector()
}

func newRazorpayConnector() connectors.SourceConnector {
	return razorpay.NewConnector()
}

func newZohoConnector() connectors.SourceConnector {
	return zoho.NewConnector()
}
