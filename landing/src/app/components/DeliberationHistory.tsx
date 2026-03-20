"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, parseAbiItem, formatUnits } from "viem";
import { base } from "viem/chains";

const CONTRACT = "0xa31c6c7f3785aec4e60e3e73868ab126263a24be" as const;

const client = createPublicClient({
  chain: base,
  transport: http(
    process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"
  ),
});

const DECISION_LOGGED_EVENT = parseAbiItem(
  "event DecisionLogged(uint256 indexed id, string market, string decision, uint256 confidence, uint256 timestamp)"
);

interface Deliberation {
  id: bigint;
  market: string;
  decision: string;
  confidence: number;
  timestamp: number;
  txHash: string;
}

export default function DeliberationHistory() {
  const [deliberations, setDeliberations] = useState<Deliberation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDeliberations() {
      try {
        // Get the latest block to calculate a reasonable range
        const latestBlock = await client.getBlockNumber();
        // Search last ~500k blocks (~2 weeks on Base)
        const fromBlock = latestBlock > BigInt(500_000) ? latestBlock - BigInt(500_000) : BigInt(0);

        const logs = await client.getLogs({
          address: CONTRACT,
          event: DECISION_LOGGED_EVENT,
          fromBlock,
          toBlock: "latest",
        });

        const parsed: Deliberation[] = logs
          .map((log) => ({
            id: (log.args as { id?: bigint }).id ?? BigInt(0),
            market: (log.args as { market?: string }).market ?? "",
            decision: (log.args as { decision?: string }).decision ?? "",
            confidence: Number(
              (log.args as { confidence?: bigint }).confidence ?? BigInt(0)
            ),
            timestamp: Number(
              (log.args as { timestamp?: bigint }).timestamp ?? BigInt(0)
            ),
            txHash: log.transactionHash ?? "",
          }))
          .reverse()
          .slice(0, 20); // Show latest 20

        setDeliberations(parsed);
      } catch (err: unknown) {
        console.error("Failed to fetch deliberations:", err);
        // Fallback: try reading totalDecisions and fetching individually
        try {
          await fetchViaReads();
        } catch {
          setError("Unable to load deliberation history");
        }
      } finally {
        setLoading(false);
      }
    }

    async function fetchViaReads() {
      const totalRaw = await client.readContract({
        address: CONTRACT,
        abi: [
          {
            inputs: [],
            name: "totalDecisions",
            outputs: [
              { internalType: "uint256", name: "", type: "uint256" },
            ],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "totalDecisions",
      });
      const total = Number(totalRaw);
      if (total === 0) {
        setDeliberations([]);
        return;
      }

      const count = Math.min(total, 20);
      const start = total - count;
      const calls = Array.from({ length: count }, (_, i) => ({
        address: CONTRACT as `0x${string}`,
        abi: [
          {
            inputs: [
              { internalType: "uint256", name: "id", type: "uint256" },
            ],
            name: "getDecision",
            outputs: [
              {
                components: [
                  { internalType: "string", name: "market", type: "string" },
                  {
                    internalType: "string",
                    name: "decision",
                    type: "string",
                  },
                  {
                    internalType: "uint256",
                    name: "confidence",
                    type: "uint256",
                  },
                  {
                    internalType: "string",
                    name: "metadata",
                    type: "string",
                  },
                  {
                    internalType: "uint256",
                    name: "timestamp",
                    type: "uint256",
                  },
                  {
                    internalType: "address",
                    name: "reporter",
                    type: "address",
                  },
                ],
                internalType: "struct KairosLogger.Decision",
                name: "",
                type: "tuple",
              },
            ],
            stateMutability: "view",
            type: "function",
          },
        ] as const,
        functionName: "getDecision" as const,
        args: [BigInt(start + i)] as readonly [bigint],
      }));

      const results = await client.multicall({ contracts: calls });

      const parsed: Deliberation[] = results
        .map((r, i) => {
          if (r.status !== "success" || !r.result) return null;
          const d = r.result as {
            market: string;
            decision: string;
            confidence: bigint;
            metadata: string;
            timestamp: bigint;
            reporter: string;
          };
          return {
            id: BigInt(start + i),
            market: d.market,
            decision: d.decision,
            confidence: Number(d.confidence),
            timestamp: Number(d.timestamp),
            txHash: "", // Not available from reads
          };
        })
        .filter((d): d is Deliberation => d !== null)
        .reverse();

      setDeliberations(parsed);
    }

    fetchDeliberations();
  }, []);

  function formatTimestamp(ts: number): string {
    if (ts === 0) return "—";
    return new Date(ts * 1000).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  function truncateHash(hash: string): string {
    if (!hash) return "";
    return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
  }

  function getVerdictStyle(decision: string): string {
    const d = decision.toUpperCase();
    if (d.includes("BUY") || d.includes("APPROVE") || d.includes("YES"))
      return "text-emerald-400";
    if (d.includes("SELL") || d.includes("REJECT") || d.includes("NO"))
      return "text-red-400";
    if (d.includes("HOLD") || d.includes("SKIP") || d.includes("ABSTAIN"))
      return "text-amber-400";
    return "text-zinc-300";
  }

  if (loading) {
    return (
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-light mb-3">
              On-Chain Record
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Deliberation History
            </h2>
          </div>
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-muted text-sm">
              <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
              Reading from Base mainnet…
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error || deliberations.length === 0) {
    return (
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-light mb-3">
              On-Chain Record
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Deliberation History
            </h2>
          </div>
          <div className="card p-8 sm:p-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface-3 border border-zinc-700/50 mb-4">
              <span className="text-xl">⚖️</span>
            </div>
            <p className="text-zinc-300 text-sm font-medium mb-1">
              {error ? "Unable to reach Base mainnet" : "The council is deliberating…"}
            </p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
              {error
                ? "Check back shortly — on-chain data will appear here once the connection is restored."
                : "No verdicts on-chain yet. When the council reaches its first decision, it will appear here — permanently."}
            </p>
            <a
              href={`https://basescan.org/address/${CONTRACT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-6 text-xs text-accent-light hover:text-white transition-colors font-mono"
            >
              <span className="w-1 h-1 rounded-full bg-accent-light/60" />
              View contract on BaseScan →
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-light mb-3">
            On-Chain Record
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Deliberation History
          </h2>
          <p className="mt-4 text-muted max-w-lg mx-auto text-sm">
            Live from Base mainnet. Every council decision, permanently recorded.
          </p>
        </div>

        {/* Mobile: cards / Desktop: table */}
        <div className="hidden md:block">
          <div className="card overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-800/80">
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                    #
                  </th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                    Market
                  </th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                    Verdict
                  </th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                    Confidence
                  </th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                    Time
                  </th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                    Tx
                  </th>
                </tr>
              </thead>
              <tbody>
                {deliberations.map((d) => (
                  <tr
                    key={d.id.toString()}
                    className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {d.id.toString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300 max-w-[200px] truncate">
                      {d.market}
                    </td>
                    <td
                      className={`px-4 py-3 font-mono text-xs font-bold ${getVerdictStyle(
                        d.decision
                      )}`}
                    >
                      {d.decision}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {d.confidence}%
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {formatTimestamp(d.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      {d.txHash ? (
                        <a
                          href={`https://basescan.org/tx/${d.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-accent-light hover:text-white transition-colors"
                        >
                          {truncateHash(d.txHash)}
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {deliberations.map((d) => (
            <div
              key={d.id.toString()}
              className="card p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-500">
                  #{d.id.toString()}
                </span>
                <span
                  className={`font-mono text-xs font-bold ${getVerdictStyle(
                    d.decision
                  )}`}
                >
                  {d.decision}
                </span>
              </div>
              <p className="text-sm text-zinc-300 truncate">{d.market}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-zinc-500">
                  {d.confidence}% confidence
                </span>
                <span className="font-mono text-zinc-600">
                  {formatTimestamp(d.timestamp)}
                </span>
              </div>
              {d.txHash && (
                <a
                  href={`https://basescan.org/tx/${d.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-mono text-xs text-accent-light hover:text-white transition-colors"
                >
                  {truncateHash(d.txHash)} →
                </a>
              )}
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <a
            href={`https://basescan.org/address/${CONTRACT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs text-muted hover:text-white transition-colors font-mono"
          >
            View all on BaseScan →
          </a>
        </div>
      </div>
    </section>
  );
}
