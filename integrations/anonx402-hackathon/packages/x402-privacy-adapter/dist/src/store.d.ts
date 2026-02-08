import { Note, PinnedMerchant } from './types';
export type StoreData = {
    notes: Note[];
    merchants: PinnedMerchant[];
    commitments: string[];
    lastSyncBlock?: number;
};
export declare class LocalStore {
    private filePath;
    private passphrase?;
    constructor(filePath?: string, passphrase?: string);
    load(): StoreData;
    save(data: StoreData): void;
}
