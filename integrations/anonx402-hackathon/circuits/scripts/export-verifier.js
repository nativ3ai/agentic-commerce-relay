const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const buildDir = path.join(__dirname, '..', 'build');
const zkey = path.join(buildDir, 'spend_final.zkey');
const out = path.join(__dirname, '..', '..', 'contracts', 'verifier', 'Verifier.sol');

if (!fs.existsSync(zkey)) {
  throw new Error('Missing spend_final.zkey. Run npm run zk:setup first.');
}

execSync(`snarkjs zkey export solidityverifier ${zkey} ${out}`, { stdio: 'inherit' });
