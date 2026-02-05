import axios from 'axios';
import { ethers } from 'ethers';

const BASE_RPC = process.env.BASE_RPC;
const AMOY_RPC = process.env.AMOY_RPC;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const AMOUNT = BigInt(process.env.AMOUNT || '1000000'); // 1 USDC (6 decimals)

if (!BASE_RPC || !AMOY_RPC || !PRIVATE_KEY) {
  console.error('Missing BASE_RPC, AMOY_RPC, or PRIVATE_KEY');
  process.exit(1);
}

// Official Circle testnet contracts
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const USDC_AMOY = '0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582';
const TOKEN_MESSENGER_BASE = '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5';
const MESSAGE_TRANSMITTER_BASE = '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD';
const MESSAGE_TRANSMITTER_AMOY = '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD';
const DEST_DOMAIN_AMOY = 7; // Circle domain ID for Polygon Amoy

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
  const baseProvider = new ethers.JsonRpcProvider(BASE_RPC);
  const amoyProvider = new ethers.JsonRpcProvider(AMOY_RPC);
  const baseWallet = new ethers.Wallet(PRIVATE_KEY, baseProvider);
  const amoyWallet = new ethers.Wallet(PRIVATE_KEY, amoyProvider);
  const recipient = baseWallet.address;

  const usdc = new ethers.Contract(USDC_BASE_SEPOLIA, ERC20_ABI, baseWallet);
  if (!process.env.SKIP_APPROVE) {
    const approveTx = await usdc.approve(TOKEN_MESSENGER_BASE, AMOUNT);
    await approveTx.wait();
  }

  const tokenMessenger = new ethers.Contract(TOKEN_MESSENGER_BASE, TOKEN_MESSENGER_ABI, baseWallet);
  const burnTx = await tokenMessenger.depositForBurn(
    AMOUNT,
    DEST_DOMAIN_AMOY,
    toBytes32Address(recipient),
    USDC_BASE_SEPOLIA
  );
  const burnReceipt = await burnTx.wait();

  const mtInterface = new ethers.Interface(MESSAGE_TRANSMITTER_ABI);
  let messageBytes;
  for (const log of burnReceipt.logs) {
    if (log.address.toLowerCase() !== MESSAGE_TRANSMITTER_BASE.toLowerCase()) continue;
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
    MESSAGE_TRANSMITTER_AMOY,
    MESSAGE_TRANSMITTER_ABI,
    amoyWallet
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
