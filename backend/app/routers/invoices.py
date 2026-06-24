# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
# pyrefly: ignore [missing-import]
from fastapi.responses import HTMLResponse
# pyrefly: ignore [missing-import]
from fastapi.templating import Jinja2Templates
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
from uuid import UUID
from decimal import Decimal
from typing import List
import os


from app.database import get_db
from app.auth import get_current_user_id
from app import models, schemas
from app.utils.pdf import generate_invoice_pdf
from app.utils.email import send_invoice_email

router = APIRouter(
    prefix="/invoices",
    tags=["Invoices"]
)

@router.post("", response_model=schemas.InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    invoice_in: schemas.InvoiceCreate,
    current_user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Create a new invoice with nested items.
    Performs math logic calculating (quantity * rate) * (1 + gst_rate/100) inside a database transaction.
    """
    # 1. Verify client exists and belongs to the authenticated user
    client = db.query(models.Client).filter(
        models.Client.id == invoice_in.client_id,
        models.Client.user_id == current_user_id
    ).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found or does not belong to the authenticated user"
        )

    # 2. Ensure User record exists in public.users to avoid FK constraint issues
    user = db.query(models.User).filter(models.User.id == current_user_id).first()
    if not user:
        user = models.User(
            id=current_user_id,
            name="Freelancer",
            gst_number=None,
            bank_details=None
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # 3. Create invoice and items under transaction
    try:
        calculated_subtotal = Decimal("0.00")
        calculated_gst_amount = Decimal("0.00")
        invoice_gst_rate = invoice_in.items[0].gst_rate if invoice_in.items else Decimal("18.00")

        for item_data in invoice_in.items:
            item_subtotal = item_data.quantity * item_data.rate
            calculated_subtotal += item_subtotal
            item_gst = item_subtotal * (item_data.gst_rate / Decimal("100.00"))
            calculated_gst_amount += item_gst

        calculated_total = calculated_subtotal + calculated_gst_amount

        # Instantiate Invoice parent object
        invoice = models.Invoice(
            user_id=current_user_id,
            client_id=invoice_in.client_id,
            invoice_number=invoice_in.invoice_number,
            issue_date=invoice_in.issue_date,
            due_date=invoice_in.due_date,
            status=invoice_in.status,
            subtotal=calculated_subtotal,
            gst_rate=invoice_gst_rate,
            gst_amount=calculated_gst_amount,
            total_amount=calculated_total
        )
        db.add(invoice)
        db.flush() # Populate invoice.id

        # Iterate and instantiate nested invoice items
        for item_data in invoice_in.items:
            db_item = models.InvoiceItem(
                invoice_id=invoice.id,
                description=item_data.description,
                quantity=item_data.quantity,
                rate=item_data.rate
            )
            db.add(db_item)

        db.commit()
        db.refresh(invoice)
        await ensure_payment_link(invoice, db)
        return invoice

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Invoice database transaction failed: {str(e)}"
        )

@router.get("", response_model=List[schemas.InvoiceResponse])
async def get_invoices(
    current_user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Retrieve all invoices belonging to the current authenticated user.
    """
    invoices = db.query(models.Invoice).filter(models.Invoice.user_id == current_user_id).all()
    return invoices

@router.patch("/{invoice_id}", response_model=schemas.InvoiceResponse)
async def update_invoice_status(
    invoice_id: UUID,
    status_update: schemas.InvoiceStatusUpdate,
    current_user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Update status of an invoice belonging to the authenticated user.
    """
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.user_id == current_user_id
    ).first()
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found or does not belong to the authenticated user"
        )
    old_status = invoice.status
    invoice.status = status_update.status
    db.commit()
    db.refresh(invoice)

    if old_status == "Draft" and invoice.status == "Sent":
        await ensure_payment_link(invoice, db)

    return invoice

@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    invoice_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Delete an invoice belonging to the authenticated user.
    """
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.user_id == current_user_id
    ).first()
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found or does not belong to the authenticated user"
        )
        
    db.delete(invoice)
    db.commit()
    return


