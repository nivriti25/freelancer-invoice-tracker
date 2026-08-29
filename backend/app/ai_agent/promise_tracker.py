from datetime import date


def is_under_active_promise(promises: list[dict], today: date | None = None) -> tuple[bool, dict | None]:
    """
    promises: list of dicts representing this invoice's Promise rows, each with
              keys 'promised_date' (date) and 'resolved' (bool).
    today: override for testing; defaults to the real current date.
    Returns (is_active, active_promise) where active_promise is the relevant
    promise dict if one is active, else None.

    An invoice is under an active promise if it has at least one unresolved
    promise whose promised_date has not yet passed. Once the promised_date
    passes without being marked resolved, the promise expires and no longer
    blocks escalation, since the client failed to honour it.
    """
    if today is None:
        today = date.today()

    for promise in promises:
        if not promise.get("resolved", False) and promise["promised_date"] >= today:
            return True, promise

    return False, None


def should_pause_escalation(invoice_state: dict, promises: list[dict], today: date | None = None) -> str | None:
    """
    Convenience wrapper matching the guardrail style from Task 3.1.
    Returns a reason string if escalation should pause for this invoice, else None.
    """
    active, promise = is_under_active_promise(promises, today)
    if active:
        return f"Client has an active promise to pay by {promise['promised_date']}, escalation paused until then."
    return None