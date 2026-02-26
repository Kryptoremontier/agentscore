'use client';

export function EarlySupporterBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        fontSize: '10px',
        fontWeight: 600,
        padding: '1px 6px',
        borderRadius: '4px',
        background: 'rgba(245, 158, 11, 0.15)',
        color: '#f59e0b',
        border: '1px solid rgba(245, 158, 11, 0.3)',
      }}>
        🥇 First
      </span>
    );
  }

  if (rank <= 3) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        fontSize: '10px',
        fontWeight: 600,
        padding: '1px 6px',
        borderRadius: '4px',
        background: 'rgba(168, 162, 158, 0.15)',
        color: '#a8a29e',
        border: '1px solid rgba(168, 162, 158, 0.3)',
      }}>
        🏅 #{rank}
      </span>
    );
  }

  if (rank <= 10) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        fontSize: '10px',
        fontWeight: 600,
        padding: '1px 6px',
        borderRadius: '4px',
        background: 'rgba(99, 102, 241, 0.12)',
        color: '#818cf8',
        border: '1px solid rgba(99, 102, 241, 0.25)',
      }}>
        Early
      </span>
    );
  }

  return null;
}
