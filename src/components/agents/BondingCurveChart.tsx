'use client'

/**
 * One bonding curve in the agent modal (support or oppose): price over supply, the vault's point
 * on it, and the on-chain price when it is known. Its own module (Etap 7a) so recharts — ~290 kB
 * with its dependencies — loads only when a modal opens (app/agents/agents-client.tsx, next/dynamic),
 * not with the /agents list. Drawn inside the caller's fixed-height box: nothing moves when it lands.
 */

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts'
import { generateCurveData } from '@/lib/bonding-curve'

export function BondingCurveChart({ supply, price, color, gradientId, onChainPrice }: {
  supply: number
  /** The curve's price at `supply` — the dot. */
  price: number
  color: string
  gradientId: string
  /** The vault's on-chain price, drawn as a dashed line when known (support side). */
  onChainPrice?: number | null
}) {
  const data = generateCurveData(supply)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={color} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <XAxis dataKey="supply" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          contentStyle={{ backgroundColor: '#161b22', border: '1px solid #21262d', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#8b949e' }}
          formatter={(value: any) => [`${Number(value).toFixed(4)} tTRUST`, 'Price']}
          labelFormatter={(label: any) => `Supply: ${label}`}
        />
        <Area type="monotone" dataKey="price" stroke={color} fillOpacity={1} fill={`url(#${gradientId})`} strokeWidth={2} />
        {supply > 0 && (
          <ReferenceDot x={parseFloat(supply.toFixed(4))} y={parseFloat(price.toFixed(6))} r={5} fill={color} stroke="#fff" strokeWidth={2} />
        )}
        {onChainPrice && supply > 0 && (
          <ReferenceLine y={onChainPrice} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} label={{ value: 'On-chain', fill: '#f59e0b', fontSize: 9, position: 'right' }} />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}
