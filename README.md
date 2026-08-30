# Ledgr — AI Revenue Recovery Agent

Ledgr is a freelancer invoice tracker built into an AI agent that chases overdue B2B payments, so you don't have to. It classifies why an invoice is overdue, decides the right next step, and acts within hardcoded guardrails, logging every decision it makes along the way.

Built for Indian freelancers. Razorpay-powered, GST-aware.

## The problem

Revenue loss for freelancers rarely happens in one clean step. A payment fails, a client forgets, a client disputes the amount, or a client just goes silent. Chasing each of these manually, invoice by invoice, is repetitive and easy to fall behind on. Ledgr's agent takes over that chase while keeping a human in the loop for anything that actually needs judgement.

## What the agent does

For every overdue invoice, the agent runs a fixed pipeline:

1. **Classify** why payment hasn't happened: forgot, disputed, payment failed, or gone silent.
2. **Decide** the next action from a fixed list: send reminder, retry payment, escalate to human, mark disputed, or do nothing.
3. **Check guardrails** in plain code, not AI, before anything is sent.
4. **Act**: send an AI-drafted email, retry a failed payment, or stop and hand off to you.
5. **Log** the decision, so every action has a visible reason attached to it.

The agent decides what to say and when to nudge. It never decides when to stop contacting someone. Stopping rules, contact caps, and amount thresholds stay as plain, auditable code.

## Features
* **Escalation ladder**: gentle reminder → firmer follow-up → final notice → human handoff, based on days overdue.
* **Root-cause-aware intervention**: a failed payment gets a retry link, a dispute gets a human, silence gets a nudge.
* **Promise-to-pay tracking**: if a client commits to a date, escalation pauses until that date passes.
* **Guardrails**: contact caps, an amount threshold above which a human must approve, and a do-not-contact flag per client or invoice.
* **Audit trail**: every classification, decision, and override is logged with a timestamp and reason, visible in the dashboard, not buried in backend logs.

## Measured results: a 22-invoice batch

`backend/run_batch.py` runs 22 synthetic overdue invoices (`backend/synthetic_batch.json`) covering every client behavior — pays after a reminder, goes silent, disputes, payment fails and retries, high-value, do-not-contact — through a day-by-day simulated calendar. Only the LLM calls and outbound sending are mocked; the guardrails, escalation ladder, and decision logger are the real code in `app/ai_agent/`. Reproduce with:

```bash
cd backend
python run_batch.py --keep   # --keep leaves the batch's rows in the DB for inspection
```

**Summary**

| Metric | Value |
| :--- | ---: |
| Amount recovered | ₹92,000.00 |
| Recovery rate | 36.4% (8 / 22 invoices) |
| Average days to recovery | 4.1 days |
| Escalated to a human | 13 / 22 invoices |
| Still in progress at cutoff | 1 / 22 invoices |
| Decisions logged | 472 |
| Guardrail overrides logged | 181 (6 distinct invoice/reason cases) |

**Money recovered**

| Invoice | Amount | Days to pay |
| :--- | ---: | ---: |
| INV-BATCH-002 | ₹8,500 | -4 |
| INV-BATCH-003 | ₹15,000 | -4 |
| INV-BATCH-005 | ₹9,000 | -4 |
| INV-BATCH-001 | ₹12,000 | -1 |
| INV-BATCH-013 | ₹14,500 | -1 |
| INV-BATCH-004 | ₹4,500 | 0 |
| INV-BATCH-012 | ₹25,000 | +1 |
| INV-BATCH-021 | ₹3,500 | +1 |
| **Total** | **₹92,000** | |

**Compliant escalation & stopping rules**

| Invoice(s) | Trigger | Rule enforced |
| :--- | :--- | :--- |
| INV-BATCH-015 (₹65,000), INV-BATCH-016 (₹85,000) | Amount over ₹50,000 | Amount threshold: routed to a human, never an AI judgment call |
| INV-BATCH-017 | Do-not-contact flag | Never contact a flagged client or invoice |
| INV-BATCH-018, 019, 020 | 3 automated contacts already made | Contact cap: stop nudging, wait for human sign-off |
| INV-BATCH-006, 007, 008, 009, 022 | Classified `gone_silent` after 3+ unanswered reminders | Routed to `escalate_to_human` instead of a 4th reminder |
| INV-BATCH-010, 011 | Classified `disputed` | Always routed to `mark_disputed` for a human, never auto-resolved |
| INV-BATCH-014 | Persistent payment failure, still mid-retry | Left in progress rather than forced to a result at cutoff |

**Audit trail**

| Table | Row count | Records |
| :--- | ---: | :--- |
| `payments` | 8 | Amount, invoice, payment ID, timestamp |
| `agent_decisions` | 472 | Classification, proposed action, final action, timestamp |
| `guardrail_overrides` | 181 | Proposed action → final action, with the exact override reason |

Every figure above is a direct aggregation of these three tables — nothing is summarized after the fact — and the same tables back the dashboard's decision log.

## Screenshots

### Sign in
The agent's status is visible from the moment you log in.

![Sign in](docs/images/sign_in.png)

### Today
Your daily summary: what's outstanding, what's overdue, and what the agent is already handling.

![Today](docs/images/today.png)

### Needs you
The agent stops here on purpose. These are the invoices it won't touch without your sign-off, disputes, amounts over the threshold, and clients gone silent.

![Needs you](docs/images/needs_you.png)

### Invoices
Every invoice, worst first, with its current status and what the agent last did about it.

![Invoices](docs/images/invoices.png)

### Clients
A running record of who pays, how much they've been billed, and their current status.

![Clients](docs/images/clients.png)

### Agent controls
Toggle what the agent may do on its own. Anything switched off comes back to you as a manual decision instead.

![Agent controls](docs/images/agent_controls.png)

### Decision log
A full, timestamped history of every action the agent has taken and every guardrail override, with the reason attached.

![Decision log](docs/images/decision_log.png)

### Settings
Business and bank details used to generate invoice PDFs and payment links.

![Settings](docs/images/settings.png)

## Sample emails

The agent drafts reminder emails itself, adjusting tone as an invoice moves up the escalation ladder.

### Stage 1: Gentle reminder
![Stage 1: Gentle reminder](docs/images/email_stage_1.png)

### Stage 2: Firmer follow-up
![Stage 2: Firmer follow-up](docs/images/email_stage_2.png)

### Stage 3: Final notice
![Stage 3: Final notice](docs/images/email_stage_3.png)

## Tech stack
* **Backend**: FastAPI (Python)
* **Database**: PostgreSQL via SQLAlchemy
* **Payments**: Razorpay
* **AI**: Anthropic API
* **Frontend**: React (Vite) + Tailwind CSS

## Setup

```bash
# Clone the repo
git clone <your-repo-url>
cd ledgr

# Backend
cd backend
pip install -r requirements.txt
# add your Anthropic API key and database URL to .env
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```
