# AgentScore — Logika Shares, Bonding Curve i Staking

## 1. Architektura Protokołu Intuition

### Vaults (Skarbce)
W protokole Intuition każdy **Atom** i każdy **Triple** ma własny skarbiec (`vault`).
Vault jest identyfikowany przez `term_id` (adres Ethereum, np. `0x1a2b3c...`).

```
Atom (Agent/Skill)
  └── vault_id = atom.term_id          ← Vault FOR (Support)

Triple (Claim)
  ├── vault_id = triple.term_id        ← Vault FOR (Support)
  └── counter_vault_id = triple.counter_term_id  ← Vault AGAINST (Oppose)
```

### Shares vs tTRUST
- **tTRUST** = token wejściowy (ERC-20, płacisz za shares)
- **Shares** = token wyjściowy reprezentujący Twoją pozycję w vaulcie
- Shares są skalowane przez `1e18` (identycznie jak wei → ETH)
  - `"1000000000000000000"` w bazie = 1.0 share
  - UI: `Number(sharesRaw) / 1e18`

---

## 2. Operacje: Buy (Deposit) i Sell (Redeem)

### Buy / Support / Deposit
```
Użytkownik → depositToVault(vaultId, amountTRUST)
           → Smart contract oblicza ile shares wg bonding curve
           → Position: { term_id: vaultId, account_id: userAddress, shares: bigintString }
```

### Sell / Redeem
```
Użytkownik → redeemFromVault(vaultId, sharesToRedeem, recipient)
           → Smart contract oblicza ile tTRUST wg bonding curve
           → Position shares zmniejszają się
```

---

## 3. Bonding Curve — jak działa cena

### Wzór
Używamy krzywej potęgowej: cena = supply^n

```typescript
// src/lib/bonding-curve.ts
calculateBuy(amountTrust: number, supply: number): number   // zwraca ilość shares
calculateSell(shares: number, supply: number): number       // zwraca wartość w tTRUST
getSellProceeds(shares: number, supply: number): number     // zwraca tTRUST za sprzedaż shares
```

**WAŻNE — kolejność argumentów:**
- `calculateBuy(amountTrust, currentSupply)` — pierwszy arg to kwota tTRUST, drugi to supply
- `getSellProceeds(shares, supply)` — pierwszy arg to ilość shares, drugi to supply

### Efekty bonding curve
- Im więcej osób kupi shares → supply rośnie → cena rośnie
- Wcześni kupujący płacą mniej i zyskują więcej przy sprzedaży
- "Price impact" — duży zakup jednorazowo kosztuje więcej niż podzielony na małe transze

---

## 4. Agents — model stakingu

```
Agent (Atom)
  ├── Support/Buy:
  │     depositToVault(agent.term_id, amount)
  │     Position: term_id = agent.term_id
  │
  └── Oppose/Buy:
        depositToVault(agentTriple.counterTermId, amount)
        Position: term_id = agentTriple.counterTermId
```

`agentTriple` = Triple stworzony przez platformę: `[Agent] — [isTrustedBy] — [AgentScore]`
- `agentTriple.termId` = vault FOR Triple'a (nie używany do stakingu oppose)
- `agentTriple.counterTermId` = vault AGAINST (używany do oppose)

---

## 5. Claims — model stakingu

```
Claim (Triple)
  ├── Support/Buy:
  │     depositToVault(claim.term_id, amount)
  │     Position: term_id = claim.term_id
  │
  └── Oppose/Buy:
        depositToVault(claim.counter_term_id, amount)
        Position: term_id = claim.counter_term_id
```

`claim.term_id` i `claim.counter_term_id` są bezpośrednio w danych Triple'a z API.

---

## 6. Jak pobieramy pozycje użytkownika

### Źródło danych: GraphQL API
`https://testnet.intuition.sh/v1/graphql`

Tabela `positions`:
```graphql
positions(where: { term_id: { _eq: $vaultId }, account_id: { _eq: $userAddress } }) {
  shares          # bigint jako string, skalowany 1e18
  curve_id
  updated_at
}
```

**KLUCZOWE:** `account_id` jest przechowywany **lowercase** w API.
Zawsze używaj `address.toLowerCase()` przy zapytaniach!

### Źródło danych: allPositions (niezawodne)
`allPositions` = wszystkie pozycje dla danego vaultu fetched przez `fetchAllPositions(termId, counterTermId)`.

