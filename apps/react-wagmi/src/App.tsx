import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { BrowserProvider, parseEther as parseEtherEthers } from 'ethers'
import { createPublicClient, createWalletClient, custom, formatEther, isAddress, isHash, parseEther } from 'viem'
import {
  useAccount,
  useBalance,
  useBlockNumber,
  useChainId,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useTransaction,
  useTransactionReceipt,
} from 'wagmi'
import './App.css'

type Hex = `0x${string}`

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider
  }
}

function getInjectedProvider() {
  return window.ethereum
}

function App() {
  const [balanceInput, setBalanceInput] = useState('')
  const [toInput, setToInput] = useState('')
  const [valueInput, setValueInput] = useState('0.001')
  const [txHashInput, setTxHashInput] = useState('')

  const balanceAddress = useMemo(
    () => (isAddress(balanceInput) ? (balanceInput as Hex) : undefined),
    [balanceInput],
  )
  const txHash = useMemo(() => (isHash(txHashInput) ? (txHashInput as Hex) : undefined), [txHashInput])

  return (
    <main className="page">
      <header className="header card">
        <h1>API 对比面板</h1>
        <p>同一组输入，同时查看 ethers.js / viem / wagmi 的行为与结果。</p>
      </header>

      <section className="card controls">
        <h2>共享输入</h2>
        <div className="controls-grid">
          <label>
            余额查询地址
            <input
              placeholder="0x..."
              value={balanceInput}
              onChange={(event) => setBalanceInput(event.target.value.trim())}
            />
          </label>
          <label>
            转账 to
            <input
              placeholder="0x..."
              value={toInput}
              onChange={(event) => setToInput(event.target.value.trim())}
            />
          </label>
          <label>
            转账 value (ETH)
            <input
              placeholder="0.001"
              value={valueInput}
              onChange={(event) => setValueInput(event.target.value.trim())}
            />
          </label>
          <label>
            交易 hash 查询
            <input
              placeholder="0x..."
              value={txHashInput}
              onChange={(event) => setTxHashInput(event.target.value.trim())}
            />
          </label>
        </div>
      </section>

      <section className="columns">
        <EthersPanel balanceAddress={balanceAddress} to={toInput} value={valueInput} txHash={txHash} />
        <ViemPanel balanceAddress={balanceAddress} to={toInput} value={valueInput} txHash={txHash} />
        <WagmiPanel balanceAddress={balanceAddress} to={toInput} value={valueInput} txHash={txHash} />
      </section>
    </main>
  )
}

type PanelInputs = {
  balanceAddress?: Hex
  to: string
  value: string
  txHash?: Hex
}

function EthersPanel({ balanceAddress, to, value, txHash }: PanelInputs) {
  const [account, setAccount] = useState<string>('')
  const [chainId, setChainId] = useState<number | null>(null)
  const [blockNumber, setBlockNumber] = useState<number | null>(null)
  const [balanceText, setBalanceText] = useState('')
  const [sendHash, setSendHash] = useState('')
  const [txInfo, setTxInfo] = useState('')
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
      if (!injected) throw new Error('未检测到浏览器钱包')
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
      if (!balanceAddress) throw new Error('请输入有效地址')
      const injected = getInjectedProvider()
      if (!injected) throw new Error('未检测到浏览器钱包')
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
      if (!isAddress(to)) throw new Error('to 地址无效')
      const injected = getInjectedProvider()
      if (!injected) throw new Error('未检测到浏览器钱包')
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
      if (!txHash) throw new Error('请输入有效 hash')
      const injected = getInjectedProvider()
      if (!injected) throw new Error('未检测到浏览器钱包')
      const provider = new BrowserProvider(injected)
      const [tx, receipt] = await Promise.all([
        provider.getTransaction(txHash),
        provider.getTransactionReceipt(txHash),
      ])
      setTxInfo(
        `tx:${tx ? 'yes' : 'no'} | receipt:${receipt ? 'yes' : 'no'} | status:${receipt?.status ?? 'n/a'}`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <article className="card panel">
      <h2>ethers.js</h2>
      <p>account: {account || '未连接'}</p>
      <button onClick={connect}>连接钱包</button>
      <p>chainId: {chainId ?? '-'}</p>
      <p>block: {blockNumber ?? '-'}</p>
      <div className="row">
        <button onClick={queryBalance}>查询余额</button>
        <p>{balanceText || '-'}</p>
      </div>
      <form className="row" onSubmit={sendNative}>
        <button type="submit">发起转账</button>
        <p>{sendHash || '-'}</p>
      </form>
      <div className="row">
        <button onClick={queryTx}>查询交易</button>
        <p>{txInfo || '-'}</p>
      </div>
      {error && <p className="error">{error}</p>}
    </article>
  )
}

