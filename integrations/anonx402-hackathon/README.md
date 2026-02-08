# x402 Privacy Adapter

## USDC Hackathon Submission (Most Novel Smart Contract)

**Project:** Anon x402 Pool — Privacy Payments for Agents  
**Track:** #USDCHackathon ProjectSubmission SmartContract  

### Summary
Anon x402 Pool is a privacy-preserving USDC payment pool that lets agents pay x402 merchants without revealing their primary wallet history. The proof binds to an **intent hash** (merchant, price, expiry, URL, method) so an agent cannot be tricked into paying the wrong endpoint.

### Why It’s Useful for Agents
- **Agent-native privacy**: pay for services without leaking wallet history.
- **Merchant compatible**: merchants receive standard USDC, no integration changes.
- **Intent-bound safety**: proofs are tied to a canonical x402 intent hash.
- **Deterministic audit**: nullifiers prevent double-spend; receipts are on-chain.

### Testnet Deployment (Base Sepolia)
- **Chain:** Base Sepolia (84532)
- **USDC (custom testnet):** `0x810a4aCEbBf3DE27BC4EfB05b6CF126105E779E9`
- **PrivacyPoolUSDC:** `0xdaF47aF5140433f67b76d8aC356F2a6ef9Df2744`
- **Groth16 Verifier:** `0x17393FA5A61eeE637Ce023502A2B313dB7779213`
- **PoseidonT3:** `0x6BB172cB5574793e229996AB4156E66ca4C8F056`

### Proof of Work (Testnet)
- **Deposits:**
  - `0x05053cd42bf437c11c49b9c62921e93ddc204835f8ee5a4358d457ab5a2a81b6` (10 USDC)
  - `0xf0af52f0a6ad07b65904ace5ddee211329567b4128ee85dd22239599d15fac30` (5 USDC)
- **Spend (x402 intent-bound):**
  - `0x12efdb08bfe2c128a6b612f1432b568cac63dba4fe5ddbbfc9aa33829f1d3df9`

### Demo Flow (Testnet, Real Proof)
1. Generate ZK artifacts:
   - `npm run zk:compile`
   - `npm run zk:setup`
   - `npm run zk:export-verifier`
2. Deploy to Base Sepolia:
   - `RPC_URL_BASE_SEPOLIA=... PRIVATE_KEY=... USDC_ADDRESS=0x810a4a... npx hardhat run scripts/deploy.ts --network baseSepolia`
3. Deposit notes + pay x402 merchant:
   - `node scripts/testnet-deposit.js`
   - `node scripts/x402-test-server.js` (local test merchant)
   - `node packages/x402-privacy-adapter/dist/cli/index.js buy --url http://localhost:8787/x402`

Powered by h1dr4.

A buyer-side privacy adapter for x402 payments that replaces transparent account payments with ZK note spends, without requiring merchant changes.

**What It Does**
- Lets buyers pay any x402 merchant with privacy-preserving ZK spends.
- Enforces fee, denomination, nullifier, and maturity rules on-chain.
- Keeps merchant infrastructure unchanged: merchants still receive USDC directly.

**How It Works (Short)**
1. Buyer deposits USDC into a PrivacyPool, receiving ZK notes.
2. Buyer spends notes by proving membership in the pool’s Merkle tree.
3. The proof binds to the x402 intent hash (merchant, price, expiry, URL, method).
4. The contract verifies the proof, pays the merchant, and optionally issues change.

**Architecture**
- `contracts/PrivacyPoolUSDC.sol`: on-chain pool with commitments, nullifiers, fee enforcement.
- `circuits/spend.circom`: Groth16 circuit for two-note spend with optional change.
- `packages/x402-privacy-adapter`: JS/TS adapter and CLI (`x402-privacy`).
- `packages/mcp-server`: MCP wrapper (`x402-privacy-mcp`).

**Protocol and Schema**
- Notes
  - Commitment: `C = Poseidon(s, d)`
  - Nullifier: `N = Poseidon(s, 1)`
- Intent hash
  - `keccak256(chainId|pool|merchant|url|method|price|expiry)`
- Denominations (USDC base units)
  - `5e6`, `10e6`, `20e6`, `50e6`, `100e6`
- Fee
  - Fixed 30 bps, enforced on-chain.

**Public Input Order (Circuit/Verifier)**
1. `merkleRoot`
2. `merchant`
3. `price`
4. `fee`
5. `feeRecipient`
6. `intentHash`
7. `expiry`
8. `noteCount`
9. `minConfirmations`
10. `changeDenom`
11. `nullifier1`
12. `nullifier2`
13. `changeCommitment`

**Prerequisites**
- Node.js (Hardhat supports LTS).
- Rust + `circom` in PATH.

Install `circom` via Rust:
```bash
cargo install --git https://github.com/iden3/circom circom
```

**Local Setup**
```bash
npm install
npm run zk:compile
npm run zk:setup
npm run zk:export-verifier
npm run compile
npm run test
```

**Base Mainnet Deploy**
```bash
export PRIVATE_KEY=...
export MIN_ANON_SET=8
export MIN_CONFIRMATIONS=4

npm run deploy:base
```
Deployment output is written to `deployments/base-mainnet.json`.

**Adapter CLI Usage**
```bash
x402-privacy init \
  --rpc https://mainnet.base.org \
  --pk 0x... \
  --chain 8453 \
  --pool 0x... \
  --usdc 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --wasm ./circuits/build/spend_js/spend.wasm \
  --zkey ./circuits/build/spend_final.zkey

x402-privacy deposit --amount 10000000
x402-privacy buy --url https://merchant.example/api
```

**Programmatic Usage**
```ts
import { PrivacyAdapter } from 'x402-privacy-adapter';

const adapter = new PrivacyAdapter({
  rpcUrl: 'https://mainnet.base.org',
  privateKey: '0x...',
  chainId: 8453,
  poolAddress: '0x...',
  usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  circuitWasmPath: './circuits/build/spend_js/spend.wasm',
  zkeyPath: './circuits/build/spend_final.zkey'
});

await adapter.init();
await adapter.depositPack(10_000_000n);
const res = await adapter.buy('https://merchant.example/api');
```

**MCP Server**
```bash
x402-privacy-mcp
```

Tools:
- `merchants.add` { name, url, merchantAddress }
- `merchants.list`
- `balance.get`
- `deposit.pack` { amount }
- `pay.url` { url, method? }
- `pay.pinned` { id }

**Threat Model (Summary)**
- Adversary can observe the chain and correlate timing.
- This does not hide network metadata (IP/RPC) or wallet identity.
- Privacy is provided by note commitments, nullifiers, and fixed denominations.

**Docs**
- `docs/PROTOCOL.md`
- `docs/THREAT_MODEL.md`
- `docs/QUICKSTART.md`
