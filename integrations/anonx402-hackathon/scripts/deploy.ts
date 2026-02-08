import { ethers, network } from 'hardhat';
import fs from 'node:fs';
import path from 'node:path';

const BASE_MAINNET_CHAIN_ID = 8453;
const BASE_SEPOLIA_CHAIN_ID = 84532;
const BASE_MAINNET_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const DEFAULT_TESTNET_USDC = '0x810a4aCEbBf3DE27BC4EfB05b6CF126105E779E9';
const EXPECTED_FEE_BPS = 30n;
const EXPECTED_FEE_RECIPIENT = '0xBf395260f5780a2BC7C7A3321f59C39F4b91D27f';

async function main(): Promise<void> {
  const networkName = network.name;
  const minAnonSet = Number(process.env.MIN_ANON_SET || 8);
  const minConfirmations = Number(process.env.MIN_CONFIRMATIONS || 4);

  if (networkName !== 'baseMainnet' && networkName !== 'baseSepolia') {
    throw new Error('Unsupported network. Use --network baseMainnet or --network baseSepolia.');
  }

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (networkName === 'baseMainnet' && chainId !== BASE_MAINNET_CHAIN_ID) {
    throw new Error(`Unexpected chainId ${chainId}. Expected ${BASE_MAINNET_CHAIN_ID}.`);
  }
  if (networkName === 'baseSepolia' && chainId !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error(`Unexpected chainId ${chainId}. Expected ${BASE_SEPOLIA_CHAIN_ID}.`);
  }

  const usdcAddress =
    process.env.USDC_ADDRESS ||
    (networkName === 'baseMainnet' ? BASE_MAINNET_USDC : DEFAULT_TESTNET_USDC);

  const Verifier = await ethers.getContractFactory('Groth16Verifier');
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();

  const Poseidon = await ethers.getContractFactory('PoseidonT3');
  const poseidon = await Poseidon.deploy();
  await poseidon.waitForDeployment();

  const Pool = await ethers.getContractFactory('PrivacyPoolUSDC', {
    libraries: {
      PoseidonT3: await poseidon.getAddress()
    }
  });
  const pool = await Pool.deploy(usdcAddress, await verifier.getAddress(), minAnonSet, minConfirmations);
  await pool.waitForDeployment();

  const deploymentsPath = path.join(__dirname, '..', 'deployments', `${networkName}.json`);
  const current = fs.existsSync(deploymentsPath)
    ? JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'))
    : {};

  current[networkName] = {
    verifier: await verifier.getAddress(),
    poseidon: await poseidon.getAddress(),
    pool: await pool.getAddress(),
    usdc: usdcAddress,
    minAnonSet,
    minConfirmations
  };

  fs.writeFileSync(deploymentsPath, JSON.stringify(current, null, 2));

  const deployedPool = await ethers.getContractAt('PrivacyPoolUSDC', await pool.getAddress());
  const feeBps = await deployedPool.FEE_BPS();
  const feeRecipient = await deployedPool.FEE_RECIPIENT();
  const merkleRoot = await deployedPool.root();
  const noteCount = await deployedPool.noteCount();
  const [actualMinAnonSet, actualMinConfirmations] = await deployedPool.params();

  const errors: string[] = [];
  if (feeBps !== EXPECTED_FEE_BPS) {
    errors.push(`feeBps mismatch: got ${feeBps.toString()}, expected ${EXPECTED_FEE_BPS.toString()}`);
  }
  if (feeRecipient.toLowerCase() !== EXPECTED_FEE_RECIPIENT.toLowerCase()) {
    errors.push(`feeRecipient mismatch: got ${feeRecipient}, expected ${EXPECTED_FEE_RECIPIENT}`);
  }
  if (Number(actualMinAnonSet) !== minAnonSet) {
    errors.push(`minAnonSet mismatch: got ${actualMinAnonSet}, expected ${minAnonSet}`);
  }
  if (Number(actualMinConfirmations) !== minConfirmations) {
    errors.push(`minConfirmations mismatch: got ${actualMinConfirmations}, expected ${minConfirmations}`);
  }
  if (noteCount !== 0n) {
    errors.push(`noteCount mismatch: got ${noteCount.toString()}, expected 0`);
  }
  if (merkleRoot === ethers.ZeroHash) {
    errors.push('merkleRoot mismatch: root is zero hash');
  }
  if (errors.length > 0) {
    throw new Error(`Post-deploy validation failed:\n- ${errors.join('\n- ')}`);
  }

  console.log(`Deployed on ${networkName}`);
  console.log(`Verifier: ${await verifier.getAddress()}`);
  console.log(`Poseidon: ${await poseidon.getAddress()}`);
  console.log(`Pool: ${await pool.getAddress()}`);
  console.log(`USDC: ${usdcAddress}`);
  console.log(`feeBps: ${feeBps.toString()}`);
  console.log(`feeRecipient: ${feeRecipient}`);
  console.log(`merkleRoot: ${merkleRoot}`);
  console.log(`minAnonSet: ${actualMinAnonSet.toString()}`);
  console.log(`minConfirmations: ${actualMinConfirmations.toString()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
