# AgentScore — Fee Model (Hybrid)

> **Status:** Active on Intuition Testnet (Chain ID 13579)
> **Contract:** IntuitionFeeProxy `0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41`
> **Fee recipient:** `0x57246adCD446809c4DB1b04046E731954985bea2`

---

## Overview

AgentScore uses a **hybrid fee model**:

- **Registration (createAtom, createTriple)** — goes directly through Intuition MultiVault SDK. No platform fee. The registering wallet becomes the on-chain creator (`msg.sender` = user).
- **Staking (deposit)** — routes through IntuitionFeeProxy. Platform fee collected atomically. Shares credited to user via `receiver` parameter.
- **Redeem/withdraw** — direct MultiVault. No proxy, no platform fee.

**Why hybrid?** `createAtom` records `msg.sender` as the creator. Routing through FeeProxy would set the proxy address as creator instead of the user, breaking ownership in Intuition Portal and our app.

---

## Fee Schedule

### Agent / Skill Registration

```
Registration goes directly through Intuition MultiVault SDK.
No platform fee is charged.
The registering wallet becomes the creator of the on-chain Atom.
Cost: ~0.002 tTRUST (Intuition protocol fee + initial deposit)
Transactions: 1 TX (MetaMask confirmation)
```

### Triple Creation

```
Triple creation goes directly through Intuition MultiVault SDK.
No platform fee is charged.
Cost: ~0.002 tTRUST (Intuition protocol fee)
Transactions: 1 TX
```

### Staking (Trust / Distrust signals)

Fee parameters are read from the FeeProxy contract on-chain. Admin can update via `setDepositFixedFee()` / `setDepositPercentageFee()`.

| Fee type | Amount |
|----------|--------|
| Fixed fee per deposit | Configured on-chain (contract: `depositFixedFee()`) |
| Percentage fee | Configured on-chain (contract: `depositPercentageFee()`) |

```
Staking routes through FeeProxy contract.
Platform fee: 0.001 tTRUST fixed + 2.5% of deposit amount.
Shares are correctly credited to the user's wallet (receiver parameter).
First-time users need one additional approve TX (one-time, cached).
Transactions: 1 TX (or 2 TX first time with approve)

Example: Stake 1 tTRUST
- User sends: 1.026 tTRUST
- Platform fee: 0.026 tTRUST -> feeRecipient
- Deposited: 1.0 tTRUST -> MultiVault (shares to user)
```

Formula:
```
totalCost = depositAmount + (depositAmount * bps / 10000) + fixedFee
```

### Redeem / Withdraw

```
Redeem goes directly through MultiVault. No proxy. No platform fee.
```

---

## User Approval (One-Time)

Before the first staking operation, each user must approve the proxy on MultiVault:

```
MultiVault.approve(FEE_PROXY_ADDRESS, 1)  // 1 = DEPOSIT approval type
```

This is a one-time transaction per wallet. The frontend handles it automatically (cached in localStorage after first approval). Not required for registration or triple creation (those bypass the proxy).

---

## Transaction Flow

### Registration (any user)

```
1. SDK.createAtomFromString(config, label, deposit) -> MultiVault.createAtoms()
   -> msg.sender = user -> creator_id = user
   -> No platform fee
```

### Triple Creation (any user)

```
1. MultiVault.createTriples(subjectIds, predicateIds, objectIds, assets)
   -> msg.sender = user -> creator_id = user
   -> No platform fee
```

### Staking (any user)

```
1. [one-time] MultiVault.approve(FeeProxy, DEPOSIT)
2. FeeProxy.deposit(receiver=user, vaultId, curveId, minShares) { value: deposit+fee }
   -> FeeProxy takes fee -> feeRecipient
   -> FeeProxy forwards rest -> MultiVault.deposit(receiver=user, ...)
   -> Shares credited to user
```

### Redeem (any user)

```
1. MultiVault.redeem(receiver, vaultId, curveId, shares, minAssets) <- direct, no proxy
```

---

## Technical Implementation

### FeeProxy Contract

- **Source:** `/d/VIBE-CODING/FEE_PROXY/src/IntuitionFeeProxy.sol`
- **Template:** [0xIntuition/Intuition-Fee-Proxy-Template](https://github.com/0xIntuition/Intuition-Fee-Proxy-Template)
- **Immutable:** `ethMultiVault` address
- **Mutable (admin only):** `depositFixedFee`, `depositPercentageFee`, `feeRecipient`

### Frontend Integration

- `src/lib/intuition.ts`:
  - `createAgentAtom()` / `createSkillAtom()` / `createSimpleAtom()` -> SDK `createAtomFromString()` (direct)
  - `createAccountAtom()` -> SDK `createAtomFromEthereumAccount()` (direct)
  - `createTriple()` -> MultiVault.createTriples() (direct)
  - `depositToVault()` -> FeeProxy.deposit() (with fee)
  - `redeemFromVault()` -> MultiVault.redeem() (direct)
  - `ensureFeeProxyApproved()` -> MultiVault.approve() (one-time, for staking only)
  - `getFeeConfig()` -> reads fee params from contract (cached)
  - `getFeeBreakdown()` -> calculates fee breakdown for staking UI

### Admin Functions

Only `whitelistedAdmins` can call:

```solidity
FeeProxy.setFeeRecipient(address newRecipient)
FeeProxy.setDepositFixedFee(uint256 newFee)       // in wei
FeeProxy.setDepositPercentageFee(uint256 newFee)  // base 10000, e.g. 250 = 2.5%
FeeProxy.setWhitelistedAdmin(address admin, bool status)
```

---

## Mainnet Considerations

- `feeRecipient` should be changed to a multisig (Gnosis Safe) before mainnet
- Fee amounts should be reviewed and set via admin functions
- Approval flow is production-ready (one-time per user, only needed for staking)
