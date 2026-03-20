import fs from 'fs';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const address = '0xa31c6c7f3785aec4e60e3e73868ab126263a24be';
const abi = JSON.parse(fs.readFileSync('/home/ubuntu/kairos-v2/deploy/abi.json', 'utf8'));
const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });

// Check bytecode exists
const code = await publicClient.getCode({ address });
console.log(`Contract bytecode length: ${code?.length || 0} chars`);

// Read totalDecisions
const total = await publicClient.readContract({ address, abi, functionName: 'totalDecisions' });
console.log(`totalDecisions(): ${total}`);

const owner = await publicClient.readContract({ address, abi, functionName: 'owner' });
console.log(`owner(): ${owner}`);
