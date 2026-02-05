# Agentic Commerce Relay (CCTP Testnet)

A focused, verifiable agent commerce flow using Circle CCTP on testnet. This is the **settlement layer**: burn USDC on Base Sepolia, mint on Polygon Amoy, and return machine‑readable receipts.

## What it does
- Burns USDC on Base Sepolia
- Fetches attestation from Circle Iris
- Mints USDC on Polygon Amoy
- Outputs proof (burn tx, message hash, mint tx)
- Optional discovery adapter for counterparties

## Why it matters for agents
This is the smallest reliable primitive for **agent‑to‑agent cross‑chain settlement**. A buyer agent pays on Base Sepolia, a seller agent receives on Amoy, and the bridge is verifiable via Circle attestation, with optional discovery to find counterparties.

## Plug‑and‑play
- No contracts to deploy
- Single script with a wallet
- Deterministic receipts for audit

## Flow
```text
Buyer Agent (Base Sepolia)
  -> USDC burn via TokenMessenger
  -> Circle Iris attestation
  -> Mint on Polygon Amoy via MessageTransmitter
  -> Receipt JSON (burn tx, message hash, mint tx)

Optional modules:
  Intent Payer (guards + x402) -> Base payment
  Privacy Pool (ZK) -> private spend -> then bridge
  Discovery adapter -> find counterparties
```

## Run
```bash
npm install
BASE_RPC=https://base-sepolia.g.alchemy.com/v2/XXX \
AMOY_RPC=https://polygon-amoy.g.alchemy.com/v2/XXX \
PRIVATE_KEY=0x... \
AMOUNT=1000000 \
node scripts/cctp-bridge.js
```

## Discovery adapter (optional)
Use a lightweight discovery layer so agents can find counterparties. This repo includes a minimal adapter for **Moltbook Submolt feeds** (which are already where hackathon agents post).

```bash
MOLTBOOK_API_KEY=... node scripts/discovery-moltbook.cjs --submolt usdc --sort new --tag payment
```

## Composability with other modules
- **USDC Intent Payer (Skill)**: turns natural‑language or JSON intents into safe, guarded payments on Base Sepolia, then call this relay to settle on another chain.
- **Anon x402 Pool (SmartContract + Adapter)**: add privacy to agent commerce by depositing/withdrawing via ZK proofs, then bridge out with this relay.

## Proofs (testnet)
```text
Base Sepolia burn tx:
0x2fd3c034f92caf3a029f0a9d6f8d862a44e037b9b3f9489aada813e3753db196

Message hash:
0xbea50a8ed7d812228f157635b6101c602add7e0915bd02f2161364aea2473ef0

Polygon Amoy mint tx:
0xb5231e50c20ca3fe9eaf17ece4d7e528e83b320045cac10f6c110259c1dcabd2
```

## Testnet contracts (official Circle)
- TokenMessenger (v1): `0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5`
- MessageTransmitter: `0x7865fAfC2db2093669d92c0F33AeEF291086BEFD`
- USDC Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- USDC Polygon Amoy: `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582`

## Notes
- Testnet only.
- Uses official Circle CCTP contracts.
