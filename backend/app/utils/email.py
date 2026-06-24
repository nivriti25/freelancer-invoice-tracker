"""
Async email service using the Resend Python SDK.

Public API
----------
send_invoice_email(invoice, client, user, items, bank_details) -> dict
    Generates the invoice PDF and dispatches it to the client's email address.

send_email(to, subject, html, ...) -> dict
    Low-level helper for arbitrary transactional emails.
"""

import asyncio
import base64
import logging
from functools import partial
from typing import Any, Dict, List, Optional

import resend

from app.config import settings
from app.utils.pdf import generate_invoice_pdf

# --------------------------------------------------------------------------- #
# Module-level logger
# --------------------------------------------------------------------------- #

log = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Low-level helper
# --------------------------------------------------------------------------- #

def _send_email_sync(
    to: List[str],
    subject: str,
    html: str,
    from_address: str,
    attachments: Optional[List[Dict]] = None,
) -> Dict:
    """
    Blocking Resend call — always run this inside a thread pool.
    The API key is read from settings on every call so that .env
    changes take effect after a hot-reload without a full restart.
    Returns the Resend API response dict (contains "id" on success).
    """
    # Set key fresh on every call — guards against stale imports
    resend.api_key = settings.RESEND_API_KEY

    params: resend.Emails.SendParams = {
        "from": from_address,
        "to": to,
        "subject": subject,
        "html": html,
    }
    if attachments:
        params["attachments"] = attachments  # type: ignore[typeddict-unknown-key]

    return resend.Emails.send(params)


async def send_email(
    to: List[str],
    subject: str,
    html: str,
    from_address: Optional[str] = None,
    attachments: Optional[List[Dict]] = None,
) -> Dict:
    """
    Async wrapper around the Resend SDK.

    Offloads the blocking HTTP call to a thread-pool executor so it never
    blocks the FastAPI event loop.

    Args:
        to:             Recipient email addresses.
        subject:        Email subject line.
        html:           HTML body.
        from_address:   Sender string — falls back to settings.EMAIL_FROM.
        attachments:    List of dicts with keys:
                        - ``filename`` (str)
                        - ``content``  (str  — base64-encoded bytes)

    Returns:
        Resend API response dict (``id`` key present on success).

    Raises:
        resend.exceptions.ResendError on API-level failures.
    """
    loop = asyncio.get_running_loop()
    sender = from_address or settings.EMAIL_FROM

    fn = partial(
        _send_email_sync,
        to=to,
        subject=subject,
        html=html,
        from_address=sender,
        attachments=attachments,
    )
    response = await loop.run_in_executor(None, fn)
    return response


# --------------------------------------------------------------------------- #
# Invoice-specific email
# --------------------------------------------------------------------------- #

def _build_invoice_html(invoice: Any, client: Any, user: Any) -> str:
    """
    Return the HTML body for the invoice delivery email.
    Falls back gracefully when attributes are missing.
    """

    def _get(obj, attr, default=""):
        if isinstance(obj, dict):
            return obj.get(attr, default) or default
        return getattr(obj, attr, default) or default

    invoice_number = _get(invoice, "invoice_number", "Invoice")
    total_amount   = _get(invoice, "total_amount", "")
    due_date       = _get(invoice, "due_date", "")
    client_name    = _get(client, "name", "Valued Client")
    sender_name    = _get(user, "business_name") or _get(user, "name", "Your Service Provider")

    # Format totals nicely if they're Decimal / numeric
    try:
        total_str = f"Rs. {float(total_amount):,.2f}"
    except (TypeError, ValueError):
        total_str = str(total_amount)

    # Format due date
    try:
        from datetime import date as _date
        if isinstance(due_date, _date):
            due_str = due_date.strftime("%d %b %Y")
        else:
            due_str = str(due_date)
    except Exception:
        due_str = str(due_date)

    razorpay_link_url = _get(invoice, "razorpay_link_url")
    payment_link_section = ""
    if razorpay_link_url:
        payment_link_section = f"""
              <!-- Payment Link callout -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px; text-align: center;">
                <tr>
                  <td>
                    <p style="margin: 0 0 12px; font-size: 14px; color: #475569; font-weight: 600;">
                      You can pay this invoice securely online:
                    </p>
                    <a href="{razorpay_link_url}" target="_blank"
                       style="background-color: #4F46E5; color: #FFFFFF; padding: 12px 28px;
                              font-size: 15px; font-weight: 700; text-decoration: none;
                              border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);">
                      Pay Invoice Online
                    </a>
                    <p style="margin: 12px 0 0; font-size: 11px; color: #64748B;">
                      Link: <a href="{razorpay_link_url}" style="color: #4F46E5; text-decoration: underline;">{razorpay_link_url}</a>
                    </p>
                  </td>
                </tr>
              </table>
        """.strip()

    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Invoice {invoice_number}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#FFFFFF;border-radius:12px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);
                       padding:32px 40px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;
                        letter-spacing:-0.3px;">
                {sender_name}
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">
                Invoice Delivery
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;font-size:15px;color:#334155;">
                Hi <strong>{client_name}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">
                Please find attached your invoice <strong>{invoice_number}</strong>
                for the services rendered. The PDF document is attached to this email
                for your records.
              </p>

              <!-- Summary card -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#F8FAFC;border:1px solid #E2E8F0;
                            border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:12px;color:#64748B;font-weight:600;
                                   text-transform:uppercase;letter-spacing:0.5px;">
                          Invoice Number
                        </td>
                        <td style="font-size:12px;color:#64748B;font-weight:600;
                                   text-transform:uppercase;letter-spacing:0.5px;
                                   text-align:right;">
                          Amount Due
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:18px;font-weight:700;color:#1E293B;
                                   padding-top:4px;">
                          {invoice_number}
                        </td>
                        <td style="font-size:18px;font-weight:700;color:#4F46E5;
                                   text-align:right;padding-top:4px;">
                          {total_str}
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2"
                            style="border-top:1px solid #E2E8F0;padding-top:12px;
                                   margin-top:12px;font-size:13px;color:#64748B;">
                          Due by: <strong style="color:#0F172A;">{due_str}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              {payment_link_section}

              <p style="margin:0 0 8px;font-size:14px;color:#475569;line-height:1.6;">
                If you have any questions about this invoice, please reply to this email
                and we'll get back to you promptly.
              </p>
              <p style="margin:0;font-size:14px;color:#475569;">
                Thank you for your business! 🙏
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F1F5F9;padding:20px 40px;text-align:center;
                       border-top:1px solid #E2E8F0;">
              <p style="margin:0;font-size:12px;color:#94A3B8;">
                This email was sent by <strong>{sender_name}</strong> via
                Freelancer Invoice Tracker.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
