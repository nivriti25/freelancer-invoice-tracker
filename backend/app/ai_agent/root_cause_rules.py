from app.ai_agent.actions import AgentAction

# Hardcoded mapping: classification -> action categories considered safe.
# This is a sanity check on top of the LLM's decision, not a replacement for it.
SAFE_ACTIONS_BY_CLASSIFICATION = {
    "forgot": {AgentAction.SEND_REMINDER.value, AgentAction.DO_NOTHING.value, AgentAction.ESCALATE_TO_HUMAN.value},
    "payment_failed": {AgentAction.RETRY_PAYMENT.value, AgentAction.ESCALATE_TO_HUMAN.value, AgentAction.DO_NOTHING.value},
    "disputed": {AgentAction.MARK_DISPUTED.value, AgentAction.ESCALATE_TO_HUMAN.value},
    "gone_silent": {AgentAction.SEND_REMINDER.value, AgentAction.ESCALATE_TO_HUMAN.value, AgentAction.DO_NOTHING.value},
}


def enforce_root_cause_rules(classification: str, llm_proposed_action: str) -> tuple[str, str | None]:
    """
    Sanity-checks the LLM's proposed action against a hardcoded mapping of
    which actions are ever appropriate for a given root cause.

    Returns (final_action, override_reason). override_reason is None if the
    LLM's proposed action was already safe for this classification.

    Notably: "disputed" invoices are NEVER allowed to receive send_reminder
    or retry_payment automatically, regardless of what the LLM decided.
    A disputed invoice always requires a human-appropriate action.
    """
    safe_actions = SAFE_ACTIONS_BY_CLASSIFICATION.get(classification)

    if safe_actions is None:
        # Unknown classification, fail safe to human review
        return AgentAction.ESCALATE_TO_HUMAN.value, f"Unrecognised classification '{classification}', deferring to human."

    if llm_proposed_action in safe_actions:
        return llm_proposed_action, None

    return (
        AgentAction.ESCALATE_TO_HUMAN.value,
        f"LLM proposed '{llm_proposed_action}' for classification '{classification}', which is not an approved action for this root cause. Deferred to human.",
    )