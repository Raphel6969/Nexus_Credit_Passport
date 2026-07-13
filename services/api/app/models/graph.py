import uuid
from datetime import datetime, timezone, date
from typing import Optional

from sqlalchemy import Column, String, BigInteger, DateTime, Date, ForeignKey, Text, Index
from sqlalchemy.dialects.postgresql import UUID
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
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    account = relationship("Account", back_populates="transactions")
    counterparty = relationship("Counterparty")

    __table_args__ = (
        Index('ix_transactions_account_timestamp', 'account_id', timestamp.desc()),
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
    scope = Column(String, nullable=False)                     # FULL_PROFILE / SCORE_ONLY / SNAPSHOT
    status = Column(String, nullable=False)                    # ACTIVE / REVOKED / EXPIRED
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    business = relationship("Business")
