const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const circuitsDir = path.join(__dirname, '..');
const buildDir = path.join(circuitsDir, 'build');

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

const circuitPath = path.join(circuitsDir, 'spend.circom');

const includeDir = path.join(__dirname, '..', '..', 'node_modules', 'circomlib', 'circuits');

execSync(
  `circom ${circuitPath} --r1cs --wasm --sym -o ${buildDir} -l ${includeDir}`,
  { stdio: 'inherit' }
);
