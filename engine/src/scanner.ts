// Kairos v2 — Live Market Scanner
// Ported from Diverge's battle-tested matching logic (203 matches across 59K markets)

import type { Opportunity } from './types.js';

// ── Diverge-compatible Market interface ─────────────────────────────

interface Market {
  id: number;
  platform: 'polymarket' | 'kalshi';
  title: string;
  category?: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  expiresAt: string;
}

// ── Polymarket Types ────────────────────────────────────────────────

interface PolymarketRawMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  endDate: string;
  liquidity: string;
  volume: string;
  volume24hr: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  outcomePrices: string; // JSON: '["0.65","0.35"]'
  acceptingOrders: boolean;
}

// ── Kalshi Types ────────────────────────────────────────────────────

interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle: string;
  status: string;
  close_time: string;
  expiration_time: string;
  // Kalshi API v2 returns dollar strings, not cent integers
  yes_bid_dollars: string;
  yes_ask_dollars: string;
  no_bid_dollars: string;
  no_ask_dollars: string;
  last_price_dollars: string;
  volume_fp: string;
  volume_24h_fp: string;
  open_interest_fp: string;
  liquidity_dollars: string;
  category: string;
}

interface KalshiEvent {
  event_ticker: string;
  series_ticker: string;
  title: string;
  category: string;
  sub_title: string;
  mutually_exclusive: boolean;
  markets: KalshiMarket[];
}

// ── Title Normalization (from Diverge matching.ts) ──────────────────

const STOP_WORDS = new Set([
  "will", "the", "a", "an", "be", "by", "in", "on", "at", "to", "of",
  "or", "and", "is", "for", "this", "that", "it", "its", "than", "from",
]);

function normalize(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => !STOP_WORDS.has(w) && w.length > 1)
    .join(" ")
    .trim();
}

// ── Feature Extraction (from Diverge matching.ts) ───────────────────

interface MarketFeatures {
  normalizedTitle: string;
  entity?: string;
  date?: string;
  threshold?: number;
  direction?: "above" | "below" | "yes" | "no";
  category?: string;
}

const DATE_PATTERNS = [
  /(\d{4})-(\d{2})-(\d{2})/,
  /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}/i,
  /\d{1,2}\/\d{1,2}\/\d{4}/,
  /(?:by|before|on|after)\s+((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2})/i,
];

const PRICE_PATTERNS = [
  /\$[\d,]+(?:\.\d+)?(?:k|m|b)?/i,
  /[\d,]+(?:\.\d+)?\s*(?:dollars|usd)/i,
  /[\d.]+%/,
];

const ENTITY_ALIASES: Record<string, string[]> = {
  bitcoin: ["btc", "bitcoin"],
  ethereum: ["eth", "ethereum", "ether"],
  solana: ["sol", "solana"],
  trump: ["trump", "donald trump"],
  fed: ["fed", "federal reserve", "fomc"],
  sp500: ["s&p 500", "s&p", "sp500", "spy"],
};

function extractFeatures(market: Market): MarketFeatures {
  const title = market.title;
  const normalized = normalize(title);

  let entity: string | undefined;
  for (const [canonical, aliases] of Object.entries(ENTITY_ALIASES)) {
    if (aliases.some((a) => normalized.includes(a))) {
      entity = canonical;
      break;
    }
  }

  let date: string | undefined;
  for (const pattern of DATE_PATTERNS) {
    const match = title.match(pattern);
    if (match) {
      date = match[0];
      break;
    }
  }

  let threshold: number | undefined;
  for (const pattern of PRICE_PATTERNS) {
    const match = title.match(pattern);
    if (match) {
      threshold = parseFloat(match[0].replace(/[$,%]/g, "").replace(/k/i, "000").replace(/m/i, "000000"));
      break;
    }
  }

  let direction: MarketFeatures["direction"];
  if (/above|exceed|over|higher|more than|reach/i.test(title)) direction = "above";
  if (/below|under|lower|less than|drop/i.test(title)) direction = "below";

  return { normalizedTitle: normalized, entity, date, threshold, direction, category: market.category };
}

// ── Similarity Scoring (from Diverge matching.ts) ───────────────────

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(" "));
  const setB = new Set(b.split(" "));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

