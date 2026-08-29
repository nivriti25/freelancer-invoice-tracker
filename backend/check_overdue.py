#!/usr/bin/env python
import os
import sys
from datetime import date

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(script_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(script_dir, ".env"))

for key in ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_KEY", "RESEND_API_KEY", "EMAIL_FROM"]:
    if key in os.environ:
        os.environ[key] = os.environ[key].strip()

import asyncio
from sqlalchemy.orm import joinedload
from app.database import SessionLocal
from app.models import Invoice, Client, Promise, AgentDecision, GuardrailOverride
from app.utils.email import send_invoice_email, _build_invoice_html, send_email

from app.ai_agent.classifier import classify_cause
from app.ai_agent.decider import decide_action
from app.ai_agent.root_cause_rules import enforce_root_cause_rules
from app.ai_agent.guardrails import apply_guardrails
from app.ai_agent.escalation import get_escalation_stage
from app.ai_agent.promise_tracker import should_pause_escalation
from app.ai_agent.email_drafter import draft_reminder_body
from app.ai_agent.actions import AgentAction


def _get_invoice_state(db, inv: Invoice) -> dict:
    days_overdue = (date.today() - inv.due_date).days
    contact_count = (
        db.query(AgentDecision)
        .filter(AgentDecision.invoice_id == inv.id)
        .filter(AgentDecision.decided_action == AgentAction.SEND_REMINDER.value)
        .count()
    )
    return {
        "amount": float(inv.total_amount),
        "days_overdue": days_overdue,
        "contact_count": contact_count,
        "client_name": inv.client.name if inv.client else "Unknown",
        "do_not_contact": False,  # ASSUMPTION: no such column exists yet, defaults to False
    }


def _get_active_promises(db, invoice_id) -> list[dict]:
    rows = db.query(Promise).filter(Promise.invoice_id == invoice_id).all()
    return [{"promised_date": r.promised_date, "resolved": r.resolved} for r in rows]


async def run_agent_pipeline_for_invoice(db, inv: Invoice) -> None:
    client_name = inv.client.name if inv.client else "Unknown Client"
    print(f"Processing Invoice {inv.invoice_number} (Client: {client_name}, Due Date: {inv.due_date})")

    invoice_state = _get_invoice_state(db, inv)

    # Step 1: check for an active promise, pause the whole pipeline if one exists
    promises = _get_active_promises(db, inv.id)
    pause_reason = should_pause_escalation(invoice_state, promises)
    if pause_reason:
        print(f"  -> Paused: {pause_reason}\n")
        return

    # Step 2: classify why it's overdue
    # ASSUMPTION: no "latest reply" lookup exists yet, so reply is None for now.
    classification = classify_cause(invoice_state, history=[], reply=None)
    print(f"  -> Classification: {classification}")

    # Step 3: decide an action
    proposed_action = decide_action(classification, invoice_state)
    print(f"  -> LLM proposed action: {proposed_action}")

    # Step 4: root-cause sanity check
    action_after_rules, rules_reason = enforce_root_cause_rules(classification, proposed_action)

    # Step 5: hardcoded guardrails
    final_action, guardrail_reason = apply_guardrails(action_after_rules, invoice_state)

    override_reason = rules_reason or guardrail_reason
    if override_reason:
        print(f"  -> Overridden to: {final_action} ({override_reason})")

    # Step 6: log the decision, always
    decision = AgentDecision(
        invoice_id=inv.id,
        input_summary=f"days_overdue={invoice_state['days_overdue']}, amount={invoice_state['amount']}",
        classification=classification,
        decided_action=final_action,
        raw_llm_output=proposed_action,
    )
    db.add(decision)

    # Step 7: log any override
    if override_reason:
        db.add(GuardrailOverride(
            invoice_id=inv.id,
            llm_proposed_action=proposed_action,
            override_reason=override_reason,
            final_action=final_action,
        ))

    db.commit()

    # Step 8: act, only send_reminder is wired to a real action for now
    if final_action == AgentAction.SEND_REMINDER.value:
        stage = get_escalation_stage(invoice_state["days_overdue"])
        if stage in ("gentle", "firm", "final"):
            body_paragraph = draft_reminder_body(invoice_state, classification, stage)
            print(f"  -> Sending {stage} reminder...")
            # Reuses the existing HTML template, injecting the AI-drafted paragraph
            # NOTE: requires _build_invoice_html to accept a body_paragraph override,
            # see the small edit to email.py needed below.
            await send_invoice_email(
                invoice=inv,
                client=inv.client,
                user=inv.user,
                items=inv.items,
                bank_details=inv.user.bank_details if inv.user else None,
                email_mode="Overdue",
                ai_body_paragraph=body_paragraph,
            )
            print(f"  -> Email dispatched.\n")
        else:
            print(f"  -> Stage is '{stage}', no reminder sent.\n")
    else:
        print(f"  -> Final action is '{final_action}', no automated email sent. Awaiting human handling.\n")


async def process_overdue_invoices():
    db = SessionLocal()
    try:
        today = date.today()

        # Same as before: move newly-overdue Sent invoices into Overdue status
        newly_overdue = (
            db.query(Invoice)
            .filter(Invoice.status == "Sent")
            .filter(Invoice.due_date < today)
            .all()
        )
        for inv in newly_overdue:
            inv.status = "Overdue"
        db.commit()

        # Now run the full agent pipeline on every currently-Overdue invoice
        overdue_invoices = (
            db.query(Invoice)
            .options(
                joinedload(Invoice.client),
                joinedload(Invoice.user),
                joinedload(Invoice.items),
            )
            .filter(Invoice.status == "Overdue")
            .order_by(Invoice.due_date.asc())
            .all()
        )

        if not overdue_invoices:
            print("No overdue invoices found.")
            return

        print(f"\nFound {len(overdue_invoices)} overdue invoice(s). Running agent pipeline...\n")

        for inv in overdue_invoices:
            try:
                await run_agent_pipeline_for_invoice(db, inv)
            except Exception as e:
                db.rollback()
                print(f"  -> Error processing invoice {inv.invoice_number}: {e}\n", file=sys.stderr)

    finally:
        db.close()


async def main():
    print(f"Running AI revenue recovery agent (Today's date: {date.today()})...")
    try:
        await process_overdue_invoices()
    except Exception as e:
        print(f"Fatal error running utility: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())