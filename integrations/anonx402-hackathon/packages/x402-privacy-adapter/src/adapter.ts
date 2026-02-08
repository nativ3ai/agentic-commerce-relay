import { ethers } from 'ethers';
import { fetch, RequestInit, Response } from 'undici';
import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';
import crypto from 'node:crypto';
import path from 'node:path';
import { AdapterConfig, Note, PayResult, PaymentRequirement, PinnedMerchant } from './types';
import { LocalStore } from './store';
import { MerkleTree } from './merkle';

const POOL_ABI = [
  'function depositDenomination(uint256 denom, bytes32 commitment) external',
  'function payMerchant((uint256[2] a,uint256[2][2] b,uint256[2] c),(bytes32,bytes32,bytes32,address,uint256,uint256,address,bytes32,uint256,uint256,uint256,uint256,bytes32)) external',
  'function root() view returns (bytes32)',
  'function noteCount() view returns (uint32)',
  'function nullifierSpent(bytes32) view returns (bool)',
  'function params() view returns (uint256,uint256)',
  'event Deposit(bytes32 indexed commitment, uint256 denom, uint32 index)',
  'event Change(bytes32 indexed commitment, uint256 denom, uint32 index)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) view returns (uint256)'
];

const FEE_BPS = 30n;
const FEE_RECIPIENT = '0xBf395260f5780a2BC7C7A3321f59C39F4b91D27f';

const ALLOWED_DENOMS = [5_000_000n, 10_000_000n, 20_000_000n, 50_000_000n, 100_000_000n];

export class PrivacyAdapter {
  private config: AdapterConfig;
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private pool: ethers.Contract;
  private usdc: ethers.Contract;
  private store: LocalStore;
  private merkle: MerkleTree;
  private poseidon: any;

  constructor(config: AdapterConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.signer = new ethers.Wallet(config.privateKey, this.provider);
    this.pool = new ethers.Contract(config.poolAddress, POOL_ABI, this.signer);
    this.usdc = new ethers.Contract(config.usdcAddress, ERC20_ABI, this.signer);
    this.store = new LocalStore(config.storePath, config.storePassphrase);
    this.merkle = new MerkleTree(20);
  }

  async init(): Promise<void> {
    this.poseidon = await buildPoseidon();
    await this.merkle.init();
  }

  async pinMerchant(name: string, url: string, merchantAddress: string): Promise<PinnedMerchant> {
    const data = this.store.load();
    const id = crypto.randomBytes(8).toString('hex');
    const merchant: PinnedMerchant = {
      id,
      name,
      url,
      chainId: this.config.chainId,
      merchantAddress
    };
    data.merchants.push(merchant);
    this.store.save(data);
    return merchant;
  }

  listMerchants(): PinnedMerchant[] {
    return this.store.load().merchants;
  }

  async sync(fromBlock?: number): Promise<void> {
    const data = this.store.load();
    const latest = await this.provider.getBlockNumber();
    const start = fromBlock ?? data.lastSyncBlock ?? 0;

    if (start > latest) {
      return;
    }

    if (start === 0) {
      data.commitments = [];
      data.lastSyncBlock = 0;
    }

    const depositEvents = await this.pool.queryFilter(this.pool.filters.Deposit(), start, latest);
    const changeEvents = await this.pool.queryFilter(this.pool.filters.Change(), start, latest);

    const allEvents = [...depositEvents, ...changeEvents].sort((a, b) => {
      const blockDiff = (a.blockNumber || 0) - (b.blockNumber || 0);
      if (blockDiff !== 0) return blockDiff;
      const aLogIndex = (a as any).logIndex || 0;
      const bLogIndex = (b as any).logIndex || 0;
      return aLogIndex - bLogIndex;
    });

    for (const ev of allEvents) {
      const commitment = (ev as any).args?.commitment as string | undefined;
      if (commitment && !data.commitments.includes(commitment)) {
        data.commitments.push(commitment);
      }
    }

    data.lastSyncBlock = latest + 1;
    this.store.save(data);
  }

  async getBalance(): Promise<bigint> {
    const data = this.store.load();
    let total = 0n;
    for (const note of data.notes) {
      if (note.chainId !== this.config.chainId || note.pool.toLowerCase() !== this.config.poolAddress.toLowerCase()) {
        continue;
      }
      const spent = await this.pool.nullifierSpent(note.nullifier);
      if (!spent && note.status === 'unspent') {
        total += note.denom;
      }
    }
    return total;
  }

