import os
import logging
from datetime import date
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import resend

from app.database import get_db
from app.models import Client, Invoice, Promise
from app.ai_agent.reply_parser import parse_reply

load_dotenv()

router = APIRouter()
log = logging.getLogger(__name__)

resend.api_key = os.getenv("RESEND_API_KEY")
WEBHOOK_SECRET = os.getenv("RESEND_WEBHOOK_SECRET")


def _find_oldest_overdue_invoice(db: Session, client_id) -> Invoice | None:
    """
    Overdue invoices are identified by status == "Overdue", matching the
    exact string check_overdue.py writes when it flags an invoice as late.
    """
    return (
        db.query(Invoice)
        .filter(Invoice.client_id == client_id)
        .filter(Invoice.status == "Overdue")
        .order_by(Invoice.due_date.asc())
        .first()
    )


@router.post("/webhooks/inbound-email")
async def handle_inbound_email(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()

    try:
        # resend.Webhooks.verify expects a single VerifyWebhookOptions dictionary
        resend.Webhooks.verify({
            "payload": raw_body.decode("utf-8"),
            "headers": {
                "id": request.headers.get("svix-id"),
                "timestamp": request.headers.get("svix-timestamp"),
                "signature": request.headers.get("svix-signature"),
            },
            "webhook_secret": WEBHOOK_SECRET,
        })
    except Exception as e:
        log.warning("Webhook signature verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    import json
    try:
        event = json.loads(raw_body.decode("utf-8"))
    except Exception as e:
        log.warning("Failed to parse JSON webhook body: %s", e)
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if event.get("type") != "email.received":
        return {"status": "ignored"}

    email_id = event["data"]["email_id"]
    from_address = event["data"]["from"]
    subject = event["data"].get("subject", "")

    # The webhook payload is metadata only, fetch the actual body separately
    if not resend.api_key or resend.api_key == "re_placeholder_replace_me":
        log.warning("RESEND_API_KEY is not configured or is a placeholder. Using mock email body.")
        body_text = "I received the reminder, but the invoice includes a charge we never agreed to. Please explain."
    else:
        try:
            full_email = resend.Emails.Receiving.get(email_id)
            body_text = full_email.get("text", "")
        except Exception as e:
            log.error("Failed to fetch email from Resend API: %s", e)
            body_text = "Failed to retrieve email content from Resend."

    log.info("Inbound email received from %s, subject: %s", from_address, subject)

    # Step 1: match the sender to a known client
    client = db.query(Client).filter(Client.email == from_address).first()
    if not client:
        log.warning("No client found matching email address %s, reply not linked to any invoice.", from_address)
        return {"status": "received", "matched": False}

    # Step 2: find their oldest overdue invoice
    invoice = _find_oldest_overdue_invoice(db, client.id)
    if not invoice:
        log.warning("Client %s matched, but no overdue invoice found.", client.email)
        return {"status": "received", "matched": "client_only"}

    # Step 3: parse the reply
    parsed = parse_reply(body_text)
    log.info("Parsed reply for invoice %s: %s", invoice.id, parsed)

    # Step 4: if it's a promise to pay with a valid date, save it
    if parsed["intent"] == "promise_to_pay" and parsed["promised_date"]:
        promise = Promise(
            invoice_id=invoice.id,
            promised_date=date.fromisoformat(parsed["promised_date"]),
            resolved=False,
        )
        db.add(promise)
        db.commit()
        log.info("Saved promise for invoice %s: pay by %s", invoice.id, parsed["promised_date"])

    return {
        "status": "received",
        "matched": True,
        "invoice_id": str(invoice.id),
        "intent": parsed["intent"],
        "promised_date": parsed["promised_date"],
    }



    