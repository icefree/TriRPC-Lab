import fs from 'node:fs';
import path from 'node:path';
import { Contract, JsonRpcProvider, Wallet, parseEther } from 'ethers';
import type { InterfaceAbi } from 'ethers';
import type { ClientRunner, ScenarioContext, ScenarioResult } from '@compare/scenarios';

const artifactPath = path.resolve('contracts/artifacts/Counter.json');

function loadCounterArtifact() {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as {
    abi: InterfaceAbi;
  };
  return artifact;
}

async function runScenario(
  id: ScenarioResult['id'],
  task: () => Promise<Record<string, unknown>>,
): Promise<ScenarioResult> {
  const start = Date.now();
  try {
    const output = await task();
    return { id, success: true, durationMs: Date.now() - start, output };
  } catch (error) {
    return {
      id,
      success: false,
      durationMs: Date.now() - start,
      output: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const ethersRunner: ClientRunner = {
  clientName: 'ethers',
  async runAll(ctx: ScenarioContext): Promise<ScenarioResult[]> {
    const provider = new JsonRpcProvider(ctx.rpcUrl);
    const wallet = new Wallet(ctx.privateKey, provider);
    const artifact = loadCounterArtifact();
    const counter = new Contract(ctx.counterAddress, artifact.abi, wallet);

    const txHashes: { native?: `0x${string}`; contract?: `0x${string}` } = {};

    return [
      await runScenario('chain-info', async () => {
        const [network, blockNumber] = await Promise.all([provider.getNetwork(), provider.getBlockNumber()]);
        return { chainId: Number(network.chainId), blockNumber };
      }),
      await runScenario('account-state', async () => {
        const [balance, nonce] = await Promise.all([
          provider.getBalance(wallet.address),
          provider.getTransactionCount(wallet.address),
        ]);
        return { address: wallet.address, balanceWei: balance.toString(), nonce };
      }),
      await runScenario('contract-read', async () => {
        const count = await counter.getCount();
        return { count: count.toString() };
      }),
      await runScenario('tx-send-native', async () => {
        const tx = await wallet.sendTransaction({
          to: ctx.toAddress,
          value: parseEther('0.0001'),
        });
        const receipt = await tx.wait();
        txHashes.native = tx.hash as `0x${string}`;
        return {
          hash: tx.hash,
          status: receipt?.status ?? 0,
          blockNumber: receipt?.blockNumber ?? null,
        };
      }),
      await runScenario('tx-write-contract', async () => {
        const tx = await counter.increment();
        const receipt = await tx.wait();
        txHashes.contract = tx.hash as `0x${string}`;
        return {
          hash: tx.hash,
          status: receipt?.status ?? 0,
          blockNumber: receipt?.blockNumber ?? null,
        };
      }),
      await runScenario('tx-query-lifecycle', async () => {
        const targetHash = txHashes.contract ?? txHashes.native;
        if (!targetHash) {
          throw new Error('No transaction hash found from previous steps');
        }
        const [tx, receipt] = await Promise.all([
          provider.getTransaction(targetHash),
          provider.getTransactionReceipt(targetHash),
        ]);
        const currentBlock = await provider.getBlockNumber();
        const confirmations = tx?.blockNumber ? currentBlock - tx.blockNumber + 1 : 0;
        return {
          hash: targetHash,
          hasTransaction: Boolean(tx),
          hasReceipt: Boolean(receipt),
          status: receipt?.status ?? null,
          confirmations,
        };
      }),
    ];
  },
};
