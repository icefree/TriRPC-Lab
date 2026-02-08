import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const rpcUrl = process.env.RPC_URL;
const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;

if (!rpcUrl || !privateKey) {
  throw new Error('Missing RPC_URL or PRIVATE_KEY in env');
}

const artifactPath = path.resolve('contracts/artifacts/Counter.json');
if (!fs.existsSync(artifactPath)) {
  throw new Error('Counter artifact missing. Run `pnpm compile:contract` first.');
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as {
  abi: unknown[];
  bytecode: `0x${string}`;
};

async function main() {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: foundry,
    transport: http(rpcUrl),
  });
  const publicClient = createPublicClient({
    chain: foundry,
    transport: http(rpcUrl),
  });

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    account,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error('Contract address missing from deploy receipt');
  }

  const deploymentPath = path.resolve('contracts/deployments/local.json');
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(
      {
        network: 'foundry',
        chainId: foundry.id,
        counterAddress: receipt.contractAddress,
        deployTxHash: hash,
      },
      null,
      2,
    ),
  );

  console.log(`Counter deployed at ${receipt.contractAddress}`);
  console.log(`Saved deployment -> ${deploymentPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
