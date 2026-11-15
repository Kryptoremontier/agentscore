/**
 * One icon per trust context (Etap 8b), drawn as inline SVG wherever it renders (lucide). An unknown
 * label gets the generic tag — never a crash.
 */

import { Link2, Code2, BookOpen, Users, Clapperboard, Sprout, Zap, ShieldCheck, Tag, type LucideIcon } from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  'Crypto / Onchain': Link2,
  'AI / Coding': Code2,
  'Knowledge / Productivity': BookOpen,
  Social: Users,
  Entertainment: Clapperboard,
  Agriculture: Sprout,
  Energy: Zap,
  'Safety / Identity': ShieldCheck,
}

export function ContextIcon({ label, className = 'w-5 h-5' }: { label: string; className?: string }) {
  const Icon = ICONS[label] ?? Tag
  return <Icon aria-hidden className={className} />
}
