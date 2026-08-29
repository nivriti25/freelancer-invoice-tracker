from app.ai_agent.actions import AgentAction

# Hardcoded limits, never LLM-decided
MAX_AUTOMATED_CONTACTS = 3
HIGH_VALUE_THRESHOLD = 50000  # invoices above this amount (in rupees) always need human approval
HUMAN_HANDOFF_AFTER_ATTEMPTS = 3  # after this many automated attempts, stop auto-sending, wait for a human


def check_contact_cap(invoice_state: dict) -> str | None:
    """
    Returns a reason string if the contact cap is breached, else None.
    invoice_state must include 'contact_count'.
    """
    if invoice_state.get("contact_count", 0) >= MAX_AUTOMATED_CONTACTS:
        return f"Contact cap reached: {invoice_state['contact_count']} automated contacts already made (max {MAX_AUTOMATED_CONTACTS})."
    return None


def check_amount_threshold(invoice_state: dict) -> str | None:
    """
    Returns a reason string if the invoice amount requires human approval, else None.
    invoice_state must include 'amount'.
    """
    amount = invoice_state.get("amount", 0)
    if amount > HIGH_VALUE_THRESHOLD:
        return f"Amount ₹{amount:,.0f} exceeds the ₹{HIGH_VALUE_THRESHOLD:,.0f} threshold requiring human approval."
    return None


def check_do_not_contact(invoice_state: dict) -> str | None:
    """
    Returns a reason string if this client/invoice has a manual do-not-contact flag, else None.
    invoice_state must include 'do_not_contact' (bool).
    """
    if invoice_state.get("do_not_contact", False):
        return "Client or invoice is flagged do-not-contact."
    return None


def check_human_in_loop_gate(invoice_state: dict) -> str | None:
    """
    Returns a reason string if the invoice has hit the automated-attempt limit
    and must wait for human sign-off before any further action, else None.
    invoice_state must include 'contact_count'.
    """
    if invoice_state.get("contact_count", 0) >= HUMAN_HANDOFF_AFTER_ATTEMPTS:
        return f"{invoice_state['contact_count']} automated attempts made, human sign-off required before proceeding further."
    return None


def apply_guardrails(proposed_action: str, invoice_state: dict) -> tuple[str, str | None]:
    """
    Runs all guardrail checks in order against the LLM's proposed action.
    Returns (final_action, override_reason).
    override_reason is None if the proposed action was allowed through unchanged.

    Guardrails only block or downgrade actions that would contact the client
    (send_reminder, retry_payment). They never block escalate_to_human,
    mark_disputed, or do_nothing, since those are already safe or human-routed.
    """
    contacting_actions = {AgentAction.SEND_REMINDER.value, AgentAction.RETRY_PAYMENT.value}

    if proposed_action not in contacting_actions:
        return proposed_action, None

    checks = [
        check_do_not_contact,
        check_amount_threshold,
        check_human_in_loop_gate,
        check_contact_cap,
    ]

    for check in checks:
        reason = check(invoice_state)
        if reason:
            return AgentAction.ESCALATE_TO_HUMAN.value, reason

    return proposed_action, None