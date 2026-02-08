import { expect } from 'chai';
import { ethers } from 'hardhat';
import fs from 'node:fs';
import path from 'node:path';

const DENOM_5 = 5_000_000n;
const DENOM_10 = 10_000_000n;

describe('PrivacyPoolUSDC', () => {
  it('enforces denominations on deposit', async () => {
    const [deployer] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory('MockUSDC');
    const usdc = await Mock.deploy(1_000_000_000, deployer.address);
    await usdc.waitForDeployment();

    const Verifier = await ethers.getContractFactory('MockVerifier');
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();

    const poseidon = await deployLibrary(deployer, 'contracts/poseidon/PoseidonT3.sol', 'PoseidonT3');
    const poolFactory = await getLinkedFactory(
      deployer,
      'contracts/PrivacyPoolUSDC.sol',
      'PrivacyPoolUSDC',
      {
        'contracts/poseidon/PoseidonT3.sol:PoseidonT3': await poseidon.getAddress()
      }
    );
    const pool = await poolFactory.deploy(
      await usdc.getAddress(),
      await verifier.getAddress(),
      2,
      1
    );
    await pool.waitForDeployment();

    await usdc.approve(await pool.getAddress(), DENOM_5);
    await expect(pool.depositDenomination(DENOM_5, ethers.keccak256('0x01'))).to.emit(
      pool,
      'Deposit'
    );

    await expect(pool.depositDenomination(123, ethers.keccak256('0x02'))).to.be.revertedWith('DENOM');
  });

  it('pays merchant and accrues fee', async () => {
    const [deployer, merchant] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory('MockUSDC');
    const usdc = await Mock.deploy(1_000_000_000, deployer.address);
    await usdc.waitForDeployment();

    const Verifier = await ethers.getContractFactory('MockVerifier');
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();

    const poseidon = await deployLibrary(deployer, 'contracts/poseidon/PoseidonT3.sol', 'PoseidonT3');
    const poolFactory = await getLinkedFactory(
      deployer,
      'contracts/PrivacyPoolUSDC.sol',
      'PrivacyPoolUSDC',
      {
        'contracts/poseidon/PoseidonT3.sol:PoseidonT3': await poseidon.getAddress()
      }
    );
    const pool = await poolFactory.deploy(
      await usdc.getAddress(),
      await verifier.getAddress(),
      2,
      1
    );
    await pool.waitForDeployment();

    await usdc.approve(await pool.getAddress(), DENOM_5 + DENOM_10);
    await pool.depositDenomination(DENOM_5, ethers.keccak256('0x01'));
    await pool.depositDenomination(DENOM_10, ethers.keccak256('0x02'));

    const price = 10_000_000n;
    const fee = (price * 30n) / 10000n;

    const inputs = {
      merkleRoot: await pool.root(),
      nullifier1: ethers.keccak256('0x11'),
      nullifier2: ethers.keccak256('0x12'),
      merchant: merchant.address,
      price,
      fee,
      feeRecipient: '0xBf395260f5780a2BC7C7A3321f59C39F4b91D27f',
      intentHash: ethers.keccak256('0xdead'),
      expiry: (await ethers.provider.getBlock('latest')).timestamp + 3600,
      noteCount: await pool.noteCount(),
      minConfirmations: 1,
      changeDenom: 0,
      changeCommitment: ethers.ZeroHash
    };

    await expect(pool.payMerchant({ a: [0, 0], b: [[0, 0], [0, 0]], c: [0, 0] }, inputs))
      .to.emit(pool, 'Spend')
      .withArgs(merchant.address, price, fee, inputs.intentHash);

    const feeAccrued = await pool.feeAccrued();
    expect(feeAccrued).to.equal(fee);
  });
});

async function deployLibrary(signer: any, source: string, name: string) {
  const artifact = loadArtifact(source, name);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  return contract;
}

async function getLinkedFactory(
  signer: any,
  source: string,
  name: string,
  libraries: Record<string, string>
) {
  const artifact = loadArtifact(source, name);
  const bytecode = linkBytecode(artifact.bytecode, artifact.linkReferences, libraries);
  return new ethers.ContractFactory(artifact.abi, bytecode, signer);
}

function loadArtifact(source: string, name: string) {
  const normalized = source.startsWith('contracts/') ? source.slice('contracts/'.length) : source;
  const artifactPath = path.join(
    __dirname,
    '..',
    'artifacts',
    'contracts',
    normalized,
    `${name}.json`
  );
  return JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
}

function linkBytecode(
  bytecode: string,
  linkReferences: Record<string, Record<string, { start: number; length: number }[]>>,
  libraries: Record<string, string>
) {
  let linkedBytecode = bytecode.replace(/^0x/, '');
  for (const [source, libs] of Object.entries(linkReferences || {})) {
    for (const [libName, refs] of Object.entries(libs)) {
      const key = `${source}:${libName}`;
      const address = libraries[key];
      if (!address) {
        throw new Error(`Missing address for library ${key}`);
      }
      const addr = address.replace(/^0x/, '');
      for (const ref of refs) {
        const start = ref.start * 2;
        const length = ref.length * 2;
        linkedBytecode =
          linkedBytecode.slice(0, start) +
          addr.padStart(length, '0') +
          linkedBytecode.slice(start + length);
      }
    }
  }
  return '0x' + linkedBytecode;
}
