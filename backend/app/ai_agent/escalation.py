from enum import Enum


class EscalationStage(str, Enum):
    NOT_YET_DUE = "not_yet_due"
    GENTLE = "gentle"
    FIRM = "firm"
    FINAL = "final"
    HUMAN_HANDOFF = "human_handoff"


# Hardcoded thresholds, never LLM-decided
GENTLE_AT_DAYS = 1
FIRM_AT_DAYS = 7
FINAL_AT_DAYS = 14
HUMAN_HANDOFF_AT_DAYS = 21


def get_escalation_stage(days_overdue: int) -> str:
    """
    Deterministically maps days_overdue to a stage in the escalation ladder.
    Returns one of: not_yet_due, gentle, firm, final, human_handoff.
    """
    if days_overdue < GENTLE_AT_DAYS:
        return EscalationStage.NOT_YET_DUE.value
    if days_overdue < FIRM_AT_DAYS:
        return EscalationStage.GENTLE.value
    if days_overdue < FINAL_AT_DAYS:
        return EscalationStage.FIRM.value
    if days_overdue < HUMAN_HANDOFF_AT_DAYS:
        return EscalationStage.FINAL.value
    return EscalationStage.HUMAN_HANDOFF.value