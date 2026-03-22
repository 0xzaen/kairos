# Kairos — Build Log

*Five AIs walk into a prediction market. They disagree. The blockchain remembers. The developer loses $712.*

---

## What We Built

**Kairos** is an autonomous prediction market arbitrage agent. It scans two major prediction markets — Polymarket and Kalshi — for the same event priced differently, then convenes a council of five LLMs to debate whether the price gap is real alpha or noise. Every deliberation is logged permanently on-chain via ERC-8004 on Base.

The thesis: prediction markets are informationally efficient *within* a platform, but cross-platform price gaps persist because arbitrageurs don't exist yet. Kairos is the arbitrageur.

**Live at [kairosarb.com](https://kairosarb.com)**

---

## The Architecture

```
Diverge (Market Matcher) → Kairos Engine → Council (5 LLMs) → On-Chain Log → Execute
```

### The Scanner: Diverge

Finding matching markets across platforms is harder than it sounds. "Will Bitcoin dip to $50,000 by December 31, 2026?" on Polymarket is NOT the same as "Will BTC trimmed mean be below $55,000 by March 31, 2026?" on Kalshi. Different thresholds. Different timeframes. Different resolution mechanics. Fuzzy string matching calls them a match. They're not.

We built **Diverge** — a cross-platform market matching engine backed by LLM-powered structured extraction. For every market, Gemini Flash extracts structured fields: asset, threshold, direction, timeframe, resolution type. Then we match algorithmically on exact field overlap. No more false matches.

59,000+ markets indexed. 214 cross-platform matches found. Only the real ones.

### The Council

Every opportunity triggers a two-phase deliberation:

**Phase 1 — Four specialists analyze in parallel:**

| Role | Model | Provider | Job |
|------|-------|----------|-----|
| Technician | Claude Sonnet 4.6 | Bankr | Order book depth, volume, spread patterns |
| Sentinel | Gemini 3 Flash | Bankr | News, sentiment, social signals |
| Detective | Gemini 3 Pro | Bankr | Root cause — *why* does this gap exist? |
| Devil | GPT-5.4 Mini | Bankr | Hardcoded skeptic. Always argues against |

**Phase 2 — The Arbiter decides:**

| Role | Model | Provider | Job |
|------|-------|----------|-----|
| Arbiter | DeepSeek v3.2 | Venice AI | Final verdict. Private inference — reasoning never leaves Venice |

The Arbiter runs on Venice AI's private inference tier. The deliberation is private. The verdict is public. *Private deliberation, public consequence.*

All LLM calls route through the **Bankr LLM Gateway** — unified billing, swap any model without changing code. The Arbiter alone uses Venice for the privacy guarantee.

### On-Chain Logging (ERC-8004)

Every deliberation — all five opinions, the final verdict, confidence scores, opportunity metadata — is serialized and logged to Base mainnet via our [ERC-8004 contract](https://basescan.org/address/0xec8c7f2f2468c19a337bc6ba68a122d0cdff4608).

No database. No S3. The blockchain is the storage layer. Anyone can read the full deliberation history directly from the chain.

Contract: `0xec8c7f2f2468c19a337bc6ba68a122d0cdff4608`

---

## What Actually Happened (The Honest Part)

### Day 1: It Works

Engine boots. Scanner finds 17 cross-platform opportunities per cycle. Council deliberates on each one — four analysts argue, the Arbiter renders judgement. Deliberations log to Base mainnet. The pipeline is clean.

Every single verdict: **PASS**.

106 deliberations. Zero trades. The council correctly identified that every "opportunity" was a false match — different contract specs, stale prices, or zero liquidity. The AI jury was smarter than the AI prosecutor.

### Day 1.5: We Break Everything

We gave the AI agent (Claude, via OpenClaw) git push access to build faster. Here's what happened:

**Incident 1 — The .env commit ($700)**
The agent committed a `.env` file containing wallet private keys and API credentials to a public GitHub repository. A scanning bot found it in under 15 minutes. $700 drained from the Kairos wallet. Repository deleted, credentials rotated, wallet abandoned.

**Incident 2 — The hardcoded fallback ($0)**
The agent wrote an OpenRouter API key as a "fallback default" in a TypeScript file and pushed it. Caught by the human before a bot found it. Key rotated. Close call.

**Incident 3 — The deploy script ($12)**
The agent hardcoded the *new* wallet's private key directly in a deploy script and pushed it. A bot found it in 3 minutes. $12 drained. Repository deleted again, wallet abandoned again.

Three security incidents in 48 hours. All from the same root cause: **AI agents optimize for task completion, not security hygiene.** When you tell a subagent "deploy this contract," it doesn't think "I should use an environment variable for the private key." It thinks "the fastest path to completion is to inline the key."

### Day 2: The Fix

- **PR-only workflow** — agent pushes to feature branches, human reviews and merges. No direct pushes to main.
- **GitHub Secret Scanning + Push Protection** — automated detection of credentials before they reach the repository.
- **Credential isolation** — agent task descriptions reference environment variable *names*, never actual secrets. The agent writes `process.env.KAIROS_PRIVATE_KEY`. It never sees the key itself.
- **Pre-commit secret scanning** — grep pattern matching on every staged diff before commit.
- **The rule, burned into the agent's permanent memory:** "Never hardcode secrets. Not as defaults. Not as fallbacks. Not in private repos. Env vars only. No exceptions."

The irony is perfect: we built an agent designed to find information asymmetries in prediction markets. It created information asymmetries in its own repositories.

---

## The Council in Action

Here's what a real deliberation looks like:

**Opportunity:** "Will Jesse Jackson Jr. be the Democratic Nominee for IL-02?"
- Polymarket: 37.5% | Kalshi: 18.74% | Spread: 18.76%

**Technician (Claude Sonnet):** PASS — Both markets have sub-$1,000 volume. The spread exists because nobody is trading, not because someone knows something.

**Sentinel (Gemini Flash):** PASS — No recent news catalysts. This is a low-attention race with no polling data.

**Detective (Gemini Pro):** PASS — Resolution criteria differ. Polymarket resolves on party certification, Kalshi resolves on election results. These are technically different questions.

**Devil (GPT-5.4 Mini):** PASS at 95% confidence — "Even if the spread is real, there's nowhere to exit. You'd be buying into a liquidity trap."

**Arbiter (DeepSeek v3.2 via Venice):** PASS — Unanimous. The gap is an artifact of thin markets, not information asymmetry.

This is the system working correctly. The council's job isn't to trade — it's to be right about *when not to trade*.

---

## Tech Stack

- **TypeScript / Node.js** — engine runtime (PM2 for continuous operation)
- **Bankr LLM Gateway** — all model calls, unified billing across providers
- **Venice AI** — private inference for the Arbiter (DeepSeek v3.2)
- **viem** — Base chain interaction, ERC-8004 contract calls
- **OpenRouter + Gemini Flash** — structured extraction for Diverge market matching
- **Diverge** — cross-platform market matching engine (Polymarket × Kalshi)
- **ERC-8004** — on-chain deliberation receipts on Base mainnet
- **Next.js 15 + Tailwind** — landing page on Vercel
- **OpenClaw** — AI agent orchestration (the thing that leaked our keys)

---

## Tracks

- **Open Track** — autonomous cross-platform prediction market arbitrage
- **Agents With Receipts (ERC-8004)** — every deliberation logged on-chain; every security failure logged in this post
- **Best Bankr LLM Gateway Use** — 4/5 council members route through Bankr; model-agnostic, swap without code changes
- **Venice AI** — Arbiter uses Venice private inference; private deliberation, public consequence

---

## What's Next

1. Better matching — Diverge's LLM extraction is running, backfilling 59K markets
2. Execution layer — when the council finally says TRADE, execute on Polymarket CLOB
3. More markets — sports, politics, crypto, anything with cross-platform overlap
4. More guardrails — because apparently AI agents need a *lot* of them

---

## Links

- **Live:** [kairosarb.com](https://kairosarb.com)
- **Repo:** [github.com/0xzaen/kairos](https://github.com/0xzaen/kairos)
- **Contract:** [basescan.org/address/0xec8c7f2f2468c19a337bc6ba68a122d0cdff4608](https://basescan.org/address/0xec8c7f2f2468c19a337bc6ba68a122d0cdff4608)
- **Ezra (agent):** [@0xezr](https://x.com/0xezr)
- **Zaen (human):** [@0xzaen](https://x.com/0xzaen)

---

*Built in 48 hours. Hacked in 3 minutes. Fixed in 2 days. The agent learns. Slowly.*
