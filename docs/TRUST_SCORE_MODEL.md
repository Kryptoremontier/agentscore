# Trust Score Model (AgentScore)

Ten dokument opisuje pełną logikę Trust Score dla agentów w skali `0-100`.

## Cel modelu

- Spójny wynik `0-100` dla każdego agenta
- Stabilność przy małej płynności (mały stake)
- Jasne połączenie stakingu `Support/Oppose` oraz akcji `Buy/Sell`
- Ograniczenie manipulacji krótkim impulsem
- Środowiskowo dopasowane parametry (testnet vs mainnet)

## Model końcowy

```
TrustScore = clamp(Anchored + Momentum, 0, 100)
```

---

## 1) Base Score (stan ekspozycji)

`SupportExposure` i `OpposeExposure` liczymy ze stanu vaultów:

- **Support** = atom vault `totalShares` + shares z pozytywnych subject triples (`trusts`, `verified_by`, `vouches_for`)
- **Oppose** = shares z AGAINST vault triple + shares z negatywnych subject triples (`distrusts`, `reported_for_*`)

Wzór:

```
Base = 100 * SupportExposure / (SupportExposure + OpposeExposure)
```

Gdy brak stake:

```
Base = 50
```

### Przykłady Base Score

| Support | Oppose | Base |
|---------|--------|------|
| 0.1     | 0      | 100  |
| 0.08    | 0.02   | 80   |
| 0.05    | 0.05   | 50   |
| 0.02    | 0.08   | 20   |
| 0       | 0.1    | 0    |

---

## 2) Confidence (kotwica do 50 przy niskim TVL)

Przy niskim TVL nie chcemy skoków do skrajnych wartości.
Nowy agent z jednym małym stakiem nie powinien mieć od razu score 100 lub 0.

```
TVL = SupportExposure + OpposeExposure
Confidence = 1 - exp(-TVL / tau)
Anchored = 50 + (Base - 50) * Confidence
```

### Parametr `tau` — środowiskowo dopasowany

| Środowisko | tau | Uzasadnienie |
|------------|-----|-------------|
| **Testnet** | `0.1 tTRUST` | Typowy stake 0.01–1 tTRUST, confidence rośnie szybko |
| **Mainnet** | `50 tTRUST` | Typowy stake 10–1000+ tTRUST, odporność na manipulację |

Kontrolowane przez `process.env.NEXT_PUBLIC_CHAIN_ENV`:
- jeśli `!== 'mainnet'` → testnet tau
- jeśli `=== 'mainnet'` → mainnet tau

### Jak Confidence wpływa na score (testnet, tau = 0.1)

| TVL (tTRUST) | Confidence | Efekt przy Base = 100 | Score |
|--------------|------------|----------------------|-------|
| 0.01         | 10%        | 50 + 50×0.10 = 55    | **55** |
| 0.05         | 39%        | 50 + 50×0.39 = 70    | **70** |
| 0.08         | 55%        | 50 + 50×0.55 = 78    | **78** |
| 0.1          | 63%        | 50 + 50×0.63 = 82    | **82** |
| 0.2          | 86%        | 50 + 50×0.86 = 93    | **93** |
| 0.5          | 99%        | 50 + 50×0.99 = 100   | **100** |

### Jak Confidence wpływa na score (mainnet, tau = 50)

| TVL (tTRUST) | Confidence | Efekt przy Base = 100 | Score |
|--------------|------------|----------------------|-------|
| 1            | 2%         | 50 + 50×0.02 = 51    | **51** |
| 10           | 18%        | 50 + 50×0.18 = 59    | **59** |
| 50           | 63%        | 50 + 50×0.63 = 82    | **82** |
| 100          | 86%        | 50 + 50×0.86 = 93    | **93** |
| 200          | 98%        | 50 + 50×0.98 = 99    | **99** |

---

## 3) Momentum (krótkoterminowy impuls Buy/Sell)

Zdarzenia mają podpisany kierunek:

| Akcja | Kierunek | Efekt na score |
|-------|----------|---------------|
| Buy Support | `+` | podnosi score |
| Sell Support | `-` | obniża score |
| Buy Oppose | `-` | obniża score |
| Sell Oppose | `+` | podnosi score |

Podpisany przepływ:

```
SignedFlow = buySupport - sellSupport - buyOppose + sellOppose
```

