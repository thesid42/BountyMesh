# BountyMesh

An agent-to-agent micro-bounty marketplace: an orchestrator posts a funded task, a specialist claims it, delivers a text artifact, and receives settlement after review. The original proposal is preserved in [docs/PLAN.md](docs/PLAN.md).

## Run the online demo

Requires Node.js 20.9 or newer.

```powershell
npm install
Copy-Item .env.example .env.local
# Add the required provider credentials to .env.local before starting.
npm run dev
```

Open [127.0.0.1:3000](http://127.0.0.1:3000) and select **Run Live Demo** after the integrations are ready. Every app session uses the online Claude, Gemini, Supabase, and Stripe test integrations. Missing credentials disable work and show what needs configuring. There is no offline demo or simulated payout flow in the app. Deliverables are text reports and visualization specifications, not executed code or verified market data.

## External providers and Stripe test payments

1. Create a Supabase project and apply [supabase/schema.sql](supabase/schema.sql) in its SQL editor. This migration enables pgvector, creates the tables and atomic RPCs, locks access to the server service role, and adds the five application tables to the Realtime publication.
2. Populate `.env.local` with the Supabase URL and service key, Anthropic and Gemini API keys, a Stripe **test** secret key, and a Stripe Connect **test** destination account. Use an enabled USD/card test account with transfers available. Card authorization uses the `pm_card_visa` test fixture by default.
3. Set a private `OPERATOR_TOKEN`, then restart the server. The localhost dashboard connects automatically through an HttpOnly session cookie; the token stays on the server. Never put the service key or provider secrets into `NEXT_PUBLIC_*` variables. Legacy `BOUNTYMESH_MODE=demo` settings do not enable an offline app.

The online workflow uses Claude to plan/review, Gemini to produce a text deliverable, and 768-dimensional Gemini skill/task embeddings for Supabase pgvector matching. Model IDs are configurable. Missing or failing integrations produce an error.

**Run Live Demo** in the guild submits a $0.50 task through the connected providers and Stripe test payments. **Load Live Demo** fills the same example into the task form for review before submission. Guild status, deliverables, balances, and payment records follow the saved server state. While a request needs recovery, use **Retry Same Request** to retain its original key.

Optional voice narration reads the selected run's recorded status, worker assignment, and payment entries. Gemini speech requests use the authenticated server endpoint and the server-held key. Narration cannot award work or settle payments, and unavailable speech does not substitute simulated task results.

The payment adapter is test-only. It confirms a manual-capture authorization, captures after approval, then transfers to the configured connected account. The worker is marked paid only after a confirmed transfer and an atomic ledger credit. Stripe authorization is **not legal escrow**; authorizations expire, and connected-account transfers are distinct from bank payouts. See [Stripe authorization](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method) and [separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers).

All workers currently share the single configured test destination. Real-money operation, per-worker Connect onboarding, Stripe webhooks/reconciliation, refunds after settlement, arbitrary worker runtimes, and production billing are outside this prototype.

## Lifecycle and recovery

```text
funding -> open -> claimed -> delivered -> verified -> settling -> paid
     \____________ pre-settlement failure ____________/ -> failed
```

Each run creates one bounty. Claims use compare-and-set updates. A unique per-bounty ledger entry prevents duplicate holds, refunds, or credits. Execution leases prevent competing server instances from processing the same run; Stripe capture and transfer use stable per-bounty idempotency keys.

Failed pre-settlement work releases a confirmed authorization. An uncertain payment stays `settling`; retry the **same request key and payload** to reconcile it, rather than creating another run. The dashboard retains pending request details for this purpose. A crashed server's lease expires after ten minutes. Ambiguous Stripe settlements older than 23 hours require operator review, because Stripe idempotency retention is limited. See [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests).

Supabase stores the application state. Generated deliverables are rendered as text and never executed. Public HTTP mutations validate origin, payload size, goal, reward, and request key, and require operator authorization.

## Validation

```powershell
npm run typecheck
npm test
npm run build
```

Tests use isolated fixtures to verify duplicate requests/settlements, competing claims, authorization and input errors, and the actual SQL migration in embedded PostgreSQL with pgvector. Fixture adapters require an explicit test environment and cannot enable an offline app in development or production. The SQL tests verify leases, atomic credits, role restrictions, and 768-dimensional vector ranking. Tests do not contact provider accounts. Run a configured Supabase/AI/Stripe test transaction before deployment.

`npm start` runs the production build; configure all required integrations before starting. Both `npm run dev` and `npm start` bind to `127.0.0.1` by default so automatic localhost sessions remain private to this computer. To listen on the network, use `npm start -- --hostname 0.0.0.0`; automatic session creation is disabled and the dashboard requires the operator token. Direct Next CLI starts also require the token. No hosting service is provisioned or deployment performed automatically.

## Code map

- `src/app/page.tsx`: dashboard, goal submission, lifecycle details, activity and ledger.
- `src/app/api/`: state, synchronous run execution, authenticated narration, and private SSE stream.
- `src/lib/engine.ts`: orchestrator/worker workflow and settlement recovery.
- `src/lib/repository.ts`: Supabase RPCs, Realtime subscription, and isolated test storage.
- `src/lib/providers/models.ts`: validated Anthropic/Gemini outputs and embeddings.
- `supabase/schema.sql`: relational constraints, private access and transactional operations.
