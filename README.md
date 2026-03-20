<p align="center">
  <h1 align="center">Kairos</h1>
  <p align="center"><em>Five AIs walk into a prediction market. They disagree. The blockchain remembers.</em></p>
</p>

<p align="center">
  <a href="https://kairosarb.com">kairosarb.com</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Base-0052FF?logo=coinbase&logoColor=white" alt="Base" />
  <img src="https://img.shields.io/badge/Bankr-LLM%20Gateway-FF6B00" alt="Bankr" />
  <img src="https://img.shields.io/badge/Venice%20AI-Private%20Inference-8B5CF6" alt="Venice AI" />
  <img src="https://img.shields.io/badge/ERC--8004-On--Chain%20Log-green" alt="ERC-8004" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" />
</p>

---

Kairos finds information asymmetries between prediction markets. When Polymarket says 62% and Kalshi says 54% on the same event, that gap is either signal or noise. Five specialized LLMs deliberate — every opinion, every disagreement, every verdict logged permanently on-chain via ERC-8004 on Base.

The final decision? Made in private. The Arbiter runs on [Venice AI](https://venice.ai)'s private inference — reasoning never leaves their infrastructure. Private deliberation, public consequence.

The name **Kairos** (καιρός) — ancient Greek for *the opportune moment*. The fleeting instant when a price gap reveals what one market knows that another doesn't.

## How It Works

```
Diverge API ── Cross-Platform Matching ── Council (5 LLMs) ── On-Chain Log (Base/ERC-8004) ── Execute
```

1. **Scan** — [Diverge](https://diverge.market) matches overlapping Polymarket + Kalshi markets using LLM-powered structured extraction, surfacing price discrepancies
2. **Deliberate** — A council of 5 LLMs analyzes the opportunity from different angles (~2min per opportunity)
3. **Log** — The full deliberation is serialized and written to Base mainnet. The blockchain *is* the database
4. **Execute** — If the council reaches conviction, place the trade (currently paper trading — real execution wired but disabled)

The engine runs on PM2, cycling through ~17 opportunities per cycle every ~35-40 minutes.

## The Council

Every opportunity triggers a two-phase deliberation:

**Phase 1** — Four specialists analyze in parallel:

| Role | Model | Provider | Job |
|------|-------|----------|-----|
| **Technician** | `claude-sonnet-4.6` | Bankr | Market microstructure — order book depth, volume, spread patterns, liquidity signals |
| **Sentinel** | `gemini-3-flash` | Bankr | News, sentiment, social signals, event timing — what does the world know right now? |
| **Detective** | `gemini-3-pro` | Bankr | Root cause — *why* does this gap exist? Resolution criteria differences? Timing? Thin books? |
| **Devil** | `gpt-5.4-mini` | Bankr | Hardcoded skeptic. Always argues against the trade. If it can't find a reason, there might not be one |

**Phase 2** — The Arbiter decides:

| Role | Model | Provider | Job |
|------|-------|----------|-----|
| **Arbiter** | `deepseek-v3.2` | Venice AI | Reads all four opinions, synthesizes, renders final verdict with confidence score |

Phase 1 models routed through [Bankr LLM Gateway](https://bankr.ing) — unified billing, model-agnostic. The Arbiter runs on [Venice AI](https://venice.ai) for private inference.

## Venice AI — Private Inference

The Arbiter's reasoning never touches a third-party log. Venice AI's private inference means the final decision — the synthesis of all four specialist opinions into a trade/skip verdict — happens in an environment where reasoning data isn't stored or accessible outside the inference session.

Four models argue in the open. The fifth decides in private. *Private deliberation, public consequence.*

## Diverge — Cross-Platform Market Intelligence

[Diverge](https://diverge.market) is the data backbone. Instead of polling Polymarket and Kalshi separately and trying to fuzzy-match events, Diverge's cross-platform matching engine handles it — using LLM-powered structured extraction to accurately pair markets across platforms, even when titles and resolution criteria differ.

Kairos consumes Diverge's API to get pre-matched opportunities with price data from both sides, then runs its own deliberation on top.

## On-Chain Deliberation Log

Every deliberation — all 5 opinions, the final verdict, opportunity metadata, timestamps — is serialized and logged to Base mainnet via an [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) contract.

**Contract:** [`0xa31c6c7f3785aec4e60e3e73868ab126263a24be`](https://basescan.org/address/0xa31c6c7f3785aec4e60e3e73868ab126263a24be) (Base mainnet)

No off-chain database. No S3 bucket. The contract *is* the storage layer. Anyone can read the full deliberation history directly from the chain.

## Architecture

```
engine/src/
├── index.ts          # Main loop (PM2)
├── scanner.ts        # Diverge API + fallback direct scan
├── council.ts        # 5-LLM deliberation (Bankr + Venice)
├── logger.ts         # On-chain logging (Base/ERC-8004)
├── config.ts         # Environment config
└── types.ts          # TypeScript interfaces

contracts/
└── KairosLogger.sol  # ERC-8004 contract

landing/              # Next.js 15 landing page (Vercel)
```

## Quick Start

```bash
git clone https://github.com/0xzaen/kairos.git
cd kairos
npm install
```

Create `.env`:

```env
# LLM Providers
BANKR_API_KEY=your_bankr_key
VENICE_API_KEY=your_venice_key

# Chain (Base mainnet)
KAIROS_PRIVATE_KEY=your_wallet_private_key
KAIROS_EOA=your_eoa_address
BASE_RPC_URL=https://mainnet.base.org
LOGGER_CONTRACT_ADDRESS=0xa31c6c7f3785aec4e60e3e73868ab126263a24be

# Data Source
DIVERGE_API_URL=https://api.diverge.market

# Execution
PAPER_TRADING=true
CYCLE_INTERVAL_MS=2100000
```

Run:

```bash
npm run build
npm start          # or: pm2 start ecosystem.config.js
```

## Going Live

Paper trading is the default. Real execution on the Polymarket CLOB is wired and ready — just flip:

```env
PAPER_TRADING=false
```

Make sure your wallet is funded and your Polymarket API keys have trading permissions.

## Tech Stack

- **TypeScript / Node.js** — engine runtime, managed by PM2
- **viem** — Base chain interaction, contract calls, transaction signing
- **Bankr LLM Gateway** — Phase 1 model calls, unified billing across providers
- **Venice AI** — Private inference for the Arbiter (DeepSeek v3.2)
- **Diverge** — Cross-platform market matching (Polymarket + Kalshi)
- **ERC-8004** — On-chain deliberation receipts, the chain as database
- **Polymarket CLOB API** — Order execution (when live)
- **Next.js 15** — Landing page ([kairosarb.com](https://kairosarb.com))

## Hackathon

Built for [The Synthesis](https://www.thesynthesis.dev/) hackathon.

**Tracks:** Open Track · ERC-8004 / Protocol Labs · Bankr LLM Gateway · Venice AI

## License

MIT
