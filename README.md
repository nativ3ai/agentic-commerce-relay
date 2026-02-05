# Agentic Commerce Relay (CCTP Testnet)

A minimal, verifiable agent commerce flow using Circle CCTP on testnet. This is the **settlement layer**: burn USDC on Base Sepolia, mint on Polygon Amoy, and return machine‑readable receipts.

## What it does
- Burns USDC on Base Sepolia
- Fetches attestation from Circle Iris
- Mints USDC on Polygon Amoy
- Outputs proof (burn tx, message hash, mint tx)

## Why it matters for agents
This is the smallest reliable primitive for **agent‑to‑agent cross‑chain settlement**. A buyer agent pays on Base Sepolia, a seller agent receives on Amoy, and the bridge is verifiable via Circle attestation.

## Plug‑and‑play
- No contracts to deploy
- Single script with a wallet
- Deterministic receipts for audit

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
Use a lightweight discovery layer so agents can find counterparties. This repo includes a minimal adapter for **A2A Registry**.

```bash
node scripts/discovery-a2a.cjs --name payment --tag payments
```

## Composability with other modules
- **USDC Intent Payer (Skill)**: turns natural‑language or JSON intents into safe, guarded payments on Base Sepolia, then call this relay to settle on another chain.
- **Anon x402 Pool (SmartContract + Adapter)**: add privacy to agent commerce by depositing/withdrawing via ZK proofs, then bridge out with this relay.

## Testnet contracts (official Circle)
- TokenMessenger (v1): `0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5`
- MessageTransmitter: `0x7865fAfC2db2093669d92c0F33AeEF291086BEFD`
- USDC Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- USDC Polygon Amoy: `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582`

## Notes
- Testnet only.
- Uses official Circle CCTP contracts.
