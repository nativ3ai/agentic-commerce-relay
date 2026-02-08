import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { loadManifest } from './manifest.js';

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function runWithGuard(command, manifestPath, receiptPath = 'clawshield-receipt.json') {
  if (!fs.existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    return 2;
  }
  const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = loadManifest(manifestPath);
  const guardPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../guard/guard.cjs');

  const cmd = command[0];
  const args = command.slice(1);
  const env = { ...process.env };
  env.CLAWSHIELD_MANIFEST = path.resolve(manifestPath);
  env.CLAWSHIELD_MANIFEST_HASH = sha256(manifestRaw);
  env.CLAWSHIELD_RECEIPT = path.resolve(receiptPath);
  env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --require ${guardPath}`.trim();

  return await new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit', env, shell: false });
    child.on('exit', (code) => resolve(code ?? 0));
  });
}
