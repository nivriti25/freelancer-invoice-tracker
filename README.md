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

Talk is cheap, so here's a run, not a claim. `backend/run_batch.py` seeds 22 synthetic overdue invoices (`backend/synthetic_batch.json`) with different client behaviors — pays after a reminder, goes silent, disputes, payment fails and retries, high-value, do-not-contact — then advances a mocked calendar day by day from 5 days before the batch starts through 30 days out. Only the LLM calls (classification, email drafting) and email/payment sending are mocked; the guardrail checks, escalation ladder, decision logger, and database writes are the real production code in `app/ai_agent/`. Reproduce it yourself with:

```bash
cd backend
python run_batch.py --keep   # --keep leaves the batch's rows in the DB for inspection
```

Results from a run against this batch:

| Metric | Result |
| :--- | :--- |
| Amount recovered | ₹92,000.00 |
| Recovery rate | 36.4% (8 of 22 invoices) |
| Average days to recovery (from due date) | 4.1 days |
| Escalated to a human | 13 of 22 invoices |
| Decisions logged | 472 |
| Guardrail overrides logged | 181 (6 distinct invoice/reason cases) |

**Money recovered, invoice by invoice:**

| Invoice | Amount | Paid |
| :--- | ---: | :--- |
| INV-BATCH-002 | ₹8,500 | Day -4 |
| INV-BATCH-003 | ₹15,000 | Day -4 |
| INV-BATCH-005 | ₹9,000 | Day -4 |
| INV-BATCH-001 | ₹12,000 | Day -1 |
| INV-BATCH-013 | ₹14,500 | Day -1 |
| INV-BATCH-004 | ₹4,500 | Day 0 |
| INV-BATCH-012 | ₹25,000 | Day +1 |
| INV-BATCH-021 | ₹3,500 | Day +1 |

**Compliant escalation and stopping rules — every case the agent refused to act on its own, and why:**

| Invoice | Guardrail triggered | Stopping rule |
| :--- | :--- | :--- |
| INV-BATCH-015 (₹65,000) | Amount exceeds ₹50,000 threshold | Always route above-threshold invoices to a human, never an AI judgment call |
| INV-BATCH-016 (₹85,000) | Amount exceeds ₹50,000 threshold | Same amount-threshold rule |
| INV-BATCH-017 | Do-not-contact flag set | Never contact a flagged client or invoice, no exceptions |
| INV-BATCH-018 | 3 automated contacts already made | Human-in-the-loop gate: stop nudging, wait for sign-off |
| INV-BATCH-019 | 3 automated contacts already made | Same contact-cap rule |
| INV-BATCH-020 | 3 automated contacts already made | Same contact-cap rule |
| INV-BATCH-006, 007, 008, 009, 022 | Classified `gone_silent`, 3+ reminders sent with no reply | Decider routes to `escalate_to_human` instead of a 4th reminder |
| INV-BATCH-010, 011 | Classified `disputed` | Disputes always go to `mark_disputed` for a human, never auto-resolved |

One invoice (INV-BATCH-014, persistent card failure) was still mid-retry with no escalation and no payment when the 30-day window closed — left as-is rather than forced to a result, since that's what the pipeline would actually do.

**Audit trail:** every one of the 472 decisions above is a row in `agent_decisions` (classification, proposed action, final action, and the input summary that drove it), and every guardrail override is a separate row in `guardrail_overrides` (proposed action → final action → the exact reason string). Nothing here is summarized after the fact — the metrics table is a direct aggregation of `payments`, `agent_decisions`, and `guardrail_overrides` rows written during the run, and the same tables back the dashboard's decision log.

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
