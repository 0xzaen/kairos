import { createPublicClient, http } from '../node_modules/viem/_esm/index.js';
import { base } from '../node_modules/viem/_esm/chains/index.js';
import { writeFileSync } from 'fs';

const CONTRACT = '0xec8c7f2f2468c19a337bc6ba68a122d0cdff4608';
const RPC_URL = 'https://rpc.ankr.com/base/e8d54260dfa856f5e4fc78eb6958969349d9ebffb42fc9f62e15f4f616cee374';

const ABI = [
  {
    inputs: [],
    name: 'totalDecisions',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'uint256' }],
    name: 'decisions',
    outputs: [
      { name: 'market', type: 'string' },
      { name: 'decision', type: 'string' },
      { name: 'confidence', type: 'uint256' },
      { name: 'metadata', type: 'string' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'reporter', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

const client = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const total = await client.readContract({
  address: CONTRACT,
  abi: ABI,
  functionName: 'totalDecisions',
});

console.log('Total decisions:', total.toString());

const results = [];
const count = Math.min(Number(total), 10);

for (let i = 0; i < count; i++) {
  try {
    const d = await client.readContract({
      address: CONTRACT,
      abi: ABI,
      functionName: 'decisions',
      args: [BigInt(i)],
    });
    const entry = {
      id: i,
      market: d[0],
      decision: d[1],
      confidence: Number(d[2]),
      metadata: d[3],
      timestamp: Number(d[4]),
      reporter: d[5],
    };
    results.push(entry);
    console.log(`Decision ${i}: ${d[1]} | conf=${d[2]} | ts=${d[4]} | ${d[0].substring(0, 60)}`);
    if (i < count - 1) await sleep(500);
  } catch (err) {
    console.error(`Failed at ${i}: ${err.shortMessage || err.message}`);
    await sleep(2000);
    // retry once
    try {
      const d = await client.readContract({
        address: CONTRACT,
        abi: ABI,
        functionName: 'decisions',
        args: [BigInt(i)],
      });
      const entry = {
        id: i,
        market: d[0],
        decision: d[1],
        confidence: Number(d[2]),
        metadata: d[3],
        timestamp: Number(d[4]),
        reporter: d[5],
      };
      results.push(entry);
      console.log(`Retry ${i}: ${d[1]} | conf=${d[2]}`);
    } catch (err2) {
      console.error(`Retry failed at ${i}: ${err2.shortMessage}`);
    }
  }
}

writeFileSync('/tmp/chain-decisions.json', JSON.stringify(results, null, 2));
console.log(`\nWrote ${results.length} decisions to /tmp/chain-decisions.json`);