// ── Two-Pass Matching (from Diverge matching.ts) ────────────────────

interface MatchCandidate {
  polymarket: Market;
  kalshi: Market;
  confidence: number;
  method: 'auto_structured' | 'auto_fuzzy';
}

function findMatches(
  polymarketMarkets: Market[],
  kalshiMarkets: Market[],
  minConfidence = 0.6
): MatchCandidate[] {
  const matches: MatchCandidate[] = [];
  const usedKalshi = new Set<number>();
  const matchedPoly = new Set<number>();

  const polyFeatures = polymarketMarkets.map((m) => ({ market: m, features: extractFeatures(m) }));
  const kalshiFeatures = kalshiMarkets.map((m) => ({ market: m, features: extractFeatures(m) }));

  let structuredCount = 0;
  let fuzzyCount = 0;

  // Pass 1: Structured matching — index Kalshi by entity for O(n) lookup
  const kalshiByEntity = new Map<string, typeof kalshiFeatures>();
  for (const km of kalshiFeatures) {
    if (km.features.entity) {
      let bucket = kalshiByEntity.get(km.features.entity);
      if (!bucket) {
        bucket = [];
        kalshiByEntity.set(km.features.entity, bucket);
      }
      bucket.push(km);
    }
  }

  for (const pm of polyFeatures) {
    if (!pm.features.entity) continue;
    const candidates = kalshiByEntity.get(pm.features.entity);
    if (!candidates) continue;

    for (const km of candidates) {
      if (usedKalshi.has(km.market.id)) continue;

      const pmf = pm.features;
      const kmf = km.features;

      let confidence = 0.5;

      if (pmf.date && kmf.date && pmf.date === kmf.date) confidence += 0.15;
      if (pmf.direction && pmf.direction === kmf.direction) confidence += 0.05;

      if (pmf.threshold && kmf.threshold) {
        const ratio = Math.min(pmf.threshold, kmf.threshold) / Math.max(pmf.threshold, kmf.threshold);
        if (ratio >= 0.90) confidence += 0.25;
        else if (ratio >= 0.70) confidence += 0.10;
        else confidence -= 0.10;
      } else if (pmf.threshold || kmf.threshold) {
        confidence -= 0.05;
      }

      if (confidence >= minConfidence) {
        matches.push({
          polymarket: pm.market,
          kalshi: km.market,
          confidence: Math.min(confidence, 1.0),
          method: 'auto_structured',
        });
        usedKalshi.add(km.market.id);
        matchedPoly.add(pm.market.id);
        structuredCount++;
        break;
      }
    }
  }

  // Pass 2: Fuzzy matching — use inverted index on tokens to find candidates
  // Build inverted index: token → list of kalshi indices
  const tokenToKalshi = new Map<string, number[]>();
  const kalshiTokenSets: Set<string>[] = [];
  for (let i = 0; i < kalshiFeatures.length; i++) {
    const tokens = new Set(kalshiFeatures[i].features.normalizedTitle.split(" "));
    kalshiTokenSets.push(tokens);
    for (const token of tokens) {
      let list = tokenToKalshi.get(token);
      if (!list) {
        list = [];
        tokenToKalshi.set(token, list);
      }
      list.push(i);
    }
  }

  for (const pm of polyFeatures) {
    if (matchedPoly.has(pm.market.id)) continue;

    const polyTokens = new Set(pm.features.normalizedTitle.split(" "));

    // Find candidate Kalshi markets that share at least one token
    const candidateScores = new Map<number, number>();
    for (const token of polyTokens) {
      const indices = tokenToKalshi.get(token);
      if (!indices) continue;
      for (const idx of indices) {
        candidateScores.set(idx, (candidateScores.get(idx) || 0) + 1);
      }
    }

    // Only evaluate candidates with enough shared tokens for possible min confidence
    // Jaccard >= minConfidence/0.85 requires intersection/union >= threshold
    let bestMatch: MatchCandidate | null = null;

    for (const [idx, sharedCount] of candidateScores) {
      if (usedKalshi.has(kalshiFeatures[idx].market.id)) continue;
      // Quick upper-bound check: sharedCount / min(|A|,|B|) as upper bound
      const kalshiTokens = kalshiTokenSets[idx];
      const unionSize = polyTokens.size + kalshiTokens.size - sharedCount;
      const similarity = sharedCount / unionSize;
      const confidence = similarity * 0.85;

      if (confidence >= minConfidence && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = {
          polymarket: pm.market,
          kalshi: kalshiFeatures[idx].market,
          confidence,
          method: 'auto_fuzzy',
        };
      }
    }

    if (bestMatch) {
      matches.push(bestMatch);
      usedKalshi.add(bestMatch.kalshi.id);
      fuzzyCount++;
    }
  }

  console.log(`[Scanner] Matching: ${structuredCount} structured + ${fuzzyCount} fuzzy = ${matches.length} total`);

  return matches.sort((a, b) => b.confidence - a.confidence);
}

