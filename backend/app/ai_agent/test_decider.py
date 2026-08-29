from app.ai_agent.decider import decide_action
import time

test_cases = [
    {"classification": "forgot", "invoice_state": {"amount": 15000, "days_overdue": 3, "contact_count": 0}},
    {"classification": "payment_failed", "invoice_state": {"amount": 22000, "days_overdue": 5, "contact_count": 1}},
    {"classification": "disputed", "invoice_state": {"amount": 40000, "days_overdue": 10, "contact_count": 1}},
    {"classification": "gone_silent", "invoice_state": {"amount": 8000, "days_overdue": 20, "contact_count": 3}},
    {"classification": "gone_silent", "invoice_state": {"amount": 8000, "days_overdue": 4, "contact_count": 0}},
    {"classification": "unknown_garbage_label", "invoice_state": {"amount": 5000, "days_overdue": 2, "contact_count": 0}},
]

for i, case in enumerate(test_cases, 1):
    result = decide_action(case["classification"], case["invoice_state"])
    print(f"Test {i}: {result}")
    time.sleep(15)