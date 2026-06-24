# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
from uuid import UUID, uuid4
import razorpay
import logging
import asyncio
from functools import partial

from app.database import get_db
from app.auth import get_current_user_id
from app import models, schemas
from app.config import settings

log = logging.getLogger(__name__)

router = APIRouter(
    prefix="/payments",
    tags=["Payments"]
)

def is_mock_mode() -> bool:
    """Returns True if the Razorpay credentials are using default placeholders."""
    key_id = settings.RAZORPAY_KEY_ID
    key_secret = settings.RAZORPAY_KEY_SECRET
    return (
        not key_id or
        not key_secret or
        "placeholder" in key_id.lower() or
        "placeholder" in key_secret.lower()
    )

@router.post("/create-order/{invoice_id}", response_model=schemas.RazorpayOrderResponse)
async def create_razorpay_order(
    invoice_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Create a Razorpay order for the given invoice.
    If credentials are placeholders, it automatically operates in mock mode for easy development.
    """
    # 1. Verify invoice exists and belongs to the authenticated user
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.user_id == current_user_id
    ).first()

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found or does not belong to the authenticated user"
        )

    if invoice.status == "Paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice is already paid"
        )

    amount_in_paise = int(invoice.total_amount * 100)

    # 2. Check if we should run in mock mode
    if is_mock_mode():
        mock_order_id = f"order_mock_{uuid4().hex[:14]}"
        log.info(
            "Razorpay keys not configured or using placeholders. "
            "Generating mock order %s for invoice %s",
            mock_order_id,
            invoice.id
        )
        
        # Save mock order ID to the invoice database record
        invoice.razorpay_order_id = mock_order_id
        db.commit()

        return schemas.RazorpayOrderResponse(
            order_id=mock_order_id,
            amount=amount_in_paise,
            currency="INR",
            key_id=settings.RAZORPAY_KEY_ID or "rzp_test_placeholder",
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number
        )

    # 3. Connect to Razorpay API and create the order
    try:
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        
        data = {
            "amount": amount_in_paise,
            "currency": "INR",
            "receipt": str(invoice.id),
            "notes": {
                "invoice_id": str(invoice.id),
                "invoice_number": invoice.invoice_number
            }
        }

        # Offload the blocking network call to a thread pool
        loop = asyncio.get_running_loop()
        create_fn = partial(client.order.create, data=data)
        order = await loop.run_in_executor(None, create_fn)

        # Save order ID to the invoice database record
        invoice.razorpay_order_id = order.get("id")
        db.commit()

        return schemas.RazorpayOrderResponse(
            order_id=order.get("id"),
            amount=order.get("amount"),
            currency=order.get("currency"),
            key_id=settings.RAZORPAY_KEY_ID,
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number
        )
    except Exception as e:
        log.error("Failed to create Razorpay order: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Razorpay order creation failed: {str(e)}"
        )

@router.post("/verify-payment", response_model=schemas.RazorpayVerifyResponse)
async def verify_payment(
    payload: schemas.RazorpayVerifyRequest,
    current_user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Verify payment signature.
    Updates the invoice status to "Paid" on successful verification.
    """
    # 1. Load invoice and verify ownership
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == payload.invoice_id,
        models.Invoice.user_id == current_user_id
    ).first()

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found or does not belong to the authenticated user"
        )

    # 2. Check if we are in mock mode (matching the order ID prefix)
    if payload.razorpay_order_id.startswith("order_mock_") or is_mock_mode():
        log.info("Verifying payment in mock mode for invoice %s", invoice.id)
        
        # Mock payment verification succeeded
        invoice.status = "Paid"
        invoice.razorpay_order_id = payload.razorpay_order_id
        invoice.razorpay_payment_id = payload.razorpay_payment_id
        invoice.razorpay_signature = payload.razorpay_signature

        # Log transaction in payments table
        mock_payment = models.Payment(
            invoice_id=invoice.id,
            user_id=invoice.user_id,
            amount_paid=invoice.total_amount,
            razorpay_payment_id=payload.razorpay_payment_id,
            razorpay_order_id=payload.razorpay_order_id,
            payment_method="Razorpay (Mock)"
        )
        db.add(mock_payment)
        
        db.commit()
        db.refresh(invoice)

        return schemas.RazorpayVerifyResponse(
            status="success",
            message="Mock payment verified successfully"
        )

    # 3. Signature verification for production mode
    try:
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        params_dict = {
            'razorpay_order_id': payload.razorpay_order_id,
            'razorpay_payment_id': payload.razorpay_payment_id,
            'razorpay_signature': payload.razorpay_signature
        }

        # Local cryptographic validation
        client.utility.verify_payment_signature(params_dict)

        # Update database fields
        invoice.status = "Paid"
        invoice.razorpay_payment_id = payload.razorpay_payment_id
        invoice.razorpay_signature = payload.razorpay_signature

        # Log transaction in payments table
        db_payment = models.Payment(
            invoice_id=invoice.id,
            user_id=invoice.user_id,
            amount_paid=invoice.total_amount,
            razorpay_payment_id=payload.razorpay_payment_id,
            razorpay_order_id=payload.razorpay_order_id,
            payment_method="Razorpay"
        )
        db.add(db_payment)
        
        db.commit()
        db.refresh(invoice)

        log.info("Razorpay payment %s verified successfully for invoice %s", payload.razorpay_payment_id, invoice.id)

        return schemas.RazorpayVerifyResponse(
            status="success",
            message="Payment verified successfully"
        )
    except razorpay.errors.SignatureVerificationError as e:
        log.warning("Razorpay signature verification failed for invoice %s: %s", payload.invoice_id, str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment signature"
        )
    except Exception as e:
        log.error("Failed to verify Razorpay payment: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification failed: {str(e)}"
        )


