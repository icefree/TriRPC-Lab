# react-wagmi MVP

最小 `wagmi v2 + viem` React MVP（Vite + TypeScript），包含：

1. 显示 `chainId` / `blockNumber`
2. 输入地址查询余额
3. 发起原生转账（输入 `to` / `value`）
4. 按 `hash` 查询 transaction 与 receipt

## 环境要求

- Node.js 18+
- `pnpm`
- 浏览器钱包（如 MetaMask）

## 启动

```bash
pnpm install
pnpm --filter react-wagmi dev
```

如果你只在当前目录操作：

```bash
cd apps/react-wagmi
pnpm install
pnpm dev
```

默认使用 `Sepolia` 公链 RPC（`wagmi/chains` + `http()`）。

## 构建

```bash
pnpm --filter react-wagmi build
```

## 使用说明

- 钱包连接：页面顶部点击连接按钮。
- 查询余额：在“查询地址余额”输入框填入地址。
- 发起转账：连接钱包后输入 `to` 地址和 `value(ETH)` 后发送。
- 查询交易状态：填入交易 hash，会分别显示交易信息与 receipt 状态。
