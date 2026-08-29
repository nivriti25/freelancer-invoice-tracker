from enum import Enum

class AgentAction(str, Enum):
    SEND_REMINDER = "send_reminder"
    RETRY_PAYMENT = "retry_payment"
    ESCALATE_TO_HUMAN = "escalate_to_human"
    MARK_DISPUTED = "mark_disputed"
    DO_NOTHING = "do_nothing"