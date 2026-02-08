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

function App() {
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
          <h1>{tr(lang, 'API Comparison Dashboard', 'API 对比面板')}</h1>
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
