'use client'

/**
 * DECLARED DOMAINS — Etap 2c chips, extracted into a shared component for
 * both profile surfaces. OASF `has category` edges the agent DECLARES
 * (self-reported), mapped to our buckets. Deliberately secondary to
 * ATTESTED (thesis §7: "has tag {oasf} = what an agent DECLARES;
 * is skilled in + stake = what the community ATTESTS").
 * Renders nothing when there is nothing declared (non-cohort agents).
 */

import { mapOasfToBucket } from '@/lib/oasf-domain-map'

interface DeclaredDomainsProps {
  declaredDomains: string[] | undefined
  className?: string
}

export function DeclaredDomains({ declaredDomains, className }: DeclaredDomainsProps) {
  if (!declaredDomains || declaredDomains.length === 0) return null
  const buckets = [...new Set(declaredDomains.map((slug) => mapOasfToBucket(slug).bucket))]
  return (
    <div className={`bg-[#171A1D] border border-dashed border-[#8B5CF6]/25 rounded-xl p-4 ${className ?? ''}`}>
      <div className="flex items-center gap-2 mb-3">
        <p className="text-[#8B5CF6] text-xs font-semibold uppercase tracking-wider">Declared Domains</p>
        <span className="text-[10px] text-[#7A838D]">— self-declared via OASF, not yet attested</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {buckets.map((bucket) => (
          <span key={bucket} className="text-xs text-[#B5BDC6] bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 px-2.5 py-1 rounded-full">
            {bucket}
          </span>
        ))}
      </div>
    </div>
  )
}
