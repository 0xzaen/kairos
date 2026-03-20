// Kairos v2 — Shared Types

export interface Opportunity {
  event: string;
  polymarketYes: number;
  polymarketNo: number;
  kalshiYes: number;
  kalshiNo: number;
  spread: number;
  polymarketVolume: number;
  kalshiVolume: number;
  expiresAt: string;
}

export interface Opinion {
  member: string;
  model: string;
  verdict: 'trade' | 'pass';
  confidence: number;
  reasoning: string;
  timestamp: number;
}

export interface Decision {
  action: 'buy_poly_yes' | 'buy_poly_no' | 'buy_kalshi_yes' | 'buy_kalshi_no' | 'pass';
  confidence: number;
  reasoning: string;
  opinions: Opinion[];
  deliberationMs: number;
  opportunity: Opportunity;
}

export interface TradeResult {
  platform: 'polymarket' | 'kalshi';
  status: 'paper' | 'live' | 'error';
  action: string;
  price: number;
  size: number;
  timestamp: number;
}

export interface CouncilMember {
  name: string;
  model: string;
  role: string;
  systemPrompt: string;
}