function ViemPanel({ balanceAddress, to, value, txHash }: PanelInputs) {
  const [account, setAccount] = useState<string>('')
  const [chainId, setChainId] = useState<number | null>(null)
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null)
  const [balanceText, setBalanceText] = useState('')
  const [sendHash, setSendHash] = useState('')
  const [txInfo, setTxInfo] = useState('')
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
      if (!injected) throw new Error('未检测到浏览器钱包')
      const walletClient = createWalletClient({ transport: custom(injected) })
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
      if (!balanceAddress) throw new Error('请输入有效地址')
      const injected = getInjectedProvider()
      if (!injected) throw new Error('未检测到浏览器钱包')
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
      if (!isAddress(to)) throw new Error('to 地址无效')
      const injected = getInjectedProvider()
      if (!injected) throw new Error('未检测到浏览器钱包')
      const walletClient = createWalletClient({ transport: custom(injected) })
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
      if (!txHash) throw new Error('请输入有效 hash')
      const injected = getInjectedProvider()
      if (!injected) throw new Error('未检测到浏览器钱包')
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

  return (
    <article className="card panel">
      <h2>viem</h2>
      <p>account: {account || '未连接'}</p>
      <button onClick={connect}>连接钱包</button>
      <p>chainId: {chainId ?? '-'}</p>
      <p>block: {blockNumber?.toString() ?? '-'}</p>
      <div className="row">
        <button onClick={queryBalance}>查询余额</button>
        <p>{balanceText || '-'}</p>
      </div>
      <form className="row" onSubmit={sendNative}>
        <button type="submit">发起转账</button>
        <p>{sendHash || '-'}</p>
      </form>
      <div className="row">
        <button onClick={queryTx}>查询交易</button>
        <p>{txInfo || '-'}</p>
      </div>
      {error && <p className="error">{error}</p>}
    </article>
  )
}

function WagmiPanel({ balanceAddress, to, value, txHash }: PanelInputs) {
  const chainId = useChainId()
  const { address: connectedAddress, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnectPending } = useConnect()
  const { disconnect } = useDisconnect()

  const { data: blockNumber } = useBlockNumber({
    chainId,
    watch: true,
  })

  const { data: balance, isFetching: isBalanceFetching } = useBalance({
    address: balanceAddress,
    query: { enabled: Boolean(balanceAddress) },
  })

  const [sendError, setSendError] = useState('')
  const {
    data: sendHash,
    sendTransaction,
    isPending: isSendPending,
  } = useSendTransaction()

  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSendError('')

    if (!isAddress(to)) {
      setSendError('to 地址无效')
      return
    }

    try {
      sendTransaction({
        to,
        value: parseEther(value),
      })
    } catch (error) {
      setSendError(error instanceof Error ? error.message : '转账发起失败')
    }
  }

  const { data: tx, isFetching: isTxFetching } = useTransaction({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  })
  const { data: receipt, isFetching: isReceiptFetching } = useTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  })

  return (
    <article className="card panel">
      <h2>wagmi</h2>
      {isConnected ? (
        <div className="row">
          <p>account: {connectedAddress}</p>
          <button onClick={() => disconnect()}>断开</button>
        </div>
      ) : (
        <div className="row">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              disabled={isConnectPending}
            >
              连接 {connector.name}
            </button>
          ))}
        </div>
      )}

      <p>chainId: {chainId}</p>
      <p>block: {blockNumber?.toString() ?? '-'}</p>

      <div className="row">
        <p>余额:</p>
        {isBalanceFetching ? <p>查询中...</p> : <p>{balance ? `${balance.formatted} ${balance.symbol}` : '-'}</p>}
      </div>

      <form className="row" onSubmit={handleSend}>
        <button type="submit" disabled={!isConnected || isSendPending}>
          {isSendPending ? '发送中...' : '发起转账'}
        </button>
        <p>{sendHash ?? '-'}</p>
      </form>

      <div className="row">
        {(isTxFetching || isReceiptFetching) && <p>查询中...</p>}
        {!isTxFetching && !isReceiptFetching && (
          <p>
            tx:{tx ? 'yes' : 'no'} | receipt:{receipt ? 'yes' : 'no'} | status:{receipt?.status ?? 'n/a'}
          </p>
        )}
      </div>

      {sendError && <p className="error">{sendError}</p>}
    </article>
  )
}

export default App