  async depositPack(targetAmount: bigint): Promise<Note[]> {
    if (targetAmount <= 0n) {
      throw new Error('Amount must be positive');
    }

    const denoms = this.packDenoms(targetAmount);
    const total = denoms.reduce((a, b) => a + b, 0n);
    const approveTx = await this.usdc.approve(this.config.poolAddress, total);
    await approveTx.wait();

    const data = this.store.load();
    const notes: Note[] = [];

    for (const denom of denoms) {
      const secret = crypto.randomBytes(32).toString('hex');
      const commitment = this.poseidonCommitment(secret, denom);
      const tx = await this.pool.depositDenomination(denom, commitment);
      const receipt = await tx.wait();
      const event = receipt.logs
        .map((log: any) => this.pool.interface.parseLog(log))
        .find((parsed: any) => parsed?.name === 'Deposit');
      const index = event?.args?.index ? Number(event.args.index) : undefined;

      const note: Note = {
        denom,
        secret,
        commitment,
        nullifier: this.poseidonNullifier(secret),
        insertionIndex: index,
        status: 'unspent',
        chainId: this.config.chainId,
        pool: this.config.poolAddress
      };

      notes.push(note);
      data.notes.push(note);
      if (!data.commitments.includes(commitment)) {
        data.commitments.push(commitment);
      }
    }

    this.store.save(data);
    return notes;
  }

  async buy(url: string, options: RequestInit = {}): Promise<Response> {
    const res = await fetch(url, options);
    if (res.status !== 402) {
      return res;
    }

    const requirement = await this.parsePaymentRequirement(res, url, options.method || 'GET');
    const payResult = await this.payMerchant(requirement, url, options.method || 'GET');

    const retryHeaders = {
      ...(options.headers || {}),
      'x-payment-tx': payResult.txHash,
      'x-payment-intent': payResult.intentHash
    };

    return fetch(url, { ...options, headers: retryHeaders });
  }

  async payMerchant(requirement: PaymentRequirement, url: string, method: string): Promise<PayResult> {
    if (requirement.chainId !== this.config.chainId) {
      throw new Error('Payment requirement chainId mismatch');
    }
    await this.sync();
    const data = this.store.load();
    const onChainCount = Number(await this.pool.noteCount());
    if (onChainCount !== data.commitments.length) {
      await this.sync(0);
    }

    const price = requirement.price;
    const fee = (price * FEE_BPS) / 10000n;
    const total = price + fee;

    const { notes, changeDenom } = this.selectNotes(data.notes, total);
    const changeSecret = changeDenom > 0n ? crypto.randomBytes(32).toString('hex') : '0'.repeat(64);
    const nullifier1 = BigInt(this.poseidonNullifier(notes[0].secret));
    const nullifier2 = BigInt(this.poseidonNullifier(notes[1].secret));
    const changeCommitmentValue =
      changeDenom > 0n ? BigInt(this.poseidonCommitment(changeSecret, changeDenom)) : 0n;

    const commitments = data.commitments.map((c) => BigInt(c));
    this.merkle.build(commitments);
    const noteCount = commitments.length;

    for (const note of notes) {
      if (note.insertionIndex === undefined) {
        const idx = data.commitments.findIndex((c) => c.toLowerCase() === note.commitment.toLowerCase());
        if (idx >= 0) {
          note.insertionIndex = idx;
        }
      }
      if (note.insertionIndex === undefined) {
        throw new Error('Missing insertion index for note');
      }
    }

    const path1 = this.merkle.path(notes[0].insertionIndex ?? 0);
    const path2 = this.merkle.path(notes[1].insertionIndex ?? 0);

    const input = {
      secret1: BigInt('0x' + notes[0].secret).toString(),
      denom1: notes[0].denom.toString(),
      secret2: BigInt('0x' + notes[1].secret).toString(),
      denom2: notes[1].denom.toString(),
      pathElements1: path1.pathElements.map((v) => v.toString()),
      pathIndices1: path1.pathIndices.map((v) => v.toString()),
      pathElements2: path2.pathElements.map((v) => v.toString()),
      pathIndices2: path2.pathIndices.map((v) => v.toString()),
      changeSecret: BigInt('0x' + changeSecret).toString(),
      nullifier1: nullifier1.toString(),
      nullifier2: nullifier2.toString(),
      changeCommitment: changeCommitmentValue.toString(),
      merkleRoot: this.merkle.root().toString(),
      merchant: BigInt(requirement.merchantAddress).toString(),
      price: price.toString(),
      fee: fee.toString(),
      feeRecipient: BigInt(FEE_RECIPIENT).toString(),
      intentHash: BigInt(
        this.intentHash(url, method, requirement.merchantAddress, price, requirement.expiry)
      ).toString(),
      expiry: BigInt(requirement.expiry).toString(),
      noteCount: BigInt(noteCount).toString(),
      minConfirmations: BigInt((await this.pool.params())[1]).toString(),
      changeDenom: changeDenom.toString()
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      this.config.circuitWasmPath,
      this.config.zkeyPath
    );

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
      merkleRoot: this.toBytes32(inputSignals[0]),
      merchant: this.toAddress(inputSignals[1]),
      price: inputSignals[2],
      fee: inputSignals[3],
      feeRecipient: this.toAddress(inputSignals[4]),
      intentHash: this.toBytes32(inputSignals[5]),
      expiry: inputSignals[6],
      noteCount: inputSignals[7],
      minConfirmations: inputSignals[8],
      changeDenom: inputSignals[9],
      nullifier1: this.toBytes32(inputSignals[10]),
      nullifier2: this.toBytes32(inputSignals[11]),
      changeCommitment: this.toBytes32(inputSignals[12])
    };

