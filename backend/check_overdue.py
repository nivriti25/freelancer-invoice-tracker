#!/usr/bin/env python
import os
import sys
from datetime import date

# Add the directory containing this script to the Python path
# to allow importing from the 'app' package.
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(script_dir)

from dotenv import load_dotenv
# Load environment variables
load_dotenv(os.path.join(script_dir, ".env"))

# Clean environment variables of any accidental leading/trailing whitespace or newlines
for key in ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_KEY", "RESEND_API_KEY", "EMAIL_FROM"]:
    if key in os.environ:
        os.environ[key] = os.environ[key].strip()

import asyncio
from sqlalchemy.orm import joinedload
from app.database import SessionLocal
from app.models import Invoice, Client
from app.utils.email import send_invoice_email

async def process_overdue_invoices():
    """
    Queries the database for invoices that are in 'Sent' status
    and have a due date prior to today. Converts their status to 'Overdue'
    and triggers a reminder email to the corresponding client.
    """
    db = SessionLocal()
    try:
        today = date.today()
        # Query invoices with status 'Sent' and due_date < today
        # Eagerly load client, user, and items for the email sender helper
        overdue_invoices = (
            db.query(Invoice)
            .options(
                joinedload(Invoice.client),
                joinedload(Invoice.user),
                joinedload(Invoice.items)
            )
            .filter(Invoice.status == "Sent")
            .filter(Invoice.due_date < today)
            .order_by(Invoice.due_date.asc())
            .all()
        )
        
        if not overdue_invoices:
            print("No overdue invoices found in 'Sent' status.")
            return

        print(f"\nFound {len(overdue_invoices)} overdue invoice(s) sitting at 'Sent'.")
        print("Processing updates and sending reminder emails...\n")
        
        for inv in overdue_invoices:
            client_name = inv.client.name if inv.client else "Unknown Client"
            print(f"Processing Invoice {inv.invoice_number} (Client: {client_name}, Due Date: {inv.due_date})")
            
            try:
                # Validate client email
                if not inv.client or not inv.client.email:
                    print(f"  -> Warning: Client '{client_name}' has no email address. Skipping email, but updating status.")
                else:
                    print(f"  -> Sending reminder email to {inv.client.email}...")
                    # Trigger the overdue email notification
                    await send_invoice_email(
                        invoice=inv,
                        client=inv.client,
                        user=inv.user,
                        items=inv.items,
                        bank_details=inv.user.bank_details if inv.user else None,
                        email_mode="Overdue"
                    )
                    print(f"  -> Email dispatched successfully.")

                # Update status in the database
                inv.status = "Overdue"
                db.commit()
                print(f"  -> Status updated to 'Overdue' successfully.\n")

            except Exception as e:
                db.rollback()
                print(f"  -> Error processing invoice {inv.invoice_number}: {e}\n", file=sys.stderr)
                
    finally:
        db.close()

async def main():
    print(f"Checking for overdue invoices in 'Sent' status (Today's date: {date.today()})...")
    try:
        await process_overdue_invoices()
    except Exception as e:
        print(f"Fatal error running utility: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
