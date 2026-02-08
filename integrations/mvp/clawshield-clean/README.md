# ClawShield

ClawShield is a plug‑and‑play security skill for OpenClaw that **scans**, **lints**, and **guards** skills before and during execution. It is designed to prevent common supply‑chain exploits (secret exfil, unsafe exec, hidden network calls) by enforcing a clear permission manifest and producing verifiable receipts.

## Why it exists
Recent scans of community skills found credential stealers disguised as innocuous tools. Agents are trained to be helpful and trusting — ClawShield flips the default to **least privilege + receipts**.

## What it does
- **Pre‑install scan** for suspicious patterns in skill repos
- **skill.md lint** to flag unsafe instructions
- **Runtime guard** that blocks undeclared file/env/network/exec access
- **Receipts** (JSON) for auditing and sharing trust signals

## Install
```bash
npm install -g clawshield
```

## Quick start
```bash
# 1) create a manifest
clawshield init

# 2) scan a repo
clawshield scan ./some-skill

# 3) lint skill.md
clawshield lint-skillmd ./some-skill/skill.md

# 4) run a Node/OpenClaw skill under guard
clawshield run --receipt clawshield-receipt.json -- node ./some-skill/index.js
```

## Permissions manifest
`permissions.json` controls what the skill is allowed to do.

```json
{
  "version": 1,
  "permissions": {
    "fs": { "read": ["./"], "write": [] },
    "env": { "allow": [] },
    "network": { "outbound": [] },
    "exec": false
  }
}
```

## How the guard works
ClawShield injects a Node runtime guard using `NODE_OPTIONS=--require guard.cjs` and writes a receipt on block. It blocks any access outside the manifest and throws a `CLAWSHIELD_BLOCKED` error.

## OpenClaw integration
ClawShield is optimized for OpenClaw skills that run on Node. You can wrap any Node‑based skill execution with:

```bash
clawshield run -- node ./path/to/skill.js
```

## Demo (unsafe skill)
```bash
clawshield scan ./examples/unsafe-skill
clawshield lint-skillmd ./examples/unsafe-skill/skill.md
clawshield run --receipt clawshield-receipt.json -- node ./examples/unsafe-skill/index.js
```

## Guarantees (threat model)
ClawShield blocks undeclared file, env, network, and exec access **unless the host machine is already compromised**. It is a guardrail, not a full sandbox.

## License
MIT


## Proof Demo

Unsafe skill (blocked):
```bash
clawshield scan ./examples/unsafe-skill
clawshield lint-skillmd ./examples/unsafe-skill/skill.md
clawshield run --receipt clawshield-receipt.json -- node ./examples/unsafe-skill/index.js
```
Receipt (blocked):
```json
{
  "status": "blocked",
  "reason": "ClawShield blocked: readFileSync /Users/native/.clawdbot/.env",
  "manifest": "/.../examples/unsafe-skill/permissions.json",
  "manifest_hash": "...",
  "timestamp": "..."
}
```

Safe skill (allowed):
```bash
clawshield run --receipt ./examples/safe-skill/receipt.json --manifest ./examples/safe-skill/permissions.json -- node ./examples/safe-skill/index.js
```
Receipt (allowed):
```json
{
  "status": "allowed",
  "details": "safe-skill executed within allowed permissions",
  "timestamp": "..."
}
```
