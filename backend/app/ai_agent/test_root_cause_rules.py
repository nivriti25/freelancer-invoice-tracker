from app.ai_agent.root_cause_rules import enforce_root_cause_rules

test_cases = [
    # 1: correct pairing, should pass through
    ("forgot", "send_reminder"),
    # 2: correct pairing, should pass through
    ("payment_failed", "retry_payment"),
    # 3: LLM mistakenly proposed send_reminder for a disputed invoice, must be blocked
    ("disputed", "send_reminder"),
    # 4: LLM mistakenly proposed retry_payment for a disputed invoice, must be blocked
    ("disputed", "retry_payment"),
    # 5: correct pairing, disputed -> mark_disputed
    ("disputed", "mark_disputed"),
    # 6: unrecognised classification entirely
    ("some_new_label", "send_reminder"),
]

for i, (classification, proposed) in enumerate(test_cases, 1):
    final_action, reason = enforce_root_cause_rules(classification, proposed)
    print(f"Test {i}: ({classification}, {proposed}) -> {final_action!r}, reason={reason!r}")