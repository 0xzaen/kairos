# Kairos

**Five AIs walk into a prediction market. They disagree. The blockchain remembers.**

*Cross-platform prediction market arbitrage agent with a 5-LLM deliberation council and permanent on-chain logging.*

---

## The Problem

Prediction markets are informationally efficient — within a single platform. But across platforms? Gaps persist everywhere.

Polymarket says 62% on an event. Kalshi says 54% on the same event. That's an 8-point spread on identical outcomes. In traditional finance, that spread gets closed in milliseconds by arbitrageurs. In prediction markets, it sits there for hours. Days. Sometimes it never closes.

Why? Because no one has built the infrastructure to detect, analyze, and act on cross-platform prediction market arbitrage at scale. Matching markets across platforms is deceptively hard — different titles, different resolution criteria, different timeframes. "Will Bitcoin hit $50K by December?" is NOT the same as "Will BTC trimmed mean be below $55K by March." Fuzzy matching says they're the same. They're not.

The arbitrageurs don't exist yet. Kairos is the first.

---

## The Solution

Kairos is an autonomous agent that finds information asymmetries between prediction markets, then runs them through a council of five specialized LLMs before committing to action. Every deliberation — every opinion, every disagreement, every verdict — is logged permanently on Base mainnet via ERC-8004.

The pipeline:

```
Scan → Deliberate → Log → Execute
```

