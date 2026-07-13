#!/bin/bash

# Define the business and account IDs
BUSINESS_ID="00000000-0000-0000-0000-000000000001"
ACCOUNT_ID="11111111-1111-1111-1111-111111111111"

echo "=========================================================="
echo "Testing Setu AA Ingestion"
echo "=========================================================="
curl -X POST http://localhost:8000/v1/businesses/$BUSINESS_ID/ingest/aa \
  -H "X-API-Key: dev-secret-change-me-in-prod" \
  -H "Content-Type: application/json" \
  -d '{
        "consentId": "test-consent-123",
        "accountId": "'$ACCOUNT_ID'"
      }'
echo ""

echo "=========================================================="
echo "Testing GSTN Ingestion"
echo "=========================================================="
curl -X POST http://localhost:8000/v1/businesses/$BUSINESS_ID/ingest/gstn \
  -H "X-API-Key: dev-secret-change-me-in-prod" \
  -H "Content-Type: application/json" \
  -d '{
        "accountId": "'$ACCOUNT_ID'"
      }'
echo ""

echo "=========================================================="
echo "Testing Razorpay Ingestion"
echo "=========================================================="
curl -X POST http://localhost:8000/v1/businesses/$BUSINESS_ID/ingest/razorpay \
  -H "X-API-Key: dev-secret-change-me-in-prod" \
  -H "Content-Type: application/json" \
  -d '{
        "accountId": "'$ACCOUNT_ID'"
      }'
echo ""

echo "=========================================================="
echo "Testing Zoho Books Ingestion"
echo "=========================================================="
curl -X POST http://localhost:8000/v1/businesses/$BUSINESS_ID/ingest/zoho \
  -H "X-API-Key: dev-secret-change-me-in-prod" \
  -H "Content-Type: application/json" \
  -d '{
        "accountId": "'$ACCOUNT_ID'"
      }'
echo ""

echo "=========================================================="
echo "Getting Score"
echo "=========================================================="
curl -H "X-API-Key: dev-secret-change-me-in-prod" http://localhost:8000/v1/businesses/$BUSINESS_ID/score
echo ""
