# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
from uuid import UUID
from decimal import Decimal
from typing import List


from app.database import get_db
from app.auth import get_current_user_id
from app import models, schemas

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
        
    invoice.status = status_update.status
    db.commit()
    db.refresh(invoice)
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