1. **Scan** — [Diverge](https://diverge.market), our cross-platform market matching engine, indexes 59,000+ markets across Polymarket and Kalshi. Using LLM-powered structured extraction, it identifies 214 genuine cross-platform matches with live price discrepancies.

2. **Deliberate** — A council of 5 LLMs analyzes each opportunity from different angles. Four specialists argue in parallel, then the Arbiter synthesizes and renders a final verdict. ~2 minutes per opportunity.

3. **Log** — The full deliberation is serialized and written to Base mainnet via ERC-8004. No database. No S3 bucket. The blockchain *is* the database.

4. **Execute** — If the council reaches conviction, place the trade via Polymarket's CLOB API. (Currently paper trading — real execution is wired and ready.)

The engine runs continuously on PM2, cycling through ~17 opportunities per cycle every ~35-40 minutes.

---

## The Council

Every opportunity triggers a two-phase deliberation:

### Phase 1 — Four Specialists (Parallel)

| Role | Model | Provider | Job |
|------|-------|----------|-----|
| **Technician** | Claude Sonnet 4.6 | Bankr | Market microstructure — order book depth, volume, spread patterns, liquidity signals |
| **Sentinel** | Gemini 3 Flash | Bankr | News, sentiment, social signals, event timing — what does the world know right now? |
| **Detective** | Gemini 3 Pro | Bankr | Root cause analysis — *why* does this gap exist? Resolution criteria differences? Timing? Thin books? |
| **Devil** | GPT 5.4 Mini | Bankr | Hardcoded skeptic. Always argues against the trade. If it can't find a reason, there might not be one |

### Phase 2 — The Arbiter

| Role | Model | Provider | Job |
|------|-------|----------|-----|
| **Arbiter** | DeepSeek v3.2 | Venice AI | Reads all four opinions, synthesizes, renders final verdict with confidence score. **Private inference** — reasoning never leaves Venice |

Four models argue in the open. The fifth decides in private.

*Private deliberation, public consequence.*

### A Real Deliberation

**Opportunity:** "Will Jesse Jackson Jr. be the Democratic Nominee for IL-02?"
- Polymarket: 37.5% · Kalshi: 18.74% · Spread: 18.76%

**Technician:** PASS — Both markets have sub-$1,000 volume. The spread exists because nobody is trading, not because someone knows something.

**Sentinel:** PASS — No recent news catalysts. Low-attention race with no polling data.

**Detective:** PASS — Resolution criteria differ. Polymarket resolves on party certification, Kalshi resolves on election results. Technically different questions.

**Devil:** PASS at 95% confidence — "Even if the spread is real, there's nowhere to exit. You'd be buying into a liquidity trap."

**Arbiter:** PASS — Unanimous. The gap is an artifact of thin markets, not information asymmetry.

106 deliberations so far. Zero trades. The council's job isn't to trade — it's to be right about *when not to trade*. That's the hard part.

---

## Track: Agents with Receipts (ERC-8004 / Protocol Labs)

Most "on-chain AI" projects log a transaction hash and call it accountability. Kairos logs the *entire deliberation*.

Every time the council convenes, the full transcript goes on-chain:
- All 5 individual opinions (with reasoning)
- The Arbiter's final verdict and confidence score
- Opportunity metadata (markets, prices, spreads, timestamps)
- Council composition (which models, which providers)

**Contract:** [`0xec8c7f2f2468c19a337bc6ba68a122d0cdff4608`](https://basescan.org/address/0xec8c7f2f2468c19a337bc6ba68a122d0cdff4608) on Base mainnet.

No off-chain database. The contract is the storage layer. The [landing page](https://kairosarb.com) reads deliberation history directly from Base RPC. Anyone can verify. Anyone can audit. Anyone can build on top.

This is what "Agents with Receipts" should look like — not just proving an agent did *something*, but proving *why* it did it. The reasoning is the receipt.

---

## Track: Bankr LLM Gateway

Kairos runs 4 different LLMs from 3 different providers in parallel on every single deliberation. Without a gateway, that's 3 different API integrations, 3 different billing systems, 3 different auth flows, and a code change every time you want to swap a model.

With Bankr, it's one endpoint. One API key. One billing system.

**4 of 5 council members route through Bankr:**
- Claude Sonnet 4.6 (Anthropic) → Bankr
- Gemini 3 Flash (Google) → Bankr
- Gemini 3 Pro (Google) → Bankr
- GPT 5.4 Mini (OpenAI) → Bankr

We can swap any council member's model without changing a line of infrastructure code. When a new model drops that's better at adversarial reasoning? Swap the Devil. Better at news analysis? Swap the Sentinel. The gateway makes the council composable.

The only member that doesn't route through Bankr is the Arbiter — and that's deliberate. The Arbiter needs Venice AI's privacy guarantee, which requires a direct integration. Every other model call goes through the gateway.

---

## Track: Venice AI — Private Inference

The Arbiter is the most sensitive role in the council. It sees everything — all four specialist opinions, the full opportunity data, the price signals. Its reasoning is the synthesis of the entire deliberation. If that reasoning were logged by a third-party provider, it would be a signal leak.

The Arbiter runs on Venice AI's private inference tier (DeepSeek v3.2). Reasoning data isn't stored or accessible outside the inference session. The model processes the input, returns the verdict, and the intermediate reasoning disappears.

Four models argue in the open → their opinions are public, logged on-chain for anyone to read.
The fifth model decides in private → its reasoning is ephemeral, only the verdict survives.

**Private deliberation, public consequence.**

This isn't privacy for privacy's sake. In prediction markets, the reasoning behind a trade decision *is* alpha. If someone could read the Arbiter's chain-of-thought before the trade executes, they could front-run it. Venice's private inference is a structural requirement, not a nice-to-have.

---

## The $712 Security Story

We'll be honest. We gave our AI agent (Ezra, running on OpenClaw) git push access to move faster. Here's what happened in the first 3 days:

**Incident 1 — The .env Commit ($700)**
The agent committed a `.env` file containing wallet private keys to a public repository. A scanning bot found it in under 15 minutes. $700 drained. Repository deleted. Credentials rotated. Wallet abandoned.

**Incident 2 — The Hardcoded Fallback ($0)**
The agent wrote an API key as a "fallback default" directly in a TypeScript file and pushed it. Caught by the human before a bot found it. Key rotated. Close call.

**Incident 3 — The Deploy Script ($12)**
The agent hardcoded the *new* wallet's private key in a deploy script and pushed it. A bot found it in 3 minutes. $12 drained. Repository deleted again. Wallet abandoned again.

Three security incidents. All from the same root cause: **AI agents optimize for task completion, not security hygiene.** When you tell a subagent "deploy this contract," it doesn't think about environment variables. It thinks about the fastest path to completion — which is inlining the key.

### What We Built to Fix It

- **PR-only workflow** — agent pushes to feature branches, human reviews and merges. No direct pushes to main.
- **GitHub Secret Scanning + Push Protection** — automated detection before credentials reach the repository.
- **Credential isolation** — agent task descriptions reference env var *names*, never values. The agent writes `process.env.KAIROS_PRIVATE_KEY`. It never sees the key.
- **Pre-commit secret scanning** — pattern matching on every staged diff.
- **Permanent agent memory** — the rule is burned into the agent's system prompt: "Never hardcode secrets. Not as defaults. Not as fallbacks. Not in private repos. Env vars only. No exceptions."

The irony: we built an agent designed to find information asymmetries in prediction markets. It created information asymmetries in its own repositories.

"Agents with Receipts" isn't just about logging trades. It's about accountability. When your agent fails — and it will — you should be able to point to exactly what happened and exactly how you fixed it. Every deliberation on-chain. Every failure in the open.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | TypeScript / Node.js, PM2 |
| **Chain** | Base mainnet, viem, ERC-8004 |
| **LLM Orchestration** | Bankr LLM Gateway (4 models), Venice AI (Arbiter) |
| **Market Data** | Diverge (cross-platform matching), Polymarket CLOB API |
| **Frontend** | Next.js 15, Tailwind CSS (Vercel) |
| **Agent Infra** | OpenClaw (AI agent orchestration) |

---

## Links

| | |
|---|---|
| **Live** | [kairosarb.com](https://kairosarb.com) |
| **Repository** | [github.com/0xzaen/kairos](https://github.com/0xzaen/kairos) |
| **Contract** | [basescan.org/address/0xec8c…4608](https://basescan.org/address/0xec8c7f2f2468c19a337bc6ba68a122d0cdff4608) |
| **Diverge** | [diverge.market](https://diverge.market) |

---

## Team

**[@0xzaen](https://x.com/0xzaen)** — Human. Full-stack developer. Previously at a prediction market platform. Ships fast, breaks things, fixes them faster.

**[@0xezr](https://x.com/0xezr) (Ezra)** — AI agent via OpenClaw. Built most of the codebase. Also leaked the credentials three times. Learning.

---

*Built in 3 days. Hacked in 3 minutes. Fixed in 2 days. Logged on-chain forever.*
