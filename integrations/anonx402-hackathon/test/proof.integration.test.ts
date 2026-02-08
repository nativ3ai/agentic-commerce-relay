import { expect } from 'chai';
import { ethers } from 'hardhat';
import fs from 'node:fs';
import path from 'node:path';
import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';
import { MerkleTree } from '../packages/x402-privacy-adapter/src/merkle';

const DENOMS = [5_000_000n, 10_000_000n, 20_000_000n, 50_000_000n, 100_000_000n];

describe('ZK spend integration', () => {
  it('generates and verifies a spend proof', async () => {
    const wasmPath = path.join(__dirname, '..', 'circuits', 'build', 'spend_js', 'spend.wasm');
    const zkeyPath = path.join(__dirname, '..', 'circuits', 'build', 'spend_final.zkey');

    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
      throw new Error('Missing circuit artifacts. Run npm run zk:compile && npm run zk:setup');
    }

    const [deployer, merchant] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory('MockUSDC');
    const usdc = await Mock.deploy(1_000_000_000, deployer.address);
    await usdc.waitForDeployment();

    const verifierArtifact = loadArtifact('contracts/verifier/Verifier.sol', 'Groth16Verifier');
    const verifierFactory = new ethers.ContractFactory(
      verifierArtifact.abi,
      verifierArtifact.bytecode,
      deployer
    );
    const verifier = await verifierFactory.deploy();
    await verifier.waitForDeployment();

    const poseidonLib = await deployLibrary(
      deployer,
      'contracts/poseidon/PoseidonT3.sol',
      'PoseidonT3'
    );
    const poolFactory = await getLinkedFactory(
      deployer,
      'contracts/PrivacyPoolUSDC.sol',
      'PrivacyPoolUSDC',
      {
        'contracts/poseidon/PoseidonT3.sol:PoseidonT3': await poseidonLib.getAddress()
      }
    );
    const pool = await poolFactory.deploy(await usdc.getAddress(), await verifier.getAddress(), 2, 0);
    await pool.waitForDeployment();

    const poseidon = await buildPoseidon();
    const tree = new MerkleTree(20);
    await tree.init();

    const secret1 = 1111n;
    const secret2 = 2222n;

    const selection = findValidSelection();
    const denom1 = selection.denom1;
    const denom2 = selection.denom2;

    const commitment1 = poseidon.F.toObject(poseidon([secret1, denom1])) as bigint;
    const commitment2 = poseidon.F.toObject(poseidon([secret2, denom2])) as bigint;

    await usdc.approve(await pool.getAddress(), denom1 + denom2);
    await pool.depositDenomination(denom1, ethers.zeroPadValue(ethers.toBeHex(commitment1), 32));
    await pool.depositDenomination(denom2, ethers.zeroPadValue(ethers.toBeHex(commitment2), 32));

    const leaves = [commitment1, commitment2];
    tree.build(leaves);

    const path1 = tree.path(0);
    const path2 = tree.path(1);

    const price = selection.price;
    const fee = selection.fee;

    const input = {
      secret1: secret1.toString(),
      denom1: denom1.toString(),
      secret2: secret2.toString(),
      denom2: denom2.toString(),
      pathElements1: path1.pathElements.map((v) => v.toString()),
      pathIndices1: path1.pathIndices.map((v) => v.toString()),
      pathElements2: path2.pathElements.map((v) => v.toString()),
      pathIndices2: path2.pathIndices.map((v) => v.toString()),
      changeSecret: '0',
      nullifier1: (poseidon.F.toObject(poseidon([secret1, 1n])) as bigint).toString(),
      nullifier2: (poseidon.F.toObject(poseidon([secret2, 1n])) as bigint).toString(),
      changeCommitment: '0',
      merkleRoot: tree.root().toString(),
      merchant: BigInt(merchant.address).toString(),
      price: price.toString(),
      fee: fee.toString(),
      feeRecipient: BigInt('0xBf395260f5780a2BC7C7A3321f59C39F4b91D27f').toString(),
      intentHash: '123',
      expiry: BigInt((await ethers.provider.getBlock('latest')).timestamp + 3600).toString(),
      noteCount: '2',
      minConfirmations: '0',
      changeDenom: '0'
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
    // publicSignals used for contract inputs below
    const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const parsed = calldata
      .replace(/\[|\]|"|\s/g, '')
      .split(',')
      .map((x: string) => BigInt(x));

    const a: [bigint, bigint] = [parsed[0], parsed[1]];
    const b: [bigint, bigint][] = [
      [parsed[2], parsed[3]],
      [parsed[4], parsed[5]]
    ];
    const c: [bigint, bigint] = [parsed[6], parsed[7]];
    const inputSignals = publicSignals.map((v: string) => v.toString());

    const inputs = {
      merkleRoot: ethers.zeroPadValue(ethers.toBeHex(inputSignals[0]), 32),
      merchant: ethers.getAddress(
        ethers.zeroPadValue(ethers.toBeHex(inputSignals[1]), 20)
      ),
      price: BigInt(inputSignals[2]),
      fee: BigInt(inputSignals[3]),
      feeRecipient: ethers.getAddress(
        ethers.zeroPadValue(ethers.toBeHex(inputSignals[4]), 20)
      ),
      intentHash: ethers.zeroPadValue(ethers.toBeHex(inputSignals[5]), 32),
      expiry: BigInt(inputSignals[6]),
      noteCount: BigInt(inputSignals[7]),
      minConfirmations: BigInt(inputSignals[8]),
      changeDenom: BigInt(inputSignals[9]),
      nullifier1: ethers.zeroPadValue(ethers.toBeHex(inputSignals[10]), 32),
      nullifier2: ethers.zeroPadValue(ethers.toBeHex(inputSignals[11]), 32),
      changeCommitment: ethers.zeroPadValue(ethers.toBeHex(inputSignals[12]), 32)
    };

    await expect(pool.payMerchant({ a, b, c }, inputs)).to.emit(pool, 'Spend');
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

function findValidSelection(): {
  price: bigint;
  fee: bigint;
  denom1: bigint;
  denom2: bigint;
} {
  for (let price = 1_000_000n; price <= 50_000_000n; price += 1n) {
    const fee = (price * 30n) / 10000n;
    const total = price + fee;
    for (let i = 0; i < DENOMS.length; i++) {
      for (let j = i; j < DENOMS.length; j++) {
        if (DENOMS[i] + DENOMS[j] === total) {
          return { price, fee, denom1: DENOMS[i], denom2: DENOMS[j] };
        }
      }
    }
  }
  throw new Error('No valid price + denom combination found');
}
