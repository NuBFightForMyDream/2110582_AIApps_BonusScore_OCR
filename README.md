# 2110582_AIApps_BonusScore_OCRPlatform
Project Repo for 2110582 AI Apps by 6730084521 Chatrphol and 6733092021 Thanabodee

## FlowLedger — AI order-to-cash demo

**Live site: https://flowledger-fridge-demo.fly.dev**

A class project for **AI and LS**, by Chatrphol (6730084521) and Thanabodee (6733092021).

FlowLedger is the back office of a fridge distributor. It walks a customer's order
from the invoice to a paid invoice in the customer's inbox. AI reads, checks and
matches; people step in only for flagged data, restocking, signatures and payments.

> **Demo mode.** Every service is mocked in the browser: S3, Postgres, OCR, LLM,
> the order agent, the Bank API and Gmail. Nothing leaves the page and no email is sent.

### Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

Press **Guided demo** for a step-by-step walkthrough. A bar at the bottom explains each
step and waits for you: press its button to run the step, or click the real button in the
step card yourself. Or add invoices from the left panel and work through them freely.

### Deploy (Fly.io)

The app builds to static files (`output: "export"`) served by nginx. Config is in
`fly.toml`, `Dockerfile` and `nginx.conf`. The machine sleeps when idle and wakes on
the next visit, so the first load after a quiet period takes a few seconds.

```bash
fly auth login
fly deploy --remote-only --ha=false
```

### The pipeline

| # | Stage | Who | What happens |
|---|-------|-----|--------------|
| 1 | Intake | System | Paper invoice scanned/uploaded, or e-invoices fetched |
| 2 | Store | System | Raw file → S3, record → Postgres |
| 3 | Extract & validate | AI + Human | Local OCR (paper) or XML parse, LLM checks fields, a person fixes flagged fields (e.g. a misread Tax ID), saved via `POST /api/invoices` |
| 4 | Check stock | System + Human | Order lines checked against the stock table; if short, a person approves a supplier PO or production order |
| 5 | Agentic decision | AI | Agent calls `get_customer`, `check_credit`, `match_prices`, `reserve_stock`, `decide` |
| 6 | Fulfil | System + Human + AI | Invoice created, delivery dispatched, customer signs, AI verifies the delivery photo |
| 7 | Settle | Human + AI + System | Staff accepts payment, AI matches it in the bank feed, stock and DB updated |
| 8 | Gmail invoice | Gmail | Paid invoice emailed to the customer |

Stage 7 writes back to the same stock table stage 4 reads, which closes the loop.

### Code map

- `lib/actions.ts` — the mock services; one function per pipeline step
- `lib/guide.ts` — the step-by-step guided demo
- `lib/store.ts` — in-browser state (a small external store read with `useSyncExternalStore`)
- `lib/data.ts` — fridge catalog, customers, statuses, stages, starting stock and bank feed
- `components/` — UI: invoice queue, stage rail, next-step card, record, document, side panel

Built with Next.js 16, React 19 and TypeScript. No backend and no API keys.
