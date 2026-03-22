"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const CONTRACT = "0xec8c7f2f2468c19a337bc6ba68a122d0cdff4608" as const;

const client = createPublicClient({
  chain: base,
  transport: http(
    process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"
  ),
});

const TOTAL_DECISIONS_ABI = [
  {
    inputs: [],
    name: "totalDecisions",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const GET_DECISION_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "id", type: "uint256" }],
    name: "getDecision",
    outputs: [
      {
        components: [
          { internalType: "string", name: "market", type: "string" },
          { internalType: "string", name: "decision", type: "string" },
          { internalType: "uint256", name: "confidence", type: "uint256" },
          { internalType: "string", name: "metadata", type: "string" },
          { internalType: "uint256", name: "timestamp", type: "uint256" },
          { internalType: "address", name: "reporter", type: "address" },
        ],
        internalType: "struct KairosLogger.Decision",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface Deliberation {
  id: number;
  market: string;
  decision: string;
  confidence: number; // basis points (0-10000)
  timestamp: number;
}

const REFRESH_INTERVAL_MS = 60_000;

export default function DeliberationHistory() {
  const [deliberations, setDeliberations] = useState<Deliberation[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDeliberations = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      // Primary path: direct contract reads (works on all public RPCs)
      const totalRaw = await client.readContract({
        address: CONTRACT,
        abi: TOTAL_DECISIONS_ABI,
        functionName: "totalDecisions",
      });
      const total = Number(totalRaw);
      setTotalCount(total);

      if (total === 0) {
        setDeliberations([]);
        setError(null);
        return;
      }

      // Fetch latest 20 decisions via individual readContract calls
      // (avoids multicall which may not be supported on all public RPCs)
      const count = Math.min(total, 20);
      const start = total - count;

      const results = await Promise.all(
        Array.from({ length: count }, (_, i) =>
          client
            .readContract({
              address: CONTRACT,
              abi: GET_DECISION_ABI,
              functionName: "getDecision",
              args: [BigInt(start + i)],
            })
            .then((d) => ({
              id: start + i,
              market: d.market,
              decision: d.decision,
              confidence: Number(d.confidence),
              timestamp: Number(d.timestamp),
            }))
            .catch(() => null)
        )
      );

      const parsed: Deliberation[] = results
        .filter((d): d is Deliberation => d !== null)
        .reverse(); // newest first

      setDeliberations(parsed);
      setError(null);
    } catch (err: unknown) {
      console.error("Failed to fetch deliberations:", err);
      if (isInitial) setError("Unable to load deliberation history");
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliberations(true);

    intervalRef.current = setInterval(() => {
      fetchDeliberations(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchDeliberations]);

  function formatConfidence(basisPoints: number): string {
    return `${(basisPoints / 100).toFixed(0)}%`;
  }

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

  function getVerdictStyle(decision: string): string {
    const d = decision.toUpperCase();
    if (d.includes("BUY") || d.includes("APPROVE") || d.includes("YES"))
      return "text-emerald-400";
    if (d.includes("SELL") || d.includes("REJECT") || d.includes("NO"))
      return "text-red-400";
    if (
      d.includes("HOLD") ||
      d.includes("SKIP") ||
      d.includes("ABSTAIN") ||
      d.includes("PASS")
    )
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
              {error
                ? "Unable to reach Base mainnet"
                : "The council is deliberating…"}
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
          {/* Count badge */}
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-3 border border-zinc-700/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono text-zinc-300">
              {totalCount} decision{totalCount !== 1 ? "s" : ""} on-chain
            </span>
          </div>
        </div>

        {/* Desktop: table */}
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
                </tr>
              </thead>
              <tbody>
                {deliberations.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {d.id}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300 max-w-[300px] truncate">
                      {d.market}
                    </td>
                    <td
                      className={`px-4 py-3 font-mono text-xs font-bold uppercase ${getVerdictStyle(
                        d.decision
                      )}`}
                    >
                      {d.decision}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {formatConfidence(d.confidence)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {formatTimestamp(d.timestamp)}
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
            <div key={d.id} className="card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-500">
                  #{d.id}
                </span>
                <span
                  className={`font-mono text-xs font-bold uppercase ${getVerdictStyle(
                    d.decision
                  )}`}
                >
                  {d.decision}
                </span>
              </div>
              <p className="text-sm text-zinc-300 truncate">{d.market}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-zinc-500">
                  {formatConfidence(d.confidence)} confidence
                </span>
                <span className="font-mono text-zinc-600">
                  {formatTimestamp(d.timestamp)}
                </span>
              </div>
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