// ── Polymarket Fetcher (from Diverge polymarket.ts) ─────────────────

const GAMMA_API = "https://gamma-api.polymarket.com";

async function fetchPolymarketMarkets(): Promise<Market[]> {
  const allMarkets: Market[] = [];
  const maxPages = 50;
  const pageSize = 100;

  console.log(`[Scanner] Fetching markets from Polymarket (up to ${maxPages} pages)...`);

  try {
    for (let page = 0; page < maxPages; page++) {
      const offset = page * pageSize;
      const url = `${GAMMA_API}/markets?active=true&closed=false&limit=${pageSize}&offset=${offset}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) {
        console.error(`[Scanner] Polymarket API returned ${res.status} at page ${page}`);
        break;
      }

      const raw: PolymarketRawMarket[] = await res.json() as PolymarketRawMarket[];
      if (raw.length === 0) break;

      for (const m of raw) {
        try {
          const prices: string[] = JSON.parse(m.outcomePrices);
          const yesPrice = parseFloat(prices[0]) || 0;
          const noPrice = parseFloat(prices[1]) || 0;
          if (yesPrice === 0 && noPrice === 0) continue;

          allMarkets.push({
            id: allMarkets.length + 1,
            platform: 'polymarket',
            title: m.question,
            yesPrice,
            noPrice,
            volume: parseFloat(m.volume) || 0,
            expiresAt: m.endDate || '',
          });
        } catch {
          // Skip malformed entries
        }
      }

      if (raw.length < pageSize) break;
    }

    console.log(`[Scanner] Fetched ${allMarkets.length} active Polymarket markets`);
  } catch (err) {
    console.error('[Scanner] Polymarket fetch failed:', (err as Error).message);
  }

  return allMarkets;
}

// ── Kalshi Fetcher (from Diverge kalshi.ts) ─────────────────────────

const KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getKalshiMidPrice(market: KalshiMarket): { yes: number; no: number } {
  // Kalshi API v2 returns prices as dollar strings (e.g., "0.65")
  const yesBid = parseFloat(market.yes_bid_dollars) || 0;
  const yesAsk = parseFloat(market.yes_ask_dollars) || 0;
  const noBid = parseFloat(market.no_bid_dollars) || 0;
  const noAsk = parseFloat(market.no_ask_dollars) || 0;
  const lastPrice = parseFloat(market.last_price_dollars) || 0;

  const yesPrice = (yesBid > 0 && yesAsk > 0) ? (yesBid + yesAsk) / 2 : lastPrice;
  const noPrice = (noBid > 0 && noAsk > 0) ? (noBid + noAsk) / 2 : (1 - yesPrice);

  return { yes: yesPrice, no: noPrice };
}

async function fetchKalshiEvents(
  params: { limit?: number; cursor?: string; status?: string; with_nested_markets?: boolean } = {}
): Promise<{ events: KalshiEvent[]; cursor: string }> {
  const url = new URL(`${KALSHI_API}/events`);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.cursor) url.searchParams.set("cursor", params.cursor);
  if (params.status) url.searchParams.set("status", params.status);
  if (params.with_nested_markets) url.searchParams.set("with_nested_markets", "true");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Kalshi events API error: ${res.status}`);
  return res.json() as Promise<{ events: KalshiEvent[]; cursor: string }>;
}

async function fetchAllKalshiMarkets(): Promise<Market[]> {
  const allEvents: KalshiEvent[] = [];
  let cursor: string | undefined;

  console.log(`[Scanner] Fetching Kalshi events with nested markets...`);

  try {
    while (true) {
      let result: { events: KalshiEvent[]; cursor: string };
      let retries = 0;

      // Retry loop for rate limits (from Diverge)
      while (true) {
        try {
          result = await fetchKalshiEvents({
            limit: 100,
            cursor,
            status: "open",
            with_nested_markets: true,
          });
          break;
        } catch (err: any) {
          if (err.message?.includes("429") && retries < 5) {
            retries++;
            const delay = 2000 * retries;
            console.log(`[Scanner] Kalshi rate limited, waiting ${delay}ms (retry ${retries})...`);
            await sleep(delay);
          } else {
            throw err;
          }
        }
      }

      allEvents.push(...result!.events);
      console.log(`[Scanner] Kalshi: fetched ${result!.events.length} events (total: ${allEvents.length})`);

      cursor = result!.cursor;
      if (!cursor || result!.events.length === 0) break;

      // Small delay between pages to avoid rate limits
      await sleep(300);
    }
  } catch (err) {
    console.error('[Scanner] Kalshi fetch failed:', (err as Error).message);
  }

  // Flatten events → markets
  const markets: Market[] = [];
  let marketCount = 0;

  for (const event of allEvents) {
    if (!event.markets) continue;
    for (const m of event.markets) {
      if (m.status !== 'active') continue;

      const mid = getKalshiMidPrice(m);
      if (mid.yes === 0 && mid.no === 0) continue;

      marketCount++;
      markets.push({
        id: 100_000 + marketCount, // offset to avoid ID collision with Polymarket
        platform: 'kalshi',
        title: m.title,
        category: m.category || event.category,
        yesPrice: mid.yes,
        noPrice: mid.no,
        volume: parseFloat(m.volume_fp) || 0,
        expiresAt: m.close_time || m.expiration_time || '',
      });
    }
  }

  console.log(`[Scanner] Found ${allEvents.length} Kalshi events with ${markets.length} active markets`);
  return markets;
}

// ── Diverge API Types ───────────────────────────────────────────────

interface DivergeMarket {
  title: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  resolutionDate?: string;
  platform: { slug: string };
}

interface DivergeArb {
  spreadRaw: number;
  spreadAdjusted: number;
  buyPlatform: string;
  buyPrice: number;
  sellPrice: number;
  marketA: DivergeMarket;
  marketB: DivergeMarket;
  confidence: number;
}

interface DivergeResponse {
  arbs: DivergeArb[];
}

// ── Diverge API URL (default, can be overridden via config) ─────────

const DIVERGE_API_URL =
  process.env.DIVERGE_API_URL ||
  'https://ghdudhmmqxun5pxznlyner36bi0avdoe.lambda-url.us-east-1.on.aws';

// ── Diverge Scanner ─────────────────────────────────────────────────

async function divergeScan(spreadThreshold: number): Promise<Opportunity[] | null> {
  try {
    const url = `${DIVERGE_API_URL}/arbs?limit=100`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error(`[Scanner] Diverge API returned ${res.status}`);
      return null;
    }

    const data = (await res.json()) as DivergeResponse;
    if (!data.arbs || !Array.isArray(data.arbs)) {
      console.error('[Scanner] Diverge API returned unexpected shape');
      return null;
    }

    console.log(`[Scanner] Using Diverge API — ${data.arbs.length} arbs`);

    const opportunities: Opportunity[] = [];

    for (const arb of data.arbs) {
      // Determine which market is Polymarket vs Kalshi
      const aSlug = arb.marketA.platform.slug?.toLowerCase() ?? '';
      const bSlug = arb.marketB.platform.slug?.toLowerCase() ?? '';

      let polyMarket: DivergeMarket;
      let kalshiMarket: DivergeMarket;

      if (aSlug.includes('polymarket')) {
        polyMarket = arb.marketA;
        kalshiMarket = arb.marketB;
      } else if (bSlug.includes('polymarket')) {
        polyMarket = arb.marketB;
        kalshiMarket = arb.marketA;
      } else if (aSlug.includes('kalshi')) {
        kalshiMarket = arb.marketA;
        polyMarket = arb.marketB;
      } else if (bSlug.includes('kalshi')) {
        kalshiMarket = arb.marketB;
        polyMarket = arb.marketA;
      } else {
        // Neither is clearly Polymarket/Kalshi — use A as poly, B as kalshi
        polyMarket = arb.marketA;
        kalshiMarket = arb.marketB;
      }

      const spread = arb.spreadAdjusted;
      if (spread < spreadThreshold) continue;

      opportunities.push({
        event: polyMarket.title || kalshiMarket.title,
        polymarketYes: polyMarket.yesPrice,
        polymarketNo: polyMarket.noPrice,
        kalshiYes: kalshiMarket.yesPrice,
        kalshiNo: kalshiMarket.noPrice,
        spread: Math.round(spread * 10000) / 10000,
        polymarketVolume: polyMarket.volume24h || 0,
        kalshiVolume: kalshiMarket.volume24h || 0,
        expiresAt: polyMarket.resolutionDate || kalshiMarket.resolutionDate || '',
      });
    }

    // Sort by spread descending
    opportunities.sort((a, b) => b.spread - a.spread);

    console.log(`[Scanner] ${opportunities.length} opportunities above ${(spreadThreshold * 100).toFixed(1)}% spread threshold`);

    return opportunities;
  } catch (err) {
    console.error('[Scanner] Diverge API error:', (err as Error).message);
    return null;
  }
}

