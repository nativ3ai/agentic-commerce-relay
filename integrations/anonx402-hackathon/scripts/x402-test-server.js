const http = require('node:http');
const { ethers } = require('ethers');

const PORT = Number(process.env.PORT || 8787);
const RPC_URL = process.env.RPC_URL_BASE_MAINNET || process.env.RPC_URL || '';
const USDC_ADDRESS = process.env.USDC_ADDRESS_BASE_MAINNET || process.env.USDC_ADDRESS || '';
const MERCHANT_ADDRESS = process.env.MERCHANT_ADDRESS || '';
const PRICE = BigInt(process.env.PRICE_USDC || '5000000'); // 5 USDC (6 decimals)
const CHAIN_ID = Number(process.env.CHAIN_ID || 8453);
const EXPIRY_SECS = Number(process.env.EXPIRY_SECS || 300);

if (!RPC_URL || !USDC_ADDRESS || !MERCHANT_ADDRESS) {
  console.error('Missing RPC_URL_BASE_MAINNET/USDC_ADDRESS_BASE_MAINNET/MERCHANT_ADDRESS');
  process.exit(1);
}

const ERC20_ABI = ['function balanceOf(address account) view returns (uint256)'];
const provider = new ethers.JsonRpcProvider(RPC_URL);
const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);

let baselineBalance = 0n;

async function getBalance() {
  const bal = await usdc.balanceOf(MERCHANT_ADDRESS);
  return BigInt(bal.toString());
}

function requirement() {
  return {
    merchantAddress: MERCHANT_ADDRESS,
    price: PRICE.toString(),
    expiry: Math.floor(Date.now() / 1000) + EXPIRY_SECS,
    chainId: CHAIN_ID
  };
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
    'x-payment-required': payload
  });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url !== '/x402') {
      res.writeHead(404);
      return res.end('not found');
    }

    if (!baselineBalance) {
      baselineBalance = await getBalance();
    }

    const intent = req.headers['x-payment-intent'];
    const txHash = req.headers['x-payment-tx'];

    if (!intent || !txHash) {
      return json(res, 402, requirement());
    }

    const current = await getBalance();
    if (current >= baselineBalance + PRICE) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, txHash, intent }));
    }

    return json(res, 402, requirement());
  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(err) }));
  }
});

server.listen(PORT, () => {
  console.log(`x402 test server listening on http://localhost:${PORT}/x402`);
});
