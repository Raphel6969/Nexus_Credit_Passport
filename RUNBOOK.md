# Nexus Credit Passport — Demo Runbook

This document outlines how to run the Nexus Credit Passport locally, the credentials to use for the demo, and the external API requirements for production.

## 🚀 How to Run the Demo

The local environment is fully containerized and uses mock services to simulate external data providers (Setu AA, Razorpay, Zoho, GSTN).

1. **Start the environment:**
   From the root of the repository, start all services in the background:
   ```bash
   docker compose up -d
   ```

2. **Access the Dashboard:**
   Open your browser and navigate to:
   **[http://localhost:3000/login](http://localhost:3000/login)**

3. **(Optional) Reset the Database:**
   If you ever need to reset the data or seed the database from scratch, run:
   ```bash
   docker compose exec api python /app/infra/scripts/seed.py
   ```

## 🔐 Demo Credentials

Because the demo runs with a pre-seeded synthetic profile ("Acme MSME Solutions Pvt Ltd"), you do not need to create an account. 

When prompted for an ID or if you need to use the Business ID in API calls, use the following UUID:
**Demo Business ID:** `00000000-0000-0000-0000-000000000001`
*(Note: This is automatically configured in `.env.local` as `NEXT_PUBLIC_BUSINESS_ID`)*

## 🔑 API Keys Requirements

### Local Development
**NO real API keys are required for local development.** 
The `docker-compose.yml` spins up mock servers (`setu-mock`, `gstn-mock`, `razorpay-mock`, `zoho-mock`) that simulate the behavior of external APIs.

### Production / Staging
When migrating to staging or production, you will need to replace the local mock URLs with real provider endpoints and supply the following API keys in your production environment:

1. **Setu Account Aggregator:**
   - `SETU_CLIENT_ID`
   - `SETU_CLIENT_SECRET`
   - `SETU_PRODUCT_INSTANCE_ID`
   - `SETU_FIU_ENTITY_ID`

2. **Razorpay:**
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`

3. **Zoho Books:**
   - `ZOHO_CLIENT_ID`
   - `ZOHO_CLIENT_SECRET`
   - `ZOHO_ORG_ID`

## 🏗️ What's Left for Production Readiness?

The core MVP and scoring engine are complete. To prepare for a live production deployment, the following milestones remain:
- **Authentication:** Implement a real auth provider (e.g., Auth0, Cognito) to replace the hardcoded demo Business ID.
- **External Integration:** Swap out the mock URLs in `.env.local` with real production URLs for Setu, GSTN, Razorpay, and Zoho.
- **Cloud Deployment:** Provision cloud infrastructure (AWS ECS, Kubernetes, etc.) and a managed PostgreSQL database (e.g., AWS RDS) instead of running Postgres inside a container.
- **Key Rotation:** Rotate the asymmetric encryption keys (`AGE_PRIVATE_KEY` and `AGE_PUBLIC_KEY`) to ensure PII data is secured with production-grade keys.
