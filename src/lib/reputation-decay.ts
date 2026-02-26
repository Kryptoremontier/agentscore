// src/lib/reputation-decay.ts

// ─── Configuration ───

export const REPUTATION_CONFIG = {
  HALF_LIFE_DAYS: 90,      // sygnał traci połowę wagi co 90 dni
  MIN_WEIGHT: 0.01,         // poniżej tego sygnał jest ignorowany
  FRESHNESS_BONUS: 1.5,     // sygnały z ostatnich 7 dni mają bonus 1.5x
  FRESHNESS_WINDOW_DAYS: 7,
} as const;

// ─── Decay Function ───

/**
 * Oblicza wagę sygnału na podstawie jego wieku.
 * Nowe sygnały mają wagę ~1.0 (lub 1.5 z freshness bonus).
 * Sygnał sprzed 90 dni ma wagę ~0.5.
 * Sygnał sprzed 180 dni ma wagę ~0.25.
 */
export function decayWeight(signalTimestamp: number | string | Date): number {
  const signalTime = new Date(signalTimestamp).getTime();
  const now = Date.now();
  const ageMs = now - signalTime;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays < 0) return 1; // przyszły timestamp — traktuj jako świeży

  // Freshness bonus dla bardzo nowych sygnałów
  if (ageDays <= REPUTATION_CONFIG.FRESHNESS_WINDOW_DAYS) {
    const freshnessFactor = 1 + (REPUTATION_CONFIG.FRESHNESS_BONUS - 1) *
      (1 - ageDays / REPUTATION_CONFIG.FRESHNESS_WINDOW_DAYS);
    return freshnessFactor;
  }

  // Exponential decay po okresie freshness
  const weight = Math.pow(0.5, ageDays / REPUTATION_CONFIG.HALF_LIFE_DAYS);
  return weight < REPUTATION_CONFIG.MIN_WEIGHT ? 0 : weight;
}

// ─── Weighted Trust Ratio ───

export interface WeightedTrustResult {
  weightedSupport: number;
  weightedOppose: number;
  weightedRatio: number;       // 0-100
  rawRatio: number;            // 0-100 (bez decay, dla porównania)
  decayImpact: number;         // różnica między raw a weighted (może być + lub -)
  freshSignalsCount: number;   // ile sygnałów z ostatnich 7 dni
  totalSignalsCount: number;
}

export function calculateWeightedTrust(
  signals: Array<{
    timestamp: string | number | Date;
    side: 'support' | 'oppose';
    amount: number;
  }>
): WeightedTrustResult {
  let weightedSupport = 0;
  let weightedOppose = 0;
  let rawSupport = 0;
  let rawOppose = 0;
  let freshSignalsCount = 0;

  for (const signal of signals) {
    const weight = decayWeight(signal.timestamp);
    const amount = signal.amount;

    if (signal.side === 'support') {
      weightedSupport += amount * weight;
      rawSupport += amount;
    } else {
      weightedOppose += amount * weight;
      rawOppose += amount;
    }

    const ageDays = (Date.now() - new Date(signal.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays <= REPUTATION_CONFIG.FRESHNESS_WINDOW_DAYS) {
      freshSignalsCount++;
    }
  }

  const weightedTotal = weightedSupport + weightedOppose;
  const rawTotal = rawSupport + rawOppose;

  const weightedRatio = weightedTotal > 0 ? (weightedSupport / weightedTotal) * 100 : 50;
  const rawRatio = rawTotal > 0 ? (rawSupport / rawTotal) * 100 : 50;

  return {
    weightedSupport,
    weightedOppose,
    weightedRatio: Math.round(weightedRatio * 100) / 100,
    rawRatio: Math.round(rawRatio * 100) / 100,
    decayImpact: Math.round((weightedRatio - rawRatio) * 100) / 100,
    freshSignalsCount,
    totalSignalsCount: signals.length,
  };
}

// ─── Decay Visualization Data ───

/**
 * Generuje dane do wykresu pokazującego jak decay wpływa na trust score w czasie.
 */
export function generateDecayCurveData(
  daysRange: number = 365,
  points: number = 50
): Array<{ day: number; weight: number }> {
  const step = daysRange / points;
  const data = [];
  for (let d = 0; d <= daysRange; d += step) {
    const weight = Math.pow(0.5, d / REPUTATION_CONFIG.HALF_LIFE_DAYS);
    data.push({
      day: Math.round(d),
      weight: Math.round(weight * 1000) / 1000,
    });
  }
  return data;
}
