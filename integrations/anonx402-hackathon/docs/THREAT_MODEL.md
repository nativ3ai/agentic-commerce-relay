# Threat Model

## Adversary
- Full on-chain observer.
- Can correlate timing, amounts, and graph structure.
- Can monitor mempool and public RPC endpoints.

## Assumptions
- Groth16 soundness and security of Poseidon hash.
- Honest on-chain execution (no reorg beyond normal finality assumptions).
- Buyer maintains local note store integrity.

## Security Goals
- **Unlinkability**: It is computationally infeasible to link a buyer’s deposit transaction to a merchant payout beyond anonymity-set guessing.
- **Double-spend prevention**: Each note can be spent at most once (nullifier).
- **Fee enforcement**: Fee cannot be bypassed or redirected.

## Non-Goals
- Network-level privacy (IP, RPC correlation).
- Protection against malware on the buyer’s device.
- Off-chain metadata leaks (HTTP headers, TLS fingerprints, etc.).

## Privacy Degradation Factors
- Small anonymity set.
- Immediate deposit then spend without sufficient pool activity.
- Unique merchant pricing not aligned to denomination buckets.
