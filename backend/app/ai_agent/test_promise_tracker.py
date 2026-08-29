from datetime import date
from app.ai_agent.promise_tracker import should_pause_escalation

fixed_today = date(2026, 8, 29)  # matches today's real date, for reproducible testing

test_cases = [
    # 1: no promises at all, should not pause
    {"promises": [], "expected": "no pause"},
    # 2: active promise, future date, unresolved
    {"promises": [{"promised_date": date(2026, 9, 5), "resolved": False}], "expected": "pause"},
    # 3: promise date already passed, unresolved, should have expired
    {"promises": [{"promised_date": date(2026, 8, 1), "resolved": False}], "expected": "no pause"},
    # 4: promise resolved (client paid), should not pause even if date is future
    {"promises": [{"promised_date": date(2026, 9, 10), "resolved": True}], "expected": "no pause"},
    # 5: promised_date is exactly today, should still count as active
    {"promises": [{"promised_date": date(2026, 8, 29), "resolved": False}], "expected": "pause"},
]

for i, case in enumerate(test_cases, 1):
    reason = should_pause_escalation({}, case["promises"], today=fixed_today)
    outcome = "pause" if reason else "no pause"
    match = "OK" if outcome == case["expected"] else "MISMATCH"
    print(f"Test {i}: {outcome} ({match}) - reason={reason!r}")