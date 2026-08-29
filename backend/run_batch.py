#!/usr/bin/env python3
import asyncio
import os
import sys
import json
from datetime import date, timedelta, datetime
from decimal import Decimal

# Setup python path so we can import from app
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(script_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(script_dir, ".env"))

from app.database import SessionLocal
from app import models
from app.ai_agent import promise_tracker
from sqlalchemy.orm import joinedload
import check_overdue

# Global dictionary to track simulation states for each client/invoice
# Keys will be client names, values will be dicts tracking current simulation state
sim_states = {}
created_client_ids = []

# Custom Date mock class to control current time in simulation
class MockDate(date):
    _today = date(2026, 8, 20)

    @classmethod
    def today(cls):
        return cls._today

# Override date in the relevant modules
check_overdue.date = MockDate
promise_tracker.date = MockDate

# Mocked classifier that behaves according to behavior profiles
def mock_classify_cause(invoice_state, history, reply=None):
    client_name = invoice_state["client_name"]
    sim = sim_states.get(client_name)
    if not sim:
        return "forgot"
    
    # If client has simulated dispute response
    if sim.get("disputed_reply_received", False):
        return "disputed"
        
    # If client has simulated payment failure
    if sim.get("payment_failed_logged", False):
        return "payment_failed"
        
    # If client is silent and we've already tried contacting them
    if sim["behavior"] == "goes_silent" and invoice_state["contact_count"] >= 1:
        return "gone_silent"
        
    # If client disputes on the first contact attempt
    if sim["behavior"] == "disputes" and invoice_state["contact_count"] >= 1:
        return "disputed"
        
    return "forgot"

# Mocked decider
def mock_decide_action(classification, invoice_state):
    if classification == "forgot":
        return "send_reminder"
    elif classification == "payment_failed":
        return "retry_payment"
    elif classification == "disputed":
        return "mark_disputed"
    elif classification == "gone_silent":
        if invoice_state["contact_count"] >= 3:
            return "escalate_to_human"
        else:
            return "send_reminder"
    return "do_nothing"

# Mocked email sender
async def mock_send_invoice_email(*args, **kwargs):
    invoice = kwargs.get("invoice") or args[0]
    client = kwargs.get("client") or args[1]
    stage = check_overdue.get_escalation_stage((MockDate.today() - invoice.due_date).days)
    print(f"    [Email Outbound] Sent {stage} reminder email to {client.name} for invoice {invoice.invoice_number}")

# Mocked email drafter
def mock_draft_reminder_body(invoice_state, classification, escalation_stage):
    return f"Mock {escalation_stage} reminder for {classification} behavior."

# Mocked get_invoice_state to support do-not-contact flag
def mock_get_invoice_state(db, inv):
    client_name = inv.client.name if inv.client else "Unknown"
    sim = sim_states.get(client_name)
    do_not_contact = sim.get("do_not_contact", False) if sim else False
    
    res = check_overdue._original_get_invoice_state(db, inv)
    res["do_not_contact"] = do_not_contact
    return res

# Apply mocks to check_overdue module
check_overdue.classify_cause = mock_classify_cause
check_overdue.decide_action = mock_decide_action
check_overdue.draft_reminder_body = mock_draft_reminder_body
check_overdue.send_invoice_email = mock_send_invoice_email
check_overdue._original_get_invoice_state = check_overdue._get_invoice_state
check_overdue._get_invoice_state = mock_get_invoice_state

