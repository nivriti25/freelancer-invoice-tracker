from app.ai_agent.guardrails import apply_guardrails

test_cases = [
    # 1: clean case, should pass through unchanged
    {"proposed": "send_reminder", "invoice_state": {"amount": 10000, "contact_count": 0, "do_not_contact": False}},
    # 2: contact cap breached
    {"proposed": "send_reminder", "invoice_state": {"amount": 10000, "contact_count": 3, "do_not_contact": False}},
    # 3: amount over threshold
    {"proposed": "retry_payment", "invoice_state": {"amount": 75000, "contact_count": 1, "do_not_contact": False}},
    # 4: do-not-contact flag set
    {"proposed": "send_reminder", "invoice_state": {"amount": 5000, "contact_count": 0, "do_not_contact": True}},
    # 5: escalate_to_human should never be touched by guardrails
    {"proposed": "escalate_to_human", "invoice_state": {"amount": 100000, "contact_count": 5, "do_not_contact": True}},
    # 6: mark_disputed should never be touched either
    {"proposed": "mark_disputed", "invoice_state": {"amount": 100000, "contact_count": 5, "do_not_contact": False}},
]

for i, case in enumerate(test_cases, 1):
    final_action, reason = apply_guardrails(case["proposed"], case["invoice_state"])
    print(f"Test {i}: proposed={case['proposed']!r} -> final={final_action!r}, reason={reason!r}")

    