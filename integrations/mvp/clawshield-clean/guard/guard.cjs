// Runtime guard for Node-based skills.
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const child_process = require('child_process');

const crypto = require('crypto');

function writeReceipt(data) {
  const out = process.env.CLAWSHIELD_RECEIPT;
  if (!out) return;
  try {
    fs.writeFileSync(out, JSON.stringify(data, null, 2));
  } catch {}
}

process.on('uncaughtException', (err) => {
  if (err && err.code === 'CLAWSHIELD_BLOCKED') {
    writeReceipt({
      status: 'blocked',
      reason: err.message,
      manifest: process.env.CLAWSHIELD_MANIFEST,
      manifest_hash: process.env.CLAWSHIELD_MANIFEST_HASH,
      timestamp: new Date().toISOString()
    });
  }
  throw err;
});

function loadManifest() {
  const file = process.env.CLAWSHIELD_MANIFEST;
  if (!file) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

const manifest = loadManifest() || { permissions: { fs: { read: ["./"], write: [] }, env: { allow: [] }, network: { outbound: [] }, exec: false } };

const SENSITIVE_ENV = [
  'OPENAI', 'ANTHROPIC', 'MOLTBOOK', 'GITHUB', 'AWS', 'AZURE', 'GOOGLE', 'SLACK', 'DISCORD',
  'PRIVATE_KEY', 'SEED', 'MNEMONIC', 'TOKEN', 'SECRET', 'API_KEY', 'KEY'
];

function normalizePath(p) {
  if (p && typeof p === 'object' && p.href && p.protocol === 'file:') {
    return new URL(p).pathname;
  }
  return p;
}

function isPathAllowed(p, allowed) {
  const norm = normalizePath(p);
  const abs = path.resolve(norm);

  return allowed.some((root) => abs.startsWith(path.resolve(root)));
}

function deny(msg) {
  const err = new Error(`ClawShield blocked: ${msg}`);
  err.code = 'CLAWSHIELD_BLOCKED';
  throw err;
}

// FS guards
const origReadFileSync = fs.readFileSync;
fs.readFileSync = function (p, ...args) {
  if (!isPathAllowed(p, manifest.permissions.fs.read || [])) {
    deny(`readFileSync ${p}`);
  }
  return origReadFileSync.call(fs, p, ...args);
};

const origWriteFileSync = fs.writeFileSync;
fs.writeFileSync = function (p, ...args) {
  const receipt = process.env.CLAWSHIELD_RECEIPT;
  if (receipt && path.resolve(p) === path.resolve(receipt)) {
    return origWriteFileSync.call(fs, p, ...args);
  }
  if (!isPathAllowed(p, manifest.permissions.fs.write || [])) {
    deny(`writeFileSync ${p}`);
  }
  return origWriteFileSync.call(fs, p, ...args);
};

// env guard: allow non-sensitive reads by default, block sensitive unless allowlisted
const origEnv = process.env;
process.env = new Proxy(origEnv, {
  get(target, prop) {
    const key = String(prop);
    const allow = manifest.permissions.env.allow || [];
    if (key.startsWith('CLAWSHIELD_')) return target[prop];
    const isSensitive = SENSITIVE_ENV.some((s) => key.toUpperCase().includes(s));
    if (isSensitive && !allow.includes(key)) {
      deny(`env read ${key}`);
    }
    return target[prop];
  }
});

// network guard
function isHostAllowed(options) {
  const allow = manifest.permissions.network.outbound || [];
  if (!allow.length) return false;
  const host = options.hostname || options.host || '';
  return allow.includes(host);
}

const origHttpRequest = http.request;
http.request = function (options, ...args) {
  if (!isHostAllowed(options)) deny(`http.request ${options.hostname || options.host}`);
  return origHttpRequest.call(http, options, ...args);
};

const origHttpsRequest = https.request;
https.request = function (options, ...args) {
  if (!isHostAllowed(options)) deny(`https.request ${options.hostname || options.host}`);
  return origHttpsRequest.call(https, options, ...args);
};

// exec guard
const origExec = child_process.exec;
child_process.exec = function () {
  if (!manifest.permissions.exec) deny('exec');
  return origExec.apply(child_process, arguments);
};

const origSpawn = child_process.spawn;
child_process.spawn = function () {
  if (!manifest.permissions.exec) deny('spawn');
  return origSpawn.apply(child_process, arguments);
};

