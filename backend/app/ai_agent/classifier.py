import os
import json
import hashlib
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

VALID_LABELS = {"forgot", "disputed", "payment_failed", "gone_silent"}

CACHE_PATH = os.path.join(os.path.dirname(__file__), "_classifier_cache.json")


def _load_cache() -> dict:
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH, "r") as f:
            return json.load(f)
    return {}


def _save_cache(cache: dict) -> None:
    with open(CACHE_PATH, "w") as f:
        json.dump(cache, f, indent=2)


def _cache_key(invoice: dict, history: list, reply: str | None) -> str:
    raw = json.dumps({"invoice": invoice, "history": history, "reply": reply}, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


def classify_cause(invoice: dict, history: list, reply: str | None = None) -> str:
    """
    invoice: dict with keys like amount, due_date, days_overdue, client_name
    history: list of past contact attempts, e.g. [{"date": "...", "type": "reminder_sent"}]
    reply: raw text of the client's latest reply, if any
    Returns one of: forgot, disputed, payment_failed, gone_silent
    """
    cache = _load_cache()
    key = _cache_key(invoice, history, reply)

    if key in cache:
        return cache[key]

    prompt = f"""You are classifying why an invoice is overdue. Choose exactly one label from this list, and output nothing else: forgot, disputed, payment_failed, gone_silent.

Invoice details:
{json.dumps(invoice, default=str)}

Contact history:
{json.dumps(history, default=str)}

Client's latest reply (if any):
{reply if reply else "No reply received."}

Rules:
- "disputed" means the client explicitly questions the invoice, amount, or work.
- "payment_failed" means a payment attempt was made but the transaction failed.
- "gone_silent" means multiple contacts were made with zero reply.
- "forgot" is the default when none of the above clearly apply.

Output only the single label word, nothing else."""

    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=prompt,
    )

    label = response.text.strip().lower()

    if label not in VALID_LABELS:
        label = "gone_silent"

    cache[key] = label
    _save_cache(cache)
    return label