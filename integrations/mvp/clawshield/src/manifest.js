import fs from 'fs';

const DEFAULT_MANIFEST = {
  version: 1,
  permissions: {
    fs: {
      read: ["./"],
      write: []
    },
    env: {
      allow: []
    },
    network: {
      outbound: []
    },
    exec: false
  }
};

export function initManifest(outFile) {
  if (fs.existsSync(outFile)) return false;
  fs.writeFileSync(outFile, JSON.stringify(DEFAULT_MANIFEST, null, 2));
  return true;
}

export function loadManifest(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return data;
}
