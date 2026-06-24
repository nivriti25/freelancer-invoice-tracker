import re
from typing import Optional, List
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
GST_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", re.IGNORECASE)

class ClientBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: Optional[str] = None
    phone: Optional[str] = None
    gst_number: Optional[str] = None
    address: Optional[str] = None

class ClientCreate(ClientBase):
    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if v == "":
                return None
            if not EMAIL_REGEX.match(v):
                raise ValueError("Invalid email syntax")
        return v

    @field_validator("gst_number")
    @classmethod
    def validate_gst(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if v == "":
                return None
            if len(v) != 15:
                raise ValueError("GST number must be exactly 15 characters")
            if not GST_REGEX.match(v):
                raise ValueError("Invalid GST number format")
        return v

class ClientUpdate(ClientCreate):
    pass

class ClientResponse(ClientBase):
    id: UUID
    user_id: UUID
    created_at: datetime

    model_config = {
        "from_attributes": True
    }

# --- Invoice and InvoiceItem Schemas ---

class InvoiceItemBase(BaseModel):
    description: str = Field(..., min_length=1)
    quantity: Decimal = Field(..., gt=0)
    rate: Decimal = Field(..., gt=0)

class InvoiceItemCreate(InvoiceItemBase):
    gst_rate: Decimal = Field(default=Decimal("18.00"), ge=0, le=100)

class InvoiceItemResponse(InvoiceItemBase):
    id: UUID
    invoice_id: UUID
    amount: Optional[Decimal] = None
    created_at: datetime

    model_config = {
        "from_attributes": True
    }

class InvoiceBase(BaseModel):
    client_id: UUID
    invoice_number: str = Field(..., min_length=1)
    issue_date: date
    due_date: date
    status: str = Field(default="Draft")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid_statuses = {"Draft", "Sent", "Paid", "Overdue"}
        if v not in valid_statuses:
            raise ValueError(f"Status must be one of {valid_statuses}")
        return v

class InvoiceCreate(InvoiceBase):
    items: List[InvoiceItemCreate] = Field(..., min_items=1)

class InvoiceStatusUpdate(BaseModel):
    status: str = Field(..., min_length=1)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid_statuses = {"Draft", "Sent", "Paid", "Overdue"}
        if v not in valid_statuses:
            raise ValueError(f"Status must be one of {valid_statuses}")
        return v

class InvoiceResponse(InvoiceBase):
    id: UUID
    user_id: UUID
    subtotal: Decimal
    gst_rate: Decimal
    gst_amount: Decimal
    total_amount: Decimal
    created_at: datetime
    sent_at: Optional[datetime] = None
    items: List[InvoiceItemResponse]
    razorpay_link_id: Optional[str] = None
    razorpay_link_url: Optional[str] = None

    model_config = {
        "from_attributes": True
    }


# --- Email dispatch schemas ---

class SendInvoiceResponse(BaseModel):
    """Response returned by POST /invoices/{invoice_id}/send."""
    message: str
    resend_id: Optional[str] = None
    invoice_id: UUID
    recipient_email: str


# --- Razorpay payment schemas ---

class RazorpayOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str
    invoice_id: UUID
    invoice_number: str

class RazorpayVerifyRequest(BaseModel):
    invoice_id: UUID
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

class RazorpayVerifyResponse(BaseModel):
    status: str
    message: str