Każda pozycja ma pole `term_id` — można odróżnić support od oppose.

### Deriving userPosition z allPositions (bardziej niezawodne niż osobny fetch):
```typescript
const qAddr = address.toLowerCase()
const forPos = allPositions.find(p =>
  p.account_id?.toLowerCase() === qAddr &&
  p.term_id?.toLowerCase() === claimTriple.termId?.toLowerCase()
)
const agaPos = allPositions.find(p =>
  p.account_id?.toLowerCase() === qAddr &&
  p.term_id?.toLowerCase() === claimTriple.counterTermId?.toLowerCase()
)
```

---

## 7. Tabele GraphQL — co gdzie szukać

| Co szukamy | Tabela | Kluczowe pola |
|---|---|---|
| Pozycje (stan obecny) | `positions` | `account_id`, `term_id`, `shares` |
| Historia transakcji | `signals` | `account_id`, `term_id`, `delta`, `deposit_id`, `redemption_id` |
| Atomy (agenci, skills) | `atoms` | `term_id`, `label`, `vault` |
| Triple (claims) | `triples` | `term_id`, `counter_term_id`, `subject`, `predicate`, `object` |

**Signals vs Positions:**
- `signals` = historia eventów (deposit/redeem) — może pokazywać starą aktywność nawet po sprzedaży
- `positions` = AKTUALNY stan — shares które TERAZ posiadasz
- Attestations/Activity tab używa `signals` → może pokazywać aktywność nawet gdy shares=0
- Sell UI używa `positions` → tylko aktualne shares

---

## 8. Znane pułapki i jak je omijamy

### Pułapka 1: Odwrócone argumenty funkcji bonding curve
```typescript
// BŁĄD:
calculateBuy(supply, amount)
getSellProceeds(supply, shares)

// POPRAWNIE:
calculateBuy(amount, supply)
getSellProceeds(shares, supply)
```

### Pułapka 2: Nieprawidłowe nazwy zmiennych GraphQL
```typescript
// BŁĄD — zmienna w query to $ids ale obiekt ma klucz termIds:
variables: { termIds: [...] }  // query: $ids: [String!]!

// POPRAWNIE:
variables: { ids: [...] }
```

### Pułapka 3: Case sensitivity adresów
```typescript
// Intuition API przechowuje account_id lowercase
// Zawsze normalizuj przed zapytaniem:
const queryAddress = getAddress(userAddress).toLowerCase()
```

### Pułapka 4: Sort enrichedPositions dla EarlySupporterBadge
```typescript
// BŁĄD — descending daje złe rangi (najnowsi = rank 1):
.sort((a, b) => new Date(b.updated_at).getTime() - ...)

// POPRAWNIE — ascending (najstarsi = rank 1 = early supporter):
.sort((a, b) => new Date(a.updated_at).getTime() - ...)
```

### Pułapka 5: Stary Node.js cache po zmianach
```powershell
# Gdy strona "siada" po zmianach — zawsze:
taskkill /f /im node.exe
Remove-Item -Recurse -Force .next
npm run dev
```

---

## 9. Trust Score — jak jest liczony

```
Trust Score (0-100) = f(supportStake, opposeStake)

score = supportStake / (supportStake + opposeStake) × 100
```

Progi:
- 0-20: Untrusted (czerwony)
- 20-40: Skeptical (pomarańczowy)
- 40-60: Neutral (szary)
- 60-80: Trusted (niebieski)
- 80-100: Highly Trusted (zielony)

Patrz: `src/lib/trust-score-engine.ts` i `src/lib/trust-tiers.ts`

---

## 10. Pliki kluczowe

```
src/lib/
  intuition.ts         — depositToVault, redeemFromVault, getVaultSupply
  bonding-curve.ts     — calculateBuy, calculateSell, getSellProceeds, generateCurveData
  trust-score-engine.ts — calculateTrustScoreFromStakes
  trust-tiers.ts       — calculateTier, calculateTierProgress
  composite-trust.ts   — calculateCompositeTrust, SellReason logic
  reputation-decay.ts  — calculateWeightedTrust (time-decayed)

src/app/
  agents/page.tsx      — wzorzec/template dla wszystkich modali
  skills/page.tsx      — analogiczny do agents
  claims/page.tsx      — analogiczny do agents, używa triple term_id jako vault
```
