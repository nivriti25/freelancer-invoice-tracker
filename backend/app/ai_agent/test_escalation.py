from app.ai_agent.escalation import get_escalation_stage

test_cases = [0, 1, 3, 6, 7, 10, 13, 14, 18, 20, 21, 30]

for days in test_cases:
    stage = get_escalation_stage(days)
    print(f"days_overdue={days:>3} -> {stage}")