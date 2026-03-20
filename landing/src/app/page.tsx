import DeliberationHistory from "./components/DeliberationHistory";

const COUNCIL = [
  {
    name: "Technician",
    model: "Claude Sonnet 4.6",
    provider: "Bankr",
    emoji: "🔬",
    color: "from-blue-500/20 to-blue-600/5",
    border: "border-blue-500/20",
    tagColor: "text-blue-400",
    description: "Reads the order book like a surgeon reads an X-ray",
    role: "Technical Analysis",
    isVenice: false,
  },
  {
    name: "Sentinel",
    model: "Gemini 3 Flash",
    provider: "Bankr",
    emoji: "⚡",
    color: "from-amber-500/20 to-amber-600/5",
    border: "border-amber-500/20",
    tagColor: "text-amber-400",
    description: "First to know, fastest to react",
    role: "Real-Time Intelligence",
    isVenice: false,
  },
  {
    name: "Detective",
    model: "Gemini 3 Pro",
    provider: "Bankr",
    emoji: "🔍",
    color: "from-emerald-500/20 to-emerald-600/5",
    border: "border-emerald-500/20",
    tagColor: "text-emerald-400",
    description: "Finds the story behind the spread",
    role: "Deep Research",
    isVenice: false,
  },
  {
    name: "Devil",
    model: "GPT 5.4 Mini",
    provider: "Bankr",
    emoji: "😈",
    color: "from-red-500/20 to-red-600/5",
    border: "border-red-500/20",
    tagColor: "text-red-400",
    description: "Paid to say no",
    role: "Devil\u2019s Advocate",
    isVenice: false,
  },
  {
    name: "Arbiter",
    model: "DeepSeek v3.2",
    provider: "Venice AI",
    emoji: "⚖️",
    color: "from-violet-500/30 to-purple-600/10",
    border: "border-violet-400/30",
    tagColor: "text-violet-300",
    description: "The final word — deliberates in private",
    role: "Final Decision",
    isVenice: true,
  },
] as const;

