// Kairos v2 — Configuration

import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

export interface Config {
  bankrApiKey: string;
  veniceApiKey?: string;
  privateKey?: string;
  loggerPrivateKey?: string;
  eoa?: string;
  paperTrading: boolean;
  loggerContract?: string;
  baseRpcUrl: string;
  minSpread: number;
  divergeApiUrl: string;
}

export function loadConfig(): Config {
  const paperTrading = process.env.PAPER_TRADING === 'true';
  const bankrApiKey = process.env.BANKR_API_KEY;

  if (!bankrApiKey) {
    throw new Error('BANKR_API_KEY is required');
  }

  const privateKey = process.env.KAIROS_PRIVATE_KEY || undefined;
  const eoa = process.env.KAIROS_EOA || undefined;

  if (!paperTrading && (!privateKey || !eoa)) {
    throw new Error('KAIROS_PRIVATE_KEY and KAIROS_EOA are required for live trading (set PAPER_TRADING=true for paper mode)');
  }

  return {
    bankrApiKey,
    veniceApiKey: process.env.VENICE_API_KEY || undefined,
    privateKey,
    loggerPrivateKey: process.env.OWNER_PRIVATE_KEY || undefined,
    eoa,
    paperTrading,
    loggerContract: process.env.LOGGER_CONTRACT_ADDRESS || undefined,
    baseRpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    minSpread: parseFloat(process.env.MIN_SPREAD || '0.05'),
    divergeApiUrl: process.env.DIVERGE_API_URL || 'https://ghdudhmmqxun5pxznlyner36bi0avdoe.lambda-url.us-east-1.on.aws',
  };
}
