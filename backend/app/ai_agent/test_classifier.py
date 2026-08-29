from app.ai_agent.classifier import classify_cause
import time

test_cases = [
    {
        "invoice": {"amount": 15000, "days_overdue": 3, "client_name": "Acme Co"},
        "history": [],
        "reply": None,
    },
    {
        "invoice": {"amount": 40000, "days_overdue": 10, "client_name": "Beta Ltd"},
        "history": [{"date": "2026-08-15", "type": "reminder_sent"}],
        "reply": "This invoice includes a charge we never agreed to. Please explain.",
    },
    {
        "invoice": {"amount": 8000, "days_overdue": 20, "client_name": "Gamma Inc"},
        "history": [
            {"date": "2026-08-01", "type": "reminder_sent"},
            {"date": "2026-08-08", "type": "reminder_sent"},
            {"date": "2026-08-15", "type": "reminder_sent"},
        ],
        "reply": None,
    },
    {
        "invoice": {"amount": 22000, "days_overdue": 5, "client_name": "Delta LLC"},
        "history": [{"date": "2026-08-20", "type": "payment_attempted"}],
        "reply": "I tried paying but the transaction bounced, will retry.",
    },
]

for i, case in enumerate(test_cases, 1):
    result = classify_cause(case["invoice"], case["history"], case["reply"])
    print(f"Test {i}: {result}")
    time.sleep(15)


    