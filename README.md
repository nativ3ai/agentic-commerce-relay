# Agentic Commerce Relay (CCTP Testnet, Multichain‑Ready)

A focused, verifiable agent commerce flow using Circle CCTP on testnet. This is the **settlement layer**: burn USDC on a source chain, mint on a destination chain, and return machine‑readable receipts. The current script is configured for **Base Sepolia -> Polygon Amoy**, but the flow is **pluggable for any CCTP‑supported chain pair** by swapping RPCs, domain IDs, and contract addresses.

## What it does
- Burns USDC on a source chain (default: Base Sepolia)
- Fetches attestation from Circle Iris
- Mints USDC on a destination chain (default: Polygon Amoy)
- Outputs proof (burn tx, message hash, mint tx)
- Optional discovery adapter for counterparties

## Why it matters for agents
This is the smallest reliable primitive for **agent‑to‑agent cross‑chain settlement**. A buyer agent pays on a source chain, a seller agent receives on a destination chain, and the bridge is verifiable via Circle attestation, with optional discovery to find counterparties.

## Plug‑and‑play
- No contracts to deploy
- Single script with a wallet
- Deterministic receipts for audit

## Flow
```text
Buyer Agent (Source Chain)
  -> USDC burn via TokenMessenger
  -> Circle Iris attestation
  -> Mint on Destination Chain via MessageTransmitter
  -> Receipt JSON (burn tx, message hash, mint tx)

Optional modules:
  Intent Payer (guards + x402) -> Base payment
  Privacy Pool (ZK) -> private spend -> then bridge
  Discovery adapter -> find counterparties
```

## Run (Base Sepolia -> Polygon Amoy demo)
```bash
npm install
SRC_RPC=https://base-sepolia.g.alchemy.com/v2/XXX \
DST_RPC=https://polygon-amoy.g.alchemy.com/v2/XXX \
PRIVATE_KEY=0x... \
AMOUNT=1000000 \
node scripts/cctp-bridge.js
```

## Multichain configuration (CCTP)
To use a different CCTP chain pair, set the env vars below (defaults are Base Sepolia -> Polygon Amoy).

Required:
- `SRC_RPC`
- `DST_RPC`
- `PRIVATE_KEY`

Legacy (still supported):
- `BASE_RPC` (maps to `SRC_RPC`)
- `AMOY_RPC` (maps to `DST_RPC`)

Optional (override per chain):
- `SRC_USDC`
- `SRC_TOKEN_MESSENGER`
- `SRC_MESSAGE_TRANSMITTER`
- `DST_MESSAGE_TRANSMITTER`
- `DST_DOMAIN`

Example (replace with actual CCTP testnet/mainnet values):
```bash
SRC_RPC=https://source-chain-rpc \
DST_RPC=https://dest-chain-rpc \
SRC_USDC=0x... \
SRC_TOKEN_MESSENGER=0x... \
SRC_MESSAGE_TRANSMITTER=0x... \
DST_MESSAGE_TRANSMITTER=0x... \
DST_DOMAIN=7 \
PRIVATE_KEY=0x... \
node scripts/cctp-bridge.js
```

## Discovery adapter (optional)
Use a lightweight discovery layer so agents can find counterparties. This repo includes a minimal adapter for **Moltbook Submolt feeds** (which are already where hackathon agents post).

```bash
MOLTBOOK_API_KEY=... node scripts/discovery-moltbook.cjs --submolt usdc --sort new --tag payment
```

Notes:
- Moltbook requires the `www` domain for auth headers: `https://www.moltbook.com`.
- Optional override: `MOLTBOOK_BASE_URL=https://www.moltbook.com`.

## Composability with other modules
- **USDC Intent Payer**: turns natural‑language or JSON intents into safe, guarded payments on the source chain, then call this relay to settle on another chain.
- **Anon x402 Relay**: use as an anonymity relay to shield transactions before or after settlement, then bridge with this relay.

These are composable workflow‑level integrations: plug the intent payer or anon relay into your agent pipeline, then call `scripts/cctp-bridge.js` to finalize cross‑chain settlement.

### Bundled integrations (optional)
This repo includes both integrations under `integrations/` for convenience:
- `integrations/mvp` (USDC Intent Payer)
- `integrations/anonx402-hackathon` (Anon x402 Relay)

## OpenClaw skill
The relay ships with a skill definition at `skill/agentic-commerce-relay/SKILL.md`.
To install locally for OpenClaw:
```bash
mkdir -p ~/.openclaw/workspace/skills/agentic-commerce-relay
cp skill/agentic-commerce-relay/SKILL.md ~/.openclaw/workspace/skills/agentic-commerce-relay/SKILL.md
```

### Integration snippets
Intent payer -> relay:
```bash
cd integrations/mvp/packages/usdc-intent-payer
npm install
npx usdc-intent-payer init --out ./usdc-payer.config.json
npx usdc-intent-payer pay --file ../../examples/intent.json --config ./usdc-payer.config.json

cd /Users/native/Desktop/agentic-commerce-relay
SRC_RPC=... DST_RPC=... PRIVATE_KEY=... node scripts/cctp-bridge.js
```

Anon relay -> relay:
```bash
cd integrations/anonx402-hackathon
npm install
# Example: use the privacy adapter CLI (see docs/QUICKSTART.md)
x402-privacy init --rpc ... --pk 0x... --chain 8453 --pool 0x... --usdc 0x... --wasm ./circuits/build/spend_js/spend.wasm --zkey ./circuits/build/spend_final.zkey
x402-privacy deposit --amount 10000000

cd /Users/native/Desktop/agentic-commerce-relay
SRC_RPC=... DST_RPC=... PRIVATE_KEY=... node scripts/cctp-bridge.js
```

## Proofs (testnet)
```text
Base Sepolia burn tx:
0x2fd3c034f92caf3a029f0a9d6f8d862a44e037b9b3f9489aada813e3753db196

Message hash:
0xbea50a8ed7d812228f157635b6101c602add7e0915bd02f2161364aea2473ef0

Polygon Amoy mint tx:
0xb5231e50c20ca3fe9eaf17ece4d7e528e83b320045cac10f6c110259c1dcabd2
```

## Testnet contracts (official Circle, current demo)
- TokenMessenger (v1): `0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5`
- MessageTransmitter: `0x7865fAfC2db2093669d92c0F33AeEF291086BEFD`
- USDC Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- USDC Polygon Amoy: `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582`

## Notes
- Testnet only.
- Uses official Circle CCTP contracts.
