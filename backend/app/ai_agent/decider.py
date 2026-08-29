import os
import json
import hashlib
from dotenv import load_dotenv
from google import genai
from app.ai_agent.actions import AgentAction

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

VALID_ACTIONS = {action.value for action in AgentAction}

CACHE_PATH = os.path.join(os.path.dirname(__file__), "_decider_cache.json")


def _load_cache() -> dict:
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH, "r") as f:
            return json.load(f)
    return {}


def _save_cache(cache: dict) -> None:
    with open(CACHE_PATH, "w") as f:
        json.dump(cache, f, indent=2)


def _cache_key(classification: str, invoice_state: dict) -> str:
    raw = json.dumps({"classification": classification, "invoice_state": invoice_state}, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


def decide_action(classification: str, invoice_state: dict) -> str:
    """
    classification: one of forgot, disputed, payment_failed, gone_silent (from classify_cause)
    invoice_state: dict with keys like amount, days_overdue, contact_count, client_name
    Returns one of: send_reminder, retry_payment, escalate_to_human, mark_disputed, do_nothing
    """
    cache = _load_cache()
    key = _cache_key(classification, invoice_state)

    if key in cache:
        return cache[key]

    prompt = f"""You are deciding what action to take on an overdue invoice. Choose exactly one action from this list, and output nothing else: send_reminder, retry_payment, escalate_to_human, mark_disputed, do_nothing.

Classification of why it's overdue: {classification}

Invoice state:
{json.dumps(invoice_state, default=str)}

Guidance:
- "forgot" usually means send_reminder.
- "payment_failed" usually means retry_payment.
- "disputed" usually means mark_disputed, since a human should review disputes, not an automated system.
- "gone_silent" usually means escalate_to_human if multiple contacts have already failed, otherwise send_reminder.
- If the invoice is already resolved or no further action makes sense, use do_nothing.

Output only the single action word, nothing else."""

    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=prompt,
    )

    action = response.text.strip().lower()

    if action not in VALID_ACTIONS:
        # Fail safe: an invalid or unrecognised action always defers to a human
        action = AgentAction.ESCALATE_TO_HUMAN.value

    cache[key] = action
    _save_cache(cache)
    return action