# --- Razorpay Payment Link Generation Helpers ---

import asyncio
from functools import partial
import logging
from uuid import uuid4
from app.config import settings

log = logging.getLogger(__name__)

def is_mock_mode() -> bool:
    key_id = settings.RAZORPAY_KEY_ID
    key_secret = settings.RAZORPAY_KEY_SECRET
    return (
        not key_id or
        not key_secret or
        "placeholder" in key_id.lower() or
        "placeholder" in key_secret.lower()
    )

async def ensure_payment_link(invoice: models.Invoice, db: Session):
    """
    Ensure a unique Razorpay Payment Link is generated and saved for Sent invoices.
    If standard placeholders are used, it generates a mock link.
    """
    if invoice.status != "Sent" or invoice.razorpay_link_url:
        return

    amount_in_paise = int(invoice.total_amount * 100)

    # 1. Mock Payment Link Mode
    if is_mock_mode():
        invoice.razorpay_link_id = f"plink_mock_{uuid4().hex[:14]}"
        invoice.razorpay_link_url = f"http://localhost:8000/api/v1/payments/mock-payment-portal/{invoice.id}"
        log.info(
            "Mock Mode: Generated payment link %s for invoice %s",
            invoice.razorpay_link_id,
            invoice.id
        )
        db.commit()
        return

    # 2. Production API Mode
    try:
        import razorpay
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

        customer_info = {}
        if invoice.client.name:
            customer_info["name"] = invoice.client.name
        if invoice.client.email:
            customer_info["email"] = invoice.client.email
        if invoice.client.phone:
            customer_info["contact"] = invoice.client.phone

        payload = {
            "amount": amount_in_paise,
            "currency": "INR",
            "accept_partial": False,
            "reference_id": str(invoice.id),
            "description": f"Payment for Invoice {invoice.invoice_number}",
            "notify": {
                "sms": False,
                "email": False
            },
            "notes": {
                "invoice_id": str(invoice.id),
                "invoice_number": invoice.invoice_number
            }
        }
        if customer_info:
            payload["customer"] = customer_info

        # Run blocking network call inside thread pool
        loop = asyncio.get_running_loop()
        create_pl_fn = partial(client.payment_link.create, data=payload)
        response = await loop.run_in_executor(None, create_pl_fn)

        invoice.razorpay_link_id = response.get("id")
        invoice.razorpay_link_url = response.get("short_url")
        db.commit()

        log.info(
            "Razorpay API: Generated payment link %s for invoice %s",
            invoice.razorpay_link_id,
            invoice.id
        )
    except Exception as e:
        log.error("Failed to generate Razorpay Payment Link for invoice %s: %s", invoice.id, str(e))


# --- PDF/HTML Templating and Preview Engine ---

current_dir = os.path.dirname(os.path.abspath(__file__))
templates_dir = os.path.join(os.path.dirname(current_dir), "templates")
templates = Jinja2Templates(directory=templates_dir)

def format_currency(val: Decimal) -> str:
    if val is None:
        return "₹0.00"
    return f"₹{val:,.2f}"

def format_date(val) -> str:
    if val is None:
        return ""
    if isinstance(val, str):
        return val
    return val.strftime("%d %b %Y")

