import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import type { ScenarioContext, ScenarioResult } from '@compare/scenarios';
import { ethersRunner } from '@compare/impl-ethers';
import { viemRunner } from '@compare/impl-viem';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

function loadContext(): ScenarioContext {
  const deploymentPath = path.resolve('contracts/deployments/local.json');
  if (!fs.existsSync(deploymentPath)) {
    throw new Error('Missing contracts/deployments/local.json. Run `pnpm deploy:contract` first.');
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8')) as {
    counterAddress: `0x${string}`;
  };

  return {
    rpcUrl: requireEnv('RPC_URL'),
    privateKey: requireEnv('PRIVATE_KEY') as `0x${string}`,
    toAddress: requireEnv('TO_ADDRESS') as `0x${string}`,
    counterAddress: deployment.counterAddress,
  };
}

function summarize(results: ScenarioResult[]) {
  const passed = results.filter((r) => r.success).length;
  const failed = results.length - passed;
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);
  return { passed, failed, totalMs };
}

function renderClientSection(name: string, results: ScenarioResult[]): string {
  const rows = results
    .map((r) => {
      const status = r.success ? 'PASS' : 'FAIL';
      const details = r.success ? JSON.stringify(r.output) : r.error;
      return `| ${r.id} | ${status} | ${r.durationMs} | ${details ?? ''} |`;
    })
    .join('\n');

  const summary = summarize(results);
  return [
    `## ${name}`,
    '',
    `- passed: ${summary.passed}`,
    `- failed: ${summary.failed}`,
    `- total duration: ${summary.totalMs}ms`,
    '',
    '| scenario | status | duration(ms) | output |',
    '|---|---:|---:|---|',
    rows,
    '',
  ].join('\n');
}

function renderComparison(ethersResults: ScenarioResult[], viemResults: ScenarioResult[]): string {
  const ids = ethersResults.map((r) => r.id);
  const rows = ids
    .map((id) => {
      const e = ethersResults.find((r) => r.id === id);
      const v = viemResults.find((r) => r.id === id);
      const eMs = e?.durationMs ?? 0;
      const vMs = v?.durationMs ?? 0;
      const winner = eMs === vMs ? 'tie' : eMs < vMs ? 'ethers' : 'viem';
      return `| ${id} | ${eMs} | ${vMs} | ${winner} |`;
    })
    .join('\n');

  return [
    '## Speed Comparison',
    '',
    '| scenario | ethers(ms) | viem(ms) | faster |',
    '|---|---:|---:|---|',
    rows,
    '',
  ].join('\n');
}

async function main() {
  const context = loadContext();

  const ethersResults = await ethersRunner.runAll(context);
  const viemResults = await viemRunner.runAll(context);

  const report = [
    '# API Comparison Report (MVP)',
    '',
    `Generated at: ${new Date().toISOString()}`,
    '',
    renderClientSection('ethers.js', ethersResults),
    renderClientSection('viem', viemResults),
    renderComparison(ethersResults, viemResults),
  ].join('\n');

  const reportPath = path.resolve('reports/compare.md');
  fs.writeFileSync(reportPath, report);

  console.log(`Report generated -> ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
