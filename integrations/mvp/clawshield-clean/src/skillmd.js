import fs from 'fs';

export function lintSkillMd(file) {
  const content = fs.readFileSync(file, 'utf8');
  const findings = [];

  const required = ['## Summary', '## What I Built', '## How It Functions'];
  for (const r of required) {
    if (!content.includes(r)) {
      findings.push({
        rule: 'missing-section',
        severity: 1,
        message: `Missing required section: ${r}`
      });
    }
  }

  const suspicious = [
    { id: 'env-read', re: /(read|cat) .*\.env|~\/\.clawdbot|\.ssh|id_rsa/i, sev: 3, msg: 'Skill.md suggests reading secrets' },
    { id: 'post-exfil', re: /(curl|wget).*(http|https):\/\//i, sev: 2, msg: 'Skill.md includes external POST/GET with curl/wget' },
    { id: 'exec', re: /(sudo|chmod \+x|bash -c|sh -c)/i, sev: 2, msg: 'Skill.md includes privileged shell execution' }
  ];

  for (const s of suspicious) {
    if (s.re.test(content)) {
      findings.push({ rule: s.id, severity: s.sev, message: s.msg });
    }
  }

  const maxSeverity = findings.reduce((m, f) => Math.max(m, f.severity), 0);
  return { summary: { findings: findings.length, maxSeverity }, findings };
}