    const inputArray = [
      inputs.merkleRoot,
      inputs.nullifier1,
      inputs.nullifier2,
      inputs.merchant,
      inputs.price,
      inputs.fee,
      inputs.feeRecipient,
      inputs.intentHash,
      inputs.expiry,
      inputs.noteCount,
      inputs.minConfirmations,
      inputs.changeDenom,
      inputs.changeCommitment
    ];

    const tx = await this.pool.payMerchant({ a, b, c }, inputArray);
    const receipt = await tx.wait();

    for (const note of notes) {
      note.status = 'spent';
    }
    if (changeDenom > 0n) {
      const changeCommitment = this.poseidonCommitment(changeSecret, changeDenom);
      const changeEvent = receipt.logs
        .map((log: any) => this.pool.interface.parseLog(log))
        .find((parsed: any) => parsed?.name === 'Change');
      const index = changeEvent?.args?.index ? Number(changeEvent.args.index) : undefined;
      data.notes.push({
        denom: changeDenom,
        secret: changeSecret,
        commitment: changeCommitment,
        nullifier: this.poseidonNullifier(changeSecret),
        insertionIndex: index,
        status: 'unspent',
        chainId: this.config.chainId,
        pool: this.config.poolAddress
      });
      data.commitments.push(changeCommitment);
    }

    this.store.save(data);

    return {
      txHash: receipt.hash,
      intentHash: this.intentHash(url, method, requirement.merchantAddress, price, requirement.expiry)
    };
  }

  private poseidonCommitment(secretHex: string, denom: bigint): string {
    const secret = BigInt('0x' + secretHex);
    const res = this.poseidon([secret, denom]);
    return this.toBytes32(this.poseidon.F.toObject(res).toString());
  }

  private poseidonNullifier(secretHex: string): string {
    const secret = BigInt('0x' + secretHex);
    const res = this.poseidon([secret, 1n]);
    return this.toBytes32(this.poseidon.F.toObject(res).toString());
  }

  private packDenoms(amount: bigint): bigint[] {
    let remaining = amount;
    const result: bigint[] = [];

    for (const denom of [...ALLOWED_DENOMS].sort((a, b) => Number(b - a))) {
      while (remaining >= denom) {
        result.push(denom);
        remaining -= denom;
      }
    }

    if (remaining !== 0n) {
      throw new Error('Amount cannot be decomposed into allowed denominations');
    }

    return result;
  }

  private selectNotes(notes: Note[], target: bigint): { notes: Note[]; changeDenom: bigint } {
    const candidates = notes.filter(
      (n) =>
        n.status === 'unspent' &&
        n.chainId === this.config.chainId &&
        n.pool.toLowerCase() === this.config.poolAddress.toLowerCase()
    );
    if (candidates.length < 2) {
      throw new Error('Need at least two notes');
    }

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const sum = candidates[i].denom + candidates[j].denom;
        for (const change of [0n, ...ALLOWED_DENOMS]) {
          if (sum === target + change) {
            return { notes: [candidates[i], candidates[j]], changeDenom: change };
          }
        }
      }
    }

    throw new Error('No valid two-note combination with allowed change');
  }

  private intentHash(
    url: string,
    method: string,
    merchantAddress: string,
    price: bigint,
    expiry: number
  ): string {
    const canonical = [
      this.config.chainId,
      this.config.poolAddress,
      merchantAddress,
      url,
      method.toUpperCase(),
      price.toString(),
      expiry.toString()
    ].join('|');
    return ethers.keccak256(ethers.toUtf8Bytes(canonical));
  }

  private toBytes32(value: string): string {
    return ethers.zeroPadValue(ethers.toBeHex(BigInt(value)), 32);
  }

  private toAddress(value: string): string {
    return ethers.getAddress(ethers.zeroPadValue(ethers.toBeHex(BigInt(value)), 20));
  }

  private async parsePaymentRequirement(
    res: Response,
    url: string,
    method: string
  ): Promise<PaymentRequirement> {
    const header = res.headers.get('x-payment-required');
    if (header) {
      const parsed = JSON.parse(header);
      return this.normalizeRequirement(parsed, url, method);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await res.json();
      return this.normalizeRequirement(body, url, method);
    }

    throw new Error('Unable to parse x402 payment requirement');
  }

  private normalizeRequirement(data: any, url: string, method: string): PaymentRequirement {
    if (!data) {
      throw new Error('Invalid payment requirement');
    }
    const merchantAddress = data.merchantAddress || data.merchant || data.to;
    const price = BigInt(data.price ?? data.amount);
    const expiry = Number(data.expiry || data.expiresAt || data.exp);
    const chainId = Number(data.chainId || this.config.chainId);

    if (!merchantAddress || !expiry) {
      throw new Error('Missing payment requirement fields');
    }

    return {
      merchantAddress,
      price,
      expiry,
      chainId,
      metadata: data
    };
  }
}