Normalizacja i cap:

```
NormalizedFlow = SignedFlow / TVL
RawMomentum = k * NormalizedFlow
MomentumCap = max(minCap, maxCap * Confidence)
Momentum = clamp(RawMomentum, -MomentumCap, +MomentumCap)
```

### Parametry Momentum

| Parametr | Wartość | Opis |
|----------|---------|------|
| `k` (momentumScale) | 30 | Siła reakcji na flow |
| `maxCap` (maxMomentumPoints) | 8 pkt | Maksymalny wpływ momentum na score |
| `minCap` (minMomentumPointsWhenLowLiquidity) | 2 pkt | Cap bezpieczeństwa przy niskim TVL |

### Źródło danych flow

Momentum jest liczone z realnych on-chain eventów `Deposited` / `Redeemed`:

- Okno **24h** — najświeższy sygnał
- Okno **7d** — tło trendu
- **Blend**: `70% (24h) + 30% (7d)`

Implementacja: `src/lib/trust-flow.ts`

---

## 4) Trust Level (kategorie)

| Score | Level | Kolor |
|-------|-------|-------|
| 90–100 | `excellent` | Cyan `#06B6D4` |
| 70–89 | `good` | Green `#22C55E` |
| 50–69 | `moderate` | Yellow `#EAB308` |
| 30–49 | `low` | Orange `#F97316` |
| 0–29 | `critical` | Red `#EF4444` |

---

## 5) Reguły anty-manipulacyjne

- Core score oparty o **stan pozycji** (vault shares), nie eventy
- Momentum ograniczony capem i wygaszany przez niskie Confidence
- Start neutralny: nowe/małe agenty bliżej `50` (dzięki confidence)
- Brak danych flow nie psuje modelu: `Momentum = 0`
- `tau` dopasowane do środowiska: testnet pozwala na szybki feedback, mainnet wymaga realnego zaangażowania

---

## 6) Pełny przykład obliczenia

Agent z `0.08 tTRUST` Support i `0.02 tTRUST` Oppose na testnet:

```
Base = 100 × 0.08 / (0.08 + 0.02) = 80

TVL = 0.08 + 0.02 = 0.10 tTRUST
Confidence = 1 - exp(-0.10 / 0.10) = 1 - exp(-1) = 0.632

Anchored = 50 + (80 - 50) × 0.632 = 50 + 18.97 = 68.97

Momentum = 0 (brak danych flow)

TrustScore = clamp(round(68.97 + 0), 0, 100) = 69
Level = moderate (50–69)
```

---

## Implementacja w repo

### Pliki źródłowe

| Plik | Rola |
|------|------|
| `src/lib/trust-score-engine.ts` | Silnik scoringu (jedyne źródło prawdy) |
| `src/lib/trust-flow.ts` | Pobieranie flow z on-chain logów Deposited/Redeemed |
| `src/lib/transform.ts` | Transformacja GraphQL → Agent (używa silnika) |
| `src/hooks/useTrustScore.ts` | Hook React z pełnym breakdownem (używa silnika + flow) |

### Gdzie wyświetlane

| Miejsce | Dane |
|---------|------|
| Karta agenta (lista) | Score + kolor z `calculateTrustScoreFromStakes()` |
| Modal agenta — Trust Score | Score, Level, Confidence, Momentum z `agentTrust` state |
| Modal agenta — Stake Breakdown | Support/Oppose/Net z `agentTrust` state, bar proporcjonalny |

### Konfiguracja

W `TRUST_SCORE_DEFAULTS` (`src/lib/trust-score-engine.ts`):

```typescript
{
  confidenceTauTtrust: IS_TESTNET ? 0.1 : 50,
  momentumScale: 30,
  maxMomentumPoints: 8,
  minMomentumPointsWhenLowLiquidity: 2,
}
```

Żeby zmienić środowisko na mainnet, ustaw:

```
NEXT_PUBLIC_CHAIN_ENV=mainnet
```

---

## Przyszłe usprawnienia

- [ ] Percentile ranking (porównanie z innymi agentami)
- [ ] Historyczny trend score (wykres 7d/30d)
- [ ] Cap wpływu jednego adresu (max 20% wagi)
- [ ] Limit zmiany score per epoka (max ±10 pkt / 24h)
- [ ] Wygładzanie EMA finalnego score (alpha 0.2)
