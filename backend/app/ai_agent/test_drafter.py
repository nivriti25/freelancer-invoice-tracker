from app.ai_agent.email_drafter import draft_reminder_body
import time

test_cases = [
    {"invoice_state": {"client_name": "Acme Co", "days_overdue": 3, "contact_count": 0}, "classification": "forgot", "escalation_stage": "gentle"},
    {"invoice_state": {"client_name": "Gamma Inc", "days_overdue": 14, "contact_count": 2}, "classification": "gone_silent", "escalation_stage": "firm"},
    {"invoice_state": {"client_name": "Delta LLC", "days_overdue": 21, "contact_count": 3}, "classification": "gone_silent", "escalation_stage": "final"},
]

for i, case in enumerate(test_cases, 1):
    result = draft_reminder_body(case["invoice_state"], case["classification"], case["escalation_stage"])
    print(f"--- Test {i} ({case['escalation_stage']}) ---")
    print(result)
    print()
    time.sleep(15)