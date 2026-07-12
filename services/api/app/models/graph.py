import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, String, BigInteger, DateTime, ForeignKey, Text
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
    source_type = Column(String, nullable=False) # e.g., 'AA', 'RAZORPAY', 'GSTN'
    fi_type = Column(String, nullable=True) # e.g., 'DEPOSIT' (Rebit FI Types)
    account_ref = Column(String, nullable=False) # Masked/encrypted
    status = Column(String, nullable=False) # e.g., 'ACTIVE', 'DISCONNECTED'
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    business = relationship("Business", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account")

class Counterparty(Base):
    __tablename__ = 'counterparties'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey('businesses.id'), nullable=False)
    name = Column(String, nullable=True) # Encrypted
    type = Column(String, nullable=False) # e.g., 'SUPPLIER', 'CUSTOMER'
    identifier = Column(String, nullable=True) # Encrypted
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    business = relationship("Business", back_populates="counterparties")

class Transaction(Base):
    __tablename__ = 'transactions'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey('accounts.id'), nullable=False)
    counterparty_id = Column(UUID(as_uuid=True), ForeignKey('counterparties.id'), nullable=True)
    amount = Column(BigInteger, nullable=False) # Minor units (paise)
    currency = Column(String(3), default='INR', nullable=False)
    type = Column(String, nullable=False) # 'CREDIT', 'DEBIT'
    timestamp = Column(DateTime(timezone=True), nullable=False)
    description = Column(Text, nullable=True) # Encrypted
    reference_number = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    account = relationship("Account", back_populates="transactions")
    counterparty = relationship("Counterparty")

class CashFlowEvent(Base):
    __tablename__ = 'cash_flow_events'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey('businesses.id'), nullable=False)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey('transactions.id'), nullable=True)
    event_type = Column(String, nullable=False) # e.g., 'INVOICE_PAID'
    amount = Column(BigInteger, nullable=False) # Minor units
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
    scope = Column(String, nullable=False) # 'FULL_PROFILE', 'SCORE_ONLY', 'SNAPSHOT'
    status = Column(String, nullable=False) # 'ACTIVE', 'REVOKED', 'EXPIRED'
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    business = relationship("Business")
