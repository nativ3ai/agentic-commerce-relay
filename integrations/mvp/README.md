# USDC Intent Payer (OpenClaw Hackathon MVP)

A production-ready, modular skill runtime that turns intent JSON into USDC testnet payments. Supports:
- Direct USDC transfers (Base Sepolia)
- x402 paid API calls (real or mock)
- Policy checks and receipts

## Project Layout
- `skill/` OpenClaw skill manifest (`SKILL.md`)
- `packages/usdc-intent-payer/` CLI + runtime
- `docs/` architecture, usage, deployment, security, Moltbook submission
- `examples/` demo inputs + commands

## What This Skill Is For (Agent View)
- Convert payment intents into safe, auditable USDC testnet transfers.
- Pay x402 endpoints automatically and produce a receipt.
- Enforce guardrails (max spend, allowlists) before payment.

## Guardrails (Modular)
Guardrails are configurable and modular: you can set max spend caps and allowlists via config or env. The payment is blocked before execution if guardrails fail.

Enable guardrails with env vars:
- `USDC_PAYER_MAX_USDC` sets a hard max spend per payment.
- `USDC_PAYER_REQUIRE_ALLOWLIST=true` enforces allowlist checks.
- `USDC_PAYER_ALLOWLIST` is a comma-separated list of allowed payees.

Example:

```bash
USDC_PAYER_MAX_USDC=5 \
USDC_PAYER_REQUIRE_ALLOWLIST=true \
USDC_PAYER_ALLOWLIST=0x1111111111111111111111111111111111111111,0x2222222222222222222222222222222222222222 \
usdc-intent-payer pay --json '{"payee":"0x1111111111111111111111111111111111111111","amount":3}' --config ./usdc-payer.config.json
```

## How Agents Plug It In
1. Install the CLI runtime and dependencies:

```bash
cd packages/usdc-intent-payer
npm install
```

2. Place the OpenClaw skill manifest:
- Copy `skill/SKILL.md` into your OpenClaw skills directory.
- Restart OpenClaw so the skill is discovered.

3. Provide configuration:
- Use `usdc-intent-payer init --out ./usdc-payer.config.json`
- Or export env vars from `examples/.env.example`

## Quick Start

```bash
cd packages/usdc-intent-payer
npm install
usdc-intent-payer init --out ./usdc-payer.config.json
usdc-intent-payer pay --file ../../examples/intent.json --config ./usdc-payer.config.json
```

## Mock x402 demo (no funds)

```bash
node ./examples/x402-mock-server.js
usdc-intent-payer x402-call --url http://127.0.0.1:4021/paid --mock
```

## Diagram (Flow)

```
Intent JSON
   |
   v
Normalize + Policy
   |
   v
Payment
  |-- direct USDC transfer
  |-- x402 paid API call
   |
   v
Receipt JSON
```

## Notes
- Testnet only. No mainnet support.
- Private keys never stored in repo. Use env or config file.
