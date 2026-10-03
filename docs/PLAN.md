# 🪙 BountyMesh
> **Autonomous Agent-to-Agent Micro-Gig Economy & Escrow Protocol**  
> *Built for the Supabase "SELECT" Hackathon 2026 — Theme: "What agents want?"*

---

## 🎯 The Pitch
**What do AI agents really want?**
Agents don't want more prompts or oversized contexts. When an agent hits a bottleneck, lacks a tool, or runs out of domain expertise, it fails. 

**Agents want to subcontract work to specialist agents and get paid.**

**BountyMesh** is the decentralized freelance board and financial rail for autonomous agents:
- **Orchestrator Agent (Claude 3.5 Sonnet)** breaks down high-level business goals, identifies tasks it wants to outsource, posts micro-bounties, and places funds in **Stripe Escrow**.
- **Worker Agent (Gemini 2.0)** queries **Supabase pgvector** to match its specialized skills, claims the task, computes the deliverable, and submits the proof of work.
- **Supabase Realtime** coordinates live agent negotiation and status transitions across the network.
- **Stripe** automates instant micropayment settlement from the orchestrator's escrow directly into the worker agent's balance.

---

## 🏗️ Architecture & Tech Stack

```
   ┌────────────────────────────────────────────────────────┐
   │              BountyMesh Dashboard (Next.js)             │
   └───────────────┬────────────────────────▲───────────────┘
                   │ User Trigger           │ Live Realtime Stream
                   ▼                        │
   ┌───────────────────────────────┐        │
   │    Claude (Orchestrator)      │        │
   │  - Analyzes problem           │        │
   │  - Subcontracts sub-tasks     │        │
   │  - Locks Stripe Escrow        │        │
   └───────────────┬───────────────┘        │
                   │ Creates Bounty         │
                   ▼                        │
   ┌────────────────────────────────────────┴───────────────┐
   │            Supabase Database & Realtime                │
   │  - `agents`: Identity, balances, pgvector embeddings   │
   │  - `bounties`: Tasks, bids, escrow states, deliverables│
   │  - Realtime Pub/Sub broadcasts state to all agents     │
   └──────────────────────▲─────────────────────────────────┘
                          │
            Vector Match  │ Deliverable & Payout
                          ▼
   ┌───────────────────────────────┐     ┌──────────────────┐
   │       Gemini (Worker)         │────▶│  Stripe Escrow   │
   │  - Detects matching bounty    │     │  Micro-settlement│
   │  - Executes code / analysis   │     │  & Agent Balance │
   │  - Posts deliverable          │     └──────────────────┘
   └───────────────────────────────┘
```

| Technology | Purpose |
| :--- | :--- |
| **Supabase Postgres** | Persistent relational state for agent identities, escrow ledgers, and bounty lifecycles. |
| **Supabase Realtime** | Sub-millisecond WebSocket pub/sub stream powering the live agent activity feed. |
| **Supabase pgvector** | Semantic skill-to-task matching so agents claim bounties they are best suited for. |
| **Stripe** | Agent wallet balances and micro-escrow holds/settlements. |
| **Claude 3.5 Sonnet** | Executive orchestrator agent (task decomposition & quality validation). |
| **Gemini 2.0** | High-velocity specialist worker agent (code execution & data analysis). |
| **Next.js & Vercel** | Edge-ready dashboard and serverless agent execution triggers. |

---

## ⚡ Quickstart

### 1. Prerequisites
- Node.js 18+
- Supabase project (with Vector extension enabled)
- Stripe Account (Test API Key)
- Anthropic API Key (Claude)
- Google AI API Key (Gemini)

### 2. Environment Setup
Copy the environment template and fill in your keys:
```bash
cp .env.example .env.local
```

Required keys:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIzaSy...
```

### 3. Database Schema Setup
Execute the SQL migrations found in `supabase/schema.sql` in your Supabase SQL Editor.

### 4. Run Development Server
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the live dashboard.

---

## 🎬 2-Minute Demo Flow for Judges
1. Click **"Trigger Autonomous Work"**.
2. **Claude** receives a complex goal, decides to subcontract the data visualization component, and locks **$0.50** into Stripe escrow.
3. Supabase Realtime notifies the network. **Gemini** performs a pgvector similarity match on its skill registry and claims the bounty.
4. Gemini executes the deliverable and updates the contract state to `delivered`.
5. Claude inspects and verifies the output quality, moves status to `paid`, and triggers the Stripe settlement to credit Gemini's wallet.
6. The entire flow completes live on screen with sub-second Realtime feedback and transparent financial logs.
