#!/usr/bin/env python3
import json
import random
import os

def generate_batch():
    # Use a fixed seed for reproducibility
    random.seed(42)

    # Behavior choices:
    # 1. pays_after_reminder: forgot, pays on next step
    # 2. disputes: disputes on first contact, escalates to human
    # 3. goes_silent: never pays, escalates to human after contact cap
    # 4. payment_fails_retry_succeeds: payment failed, retry payment, paid
    # 5. payment_fails_retry_fails: payment failed, retry payment fails, escalates to human
    # 6. high_value: amount > 50000, escalates immediately
    # 7. do_not_contact: client/invoice flagged do-not-contact, escalates immediately
    # 8. unresolved_promise_future: active future promise, paused
    # 9. resolved_promise_future: resolved promise, normal flow (forgot -> pays)
    # 10. unresolved_promise_past: expired promise, normal flow (forgot -> pays)

    # We will generate 22 invoices with varied parameters
    behaviors = [
        # Normal reminders & recoveries
        ("pays_after_reminder", "Standard forgotten invoice recovered gentle reminder", 12000.0, -3, 0),
        ("pays_after_reminder", "Invoice recovered firm reminder", 8500.0, -8, 0),
        ("pays_after_reminder", "Invoice recovered final reminder", 15000.0, -15, 0),
        ("pays_after_reminder", "Forgotten invoice recovered gentle", 4500.0, -2, 0),
        ("pays_after_reminder", "Paid after firm reminder 2", 9000.0, -10, 0),
        
        # Silent clients
        ("goes_silent", "Client goes silent, escalates after 3 reminders", 11000.0, -4, 0),
        ("goes_silent", "Client goes silent, starts with 2 contacts", 13000.0, -3, 2),
        ("goes_silent", "Client goes silent, starts with 3 contacts", 7500.0, -2, 3),
        ("goes_silent", "Silent client 2", 5000.0, -5, 0),
        
        # Disputes
        ("disputes", "Disputed contract scope, immediate dispute", 16500.0, -5, 0),
        ("disputes_after_reminder", "Disputes after gentle reminder", 22000.0, -4, 0),
        
        # Payment failures
        ("payment_fails_retry_succeeds", "Transient card fail, retry succeeds", 25000.0, -2, 0),
        ("payment_fails_retry_succeeds", "Failed bank transfer, retry succeeds", 14500.0, -4, 0),
        ("payment_fails_retry_fails", "Persistent card fail, retry fails", 32000.0, -3, 0),
        
        # Guardrails
        ("high_value", "High value invoice (>50k)", 65000.0, -2, 0),
        ("high_value", "Another high value invoice", 85000.0, -5, 0),
        ("do_not_contact", "Do not contact client flag", 6000.0, -3, 0),
        
        # Promises
        ("unresolved_promise_future", "Active promise in future", 18000.0, -4, 0),
        ("resolved_promise_future", "Resolved promise in future", 20000.0, -3, 0),
        ("unresolved_promise_past", "Expired promise in past", 11500.0, -9, 0),
        
        # Extra cases to make 22
        ("pays_after_reminder", "Forgotten invoice recovered 5", 3500.0, -1, 0),
        ("goes_silent", "Silent client 3", 2800.0, -1, 0),
    ]

    indian_names = [
        "Aarav Sharma", "Aditi Rao", "Rohan Mehta", "Priyanka Patel", "Vikram Singh",
        "Ananya Iyer", "Arjun Nair", "Sneha Gupta", "Kabir Chatterjee", "Divya Reddy",
        "Rahul Verma", "Ishita Dutta", "Siddharth Malhotra", "Kavita Krishnan", "Manoj Bajpayee",
        "Neha Dhupia", "Sanjay Dutt", "Riya Sen", "Amit Trivedi", "Shalini Pandey",
        "Varun Dhawan", "Deepika Padukone"
    ]

    invoices = []
    for i, (behavior, desc, amount, due_offset, initial_contacts) in enumerate(behaviors, 1):
        inv_num = f"INV-BATCH-{i:03d}"
        client_name = indian_names[i - 1]
        
        # Base setup
        invoice = {
            "invoice_number": inv_num,
            "client_name": client_name,
            "description": desc,
            "amount": amount,
            "due_date_offset": due_offset,
            "behavior": behavior,
            "initial_contact_count": initial_contacts,
            "do_not_contact": (behavior == "do_not_contact"),
            "has_promise": None,
            "promise_offset": None,
            "promise_resolved": False
        }

        # Add promise configuration if relevant
        if behavior == "unresolved_promise_future":
            invoice["has_promise"] = "future_unresolved"
            invoice["promise_offset"] = 5  # Promise to pay 5 days after simulation starts
        elif behavior == "resolved_promise_future":
            invoice["has_promise"] = "future_resolved"
            invoice["promise_offset"] = 5
            invoice["promise_resolved"] = True
        elif behavior == "unresolved_promise_past":
            invoice["has_promise"] = "past_unresolved"
            invoice["promise_offset"] = -2  # Promised date was 2 days after simulation start, now expired since simulation is on day > 2

        invoices.append(invoice)

    # Save to file
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, "synthetic_batch.json")
    with open(output_path, "w") as f:
        json.dump(invoices, f, indent=2)
    
    print(f"Successfully generated {len(invoices)} synthetic invoices in '{output_path}'.")

if __name__ == "__main__":
    generate_batch()
