import axios from 'axios';
import { ethers } from 'ethers';

const SRC_RPC = process.env.SRC_RPC || process.env.BASE_RPC;
const DST_RPC = process.env.DST_RPC || process.env.AMOY_RPC;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const AMOUNT = BigInt(process.env.AMOUNT || '1000000'); // 1 USDC (6 decimals)

if (!SRC_RPC || !DST_RPC || !PRIVATE_KEY) {
  console.error('Missing SRC_RPC/DST_RPC (or BASE_RPC/AMOY_RPC), or PRIVATE_KEY');
  process.exit(1);
}

// Default demo: Base Sepolia -> Polygon Amoy (override via env vars for any CCTP chain pair)
const SRC_USDC = process.env.SRC_USDC || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const SRC_TOKEN_MESSENGER = process.env.SRC_TOKEN_MESSENGER || '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5';
const SRC_MESSAGE_TRANSMITTER = process.env.SRC_MESSAGE_TRANSMITTER || '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD';
const DST_MESSAGE_TRANSMITTER = process.env.DST_MESSAGE_TRANSMITTER || '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD';
const DST_DOMAIN = Number(process.env.DST_DOMAIN || 7); // Polygon Amoy domain by default

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

const TOKEN_MESSENGER_ABI = [
  'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) external returns (uint64)'
];

const MESSAGE_TRANSMITTER_ABI = [
  'event MessageSent(bytes message)',
  'function receiveMessage(bytes message, bytes attestation) external returns (bool)'
];

const ATTESTATION_ENDPOINT = 'https://iris-api-sandbox.circle.com/v1/attestations/';

function toBytes32Address(addr) {
  return ethers.zeroPadValue(addr, 32);
}

async function waitForAttestation(messageHash) {
  const retries = Number(process.env.ATTESTATION_RETRIES || 180);
  const delayMs = Number(process.env.ATTESTATION_DELAY_MS || 2000);
  for (let i = 0; i < retries; i += 1) {
    const url = `${ATTESTATION_ENDPOINT}${messageHash}`;
    try {
      const res = await axios.get(url);
      if (res.data.status === 'complete') {
        return res.data.attestation;
      }
    } catch (err) {
      if (err.response && err.response.status === 404) {
        // Attestation not ready yet
      } else {
        throw err;
      }
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error('Attestation timeout');
}

async function main() {
  const srcProvider = new ethers.JsonRpcProvider(SRC_RPC);
  const dstProvider = new ethers.JsonRpcProvider(DST_RPC);
  const srcWallet = new ethers.Wallet(PRIVATE_KEY, srcProvider);
  const dstWallet = new ethers.Wallet(PRIVATE_KEY, dstProvider);
  const recipient = srcWallet.address;

  const usdc = new ethers.Contract(SRC_USDC, ERC20_ABI, srcWallet);
  if (!process.env.SKIP_APPROVE) {
    const approveTx = await usdc.approve(SRC_TOKEN_MESSENGER, AMOUNT);
    await approveTx.wait();
  }

  const tokenMessenger = new ethers.Contract(SRC_TOKEN_MESSENGER, TOKEN_MESSENGER_ABI, srcWallet);
  const burnTx = await tokenMessenger.depositForBurn(
    AMOUNT,
    DST_DOMAIN,
    toBytes32Address(recipient),
    SRC_USDC
  );
  const burnReceipt = await burnTx.wait();

  const mtInterface = new ethers.Interface(MESSAGE_TRANSMITTER_ABI);
  let messageBytes;
  for (const log of burnReceipt.logs) {
    if (log.address.toLowerCase() !== SRC_MESSAGE_TRANSMITTER.toLowerCase()) continue;
    const parsed = mtInterface.parseLog(log);
    if (parsed?.name === 'MessageSent') {
      messageBytes = parsed.args.message;
      break;
    }
  }
  if (!messageBytes) {
    throw new Error('MessageSent not found in receipt');
  }

  const messageHash = ethers.keccak256(messageBytes);
  console.log(JSON.stringify({ burnTx: burnReceipt.hash, messageHash, recipient }, null, 2));
  const attestation = await waitForAttestation(messageHash);

  const messageTransmitter = new ethers.Contract(
    DST_MESSAGE_TRANSMITTER,
    MESSAGE_TRANSMITTER_ABI,
    dstWallet
  );
  const mintTx = await messageTransmitter.receiveMessage(messageBytes, attestation);
  const mintReceipt = await mintTx.wait();

  console.log(JSON.stringify({
    burnTx: burnReceipt.hash,
    messageHash,
    mintTx: mintReceipt.hash,
    recipient
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
