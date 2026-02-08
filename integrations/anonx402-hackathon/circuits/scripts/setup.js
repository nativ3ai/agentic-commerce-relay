const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const buildDir = path.join(__dirname, '..', 'build');
const r1cs = path.join(buildDir, 'spend.r1cs');
const ptau = path.join(buildDir, 'pot16_final.ptau');
const zkey = path.join(buildDir, 'spend_final.zkey');
const zkeyTmp = path.join(buildDir, 'spend_final_tmp.zkey');

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

if (!fs.existsSync(ptau)) {
  const ptau0 = path.join(buildDir, 'pot16_0000.ptau');
  const ptau1 = path.join(buildDir, 'pot16_0001.ptau');
  execSync(`snarkjs powersoftau new bn128 16 ${ptau0} -v`, { stdio: 'inherit' });
  execSync(
    `snarkjs powersoftau contribute ${ptau0} ${ptau1} --name="First" -v -e="random"`,
    { stdio: 'inherit' }
  );
  execSync(`snarkjs powersoftau prepare phase2 ${ptau1} ${ptau} -v`, {
    stdio: 'inherit'
  });
}

execSync(`snarkjs groth16 setup ${r1cs} ${ptau} ${zkeyTmp}`, { stdio: 'inherit' });
execSync(
  `snarkjs zkey contribute ${zkeyTmp} ${zkey} --name="Contributor" -v -e="random"`,
  { stdio: 'inherit' }
);
execSync(`snarkjs zkey export verificationkey ${zkey} ${path.join(buildDir, 'verification_key.json')}`,
  { stdio: 'inherit' }
);