from fastapi import Request, Header

@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None, alias="X-Razorpay-Signature"),
    db: Session = Depends(get_db)
):
    """
    Unauthenticated public webhook endpoint.
    Verifies X-Razorpay-Signature and handles payment.captured or order.paid events.
    """
    if not x_razorpay_signature:
        log.warning("Webhook rejection: Missing X-Razorpay-Signature header")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-Razorpay-Signature header"
        )

    # 1. Read request body bytes
    body_bytes = await request.body()
    body_str = body_bytes.decode("utf-8")

    # 2. Signature verification
    if is_mock_mode() or x_razorpay_signature == "mock_signature":
        log.info("Mock Mode or mock_signature detected: Bypassing webhook signature validation")
    else:
        if not settings.RAZORPAY_WEBHOOK_SECRET:
            log.error("Webhook key is not configured on the server settings")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Webhook secret key is not configured"
            )
        try:
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            # Verify signature locally
            client.utility.verify_webhook_signature(
                body_str,
                x_razorpay_signature,
                settings.RAZORPAY_WEBHOOK_SECRET
            )
            log.info("Webhook Signature validation successful")
        except razorpay.errors.SignatureVerificationError as e:
            log.warning("Webhook Signature validation failed: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid signature"
            )
        except Exception as e:
            log.error("Webhook validation error: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Webhook validation failed"
            )

    # 3. Parse payload JSON
    try:
        data = await request.json()
    except Exception as e:
        log.warning("Webhook rejection: Invalid JSON: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )

    event_type = data.get("event")
    log.info("Processing webhook event: %s", event_type)

    if event_type in ("payment.captured", "order.paid", "payment.link.paid", "payment_link.paid"):
        payload_data = data.get("payload", {})
        
        # Try retrieving payment, order, and payment link entities
        payment_entity = payload_data.get("payment", {}).get("entity", {})
        order_entity = payload_data.get("order", {}).get("entity", {})
        payment_link_entity = payload_data.get("payment_link", {}).get("entity", {})
        
        # Try finding order ID & payment details
        order_id = payment_entity.get("order_id") or order_entity.get("id") or payment_link_entity.get("order_id")
        payment_id = payment_entity.get("id")
        signature = x_razorpay_signature

        # Try finding reference invoice ID in notes or reference_id
        invoice_id_str = (
            payment_link_entity.get("reference_id") or
            payment_entity.get("notes", {}).get("invoice_id") or 
            order_entity.get("notes", {}).get("invoice_id") or
            payment_link_entity.get("notes", {}).get("invoice_id") or
            payment_entity.get("receipt") or
            order_entity.get("receipt")
        )

        amount_paise = (
            payment_link_entity.get("amount") or 
            payment_entity.get("amount") or 
            order_entity.get("amount") or
            0
        )
        currency = (
            payment_link_entity.get("currency") or 
            payment_entity.get("currency") or 
            order_entity.get("currency") or
            "INR"
        )

        invoice = None
        if order_id:
            # Look up invoice by razorpay_order_id
            invoice = db.query(models.Invoice).filter(models.Invoice.razorpay_order_id == order_id).first()

        if not invoice and invoice_id_str:
            try:
                invoice_uuid = UUID(invoice_id_str)
                invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_uuid).first()
            except ValueError:
                pass

        if invoice:
            # Flip status to Paid immediately
            invoice.status = "Paid"
            if payment_id:
                invoice.razorpay_payment_id = payment_id
            if signature:
                invoice.razorpay_signature = signature

            # Log record inside payments table immediately
            if payment_id:
                existing_payment = db.query(models.Payment).filter(models.Payment.razorpay_payment_id == payment_id).first()
                if not existing_payment:
                    from decimal import Decimal
                    # Parse amount from paise if present (divide by 100), otherwise fallback to total_amount
                    amount_decimal = Decimal(amount_paise) / Decimal("100.00") if amount_paise > 0 else invoice.total_amount
                    db_payment = models.Payment(
                        invoice_id=invoice.id,
                        user_id=invoice.user_id,
                        amount_paid=amount_decimal,
                        razorpay_payment_id=payment_id,
                        razorpay_order_id=order_id,
                        payment_method="Razorpay (Webhook)"
                    )
                    db.add(db_payment)

            db.commit()
            log.info("Webhook success: Invoice %s marked as Paid and transaction log logged", invoice.id)
        else:
            log.warning("Webhook note: No invoice found for Order ID %s or Invoice ID %s", order_id, invoice_id_str)

    return {"status": "ok"}


