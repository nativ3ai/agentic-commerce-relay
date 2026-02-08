# Protocol Specification (MVP)

## Overview
The protocol implements a privacy-preserving payment layer for x402 buyers. It replaces transparent account payments with ZK note spends while leaving merchant infrastructure unchanged.

## On-Chain Components
### PrivacyPoolUSDC
- Maintains a Merkle tree of note commitments.
- Records spent nullifiers to prevent double-spend.
- Enforces fixed denominations and fee logic.
- Enforces maturity gating via `minAnonSet` and `minConfirmations`.

### Notes
A note is defined by a secret `s` and denomination `d`:
- Commitment: `C = Poseidon(s, d)`
- Nullifier: `N = Poseidon(s, 1)`

Commitments are inserted in a Merkle tree. Nullifiers are stored on-chain when spent.

## ZK Spend Circuit
The Groth16 circuit proves that the spender (MVP uses two input notes):
1. Knows secrets for two commitments in the Merkle tree root.
2. Derives nullifiers from those secrets.
3. Uses only allowed denominations.
4. Pays `price` + `fee` with an optional change note.
5. Binds the proof to the x402 intent hash and expiry.
6. Enforces maturity (`noteCount - index >= minConfirmations`).

Public inputs (ordered):
1. merkleRoot
2. merchant
3. price
4. fee
5. feeRecipient
6. intentHash
7. expiry
8. noteCount
9. minConfirmations
10. changeDenom
11. nullifier1
12. nullifier2
13. changeCommitment

## x402 Intent Binding
The intent hash is deterministic:
```
intentHash = keccak256(chainId|pool|merchant|url|method|price|expiry)
```
Serialization is ASCII with `|` delimiters, no whitespace.

## Fee Model
- Fee is fixed at 30 bps.
- Merchant receives `price` exactly.
- Fee is accrued inside the pool and claimable only by the fee recipient address.

## Denominations
Allowed buckets (USDC base units):
- 5e6, 10e6, 20e6, 50e6, 100e6

This reduces amount-based deanonymization but restricts payable prices. Buyers must decompose deposits into these denominations.
