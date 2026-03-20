// Kairos v2 — Council Engine
// 4 analysts via Bankr LLM Gateway, Arbiter via Venice AI (private inference)
// "Private deliberation, public consequence"

import type { Opportunity, Opinion, Decision, CouncilMember } from './types.js';

const BANKR_URL = 'https://llm.bankr.bot/v1/chat/completions';
const VENICE_URL = 'https://api.venice.ai/api/v1/chat/completions';

const MEMBERS: CouncilMember[] = [
  {
    name: 'Technician',
    model: 'claude-sonnet-4.6',
    role: 'Market Microstructure Analyst',
    systemPrompt: `You are the Technician — a market microstructure specialist on a prediction market arbitrage council.
Your job: analyze order book depth, trading volume, historical spread patterns, and liquidity conditions.
Focus on WHETHER the spread is mechanically exploitable: slippage, fill probability, order book thin-ness, volume sustainability.
You must respond with ONLY a JSON object (no markdown, no explanation outside JSON):
{"member":"Technician","model":"claude-sonnet-4.6","verdict":"trade"|"pass","confidence":0.0-1.0,"reasoning":"your analysis"}`,
  },
  {
    name: 'Sentinel',
    model: 'gemini-3-flash',
    role: 'News & Sentiment Analyst',
    systemPrompt: `You are the Sentinel — a news and sentiment analyst on a prediction market arbitrage council.
Your job: analyze news flow, social media signals, event timing, and sentiment shifts that could affect the spread.
Focus on: Is there breaking news that one platform has priced in but the other hasn't? Are social signals indicating a shift? Is the event timing creating uncertainty?
You must respond with ONLY a JSON object (no markdown, no explanation outside JSON):
{"member":"Sentinel","model":"gemini-3-flash","verdict":"trade"|"pass","confidence":0.0-1.0,"reasoning":"your analysis"}`,
  },
  {
    name: 'Detective',
    model: 'gemini-3-pro',
    role: 'Root Cause Analyst',
    systemPrompt: `You are the Detective — a root cause analyst on a prediction market arbitrage council.
Your job: figure out WHY the price gap exists between platforms. Is it different resolution criteria? Different expiry interpretations? Liquidity imbalance? Regulatory differences? Information asymmetry?
If there's a legitimate structural reason for the gap, the trade may not be arbitrage — it may be a trap.
You must respond with ONLY a JSON object (no markdown, no explanation outside JSON):
{"member":"Detective","model":"gemini-3-pro","verdict":"trade"|"pass","confidence":0.0-1.0,"reasoning":"your analysis"}`,
  },
  {
    name: 'Devil',
    model: 'gpt-5.4-mini',
    role: 'Devil\'s Advocate',
    systemPrompt: `You are the Devil's Advocate on a prediction market arbitrage council.
Your job: argue AGAINST the trade. Always. Find every reason it could fail: hidden fees, resolution risk, counterparty risk, timing risk, regulatory risk, liquidity traps, spread compression before execution.
You are hardcoded to be skeptical. Even if the trade looks good, find the risk. Your verdict should almost always be "pass" unless the opportunity is overwhelmingly obvious.
You must respond with ONLY a JSON object (no markdown, no explanation outside JSON):
{"member":"Devil","model":"gpt-5.4-mini","verdict":"trade"|"pass","confidence":0.0-1.0,"reasoning":"your contrarian analysis"}`,
  },
];

const ARBITER: CouncilMember = {
  name: 'Arbiter',
  model: 'deepseek-v3.2',
  role: 'Final Decision Maker (Venice AI — Private Inference)',
  systemPrompt: `You are the Arbiter — the final decision maker on a prediction market arbitrage council.
You receive opinions from 4 analysts: Technician (microstructure), Sentinel (news/sentiment), Detective (root cause), and Devil (contrarian).
Your job: weigh all opinions and make the final call.

You must respond with ONLY a JSON object (no markdown, no explanation outside JSON):
{"action":"buy_poly_yes"|"buy_poly_no"|"buy_kalshi_yes"|"buy_kalshi_no"|"pass","confidence":0.0-1.0,"reasoning":"your synthesis and final reasoning"}

You are running on Venice AI private inference — your reasoning is end-to-end private. Only your final verdict is logged on-chain.

Guidelines:
- If Devil raises a valid structural concern, weight it heavily
- If Detective found a legitimate reason for the gap, strongly consider passing
- Confidence below 0.6 → pass
- Need at least 2 of 3 non-Devil members voting "trade" to proceed
- Your confidence should reflect the consensus strength`,
};

function formatOpportunity(opp: Opportunity): string {
  return `PREDICTION MARKET ARBITRAGE OPPORTUNITY:
Event: ${opp.event}
Expires: ${opp.expiresAt}

Polymarket:
  YES: ${(opp.polymarketYes * 100).toFixed(1)}¢  |  NO: ${(opp.polymarketNo * 100).toFixed(1)}¢
  Volume: $${opp.polymarketVolume.toLocaleString()}

Kalshi:
  YES: ${(opp.kalshiYes * 100).toFixed(1)}¢  |  NO: ${(opp.kalshiNo * 100).toFixed(1)}¢
  Volume: $${opp.kalshiVolume.toLocaleString()}

SPREAD: ${(opp.spread * 100).toFixed(1)}%

Analyze this opportunity from your specific perspective and respond with JSON only.`;
}

