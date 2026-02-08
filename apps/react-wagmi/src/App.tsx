import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { BrowserProvider, Contract, parseEther as parseEtherEthers } from 'ethers'
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  isAddress,
  isHash,
  parseEther,
} from 'viem'
import {
  useAccount,
  useBalance,
  useBlockNumber,
  useChainId,
  useConnect,
  useDisconnect,
  useReadContract,
  useSendTransaction,
  useTransaction,
  useTransactionReceipt,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import './App.css'

type Hex = `0x${string}`
type Lang = 'en' | 'zh'
type Page = 'dashboard' | 'reference'

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
}

type ActionCode = {
  connect: string
  chainInfo: string
  queryBalance: string
  sendNative: string
  queryTx: string
  readContract: string
  writeContract: string
}

type RpcMethod = {
  method: string
  descEn: string
  descZh: string
  noteEn?: string
  noteZh?: string
}

type RpcCategory = {
  titleEn: string
  titleZh: string
  methods: RpcMethod[]
}

const CODES: Record<'ethers' | 'viem' | 'wagmi', ActionCode> = {
  ethers: {
    connect: `const provider = new BrowserProvider(window.ethereum)\nawait provider.send('eth_requestAccounts', [])\nconst signer = await provider.getSigner()\nconst address = await signer.getAddress()`,
    chainInfo: `const [network, block] = await Promise.all([\n  provider.getNetwork(),\n  provider.getBlockNumber(),\n])`,
    queryBalance: `const balance = await provider.getBalance(address)\nconsole.log(balance.toString())`,
    sendNative: `const tx = await signer.sendTransaction({\n  to,\n  value: parseEther(value),\n})\nconsole.log(tx.hash)`,
    queryTx: `const [tx, receipt] = await Promise.all([\n  provider.getTransaction(hash),\n  provider.getTransactionReceipt(hash),\n])`,
    readContract: `const contract = new Contract(counterAddress, COUNTER_ABI, provider)\nconst count = await contract.getCount()`,
    writeContract: `const contract = new Contract(counterAddress, COUNTER_ABI, signer)\nconst tx = await contract.increment()\nawait tx.wait()`,
  },
  viem: {
    connect: `const walletClient = createWalletClient({ transport: custom(window.ethereum) })\nconst [address] = await walletClient.requestAddresses()`,
    chainInfo: `const publicClient = createPublicClient({ transport: custom(window.ethereum) })\nconst [chainId, block] = await Promise.all([\n  publicClient.getChainId(),\n  publicClient.getBlockNumber(),\n])`,
    queryBalance: `const balance = await publicClient.getBalance({ address })\nconsole.log(formatEther(balance))`,
    sendNative: `const hash = await walletClient.sendTransaction({\n  account: address,\n  to,\n  value: parseEther(value),\n})`,
    queryTx: `const [tx, receipt] = await Promise.all([\n  publicClient.getTransaction({ hash }),\n  publicClient.getTransactionReceipt({ hash }),\n])`,
    readContract: `const count = await publicClient.readContract({\n  address: counterAddress,\n  abi: COUNTER_ABI,\n  functionName: 'getCount',\n})`,
    writeContract: `const hash = await walletClient.writeContract({\n  account: address,\n  address: counterAddress,\n  abi: COUNTER_ABI,\n  functionName: 'increment',\n})`,
  },
  wagmi: {
    connect: `const { connect, connectors } = useConnect()\nconnect({ connector: connectors[0] })`,
    chainInfo: `const chainId = useChainId()\nconst { data: blockNumber } = useBlockNumber({ chainId, watch: true })`,
    queryBalance: `const { data: balance } = useBalance({\n  address,\n  query: { enabled: !!address },\n})`,
    sendNative: `const { sendTransaction } = useSendTransaction()\nsendTransaction({ to, value: parseEther(value) })`,
    queryTx: `const tx = useTransaction({ hash })\nconst receipt = useTransactionReceipt({ hash })`,
    readContract: `const { data, refetch } = useReadContract({\n  address: counterAddress,\n  abi: COUNTER_ABI,\n  functionName: 'getCount',\n})`,
    writeContract: `const { writeContract } = useWriteContract()\nwriteContract({\n  address: counterAddress,\n  abi: COUNTER_ABI,\n  functionName: 'increment',\n})`,
  },
}