@router.get("/preview/demo", response_class=HTMLResponse)
async def demo_invoice_preview(request: Request):
    """
    Developer preview endpoint rendering the invoice template with realistic mock data.
    """
    mock_invoice = {
        "invoice_number": "INV-2026-042",
        "issue_date": "23 Jun 2026",
        "due_date": "07 Jul 2026",
        "status": "Paid",
        "subtotal": "₹75,000.00",
        "gst_rate": "18.00",
        "gst_amount": "₹13,500.00",
        "total_amount": "₹88,500.00",
    }
    mock_client = {
        "name": "Acme Technologies Ltd.",
        "email": "billing@acme-tech.com",
        "phone": "+91 98765 43210",
        "gst_number": "29AAAAA1111A1Z1",
        "address": "Building 4, Sector 7, Outer Ring Road, Bangalore, KA, 560103",
    }
    mock_user = {
        "name": "Jane Doe Consulting",
        "email": "hello@janedoe.io",
        "phone": "+91 99999 88888",
        "gst_number": "29BBBBB2222B2Z2",
        "address": "Flat 302, Green Meadows Apt, HSR Layout, Bangalore, 560102",
    }
    mock_bank = {
        "bank_name": "State Bank of India",
        "account_holder_name": "Jane Doe Consulting",
        "account_number": "30123456789",
        "ifsc_code": "SBIN0001234",
    }
    mock_items = [
        {
            "description": "Full-Stack Development Consulting (June 2026)",
            "quantity": "1.00",
            "rate": "₹60,000.00",
            "amount": "₹60,000.00"
        },
        {
            "description": "UX Research & Wireframing Session",
            "quantity": "5.00",
            "rate": "₹3,000.00",
            "amount": "₹15,000.00"
        }
    ]

    return templates.TemplateResponse(
        request=request,
        name="invoice.html",
        context={
            "invoice": mock_invoice,
            "client": mock_client,
            "user": mock_user,
            "bank": mock_bank,
            "items": mock_items
        }
    )

@router.get("/{invoice_id}/preview", response_class=HTMLResponse)
async def get_invoice_preview(
    invoice_id: UUID,
    request: Request,
    current_user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Render a real invoice in HTML format using the invoice template.
    Verifies that the invoice belongs to the authenticated user.
    """
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.user_id == current_user_id
    ).first()

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found or does not belong to the authenticated user"
        )

    # Format values for representation
    invoice_data = {
        "invoice_number": invoice.invoice_number,
        "issue_date": format_date(invoice.issue_date),
        "due_date": format_date(invoice.due_date),
        "status": invoice.status,
        "subtotal": format_currency(invoice.subtotal),
        "gst_rate": f"{invoice.gst_rate:.2f}" if invoice.gst_rate is not None else "18.00",
        "gst_amount": format_currency(invoice.gst_amount),
        "total_amount": format_currency(invoice.total_amount),
    }

    client_data = {
        "name": invoice.client.name,
        "email": invoice.client.email,
        "phone": invoice.client.phone,
        "gst_number": invoice.client.gst_number,
        "address": invoice.client.address,
    }

    user_data = {
        "name": invoice.user.business_name or invoice.user.name or "Freelancer",
        "gst_number": invoice.user.gst_number,
        "email": None, # Will fall back in template if not present
        "phone": None,
        "address": invoice.user.address,
    }

    # Extract bank details JSON
    bank_data = invoice.user.bank_details if invoice.user.bank_details else None

    items_data = []
    for item in invoice.items:
        qty = item.quantity if item.quantity is not None else Decimal("0.00")
        rate = item.rate if item.rate is not None else Decimal("0.00")
        amount = qty * rate
        
        items_data.append({
            "description": item.description,
            "quantity": f"{qty:.2f}",
            "rate": format_currency(rate),
            "amount": format_currency(amount)
        })

    return templates.TemplateResponse(
        request=request,
        name="invoice.html",
        context={
            "invoice": invoice_data,
            "client": client_data,
            "user": user_data,
            "bank": bank_data,
            "items": items_data
        }
    )


@router.get("/preview/download-demo")
async def demo_invoice_pdf_download():
    """
    Developer preview endpoint compiling the invoice layout with mock data into a PDF binary.
    """
    class MockObject:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
                
    mock_invoice = MockObject(
        invoice_number="INV-2026-042",
        issue_date="23 Jun 2026",
        due_date="07 Jul 2026",
        status="Paid",
        subtotal=Decimal("75000.00"),
        gst_rate=Decimal("18.00"),
        gst_amount=Decimal("13500.00"),
        total_amount=Decimal("88500.00")
    )
    mock_client = MockObject(
        name="Acme Technologies Ltd.",
        email="billing@acme-tech.com",
        phone="+91 98765 43210",
        gst_number="29AAAAA1111A1Z1",
        address="Building 4, Sector 7, Outer Ring Road, Bangalore, KA, 560103"
    )
    mock_user = MockObject(
        name="Jane Doe Consulting",
        email="hello@janedoe.io",
        phone="+91 99999 88888",
        gst_number="29BBBBB2222B2Z2",
        address="Flat 302, Green Meadows Apt, HSR Layout, Bangalore, 560102"
    )
    mock_bank = {
        "bank_name": "State Bank of India",
        "account_holder_name": "Jane Doe Consulting",
        "account_number": "30123456789",
        "ifsc_code": "SBIN0001234"
    }
    mock_items = [
        MockObject(
            description="Full-Stack Development Consulting (June 2026)",
            quantity=Decimal("1.00"),
            rate=Decimal("60000.00")
        ),
        MockObject(
            description="UX Research & Wireframing Session",
            quantity=Decimal("5.00"),
            rate=Decimal("3000.00")
        )
    ]

    pdf_bytes = generate_invoice_pdf(
        invoice=mock_invoice,
        client=mock_client,
        user=mock_user,
        items=mock_items,
        bank_details=mock_bank
    )
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=demo_invoice.pdf"}
    )

@router.get("/{invoice_id}/download")
async def download_invoice_pdf(
    invoice_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Generate and return a compiled PDF binary of a real database invoice.
    Verifies that the invoice belongs to the authenticated user.
    """
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.user_id == current_user_id
    ).first()

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found or does not belong to the authenticated user"
        )

    # Format values for compilation
    bank_details = invoice.user.bank_details if invoice.user.bank_details else None

    try:
        pdf_bytes = generate_invoice_pdf(
            invoice=invoice,
            client=invoice.client,
            user=invoice.user,
            items=invoice.items,
            bank_details=bank_details
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate invoice PDF: {str(e)}"
        )

    clean_filename = f"invoice_{invoice.invoice_number.replace(' ', '_')}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={clean_filename}"}
    )


