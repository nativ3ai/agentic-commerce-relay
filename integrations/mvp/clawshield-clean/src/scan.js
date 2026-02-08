import fg from 'fast-glob';
import fs from 'fs';
import path from 'path';

const RULES = [
  {
    id: 'env-read',
    severity: 3,
    pattern: /(\.env|process\.env|~\/\.clawdbot|\.aws|\.ssh|id_rsa|id_ed25519)/i,
    message: 'Potential credential access detected'
  },
  {
    id: 'exfil',
    severity: 3,
    pattern: /(webhook\.site|pastebin|request\(|fetch\(|axios\.|curl\s|wget\s|http\.request|https\.request)/i,
    message: 'Potential data exfiltration via network calls'
  },
  {
    id: 'exec',
    severity: 2,
    pattern: /(child_process|exec\(|spawn\(|subprocess|os\.system|Runtime\.exec)/i,
    message: 'Process execution capability detected'
  },
  {
    id: 'eval',
    severity: 2,
    pattern: /(eval\(|Function\(|vm\.)/i,
    message: 'Dynamic code execution detected'
  },
  {
    id: 'obfuscation',
    severity: 1,
    pattern: /(atob\(|btoa\(|base64|Buffer\.from\(.+base64)/i,
    message: 'Obfuscation patterns detected'
  }
];

const TEXT_EXTS = ['.js', '.ts', '.py', '.sh', '.md', '.json', '.yaml', '.yml'];

export async function scanPath(target) {
  const cwd = path.resolve(process.cwd(), target);
  const entries = await fg(['**/*'], {
    cwd,
    dot: true,
    onlyFiles: true,
    ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**']
  });

  const findings = [];
  let filesScanned = 0;
  for (const rel of entries) {
    const file = path.join(cwd, rel);
    if (!TEXT_EXTS.includes(path.extname(file).toLowerCase())) continue;
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    filesScanned += 1;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const rule of RULES) {
        if (rule.pattern.test(line)) {
          findings.push({
            rule: rule.id,
            severity: rule.severity,
            file: path.relative(process.cwd(), file),
            line: i + 1,
            message: rule.message
          });
        }
      }
    }
  }

  const maxSeverity = findings.reduce((m, f) => Math.max(m, f.severity), 0);
  return {
    summary: {
      filesScanned,
      findings: findings.length,
      maxSeverity
    },
    findings
  };
}