// ── Direct Scan (original Polymarket + Kalshi matching — fallback) ──

async function directScan(spreadThreshold: number): Promise<Opportunity[]> {
  // Fetch from both platforms in parallel
  const [polyMarkets, kalshiMarkets] = await Promise.all([
    fetchPolymarketMarkets(),
    fetchAllKalshiMarkets(),
  ]);

  if (polyMarkets.length === 0 && kalshiMarkets.length === 0) {
    console.warn('[Scanner] No markets fetched from either platform');
    return [];
  }

  if (polyMarkets.length === 0) {
    console.warn('[Scanner] No Polymarket markets fetched — cannot match');
    return [];
  }

  if (kalshiMarkets.length === 0) {
    console.warn('[Scanner] No Kalshi markets fetched — cannot match');
    return [];
  }

  // Run Diverge's two-pass matching
  const matches = findMatches(polyMarkets, kalshiMarkets, 0.6);

  // Convert matches to Kairos Opportunity format
  const opportunities: Opportunity[] = [];

  for (const match of matches) {
    const spread = Math.abs(match.polymarket.yesPrice - match.kalshi.yesPrice);

    if (spread < spreadThreshold) continue;

    opportunities.push({
      event: match.polymarket.title,
      polymarketYes: match.polymarket.yesPrice,
      polymarketNo: match.polymarket.noPrice,
      kalshiYes: match.kalshi.yesPrice,
      kalshiNo: match.kalshi.noPrice,
      spread: Math.round(spread * 10000) / 10000,
      polymarketVolume: match.polymarket.volume,
      kalshiVolume: match.kalshi.volume,
      expiresAt: match.polymarket.expiresAt || match.kalshi.expiresAt,
    });
  }

  // Sort by spread descending
  opportunities.sort((a, b) => b.spread - a.spread);

  console.log(`[Scanner] ${opportunities.length} opportunities above ${(spreadThreshold * 100).toFixed(1)}% spread threshold`);

  return opportunities;
}

// ── Main Export ──────────────────────────────────────────────────────

const DEFAULT_MIN_SPREAD = 0.03; // 3%

export async function scanOpportunities(minSpread?: number): Promise<Opportunity[]> {
  const spreadThreshold = minSpread ?? DEFAULT_MIN_SPREAD;

  console.log('[Scanner] Starting market scan...');
  console.log(`[Scanner] Min spread threshold: ${(spreadThreshold * 100).toFixed(1)}%`);

  // PRIMARY: Try Diverge API first
  const divergeResult = await divergeScan(spreadThreshold);
  if (divergeResult !== null) {
    return divergeResult;
  }

  // FALLBACK: Direct Polymarket + Kalshi scanning
  console.log('[Scanner] Diverge failed, falling back to direct scan');
  return directScan(spreadThreshold);
}
