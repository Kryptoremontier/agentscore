# Changing the FeeProxy fee

For the owner: how to set the fixed fee to 0 (and keep the 2.5%) during the Beta, how to check it,
and how to undo it. You sign the change yourself, in your own wallet. Nothing in this repository
signs, sends or holds a key.

Everything below was read from the chain on 2026-11-22 (Intuition Testnet, chain 13579, block
9,379,103). The admin wallet below is the app's known admin wallet (`ADMIN_WALLET` in
`src/lib/constants.ts`), so you can make the change yourself.

## Why

Every trust is a deposit through the FeeProxy, which adds a fixed fee and a percentage fee. On the
default trust of 0.04 tTRUST that is 0.02 + 0.001: the fixed fee is half of what the person puts
behind the agent. Trusting an agent is the rarest action in the product, and the fixed fee is a tax
on it.

| A default trust (0.04 tTRUST) | Fixed fee | 2.5% | Total, plus gas |
|---|---|---|---|
| Today | 0.02 | 0.001 | 0.061 tTRUST |
| After this change | 0 | 0.001 | 0.041 tTRUST |

## What the contract is

| | |
|---|---|
| FeeProxy | `0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41` |
| Kind | Not upgradeable (both EIP-1967 slots are empty). From the Intuition Fee Proxy template. |
| Who can change fees | `whitelistedAdmins(address)`. No `owner()`, no roles. |
| Admins | `0x139219107C1eBE569f543C581b3B807Cf6740006` (the admin wallet) and `0x57246adCD446809c4DB1b04046E731954985bea2` (the fee recipient). Both were whitelisted in the deployment transaction (`AdminWhitelistUpdated` events). No admin has been added or removed since. The deployer, `0xCCA0…A21C`, is not an admin. |
| Anyone else | Reverts with `IntuitionFeeProxy_NotWhitelistedAdmin()` (`0x594ac09d`). |
| Current values | `depositFixedFee` = 20000000000000000 wei (0.02 tTRUST). `depositPercentageFee` = 250, with `FEE_DENOMINATOR` = 10000 (2.5%). `MAX_FEE_PERCENTAGE` = 10000. |
| Fee recipient | `0x57246adCD446809c4DB1b04046E731954985bea2` |
| History | The fixed fee started at 0.1 tTRUST. The admin wallet lowered it to 0.02 at block 9,034,478 (`DepositFixedFeeUpdated(0.1, 0.02)`, tx `0xbcc405f0…0c2f`). |

### The setters

| Function | Selector | Note |
|---|---|---|
| `setDepositFixedFee(uint256 newFee)` | `0xf48371c0` | Wei of tTRUST, charged on every FeeProxy deposit and on each atom or triple it creates. 0 is accepted. |
| `setDepositPercentageFee(uint256 newFee)` | `0x5ce33d4f` | Base 10000 (250 = 2.5%). Above 10000 reverts. |
| `setFeeRecipient(address)` | | Not part of this change. |
| `setWhitelistedAdmin(address, bool)` | | Not part of this change. |

The names and selectors are in the deployed bytecode. The contract source on the explorer was not
checked from here: this session's network can't reach `testnet.explorer.intuition.systems`. If the
explorer shows no "Write contract" tab, the source isn't verified there. Use route B then.

## The change: fixed fee to 0, keep the 2.5%

One transaction, from the admin wallet, on Intuition Testnet. The percentage fee needs no
transaction: it stays at 250.

Simulated from the admin wallet with `eth_call` (read-only, nothing sent): it succeeds and needs
about 31,000 gas, about 0.000003 tTRUST at 0.1 gwei.

### Route A: the explorer

1. Open `https://testnet.explorer.intuition.systems/address/0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41`.
2. Go to **Contract**, then **Write contract**. Connect the admin wallet
   (`0x1392…0006`) on Intuition Testnet.
3. Find `setDepositFixedFee`, enter `0` for `newFee` and press **Write**.
4. Check the wallet window before signing. It should show the FeeProxy address, value 0, and data
   starting with `0xf48371c0`. Sign.

### Route B: the calldata, from any wallet that sends custom hex data

```bash
node --experimental-strip-types scripts/fee-calldata.ts fixed 0 --check
```

It prints the transaction and, with `--check`, reads the current fee and simulates the call from
the admin wallet. It never reads or uses a key and never sends anything.

```
to:    0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41
value: 0
data:  0xf48371c00000000000000000000000000000000000000000000000000000000000000000
```

Send exactly that from the admin wallet on chain 13579.

## Check it afterwards

1. On the explorer, under **Read contract**, `depositFixedFee` reads `0`. Or run
   `node --experimental-strip-types scripts/fee-calldata.ts fixed 0 --check`, which prints
   `depositFixedFee = 0 wei`.
2. The transaction emitted `DepositFixedFeeUpdated(20000000000000000, 0)`.
3. Open the trust dialog on any agent. Within a minute (the app keeps a fee read for 60 s) it shows
   `0.04 tTRUST behind it · fee 0.001 tTRUST · total 0.041 tTRUST, plus gas`. No code change and
   no deploy are needed: the dialog reads the fee from the contract
   (`src/lib/intuition.ts` `getFeeConfig`; tested in `src/lib/__tests__/fee-read.test.ts` with a
   mocked fixed fee of 0).

## Undo it

The same setter, back to 0.02 tTRUST:

```bash
node --experimental-strip-types scripts/fee-calldata.ts undo --check
```

```
to:    0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41
value: 0
data:  0xf48371c000000000000000000000000000000000000000000000000000470de4df820000
```

On the explorer: `setDepositFixedFee` with `20000000000000000`. This was also simulated from the
admin wallet and succeeds.

## What this change does not touch

- The 2.5% percentage fee and the fee recipient.
- The MultiVault's own entry fee: about 1% of each deposit stays in the vault (a 0.01 trust became
  0.0099 in shares). The default trust of 0.04 already allows for it.
- Who the admins are. The fee recipient is an admin too; anyone holding that key can also change the
  fee.
- Mainnet. A mainnet FeeProxy is a separate contract and a separate decision.
