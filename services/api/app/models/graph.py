import uuid
from datetime import datetime, timezone, date
from typing import Optional

from sqlalchemy import Column, String, BigInteger, DateTime, Date, ForeignKey, Text, Index, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import Base



def utc_now():
    return datetime.now(timezone.utc)


class Business(Base):
    __tablename__ = 'businesses'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    pan_hash = Column(String, unique=True, nullable=False)
    gstin = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    accounts = relationship("Account", back_populates="business")
    counterparties = relationship("Counterparty", back_populates="business")


class Account(Base):
    __tablename__ = 'accounts'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey('businesses.id'), nullable=False)
    source_type = Column(String, nullable=False)              # AA / RAZORPAY / GSTN / ECOMMERCE
    fi_type = Column(String, nullable=True)                   # Rebit FI Type: DEPOSIT / TERM_DEPOSIT / etc.
    account_ref = Column(String, nullable=False)              # Masked or encrypted reference
    status = Column(String, nullable=False)                   # ACTIVE / DISCONNECTED / INACTIVE
    last_synced_at = Column(DateTime(timezone=True), nullable=True)

    # AA Summary fields (added in 002)
    masked_account_number = Column(String, nullable=True)     # e.g. XXXXXXXX6053
    account_type = Column(String, nullable=True)              # SAVINGS / CURRENT / OVERDRAFT / CC
    ifsc_code = Column(String(11), nullable=True)             # Bank IFSC
    balance = Column(BigInteger, nullable=True)               # Latest balance in paise
    balance_at = Column(DateTime(timezone=True), nullable=True)  # Timestamp of balance snapshot

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    business = relationship("Business", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account")


class Counterparty(Base):
    __tablename__ = 'counterparties'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey('businesses.id'), nullable=False)
    name = Column(String, nullable=True)                      # Asymmetrically encrypted (age, base64)
    type = Column(String, nullable=False)                     # SUPPLIER / CUSTOMER / LENDER / UNKNOWN
    identifier = Column(String, nullable=True)                # Asymmetrically encrypted (age, base64)
    identifier_type = Column(String, nullable=True)           # VPA / GSTIN / ACCOUNT_IFSC / PAN / PHONE
    identifier_hmac = Column(String, nullable=True)           # HMAC blind index for cross-source resolution
    source_type = Column(String, nullable=True)               # AA / GSTN / RAZORPAY / ZOHO
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    business = relationship("Business", back_populates="counterparties")


class Transaction(Base):
    __tablename__ = 'transactions'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey('accounts.id'), nullable=False)
    counterparty_id = Column(UUID(as_uuid=True), ForeignKey('counterparties.id'), nullable=True)

    # Amounts — always in minor units (paise for INR)
    amount = Column(BigInteger, nullable=False)
    currency = Column(String(3), default='INR', nullable=False)
    transactional_balance = Column(BigInteger, nullable=True)  # Running balance after txn (paise)

    # Rebit AA core fields
    type = Column(String, nullable=False)                      # CREDIT / DEBIT
    mode = Column(String, nullable=True)                       # UPI / NEFT / RTGS / IMPS / NACH / ATM / CARD / CHEQUE / ECS / OTHERS
    timestamp = Column(DateTime(timezone=True), nullable=False) # transactionTimestamp
    value_date = Column(Date, nullable=True)                   # Settlement date (may differ from timestamp)

    # PII fields — asymmetrically encrypted (age sealed-box, base64 encoded)
    narration = Column(Text, nullable=True)                    # Raw bank narration — ENCRYPTED
    description = Column(Text, nullable=True)                  # Our derived label — ENCRYPTED

    # Dedup — HMAC blind index (not PII, safe to query)
    external_id_hmac = Column(String, nullable=True, unique=True)  # HMAC-SHA256(key, fip_txnId)

    reference_number = Column(String, nullable=True)
    revenue_role = Column(String, nullable=False, default='primary') # primary / informational / tax_summary
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    account = relationship("Account", back_populates="transactions")
    counterparty = relationship("Counterparty")

    __table_args__ = (
        Index('ix_transactions_account_timestamp', 'account_id', timestamp.desc()),
    )


