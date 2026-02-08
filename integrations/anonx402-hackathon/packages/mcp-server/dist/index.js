"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = __importDefault(require("node:os"));
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const x402_privacy_adapter_1 = require("x402-privacy-adapter");
const baseDir = node_path_1.default.join(node_os_1.default.homedir(), '.x402-privacy');
const configPath = node_path_1.default.join(baseDir, 'config.json');
function loadConfig() {
    if (!node_fs_1.default.existsSync(configPath)) {
        throw new Error(`Missing config at ${configPath}`);
    }
    return JSON.parse(node_fs_1.default.readFileSync(configPath, 'utf8'));
}
async function initAdapter() {
    const config = loadConfig();
    const adapter = new x402_privacy_adapter_1.PrivacyAdapter(config);
    await adapter.init();
    return adapter;
}
const server = new index_js_1.Server({
    name: 'x402-privacy-mcp',
    version: '0.1.0'
}, {
    capabilities: {
        tools: {}
    }
});
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
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
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const adapter = await initAdapter();
    const { name, arguments: args } = request.params;
    if (name === 'merchants.add') {
        const merchant = await adapter.pinMerchant(String(args?.name), String(args?.url), String(args?.merchantAddress));
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
        const merchant = adapter.listMerchants().find((m) => m.id === id);
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
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
