# ethers.js vs viem vs wagmi API 对比项目计划

## 1. 项目定位
以“同题三解”的方式，对同一组 EVM 任务分别使用 `ethers.js`、`viem`、`wagmi` 实现，形成可量化、可复现的 API 对比结论。

## 2. 目标与成功标准
- 目标 1：建立统一场景，避免“不同题目比较不同库”。
- 目标 2：输出开发体验与工程指标的对比报告，支持技术选型。
- 目标 3：沉淀最小可复用模板，后续新链或新钱包可快速扩展。

成功标准：
- 完成全部核心场景的三套实现（wagmi 以 React Hooks 形态实现）。
- 产出 `reports/compare.md`，包含代码量、类型安全、错误可读性、性能数据。
- 每个场景都可通过脚本一键执行并复现结果。

## 3. 技术范围与边界
- Runtime：Node.js 20+
- Package manager：`pnpm`
- Language：TypeScript（`strict: true`）
- Chain：本地 Anvil（主），Sepolia（可选验证）
- 不做内容（YAGNI）：不接入复杂后端服务、不做多链聚合、不做生产级监控。

## 4. 项目结构（建议）
```text
.
├─ contracts/                 # 对比用最小合约（Counter）
├─ packages/
│  ├─ scenarios/              # 场景定义、统一输入输出模型
│  ├─ impl-ethers/            # ethers.js 实现
│  ├─ impl-viem/              # viem 实现
│  └─ benchmark/              # 执行器与指标采集
├─ apps/
│  └─ react-wagmi/            # wagmi + React 场景实现
├─ scripts/
│  └─ run-all.ts              # 统一运行并生成报告
└─ reports/
   └─ compare.md              # 自动生成对比报告
```

## 5. 核心对比场景
1. RPC 连接与链信息读取：`chainId`、`blockNumber`。
2. 账户状态查询：`balance`、`nonce`。
3. 合约读取（只读调用）：`getCount()`。
4. **发起 Transaction（原生转账）**：`sendTransaction` + 手续费参数控制。
5. 合约写入 Transaction：`increment()` + 等待确认。
6. **查询 Transaction 生命周期**：按 hash 查询 `getTransaction`、`getTransactionReceipt`、确认数、失败原因。
7. 事件与日志：订阅/拉取日志并解码。
8. 签名与验签：`signMessage` 与地址恢复。
9. 批量调用（可选增强）：multicall 对比。

## 6. 评估指标（统一打分）
- API 易用性：心智负担、文档映射成本。
- 类型安全：TS 推断完整度、错误前置能力。
- 代码复杂度：实现 LOC、重复样板比例。
- 错误可调试性：报错信息可读性、定位速度。
- 运行表现：平均耗时、RPC 请求次数。
- React 集成体验：状态管理、钱包连接一致性（wagmi 重点）。

## 7. 执行阶段计划
### 阶段一：理解现状（半天）
- 建立仓库与基础工程（pnpm workspace、TS 配置、lint/test 基线）。
- 编写最小 `Counter` 合约并验证部署流程。
- 输出：可运行的最小环境。

### 阶段二：方案规划（半天）
- 定义 `scenarios` 统一接口（输入、输出、错误模型）。
- 明确各指标采集方式（时间、请求数、LOC 统计规则）。
- 输出：场景规范与报告模板。

### 阶段三：实施对比（1-2 天）
- 并行实现 `impl-ethers`、`impl-viem`、`react-wagmi`。
- 完成场景 1-8，优先交付场景 4 和 6（transaction 发起/查询）。
- 脚本化跑分并生成 `reports/compare.md`。

### 阶段四：复盘总结（半天）
- 汇总结论与选型建议（按后端脚本、前端 dApp 两类给建议）。
- 记录风险与后续扩展项。

## 8. 里程碑与验收
- M1：脚手架与合约部署完成。
- M2：ethers + viem 场景 1-6 完成并可复现。
- M3：wagmi React 场景接入完成。
- M4：自动报告生成并给出选型结论。

验收条件：
- `pnpm run run:all` 一次性执行通过。
- 报告中至少包含 3 轮重复测试均值。
- transaction 发起与查询场景有明确失败样例与错误解释。

## 9. 风险与应对
- 风险：本地链与公开测试网行为差异。
  - 应对：主结论基于本地链，补充 Sepolia 抽样验证。
- 风险：wagmi 与 viem 边界认知混淆。
  - 应对：报告中单独区分“底层 RPC/API”与“React 状态管理层”。
- 风险：指标波动影响结论。
  - 应对：固定环境、重复执行、输出方差。

## 10. 下一步行动清单
1. 初始化 `pnpm` workspace 与 TypeScript 配置。
2. 写 `Counter.sol` + 部署脚本。
3. 先完成场景 4/6 的 ethers 与 viem 对照实现。
4. 再接入 wagmi 前端并统一报告输出。