""".strip()


async def send_invoice_email(
    invoice: Any,
    client: Any,
    user: Any,
    items: List[Any],
    bank_details: Optional[Dict] = None,
    from_address: Optional[str] = None,
) -> Dict:
    """
    Generate the invoice PDF and email it to the client as an attachment.

    This function is fully async — both PDF generation (CPU-bound, runs in
    a thread pool) and the Resend HTTP call (I/O-bound, also thread-pooled)
    are offloaded so the FastAPI event loop is never blocked.

    Args:
        invoice:        SQLAlchemy Invoice model instance (or compatible dict).
        client:         SQLAlchemy Client model instance (or compatible dict).
        user:           SQLAlchemy User/profile model instance (or compatible dict).
        items:          List of InvoiceItem model instances (or compatible dicts).
        bank_details:   Optional bank details dict from user.bank_details.
        from_address:   Override sender address (defaults to settings.EMAIL_FROM).

    Returns:
        Resend API response dict with an ``id`` key on success.

    Raises:
        ValueError:                  When the client has no email address.
        resend.exceptions.ResendError: On Resend API failure.
    """

    def _get(obj, attr, default=None):
        if isinstance(obj, dict):
            return obj.get(attr, default)
        return getattr(obj, attr, default)

    # ------------------------------------------------------------------ #
    # Guard: client must have an email
    # ------------------------------------------------------------------ #
    client_email = _get(client, "email")
    if not client_email:
        raise ValueError(
            f"Client '{_get(client, 'name', 'Unknown')}' has no email address. "
            "Cannot dispatch invoice."
        )

    invoice_number = _get(invoice, "invoice_number", "Invoice")

    log.info(
        "Dispatching invoice %s to %s via Resend",
        invoice_number,
        client_email,
    )

    # ------------------------------------------------------------------ #
    # Step 1 — Generate PDF in a thread pool (CPU-bound / blocking I/O)
    # ------------------------------------------------------------------ #
    loop = asyncio.get_running_loop()
    pdf_fn = partial(
        generate_invoice_pdf,
        invoice=invoice,
        client=client,
        user=user,
        items=items,
        bank_details=bank_details,
    )
    pdf_bytes: bytes = await loop.run_in_executor(None, pdf_fn)

    log.info(
        "PDF generated for invoice %s — %d bytes",
        invoice_number,
        len(pdf_bytes),
    )

    # ------------------------------------------------------------------ #
    # Step 2 — Base64-encode for the Resend attachment payload
    # ------------------------------------------------------------------ #
    pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")
    safe_filename = f"invoice_{invoice_number.replace(' ', '_')}.pdf"

    attachments = [
        {
            "filename": safe_filename,
            "content": pdf_b64,
        }
    ]

    # ------------------------------------------------------------------ #
    # Step 3 — Build email body and dispatch
    # ------------------------------------------------------------------ #
    subject = f"Invoice {invoice_number} from {_get(user, 'business_name') or _get(user, 'name', 'Your Provider')}"
    html_body = _build_invoice_html(invoice=invoice, client=client, user=user)

    response = await send_email(
        to=[client_email],
        subject=subject,
        html=html_body,
        from_address=from_address,
        attachments=attachments,
    )

    log.info(
        "Invoice %s dispatched to %s — Resend message id: %s",
        invoice_number,
        client_email,
        response.get("id"),
    )

    return response