async def process_overdue_invoices_filtered():
    db = SessionLocal()
    try:
        today = MockDate.today()

        # Only process invoices of clients starting with [BatchTest]
        newly_overdue = (
            db.query(models.Invoice)
            .join(models.Client)
            .filter(models.Client.id.in_(created_client_ids))
            .filter(models.Invoice.status == "Sent")
            .filter(models.Invoice.due_date < today)
            .all()
        )
        for inv in newly_overdue:
            inv.status = "Overdue"
        db.commit()

        # Run the agent pipeline only for overdue invoices of [BatchTest] clients
        overdue_invoices = (
            db.query(models.Invoice)
            .join(models.Client)
            .options(
                joinedload(models.Invoice.client),
                joinedload(models.Invoice.user),
                joinedload(models.Invoice.items),
            )
            .filter(models.Client.id.in_(created_client_ids))
            .filter(models.Invoice.status == "Overdue")
            .order_by(models.Invoice.due_date.asc())
            .all()
        )

        if not overdue_invoices:
            return

        for inv in overdue_invoices:
            try:
                await check_overdue.run_agent_pipeline_for_invoice(db, inv)
            except Exception as e:
                db.rollback()
                print(f"  -> Error processing invoice {inv.invoice_number}: {e}", file=sys.stderr)

    finally:
        db.close()

