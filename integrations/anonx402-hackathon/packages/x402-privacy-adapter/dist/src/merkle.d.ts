export declare class MerkleTree {
    private depth;
    private zeros;
    private layers;
    private poseidon;
    constructor(depth?: number);
    init(): Promise<void>;
    hash2(a: bigint, b: bigint): bigint;
    build(leaves: bigint[]): void;
    root(): bigint;
    path(index: number): {
        pathElements: bigint[];
        pathIndices: number[];
    };
}