@router.post(
    "/{invoice_id}/send",
    response_model=schemas.SendInvoiceResponse,
    summary="Email invoice PDF to client",
)
async def send_invoice(
    invoice_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Generate the invoice PDF and dispatch it to the client's email address
    as an attachment via Resend.

    On success the invoice status is automatically updated to **Sent**.

    Raises **422** if the client has no email address on record.
    Raises **502** if the Resend API returns an error.
    """
    # ------------------------------------------------------------------ #
    # 1. Load invoice and verify ownership
    # ------------------------------------------------------------------ #
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.user_id == current_user_id,
    ).first()

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found or does not belong to the authenticated user",
        )

    # ------------------------------------------------------------------ #
    # 2. Guard: client must have an email
    # ------------------------------------------------------------------ #
    if not invoice.client.email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Client '{invoice.client.name}' has no email address. "
                "Please update the client profile before sending."
            ),
        )

    # ------------------------------------------------------------------ #
    # 3. Collect user bank details & Auto-update Status & Generate Link
    # ------------------------------------------------------------------ #
    bank_details = invoice.user.bank_details if invoice.user.bank_details else None

    from datetime import datetime, timezone
    if invoice.status not in ("Paid", "Sent"):
        invoice.status = "Sent"
    invoice.sent_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(invoice)

    # Ensure a payment link is generated BEFORE the email is constructed
    await ensure_payment_link(invoice, db)

    # ------------------------------------------------------------------ #
    # 4. Dispatch async email (PDF generation + Resend call)
    # ------------------------------------------------------------------ #
    try:
        resend_response = await send_invoice_email(
            invoice=invoice,
            client=invoice.client,
            user=invoice.user,
            items=invoice.items,
            bank_details=bank_details,
        )
    except ValueError as exc:
        # Raised by send_invoice_email when client email is absent
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Email delivery failed: {str(exc)}",
        )

    return schemas.SendInvoiceResponse(
        message=f"Invoice {invoice.invoice_number} successfully dispatched to {invoice.client.email}.",
        resend_id=resend_response.get("id"),
        invoice_id=invoice.id,
        recipient_email=invoice.client.email,
    )
