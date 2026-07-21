// Mock Setu AA FIU server for local development.
//
// Serves responses shaped identically to the real Setu sandbox API:
//
//	POST /consents      → 201 ConsentResponse
//	GET  /consents/{id} → 200 ConsentStatusResponse (status: ACTIVE immediately)
//	POST /sessions      → 201 SessionResponse
//	GET  /sessions/{id} → 200 FIDataResponse with realistic Indian MSME data
//
// Base URL: http://localhost:9090
// Swap to real sandbox via SETU_BASE_URL env var — zero code change.
//
// The fixture data includes transactions across all major Indian payment modes:
// UPI, NEFT, RTGS, IMPS, NACH, ATM, CHEQUE — to exercise the full normalizer path.
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"
)

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/consents", handleConsents)
	mux.HandleFunc("/consents/", handleConsentByID)
	mux.HandleFunc("/sessions", handleSessions)
	mux.HandleFunc("/sessions/", handleSessionByID)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "setu-mock"})
	})

	addr := ":9090"
	log.Printf("[setu-mock] Listening on %s — swap SETU_BASE_URL to https://fiu-sandbox.setu.co for real sandbox\n", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func handleConsents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	resp := map[string]any{
		"id":     "mock-consent-id-001",
		"status": "PENDING",
		"url":    "http://localhost:9090/consent-ui/mock-consent-id-001",
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

func handleConsentByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/consents/"), "/")
	consentID := parts[0]
	resp := map[string]any{
		"id":     consentID,
		"status": "ACTIVE", // Mock immediately returns ACTIVE
		"detail": map[string]any{
			"accounts": []map[string]any{
				{
					"maskedAccNumber": "XXXXXXXX6053",
					"accType":         "SAVINGS",
					"fipId":           "setu-fip-2",
				},
			},
		},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func handleSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	resp := map[string]any{
		"id":        "mock-session-id-001",
		"status":    "COMPLETED", // Mock immediately returns COMPLETED
		"consentId": "mock-consent-id-001",
		"format":    "json",
		"dataRange": map[string]any{
			"from": time.Now().AddDate(-1, 0, 0).UTC().Format(time.RFC3339),
			"to":   time.Now().UTC().Format(time.RFC3339),
		},
		"traceId": "mock-trace-001",
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

func handleSessionByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Realistic Indian MSME account with transactions across all Rebit modes
	now := time.Now()
	bal1 := 85420.50
	bal2 := 80420.50
	bal3 := 95420.50
	bal4 := 70420.50
	bal5 := 62420.50
	bal6 := 53920.50
	bal7 := 103920.50
	bal8 := 91420.50
	bal9 := 88920.50

	resp := map[string]any{
		"ver":       "2.0.0",
		"timestamp": now.UTC().Format(time.RFC3339),
		"txnid":     "mock-session-id-001",
		"FI": []map[string]any{
			{
				"fipID": "setu-fip-2",
				"data": []map[string]any{
					{
						"linkRefNumber":   "SETU-FIP-LINK-001",
						"maskedAccNumber": "XXXXXXXX6053",
						"account": map[string]any{
							"xmlns":           "http://api.rebit.org.in/FISchema/deposit",
							"linkedAccRef":    "SETU-FIP-LINK-001",
							"maskedAccNumber": "XXXXXXXX6053",
							"version":         "2.0.0",
							"type":            "deposit",
							"Profile": map[string]any{
								"Holders": map[string]any{
									"type": "SINGLE",
									"Holder": []map[string]any{
										{
											"name":           "Sharma Hardware Traders",
											"dob":            "1985-06-20",
											"mobile":         "9988776655",
											"nominee":        "REGISTERED",
											"landline":       "",
											"address":        "12, Chandni Chowk Market, Delhi - 110006",
											"email":          "sharma.hardware@gmail.com",
											"pan":            "BCDEF2345G",
											"ckycCompliance": true,
										},
									},
								},
							},
							"Summary": map[string]any{
								"currentBalance":  85420.50,
								"currency":        "INR",
								"balanceDateTime": now.Format(time.RFC3339),
								"type":            "CURRENT",
								"branch":          "CHANDNI CHOWK",
								"facility":        "OD",
								"ifscCode":        "SBIN0000691",
								"micrCode":        "110002059",
								"openingDate":     "2015-03-01",
								"currentODLimit":  100000,
								"drawingLimit":    100000,
								"status":          "ACTIVE",
								"Pending": map[string]any{
									"transactionType": "DEBIT",
									"amount":          0,
								},
							},
							"Transactions": map[string]any{
								"startDate": now.AddDate(-1, 0, 0).Format("2006-01-02"),
								"endDate":   now.Format("2006-01-02"),
								"Transaction": []map[string]any{
									// UPI credit — customer payment for hardware
									{
										"txnId":                "TXN" + now.AddDate(0, -11, 0).Format("20060102") + "001",
										"type":                 "CREDIT",
										"mode":                 "UPI",
										"amount":               5000.00,
										"transactionalBalance": &bal1,
										"transactionTimestamp": now.AddDate(0, -11, 0).Format(time.RFC3339),
										"valueDate":            now.AddDate(0, -11, 0).Format("2006-01-02"),
										"narration":            "UPI/CR/" + now.AddDate(0, -11, 0).Format("20060102") + "143000/PhonePe/ravi.constructions@okicici/Hardware Invoice 2345",
										"reference":            "UPI/" + now.AddDate(0, -11, 0).Format("20060102") + "143000/PHNPE",
									},
									// NEFT debit — supplier payment
									{
										"txnId":                "TXN" + now.AddDate(0, -10, 0).Format("20060102") + "002",
										"type":                 "DEBIT",
										"mode":                 "NEFT",
										"amount":               5000.00,
										"transactionalBalance": &bal2,
										"transactionTimestamp": now.AddDate(0, -10, 0).Format(time.RFC3339),
										"valueDate":            now.AddDate(0, -10, 0).Format("2006-01-02"),
										"narration":            "NEFT/DR/SBIN0000691/SUPPLIER PAYMENT/METRO STEEL TRADERS",
										"reference":            "NEFT/N" + now.AddDate(0, -10, 0).Format("20060102") + "001",
									},
									// IMPS credit — urgent customer payment
									{
										"txnId":                "TXN" + now.AddDate(0, -9, 0).Format("20060102") + "003",
										"type":                 "CREDIT",
										"mode":                 "IMPS",
										"amount":               15000.00,
										"transactionalBalance": &bal3,
										"transactionTimestamp": now.AddDate(0, -9, 0).Format(time.RFC3339),
										"valueDate":            now.AddDate(0, -9, 0).Format("2006-01-02"),
										"narration":            "IMPS/CR/URGENT PAYMENT FROM GUPTA ELECTRICALS/INV-2890",
										"reference":            "IMPS/IMP" + now.AddDate(0, -9, 0).Format("20060102") + "001",
									},
									// NACH debit — EMI for business loan
									{
										"txnId":                "TXN" + now.AddDate(0, -8, 0).Format("20060102") + "004",
										"type":                 "DEBIT",
										"mode":                 "NACH",
										"amount":               8500.00,
										"transactionalBalance": &bal4,
										"transactionTimestamp": now.AddDate(0, -8, 0).Format(time.RFC3339),
										"valueDate":            now.AddDate(0, -8, 0).Format("2006-01-02"),
										"narration":            "NACH/DR/HDFC BANK BUSINESS LOAN EMI",
										"reference":            "NACH/NACH" + now.AddDate(0, -8, 0).Format("20060102"),
									},
									// ATM withdrawal
									{
										"txnId":                "TXN" + now.AddDate(0, -7, 0).Format("20060102") + "005",
										"type":                 "DEBIT",
										"mode":                 "ATM",
										"amount":               8000.00,
										"transactionalBalance": &bal5,
										"transactionTimestamp": now.AddDate(0, -7, 0).Format(time.RFC3339),
										"valueDate":            now.AddDate(0, -7, 0).Format("2006-01-02"),
										"narration":            "ATM/DR/SBI ATM CHANDNI CHOWK/CASH WITHDRAWAL",
										"reference":            "ATM/" + now.AddDate(0, -7, 0).Format("20060102") + "001",
									},
									// CHEQUE debit — rent
									{
										"txnId":                "TXN" + now.AddDate(0, -6, 0).Format("20060102") + "006",
										"type":                 "DEBIT",
										"mode":                 "CHEQUE",
										"amount":               8500.00,
										"transactionalBalance": &bal6,
										"transactionTimestamp": now.AddDate(0, -6, 0).Format(time.RFC3339),
										"valueDate":            now.AddDate(0, -6, 0).Format("2006-01-02"),
										"narration":            "CHQ/DR/SHOP RENT PAYMENT/CHANDNI CHOWK MARKET",
										"reference":            "CHQ/000234",
									},
									// RTGS credit — large B2B payment
									{
										"txnId":                "TXN" + now.AddDate(0, -5, 0).Format("20060102") + "007",
										"type":                 "CREDIT",
										"mode":                 "RTGS",
										"amount":               50000.00,
										"transactionalBalance": &bal7,
										"transactionTimestamp": now.AddDate(0, -5, 0).Format(time.RFC3339),
										"valueDate":            now.AddDate(0, -5, 0).Format("2006-01-02"),
										"narration":            "RTGS/CR/BULK ORDER PAYMENT/DELHI BUILDERS CONSORTIUM",
										"reference":            "RTGS/HDFC" + now.AddDate(0, -5, 0).Format("20060102"),
									},
									// UPI debit — GST payment
									{
										"txnId":                "TXN" + now.AddDate(0, -4, 0).Format("20060102") + "008",
										"type":                 "DEBIT",
										"mode":                 "UPI",
										"amount":               12500.00,
										"transactionalBalance": &bal8,
										"transactionTimestamp": now.AddDate(0, -4, 0).Format(time.RFC3339),
										"valueDate":            now.AddDate(0, -4, 0).Format("2006-01-02"),
										"narration":            "UPI/DR/" + now.AddDate(0, -4, 0).Format("20060102") + "090000/GSTN/gst.gov.in@nsdl/GST PAYMENT Q3",
										"reference":            "UPI/" + now.AddDate(0, -4, 0).Format("20060102") + "090000/GSTN",
									},
									// NACH debit — EMI again (demonstrates pattern)
									{
										"txnId":                "TXN" + now.AddDate(0, -3, 0).Format("20060102") + "009",
										"type":                 "DEBIT",
										"mode":                 "NACH",
										"amount":               2500.00,
										"transactionalBalance": &bal9,
										"transactionTimestamp": now.AddDate(0, -3, 0).Format(time.RFC3339),
										"valueDate":            now.AddDate(0, -3, 0).Format("2006-01-02"),
										"narration":            "NACH/DR/HDFC BANK BUSINESS LOAN EMI",
										"reference":            "NACH/NACH" + now.AddDate(0, -3, 0).Format("20060102"),
									},
								},
							},
						},
					},
				},
			},
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
