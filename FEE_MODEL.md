# AgentScore — Fee Model

## Architecture

All write operations route through the **IntuitionFeeProxy** contract deployed on Intuition Testnet.
Read operations and redemptions go directly to MultiVault (no fee).

## Fee Schedule

| Operation | Fee |
|-----------|-----|
| Agent registration (`createAtom`) | 0.1 tTRUST fixed + 2.5% of deposit |
| Skill registration (`createAtom`) | 0.1 tTRUST fixed + 2.5% of deposit |
| Triple / Claim creation (`createTriple`) | 0.1 tTRUST fixed + 2.5% of deposit |
| Staking Support / Oppose (`deposit`) | 0.1 tTRUST fixed + 2.5% of deposit |
| Redeem / Sell shares | **FREE** — direct MultiVault |
| Reading data (GraphQL, contract reads) | **FREE** |

## Example: Staking 1 tTRUST

| Item | Amount |
|------|--------|
| Deposit to vault | 1.000 tTRUST |
| Percentage fee (2.5%) | 0.025 tTRUST |
| Fixed fee | 0.100 tTRUST |
| **Total you send** | **~1.126 tTRUST** |

## Smart Contracts

| Contract | Address |
|----------|---------|
| FeeProxy | `0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41` |
| MultiVault | `0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91` |
| Fee Recipient | `0x57246adCD446809c4DB1b04046E731954985bea2` |

Explorer links:
- [FeeProxy on Testnet Explorer](https://testnet.explorer.intuition.systems/address/0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41)
- [MultiVault on Testnet Explorer](https://testnet.explorer.intuition.systems/address/0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91)

## Notes on Creator Field

When routing through FeeProxy, the on-chain `creator_id` of atoms/triples will show the FeeProxy address.
**This is expected and confirmed OK by the Intuition Protocol team (Zet).**

What matters is **position ownership** (who holds shares), not who created the atom.
This is consistent with how the entire Intuition ecosystem works — including the mainnet migration
where one deployer script created all atoms, and then deposits set the actual owners.

The AgentScore UI displays "via AgentScore" instead of the raw creator address.
