# AgentScore — Fee Model

> **Status:** Live on Intuition Testnet (Chain ID 13579)
> **Contract:** IntuitionFeeProxy `0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41`
> **Fee recipient:** `0x57246adCD446809c4DB1b04046E731954985bea2`

---

## Philosophy

Registration is free — we don't charge to list an agent. Staking goes directly to MultiVault so shares are correctly attributed to the user. Platform revenue via FeeProxy is planned for a future iteration once Intuition exposes a way to route deposits without changing `msg.sender`.

---

## Fee Schedule

### Agent / Skill Registration

| Item | Cost |
|------|------|
| Atom creation (Intuition protocol fee) | ~0.001 tTRUST |
| Initial deposit into vault | 0.001 tTRUST |
| **Platform fee** | **0** |
| **Total** | **~0.002 tTRUST + gas** |

Registration goes directly through Intuition's MultiVault SDK. No platform fee is charged. The registering wallet becomes the `creator` of the on-chain Atom — visible in Intuition Portal and our app.

---

### Staking (Trust / Distrust signals)

Staking currently calls MultiVault directly (no FeeProxy). This ensures shares are credited to the user's wallet.

| Fee type | Amount |
|----------|--------|
| **Platform fee** | **0 (current — direct MultiVault)** |
| MultiVault protocol fee | built into bonding curve |

> **Why not FeeProxy for staking?**
> `MultiVault.deposit()` credits shares to `msg.sender`. When FeeProxy calls it, FeeProxy
> becomes the share owner — the user's funds are locked and trust scores are unaffected.
> FeeProxy would only work if MultiVault exposed a `depositFor(receiver)` variant.

---

## Transaction Flow

### Staking (any user)

```
1. MultiVault.deposit(receiver, vaultId, ...) ← shares go to msg.sender = user ✓
```

1 MetaMask confirmation.

### Registration (any user)

```
1. MultiVault.createAtoms(data, assets)    ← SDK direct call, user is creator
```

1 MetaMask confirmation. No platform fee.

---

## Technical Implementation

### FeeProxy Contract (deployed, not used for staking yet)

- **Source:** `/d/VIBE-CODING/FEE_PROXY/src/IntuitionFeeProxy.sol`
- **Template:** [intuition-box/Fee-Proxy-Template](https://github.com/0xIntuition/intuition-box)
- **Deployed by:** AgentScore team
- **Immutable fields:** `ethMultiVault` address (cannot be changed post-deploy)
- **Mutable fields:** `depositFixedFee`, `depositPercentageFee`, `feeRecipient` (admin only)

### Admin Functions

Only `whitelistedAdmins` can call:

```solidity
FeeProxy.setFeeRecipient(address newRecipient)
FeeProxy.setDepositFixedFee(uint256 newFee)       // in wei
FeeProxy.setDepositPercentageFee(uint256 newFee)  // base 10000, e.g. 250 = 2.5%
FeeProxy.setWhitelistedAdmin(address admin, bool status)
```

### Frontend Integration

- `src/lib/intuition.ts` — `depositToVault()` calls MultiVault directly

---

## Future Fee Model

When Intuition adds a `depositFor(address receiver, ...)` function to MultiVault:

| Fee type | Planned Amount |
|----------|----------------|
| Fixed fee per deposit | 0.1 tTRUST |
| Percentage fee | 2.5% of deposit amount |
| **Example: stake 1 tTRUST** | user sends ~1.126 tTRUST, 1 tTRUST reaches vault |

```
totalValue = depositAmount × 1.025 + 0.1 tTRUST
```

---

## Mainnet Considerations

- FeeProxy pattern ready to activate when MultiVault supports `depositFor`
- `feeRecipient` should be changed to a multisig before mainnet launch
- Fee amounts may be adjusted via `setDepositFixedFee` / `setDepositPercentageFee`
