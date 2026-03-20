// Kairos v2 — Main Entry Point

import { loadConfig } from './config.js';
import { runCouncil } from './council.js';
import { logDecision } from './logger.js';
import { executePolymarket } from './executor/polymarket.js';
import { executeKalshi } from './executor/kalshi.js';
import { scanOpportunities } from './scanner.js';
import type { Opportunity, Decision } from './types.js';

// ── Demo Opportunities (fallback if live scan fails) ────────────────
const DEMO_OPPORTUNITIES: Opportunity[] = [
  {
    event: 'BTC above $150,000 by June 30, 2026',
    polymarketYes: 0.42,
    polymarketNo: 0.58,
    kalshiYes: 0.35,
    kalshiNo: 0.65,
    spread: 0.07,
    polymarketVolume: 2_450_000,
    kalshiVolume: 890_000,
    expiresAt: '2026-06-30T23:59:59Z',
  },
  {
    event: 'Fed cuts rates at July 2026 FOMC meeting',
    polymarketYes: 0.61,
    polymarketNo: 0.39,
    kalshiYes: 0.53,
    kalshiNo: 0.47,
    spread: 0.08,
    polymarketVolume: 1_800_000,
    kalshiVolume: 1_200_000,
    expiresAt: '2026-07-31T23:59:59Z',
  },
];

// ── Pretty Print ────────────────────────────────────────────────────
function printSummary(decision: Decision): void {
  const opp = decision.opportunity;

  console.log('\n' + '═'.repeat(70));
  console.log(`📊 ${opp.event}`);
  console.log('═'.repeat(70));
  console.log(`  Poly YES: ${(opp.polymarketYes * 100).toFixed(1)}¢  |  Kalshi YES: ${(opp.kalshiYes * 100).toFixed(1)}¢  |  Spread: ${(opp.spread * 100).toFixed(1)}%`);
  console.log(`  Poly Vol: $${opp.polymarketVolume.toLocaleString()}  |  Kalshi Vol: $${opp.kalshiVolume.toLocaleString()}`);
  console.log('─'.repeat(70));

  console.log('\n🗳️  VOTE BREAKDOWN:\n');
  for (const opinion of decision.opinions) {
    const icon = opinion.verdict === 'trade' ? '✅' : '❌';
    const conf = (opinion.confidence * 100).toFixed(0);
    console.log(`  ${icon} ${opinion.member.padEnd(12)} (${opinion.model})`);
    console.log(`     Verdict: ${opinion.verdict.toUpperCase()}  |  Confidence: ${conf}%`);
    console.log(`     ${opinion.reasoning.slice(0, 200)}`);
    console.log();
  }

  console.log('─'.repeat(70));
  const actionEmoji = decision.action === 'pass' ? '🛑' : '🟢';
  console.log(`  ${actionEmoji} FINAL: ${decision.action.toUpperCase()}  |  Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
  console.log(`  💬 ${decision.reasoning.slice(0, 300)}`);
  console.log(`  ⏱️  Deliberation: ${(decision.deliberationMs / 1000).toFixed(1)}s`);
  console.log('═'.repeat(70) + '\n');
}

// ── Cycle Interval ──────────────────────────────────────────────────
const CYCLE_INTERVAL_MS = parseInt(process.env.CYCLE_INTERVAL_MS || '300000', 10); // default 5 min

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Single Cycle ────────────────────────────────────────────────────
async function runCycle(): Promise<void> {
  const config = loadConfig();
  console.log(`  Mode: ${config.paperTrading ? '📄 PAPER TRADING' : '🔴 LIVE TRADING'}`);
  console.log(`  Min Spread: ${(config.minSpread * 100).toFixed(0)}%\n`);

  // Scan live markets, fall back to demo data
  let scanned = await scanOpportunities();
  if (scanned.length === 0) {
    console.log('⚠️  Live scan returned no opportunities — using demo data as fallback\n');
    scanned = DEMO_OPPORTUNITIES;
  } else {
    console.log(`🌐 Using ${scanned.length} live market opportunities\n`);
  }

  // Filter by minimum spread
  const opportunities = scanned.filter((o) => o.spread >= config.minSpread);

  if (opportunities.length === 0) {
    console.log('No opportunities above minimum spread threshold.');
    return;
  }

  console.log(`Found ${opportunities.length} opportunities above ${(config.minSpread * 100).toFixed(0)}% spread\n`);

  for (const opp of opportunities) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`🎯 Evaluating: ${opp.event}`);
    console.log(`${'─'.repeat(70)}`);

    // Run the council (4 analysts via Bankr, Arbiter via Venice private inference)
    const decision = await runCouncil(opp, config.bankrApiKey, config.veniceApiKey);

    // Log on-chain (skips if no contract or if pass)
    if (decision.action !== 'pass') {
      await logDecision(decision, config);
    } else {
      console.log('  📝 Pass — skipping on-chain log');
    }

    // Execute trade (paper or live)
    if (decision.action !== 'pass') {
      const isPoly = decision.action.startsWith('buy_poly');
      const result = isPoly
        ? await executePolymarket(decision)
        : await executeKalshi(decision);

      console.log(`  📋 Trade result: ${result.status} — ${result.action} @ ${(result.price * 100).toFixed(1)}¢`);
    } else {
      console.log('  🛑 Council voted PASS — no trade executed');
    }

    // Print summary
    printSummary(decision);
  }

  console.log('✅ Kairos v2 cycle complete.\n');
}

// ── Main (continuous loop) ──────────────────────────────────────────
async function main(): Promise<void> {
  console.log('\n🔮 Kairos v2 — Prediction Market Arbitrage Engine\n');
  console.log(`  Cycle interval: ${CYCLE_INTERVAL_MS / 1000}s\n`);

  let cycle = 0;
  while (true) {
    cycle++;
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🔄 Cycle #${cycle} — ${new Date().toISOString()}`);
    console.log(`${'═'.repeat(70)}\n`);

    try {
      await runCycle();
    } catch (err) {
      console.error(`❌ Cycle #${cycle} error:`, err);
    }

    console.log(`⏳ Sleeping ${CYCLE_INTERVAL_MS / 1000}s until next cycle...\n`);
    await sleep(CYCLE_INTERVAL_MS);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
