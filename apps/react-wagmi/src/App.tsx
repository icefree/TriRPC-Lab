import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { formatEther, isAddress, isHash, parseEther } from 'viem'
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

function App() {
  const chainId = useChainId()
  const { address: connectedAddress, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnectPending } = useConnect()
  const { disconnect } = useDisconnect()

  const { data: blockNumber } = useBlockNumber({
    chainId,
    watch: true,
  })

  const [balanceInput, setBalanceInput] = useState('')
  const balanceAddress = useMemo(
    () => (isAddress(balanceInput) ? (balanceInput as `0x${string}`) : undefined),
    [balanceInput],
  )
  const { data: balance, isFetching: isBalanceFetching } = useBalance({
    address: balanceAddress,
    query: {
      enabled: Boolean(balanceAddress),
    },
  })

  const [to, setTo] = useState('')
  const [value, setValue] = useState('0.001')
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
      setSendError('`to` 地址格式无效')
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

  const [txHashInput, setTxHashInput] = useState('')
  const queryHash = useMemo(
    () => (isHash(txHashInput) ? (txHashInput as `0x${string}`) : undefined),
    [txHashInput],
  )

  const { data: tx, isFetching: isTxFetching } = useTransaction({
    hash: queryHash,
    query: { enabled: Boolean(queryHash) },
  })
  const { data: receipt, isFetching: isReceiptFetching } = useTransactionReceipt({
    hash: queryHash,
    query: { enabled: Boolean(queryHash) },
  })

  return (
    <main className="container">
      <h1>wagmi + viem MVP</h1>

      <section className="card">
        <h2>钱包连接</h2>
        {isConnected ? (
          <div>
            <p>已连接: {connectedAddress}</p>
            <button onClick={() => disconnect()}>断开连接</button>
          </div>
        ) : (
          <div className="actions">
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
      </section>

      <section className="card">
        <h2>1) 当前链与区块</h2>
        <p>chainId: {chainId}</p>
        <p>blockNumber: {blockNumber?.toString() ?? '加载中...'}</p>
      </section>

      <section className="card">
        <h2>2) 查询地址余额</h2>
        <label>
          地址
          <input
            placeholder="0x..."
            value={balanceInput}
            onChange={(event) => setBalanceInput(event.target.value.trim())}
          />
        </label>
        {!balanceAddress && balanceInput && <p className="error">请输入有效地址</p>}
        {isBalanceFetching && <p>查询中...</p>}
        {balance && (
          <p>
            余额: {balance.formatted} {balance.symbol}
          </p>
        )}
      </section>

      <section className="card">
        <h2>3) 发起原生转账</h2>
        {!isConnected && <p className="error">请先连接钱包</p>}
        <form className="form" onSubmit={handleSend}>
          <label>
            to
            <input
              placeholder="0x..."
              value={to}
              onChange={(event) => setTo(event.target.value.trim())}
            />
          </label>
          <label>
            value (ETH)
            <input
              placeholder="0.001"
              value={value}
              onChange={(event) => setValue(event.target.value.trim())}
            />
          </label>
          <button type="submit" disabled={!isConnected || isSendPending}>
            {isSendPending ? '发送中...' : '发送交易'}
          </button>
        </form>
        {sendError && <p className="error">{sendError}</p>}
        {sendHash && <p>发送成功，hash: {sendHash}</p>}
      </section>

      <section className="card">
        <h2>4) 按 hash 查询交易与回执</h2>
        <label>
          交易 hash
          <input
            placeholder="0x..."
            value={txHashInput}
            onChange={(event) => setTxHashInput(event.target.value.trim())}
          />
        </label>
        {!queryHash && txHashInput && <p className="error">请输入有效 hash</p>}
        {(isTxFetching || isReceiptFetching) && <p>查询中...</p>}
        {tx && (
          <div>
            <p>交易存在: 是</p>
            <p>from: {tx.from}</p>
            <p>to: {tx.to ?? '合约创建'}</p>
            <p>value: {formatEther(tx.value)} ETH</p>
            <p>blockNumber: {tx.blockNumber?.toString() ?? 'pending'}</p>
          </div>
        )}
        {receipt && (
          <div>
            <p>receipt.status: {receipt.status}</p>
            <p>confirmations block: {receipt.blockNumber.toString()}</p>
            <p>gasUsed: {receipt.gasUsed.toString()}</p>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