@router.get("/mock-payment-portal/{invoice_id}", response_class=HTMLResponse)
async def mock_payment_portal(invoice_id: UUID, db: Session = Depends(get_db)):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        return HTMLResponse(content="<h1>Invoice Not Found</h1>", status_code=404)
        
    client_name = invoice.client.name if invoice.client else "Valued Client"
    amount = float(invoice.total_amount)
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Razorpay Mock Payment Gateway</title>
      <style>
        body {{
          margin: 0;
          padding: 0;
          background-color: #0b1329;
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }}
        .card {{
          background: #1c2541;
          border: 1px solid #3a506b;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          width: 100%;
          max-width: 440px;
          padding: 32px;
          text-align: center;
          box-sizing: border-box;
        }}
        .logo {{
          background: linear-gradient(135deg, #0561fc 0%, #3b82f6 100%);
          color: white;
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 800;
          margin-bottom: 20px;
        }}
        h2 {{
          margin: 0 0 8px;
          font-size: 22px;
          font-weight: 700;
        }}
        .sub {{
          color: #8da9c4;
          font-size: 13px;
          margin: 0 0 24px;
        }}
        .details-box {{
          background: #0b1329;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 28px;
          text-align: left;
        }}
        .detail-row {{
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 13px;
        }}
        .detail-row:last-child {{
          margin-bottom: 0;
          border-top: 1px solid #3a506b;
          padding-top: 10px;
          font-weight: bold;
        }}
        .label {{
          color: #8da9c4;
        }}
        .btn {{
          display: block;
          width: 100%;
          padding: 12px 20px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          box-sizing: border-box;
        }}
        .btn-pay {{
          background: #0561fc;
          color: white;
          margin-bottom: 12px;
        }}
        .btn-pay:hover {{
          background: #004bd4;
        }}
        .btn-cancel {{
          background: transparent;
          color: #8da9c4;
          border: 1px solid #3a506b;
        }}
        .btn-cancel:hover {{
          background: rgba(141, 169, 196, 0.1);
          color: #f8fafc;
        }}
        .success-screen {{
          display: none;
        }}
        .success-icon {{
          color: #10b981;
          font-size: 48px;
          margin-bottom: 16px;
        }}
      </style>
      <script>
        async function processPayment() {{
          const btn = document.getElementById('btn-pay');
          btn.disabled = true;
          btn.innerText = 'Processing payment...';
          
          try {{
            const response = await fetch('/api/v1/payments/webhook', {{
              method: 'POST',
              headers: {{
                'Content-Type': 'application/json',
                'X-Razorpay-Signature': 'mock_signature'
              }},
              body: JSON.stringify({{
                event: 'payment.link.paid',
                payload: {{
                  payment_link: {{
                    entity: {{
                      id: 'plink_mock_' + Math.random().toString(36).substring(2, 12),
                      reference_id: '{invoice_id}',
                      amount: {int(amount * 100)},
                      currency: 'INR',
                      status: 'paid'
                    }}
                  }},
                  payment: {{
                    entity: {{
                      id: 'pay_mock_' + Math.random().toString(36).substring(2, 10),
                      order_id: 'order_mock_' + Math.random().toString(36).substring(2, 10)
                    }}
                  }}
                }}
              }})
            }});
            
            if (response.ok) {{
              document.getElementById('portal-screen').style.display = 'none';
              document.getElementById('success-screen').style.display = 'block';
              setTimeout(() => {{
                window.close();
              }}, 3000);
            }} else {{
              alert('Mock payment processing failed.');
              btn.disabled = false;
              btn.innerText = 'Simulate Payment (Success)';
            }}
          }} catch (err) {{
            alert('Error communicating with mock server: ' + err.message);
            btn.disabled = false;
            btn.innerText = 'Simulate Payment (Success)';
          }}
        }}
        
        function cancelPayment() {{
          window.close();
        }}
      </script>
    </head>
    <body>
      <div class="card">
        <div id="portal-screen">
          <div class="logo">R</div>
          <h2>Razorpay Mock Gateway</h2>
          <p class="sub">Local Developer Testing Sandbox Mode</p>
          
          <div class="details-box">
            <div class="detail-row">
              <span class="label">Invoice No:</span>
              <span>{invoice.invoice_number}</span>
            </div>
            <div class="detail-row">
              <span class="label">Client:</span>
              <span>{client_name}</span>
            </div>
            <div class="detail-row">
              <span class="label">Amount:</span>
              <span>₹{amount:,.2f}</span>
            </div>
          </div>
          
          <button id="btn-pay" class="btn btn-pay" onclick="processPayment()">Simulate Payment (Success)</button>
          <button class="btn btn-cancel" onclick="cancelPayment()">Cancel / Decline</button>
        </div>
        
        <div id="success-screen" class="success-screen">
          <div class="success-icon">✓</div>
          <h2>Payment Simulated!</h2>
          <p class="sub">The payment was captured successfully. This window will close shortly.</p>
        </div>
      </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)
