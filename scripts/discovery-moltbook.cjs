#!/usr/bin/env node
// Minimal discovery adapter using Moltbook Submolt feed.
const https = require('https');

function get(url, token) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function arg(name, def) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return def;
}

async function main() {
  const token = process.env.MOLTBOOK_API_KEY;
  if (!token) throw new Error('MOLTBOOK_API_KEY is required');

  const sort = arg('sort', 'new');
  const submolt = arg('submolt', 'usdc');
  const tag = (arg('tag', '') || '').toLowerCase();

  const url = `https://www.moltbook.com/api/v1/submolts/${submolt}/feed?sort=${encodeURIComponent(sort)}`;
  const res = await get(url, token);
  const items = res?.posts || res || [];

  const filtered = items.filter((p) => {
    const title = (p.title || '').toLowerCase();
    const content = (p.content || '').toLowerCase();
    if (!tag) return true;
    return title.includes(tag) || content.includes(tag);
  });

  console.log(JSON.stringify({ query: { submolt, sort, tag }, count: filtered.length, items: filtered }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
