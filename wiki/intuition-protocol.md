# Intuition Protocol

> Decentralized knowledge graph protocol. The foundation everything is built on.

**Mainnet:** Base L2 | **Testnet:** Chain ID 13579 | **Token:** TRUST (1B supply)

---

## Core Primitives

### Atoms
Unique data identifiers. Anything can be an atom: a person, an agent, a skill, a concept, a project.
- Created via MultiVault.createAtom()
- Has vault with bonding curve
- Label can be plain string or JSON

### Triples
Relationships: [Subject] [Predicate] [Object]
- Example: [ChatGPT] [hasAgentSkill] [Code Generation]
- Created via MultiVault.createTriple()
- Has own vault (separate from atom vaults) + counterVault (oppose)

### MultiVault
ERC-1155 + ERC-4626 hybrid managing millions of vaults.
- Bonding curves: early stakers get more shares per TRUST
- currentSharePrice() — live marginal price
- previewDeposit() — exact shares for amount
- previewRedeem() — exact proceeds for shares
- Atom vaults + Triple vaults + Counter vaults

### FeeProxy Pattern
Apps monetize by deploying proxy contracts:
- User calls FeeProxy instead of MultiVault directly
- FeeProxy takes fee → forwards rest to MultiVault
- Fee collected instantly in same transaction
- Our fee: 0.02 tTRUST fixed + 2.5% per deposit
- Registration (createAtom/createTriple) = direct MultiVault (creator = user)
- Redeem = direct MultiVault (free, no proxy)

## Key Stats (Beta)

- 244K participants
- 5.3M transactions
- 5.1M+ attestations

## GraphQL API

Query atoms, triples, positions. Key quirks discovered:
- Uses `term_id` not `id` in some contexts
- Positions fetched separately (not nested in atoms)
- `as_subject_triples` JOIN can timeout on Hasura → use prefix filter instead
- Signals have `created_at` timestamps

## Contracts (Testnet)

| Contract | Address |
|----------|---------|
| MultiVault | 0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91 |
| Our FeeProxy | 0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41 |

## Security

Code4rena audit on v2 contracts (March 2026):
- Trust, WrappedTrust, TrustBonding, ProgressiveCurve, AtomWallet
- Trail of Bits audit (2024) on v1

## Agent Skills

`npx skills add 0xintuition/agent-skills --skill intuition`
Canonical protocol knowledge for Cursor/Claude Code. Installed in both AgentScore and SENSE repos.

## Related

- [[vital-registry]] — official agent registry
- [[sofia-mcp]] — trust computation server
- [[erc-8004]] — agent identity standard
- [[skillgraph]] — upcoming feature
