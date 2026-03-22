import solc from 'solc';
import fs from 'fs';
import { createWalletClient, createPublicClient, http, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// 1. Compile
const __dirname = new URL('.', import.meta.url).pathname;
const source = fs.readFileSync(__dirname + '../contracts/KairosLogger.sol', 'utf8');
const input = JSON.stringify({
  language: 'Solidity',
  sources: { 'KairosLogger.sol': { content: source } },
  settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } }
});

const output = JSON.parse(solc.compile(input));
if (output.errors?.some(e => e.severity === 'error')) {
  console.error('Compilation errors:', output.errors);
  process.exit(1);
}

const contract = output.contracts['KairosLogger.sol']['KairosLogger'];
const abi = contract.abi;
const bytecode = '0x' + contract.evm.bytecode.object;
console.log(`Compiled. Bytecode: ${bytecode.length} chars`);

// 2. Deploy
if (!process.env.KAIROS_PRIVATE_KEY) throw new Error('KAIROS_PRIVATE_KEY env var required');
const account = privateKeyToAccount(`0x${process.env.KAIROS_PRIVATE_KEY}`);
const transport = http(process.env.BASE_RPC_URL || 'https://mainnet.base.org');

const walletClient = createWalletClient({ account, chain: base, transport });
const publicClient = createPublicClient({ chain: base, transport });

console.log(`Deploying from ${account.address} on Base mainnet...`);
const balance = await publicClient.getBalance({ address: account.address });
console.log(`Balance: ${Number(balance) / 1e18} ETH`);

const hash = await walletClient.deployContract({ abi, bytecode, account });
console.log(`Deploy tx: ${hash}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log(`Contract deployed at: ${receipt.contractAddress}`);
console.log(`Gas used: ${receipt.gasUsed}`);
console.log(`Status: ${receipt.status}`);

// 3. Verify
const total = await publicClient.readContract({
  address: receipt.contractAddress,
  abi,
  functionName: 'totalDecisions',
});
console.log(`totalDecisions(): ${total}`);

const contractOwner = await publicClient.readContract({
  address: receipt.contractAddress,
  abi,
  functionName: 'owner',
});
console.log(`owner(): ${contractOwner}`);

// 4. Save
fs.writeFileSync(__dirname + '../CONTRACT_ADDRESS.txt', receipt.contractAddress);
fs.writeFileSync(__dirname + 'abi.json', JSON.stringify(abi, null, 2));
console.log(`\n✅ Contract address saved to CONTRACT_ADDRESS.txt`);
console.log(`✅ ABI saved to deploy/abi.json`);
