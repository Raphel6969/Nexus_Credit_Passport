#!/usr/bin/env python3
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone, date, timedelta
from pathlib import Path

# Add services/api to python path so we can import our models
REPO_ROOT = Path(__file__).parent.parent.parent
sys.path.append(str(REPO_ROOT / "services" / "api"))

# Load environment variables
from dotenv import load_dotenv
load_dotenv(str(REPO_ROOT / ".env.local"))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.models.graph import Base, Business, Account, Counterparty, Transaction, TaxFiling, Invoice

# Determine DB URL
database_url = os.getenv("DATABASE_URL")
if not database_url:
    # fallback
    database_url = "postgresql+asyncpg://nexus:nexus@localhost:5432/nexus"

# If running outside of Docker (on host), map postgres:5432 to localhost:5432
if "postgres:" in database_url and not os.path.exists("/.dockerenv"):
    database_url = database_url.replace("postgres:", "localhost:")

print(f"Connecting to database at: {database_url}")
engine = create_async_engine(database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

DEMO_BIZ_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

async def clean_database(session: AsyncSession):
    """Deletes existing data for the demo business to make the script idempotent."""
    print("Cleaning existing demo business data...")
    # Delete score snapshots, consent audit logs, consent tokens, cash flow events, invoices, tax filings, transactions, counterparties, accounts, business
    await session.execute(text("DELETE FROM score_snapshots WHERE business_id = :biz_id"), {"biz_id": DEMO_BIZ_ID})
    await session.execute(text("DELETE FROM consent_audit_log WHERE business_id = :biz_id"), {"biz_id": DEMO_BIZ_ID})
    await session.execute(text("DELETE FROM consent_tokens WHERE business_id = :biz_id"), {"biz_id": DEMO_BIZ_ID})
    await session.execute(text("DELETE FROM cash_flow_events WHERE business_id = :biz_id"), {"biz_id": DEMO_BIZ_ID})
    await session.execute(text("DELETE FROM invoices WHERE business_id = :biz_id"), {"biz_id": DEMO_BIZ_ID})
    await session.execute(text("DELETE FROM tax_filings WHERE business_id = :biz_id"), {"biz_id": DEMO_BIZ_ID})
    await session.execute(text("DELETE FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE business_id = :biz_id)"), {"biz_id": DEMO_BIZ_ID})
    await session.execute(text("DELETE FROM counterparties WHERE business_id = :biz_id"), {"biz_id": DEMO_BIZ_ID})
    await session.execute(text("DELETE FROM accounts WHERE business_id = :biz_id"), {"biz_id": DEMO_BIZ_ID})
    await session.execute(text("DELETE FROM businesses WHERE id = :biz_id"), {"biz_id": DEMO_BIZ_ID})
    await session.commit()

async def seed_data():
    async with AsyncSessionLocal() as session:
        await clean_database(session)
        
        print("Inserting Business details...")
        business = Business(
            id=DEMO_BIZ_ID,
            name="Acme MSME Solutions Pvt Ltd",
            pan_hash="f3ea83c1629858348d1de8cf0e78f9f688000000000000000000000000000001",
            gstin="29ABCDE1234F2Z5"
        )
        session.add(business)
        
        print("Inserting Accounts...")
        account = Account(
            id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
            business_id=DEMO_BIZ_ID,
            source_type="AA",
            fi_type="DEPOSIT",
            account_ref="ICICI_AA_001",
            status="ACTIVE",
            masked_account_number="XXXXXXXX6053",
            account_type="CURRENT",
            ifsc_code="ICIC0000011",
            balance=80000000, # ₹8 Lakhs = 80,000,000 paise
            balance_at=datetime.now(timezone.utc)
        )
        session.add(account)
        
        print("Inserting Counterparties...")
        supplier = Counterparty(
            id=uuid.UUID("22222222-2222-2222-2222-222222222222"),
            business_id=DEMO_BIZ_ID,
            name="V0pQX0VOQ1JZUFRFRF9TVVBQTElFUl9B", # base64 mock
            type="SUPPLIER",
            identifier="V0pQX0VOQ1JZUFRFRF9VUElfQQ==",
            identifier_type="VPA",
            identifier_hmac="hmac_supplier_a_12345",
            source_type="AA"
        )
        customer = Counterparty(
            id=uuid.UUID("33333333-3333-3333-3333-333333333333"),
            business_id=DEMO_BIZ_ID,
            name="V0pQX0VOQ1JZUFRFRF9DVVNUT01FUl9C",
            type="CUSTOMER",
            identifier="V0pQX0VOQ1JZUFRFRF9VUElfQg==",
            identifier_type="VPA",
            identifier_hmac="hmac_customer_b_12345",
            source_type="AA"
        )
        lender = Counterparty(
            id=uuid.UUID("44444444-4444-4444-4444-444444444444"),
            business_id=DEMO_BIZ_ID,
            name="V0pQX0VOQ1JZUFRFRF9MRU5ERVJfQw==",
            type="LENDER",
            identifier="V0pQX0VOQ1JZUFRFRF9JRlNDX0M=",
            identifier_type="ACCOUNT_IFSC",
            identifier_hmac="hmac_lender_c_12345",
            source_type="AA"
        )
        session.add_all([supplier, customer, lender])
        await session.flush() # ensure PKs exist for transactions
        
        print("Generating 120 Transactions across 12 months...")
        # 12 months data window
        now_dt = datetime.now(timezone.utc)
        start_date = now_dt - timedelta(days=360)
        
        # We need:
        # - Total transactions = 120
        # - UPI transactions = 78 (upi_ratio = 0.65)
        # - NACH debit count = 12 (1 per month)
        # - Credits = 60, Debits = 60
        # - Credits total = ₹150 Lakhs (1,500,000,000 paise)
        # - Debits total = ₹110 Lakhs (1,100,000,000 paise)
        # - Resulting credit_debit_ratio = 1.36
        # - Current balance = ₹8 Lakhs (80,000,000 paise)
        
        transactions = []
        running_balance = 40000000 # start running balance at 40 Lakhs
        
        # Calculate specific credit/debit amounts to sum up exactly
        # 60 credits summing to 1,500,000,000 (avg ₹25 Lakhs / 12 = 2.08L each)
        # 60 debits summing to 1,100,000,000 (avg ₹18 Lakhs / 12 = 1.5L each)
        credit_amount_each = 1500000000 // 60
        debit_amount_each = 1100000000 // 60
        
        upi_count = 0
        nach_count = 0
        
        for i in range(120):
            # Alternating credit and debit
            is_credit = (i % 2 == 0)
            
            # Distribute timestamps evenly over 360 days
            txn_time = start_date + timedelta(days=(i * 3))
            
            # UPI, NACH, or NEFT/RTGS
            mode = "NEFT"
            counterparty_id = None
            
            if is_credit:
                amount = credit_amount_each
                txn_type = "CREDIT"
                running_balance += amount
                # Assign Customer B
                counterparty_id = customer.id
                # 65% upi ratio targets 78 total UPI txns. Out of 120, let's make 78 UPI.
                # 78 / 120 = 65%
                if upi_count < 78:
                    mode = "UPI"
                    upi_count += 1
            else:
                amount = debit_amount_each
                txn_type = "DEBIT"
                running_balance -= amount
                # Assign Supplier or Lender
                if nach_count < 12 and (i % 10 == 1):
                    # NACH debit (e.g. EMI)
                    mode = "NACH"
                    nach_count += 1
                    counterparty_id = lender.id
                else:
                    counterparty_id = supplier.id
                    if upi_count < 78:
                        mode = "UPI"
                        upi_count += 1
            
            tx = Transaction(
                id=uuid.uuid4(),
                account_id=account.id,
                counterparty_id=counterparty_id,
                amount=amount,
                currency="INR",
                transactional_balance=running_balance,
                type=txn_type,
                mode=mode,
                timestamp=txn_time,
                value_date=txn_time.date(),
                narration="MOCK_PII_NARRATION_SEALED",
                description="MOCK_PII_DESC_SEALED",
                external_id_hmac=f"hmac_txn_{i}",
                reference_number=f"UTR{1000000000 + i}",
                revenue_role="primary"
            )
            transactions.append(tx)
            
        session.add_all(transactions)
        
        # Override the latest account balance with our final running balance
        # to ensure it's mathematically sound
        account.balance = running_balance
        account.balance_at = now_dt
        
        print("Inserting Tax Filings...")
        # 12 months GSTR-3B filings
        for m in range(12):
            # Calculate months back
            filing_month = now_dt - timedelta(days=(30 * m))
            period_str = filing_month.strftime("%Y-%m")
            # Gross turnover ~12.5 Lakhs (125,000,000 paise) per month
            gross_turnover = 125000000
            # 18% GST = 22,500,000 paise
            tax_paid = 22500000
            
            filing = TaxFiling(
                id=uuid.uuid4(),
                business_id=DEMO_BIZ_ID,
                return_type="GSTR3B",
                period=period_str,
                gross_turnover=gross_turnover,
                tax_paid=tax_paid,
                filing_date=(filing_month + timedelta(days=20)).date(), # filing on 20th of next month
                status="FILED",
                raw_data_sealed="MOCK_SEALED_GST_DATA"
            )
            session.add(filing)
            
        print("Inserting Invoices...")
        # 20 receivables
        # 19 PAID on time
        # 1 OVERDUE
        for idx in range(20):
            is_overdue = (idx == 0)
            issue_days_ago = 45 if is_overdue else (20 + idx * 10)
            issue_date = (now_dt - timedelta(days=issue_days_ago)).date()
            due_date = issue_date + timedelta(days=30)
            
            if is_overdue:
                status = "OVERDUE"
                paid_date = None
            else:
                status = "PAID"
                paid_date = due_date - timedelta(days=5) # paid 5 days early
                
            inv = Invoice(
                id=uuid.uuid4(),
                business_id=DEMO_BIZ_ID,
                counterparty_id=customer.id,
                external_id_hmac=f"hmac_invoice_{idx}",
                invoice_type="RECEIVABLE",
                amount=50000000, # ₹5 Lakhs = 50,000,000 paise
                currency="INR",
                issue_date=issue_date,
                due_date=due_date,
                paid_date=paid_date,
                status=status
            )
            session.add(inv)
            
        await session.commit()
        print("Successfully seeded all mock credit passport data for the demo business!")

if __name__ == "__main__":
    asyncio.run(seed_data())
