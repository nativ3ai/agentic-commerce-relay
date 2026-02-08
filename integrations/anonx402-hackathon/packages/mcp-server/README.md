# x402-privacy-mcp-server

MCP server wrapper around `x402-privacy-adapter` for agent-native usage.

## Install
```bash
npm install x402-privacy-mcp-server
```

## Smart Contract Setup
You need a deployed `PrivacyPoolUSDC` and local circuit artifacts (wasm + zkey). In this repo:
1. `npm run zk:compile`
2. `npm run zk:setup`
3. `npm run zk:export-verifier`
4. `npm run compile`
5. `npm run deploy:base`

The deployed pool address is written to `deployments/base-mainnet.json`. Full steps live in `docs/QUICKSTART.md`.

## Configure
The MCP server reads config from `~/.x402-privacy/config.json` (created by the adapter CLI):
```bash
x402-privacy init \
  --rpc https://... \
  --pk 0x... \
  --chain 8453 \
  --pool 0x... \
  --usdc 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --wasm ./circuits/build/spend_js/spend.wasm \
  --zkey ./circuits/build/spend_final.zkey
```

## Run
```bash
x402-privacy-mcp
```

## Tools
- `merchants.add` { name, url, merchantAddress }
- `merchants.list`
- `balance.get`
- `deposit.pack` { amount }
- `pay.url` { url, method? }
- `pay.pinned` { id }

## No Fallback
This server never pays directly. If privacy constraints are not met, it fails and reports the error.
