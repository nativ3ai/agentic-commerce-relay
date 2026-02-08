import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { PrivacyAdapter, AdapterConfig, PinnedMerchant } from 'x402-privacy-adapter';

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

const server = new Server(
  {
    name: 'x402-privacy-mcp',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'merchants.add',
        description: 'Pin a merchant for later use',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            url: { type: 'string' },
            merchantAddress: { type: 'string' }
          },
          required: ['name', 'url', 'merchantAddress']
        }
      },
      {
        name: 'merchants.list',
        description: 'List pinned merchants',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'balance.get',
        description: 'Get local spendable balance',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'deposit.pack',
        description: 'Deposit a pack of fixed-denom notes',
        inputSchema: {
          type: 'object',
          properties: { amount: { type: 'string' } },
          required: ['amount']
        }
      },
      {
        name: 'pay.url',
        description: 'Pay a merchant by URL using x402 flow',
        inputSchema: {
          type: 'object',
          properties: { url: { type: 'string' }, method: { type: 'string' } },
          required: ['url']
        }
      },
      {
        name: 'pay.pinned',
        description: 'Pay a pinned merchant by id',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const adapter = await initAdapter();
  const { name, arguments: args } = request.params;

  if (name === 'merchants.add') {
    const merchant = await adapter.pinMerchant(
      String(args?.name),
      String(args?.url),
      String(args?.merchantAddress)
    );
    return { content: [{ type: 'text', text: JSON.stringify(merchant, null, 2) }] };
  }

  if (name === 'merchants.list') {
    const list = adapter.listMerchants();
    return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
  }

  if (name === 'balance.get') {
    const balance = await adapter.getBalance();
    return { content: [{ type: 'text', text: balance.toString() }] };
  }

  if (name === 'deposit.pack') {
    const notes = await adapter.depositPack(BigInt(String(args?.amount)));
    return { content: [{ type: 'text', text: JSON.stringify(notes, null, 2) }] };
  }

  if (name === 'pay.url') {
    const url = String(args?.url);
    const method = String(args?.method || 'GET');
    const res = await adapter.buy(url, { method });
    const text = await res.text();
    return {
      content: [{ type: 'text', text: JSON.stringify({ status: res.status, body: text }) }]
    };
  }

  if (name === 'pay.pinned') {
    const id = String(args?.id);
    const merchant = adapter.listMerchants().find((m: PinnedMerchant) => m.id === id);
    if (!merchant) {
      throw new Error('Unknown merchant id');
    }
    const res = await adapter.buy(merchant.url, { method: 'GET' });
    const text = await res.text();
    return {
      content: [{ type: 'text', text: JSON.stringify({ status: res.status, body: text }) }]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
