# Base Mainnet Quickstart

This runs on Base mainnet with real USDC. Transactions are irreversible and spend real funds.

## 1) Install
```bash
npm install
```

## 2) Build Circuit + Verifier
```bash
npm run zk:compile
npm run zk:setup
npm run zk:export-verifier
```

## 3) Compile Contracts
```bash
npm run compile
```

## 4) Deploy (Base Mainnet)
```bash
export PRIVATE_KEY=...
export MIN_ANON_SET=8
export MIN_CONFIRMATIONS=4

npm run deploy:base
```

## 5) Configure Adapter
Use the deployed pool address from `deployments/base-mainnet.json`.
```bash
x402-privacy init \
  --rpc https://mainnet.base.org \
  --pk $PRIVATE_KEY \
  --chain 8453 \
  --pool 0x... \
  --usdc 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --wasm ./circuits/build/spend_js/spend.wasm \
  --zkey ./circuits/build/spend_final.zkey
```

## 6) Deposit and Pay
```bash
x402-privacy deposit --amount 10000000
x402-privacy buy --url https://merchant.example/api
```

## 7) MCP Server
```bash
x402-privacy-mcp
```
