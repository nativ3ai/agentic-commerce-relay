import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PrivacyAdapter } from '../src/adapter';
import { AdapterConfig } from '../src/types';

const program = new Command();
const baseDir = path.join(os.homedir(), '.x402-privacy');
const configPath = path.join(baseDir, 'config.json');

function loadConfig(): AdapterConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing config at ${configPath}`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as AdapterConfig;
}

async function initAdapter(): Promise<PrivacyAdapter> {
  const config = loadConfig();
  const adapter = new PrivacyAdapter(config);
  await adapter.init();
  return adapter;
}

program
  .command('init')
  .requiredOption('--rpc <url>')
  .requiredOption('--pk <privateKey>')
  .requiredOption('--chain <chainId>')
  .requiredOption('--pool <address>')
  .requiredOption('--usdc <address>')
  .requiredOption('--wasm <path>')
  .requiredOption('--zkey <path>')
  .option('--store <path>')
  .option('--passphrase <passphrase>')
  .action((opts) => {
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    const config: AdapterConfig = {
      rpcUrl: opts.rpc,
      privateKey: opts.pk,
      chainId: Number(opts.chain),
      poolAddress: opts.pool,
      usdcAddress: opts.usdc,
      circuitWasmPath: opts.wasm,
      zkeyPath: opts.zkey,
      storePath: opts.store,
      storePassphrase: opts.passphrase
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Saved config to ${configPath}`);
  });

program
  .command('pin')
  .requiredOption('--name <name>')
  .requiredOption('--url <url>')
  .requiredOption('--merchant <address>')
  .action(async (opts) => {
    const adapter = await initAdapter();
    const merchant = await adapter.pinMerchant(opts.name, opts.url, opts.merchant);
    console.log(JSON.stringify(merchant, null, 2));
  });

program
  .command('list')
  .action(async () => {
    const adapter = await initAdapter();
    console.log(JSON.stringify(adapter.listMerchants(), null, 2));
  });

program
  .command('balance')
  .action(async () => {
    const adapter = await initAdapter();
    const balance = await adapter.getBalance();
    console.log(balance.toString());
  });

program
  .command('deposit')
  .requiredOption('--amount <amount>')
  .action(async (opts) => {
    const adapter = await initAdapter();
    const notes = await adapter.depositPack(BigInt(opts.amount));
    console.log(
      JSON.stringify(
        notes,
        (_, v) => (typeof v === 'bigint' ? v.toString() : v),
        2
      )
    );
  });

program
  .command('buy')
  .requiredOption('--url <url>')
  .option('--method <method>', 'HTTP method', 'GET')
  .action(async (opts) => {
    const adapter = await initAdapter();
    const res = await adapter.buy(opts.url, { method: opts.method });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(text);
  });

program.parseAsync(process.argv);
