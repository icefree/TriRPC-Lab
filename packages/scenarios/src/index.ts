export type ScenarioId =
  | 'chain-info'
  | 'account-state'
  | 'contract-read'
  | 'tx-send-native'
  | 'tx-write-contract'
  | 'tx-query-lifecycle';

export interface ScenarioContext {
  rpcUrl: string;
  privateKey: `0x${string}`;
  toAddress: `0x${string}`;
  counterAddress: `0x${string}`;
}

export interface ScenarioResult {
  id: ScenarioId;
  success: boolean;
  durationMs: number;
  output: Record<string, unknown>;
  error?: string;
}

export interface ClientRunner {
  clientName: 'ethers' | 'viem';
  runAll: (ctx: ScenarioContext) => Promise<ScenarioResult[]>;
}
