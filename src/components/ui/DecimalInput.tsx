'use client'

import { normalizeDecimalInput, trimTrailingDot } from '@/lib/decimal-input'

interface DecimalInputProps {
  value: string
  onChange: (value: string) => void
  max?: string
  placeholder?: string
  className?: string
  onClick?: (e: React.MouseEvent<HTMLInputElement>) => void
}

/**
 * Decimal amount input — replaces native `type="number"`, which renders its
 * value using the OS locale's decimal glyph (e.g. "0,05" on most non-US
 * systems) while app state is always period-decimal. `type="text"
 * inputMode="decimal"` avoids the glyph entirely; normalization/validation
 * lives in decimal-input.ts.
 */
export function DecimalInput({ value, onChange, max, placeholder, className, onClick }: DecimalInputProps) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={(e) => {
        const next = normalizeDecimalInput(e.target.value, { max })
        if (next !== null) onChange(next)
      }}
      onBlur={() => onChange(trimTrailingDot(value))}
      onClick={onClick}
      placeholder={placeholder}
      className={className}
    />
  )
}
