#!/usr/bin/env node
// Minimal adapter for AgentScape discovery API.
const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (d) => (data += d));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function arg(name, def) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return def;
}

async function main() {
  const name = arg('name', 'payment');
  const tag = arg('tag', 'payments');
  const base = 'https://api.agentscape.cc/agents';
  const url = `${base}?name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}`;

  const res = await get(url);
  const items = res?.data || res || [];
  console.log(JSON.stringify({ query: { name, tag }, count: items.length, items }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
