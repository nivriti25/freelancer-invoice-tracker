import os
import json
import hashlib
from datetime import date
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

VALID_INTENTS = {"promise_to_pay", "dispute", "question", "already_paid", "other"}

CACHE_PATH = os.path.join(os.path.dirname(__file__), "_reply_parser_cache.json")


def _load_cache() -> dict:
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH, "r") as f:
            return json.load(f)
    return {}


def _save_cache(cache: dict) -> None:
    with open(CACHE_PATH, "w") as f:
        json.dump(cache, f, indent=2)


def _cache_key(reply_text: str, today: str) -> str:
    raw = json.dumps({"reply_text": reply_text, "today": today}, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()


def parse_reply(reply_text: str, today: date | None = None) -> dict:
    """
    reply_text: the raw text body of the client's email reply
    today: override for testing; defaults to the real current date

    Returns a dict:
    {
        "intent": one of promise_to_pay, dispute, question, already_paid, other,
        "promised_date": "YYYY-MM-DD" string or None,
        "summary": one-sentence plain-English summary of what the client said
    }
    """
    if today is None:
        today = date.today()
    today_str = today.isoformat()

    cache = _load_cache()
    key = _cache_key(reply_text, today_str)
    if key in cache:
        return cache[key]

    prompt = f"""Today's date is {today_str}. Read the client's email reply below and extract structured information.

Client's reply:
\"\"\"{reply_text}\"\"\"

Classify the intent as exactly one of: promise_to_pay, dispute, question, already_paid, other.
- "promise_to_pay" means the client commits to paying by some date, even a vague one.
- "dispute" means the client questions the invoice, an amount, or the work itself.
- "already_paid" means the client claims they have already paid.
- "question" means the client is asking something without disputing or promising.
- "other" is anything that doesn't clearly fit the above.

If the intent is promise_to_pay, resolve any date mentioned (e.g. "the 15th", "next Friday", "in a week") into an absolute date in YYYY-MM-DD format, using today's date as the reference point. If no clear date is mentioned, or the intent is not promise_to_pay, use null.

Respond with ONLY a JSON object in exactly this shape, no other text, no markdown formatting:
{{"intent": "...", "promised_date": "YYYY-MM-DD or null", "summary": "one sentence summary"}}"""

    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=prompt,
    )

    raw_output = response.text.strip()
    # Strip markdown code fences if the model added them despite instructions
    if raw_output.startswith("```"):
        raw_output = raw_output.strip("`")
        if raw_output.startswith("json"):
            raw_output = raw_output[4:].strip()

    try:
        parsed = json.loads(raw_output)
        intent = parsed.get("intent", "other")
        promised_date = parsed.get("promised_date")
        summary = parsed.get("summary", "")
    except (json.JSONDecodeError, AttributeError):
        # Fail safe: if the model didn't return valid JSON, treat as unparseable
        intent, promised_date, summary = "other", None, "Could not parse the reply automatically."

    if intent not in VALID_INTENTS:
        intent = "other"

    if promised_date in (None, "null", ""):
        promised_date = None
    else:
        # Validate it's a real, parseable date, don't trust the string blindly
        try:
            date.fromisoformat(promised_date)
        except (ValueError, TypeError):
            promised_date = None

    result = {"intent": intent, "promised_date": promised_date, "summary": summary}

    cache[key] = result
    _save_cache(cache)
    return result