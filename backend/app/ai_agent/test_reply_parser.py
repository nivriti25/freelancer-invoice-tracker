from datetime import date
import time
from app.ai_agent.reply_parser import parse_reply

fixed_today = date(2026, 8, 29)

test_cases = [
    "I received the reminder, but the invoice includes a charge we never agreed to. Please explain.",
    "Sorry for the delay, I will pay by the 15th.",
    "I already paid this last week, please check your records.",
    "What's the total amount due again? I lost the original invoice.",
    "this is a test email. i will send it by 15th",
    "Thanks for reaching out. Let me get back to you.",
]

for i, reply in enumerate(test_cases, 1):
    result = parse_reply(reply, today=fixed_today)
    print(f"Test {i}: {result}")
    time.sleep(15)