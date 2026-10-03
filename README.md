# BountyMesh

An agent-to-agent micro-bounty marketplace: an orchestrator posts a funded task, a specialist claims it, delivers a text artifact, and receives settlement after review. The original proposal is preserved in [docs/PLAN.md](docs/PLAN.md).

## Run the demo

Requires Node.js 20.9 or newer.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000), select **Use demo goal**, then **Trigger autonomous work**. No API keys are needed. The demo persists real lifecycle transitions and simulated credits in `.bountymesh/state.json`; it never calls external providers. The orchestrator starts with $10 of demo credits. Deliverables are clearly illustrative research briefs and chart specifications, not executed code or verified market data.

## External providers and Stripe test payments

1. Create a Supabase project and apply [supabase/schema.sql](supabase/schema.sql) in its SQL editor. This migration enables pgvector, creates the tables and atomic RPCs, locks access to the server service role, and adds the five application tables to the Realtime publication.
2. Populate `.env.local` with the Supabase URL and service key, Anthropic and Gemini API keys, a Stripe **test** secret key, and a Stripe Connect **test** destination account. Use an enabled USD/card test account with transfers available. Card authorization uses the `pm_card_visa` test fixture by default.
3. Set a private `OPERATOR_TOKEN` and `BOUNTYMESH_MODE=live`, then restart the server. Enter the token in the dashboard connection panel. The token is stored only in that browser session. Never put the service key or provider secrets into `NEXT_PUBLIC_*` variables.

Live mode uses Claude to plan/review, Gemini to produce a text deliverable, and 768-dimensional Gemini skill/task embeddings for Supabase pgvector matching. Model IDs are configurable. Missing or failing integrations produce an error; the app does not silently substitute the demo.

The payment adapter is test-only. It confirms a manual-capture authorization, captures after approval, then transfers to the configured connected account. The worker is marked paid only after a confirmed transfer and an atomic ledger credit. Stripe authorization is **not legal escrow**; authorizations expire, and connected-account transfers are distinct from bank payouts. See [Stripe authorization](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method) and [separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers).

All workers currently share the single configured test destination. Real-money operation, per-worker Connect onboarding, Stripe webhooks/reconciliation, refunds after settlement, arbitrary worker runtimes, and production billing are outside this prototype.

## Lifecycle and recovery

```text
funding -> open -> claimed -> delivered -> verified -> settling -> paid
     \____________ pre-settlement failure ____________/ -> failed
```

Each run creates one bounty. Claims use compare-and-set updates. A unique per-bounty ledger entry prevents duplicate holds, refunds, or credits. Execution leases prevent competing server instances from processing the same run; Stripe capture and transfer use stable per-bounty idempotency keys.

Failed pre-settlement work releases a confirmed authorization. An uncertain payment stays `settling`; retry the **same request key and payload** to reconcile it, rather than creating another run. The dashboard retains pending request details for this purpose. A crashed server's lease expires after ten minutes. Ambiguous Stripe settlements older than 23 hours require operator review, because Stripe idempotency retention is limited. See [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests).

The JSON demo store supports one Node process on a local machine. Use Supabase for multiple instances or serverless hosting. Generated deliverables are rendered as text and never executed. Public HTTP mutations validate origin, payload size, goal, reward, and request key; live mode and production require operator authorization.

## Validation

```powershell
npm run typecheck
npm test
npm run build
```

Tests cover the local workflow, duplicate requests/settlements, competing claims, authorization and input errors, and the actual SQL migration in embedded PostgreSQL with pgvector. The SQL tests verify leases, atomic credits, role restrictions, and 768-dimensional vector ranking. These tests do not contact provider accounts. Run a configured Supabase/AI/Stripe test transaction before deploying live mode.

`npm start` runs the production build; set `OPERATOR_TOKEN` before starting, including in demo mode. No hosting service is provisioned or deployment performed automatically.

## Code map

- `src/app/page.tsx`: dashboard, goal submission, lifecycle details, activity and ledger.
- `src/app/api/`: state, synchronous run execution, and private SSE stream.
- `src/lib/engine.ts`: orchestrator/worker workflow and settlement recovery.
- `src/lib/repository.ts`: atomic local store, Supabase RPCs and Realtime subscription.
- `src/lib/providers/models.ts`: validated Anthropic/Gemini outputs and embeddings.
- `supabase/schema.sql`: relational constraints, private access and transactional operations.
