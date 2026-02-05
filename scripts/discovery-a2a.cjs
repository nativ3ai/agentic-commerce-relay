#!/usr/bin/env node
// Minimal adapter for the A2A Registry JSON-RPC discovery API.
const https = require('https');

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function arg(name, def) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return def;
}

async function main() {
  const name = (arg('name', '') || '').toLowerCase();
  const tag = (arg('tag', '') || '').toLowerCase();

  const payload = {
    jsonrpc: '2.0',
    method: 'search_agents',
    params: {
      query: name || undefined,
      skills: tag ? [tag] : undefined,
      protocol_version: '0.3.0'
    },
    id: 1
  };

  const res = await postJson('https://api.a2a-registry.dev/jsonrpc', payload);
  if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`);
  const items = res.result || [];
  console.log(JSON.stringify({ query: { name, tag }, count: items.length, items }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
