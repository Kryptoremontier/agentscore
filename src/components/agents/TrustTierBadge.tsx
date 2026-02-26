'use client';

import { TierConfig, TierProgress } from '@/lib/trust-tiers';
import { useState } from 'react';

// ─── Simple Badge (do użycia w kartach, listach) ───

export function TrustTierBadge({ tier, size = 'md' }: { tier: TierConfig; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { fontSize: '10px', padding: '1px 6px', iconSize: '10px' },
    md: { fontSize: '11px', padding: '2px 8px', iconSize: '12px' },
    lg: { fontSize: '13px', padding: '4px 12px', iconSize: '14px' },
  };
  const s = sizes[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: s.fontSize,
        fontWeight: 600,
        padding: s.padding,
        borderRadius: '6px',
        background: tier.bgColor,
        color: tier.color,
        border: `1px solid ${tier.borderColor}`,
        letterSpacing: '0.02em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: s.iconSize }}>{tier.icon}</span>
      {tier.label}
    </span>
  );
}

// ─── Badge with Progress Tooltip (do użycia w modalu agenta) ───

export function TrustTierBadgeWithProgress({
  tier,
  progress,
}: {
  tier: TierConfig;
  progress: TierProgress;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        style={{ cursor: 'pointer' }}
      >
        <TrustTierBadge tier={tier} size="md" />
      </div>

      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: '8px',
            width: '280px',
            padding: '16px',
            background: '#1a1a2e',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            zIndex: 1000,
            fontSize: '12px',
            color: '#e2e2e8',
          }}
        >
          {/* Current tier */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
              {tier.icon} {tier.label}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
              {tier.description}
            </div>
          </div>

          {/* Progress to next tier */}
          {progress.nextTier ? (
            <>
              <div style={{
                fontSize: '10px',
                color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '8px',
              }}>
                Progress to {progress.nextTier.icon} {progress.nextTier.label}
              </div>

              <ProgressRow
                label="Stakers"
                current={progress.progress.stakers.current}
                required={progress.progress.stakers.required}
                percent={progress.progress.stakers.percent}
                color={tier.color}
              />
              <ProgressRow
                label="Total Stake"
                current={`${progress.progress.totalStake.current.toFixed(2)} tTRUST`}
                required={`${progress.progress.totalStake.required} tTRUST`}
                percent={progress.progress.totalStake.percent}
                color={tier.color}
              />
              <ProgressRow
                label="Trust Ratio"
                current={`${progress.progress.trustRatio.current.toFixed(0)}%`}
                required={`${progress.progress.trustRatio.required}%`}
                percent={progress.progress.trustRatio.percent}
                color={tier.color}
              />
              <ProgressRow
                label="Age"
                current={`${progress.progress.ageDays.current}d`}
                required={`${progress.progress.ageDays.required}d`}
                percent={progress.progress.ageDays.percent}
                color={tier.color}
              />

              {/* Overall */}
              <div style={{
                marginTop: '10px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>
                  Overall progress
                </span>
                <span style={{ fontWeight: 700, color: tier.color }}>
                  {progress.overallPercent}%
                </span>
              </div>
            </>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
              Maximum tier reached
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Progress Row Helper ───

function ProgressRow({
  label,
  current,
  required,
  percent,
  color,
}: {
  label: string;
  current: string | number;
  required: string | number;
  percent: number;
  color: string;
}) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '3px',
        fontSize: '11px',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
        <span style={{ color: percent >= 100 ? '#22c55e' : 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>
          {current} / {required} {percent >= 100 ? '✓' : ''}
        </span>
      </div>
      <div style={{
        width: '100%',
        height: '4px',
        background: 'rgba(255,255,255,0.06)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(percent, 100)}%`,
          height: '100%',
          background: percent >= 100 ? '#22c55e' : color,
          borderRadius: '2px',
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}
