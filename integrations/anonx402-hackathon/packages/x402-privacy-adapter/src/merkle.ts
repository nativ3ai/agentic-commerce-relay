import { buildPoseidon } from 'circomlibjs';

export class MerkleTree {
  private depth: number;
  private zeros: bigint[] = [];
  private layers: bigint[][] = [];
  private poseidon: any;

  constructor(depth = 20) {
    this.depth = depth;
  }

  async init(): Promise<void> {
    this.poseidon = await buildPoseidon();
    let zero = 0n;
    this.zeros = [zero];
    for (let i = 0; i < this.depth; i++) {
      zero = this.hash2(zero, zero);
      this.zeros.push(zero);
    }
  }

  hash2(a: bigint, b: bigint): bigint {
    const res = this.poseidon([a, b]);
    return this.poseidon.F.toObject(res) as bigint;
  }

  build(leaves: bigint[]): void {
    this.layers = [];
    this.layers[0] = leaves.slice();
    for (let level = 0; level < this.depth; level++) {
      const current = this.layers[level] || [];
      const next: bigint[] = [];
      for (let i = 0; i < Math.max(1, Math.ceil(current.length / 2)); i++) {
        const left = current[i * 2] ?? this.zeros[level];
        const right = current[i * 2 + 1] ?? this.zeros[level];
        next.push(this.hash2(left, right));
      }
      this.layers[level + 1] = next;
    }
  }

  root(): bigint {
    return this.layers[this.depth]?.[0] ?? this.zeros[this.depth];
  }

  path(index: number): { pathElements: bigint[]; pathIndices: number[] } {
    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];
    let idx = index;
    for (let level = 0; level < this.depth; level++) {
      const siblingIndex = idx ^ 1;
      const sibling = this.layers[level]?.[siblingIndex] ?? this.zeros[level];
      pathElements.push(sibling);
      pathIndices.push(idx & 1);
      idx >>= 1;
    }
    return { pathElements, pathIndices };
  }
}
