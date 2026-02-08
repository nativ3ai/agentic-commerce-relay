# MCP Agent Flow (No Fallback)

## Assumptions
- Agent operator runs the MCP server locally.
- Pool, USDC, and proof artifacts are configured via the adapter CLI.

## Steps
1) Initialize config:
```bash
x402-privacy init --rpc ... --pk ... --chain ... --pool ... --usdc ... --wasm ... --zkey ...
```

2) Start MCP server:
```bash
x402-privacy-mcp
```

3) Agent calls:
- `deposit.pack` with amount
- `pay.url` with merchant URL (or `merchants.add` + `pay.pinned`)

## Error Handling
- If privacy constraints (denominations, min anon set, min confirmations) are not satisfied, the server returns an error.
- There is no direct-payment fallback.
