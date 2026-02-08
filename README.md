# ethers.js vs viem vs wagmi MVP

## Prerequisites
- Node.js 20+
- pnpm
- Anvil (`anvil --version`)

## Quick start
1. Install deps
   - `pnpm install`
2. Start Anvil (new terminal)
   - `anvil`
3. Create `.env` from `.env.example`
   - `cp .env.example .env`
4. Compile and deploy Counter
   - `pnpm compile:contract`
   - `pnpm deploy:contract`
5. Run API comparison report (ethers + viem)
   - `pnpm run:all`

Output file: `reports/compare.md`
