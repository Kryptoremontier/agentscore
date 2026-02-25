# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

AgentScore is a single Next.js 14 (App Router) frontend application — no backend, no database, no monorepo. All data comes from remote services (Intuition Protocol GraphQL API and blockchain). The package manager is **npm** (lockfile: `package-lock.json`).

### Running the application

- `npm run dev` — starts the Next.js dev server on port 3000.
- `npm run build` — production build.
- `npm run lint` — ESLint. Requires `.eslintrc.json` to exist (see below).
- `npm run type-check` — TypeScript type checking via `tsc --noEmit`.

### Environment setup notes

- Copy `.env.example` to `.env.local` before running. At minimum, set `NEXT_PUBLIC_WC_PROJECT_ID` (get from https://cloud.walletconnect.com). The app renders and navigates fine with a placeholder value, but wallet connections will fail without a valid project ID.
- The `.eslintrc.json` file is not committed to the repo. If `npm run lint` prompts interactively, create it with: `{"extends": "next/core-web-vitals"}`.
- Build warnings about `@react-native-async-storage/async-storage` and `pino-pretty` are harmless — they come from the MetaMask SDK and WalletConnect transitive dependencies.
- The `[Reown Config] Failed to fetch remote project configuration` errors during build/dev are expected when using a placeholder WalletConnect project ID. The app still works for browsing agents.

### Testing notes

- There are no automated test suites (no jest/vitest/playwright config). Validation is done via `npm run lint`, `npm run type-check`, and `npm run build`.
- Web3 features (staking, registering agents) require a real wallet and WalletConnect project ID — these cannot be fully tested in a headless cloud environment.
