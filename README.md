# TriRPC-Lab

A minimal monorepo lab for comparing **ethers.js**, **viem**, and **wagmi** in one place.

## Overview
TriRPC-Lab contains:
- Smart contract compile/deploy scripts (`solc` + `viem`)
- Side-by-side RPC/API comparison flows (`ethers` vs `viem`)
- A React + wagmi frontend demo (`apps/react-wagmi`)

## Tech Stack
- Node.js 20+
- pnpm (workspace)
- TypeScript
- Solidity (`solc`)
- viem / ethers / wagmi

## Project Structure
```text
.
├─ apps/
│  └─ react-wagmi/          # frontend demo
├─ contracts/
│  └─ Counter.sol
├─ packages/
│  ├─ impl-ethers/          # ethers implementation
│  ├─ impl-viem/            # viem implementation
│  └─ scenarios/            # shared scenarios/contracts ABI helpers
├─ scripts/
│  ├─ compile-contract.ts
│  ├─ deploy-contract.ts
│  └─ run-all.ts
└─ reports/
   └─ compare.md            # generated comparison output
```

## Quick Start
1. Install dependencies
```bash
pnpm install
```
2. Start local chain (new terminal)
```bash
anvil
```
3. Configure env
```bash
cp .env.example .env
```
4. Compile and deploy contract
```bash
pnpm compile:contract
pnpm deploy:contract
```
5. Run comparison report
```bash
pnpm run:all
```

Output file: `reports/compare.md`

## Frontend (wagmi demo)
```bash
pnpm --filter react-wagmi dev
```

## Scripts
- `pnpm build`: build all workspace packages/apps
- `pnpm typecheck`: type-check all workspace packages/apps
- `pnpm compile:contract`: compile `contracts/Counter.sol`
- `pnpm deploy:contract`: deploy contract to RPC from `.env`
- `pnpm run:all`: run ethers/viem comparison and write report

---

## 中文说明（Chinese）

### 项目简介
TriRPC-Lab 是一个最小化 monorepo，用于在同一项目中对比 **ethers.js**、**viem**、**wagmi** 的开发体验与调用方式。

### 快速开始
1. 安装依赖：`pnpm install`
2. 启动本地区块链：`anvil`
3. 配置环境变量：`cp .env.example .env`
4. 编译与部署合约：`pnpm compile:contract && pnpm deploy:contract`
5. 运行对比脚本：`pnpm run:all`

输出文件为：`reports/compare.md`

### 前端演示
运行：`pnpm --filter react-wagmi dev`

---

## License
MIT
