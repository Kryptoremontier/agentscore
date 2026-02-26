// src/lib/trust-tiers.ts

// ─── Tier Definitions ───

export type TrustTier = 'unverified' | 'sandbox' | 'trusted' | 'verified';

export interface TierConfig {
  tier: TrustTier;
  label: string;
  color: string;        // primary color
  bgColor: string;      // background for badges (with alpha)
  borderColor: string;  // border for badges (with alpha)
  icon: string;         // emoji or symbol
  minStakers: number;
  minTotalStake: number;  // w $tTRUST
  minTrustRatio: number;  // 0-100 (procent Support vs total)
  minAgeDays: number;      // dni od rejestracji agenta
  description: string;
}

export const TIER_CONFIGS: TierConfig[] = [
  {
    tier: 'verified',
    label: 'Verified',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    icon: '⭐',
    minStakers: 25,
    minTotalStake: 5.0,
    minTrustRatio: 75,
    minAgeDays: 30,
    description: 'Highly trusted agent with strong community backing',
  },
  {
    tier: 'trusted',
    label: 'Trusted',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
    icon: '✓',
    minStakers: 10,
    minTotalStake: 1.0,
    minTrustRatio: 60,
    minAgeDays: 7,
    description: 'Agent with solid trust signals from multiple stakers',
  },
  {
    tier: 'sandbox',
    label: 'Sandbox',
    color: '#eab308',
    bgColor: 'rgba(234, 179, 8, 0.15)',
    borderColor: 'rgba(234, 179, 8, 0.3)',
    icon: '◐',
    minStakers: 3,
    minTotalStake: 0.1,
    minTrustRatio: 0,
    minAgeDays: 0,
    description: 'New agent with initial trust signals — use with caution',
  },
  {
    tier: 'unverified',
    label: 'Unverified',
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.15)',
    borderColor: 'rgba(107, 114, 128, 0.3)',
    icon: '○',
    minStakers: 0,
    minTotalStake: 0,
    minTrustRatio: 0,
    minAgeDays: 0,
    description: 'New agent — no trust data yet',
  },
];

// ─── Tier Calculation ───

export function calculateTier(
  stakers: number,
  totalStake: number,
  trustRatio: number,
  ageDays: number
): TierConfig {
  for (const config of TIER_CONFIGS) {
    if (
      stakers >= config.minStakers &&
      totalStake >= config.minTotalStake &&
      trustRatio >= config.minTrustRatio &&
      ageDays >= config.minAgeDays
    ) {
      return config;
    }
  }
  return TIER_CONFIGS[TIER_CONFIGS.length - 1];
}

// ─── Progress to Next Tier ───

export interface TierProgress {
  currentTier: TierConfig;
  nextTier: TierConfig | null;  // null jeśli już na max
  progress: {
    stakers: { current: number; required: number; percent: number };
    totalStake: { current: number; required: number; percent: number };
    trustRatio: { current: number; required: number; percent: number };
    ageDays: { current: number; required: number; percent: number };
  };
  overallPercent: number;  // średnia z czterech wymiarów (cap at 100%)
}

export function calculateTierProgress(
  stakers: number,
  totalStake: number,
  trustRatio: number,
  ageDays: number
): TierProgress {
  const currentTier = calculateTier(stakers, totalStake, trustRatio, ageDays);

  // Znajdź następny tier (jeden wyżej)
  const currentIndex = TIER_CONFIGS.findIndex(t => t.tier === currentTier.tier);
  const nextTier = currentIndex > 0 ? TIER_CONFIGS[currentIndex - 1] : null;

  if (!nextTier) {
    return {
      currentTier,
      nextTier: null,
      progress: {
        stakers: { current: stakers, required: currentTier.minStakers, percent: 100 },
        totalStake: { current: totalStake, required: currentTier.minTotalStake, percent: 100 },
        trustRatio: { current: trustRatio, required: currentTier.minTrustRatio, percent: 100 },
        ageDays: { current: ageDays, required: currentTier.minAgeDays, percent: 100 },
      },
      overallPercent: 100,
    };
  }

  const pct = (current: number, required: number) =>
    required === 0 ? 100 : Math.min(100, Math.round((current / required) * 100));

  const progress = {
    stakers: { current: stakers, required: nextTier.minStakers, percent: pct(stakers, nextTier.minStakers) },
    totalStake: { current: totalStake, required: nextTier.minTotalStake, percent: pct(totalStake, nextTier.minTotalStake) },
    trustRatio: { current: trustRatio, required: nextTier.minTrustRatio, percent: pct(trustRatio, nextTier.minTrustRatio) },
    ageDays: { current: ageDays, required: nextTier.minAgeDays, percent: pct(ageDays, nextTier.minAgeDays) },
  };

  const overallPercent = Math.round(
    (progress.stakers.percent + progress.totalStake.percent + progress.trustRatio.percent + progress.ageDays.percent) / 4
  );

  return { currentTier, nextTier, progress, overallPercent };
}

// ─── Age Calculation Helper ───

export function getAgentAgeDays(createdAt: string | number | Date): number {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