async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Run simulation batch.")
    parser.add_argument("--keep", action="store_true", help="Keep simulated records in the database.")
    parser.add_argument("--user-id", type=str, help="Associate simulated records with user UUID.")
    args, unknown = parser.parse_known_args()

    db = SessionLocal()
    
    # 1. Verify we have a User profile in public.profiles to associate with
    if args.user_id:
        try:
            from uuid import UUID
            user_uuid = UUID(args.user_id)
            user = db.query(models.User).filter(models.User.id == user_uuid).first()
            if not user:
                print(f"Error: User with ID {args.user_id} not found.")
                db.close()
                sys.exit(1)
        except ValueError:
            print(f"Error: Invalid UUID format for --user-id: {args.user_id}")
            db.close()
            sys.exit(1)
    else:
        user = db.query(models.User).first()
        if not user:
            print("Error: No user found in the database. Please run the server or sign up a user first.")
            db.close()
            sys.exit(1)
        
    print(f"Found active user profile: {user.name or 'Freelancer'} (ID: {user.id})")
    
    # 2. Cleanup any old batch test records
    print("Cleaning up old batch test data...")
    existing_clients = db.query(models.Client).filter(models.Client.email.like("batch_client_%@example.com")).all()
    for c in existing_clients:
        db.delete(c)
    db.commit()
    
    # 3. Load synthetic invoices template
    batch_json_path = os.path.join(script_dir, "synthetic_batch.json")
    if not os.path.exists(batch_json_path):
        print("Error: synthetic_batch.json not found. Run generate_batch.py first.")
        db.close()
        sys.exit(1)
        
    with open(batch_json_path, "r") as f:
        synthetic_invoices = json.load(f)
        
    print(f"Loaded {len(synthetic_invoices)} synthetic invoices from templates.")

    # Base date for simulation start
    base_date = date(2026, 8, 20)
    created_client_ids.clear()
    
    try:
        # 4. Insert clients & invoices
        print("Inserting batch test data into database...")
        for item in synthetic_invoices:
            # Create Client
            client_name = item["client_name"]
            client = models.Client(
                user_id=user.id,
                name=client_name,
                email=f"batch_client_{item['invoice_number']}@example.com",
                address="123 Batch Test Way",
            )
            db.add(client)
            db.flush()
            created_client_ids.append(client.id)
            
            # Calculate dates
            due_date = base_date + timedelta(days=item["due_date_offset"])
            issue_date = due_date - timedelta(days=15)
            
            # Create Invoice
            inv = models.Invoice(
                user_id=user.id,
                client_id=client.id,
                invoice_number=item["invoice_number"],
                issue_date=issue_date,
                due_date=due_date,
                status="Sent",
                subtotal=Decimal(str(item["amount"])) / Decimal("1.18"),
                gst_rate=Decimal("18.00"),
                gst_amount=Decimal(str(item["amount"])) - (Decimal(str(item["amount"])) / Decimal("1.18")),
                total_amount=Decimal(str(item["amount"])),
            )
            db.add(inv)
            db.flush()
            
            # Create Invoice Item
            item_obj = models.InvoiceItem(
                invoice_id=inv.id,
                description=item["description"],
                quantity=Decimal("1.00"),
                rate=inv.subtotal,
            )
            db.add(item_obj)
            
            # Seed initial contact history decisions if requested
            if item["initial_contact_count"] > 0:
                for idx in range(item["initial_contact_count"]):
                    dec = models.AgentDecision(
                        invoice_id=inv.id,
                        input_summary=f"days_overdue=0, amount={inv.total_amount}",
                        classification="forgot",
                        decided_action="send_reminder",
                        raw_llm_output="send_reminder"
                    )
                    db.add(dec)
            
            # Seed Promise if requested
            if item["has_promise"]:
                promise_date = base_date + timedelta(days=item["promise_offset"])
                p = models.Promise(
                    invoice_id=inv.id,
                    promised_date=promise_date,
                    resolved=item["promise_resolved"]
                )
                db.add(p)
                
            db.flush()
            
            # Save simulation state
            sim_states[client_name] = {
                "client_id": client.id,
                "invoice_id": inv.id,
                "invoice_number": item["invoice_number"],
                "behavior": item["behavior"],
                "amount": float(item["amount"]),
                "due_date_offset": item["due_date_offset"],
                "do_not_contact": item["do_not_contact"],
                "payment_failed_logged": False,
                "disputed_reply_received": False,
                "contact_count_sim": item["initial_contact_count"],
                "is_paid": False,
                "payment_date": None,
                "is_escalated": False,
                "escalation_reason": None,
            }
            
        db.commit()
        print("Database populated successfully.")
        
        # 5. Day-by-day Simulation Run
        # We start the calendar at Day -5 (relative to base_date) to allow pre-due flow,
        # then advance day-by-day to Day 30.
        start_day = -5
        end_day = 30
        
        print("\nStarting daily recovery agent simulation loop...\n")
        
        for day in range(start_day, end_day + 1):
            step_date = base_date + timedelta(days=day)
            MockDate._today = step_date
            
            print(f"--- [Simulation Calendar] Day {day:02d}: {step_date} ---")
            
            # A. Process any scheduled / pending events at start of day
            for client_name, sim in sim_states.items():
                if sim["is_paid"] or sim["is_escalated"]:
                    continue
                
                # Check if client payment is scheduled for today
                if sim.get("pending_payment_date") == step_date:
                    inv_db = db.query(models.Invoice).filter(models.Invoice.id == sim["invoice_id"]).first()
                    inv_db.status = "Paid"
                    
                    # Log Payment
                    payment = models.Payment(
                        invoice_id=sim["invoice_id"],
                        user_id=user.id,
                        razorpay_payment_id=f"pay_mock_{sim['invoice_number']}_{step_date.strftime('%Y%m%d')}",
                        amount_paid=Decimal(str(sim["amount"])),
                        paid_at=datetime.combine(step_date, datetime.min.time()),
                    )
                    db.add(payment)
                    db.commit()
                    
                    sim["is_paid"] = True
                    sim["payment_date"] = step_date
                    print(f"    [Simulation Event] Client {sim['invoice_number']} paid amount ₹{sim['amount']:,.2f}")
                    
                # Check if client dispute occurs today
                if sim.get("pending_dispute_date") == step_date:
                    sim["disputed_reply_received"] = True
                    print(f"    [Simulation Event] Client {sim['invoice_number']} replied disputing the invoice details.")
                    
                # Check if payment attempt failed today
                if sim.get("pending_payment_fail_date") == step_date:
                    sim["payment_failed_logged"] = True
                    print(f"    [Simulation Event] Client {sim['invoice_number']} tried paying but transaction bounced.")
            
            # B. Execute the agent overdue checker pipeline
            # This marks newly-overdue invoices and executes recovery actions
            await process_overdue_invoices_filtered()
            
            # C. Update simulation states based on decisions made today
            for client_name, sim in sim_states.items():
                if sim["is_paid"] or sim["is_escalated"]:
                    continue
                    
                # Query current status from db
                inv_db = db.query(models.Invoice).filter(models.Invoice.id == sim["invoice_id"]).first()
                if inv_db.status == "Paid":
                    sim["is_paid"] = True
                    continue
                    
                # Fetch latest decision for this invoice
                latest_dec = (
                    db.query(models.AgentDecision)
                    .filter(models.AgentDecision.invoice_id == sim["invoice_id"])
                    .order_by(models.AgentDecision.created_at.desc())
                    .first()
                )
                
                if latest_dec:
                    action = latest_dec.decided_action
                    
                    # Schedule client behaviors for next steps
                    if action == "send_reminder":
                        sim["contact_count_sim"] += 1
                        
                        if sim["behavior"] == "pays_after_reminder":
                            # Pay after 1 day
                            sim["pending_payment_date"] = step_date + timedelta(days=1)
                        elif sim["behavior"] == "disputes_after_reminder":
                            # Dispute after 1 day
                            sim["pending_dispute_date"] = step_date + timedelta(days=1)
                        elif sim["behavior"] in ("payment_fails_retry_succeeds", "payment_fails_retry_fails"):
                            # Payment failure after 1 day
                            sim["pending_payment_fail_date"] = step_date + timedelta(days=1)
                            
                    elif action == "retry_payment":
                        if sim["behavior"] == "payment_fails_retry_succeeds":
                            # Succeeds after 1 day
                            sim["pending_payment_date"] = step_date + timedelta(days=1)
                        elif sim["behavior"] == "payment_fails_retry_fails":
                            # Fails again after 1 day
                            sim["pending_payment_fail_date"] = step_date + timedelta(days=1)
                            
                    elif action in ("mark_disputed", "escalate_to_human"):
                        sim["is_escalated"] = True
                        sim["escalation_reason"] = latest_dec.classification or "Guardrail/Sanity Rule trigger"
                        print(f"    [Simulation Alert] Invoice {sim['invoice_number']} is escalated to a human. Reason: {sim['escalation_reason']}")
            
            print() # Spacer line
            
        # 6. Calculate batch metrics
        total_amount_recovered = sum(sim["amount"] for sim in sim_states.values() if sim["is_paid"])
        total_invoices = len(sim_states)
        recovered_count = sum(1 for sim in sim_states.values() if sim["is_paid"])
        recovery_rate = (recovered_count / total_invoices) * 100
        
        recovered_durations = []
        for sim in sim_states.values():
            if sim["is_paid"]:
                due_date = base_date + timedelta(days=sim["due_date_offset"])
                days = (sim["payment_date"] - due_date).days
                recovered_durations.append(days)
                
        avg_days_to_recovery = sum(recovered_durations) / len(recovered_durations) if recovered_durations else 0.0
        num_escalated = sum(1 for sim in sim_states.values() if sim["is_escalated"])
        
        print("\n" + "="*50)
        print("                BATCH METRICS SUMMARY")
        print("="*50)
        print(f"Amount Recovered:          ₹{total_amount_recovered:,.2f}")
        print(f"Recovery Rate:             {recovery_rate:.1f}% ({recovered_count}/{total_invoices} invoices)")
        print(f"Average Days to Recovery:  {avg_days_to_recovery:.1f} days")
        print(f"Number Escalated to Human: {num_escalated}")
        print("="*50 + "\n")
        
    finally:
        # 7. Clean up all created database test data unless --keep is specified
        if args.keep:
            print("\n[Keep Data Option] Skipping database cleanup. Invoices and clients remain in database.")
            db.close()
        else:
            print("Cleaning up database test data...")
            db_cleanup = SessionLocal()
            try:
                for client_id in created_client_ids:
                    client = db_cleanup.query(models.Client).filter(models.Client.id == client_id).first()
                    if client:
                        db_cleanup.delete(client)
                db_cleanup.commit()
                print("Successfully cleaned up all synthetic test data from database.")
            except Exception as e:
                print(f"Error during cleanup: {e}")
            finally:
                db_cleanup.close()
                db.close()

if __name__ == "__main__":
    asyncio.run(main())
