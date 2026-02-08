const fs = require('fs');
const path = require('path');
const solc = require('solc');

const contractsDir = path.join(__dirname, '..', 'contracts');
const artifactsDir = path.join(__dirname, '..', 'artifacts', 'contracts');

function getSolFiles(dir, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getSolFiles(full, baseDir));
    } else if (entry.isFile() && entry.name.endsWith('.sol')) {
      files.push({ full, rel: path.relative(baseDir, full) });
    }
  }
  return files;
}

function findImports(importPath) {
  const localPath = path.join(contractsDir, importPath);
  if (fs.existsSync(localPath)) {
    return { contents: fs.readFileSync(localPath, 'utf8') };
  }

  const nodePath = path.join(__dirname, '..', 'node_modules', importPath);
  if (fs.existsSync(nodePath)) {
    return { contents: fs.readFileSync(nodePath, 'utf8') };
  }

  const nodeContractsPath = path.join(__dirname, '..', 'node_modules', importPath.replace('contracts/', ''));
  if (fs.existsSync(nodeContractsPath)) {
    return { contents: fs.readFileSync(nodeContractsPath, 'utf8') };
  }

  return { error: `File not found: ${importPath}` };
}

const sources = {};
for (const file of getSolFiles(contractsDir)) {
  sources[`contracts/${file.rel}`] = { content: fs.readFileSync(file.full, 'utf8') };
}

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'evm.bytecode.linkReferences', 'evm.deployedBytecode.linkReferences']
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

if (output.errors) {
  const errors = output.errors.filter((e) => e.severity === 'error');
  for (const err of output.errors) {
    console.error(err.formattedMessage);
  }
  if (errors.length) {
    process.exit(1);
  }
}

for (const [sourceName, contracts] of Object.entries(output.contracts || {})) {
  for (const [contractName, artifact] of Object.entries(contracts)) {
    const outDir = path.join(artifactsDir, sourceName);
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `${contractName}.json`);

    const data = {
      contractName,
      sourceName,
      abi: artifact.abi,
      bytecode: `0x${artifact.evm.bytecode.object}`,
      deployedBytecode: `0x${artifact.evm.deployedBytecode.object}`,
      linkReferences: artifact.evm.bytecode.linkReferences || {},
      deployedLinkReferences: artifact.evm.deployedBytecode.linkReferences || {}
    };

    fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  }
}

console.log('Solc artifacts written to artifacts/');
