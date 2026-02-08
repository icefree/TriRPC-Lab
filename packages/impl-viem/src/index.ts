import fs from 'node:fs';
import path from 'node:path';
import {
  type Abi,
  createPublicClient,
  createWalletClient,
  formatEther,
  getContract,
  http,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import type { ClientRunner, ScenarioContext, ScenarioResult } from '@compare/scenarios';

const artifactPath = path.resolve('contracts/artifacts/Counter.json');

function loadCounterArtifact() {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as {
    abi: Abi;
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

export const viemRunner: ClientRunner = {
  clientName: 'viem',
  async runAll(ctx: ScenarioContext): Promise<ScenarioResult[]> {
    const account = privateKeyToAccount(ctx.privateKey);
    const publicClient = createPublicClient({ transport: http(ctx.rpcUrl), chain: foundry });
    const walletClient = createWalletClient({ transport: http(ctx.rpcUrl), account, chain: foundry });

    const artifact = loadCounterArtifact();
    const counter = getContract({
      address: ctx.counterAddress,
      abi: artifact.abi,
      client: { public: publicClient, wallet: walletClient },
    });

    const txHashes: { native?: `0x${string}`; contract?: `0x${string}` } = {};

    return [
      await runScenario('chain-info', async () => {
        const [chainId, blockNumber] = await Promise.all([
          publicClient.getChainId(),
          publicClient.getBlockNumber(),
        ]);
        return { chainId, blockNumber: Number(blockNumber) };
      }),
      await runScenario('account-state', async () => {
        const [balance, nonce] = await Promise.all([
          publicClient.getBalance({ address: account.address }),
          publicClient.getTransactionCount({ address: account.address }),
        ]);
        return {
          address: account.address,
          balanceWei: balance.toString(),
          balanceEth: formatEther(balance),
          nonce,
        };
      }),
      await runScenario('contract-read', async () => {
        const count = (await counter.read.getCount()) as bigint;
        return { count: count.toString() };
      }),
      await runScenario('tx-send-native', async () => {
        const hash = await walletClient.sendTransaction({
          account,
          to: ctx.toAddress,
          value: parseEther('0.0001'),
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        txHashes.native = hash;
        return {
          hash,
          status: receipt.status,
          blockNumber: Number(receipt.blockNumber),
        };
      }),
      await runScenario('tx-write-contract', async () => {
        const hash = await counter.write.increment();
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        txHashes.contract = hash;
        return {
          hash,
          status: receipt.status,
          blockNumber: Number(receipt.blockNumber),
        };
      }),
      await runScenario('tx-query-lifecycle', async () => {
        const targetHash = txHashes.contract ?? txHashes.native;
        if (!targetHash) {
          throw new Error('No transaction hash found from previous steps');
        }
        const [tx, receipt, currentBlock] = await Promise.all([
          publicClient.getTransaction({ hash: targetHash }),
          publicClient.getTransactionReceipt({ hash: targetHash }),
          publicClient.getBlockNumber(),
        ]);
        const confirmations = Number(currentBlock - tx.blockNumber + 1n);
        return {
          hash: targetHash,
          status: receipt.status,
          confirmations,
          blockNumber: Number(tx.blockNumber),
          to: tx.to,
        };
      }),
    ];
  },
};