const STEPS = [
  {
    number: "01",
    title: "Detect",
    description:
      "Scan prediction markets for price gaps across platforms. When a spread exceeds threshold, the council convenes.",
    icon: "◎",
  },
  {
    number: "02",
    title: "Deliberate",
    description:
      "Five LLMs analyze the opportunity independently, then debate. Each brings a different lens — technical, speed, research, skepticism, judgment.",
    icon: "◈",
  },
  {
    number: "03",
    title: "Decide",
    description:
      "The Arbiter synthesizes all perspectives into a final verdict. The full deliberation — every argument, every dissent — is logged on-chain.",
    icon: "◆",
  },
] as const;

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-surface-0/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-semibold text-white tracking-tight">
            Kairos
          </span>
          <a
            href="https://github.com/0xzaen/kairos"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted hover:text-white transition-colors"
          >
            GitHub →
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.08),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-2 border border-zinc-800/80 text-xs text-muted mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-slow" />
            Autonomous prediction market arbitrage
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight gradient-text pb-2">
            Kairos
          </h1>
          <p className="mt-4 sm:mt-6 text-lg sm:text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto leading-relaxed font-light">
            Five AIs walk into a prediction market.
            <br />
            They disagree.{" "}
            <span className="text-white font-normal">
              The blockchain remembers.
            </span>
          </p>
          <p className="mt-6 text-base text-muted max-w-xl mx-auto leading-relaxed">
            An autonomous system where five large language models independently
            analyze prediction market price gaps, deliberate as a council, and
            record every decision on-chain — permanently.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <a
              href="#how-it-works"
              className="px-6 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors"
            >
              How it works
            </a>
            <a
              href="https://github.com/0xzaen/kairos"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 bg-surface-2 text-zinc-300 text-sm font-medium rounded-lg border border-zinc-800 hover:border-zinc-700 hover:text-white transition-colors"
            >
              View source
            </a>
          </div>
          <div className="mt-8">
            <a
              href="https://diverge.market"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2/60 border border-zinc-800/50 text-[11px] text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors"
            >
              <span className="w-1 h-1 rounded-full bg-indigo-500/80" />
              <span>
                Data by{" "}
                <span className="text-zinc-400 font-medium">Diverge</span>
                <span className="hidden sm:inline"> — 59K markets, 200+ matches</span>
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-light mb-3">
              Pipeline
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              How it works
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.number} className="relative group">
                <div className="card p-8 h-full hover:border-zinc-700/80 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl text-accent-light">
                      {step.icon}
                    </span>
                    <span className="text-xs font-mono text-muted">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">
                    {step.description}
                  </p>
                </div>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 text-zinc-700 text-lg">
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Council */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-surface-1/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-light mb-3">
              The Council
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Five minds. One decision.
            </h2>
            <p className="mt-4 text-muted max-w-lg mx-auto">
              Each council member brings a distinct perspective. They analyze
              independently, then deliberate together.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {COUNCIL.map((member) => (
              <div
                key={member.name}
                className={`card bg-gradient-to-b ${member.color} ${member.border} p-5 hover:scale-[1.02] transition-transform duration-200 ${
                  member.isVenice ? "ring-1 ring-violet-500/20 relative overflow-hidden" : ""
                }`}
              >
                {member.isVenice && (
                  <div className="absolute top-0 right-0 px-2 py-0.5 bg-violet-500/20 text-[9px] font-mono text-violet-300 uppercase tracking-wider rounded-bl-lg">
                    Private Inference
                  </div>
                )}
                <div className="text-2xl mb-3">{member.emoji}</div>
                <h3 className="text-white font-semibold text-sm">
                  {member.name}
                </h3>
                <p className={`text-xs ${member.tagColor} font-mono mt-0.5`}>
                  {member.model}
                </p>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                  via {member.provider}
                </p>
                <p className="text-xs text-muted mt-1 mb-3">{member.role}</p>
                <p className="text-xs text-zinc-400 italic leading-relaxed">
                  &ldquo;{member.description}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Venice AI Callout */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-950/30 via-surface-2 to-surface-2 p-6 sm:p-8 overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex flex-col sm:flex-row items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-lg">
                🔒
              </div>
              <div>
                <h3 className="text-sm font-semibold text-violet-300 mb-2">
                  Private Inference via Venice AI
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  The Arbiter deliberates privately on{" "}
                  <a
                    href="https://venice.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-300 hover:text-violet-200 transition-colors underline underline-offset-2 decoration-violet-500/30"
                  >
                    Venice AI
                  </a>
                  {" "}— reasoning never leaves their servers. No logs, no training on your data, no surveillance.
                  Only the final verdict hits the chain.
                </p>
                <p className="text-xs text-zinc-500 mt-3 font-mono">
                  DeepSeek v3.2 · Zero-knowledge inference · End-to-end privacy
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-light mb-3">
              Architecture
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              The pipeline
            </h2>
          </div>
          <div className="flex flex-col items-center gap-0">
            {/* Box 1: Price Gap Detector */}
            <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-8 text-center">
              <h3 className="text-base sm:text-lg font-bold text-white mb-1">PRICE GAP DETECTOR</h3>
              <p className="text-xs sm:text-sm text-zinc-500">Polymarket ↔ Kalshi ↔ Others</p>
            </div>
            {/* Arrow 1 */}
            <div className="flex flex-col items-center py-2">
              <div className="w-px h-6 bg-zinc-700" />
              <span className="text-[10px] sm:text-xs text-zinc-500 font-mono my-1">spread &gt; threshold</span>
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-zinc-600" />
            </div>
            {/* Box 2: Independent Analysis */}
            <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-8 text-center">
              <h3 className="text-base sm:text-lg font-bold text-white mb-4">INDEPENDENT ANALYSIS</h3>
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                {[
                  { tag: "TECH", model: "Sonnet 4.6", color: "border-blue-500/30 text-blue-400" },
                  { tag: "SENT", model: "Gemini Flash", color: "border-amber-500/30 text-amber-400" },
                  { tag: "DETC", model: "Gemini Pro", color: "border-emerald-500/30 text-emerald-400" },
                  { tag: "DEVL", model: "GPT 5.4m", color: "border-red-500/30 text-red-400" },
                  { tag: "ARBT", model: "DS v3.2", color: "border-violet-500/30 text-violet-400" },
                ].map((a) => (
                  <div
                    key={a.tag}
                    className={`rounded-lg border ${a.color.split(" ")[0]} ${
                      a.tag === "ARBT" ? "bg-violet-900/20 ring-1 ring-violet-500/10" : "bg-zinc-800/60"
                    } px-3 py-2 sm:px-4 sm:py-2.5 min-w-[4.5rem] sm:min-w-[5.5rem]`}
                  >
                    <div className={`text-xs sm:text-sm font-bold ${a.color.split(" ")[1]}`}>{a.tag}</div>
                    <div className="text-[10px] sm:text-xs text-zinc-500 font-mono">{a.model}</div>
                    {a.tag === "ARBT" && (
                      <div className="text-[8px] text-violet-400/60 font-mono mt-0.5">Venice AI</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* Arrow 2 */}
            <div className="flex flex-col items-center py-2">
              <div className="w-px h-6 bg-zinc-700" />
              <span className="text-[10px] sm:text-xs text-zinc-500 font-mono my-1">5 independent reports</span>
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-zinc-600" />
            </div>
            {/* Box 3: Council Deliberation */}
            <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-8 text-center">
              <h3 className="text-base sm:text-lg font-bold text-white mb-1">COUNCIL DELIBERATION</h3>
              <p className="text-xs sm:text-sm text-zinc-500">Arguments → Rebuttals → Final Positions → Arbiter Synthesis</p>
            </div>
            {/* Arrow 3 */}
            <div className="flex flex-col items-center py-2">
              <div className="w-px h-6 bg-zinc-700" />
              <span className="text-[10px] sm:text-xs text-zinc-500 font-mono my-1">verdict + confidence</span>
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-zinc-600" />
            </div>
            {/* Box 4: On-Chain Logging */}
            <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-8 text-center">
              <h3 className="text-base sm:text-lg font-bold text-white mb-1">ON-CHAIN LOGGING</h3>
              <p className="text-xs sm:text-sm text-zinc-500">ERC-8004 · Full transcript · Vote breakdown · Timestamp</p>
            </div>
          </div>
        </div>
      </section>

      {/* On-Chain */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-surface-1/50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-2 border border-zinc-800/80 text-xs text-muted mb-6">
            <span className="font-mono text-accent-light">ERC-8004</span>
            Deliberation Standard
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
            Every decision. Every disagreement.
            <br />
            <span className="gradient-text">Permanent.</span>
          </h2>
          <p className="text-sm sm:text-base text-muted max-w-xl mx-auto leading-relaxed mb-8">
            Kairos logs the full deliberation on-chain — not just the outcome,
            but every argument, every dissent, every confidence score. If an AI
            council makes a decision, you should be able to see exactly how they
            got there.
          </p>
          <div className="card p-4 sm:p-6 md:p-8 max-w-lg mx-auto text-left overflow-hidden">
            <pre className="font-mono text-[10px] sm:text-xs text-zinc-500 leading-relaxed overflow-x-auto">
              {`{
  "deliberationId": "0x7a3f...c891",
  "market": "US_ELECTION_2024",
  "spread": 0.047,
  "verdict": "BUY",
  "confidence": 0.82,
  "votes": {
    "for": ["Technician", "Sentinel", "Detective"],
    "against": ["Devil"],
    "synthesized": ["Arbiter"]
  },
  "timestamp": 1703894400,
  "txHash": "0x9b2e...f134"
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Deliberation History */}
      <DeliberationHistory />

      {/* Footer */}
      <footer className="py-8 sm:py-12 px-4 sm:px-6 border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-white">Kairos</span>
            <a
              href="https://github.com/0xzaen/kairos"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-600">
            <span>Built for The Synthesis</span>
            <span>·</span>
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