function parseOpinion(raw: string, member: CouncilMember): Omit<Opinion, 'timestamp'> {
  // Try direct JSON parse first
  try {
    const parsed = JSON.parse(raw);
    return {
      member: member.name,
      model: member.model,
      verdict: parsed.verdict === 'trade' ? 'trade' : 'pass',
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
      reasoning: String(parsed.reasoning || ''),
    };
  } catch {
    // Fall back to regex extraction (models sometimes wrap in markdown)
  }

  // Try extracting JSON from markdown code block
  const jsonMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || raw.match(/(\{[\s\S]*"verdict"[\s\S]*\})/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        member: member.name,
        model: member.model,
        verdict: parsed.verdict === 'trade' ? 'trade' : 'pass',
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
        reasoning: String(parsed.reasoning || ''),
      };
    } catch {
      // Fall through
    }
  }

  // Last resort: regex individual fields
  const verdictMatch = raw.match(/"verdict"\s*:\s*"(trade|pass)"/);
  const confidenceMatch = raw.match(/"confidence"\s*:\s*([\d.]+)/);
  const reasoningMatch = raw.match(/"reasoning"\s*:\s*"((?:[^"\\]|\\.)*)"/);

  return {
    member: member.name,
    model: member.model,
    verdict: verdictMatch?.[1] === 'trade' ? 'trade' : 'pass',
    confidence: confidenceMatch ? Math.min(1, Math.max(0, parseFloat(confidenceMatch[1]))) : 0,
    reasoning: reasoningMatch?.[1] || `Could not parse response: ${raw.slice(0, 200)}`,
  };
}

async function callVenice(
  apiKey: string,
  member: CouncilMember,
  userPrompt: string,
): Promise<Opinion> {
  const timestamp = Date.now();

  try {
    const res = await fetch(VENICE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: member.model,
        messages: [
          { role: 'system', content: member.systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      throw new Error(`Venice API ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json() as any;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from Venice API');
    }

    const parsed = parseOpinion(content, member);
    return { ...parsed, timestamp };
  } catch (err: any) {
    console.error(`  ⚠ ${member.name} (Venice) error: ${err.message}`);
    return {
      member: member.name,
      model: member.model,
      verdict: 'pass',
      confidence: 0,
      reasoning: `Error: ${err.message}`,
      timestamp,
    };
  }
}

async function callBankr(
  apiKey: string,
  member: CouncilMember,
  userPrompt: string,
): Promise<Opinion> {
  const timestamp = Date.now();

  try {
    const res = await fetch(BANKR_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: member.model,
        messages: [
          { role: 'system', content: member.systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      throw new Error(`Bankr API ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json() as any;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from Bankr API');
    }

    const parsed = parseOpinion(content, member);
    return { ...parsed, timestamp };
  } catch (err: any) {
    console.error(`  ⚠ ${member.name} error: ${err.message}`);
    return {
      member: member.name,
      model: member.model,
      verdict: 'pass',
      confidence: 0,
      reasoning: `Error: ${err.message}`,
      timestamp,
    };
  }
}

export async function runCouncil(
  opportunity: Opportunity,
  apiKey: string,
  veniceApiKey?: string,
): Promise<Decision> {
  const start = Date.now();
  const userPrompt = formatOpportunity(opportunity);

  console.log('\n🏛️  Council convened — 4 analysts deliberating in parallel...\n');

  // Phase 1: Run 4 analysts in parallel
  const opinions = await Promise.all(
    MEMBERS.map((member) => callBankr(apiKey, member, userPrompt)),
  );

  // Phase 2: Arbiter reads all opinions and decides
  const arbiterPrompt = `${userPrompt}

--- COUNCIL OPINIONS ---

${opinions.map((o) => `**${o.member}** (${o.model}):
Verdict: ${o.verdict} | Confidence: ${(o.confidence * 100).toFixed(0)}%
Reasoning: ${o.reasoning}`).join('\n\n')}

--- END OPINIONS ---

Based on all 4 opinions above, make your final decision. Respond with JSON only.`;

  console.log(`⚖️  Arbiter reviewing all opinions via ${veniceApiKey ? 'Venice AI (private inference)' : 'Bankr'}...\n`);

  const arbiterResponse = veniceApiKey
    ? await callVenice(veniceApiKey, ARBITER, arbiterPrompt)
    : await callBankr(apiKey, ARBITER, arbiterPrompt);

  // Parse arbiter's action from their response
  let action: Decision['action'] = 'pass';
  let confidence = arbiterResponse.confidence;
  let reasoning = arbiterResponse.reasoning;

  // Try to extract action from arbiter reasoning (they respond with action field)
  try {
    // Re-parse the raw opinion to get the action field
    const actionMatch = reasoning.match(/"action"\s*:\s*"([^"]+)"/) ||
      arbiterResponse.reasoning.match(/buy_poly_yes|buy_poly_no|buy_kalshi_yes|buy_kalshi_no|pass/);
    if (actionMatch) {
      const a = actionMatch[1] || actionMatch[0];
      if (['buy_poly_yes', 'buy_poly_no', 'buy_kalshi_yes', 'buy_kalshi_no', 'pass'].includes(a)) {
        action = a as Decision['action'];
      }
    }
  } catch {
    // Keep default pass
  }

  // If arbiter verdict is pass or confidence is low, force pass
  if (arbiterResponse.verdict === 'pass' || confidence < 0.6) {
    action = 'pass';
  }

  // If action is still pass but verdict is trade, pick the best action based on spread
  if (action === 'pass' && arbiterResponse.verdict === 'trade' && confidence >= 0.6) {
    // Default: buy the cheaper side
    if (opportunity.polymarketYes < opportunity.kalshiYes) {
      action = 'buy_poly_yes';
    } else {
      action = 'buy_kalshi_yes';
    }
  }

  const deliberationMs = Date.now() - start;

  return {
    action,
    confidence,
    reasoning,
    opinions: [...opinions, arbiterResponse],
    deliberationMs,
    opportunity,
  };
}
