#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { scanPath } from '../src/scan.js';
import { lintSkillMd } from '../src/skillmd.js';
import { initManifest } from '../src/manifest.js';
import { runWithGuard } from '../src/run.js';

const program = new Command();

program
  .name('clawshield')
  .description('Security guardrails for OpenClaw skills')
  .version('0.1.0');

program
  .command('scan')
  .argument('<target>', 'path to skill or repo')
  .option('--format <format>', 'json or text', 'text')
  .option('--out <file>', 'write json report to file')
  .action(async (target, opts) => {
    const report = await scanPath(target);
    if (opts.out) {
      fs.writeFileSync(opts.out, JSON.stringify(report, null, 2));
    }
    if (opts.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.summary.maxSeverity >= 2 ? 2 : 0);
    }
    console.log(renderTextReport(report));
    process.exit(report.summary.maxSeverity >= 2 ? 2 : 0);
  });

program
  .command('lint-skillmd')
  .argument('<file>', 'path to skill.md')
  .option('--format <format>', 'json or text', 'text')
  .action((file, opts) => {
    const report = lintSkillMd(file);
    if (opts.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.summary.maxSeverity >= 2 ? 2 : 0);
    }
    console.log(renderSkillMdReport(report));
    process.exit(report.summary.maxSeverity >= 2 ? 2 : 0);
  });

program
  .command('init')
  .option('--out <file>', 'manifest file path', 'permissions.json')
  .action((opts) => {
    const created = initManifest(opts.out);
    console.log(created ? chalk.green(`Created ${opts.out}`) : chalk.yellow(`${opts.out} already exists`));
  });

program
  .command('run')
  .argument('<command...>', 'command to run (Node/OpenClaw)')
  .option('--manifest <file>', 'permissions manifest', 'permissions.json')
  .option('--receipt <file>', 'receipt output', 'clawshield-receipt.json')
  .action(async (command, opts) => {
    const exitCode = await runWithGuard(command, opts.manifest, opts.receipt);
    process.exit(exitCode);
  });

program.parse(process.argv);

function renderTextReport(report) {
  const lines = [];
  lines.push(chalk.bold('ClawShield Scan Report'));
  lines.push(`Files scanned: ${report.summary.filesScanned}`);
  lines.push(`Findings: ${report.summary.findings}`);
  lines.push(`Max severity: ${severityLabel(report.summary.maxSeverity)}`);
  lines.push('');
  for (const f of report.findings) {
    lines.push(`${severityLabel(f.severity)} ${f.rule} @ ${f.file}:${f.line}`);
    lines.push(`  ${f.message}`);
  }
  return lines.join('\n');
}

function renderSkillMdReport(report) {
  const lines = [];
  lines.push(chalk.bold('ClawShield skill.md Lint'));
  lines.push(`Findings: ${report.summary.findings}`);
  lines.push(`Max severity: ${severityLabel(report.summary.maxSeverity)}`);
  lines.push('');
  for (const f of report.findings) {
    lines.push(`${severityLabel(f.severity)} ${f.rule}`);
    lines.push(`  ${f.message}`);
  }
  return lines.join('\n');
}

function severityLabel(sev) {
  if (sev >= 3) return chalk.red('HIGH');
  if (sev === 2) return chalk.yellow('MED');
  if (sev === 1) return chalk.blue('LOW');
  return chalk.green('OK');
}