const COUNTER_ABI = [
  {
    type: 'function',
    name: 'getCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'increment',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

const RPC_REFERENCE: RpcCategory[] = [
  {
    titleEn: 'Core Node Read APIs',
    titleZh: '核心节点读取 API',
    methods: [
      { method: 'eth_chainId', descEn: 'Current chain ID', descZh: '当前链 ID' },
      { method: 'eth_blockNumber', descEn: 'Latest block number', descZh: '最新区块高度' },
      { method: 'eth_getBalance', descEn: 'Native balance by address', descZh: '按地址查原生币余额' },
      { method: 'eth_getTransactionCount', descEn: 'Nonce by address', descZh: '按地址查 nonce' },
      { method: 'eth_getCode', descEn: 'Contract code at address', descZh: '查询地址上的合约代码' },
      { method: 'eth_getStorageAt', descEn: 'Storage slot value', descZh: '读取存储槽位' },
      { method: 'eth_getBlockByNumber', descEn: 'Block detail by number', descZh: '按块高查询区块详情' },
      { method: 'eth_getBlockByHash', descEn: 'Block detail by hash', descZh: '按 hash 查询区块详情' },
      { method: 'eth_getBlockTransactionCountByNumber', descEn: 'Tx count in block', descZh: '按块高查交易数' },
      { method: 'eth_getUncleCountByBlockNumber', descEn: 'Uncle count', descZh: '查询叔块数量' },
      { method: 'net_version', descEn: 'Network ID', descZh: '网络 ID' },
      { method: 'web3_clientVersion', descEn: 'Node client version', descZh: '客户端版本信息' },
    ],
  },
  {
    titleEn: 'Transaction & Receipt Query',
    titleZh: '交易与回执查询',
    methods: [
      { method: 'eth_getTransactionByHash', descEn: 'Transaction by hash', descZh: '按 hash 查交易' },
      {
        method: 'eth_getTransactionByBlockNumberAndIndex',
        descEn: 'Transaction by block/index',
        descZh: '按块高和索引查交易',
      },
      {
        method: 'eth_getTransactionByBlockHashAndIndex',
        descEn: 'Transaction by block hash/index',
        descZh: '按块 hash 和索引查交易',
      },
      { method: 'eth_getTransactionReceipt', descEn: 'Receipt by hash', descZh: '按 hash 查回执' },
      { method: 'eth_getLogs', descEn: 'Filter logs/events', descZh: '按条件查询日志事件' },
      { method: 'eth_newFilter', descEn: 'Create log filter', descZh: '创建日志过滤器' },
      { method: 'eth_getFilterChanges', descEn: 'Poll filter updates', descZh: '轮询过滤器变化' },
      { method: 'eth_uninstallFilter', descEn: 'Remove filter', descZh: '卸载过滤器' },
    ],
  },
  {
    titleEn: 'Contract Call & Gas',
    titleZh: '合约调用与 Gas',
    methods: [
      { method: 'eth_call', descEn: 'Read-only contract call', descZh: '只读合约调用' },
      { method: 'eth_estimateGas', descEn: 'Estimate gas usage', descZh: '估算 Gas 使用量' },
      { method: 'eth_gasPrice', descEn: 'Legacy gas price', descZh: '传统 gasPrice' },
      { method: 'eth_feeHistory', descEn: 'EIP-1559 fee history', descZh: 'EIP-1559 费率历史' },
      { method: 'eth_maxPriorityFeePerGas', descEn: 'Suggested priority fee', descZh: '建议小费' },
    ],
  },
  {
    titleEn: 'Send Transaction & Signing',
    titleZh: '发送交易与签名',
    methods: [
      { method: 'eth_sendTransaction', descEn: 'Wallet signs and sends', descZh: '钱包代签并发送' },
      { method: 'eth_sendRawTransaction', descEn: 'Broadcast signed raw tx', descZh: '广播已签名交易' },
      { method: 'eth_signTransaction', descEn: 'Sign tx without sending', descZh: '只签名交易不发送' },
      { method: 'eth_sign', descEn: 'Sign bytes (legacy)', descZh: '签名字节（较老）' },
      { method: 'personal_sign', descEn: 'Personal message signing', descZh: '个人消息签名' },
      { method: 'personal_ecRecover', descEn: 'Recover signer from signature', descZh: '从签名恢复地址' },
      { method: 'eth_signTypedData', descEn: 'Typed data sign (legacy)', descZh: '结构化签名（旧）' },
      { method: 'eth_signTypedData_v3', descEn: 'Typed data sign v3', descZh: '结构化签名 v3' },
      { method: 'eth_signTypedData_v4', descEn: 'Typed data sign v4 (EIP-712)', descZh: '结构化签名 v4（EIP-712）' },
    ],
  },
  {
    titleEn: 'Wallet / Provider Extensions',
    titleZh: '钱包 / Provider 扩展',
    methods: [
      { method: 'eth_requestAccounts', descEn: 'Request account access', descZh: '请求账户授权' },
      { method: 'eth_accounts', descEn: 'List exposed accounts', descZh: '返回已授权账户' },
      { method: 'wallet_switchEthereumChain', descEn: 'Switch chain in wallet', descZh: '钱包切换网络' },
      { method: 'wallet_addEthereumChain', descEn: 'Add a custom chain', descZh: '钱包添加网络' },
      { method: 'wallet_watchAsset', descEn: 'Prompt token watch', descZh: '添加代币观察' },
      { method: 'wallet_getPermissions', descEn: 'Current wallet permissions', descZh: '查询钱包权限' },
      { method: 'wallet_requestPermissions', descEn: 'Request wallet permissions', descZh: '申请钱包权限' },
      { method: 'wallet_revokePermissions', descEn: 'Revoke permissions', descZh: '撤销钱包权限' },
      { method: 'wallet_getCapabilities', descEn: 'Wallet capability introspection', descZh: '查询钱包能力' },
      { method: 'wallet_sendCalls', descEn: 'Batch calls (wallet-specific)', descZh: '钱包批量调用（扩展）' },
      { method: 'wallet_getCallsStatus', descEn: 'Query batch call status', descZh: '查询批量调用状态' },
    ],
  },
  {
    titleEn: 'WebSocket / Subscription',
    titleZh: 'WebSocket 订阅',
    methods: [
      { method: 'eth_subscribe', descEn: 'Subscribe to new heads/logs/pending tx', descZh: '订阅新区块/日志/pending 交易' },
      { method: 'eth_unsubscribe', descEn: 'Cancel subscription', descZh: '取消订阅' },
      { method: 'newHeads', descEn: 'New block header stream', descZh: '新区块头订阅类型', noteEn: 'Subscription type', noteZh: '订阅类型' },
      { method: 'logs', descEn: 'Filtered logs stream', descZh: '过滤日志订阅类型', noteEn: 'Subscription type', noteZh: '订阅类型' },
      { method: 'newPendingTransactions', descEn: 'Pending tx stream', descZh: '待打包交易订阅类型', noteEn: 'Subscription type', noteZh: '订阅类型' },
    ],
  },
  {
    titleEn: 'Debug / Trace / TxPool (Client-specific)',
    titleZh: '调试 / 追踪 / TxPool（客户端扩展）',
    methods: [
      { method: 'debug_traceTransaction', descEn: 'Execution trace for tx', descZh: '交易执行追踪' },
      { method: 'debug_traceBlockByNumber', descEn: 'Trace all tx in block', descZh: '追踪整块交易' },
      { method: 'trace_transaction', descEn: 'Parity-style tx trace', descZh: 'Parity 风格交易追踪' },
      { method: 'trace_block', descEn: 'Trace block', descZh: '区块追踪' },
      { method: 'trace_call', descEn: 'Trace simulated call', descZh: '追踪模拟调用' },
      { method: 'txpool_status', descEn: 'TxPool pending/queued count', descZh: '交易池状态' },
      { method: 'txpool_content', descEn: 'TxPool detailed content', descZh: '交易池详情' },
      { method: 'txpool_inspect', descEn: 'TxPool compact view', descZh: '交易池简表' },
    ],
  },
]

function tr(lang: Lang, en: string, zh: string) {
  return lang === 'en' ? en : zh
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider
  }
}

function getInjectedProvider() {
  return window.ethereum
}

function CodeFold({ lang, title, code }: { lang: Lang; title: string; code: string }) {
  return (
    <details className="code-fold">
      <summary>{title}</summary>
      <pre>
        <code>{code}</code>
      </pre>
      <p className="code-note">{tr(lang, 'Code snippet for this action', '该动作代码片段')}</p>
    </details>
  )
}

function ActionBlock({
  children,
  code,
  lang,
}: {
  children: ReactNode
  code: string
  lang: Lang
}) {
  return (
    <div className="row">
      {children}
      <CodeFold lang={lang} title={tr(lang, 'View Code', '查看代码')} code={code} />
    </div>
  )
}

function methodLibraryMapping(method: string): { ethers: string; viem: string; wagmi: string } {
  const map: Record<string, { ethers: string; viem: string; wagmi: string }> = {
    eth_chainId: {
      ethers: 'provider.getNetwork().chainId',
      viem: 'publicClient.getChainId()',
      wagmi: 'useChainId()',
    },
    eth_blockNumber: {
      ethers: 'provider.getBlockNumber()',
      viem: 'publicClient.getBlockNumber()',
      wagmi: 'useBlockNumber()',
    },
    eth_getBalance: {
      ethers: 'provider.getBalance(address)',
      viem: 'publicClient.getBalance({ address })',
      wagmi: 'useBalance({ address })',
    },
    eth_getTransactionCount: {
      ethers: 'provider.getTransactionCount(address)',
      viem: 'publicClient.getTransactionCount({ address })',
      wagmi: 'useTransactionCount({ address })',
    },
    eth_getCode: {
      ethers: 'provider.getCode(address)',
      viem: 'publicClient.getCode({ address })',
      wagmi: 'useBytecode({ address })',
    },
    eth_getStorageAt: {
      ethers: 'provider.getStorage(address, slot)',
      viem: 'publicClient.getStorageAt({ address, slot })',
      wagmi: 'useStorageAt({ address, slot })',
    },
    eth_getBlockByNumber: {
      ethers: 'provider.getBlock(blockNumber)',
      viem: "publicClient.getBlock({ blockNumber })",
      wagmi: 'useBlock({ blockNumber })',
    },
    eth_getBlockByHash: {
      ethers: 'provider.getBlock(blockHash)',
      viem: "publicClient.getBlock({ blockHash })",
      wagmi: 'useBlock({ blockHash })',
    },
    eth_getBlockTransactionCountByNumber: {
      ethers: "provider.send('eth_getBlockTransactionCountByNumber', ...)",
      viem: "publicClient.request({ method: 'eth_getBlockTransactionCountByNumber' })",
      wagmi: 'getPublicClient().request(...)',
    },
    eth_getUncleCountByBlockNumber: {
      ethers: "provider.send('eth_getUncleCountByBlockNumber', ...)",
      viem: "publicClient.request({ method: 'eth_getUncleCountByBlockNumber' })",
      wagmi: 'getPublicClient().request(...)',
    },
    net_version: {
      ethers: "provider.send('net_version', [])",
      viem: "publicClient.request({ method: 'net_version' })",
      wagmi: 'getPublicClient().request(...)',
    },
    web3_clientVersion: {
      ethers: "provider.send('web3_clientVersion', [])",
      viem: "publicClient.request({ method: 'web3_clientVersion' })",
      wagmi: 'getPublicClient().request(...)',
    },
    eth_getTransactionByHash: {
      ethers: 'provider.getTransaction(hash)',
      viem: 'publicClient.getTransaction({ hash })',
      wagmi: 'useTransaction({ hash })',
    },
    eth_getTransactionByBlockNumberAndIndex: {
      ethers: "provider.send('eth_getTransactionByBlockNumberAndIndex', ...)",
      viem: "publicClient.request({ method: 'eth_getTransactionByBlockNumberAndIndex' })",
      wagmi: 'getPublicClient().request(...)',
    },
    eth_getTransactionByBlockHashAndIndex: {
      ethers: "provider.send('eth_getTransactionByBlockHashAndIndex', ...)",
      viem: "publicClient.request({ method: 'eth_getTransactionByBlockHashAndIndex' })",
      wagmi: 'getPublicClient().request(...)',
    },
    eth_getTransactionReceipt: {
      ethers: 'provider.getTransactionReceipt(hash)',
      viem: 'publicClient.getTransactionReceipt({ hash })',
      wagmi: 'useTransactionReceipt({ hash })',
    },
    eth_getLogs: {
      ethers: 'provider.getLogs(filter)',
      viem: 'publicClient.getLogs(filter)',
      wagmi: 'useLogs(filter)',
    },
    eth_newFilter: {
      ethers: "provider.send('eth_newFilter', [filter])",
      viem: "publicClient.createEventFilter(...)",
      wagmi: 'watchContractEvent(...)',
    },
    eth_getFilterChanges: {
      ethers: "provider.send('eth_getFilterChanges', [id])",
      viem: "publicClient.getFilterChanges({ filter })",
      wagmi: 'watch* callbacks',
    },
    eth_uninstallFilter: {
      ethers: "provider.send('eth_uninstallFilter', [id])",
      viem: "publicClient.uninstallFilter({ filter })",
      wagmi: 'unwatch()',
    },
    eth_call: {
      ethers: 'provider.call(tx) / contract.method.staticCall()',
      viem: 'publicClient.call(...) / readContract(...)',
      wagmi: 'useReadContract(...)',
    },
    eth_estimateGas: {
      ethers: 'provider.estimateGas(tx)',
      viem: 'publicClient.estimateGas(tx)',
      wagmi: 'estimateGas(config, tx)',
    },
    eth_gasPrice: {
      ethers: 'provider.getFeeData().gasPrice',
      viem: 'publicClient.getGasPrice()',
      wagmi: 'useGasPrice()',
    },
    eth_feeHistory: {
      ethers: "provider.send('eth_feeHistory', ...)",
      viem: 'publicClient.getFeeHistory(...)',
      wagmi: 'getPublicClient().getFeeHistory(...)',
    },
    eth_maxPriorityFeePerGas: {
      ethers: "provider.send('eth_maxPriorityFeePerGas', [])",
      viem: 'publicClient.estimateMaxPriorityFeePerGas()',
      wagmi: 'getPublicClient().estimateMaxPriorityFeePerGas()',
    },
    eth_sendTransaction: {
      ethers: 'signer.sendTransaction(tx)',
      viem: 'walletClient.sendTransaction(tx)',
      wagmi: 'useSendTransaction()',
    },
    eth_sendRawTransaction: {
      ethers: 'provider.broadcastTransaction(rawTx)',
      viem: 'publicClient.sendRawTransaction({ serializedTransaction })',
      wagmi: 'getPublicClient().sendRawTransaction(...)',
    },
    eth_signTransaction: {
      ethers: 'signer.signTransaction(tx)',
      viem: 'walletClient.signTransaction(tx)',
      wagmi: 'signTransaction(config, tx)',
    },
    eth_sign: {
      ethers: "provider.send('eth_sign', [address, msg])",
      viem: "walletClient.request({ method: 'eth_sign', ... })",
      wagmi: "connector.getProvider().request({ method: 'eth_sign' })",
    },
    personal_sign: {
      ethers: 'signer.signMessage(message)',
      viem: 'walletClient.signMessage({ message })',
      wagmi: 'useSignMessage()',
    },
    personal_ecRecover: {
      ethers: 'verifyMessage(message, signature)',
      viem: 'recoverMessageAddress({ message, signature })',
      wagmi: 'recoverMessageAddress(...)',
    },
    eth_signTypedData: {
      ethers: "provider.send('eth_signTypedData', ...)",
      viem: "walletClient.request({ method: 'eth_signTypedData', ... })",
      wagmi: "connector.getProvider().request({ method: 'eth_signTypedData' })",
    },
    eth_signTypedData_v3: {
      ethers: "provider.send('eth_signTypedData_v3', ...)",
      viem: "walletClient.request({ method: 'eth_signTypedData_v3', ... })",
      wagmi: "connector.getProvider().request({ method: 'eth_signTypedData_v3' })",
    },
    eth_signTypedData_v4: {
      ethers: 'signer.signTypedData(domain, types, value)',
      viem: 'walletClient.signTypedData({ domain, types, message })',
      wagmi: 'useSignTypedData()',
    },
    eth_requestAccounts: {
      ethers: "provider.send('eth_requestAccounts', [])",
      viem: 'walletClient.requestAddresses()',
      wagmi: 'useConnect()',
    },
    eth_accounts: {
      ethers: 'provider.listAccounts()',
      viem: "walletClient.request({ method: 'eth_accounts' })",
      wagmi: 'useAccount()',
    },
    wallet_switchEthereumChain: {
      ethers: "provider.send('wallet_switchEthereumChain', [{ chainId }])",
      viem: 'walletClient.switchChain({ id })',
      wagmi: 'useSwitchChain()',
    },
    wallet_addEthereumChain: {
      ethers: "provider.send('wallet_addEthereumChain', [chain])",
      viem: "walletClient.request({ method: 'wallet_addEthereumChain', ... })",
      wagmi: 'connector.getProvider().request(...)',
    },
    wallet_watchAsset: {
      ethers: "provider.send('wallet_watchAsset', [params])",
      viem: "walletClient.request({ method: 'wallet_watchAsset', ... })",
      wagmi: 'connector.getProvider().request(...)',
    },
    wallet_getPermissions: {
      ethers: "provider.send('wallet_getPermissions', [])",
      viem: "walletClient.request({ method: 'wallet_getPermissions' })",
      wagmi: 'connector.getProvider().request(...)',
    },
    wallet_requestPermissions: {
      ethers: "provider.send('wallet_requestPermissions', [params])",
      viem: "walletClient.request({ method: 'wallet_requestPermissions', ... })",
      wagmi: 'connector.getProvider().request(...)',
    },
    wallet_revokePermissions: {
      ethers: "provider.send('wallet_revokePermissions', [params])",
      viem: "walletClient.request({ method: 'wallet_revokePermissions', ... })",
      wagmi: 'connector.getProvider().request(...)',
    },
    wallet_getCapabilities: {
      ethers: "provider.send('wallet_getCapabilities', [address])",
      viem: "walletClient.request({ method: 'wallet_getCapabilities', ... })",
      wagmi: 'connector.getProvider().request(...)',
    },
    wallet_sendCalls: {
      ethers: "provider.send('wallet_sendCalls', [params])",
      viem: "walletClient.request({ method: 'wallet_sendCalls', ... })",
      wagmi: 'connector.getProvider().request(...)',
    },
    wallet_getCallsStatus: {
      ethers: "provider.send('wallet_getCallsStatus', [id])",
      viem: "walletClient.request({ method: 'wallet_getCallsStatus', ... })",
      wagmi: 'connector.getProvider().request(...)',
    },
    eth_subscribe: {
      ethers: 'provider.on(event, listener)',
      viem: 'watchBlocks()/watchEvent()/watchPendingTransactions()',
      wagmi: 'watchBlockNumber()/watchContractEvent()',
    },
    eth_unsubscribe: {
      ethers: 'provider.off(...)',
      viem: 'unwatch()',
      wagmi: 'unwatch()',
    },
    newHeads: {
      ethers: "provider.on('block', ...)",
      viem: 'watchBlocks(...)',
      wagmi: 'watchBlockNumber(...)',
    },
    logs: {
      ethers: 'provider.on(filter, ...)',
      viem: 'watchEvent(...)',
      wagmi: 'watchContractEvent(...)',
    },
    newPendingTransactions: {
      ethers: "provider.on('pending', ...)",
      viem: 'watchPendingTransactions(...)',
      wagmi: 'watchPendingTransactions(...)',
    },
    debug_traceTransaction: {
      ethers: "provider.send('debug_traceTransaction', [hash, opts])",
      viem: "publicClient.request({ method: 'debug_traceTransaction', ... })",
      wagmi: 'getPublicClient().request(...)',
    },
    debug_traceBlockByNumber: {
      ethers: "provider.send('debug_traceBlockByNumber', [block, opts])",
      viem: "publicClient.request({ method: 'debug_traceBlockByNumber', ... })",
      wagmi: 'getPublicClient().request(...)',
    },
    trace_transaction: {
      ethers: "provider.send('trace_transaction', [hash])",
      viem: "publicClient.request({ method: 'trace_transaction', ... })",
      wagmi: 'getPublicClient().request(...)',
    },
    trace_block: {
      ethers: "provider.send('trace_block', [block])",
      viem: "publicClient.request({ method: 'trace_block', ... })",
      wagmi: 'getPublicClient().request(...)',
    },
    trace_call: {
      ethers: "provider.send('trace_call', [tx, modes, block])",
      viem: "publicClient.request({ method: 'trace_call', ... })",
      wagmi: 'getPublicClient().request(...)',
    },
    txpool_status: {
      ethers: "provider.send('txpool_status', [])",
      viem: "publicClient.request({ method: 'txpool_status' })",
      wagmi: 'getPublicClient().request(...)',
    },
    txpool_content: {
      ethers: "provider.send('txpool_content', [])",
      viem: "publicClient.request({ method: 'txpool_content' })",
      wagmi: 'getPublicClient().request(...)',
    },
    txpool_inspect: {
      ethers: "provider.send('txpool_inspect', [])",
      viem: "publicClient.request({ method: 'txpool_inspect' })",
      wagmi: 'getPublicClient().request(...)',
    },
  }
  return map[method] ?? { ethers: 'N/A', viem: 'N/A', wagmi: 'N/A' }
}

function RpcReferencePage({ lang }: { lang: Lang }) {
  const [activeCategory, setActiveCategory] = useState(0)
  const category = RPC_REFERENCE[activeCategory]

  return (
    <section className="card rpc-page">
      <h2>{tr(lang, 'RPC Method Reference (Extended)', 'RPC 方法速查（扩展版）')}</h2>
      <p className="rpc-note">
        {tr(
          lang,
          'This is a practical superset. Availability depends on wallet/client implementation.',
          '这是实用的“尽量全”集合，具体可用性取决于钱包与节点客户端实现。',
        )}
      </p>
      <div className="rpc-tabs" role="tablist" aria-label="rpc categories">
        {RPC_REFERENCE.map((item, index) => (
          <button
            key={item.titleEn}
            className={`rpc-tab-btn ${activeCategory === index ? 'active' : ''}`}
            role="tab"
            aria-selected={activeCategory === index}
            onClick={() => setActiveCategory(index)}
          >
            {tr(lang, item.titleEn, item.titleZh)}
          </button>
        ))}
      </div>

      <div className="rpc-category">
        <h3>{tr(lang, category.titleEn, category.titleZh)}</h3>
        <div className="quick-table-wrap">
          <table className="quick-table rpc-table">
            <thead>
              <tr>
                <th>{tr(lang, 'Method', '方法')}</th>
                <th>{tr(lang, 'Description', '说明')}</th>
                <th>ethers.js</th>
                <th>viem</th>
                <th>wagmi</th>
              </tr>
            </thead>
            <tbody>
              {category.methods.map((item) => (
                <tr key={`${category.titleEn}-${item.method}`}>
                  <td>
                    <code>{item.method}</code>
                  </td>
                  <td>{tr(lang, item.descEn, item.descZh)}</td>
                  <td>
                    <code>{methodLibraryMapping(item.method).ethers}</code>
                  </td>
                  <td>
                    <code>{methodLibraryMapping(item.method).viem}</code>
                  </td>
                  <td>
                    <code>{methodLibraryMapping(item.method).wagmi}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [lang, setLang] = useState<Lang>('en')
  const [balanceInput, setBalanceInput] = useState('')
  const [toInput, setToInput] = useState('')
  const [valueInput, setValueInput] = useState('0.001')
  const [txHashInput, setTxHashInput] = useState('')
  const [contractInput, setContractInput] = useState('')

  const balanceAddress = useMemo(
    () => (isAddress(balanceInput) ? (balanceInput as Hex) : undefined),
    [balanceInput],
  )
  const txHash = useMemo(() => (isHash(txHashInput) ? (txHashInput as Hex) : undefined), [txHashInput])
  const contractAddress = useMemo(
    () => (isAddress(contractInput) ? (contractInput as Hex) : undefined),
    [contractInput],
  )

  return (
    <main className="page">
      <header className="header card">
        <div className="header-top">
          <h1>{page === 'dashboard' ? tr(lang, 'API Comparison Dashboard', 'API 对比面板') : tr(lang, 'RPC Quick Reference', 'RPC 速查页面')}</h1>
          <div className="lang-switch">
            <button onClick={() => setLang('en')} disabled={lang === 'en'}>
              English
            </button>
            <button onClick={() => setLang('zh')} disabled={lang === 'zh'}>
              中文
            </button>
          </div>
        </div>
        <p>
          {tr(
            lang,
            'Use the same inputs to compare ethers.js / viem / wagmi behavior side by side.',
            '使用同一组输入，横向对比 ethers.js / viem / wagmi 的行为。',
          )}
        </p>
      </header>
      <section className="card page-switch" role="tablist" aria-label="page tabs">
        <button
          className={`tab-btn ${page === 'dashboard' ? 'active' : ''}`}
          role="tab"
          aria-selected={page === 'dashboard'}
          onClick={() => setPage('dashboard')}
        >
          {tr(lang, 'Dashboard', '对比面板')}
        </button>
        <button
          className={`tab-btn ${page === 'reference' ? 'active' : ''}`}
          role="tab"
          aria-selected={page === 'reference'}
          onClick={() => setPage('reference')}
        >
          {tr(lang, 'RPC Reference', 'RPC 速查')}
        </button>
      </section>

      {page === 'dashboard' ? (
        <>
          <section className="card controls">
            <h2>{tr(lang, 'Shared Inputs', '共享输入')}</h2>
            <div className="controls-grid">
              <label>
                {tr(lang, 'Balance Address', '余额查询地址')}
                <input
                  placeholder="0x..."
                  value={balanceInput}
                  onChange={(event) => setBalanceInput(event.target.value.trim())}
                />
              </label>
              <label>
                {tr(lang, 'Transfer To', '转账目标地址')}
                <input
                  placeholder="0x..."
                  value={toInput}
                  onChange={(event) => setToInput(event.target.value.trim())}
                />
              </label>
              <label>
                {tr(lang, 'Transfer Value (ETH)', '转账金额 (ETH)')}
                <input
                  placeholder="0.001"
                  value={valueInput}
                  onChange={(event) => setValueInput(event.target.value.trim())}
                />
              </label>
              <label>
                {tr(lang, 'Transaction Hash', '交易哈希查询')}
                <input
                  placeholder="0x..."
                  value={txHashInput}
                  onChange={(event) => setTxHashInput(event.target.value.trim())}
                />
              </label>
              <label>
                {tr(lang, 'Counter Contract Address', 'Counter 合约地址')}
                <input
                  placeholder="0x..."
                  value={contractInput}
                  onChange={(event) => setContractInput(event.target.value.trim())}
                />
              </label>
            </div>
          </section>

          <section className="columns">
            <EthersPanel
              lang={lang}
              balanceAddress={balanceAddress}
              to={toInput}
              value={valueInput}
              txHash={txHash}
              contractAddress={contractAddress}
            />
            <ViemPanel
              lang={lang}
              balanceAddress={balanceAddress}
              to={toInput}
              value={valueInput}
              txHash={txHash}
              contractAddress={contractAddress}
            />
            <WagmiPanel
              lang={lang}
              balanceAddress={balanceAddress}
              to={toInput}
              value={valueInput}
              txHash={txHash}
              contractAddress={contractAddress}
            />
          </section>
        </>
      ) : (
        <RpcReferencePage lang={lang} />
      )}
    </main>
  )
}

type PanelInputs = {
  lang: Lang
  balanceAddress?: Hex
  to: string
  value: string
  txHash?: Hex
  contractAddress?: Hex
}

function EthersPanel({ lang, balanceAddress, to, value, txHash, contractAddress }: PanelInputs) {
  const [account, setAccount] = useState<string>('')
  const [chainId, setChainId] = useState<number | null>(null)
  const [blockNumber, setBlockNumber] = useState<number | null>(null)
  const [balanceText, setBalanceText] = useState('')
  const [sendHash, setSendHash] = useState('')
  const [txInfo, setTxInfo] = useState('')
  const [contractRead, setContractRead] = useState('')
  const [contractWrite, setContractWrite] = useState('')
  const [error, setError] = useState('')

  const refreshChainInfo = async () => {
    const injected = getInjectedProvider()
    if (!injected) return
    const provider = new BrowserProvider(injected)
    const [network, block] = await Promise.all([provider.getNetwork(), provider.getBlockNumber()])
    setChainId(Number(network.chainId))
    setBlockNumber(block)
  }

  useEffect(() => {
    void refreshChainInfo()
    const timer = setInterval(() => {
      void refreshChainInfo()
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const connect = async () => {
    try {
      setError('')
      const injected = getInjectedProvider()
      if (!injected) throw new Error(tr(lang, 'No injected wallet found', '未检测到浏览器钱包'))
      const provider = new BrowserProvider(injected)
      await provider.send('eth_requestAccounts', [])
      const signer = await provider.getSigner()
      setAccount(await signer.getAddress())
      await refreshChainInfo()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const queryBalance = async () => {
    try {
      setError('')
      setBalanceText('')
      if (!balanceAddress) throw new Error(tr(lang, 'Invalid address', '地址无效'))
      const injected = getInjectedProvider()
      if (!injected) throw new Error(tr(lang, 'No injected wallet found', '未检测到浏览器钱包'))
      const provider = new BrowserProvider(injected)
      const balance = await provider.getBalance(balanceAddress)
      setBalanceText(`${balance.toString()} wei`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const sendNative = async (event: FormEvent) => {
    event.preventDefault()
    try {
      setError('')
      setSendHash('')
      if (!isAddress(to)) throw new Error(tr(lang, 'Invalid `to` address', '`to` 地址无效'))
      const injected = getInjectedProvider()
      if (!injected) throw new Error(tr(lang, 'No injected wallet found', '未检测到浏览器钱包'))
      const provider = new BrowserProvider(injected)
      const signer = await provider.getSigner()
      const tx = await signer.sendTransaction({ to, value: parseEtherEthers(value) })
      setSendHash(tx.hash)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const queryTx = async () => {
    try {
      setError('')
      setTxInfo('')
      if (!txHash) throw new Error(tr(lang, 'Invalid hash', '哈希无效'))
      const injected = getInjectedProvider()
      if (!injected) throw new Error(tr(lang, 'No injected wallet found', '未检测到浏览器钱包'))
      const provider = new BrowserProvider(injected)
      const [tx, receipt] = await Promise.all([
        provider.getTransaction(txHash),
        provider.getTransactionReceipt(txHash),
      ])
      setTxInfo(`tx:${tx ? 'yes' : 'no'} | receipt:${receipt ? 'yes' : 'no'} | status:${receipt?.status ?? 'n/a'}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const readContractCount = async () => {
    try {
      setError('')
      setContractRead('')
      if (!contractAddress) throw new Error(tr(lang, 'Invalid contract address', '合约地址无效'))
      const injected = getInjectedProvider()
      if (!injected) throw new Error(tr(lang, 'No injected wallet found', '未检测到浏览器钱包'))
      const provider = new BrowserProvider(injected)
      const contract = new Contract(contractAddress, COUNTER_ABI, provider)
      const count = await contract.getCount()
      setContractRead(count.toString())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const incrementContract = async () => {
    try {
      setError('')
      setContractWrite('')
      if (!contractAddress) throw new Error(tr(lang, 'Invalid contract address', '合约地址无效'))
      const injected = getInjectedProvider()
      if (!injected) throw new Error(tr(lang, 'No injected wallet found', '未检测到浏览器钱包'))
      const provider = new BrowserProvider(injected)
      const signer = await provider.getSigner()
      const contract = new Contract(contractAddress, COUNTER_ABI, signer)
      const tx = await contract.increment()
      const receipt = await tx.wait()
      setContractWrite(`hash:${tx.hash} status:${receipt?.status ?? 'n/a'}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <article className="card panel">
      <h2>ethers.js</h2>
      <p>{tr(lang, 'account', '账户')}: {account || tr(lang, 'not connected', '未连接')}</p>
      <ActionBlock code={CODES.ethers.connect} lang={lang}>
        <button onClick={connect}>{tr(lang, 'Connect Wallet', '连接钱包')}</button>
      </ActionBlock>
      <p>chainId: {chainId ?? '-'}</p>
      <p>block: {blockNumber ?? '-'}</p>
      <CodeFold lang={lang} title={tr(lang, 'View Code: Chain Info', '查看代码：链信息')} code={CODES.ethers.chainInfo} />
      <ActionBlock code={CODES.ethers.queryBalance} lang={lang}>
        <button onClick={queryBalance}>{tr(lang, 'Query Balance', '查询余额')}</button>
        <p>{balanceText || '-'}</p>
      </ActionBlock>
      <ActionBlock code={CODES.ethers.sendNative} lang={lang}>
        <form className="row" onSubmit={sendNative}>
          <button type="submit">{tr(lang, 'Send Native Tx', '发起转账')}</button>
          <p>{sendHash || '-'}</p>
        </form>
      </ActionBlock>
      <ActionBlock code={CODES.ethers.queryTx} lang={lang}>
        <button onClick={queryTx}>{tr(lang, 'Query Tx', '查询交易')}</button>
        <p>{txInfo || '-'}</p>
      </ActionBlock>
      <ActionBlock code={CODES.ethers.readContract} lang={lang}>
        <button onClick={readContractCount}>{tr(lang, 'Read getCount()', '读取 getCount()')}</button>
        <p>{contractRead || '-'}</p>
      </ActionBlock>
      <ActionBlock code={CODES.ethers.writeContract} lang={lang}>
        <button onClick={incrementContract}>{tr(lang, 'Call increment()', '调用 increment()')}</button>
        <p>{contractWrite || '-'}</p>
      </ActionBlock>
      {error && <p className="error">{error}</p>}
    </article>
  )
}

function ViemPanel({ lang, balanceAddress, to, value, txHash, contractAddress }: PanelInputs) {
  const [account, setAccount] = useState<string>('')
  const [chainId, setChainId] = useState<number | null>(null)
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null)
  const [balanceText, setBalanceText] = useState('')
  const [sendHash, setSendHash] = useState('')
  const [txInfo, setTxInfo] = useState('')
  const [contractRead, setContractRead] = useState('')
  const [contractWrite, setContractWrite] = useState('')
  const [error, setError] = useState('')

  const refreshChainInfo = async () => {
    const injected = getInjectedProvider()
    if (!injected) return
    const publicClient = createPublicClient({ transport: custom(injected) })
    const [nextChainId, block] = await Promise.all([
      publicClient.getChainId(),
      publicClient.getBlockNumber(),
    ])
    setChainId(nextChainId)
    setBlockNumber(block)
  }

  useEffect(() => {
    void refreshChainInfo()
    const timer = setInterval(() => {
      void refreshChainInfo()
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const connect = async () => {
    try {
      setError('')
      const injected = getInjectedProvider()
      if (!injected) throw new Error(tr(lang, 'No injected wallet found', '未检测到浏览器钱包'))
      const walletClient = createWalletClient({ transport: custom(injected), chain: undefined })
      const [address] = await walletClient.requestAddresses()
      setAccount(address)
      await refreshChainInfo()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const queryBalance = async () => {
    try {
      setError('')
      setBalanceText('')
      if (!balanceAddress) throw new Error(tr(lang, 'Invalid address', '地址无效'))
      const injected = getInjectedProvider()
      if (!injected) throw new Error(tr(lang, 'No injected wallet found', '未检测到浏览器钱包'))
      const publicClient = createPublicClient({ transport: custom(injected) })
      const balance = await publicClient.getBalance({ address: balanceAddress })
      setBalanceText(`${formatEther(balance)} ETH`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const sendNative = async (event: FormEvent) => {
    event.preventDefault()
    try {
      setError('')
      setSendHash('')
      if (!isAddress(to)) throw new Error(tr(lang, 'Invalid `to` address', '`to` 地址无效'))
      const injected = getInjectedProvider()
      if (!injected) throw new Error(tr(lang, 'No injected wallet found', '未检测到浏览器钱包'))
      const walletClient = createWalletClient({ transport: custom(injected), chain: undefined })
      const [address] = await walletClient.requestAddresses()
      const hash = await walletClient.sendTransaction({
        account: address,
        chain: undefined,
        to,
        value: parseEther(value),
      })
      setSendHash(hash)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const queryTx = async () => {
    try {
      setError('')
      setTxInfo('')
      if (!txHash) throw new Error(tr(lang, 'Invalid hash', '哈希无效'))
      const injected = getInjectedProvider()
      if (!injected) throw new Error(tr(lang, 'No injected wallet found', '未检测到浏览器钱包'))
      const publicClient = createPublicClient({ transport: custom(injected) })
      const [tx, receipt] = await Promise.all([
        publicClient.getTransaction({ hash: txHash }),
        publicClient.getTransactionReceipt({ hash: txHash }),
      ])
      setTxInfo(`tx:${tx ? 'yes' : 'no'} | receipt:${receipt ? 'yes' : 'no'} | status:${receipt.status}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const readContractCount = async () => {
    try {
      setError('')
      setContractRead('')
      if (!contractAddress) throw new Error(tr(lang, 'Invalid contract address', '合约地址无效'))
      const injected = getInjectedProvider()
      if (!injected) throw new Error(tr(lang, 'No injected wallet found', '未检测到浏览器钱包'))
      const publicClient = createPublicClient({ transport: custom(injected) })
      const count = await publicClient.readContract({
        address: contractAddress,
        abi: COUNTER_ABI,
        functionName: 'getCount',
      })
      setContractRead(count.toString())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const incrementContract = async () => {
    try {
      setError('')
      setContractWrite('')
      if (!contractAddress) throw new Error(tr(lang, 'Invalid contract address', '合约地址无效'))
      const injected = getInjectedProvider()
      if (!injected) throw new Error(tr(lang, 'No injected wallet found', '未检测到浏览器钱包'))
      const walletClient = createWalletClient({ transport: custom(injected), chain: undefined })
      const publicClient = createPublicClient({ transport: custom(injected) })
      const [address] = await walletClient.requestAddresses()
      const hash = await walletClient.writeContract({
        account: address,
        chain: undefined,
        address: contractAddress,
        abi: COUNTER_ABI,
        functionName: 'increment',
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      setContractWrite(`hash:${hash} status:${receipt.status}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <article className="card panel">
      <h2>viem</h2>
      <p>{tr(lang, 'account', '账户')}: {account || tr(lang, 'not connected', '未连接')}</p>
      <ActionBlock code={CODES.viem.connect} lang={lang}>
        <button onClick={connect}>{tr(lang, 'Connect Wallet', '连接钱包')}</button>
      </ActionBlock>
      <p>chainId: {chainId ?? '-'}</p>
      <p>block: {blockNumber?.toString() ?? '-'}</p>
      <CodeFold lang={lang} title={tr(lang, 'View Code: Chain Info', '查看代码：链信息')} code={CODES.viem.chainInfo} />
      <ActionBlock code={CODES.viem.queryBalance} lang={lang}>
        <button onClick={queryBalance}>{tr(lang, 'Query Balance', '查询余额')}</button>
        <p>{balanceText || '-'}</p>
      </ActionBlock>
      <ActionBlock code={CODES.viem.sendNative} lang={lang}>
        <form className="row" onSubmit={sendNative}>
          <button type="submit">{tr(lang, 'Send Native Tx', '发起转账')}</button>
          <p>{sendHash || '-'}</p>
        </form>
      </ActionBlock>
      <ActionBlock code={CODES.viem.queryTx} lang={lang}>
        <button onClick={queryTx}>{tr(lang, 'Query Tx', '查询交易')}</button>
        <p>{txInfo || '-'}</p>
      </ActionBlock>
      <ActionBlock code={CODES.viem.readContract} lang={lang}>
        <button onClick={readContractCount}>{tr(lang, 'Read getCount()', '读取 getCount()')}</button>
        <p>{contractRead || '-'}</p>
      </ActionBlock>
      <ActionBlock code={CODES.viem.writeContract} lang={lang}>
        <button onClick={incrementContract}>{tr(lang, 'Call increment()', '调用 increment()')}</button>
        <p>{contractWrite || '-'}</p>
      </ActionBlock>
      {error && <p className="error">{error}</p>}
    </article>
  )
}

function WagmiPanel({ lang, balanceAddress, to, value, txHash, contractAddress }: PanelInputs) {
  const chainId = useChainId()
  const { address: connectedAddress, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnectPending } = useConnect()
  const { disconnect } = useDisconnect()

  const { data: blockNumber } = useBlockNumber({ chainId, watch: true })

  const { data: balance, isFetching: isBalanceFetching } = useBalance({
    address: balanceAddress,
    query: { enabled: Boolean(balanceAddress) },
  })

  const [sendError, setSendError] = useState('')
  const { data: sendHash, sendTransaction, isPending: isSendPending } = useSendTransaction()

  const { data: tx, isFetching: isTxFetching } = useTransaction({ hash: txHash, query: { enabled: Boolean(txHash) } })
  const { data: receipt, isFetching: isReceiptFetching } = useTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  })

  const safeContractAddress = (contractAddress ?? ZERO_ADDRESS) as Hex
  const { data: counterValue, isFetching: isCounterFetching, refetch: refetchCounter } = useReadContract({
    address: safeContractAddress,
    abi: COUNTER_ABI,
    functionName: 'getCount',
    query: { enabled: Boolean(contractAddress) },
  })

  const { data: incrementHash, error: incrementError, isPending: isIncrementPending, writeContract } = useWriteContract()

  const { data: incrementReceipt } = useWaitForTransactionReceipt({
    hash: incrementHash,
    query: { enabled: Boolean(incrementHash) },
  })

  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSendError('')

    if (!isAddress(to)) {
      setSendError(tr(lang, 'Invalid `to` address', '`to` 地址无效'))
      return
    }

    try {
      sendTransaction({ to, value: parseEther(value) })
    } catch (error) {
      setSendError(error instanceof Error ? error.message : tr(lang, 'Failed to send transaction', '发起交易失败'))
    }
  }

  const handleContractIncrement = () => {
    if (!contractAddress) {
      setSendError(tr(lang, 'Invalid contract address', '合约地址无效'))
      return
    }
    writeContract({ address: contractAddress, abi: COUNTER_ABI, functionName: 'increment' })
  }

  return (
    <article className="card panel">
      <h2>wagmi</h2>
      {isConnected ? (
        <div className="row">
          <p>{tr(lang, 'account', '账户')}: {connectedAddress}</p>
          <button onClick={() => disconnect()}>{tr(lang, 'Disconnect', '断开')}</button>
        </div>
      ) : (
        <div className="row">
          {connectors.map((connector) => (
            <button key={connector.uid} onClick={() => connect({ connector })} disabled={isConnectPending}>
              {tr(lang, 'Connect', '连接')} {connector.name}
            </button>
          ))}
        </div>
      )}
      <CodeFold lang={lang} title={tr(lang, 'View Code: Connect', '查看代码：连接')} code={CODES.wagmi.connect} />

      <p>chainId: {chainId}</p>
      <p>block: {blockNumber?.toString() ?? '-'}</p>
      <CodeFold lang={lang} title={tr(lang, 'View Code: Chain Info', '查看代码：链信息')} code={CODES.wagmi.chainInfo} />

      <ActionBlock code={CODES.wagmi.queryBalance} lang={lang}>
        <p>{tr(lang, 'Balance', '余额')}:</p>
        {isBalanceFetching ? <p>{tr(lang, 'Loading...', '查询中...')}</p> : <p>{balance ? `${balance.formatted} ${balance.symbol}` : '-'}</p>}
      </ActionBlock>

      <ActionBlock code={CODES.wagmi.sendNative} lang={lang}>
        <form className="row" onSubmit={handleSend}>
          <button type="submit" disabled={!isConnected || isSendPending}>
            {isSendPending ? tr(lang, 'Sending...', '发送中...') : tr(lang, 'Send Native Tx', '发起转账')}
          </button>
          <p>{sendHash ?? '-'}</p>
        </form>
      </ActionBlock>

      <ActionBlock code={CODES.wagmi.queryTx} lang={lang}>
        {(isTxFetching || isReceiptFetching) && <p>{tr(lang, 'Loading...', '查询中...')}</p>}
        {!isTxFetching && !isReceiptFetching && (
          <p>
            tx:{tx ? 'yes' : 'no'} | receipt:{receipt ? 'yes' : 'no'} | status:{receipt?.status ?? 'n/a'}
          </p>
        )}
      </ActionBlock>

      <ActionBlock code={CODES.wagmi.readContract} lang={lang}>
        <button onClick={() => void refetchCounter()} disabled={!contractAddress || isCounterFetching}>
          {isCounterFetching ? tr(lang, 'Reading...', '读取中...') : tr(lang, 'Read getCount()', '读取 getCount()')}
        </button>
        <p>{counterValue?.toString() ?? '-'}</p>
      </ActionBlock>

      <ActionBlock code={CODES.wagmi.writeContract} lang={lang}>
        <button onClick={handleContractIncrement} disabled={!isConnected || isIncrementPending || !contractAddress}>
          {isIncrementPending ? tr(lang, 'Calling...', '调用中...') : tr(lang, 'Call increment()', '调用 increment()')}
        </button>
        <p>{incrementHash ? `hash:${incrementHash} status:${incrementReceipt?.status ?? 'pending'}` : '-'}</p>
      </ActionBlock>

      {incrementError && <p className="error">{incrementError.message}</p>}
      {sendError && <p className="error">{sendError}</p>}
    </article>
  )
}

export default App
