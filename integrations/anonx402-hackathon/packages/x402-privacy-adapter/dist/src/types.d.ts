export type NoteStatus = 'unspent' | 'spent';
export type Note = {
    denom: bigint;
    secret: string;
    commitment: string;
    nullifier: string;
    insertionIndex?: number;
    status: NoteStatus;
    chainId: number;
    pool: string;
};
export type PinnedMerchant = {
    id: string;
    name: string;
    url: string;
    chainId: number;
    merchantAddress: string;
    lastSeenPrice?: bigint;
    metadata?: Record<string, unknown>;
};
export type AdapterConfig = {
    rpcUrl: string;
    privateKey: string;
    chainId: number;
    poolAddress: string;
    usdcAddress: string;
    circuitWasmPath: string;
    zkeyPath: string;
    storePath?: string;
    storePassphrase?: string;
};
export type PaymentRequirement = {
    merchantAddress: string;
    price: bigint;
    expiry: number;
    intent?: string;
    chainId: number;
    metadata?: Record<string, unknown>;
};
export type PayResult = {
    txHash: string;
    intentHash: string;
};
