# AgentScore — Fee Model

> **Status:** Live on Intuition Testnet (Chain ID 13579)
> **Contract:** IntuitionFeeProxy `0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41`
> **Fee recipient:** `0x57246adCD446809c4DB1b04046E731954985bea2`

---

## Philosophy

Registration is free — we don't charge to list an agent. Platform revenue comes from staking activity, which is where real economic signal is created. This aligns incentives: we earn when the ecosystem is actively used, not just when someone signs up.

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

Every deposit into an agent's or skill's vault is routed through `IntuitionFeeProxy`:

| Fee type | Amount |
|----------|--------|
| Fixed fee per deposit | **0.1 tTRUST** |
| Percentage fee | **2.5%** of deposit amount |
| **Example: stake 1 tTRUST** | user sends ~1.126 tTRUST, 1 tTRUST reaches vault |

**Formula (what user sends):**
```
totalValue = depositAmount × 1.025 + 0.1 tTRUST
```

The fixed + percentage fee is sent to `feeRecipient` atomically in the same transaction. The remaining amount is forwarded to MultiVault as the actual stake.

---

## Transaction Flow

### First-time user (new wallet)

```
1. MultiVault.approve(FeeProxy, DEPOSIT)   ← one-time, cached in localStorage
2. FeeProxy.deposit(receiver, vaultId, ...) ← fee collected + stake recorded
```

2 MetaMask confirmations. After this, every subsequent stake is 1 confirmation.

### Returning user

```
1. FeeProxy.deposit(receiver, vaultId, ...) ← fee collected + stake recorded
```

1 MetaMask confirmation.

### Registration (any user)

```
1. MultiVault.createAtoms(data, assets)    ← SDK direct call, user is creator
```

1 MetaMask confirmation. No platform fee.

---

## Revenue Projections (Testnet Reference)

| Scenario | Stakes/day | Avg stake | Daily revenue |
|----------|-----------|-----------|---------------|
| Early traction | 50 | 1 tTRUST | ~7.25 tTRUST |
| Growth | 500 | 2 tTRUST | ~145 tTRUST |
| Scale | 5,000 | 5 tTRUST | ~1,812 tTRUST |

Revenue = `n × (0.1 + deposit × 0.025)`

---

## Technical Implementation

### FeeProxy Contract

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

- `src/lib/intuition.ts` — `depositToVault()`, `ensureFeeProxyApproved()`
- `calcFeeProxyValue(depositAmount)` — calculates exact `msg.value` to send
- Approval cached per wallet in `localStorage` under key `agentscore_feeproxy_approved_0x...`

---

## Why Not Charge on Registration?

1. **Lower friction for early adopters** — 1 TX to register vs 2-3 TX
2. **User is atom creator** — registration via SDK means `creator_id = user address`, visible in Intuition Portal on mainnet
3. **Aligned incentives** — if someone registers an agent, they'll stake on it anyway (that's how Trust Score gets built)
4. **Industry standard** — most DeFi protocols charge on transactions, not on account creation

---

## Mainnet Considerations

- Same FeeProxy pattern applies on Intuition Mainnet
- `feeRecipient` should be changed to a multisig before mainnet launch
- Fee amounts may be adjusted via `setDepositFixedFee` / `setDepositPercentageFee`
- Consider lowering fixed fee on mainnet where tTRUST has real value
