import fs from 'fs';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const address = '0xec8c7f2f2468c19a337bc6ba68a122d0cdff4608';
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
