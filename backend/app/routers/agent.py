# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import date

from app.database import get_db
from app.auth import get_current_user_id
from app import models, schemas

router = APIRouter(
    prefix="/agent",
    tags=["AI Collections Agent"]
)


@router.get("/invoices/{invoice_id}/activity", response_model=schemas.InvoiceAgentActivityResponse)
async def get_invoice_agent_activity(
    invoice_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Full chronological AI-agent history for one invoice: every classify/decide
    cycle it ran (agent_decisions), every time a hardcoded guardrail overrode
    the AI's proposal (guardrail_overrides), and every payment promise the
    client has made in a reply (promises). This is the human-readable
    substitute for reading those tables directly.
    """
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.user_id == current_user_id,
    ).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found or does not belong to the authenticated user"
        )

    decisions = (
        db.query(models.AgentDecision)
        .filter(models.AgentDecision.invoice_id == invoice_id)
        .order_by(models.AgentDecision.created_at.asc())
        .all()
    )
    overrides = (
        db.query(models.GuardrailOverride)
        .filter(models.GuardrailOverride.invoice_id == invoice_id)
        .order_by(models.GuardrailOverride.created_at.asc())
        .all()
    )
    promises = (
        db.query(models.Promise)
        .filter(models.Promise.invoice_id == invoice_id)
        .order_by(models.Promise.created_at.asc())
        .all()
    )

    latest_action = decisions[-1].decided_action if decisions else None

    active_promise_date = None
    today = date.today()
    for p in promises:
        if not p.resolved and p.promised_date >= today:
            active_promise_date = p.promised_date
            break

    return schemas.InvoiceAgentActivityResponse(
        invoice_id=invoice_id,
        latest_action=latest_action,
        active_promise_date=active_promise_date,
        decisions=decisions,
        overrides=overrides,
        promises=promises,
    )


@router.get("/summary", response_model=schemas.AgentSummaryResponse)
async def get_agent_summary(
    current_user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Account-wide rollup of the AI collections agent's activity: totals by
    action type, the map of each invoice's most recent decision (so the UI
    can badge any invoice without a per-invoice call), the invoices under an
    active client payment-promise, and the list of invoices the agent has
    explicitly handed off to a human (escalated or disputed) that still need
    attention.
    """
    decisions = (
        db.query(models.AgentDecision, models.Invoice.status)
        .join(models.Invoice, models.AgentDecision.invoice_id == models.Invoice.id)
        .filter(models.Invoice.user_id == current_user_id)
        .order_by(models.AgentDecision.created_at.desc())
        .all()
    )

    overrides = (
        db.query(models.GuardrailOverride)
        .join(models.Invoice, models.GuardrailOverride.invoice_id == models.Invoice.id)
        .filter(models.Invoice.user_id == current_user_id)
        .order_by(models.GuardrailOverride.created_at.desc())
        .all()
    )
    # Overrides are logged in the same transaction/timestamp as the decision
    # they apply to, so the most recent override per invoice lines up with
    # that invoice's most recent decision.
    latest_override_by_invoice = {}
    for o in overrides:
        if o.invoice_id not in latest_override_by_invoice:
            latest_override_by_invoice[o.invoice_id] = o

    counts = {
        "send_reminder": 0,
        "retry_payment": 0,
        "escalate_to_human": 0,
        "mark_disputed": 0,
        "do_nothing": 0,
    }
    latest_actions = {}
    latest_by_invoice = {}
    for d, status in decisions:
        if d.invoice_id not in latest_by_invoice:
            latest_by_invoice[d.invoice_id] = d
            latest_actions[d.invoice_id] = d.decided_action
            if status in ("Sent", "Overdue"):
                counts[d.decided_action] = counts.get(d.decided_action, 0) + 1

    needs_attention = []
    for invoice_id, decision in latest_by_invoice.items():
        if decision.decided_action not in ("escalate_to_human", "mark_disputed"):
            continue

        invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
        if not invoice or invoice.status not in ("Sent", "Overdue"):
            continue

        override = latest_override_by_invoice.get(invoice_id)
        if override:
            reason = override.override_reason
        elif decision.decided_action == "mark_disputed":
            reason = "Client appears to be disputing this invoice — requires manual review."
        elif decision.classification:
            reason = f"AI classified this invoice as '{decision.classification}' and deferred to manual review."
        else:
            reason = "This invoice needs manual review."

        needs_attention.append(schemas.AgentAttentionItem(
            invoice_id=invoice_id,
            invoice_number=invoice.invoice_number,
            client_name=invoice.client.name if invoice.client else "Unknown",
            total_amount=invoice.total_amount,
            decided_action=decision.decided_action,
            reason=reason,
            created_at=decision.created_at,
        ))

    needs_attention.sort(key=lambda item: item.created_at, reverse=True)

    active_promises = {}
    today = date.today()
    promise_rows = (
        db.query(models.Promise)
        .join(models.Invoice, models.Promise.invoice_id == models.Invoice.id)
        .filter(models.Invoice.user_id == current_user_id)
        .filter(models.Promise.resolved == False)  # noqa: E712
        .filter(models.Promise.promised_date >= today)
        .all()
    )
    for p in promise_rows:
        if p.invoice_id not in active_promises or p.promised_date < active_promises[p.invoice_id]:
            active_promises[p.invoice_id] = p.promised_date

    return schemas.AgentSummaryResponse(
        reminders_sent=counts["send_reminder"],
        retried_payment=counts["retry_payment"],
        escalated=counts["escalate_to_human"],
        disputed=counts["mark_disputed"],
        needs_attention=needs_attention,
        latest_actions=latest_actions,
        active_promises=active_promises,
    )
