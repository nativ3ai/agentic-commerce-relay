"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalStore = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = __importDefault(require("node:os"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const DEFAULT_DATA = { notes: [], merchants: [], commitments: [] };
class LocalStore {
    constructor(filePath, passphrase) {
        const baseDir = node_path_1.default.join(node_os_1.default.homedir(), '.x402-privacy');
        if (!node_fs_1.default.existsSync(baseDir)) {
            node_fs_1.default.mkdirSync(baseDir, { recursive: true });
        }
        this.filePath = filePath || node_path_1.default.join(baseDir, passphrase ? 'store.json.enc' : 'store.json');
        this.passphrase = passphrase;
    }
    load() {
        if (!node_fs_1.default.existsSync(this.filePath)) {
            return { ...DEFAULT_DATA };
        }
        const raw = node_fs_1.default.readFileSync(this.filePath);
        if (!this.passphrase) {
            return JSON.parse(raw.toString('utf8'));
        }
        const payload = JSON.parse(raw.toString('utf8'));
        const key = node_crypto_1.default.pbkdf2Sync(this.passphrase, 'x402-privacy-salt', 200000, 32, 'sha256');
        const decipher = node_crypto_1.default.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'hex'));
        decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(payload.data, 'hex')),
            decipher.final()
        ]).toString('utf8');
        return JSON.parse(decrypted);
    }
    save(data) {
        if (!this.passphrase) {
            node_fs_1.default.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
            return;
        }
        const key = node_crypto_1.default.pbkdf2Sync(this.passphrase, 'x402-privacy-salt', 200000, 32, 'sha256');
        const iv = node_crypto_1.default.randomBytes(12);
        const cipher = node_crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([
            cipher.update(JSON.stringify(data)),
            cipher.final()
        ]);
        const payload = {
            iv: iv.toString('hex'),
            tag: cipher.getAuthTag().toString('hex'),
            data: encrypted.toString('hex')
        };
        node_fs_1.default.writeFileSync(this.filePath, JSON.stringify(payload, null, 2));
    }
}
exports.LocalStore = LocalStore;
