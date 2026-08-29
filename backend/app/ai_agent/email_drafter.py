import os
import json
import hashlib
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

VALID_STAGES = {"gentle", "firm", "final"}

CACHE_PATH = os.path.join(os.path.dirname(__file__), "_drafter_cache.json")


def _load_cache() -> dict:
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH, "r") as f:
            return json.load(f)
    return {}


def _save_cache(cache: dict) -> None:
    with open(CACHE_PATH, "w") as f:
        json.dump(cache, f, indent=2)


def _cache_key(invoice_state: dict, classification: str, escalation_stage: str) -> str:
    raw = json.dumps(
        {"invoice_state": invoice_state, "classification": classification, "stage": escalation_stage},
        sort_keys=True, default=str,
    )
    return hashlib.sha256(raw.encode()).hexdigest()


def draft_reminder_body(invoice_state: dict, classification: str, escalation_stage: str) -> str:
    """
    invoice_state: dict with keys like client_name, days_overdue, contact_count
    classification: one of forgot, disputed, payment_failed, gone_silent
    escalation_stage: one of gentle, firm, final
    Returns: a short plain-text paragraph (2-4 sentences), to be inserted into
             the existing HTML template's body_paragraph slot. Never includes
             specific amounts, dates, or links, those are rendered separately
             from real invoice data.
    """
    if escalation_stage not in VALID_STAGES:
        escalation_stage = "gentle"  # fail safe to the least aggressive tone

    cache = _load_cache()
    key = _cache_key(invoice_state, classification, escalation_stage)

    if key in cache:
        return cache[key]

    stage_guidance = {
        "gentle": "This is a first, friendly reminder. Assume the client simply forgot. Warm, low-pressure tone.",
        "firm": "This is a follow-up after at least one prior reminder went unanswered. Polite but noticeably firmer, convey urgency without being aggressive.",
        "final": "This is a final notice before the matter is escalated. Direct, serious, and clear that this is the last automated reminder, but still professional and courteous.",
    }[escalation_stage]

    prompt = f"""Write a short email body paragraph (2 to 4 sentences) for an overdue invoice reminder.

Context:
- Reason the invoice is overdue: {classification}
- Escalation stage: {escalation_stage}. {stage_guidance}
- Client and invoice state: {json.dumps(invoice_state, default=str)}

Strict rules:
- Do NOT mention any specific amount, currency figure, due date, or payment link. Those are inserted separately by the system.
- Do NOT invent any facts, dates, or commitments not given above.
- Do NOT include a greeting like "Hi [name]" or a sign-off, only the body paragraph itself.
- Write in plain text, no HTML tags, no markdown.
- Keep it professional and human-sounding, not robotic.

Output only the paragraph text, nothing else."""

    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=prompt,
    )

    body = response.text.strip()

    cache[key] = body
    _save_cache(cache)
    return body