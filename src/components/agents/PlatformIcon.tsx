import type { AgentPlatform } from '@/types/agent'

interface PlatformIconProps {
  id: AgentPlatform | string
  size?: number
  active?: boolean
}

export function PlatformIcon({ id, size = 28, active = false }: PlatformIconProps) {
  const s = size

  const icons: Record<string, React.ReactNode> = {
    mcp: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="mcp-g" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="5" fill="url(#mcp-g)" opacity={active ? 1 : 0.85} />
        <circle cx="16" cy="16" r="7" stroke="url(#mcp-g)" strokeWidth="1.2" fill="none" opacity="0.4" />
        <line x1="16" y1="9" x2="16" y2="3" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <line x1="22" y1="12" x2="27" y2="7" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <line x1="22" y1="20" x2="27" y2="25" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <line x1="16" y1="23" x2="16" y2="29" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <line x1="10" y1="20" x2="5" y2="25" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <line x1="10" y1="12" x2="5" y2="7" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <circle cx="16" cy="3" r="2" fill="#38bdf8" />
        <circle cx="27" cy="7" r="2" fill="#6366f1" />
        <circle cx="27" cy="25" r="2" fill="#818cf8" />
        <circle cx="16" cy="29" r="2" fill="#38bdf8" />
        <circle cx="5" cy="25" r="2" fill="#6366f1" />
        <circle cx="5" cy="7" r="2" fill="#818cf8" />
      </svg>
    ),

    'openai-gpts': (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="oai-g" x1="4" y1="4" x2="28" y2="28">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <path d="M16 3L27 9.5V22.5L16 29L5 22.5V9.5L16 3Z" stroke="url(#oai-g)" strokeWidth="1.5" fill="none" opacity="0.5" />
        <path d="M16 7L23.5 11.5V20.5L16 25L8.5 20.5V11.5L16 7Z" stroke="url(#oai-g)" strokeWidth="1.2" fill="none" opacity="0.3" />
        <circle cx="16" cy="12" r="2" fill="#10b981" />
        <circle cx="12" cy="18" r="1.8" fill="#34d399" opacity="0.8" />
        <circle cx="20" cy="18" r="1.8" fill="#34d399" opacity="0.8" />
        <line x1="16" y1="12" x2="12" y2="18" stroke="#10b981" strokeWidth="1" opacity="0.5" />
        <line x1="16" y1="12" x2="20" y2="18" stroke="#10b981" strokeWidth="1" opacity="0.5" />
        <line x1="12" y1="18" x2="20" y2="18" stroke="#34d399" strokeWidth="1" opacity="0.4" />
      </svg>
    ),

    openclaw: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="oc-g" x1="0" y1="8" x2="32" y2="28">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <path d="M8 8C6 6 4 8 6 12L12 20" stroke="url(#oc-g)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M24 8C26 6 28 8 26 12L20 20" stroke="url(#oc-g)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M16 14V28" stroke="url(#oc-g)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        <path d="M12 20Q16 24 20 20" stroke="#f97316" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="16" cy="10" r="3" stroke="#ef4444" strokeWidth="1.5" fill="none" opacity="0.6" />
        <circle cx="16" cy="10" r="1.2" fill="#f97316" />
      </svg>
    ),

    langchain: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="lc-g" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <rect x="4" y="10" width="10" height="12" rx="5" stroke="url(#lc-g)" strokeWidth="2" fill="none" />
        <rect x="18" y="10" width="10" height="12" rx="5" stroke="url(#lc-g)" strokeWidth="2" fill="none" />
        <line x1="14" y1="16" x2="18" y2="16" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="9" cy="16" r="2" fill="#3b82f6" opacity="0.8" />
        <circle cx="23" cy="16" r="2" fill="#06b6d4" opacity="0.8" />
      </svg>
    ),

    huggingface: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="hf-g" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="17" r="11" stroke="url(#hf-g)" strokeWidth="1.8" fill="none" opacity="0.5" />
        <path d="M11 15C11 13 13 13 13 15" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M19 15C19 13 21 13 21 15" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M11 20Q16 25 21 20" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <circle cx="9" cy="19" r="1.5" fill="#fbbf24" opacity="0.25" />
        <circle cx="23" cy="19" r="1.5" fill="#fbbf24" opacity="0.25" />
      </svg>
    ),

    eliza: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="el-g" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <rect x="7" y="12" width="3" height="14" rx="1" fill="url(#el-g)" opacity="0.7" />
        <rect x="14.5" y="12" width="3" height="14" rx="1" fill="url(#el-g)" opacity="0.85" />
        <rect x="22" y="12" width="3" height="14" rx="1" fill="url(#el-g)" opacity="0.7" />
        <path d="M4 13L16 5L28 13" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <line x1="5" y1="26" x2="27" y2="26" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="9" r="1.5" fill="#c4b5fd" />
      </svg>
    ),

    virtuals: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="vr-g" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <path d="M16 4L28 14L16 28L4 14Z" stroke="url(#vr-g)" strokeWidth="1.5" fill="none" opacity="0.5" />
        <path d="M16 8L24 14L16 24L8 14Z" fill="url(#vr-g)" opacity="0.15" />
        <line x1="4" y1="14" x2="28" y2="14" stroke="#c084fc" strokeWidth="1" opacity="0.4" />
        <line x1="16" y1="4" x2="10" y2="14" stroke="#a855f7" strokeWidth="1" opacity="0.3" />
        <line x1="16" y1="4" x2="22" y2="14" stroke="#a855f7" strokeWidth="1" opacity="0.3" />
        <line x1="10" y1="14" x2="16" y2="28" stroke="#c084fc" strokeWidth="1" opacity="0.3" />
        <line x1="22" y1="14" x2="16" y2="28" stroke="#c084fc" strokeWidth="1" opacity="0.3" />
        <circle cx="16" cy="15" r="2.5" fill="#c084fc" opacity="0.5" />
        <circle cx="16" cy="15" r="1" fill="#e9d5ff" />
      </svg>
    ),

    farcaster: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="fc-g" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <path d="M16 20V28" stroke="url(#fc-g)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M12 28H20" stroke="url(#fc-g)" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 16C18 16 20 14 20 12" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M16 16C14 16 12 14 12 12" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M22 10C22 6 19 4 16 4C13 4 10 6 10 10" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
        <path d="M25 8C25 3.5 21 1 16 1C11 1 7 3.5 7 8" stroke="#6366f1" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.35" />
        <circle cx="16" cy="16" r="2.5" fill="url(#fc-g)" />
      </svg>
    ),

    twitter: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <line x1="7" y1="7" x2="25" y2="25" stroke="#e2e2e8" strokeWidth="3" strokeLinecap="round" />
        <line x1="25" y1="7" x2="7" y2="25" stroke="#e2e2e8" strokeWidth="3" strokeLinecap="round" />
        <rect x="3" y="3" width="26" height="26" rx="6" stroke="#e2e2e8" strokeWidth="1" fill="none" opacity="0.15" />
      </svg>
    ),

    telegram: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="tg-g" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
        <path d="M4 15L28 4L22 28L15 19L4 15Z" fill="url(#tg-g)" opacity="0.2" stroke="url(#tg-g)" strokeWidth="1.5" strokeLinejoin="round" />
        <line x1="15" y1="19" x2="28" y2="4" stroke="#38bdf8" strokeWidth="1" opacity="0.5" />
        <line x1="15" y1="19" x2="18" y2="25" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      </svg>
    ),

    discord: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="dc-g" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <path d="M8 10C6 10 4 12 4 16C4 20 6 24 10 24L12 21H20L22 24C26 24 28 20 28 16C28 12 26 10 24 10" stroke="url(#dc-g)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M8 10Q12 8 16 8Q20 8 24 10" stroke="#818cf8" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <circle cx="12" cy="16" r="2.2" fill="#818cf8" />
        <circle cx="20" cy="16" r="2.2" fill="#6366f1" />
      </svg>
    ),

    custom: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="cu-g" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
        </defs>
        <path d="M22 6C19 4 15 5 14 8L12 13L19 20L24 18C27 17 28 13 26 10" stroke="url(#cu-g)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <line x1="12" y1="13" x2="5" y2="20" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="5" y1="20" x2="7" y2="27" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="21" cy="11" r="2" fill="url(#cu-g)" opacity="0.5" />
        <circle cx="21" cy="11" r="0.8" fill="#94a3b8" />
      </svg>
    ),
  }

  return (
    <div
      style={{
        width: s,
        height: s,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: active ? 'drop-shadow(0 0 6px rgba(99,102,241,0.4))' : 'none',
        transition: 'filter 0.2s ease',
      }}
    >
      {icons[id] || icons.custom}
    </div>
  )
}
