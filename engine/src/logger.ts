// Kairos v2 — On-Chain Logger (Base mainnet via ERC-8004)

import { createWalletClient, createPublicClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import type { Decision } from './types.js';
import type { Config } from './config.js';

const ABI = [
  {
    inputs: [
      { name: 'market', type: 'string' },
      { name: 'decision', type: 'string' },
      { name: 'confidence', type: 'uint256' },
      { name: 'metadata', type: 'string' },
    ],
    name: 'logDecision',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalDecisions',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export async function logDecision(decision: Decision, config: Config): Promise<string | null> {
  if (!config.loggerContract || !config.privateKey) {
    console.log('  ℹ On-chain logging skipped (no contract/key configured)');
    return null;
  }

  const metadata = JSON.stringify({
    action: decision.action,
    opinions: decision.opinions.map((o) => ({
      member: o.member,
      model: o.model,
      verdict: o.verdict,
      confidence: o.confidence,
      reasoning: o.reasoning,
    })),
    opportunity: {
      event: decision.opportunity.event,
      polyYes: decision.opportunity.polymarketYes,
      kalshiYes: decision.opportunity.kalshiYes,
      spread: decision.opportunity.spread,
    },
    deliberationMs: decision.deliberationMs,
  });

  try {
    const account = privateKeyToAccount((`0x${config.privateKey.replace('0x', '')}`) as Hex);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(config.baseRpcUrl),
    });
    const publicClient = createPublicClient({
      chain: base,
      transport: http(config.baseRpcUrl),
    });

    const confidenceBps = Math.round(decision.confidence * 10000); // 0.88 → 8800

    const hash = await walletClient.writeContract({
      address: config.loggerContract as `0x${string}`,
      abi: ABI,
      functionName: 'logDecision',
      args: [
        decision.opportunity.event,
        decision.action,
        BigInt(confidenceBps),
        metadata,
      ],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  📝 Logged on-chain: https://basescan.org/tx/${hash}`);
    return hash;
  } catch (err: any) {
    console.error(`  ⚠ On-chain logging failed: ${err.message}`);
    return null;
  }
}
