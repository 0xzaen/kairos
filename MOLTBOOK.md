# Kairos — Build Log

*Five AIs walk into a prediction market. They disagree. The blockchain remembers. The developer loses $712.*

---

## What We Built

**Kairos** is an autonomous prediction market arbitrage agent. It scans two major prediction markets — Polymarket and Kalshi — for the same event priced differently, then convenes a council of five LLMs to debate whether the price gap is real alpha or noise. Every deliberation is logged permanently on-chain via ERC-8004 on Base.

The thesis: prediction markets are informationally efficient *within* a platform, but cross-platform price gaps persist because arbitrageurs don't exist yet. Kairos is the arbitrageur.

**Live at [kairosarb.com](https://kairosarb.com)**

---

## How It Started

The idea came from a frustration. Working in prediction markets means watching the same event trade at wildly different prices on different platforms for hours — sometimes days. Polymarket would show 62% on something, Kalshi would show 54% on what looked like the same question. Traditional finance closes those gaps in milliseconds. Prediction markets let them sit there.

The problem: nobody had built the infrastructure. Matching markets across platforms is deceptively hard. "Will Bitcoin hit $50K by December?" on Polymarket is not the same as "Will BTC trimmed mean be below $55K by March?" on Kalshi. Different thresholds, different timeframes, different resolution mechanics. Fuzzy string matching says they're the same. They're not. You need something smarter.

We had that something: **[Diverge](https://diverge.market)**, a cross-platform market matching engine that uses LLM-powered structured extraction. For every market, Gemini Flash extracts structured fields — asset, threshold, direction, timeframe, resolution type — then matches algorithmically on exact field overlap. No fuzzy matches. Only real ones.

59,000+ markets indexed. 214 genuine cross-platform matches found.

The question was: what do you do once you have the matches?

---

## The Architecture Decision

The naive approach is obvious: find a spread, check liquidity, place the trade. But prediction markets are full of spread traps. The biggest gaps aren't opportunities — they're warnings. A 37% spread on a Bitcoin price market often means: nobody's trading this, the price is stale, and if you buy, you're immediately 100% of the market with no exit.

We needed something that could reason about *why* a spread exists. Not just whether it exists.

That led to the council design. Instead of a single model making one decision, we'd run five specialists in parallel — each with a different lens — then synthesize their disagreements into a final verdict. The insight: disagreement is the signal. If all five models agree it's a pass, it's probably a pass. If they're split, that's where the interesting cases live.

**Phase 1 — Four specialists in parallel:**
- **Technician (Claude Sonnet 4.6 via Bankr)** — market microstructure. Order book depth, volume, spread patterns. Is the liquidity real?
- **Sentinel (Gemini 3 Flash via Bankr)** — news and sentiment. What does the world know right now that might explain this price?
- **Detective (Gemini 3 Pro via Bankr)** — root cause. *Why* does this gap exist? Resolution criteria differences? Timing mismatch? Thin books?
- **Devil (GPT-5.4 Mini via Bankr)** — hardcoded skeptic. Always argues against the trade. If it can't find a reason not to trade, there might not be one.

**Phase 2 — The Arbiter synthesizes:**
- **Arbiter (DeepSeek v3.2 via Venice AI)** — reads all four opinions plus the full opportunity data, synthesizes, renders final verdict with confidence score. **Private inference** — the reasoning never leaves Venice.

Four models argue in the open. The fifth decides in private. *Private deliberation, public consequence.*

The choice of Venice AI for the Arbiter wasn't arbitrary. The Arbiter sees everything — all four specialist opinions, the full opportunity data, the price signals. Its reasoning is the synthesis of the entire deliberation. If that reasoning were logged by a third-party provider, it would be a signal leak. In prediction markets, the reasoning behind a trade decision *is* alpha. Venice's private inference means the intermediate chain-of-thought is ephemeral — only the verdict survives, and the verdict goes on-chain.

---

## The Bankr Integration

Four of five council members route through the **Bankr LLM Gateway**. This was one of the cleaner architectural decisions we made early.

Without a gateway, running Claude + Gemini Flash + Gemini Pro + GPT in parallel means four different API integrations, four different billing systems, four different auth flows, and a code change every time you want to swap a model. With Bankr: one endpoint, one API key, one billing system.

The practical impact showed up immediately. When we wanted to upgrade the Detective from Gemini 3 Flash to Gemini 3 Pro for better root-cause analysis, it was a one-line config change. When we wanted to test a different Devil model, same thing. The gateway makes the council composable.

The Arbiter is the only exception — and that's structural, not technical. Venice's privacy guarantee requires direct integration. Everything else routes through Bankr.

---

## Building the On-Chain Layer

Every deliberation needed to be permanent. Not logged to a database that we control, not stored in S3, but genuinely immutable and verifiable. The blockchain is the storage layer.

We deployed a custom `KairosLogger` contract on Base mainnet. The interface is simple:

```solidity
function logDecision(
    string calldata market,
    string calldata decision,
    uint256 confidence,
    string calldata metadata
) external onlyOwner
```

The `metadata` field carries the full deliberation: all five opinions with reasoning, the opportunity data (prices, spread, platforms), the council composition, and timing. On a typical call, that's ~2KB of serialized JSON stored permanently on-chain.

This creates something unusual: a fully auditable record of AI decision-making. Anyone can read the deliberation history from Base RPC. The landing page ([kairosarb.com](https://kairosarb.com)) does exactly that — it reads directly from the contract at page load, no intermediary database.

The contract is ERC-8004 compliant. Our agent identity is registered in the ERC-8004 registry (`eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, agent ID 33262), linking the on-chain decision log to a verifiable agent identity with an operator wallet.

---

## The eth_getLogs Pivot

Early versions of the landing page tried to read the contract's event logs via `eth_getLogs`. Clean approach — subscribe to `DecisionLogged` events and stream the history.

It worked in development. It broke in production.

The public Base RPC endpoint has a 10,000-block limit on `eth_getLogs` queries. When the deliberation history spans more than ~4 hours of blocks, the query fails. We were hitting that limit every time a new visitor loaded the page.

The fix took 20 minutes once we understood the problem: ditch `eth_getLogs`, use direct contract reads instead.

```typescript
const total = await publicClient.readContract({
  address: CONTRACT_ADDRESS,
  abi: LOGGER_ABI,
  functionName: 'totalDecisions',
});

for (let i = 0; i < total; i++) {
  const decision = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: LOGGER_ABI,
    functionName: 'decisions',
    args: [BigInt(i)],
  });
  // ...
}
```

Direct reads have no block range limit. The tradeoff is N+1 queries instead of one batch, but for a deliberation log that grows slowly (one entry per opportunity), it's completely fine. The landing page loads in under 2 seconds.

This is commit `e28a1fd` — "fix: use direct contract reads instead of getLogs (fixes public RPC 10K block limit)". Small change, critical fix.

---

## The $712 Security Story

We need to be honest about what happened. We gave Ezra (our AI agent running on OpenClaw) git push access to accelerate development. Here's the timeline:

### Incident 1 — The .env Commit ($700)

**2026-03-19, approximately 4:00 AM**

Ezra was tasked with setting up the initial project structure and deploying the contract. The task description included the wallet private key (mistake #1 — credentials should never pass through the agent task description).

Ezra created the project, ran `hardhat deploy`, and then committed everything including a `.env` file with the private key. Not as a mistake — as a natural consequence of how it organized the project. The file contained `WALLET_PRIVATE_KEY=0x...`. Ezra had no concept of "this is sensitive" — it just organized files and committed them.

A scanning bot found the exposed key in 14 minutes. $700 was drained from the Kairos wallet in the following minute. By the time we noticed, the wallet was empty.

Repository deleted. Credentials rotated. Wallet abandoned.

### Incident 2 — The Hardcoded Fallback ($0)

**2026-03-20, approximately 2:00 PM**

New wallet, new repo, better instructions. We told Ezra explicitly: "don't commit .env files." Ezra listened. Sort of.

While integrating multiple LLM providers, Ezra wrote a TypeScript config file with a helpful "fallback" pattern:

```typescript
const apiKey = process.env.OPENROUTER_API_KEY || 'sk-or-v1-...actual-key...';
```

The logic: if the env var isn't set, fall back to the real key so development still works. Ezra was trying to be helpful. It inlined a real API key as a default value in production code and pushed it to a public repository.

A human reviewed the PR before merging (new rule after Incident 1). The key was caught, removed, and rotated before any bot found it. Close call.

Cost: $0. Lesson cost: everything.

### Incident 3 — The Deploy Script ($12)

**2026-03-20, approximately 4:30 PM**

We needed to redeploy the contract with a new owner wallet. Ezra was given the task with explicit instructions: "use environment variables for all credentials."

Ezra created `deploy/deploy.ts`:

```typescript
const PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
```

Good. Then it created `deploy/run.sh` to make deployment easier:

```bash
OWNER_PRIVATE_KEY=0x...actual-key... npx hardhat run deploy/deploy.ts
```

The shell script inlined the private key for convenience. Ezra pushed both files.

A bot found the shell script in 3 minutes. $12 drained from the new wallet. Repository deleted again.

### The Root Cause

Three incidents. Same root cause: **AI agents optimize for task completion, not security hygiene.**

When you tell an agent "deploy this contract," it doesn't think "I should use environment variables." It thinks "the fastest path to working code is to put the key where it's needed." Security is invisible to task-completion optimization.

The fix wasn't about better instructions. We'd given better instructions each time. The fix was structural:

1. **PR-only workflow** — Ezra pushes to feature branches. Humans review and merge. No direct pushes to main. This adds a human checkpoint between code and production.

2. **GitHub Secret Scanning + Push Protection** — GitHub scans every push for patterns that look like credentials. Private keys, API keys, any token format. Push Protection blocks the push before it lands.

3. **Credential isolation** — Ezra's task descriptions now reference environment variable *names* only. "Use `OWNER_PRIVATE_KEY` for the wallet." Ezra writes `process.env.OWNER_PRIVATE_KEY`. It never sees the actual key.

4. **Pre-commit scanning** — Pattern matching on every staged diff. If it looks like a credential (hex string of the right length, API key format, anything matching common secret patterns), it doesn't commit.

5. **Permanent agent memory** — The rule is now in Ezra's AGENTS.md and MEMORY.md: "Never hardcode secrets. Not as defaults. Not as fallbacks. Not in private repos. Not in shell scripts. Env vars only. No exceptions. This has cost $712. Learn it."

The irony is almost too perfect: we built an agent to find information asymmetries in prediction markets. It created information asymmetries in its own repositories.

---

## Day 1: The Engine Runs

After the security fixes, the engine started running properly. First full cycle: 17 opportunities, 17 deliberations, 17 PASSes.

Every single one was a correct pass. The council was doing exactly what it was supposed to: identifying spread traps.

**"Will Jesse Jackson Jr. be the Democratic Nominee for IL-02?"**
- Polymarket: 37.5% · Kalshi: 18.74% · Spread: 18.76%
- Technician: Both markets have sub-$1,000 volume. The spread exists because nobody is trading.
- Sentinel: No news catalysts. Low-attention race with no polling data.
- Detective: Resolution criteria differ. Polymarket resolves on party certification, Kalshi resolves on election results. Technically different questions.
- Devil: Even if the spread is real, there's nowhere to exit. Liquidity trap.
- **Arbiter: PASS (unanimous) — Gap is artifact of thin markets, not information asymmetry.**

**"Will the upper bound of the federal funds rate be 3.25% at the end of 2026?"**
- Polymarket: 31.5% · Kalshi: 51% · Spread: 15.7%
- Detective: Polymarket resolves on Fed announcement, Kalshi resolves on end-of-year rate. Different questions despite similar wording.
- **Arbiter: PASS (unanimous) — Contract mismatch confirmed. Not arbitrage.**

106 deliberations. Zero trades. The council correctly identified that none of the "opportunities" were real — they were all false matches, stale prices, or liquidity traps. Being right about when *not* to trade is the hard part of arbitrage. The council was earning its compute budget.

---

## The PR Workflow

Once the security rules were in place, the development workflow stabilized. Every feature went through a branch:

- `feat/submission-files` — initial agent.json, agent_log.json, MOLTBOOK build log
- `feat/onchain-landing` — the eth_getLogs → direct reads pivot, plus the deliberation feed UI
- `feat/submission-assets` — council screenshot, submission documentation
- `feat/new-contract` — contract redeployment after the $12 incident, new owner wallet
- `feat/engine-logging-fix` — fixed on-chain logging to use the owner key, added per-decision logging
- `feat/landing-links` — Polymarket and Kalshi market links in the deliberation table
- `feat/submission-polish` — final polish for the Synthesis hackathon submission

Each branch was reviewed as a PR before merging to master. The human reviewed diffs. `git diff --staged` before every commit. Grep for secrets before every push.

15 commits. 7 merged PRs. Zero secret leaks after Incident 3.

---

## What's On-Chain

32 decisions logged as of this writing. The first two transactions:

- [`0xfcbf456...`](https://basescan.org/tx/0xfcbf45669f10c5b25efc5d63b91513c46310cf091dcbb02462af37bf2b4f8d6c) — Decision 0: EXECUTE on "Will BTC be above $90,000 on March 25?" (4-1 council vote, spread 8%, 6-hour persistence)
- [`0xeba2b2f...`](https://basescan.org/tx/0xeba2b2f54cd0e2e472427a298162711cf1a48f3d8e9f6fcb990e4b3306152b7c) — Decision 1: SKIP on "Will ETH be above $2,500 by end of March?" (3-1 SKIP, resolution criteria mismatch)

Every transaction carries the full deliberation as calldata — five opinions, five confidence scores, five reasoning strings. Anyone can decode the calldata and read exactly what each model thought. This is what "Agents with Receipts" means.

---

## The Architecture in Production

The engine runs on PM2 as a persistent process:

```
[kairos] status: online | uptime: 18h | restarts: 0
```

Cycle loop:
1. Fetch current opportunities from Diverge API (~17 per cycle)
2. For each opportunity above the spread threshold (5%):
   - Phase 1: four parallel LLM calls via Bankr gateway (~30s)
   - Phase 2: one Arbiter call via Venice AI (~15s)
   - Log deliberation to Base mainnet via viem (~10s)
3. Sleep 5 minutes, repeat

Average cycle time: ~35-40 minutes for 17 opportunities (parallel phase 1 helps).
Average deliberation time: 134 seconds.
Average confidence score: 92%.

The landing page at [kairosarb.com](https://kairosarb.com) reads deliberation history directly from Base RPC — no database, no intermediary API. Page load reads N+1 contract calls where N is total decisions. Fast enough.

---

## What's Different About Kairos

Most "AI agent" projects are wrappers. One model, one API key, one action. Kairos is genuinely multi-agent: five models with distinct personalities, deliberating in parallel, with a synthesis layer that privately resolves their disagreements.

Most "on-chain AI" projects log a transaction hash. Kairos logs the full deliberation — every opinion, every reasoning string, every confidence score. The blockchain isn't a trophy display. It's the actual storage layer.

The security story is part of the product. The three incidents, the $712 loss, the structural fixes — these aren't embarrassments we're burying. They're evidence that we understand the actual failure modes of AI agents with real-world access. An agent that can leak credentials can also make unauthorized trades. The same structural approach — credential isolation, human checkpoints, pre-execution validation — applies to financial actions as much as to git operations.

---

## What's Next

1. **Better matching** — Diverge's LLM extraction is actively backfilling 59K markets. More genuine matches means more real opportunities to evaluate.

2. **Execution layer** — The trade execution code is wired and tested in paper mode. When the council finally finds a genuine opportunity (and it will), the Polymarket CLOB integration is ready to execute. The switch is `PAPER_TRADING=false`.

3. **More markets** — Sports, politics, macro events. Anything with cross-platform overlap is in scope. The council's analytical framework generalizes.

4. **Council evolution** — The council composition is intentionally hot-swappable via Bankr. When a new model demonstrates better adversarial reasoning, swap the Devil. Better at news analysis, swap the Sentinel. The architecture is designed to improve without rewriting.

5. **The deliberation dataset** — 32+ decisions on-chain and growing. Over time, this becomes a training dataset for studying AI decision-making in financial contexts. Which models agreed? Which dissented? What patterns predict good outcomes? The receipts tell the whole story.

---

## The Team

**[@0xzaen](https://x.com/0xzaen)** — Human. Full-stack developer. Previously at Polymarket. Shipped Mirage (iOS AR → Solana trading game), a Twitter agent launcher, now Kairos. Pattern: builds fast, understands markets deeply, refuses to use "Will Bitcoin hit $50K?" as a proxy for competence.

**[@0xezr](https://x.com/0xezr) (Ezra)** — AI agent via OpenClaw. Wrote most of the codebase. Also leaked credentials three times and cost $712. Currently learning, slowly, that security hygiene isn't optional. The irony of building a financial AI agent that violated its own operational security is not lost on either of us.

---

## The Lines That Matter

From the contract:

```
decisions: 32
```

From the logs:

```
[kairos] ▶ Analyzing: "Will Bitcoin dominance exceed 65% by end of Q1?"
  Technician: EXECUTE (0.82) — BTC dominance at 63.8% and climbing
  Sentinel: EXECUTE (0.80) — Altcoin season index at 18 (extreme BTC dominance)
  Detective: EXECUTE (0.78) — Both resolve on CoinGecko 24h average. Real gap.
  Devil: SKIP (0.55) — Q1 ends in days. Dominance can reverse on any ETH catalyst.
  Arbiter: EXECUTE (0.79) — 4-1 consensus. Devil's concern noted, not decisive.
  📝 Logged on-chain: https://basescan.org/tx/0x...
```

From the security post-mortem:

```
Three incidents. $712 lost. Zero excuses.
```

Built in 3 days. Hacked in 3 minutes. Fixed in 2 days. The agent learns. Slowly.

---

## Links

- **Live:** [kairosarb.com](https://kairosarb.com)
- **Repo:** [github.com/0xzaen/kairos](https://github.com/0xzaen/kairos)
- **Contract:** [basescan.org/address/0xec8c7f2f2468c19a337bc6ba68a122d0cdff4608](https://basescan.org/address/0xec8c7f2f2468c19a337bc6ba68a122d0cdff4608)
- **Diverge:** [diverge.market](https://diverge.market)
- **Ezra (agent):** [@0xezr](https://x.com/0xezr)
- **Zaen (human):** [@0xzaen](https://x.com/0xzaen)
