import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { Note, PinnedMerchant } from './types';

export type StoreData = {
  notes: Note[];
  merchants: PinnedMerchant[];
  commitments: string[];
  lastSyncBlock?: number;
};

const DEFAULT_DATA: StoreData = { notes: [], merchants: [], commitments: [] };
const BIGINT_TAG = '__bigint';

function stringifyWithBigInt(value: unknown): string {
  return JSON.stringify(value, (_, v) => {
    if (typeof v === 'bigint') {
      return { [BIGINT_TAG]: v.toString() };
    }
    return v;
  }, 2);
}

function parseWithBigInt(text: string): StoreData {
  return JSON.parse(text, (_, v) => {
    if (v && typeof v === 'object' && BIGINT_TAG in v) {
      return BigInt((v as { [BIGINT_TAG]: string })[BIGINT_TAG]);
    }
    return v;
  }) as StoreData;
}

export class LocalStore {
  private filePath: string;
  private passphrase?: string;

  constructor(filePath?: string, passphrase?: string) {
    const baseDir = path.join(os.homedir(), '.x402-privacy');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    this.filePath = filePath || path.join(baseDir, passphrase ? 'store.json.enc' : 'store.json');
    this.passphrase = passphrase;
  }

  load(): StoreData {
    if (!fs.existsSync(this.filePath)) {
      return { ...DEFAULT_DATA };
    }
    const raw = fs.readFileSync(this.filePath);
    if (!this.passphrase) {
      return parseWithBigInt(raw.toString('utf8'));
    }

    const payload = JSON.parse(raw.toString('utf8')) as {
      iv: string;
      tag: string;
      data: string;
    };
    const key = crypto.pbkdf2Sync(this.passphrase, 'x402-privacy-salt', 200000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.data, 'hex')),
      decipher.final()
    ]).toString('utf8');
    return parseWithBigInt(decrypted);
  }

  save(data: StoreData): void {
    if (!this.passphrase) {
      fs.writeFileSync(this.filePath, stringifyWithBigInt(data));
      return;
    }
    const key = crypto.pbkdf2Sync(this.passphrase, 'x402-privacy-salt', 200000, 32, 'sha256');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(stringifyWithBigInt(data)),
      cipher.final()
    ]);
    const payload = {
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
      data: encrypted.toString('hex')
    };
    fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2));
  }
}
