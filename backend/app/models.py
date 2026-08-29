# pyrefly: ignore [missing-import]
from sqlalchemy import Column, String, ForeignKey, DateTime, JSON, Numeric, Date, FetchedValue, Boolean
# pyrefly: ignore [missing-import]
from sqlalchemy.dialects.postgresql import UUID
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import relationship, validates
# pyrefly: ignore [missing-import]
from sqlalchemy.sql import func
import uuid
from app.database import Base

class User(Base):
    __tablename__ = "profiles"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True)
    name = Column("full_name", String, nullable=True)
    business_name = Column(String, nullable=True)
    address = Column(String, nullable=True)
    gst_number = Column(String, nullable=True)
    bank_details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    clients = relationship("Client", back_populates="user", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="user", cascade="all, delete-orphan")

class Client(Base):
    __tablename__ = "clients"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.profiles.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    gst_number = Column(String, nullable=True)
    address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="clients")
    invoices = relationship("Invoice", back_populates="client", cascade="all, delete-orphan")

class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.profiles.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("public.clients.id", ondelete="CASCADE"), nullable=False)
    invoice_number = Column(String, nullable=False)
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    status = Column(String, nullable=False)
    subtotal = Column(Numeric(10, 2), nullable=False, default=0.00)
    gst_rate = Column(Numeric(5, 2), nullable=False, default=18.00)
    gst_amount = Column(Numeric(10, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(10, 2), nullable=False, default=0.00)
    razorpay_order_id = Column(String, nullable=True)
    razorpay_payment_id = Column(String, nullable=True)
    razorpay_signature = Column(String, nullable=True)
    razorpay_link_id = Column(String, nullable=True)
    razorpay_link_url = Column(String, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="invoices")
    client = relationship("Client", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")

    @validates("status")
    def validate_status(self, key, value):
        if hasattr(self, 'status') and self.status != value:
            # If transitioning to Paid or Overdue status, reset sent_at to None
            if value in ("Paid", "Overdue"):
                self.sent_at = None
        return value

class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("public.invoices.id", ondelete="CASCADE"), nullable=False)
    description = Column(String, nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False)
    rate = Column(Numeric(10, 2), nullable=False)
    amount = Column(Numeric(10, 2), FetchedValue())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    invoice = relationship("Invoice", back_populates="items")


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("public.invoices.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.profiles.id", ondelete="CASCADE"), nullable=True)
    razorpay_payment_id = Column(String, nullable=True)
    razorpay_order_id = Column(String, nullable=True)
    amount_paid = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(String, nullable=True)
    paid_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    invoice = relationship("Invoice", back_populates="payments")

class AgentDecision(Base):
    __tablename__ = "agent_decisions"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("public.invoices.id", ondelete="CASCADE"), nullable=False)
    input_summary = Column(String, nullable=False)
    classification = Column(String, nullable=True)
    decided_action = Column(String, nullable=False)
    raw_llm_output = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class GuardrailOverride(Base):
    __tablename__ = "guardrail_overrides"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("public.invoices.id", ondelete="CASCADE"), nullable=False)
    llm_proposed_action = Column(String, nullable=False)
    override_reason = Column(String, nullable=False)
    final_action = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Promise(Base):
    __tablename__ = "promises"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("public.invoices.id", ondelete="CASCADE"), nullable=False)
    promised_date = Column(Date, nullable=False)
    resolved = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())