import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';

const contractPath = path.resolve('contracts/Counter.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'Counter.sol': {
      content: source,
    },
  },
  settings: {
    optimizer: { enabled: false, runs: 200 },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object'],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors?.length) {
  const fatal = output.errors.filter((e: { severity: string }) => e.severity === 'error');
  for (const err of output.errors) {
    console.log(err.formattedMessage);
  }
  if (fatal.length > 0) {
    process.exit(1);
  }
}

const contract = output.contracts?.['Counter.sol']?.Counter;
if (!contract) {
  throw new Error('Counter contract output missing');
}

const artifactPath = path.resolve('contracts/artifacts/Counter.json');
fs.writeFileSync(
  artifactPath,
  JSON.stringify(
    {
      contractName: 'Counter',
      abi: contract.abi,
      bytecode: `0x${contract.evm.bytecode.object}`,
    },
    null,
    2,
  ),
);

console.log(`Compiled Counter -> ${artifactPath}`);