class TaxFiling(Base):
    __tablename__ = 'tax_filings'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey('businesses.id'), nullable=False)
    return_type = Column(String, nullable=False)              # GSTR3B / GSTR1 / GSTR2A
    period = Column(String, nullable=False)                   # YYYY-MM
    gross_turnover = Column(BigInteger, nullable=True)
    tax_paid = Column(BigInteger, nullable=True)
    filing_date = Column(Date, nullable=True)
    status = Column(String, nullable=False)                   # FILED / PENDING / LATE
    raw_data_sealed = Column(Text, nullable=True)             # age-encrypted
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    business = relationship("Business")

    __table_args__ = (
        Index('ix_tax_filings_biz_type_period', 'business_id', 'return_type', 'period', unique=True),
    )


class Invoice(Base):
    __tablename__ = 'invoices'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey('businesses.id'), nullable=False)
    counterparty_id = Column(UUID(as_uuid=True), ForeignKey('counterparties.id'), nullable=True)
    external_id_hmac = Column(String, nullable=True, unique=True)
    invoice_type = Column(String, nullable=False)             # RECEIVABLE / PAYABLE
    amount = Column(BigInteger, nullable=False)               # paise
    currency = Column(String(3), default='INR', nullable=False)
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)
    paid_date = Column(Date, nullable=True)
    status = Column(String, nullable=False)                   # DRAFT / SENT / OVERDUE / PAID / VOID
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    business = relationship("Business")
    counterparty = relationship("Counterparty")

    __table_args__ = (
        Index('ix_invoices_biz_status', 'business_id', 'status'),
    )



class CashFlowEvent(Base):
    __tablename__ = 'cash_flow_events'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey('businesses.id'), nullable=False)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey('transactions.id'), nullable=True)
    event_type = Column(String, nullable=False)                # INVOICE_PAID / EMI_DEBIT / SALARY_CREDIT / etc.
    amount = Column(BigInteger, nullable=False)                 # Minor units (paise)
    currency = Column(String(3), default='INR', nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    business = relationship("Business")
    transaction = relationship("Transaction")


class ConsentToken(Base):
    __tablename__ = 'consent_tokens'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey('businesses.id'), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    scope = Column(String, nullable=False)             # FULL_PROFILE / SCORE_ONLY / SNAPSHOT
    status = Column(String, nullable=False)            # ACTIVE / REVOKED / EXPIRED
    # SNAPSHOT scope: score payload captured at mint time so lender sees
    # the score-as-shared, not the current score
    snapshot_data = Column(JSONB, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    # Set when a SNAPSHOT token is first (and only) resolved
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    business = relationship("Business")
    audit_logs = relationship("ConsentAuditLog", back_populates="token", lazy="dynamic")


class ConsentAuditLog(Base):
    """
    Append-only audit trail for every consent lifecycle event.

    Actions: MINTED | RESOLVED | REVOKED | EXPIRED
    Never update or delete rows — append only.
    """
    __tablename__ = 'consent_audit_log'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token_id = Column(UUID(as_uuid=True), ForeignKey('consent_tokens.id'), nullable=False)
    business_id = Column(UUID(as_uuid=True), ForeignKey('businesses.id'), nullable=False)
    action = Column(String, nullable=False)            # MINTED | RESOLVED | REVOKED | EXPIRED
    actor = Column(Text, nullable=True)                # business UUID | "resolver" | "system"
    resolved_scope = Column(String, nullable=True)     # scope revealed on RESOLVED events
    requester_ip = Column(Text, nullable=True)         # IP of resolver (RESOLVED events)
    action_metadata = Column("metadata", JSONB, nullable=True)            # user-agent, extra context
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    token = relationship("ConsentToken", back_populates="audit_logs")
    business = relationship("Business")

    __table_args__ = (
        Index('ix_consent_audit_token_created', 'token_id', 'created_at'),
        Index('ix_consent_audit_biz_action', 'business_id', 'action'),
    )


class ScoreSnapshot(Base):
    """
    Append-only audit log of every scoring event.

    Stores derived output only — never raw features or PII.
    The `drivers` JSONB column holds the full SHAP breakdown returned by the Rust service.
    """
    __tablename__ = 'score_snapshots'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey('businesses.id'), nullable=False)
    score = Column(Integer, nullable=False)                    # 300–850
    confidence = Column(String, nullable=False)                # LOW | MEDIUM | HIGH
    model_version = Column(String, nullable=False)             # e.g. linear-v1.0.0
    drivers = Column(JSONB, nullable=True)                     # [{feature, label, direction, impact, ...}]
    computed_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    business = relationship("Business")

    __table_args__ = (
        Index('ix_score_snapshots_biz_computed', 'business_id', 'computed_at'),
    )

