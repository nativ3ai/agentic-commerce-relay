const { ethers } = require('ethers');
const { buildPoseidon } = require('circomlibjs');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const RPC_URL = process.env.RPC_URL_BASE_SEPOLIA;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const POOL_ADDRESS = process.env.POOL_ADDRESS;
const USDC_ADDRESS = process.env.USDC_ADDRESS;

if (!RPC_URL || !PRIVATE_KEY || !POOL_ADDRESS || !USDC_ADDRESS) {
  console.error('Missing RPC_URL_BASE_SEPOLIA, PRIVATE_KEY, POOL_ADDRESS, or USDC_ADDRESS');
  process.exit(1);
}

const poolAbi = require('../artifacts/contracts/PrivacyPoolUSDC.sol/PrivacyPoolUSDC.json').abi;
const usdcAbi = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)'
];

const BIGINT_TAG = '__bigint';

function stringifyWithBigInt(value) {
  return JSON.stringify(value, (_, v) => {
    if (typeof v === 'bigint') {
      return { [BIGINT_TAG]: v.toString() };
    }
    return v;
  }, 2);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const pool = new ethers.Contract(POOL_ADDRESS, poolAbi, wallet);
  const usdc = new ethers.Contract(USDC_ADDRESS, usdcAbi, wallet);

  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  const denoms = [10_000_000n, 5_000_000n];
  const total = denoms.reduce((a, b) => a + b, 0n);

  const allowance = await usdc.allowance(wallet.address, POOL_ADDRESS);
  if (allowance < total) {
    const tx = await usdc.approve(POOL_ADDRESS, total);
    await tx.wait();
  }

  const notes = [];
  for (const denom of denoms) {
    const secret = crypto.randomBytes(32).toString('hex');
    const commitment = ethers.zeroPadValue(
      ethers.toBeHex(F.toObject(poseidon([BigInt('0x' + secret), denom]))),
      32
    );
    const nullifier = ethers.zeroPadValue(
      ethers.toBeHex(F.toObject(poseidon([BigInt('0x' + secret), 1n]))),
      32
    );

    const tx = await pool.depositDenomination(denom, commitment);
    const receipt = await tx.wait();
    const event = receipt.logs
      .map((log) => pool.interface.parseLog(log))
      .find((parsed) => parsed?.name === 'Deposit');
    const index = event?.args?.index ? Number(event.args.index) : undefined;

    notes.push({
      denom,
      secret,
      commitment,
      nullifier,
      insertionIndex: index,
      status: 'unspent',
      chainId: 84532,
      pool: POOL_ADDRESS
    });
  }

  const depositEvents = await pool.queryFilter(pool.filters.Deposit(), 0, 'latest');
  const changeEvents = await pool.queryFilter(pool.filters.Change(), 0, 'latest');
  const allEvents = [...depositEvents, ...changeEvents].sort((a, b) => {
    const blockDiff = (a.blockNumber || 0) - (b.blockNumber || 0);
    if (blockDiff !== 0) return blockDiff;
    const aLogIndex = a.logIndex || 0;
    const bLogIndex = b.logIndex || 0;
    return aLogIndex - bLogIndex;
  });

  const commitments = [];
  for (const ev of allEvents) {
    const commitment = ev.args?.commitment;
    if (commitment && !commitments.includes(commitment)) {
      commitments.push(commitment);
    }
  }

  const store = {
    notes,
    merchants: [],
    commitments,
    lastSyncBlock: (await provider.getBlockNumber()) + 1
  };

  const baseDir = path.join(os.homedir(), '.x402-privacy');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  const storePath = path.join(baseDir, 'store.json');
  fs.writeFileSync(storePath, stringifyWithBigInt(store));
  console.log(`Wrote store to ${storePath}`);
  console.log('Notes:', notes.map((n) => ({ denom: n.denom.toString(), commitment: n.commitment })));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
