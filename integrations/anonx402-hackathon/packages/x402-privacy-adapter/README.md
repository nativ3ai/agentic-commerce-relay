# x402-privacy-adapter

Buyer-side privacy adapter for x402 payments using a ZK note pool on EVM.

## Install
```bash
npm install x402-privacy-adapter
```

## Smart Contract Setup
You need a deployed `PrivacyPoolUSDC` and local circuit artifacts (wasm + zkey). In this repo:
1. `npm run zk:compile`
2. `npm run zk:setup`
3. `npm run zk:export-verifier`
4. `npm run compile`
5. `npm run deploy:base`

The deployed pool address is written to `deployments/base-mainnet.json`. Full steps live in `docs/QUICKSTART.md`.

## Quickstart (CLI)
```bash
x402-privacy init \
  --rpc https://... \
  --pk 0x... \
  --chain 8453 \
  --pool 0x... \
  --usdc 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --wasm ./circuits/build/spend_js/spend.wasm \
  --zkey ./circuits/build/spend_final.zkey

x402-privacy deposit --amount 10000000
x402-privacy buy --url https://merchant.example/api
```

## Programmatic Usage
```ts
import { PrivacyAdapter } from 'x402-privacy-adapter';

const adapter = new PrivacyAdapter({
  rpcUrl: 'https://...',
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

## Notes
- No fallback: if privacy conditions are not met the adapter throws.
- Requires local proving artifacts (wasm + zkey).
- Uses fixed denominations (5/10/20/50/100 USDC base units).
