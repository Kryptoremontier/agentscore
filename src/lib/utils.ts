// Utility function to convert string agent ID to BigInt atomId
// This is a temporary solution for mock data - in production,
// atomIds should be retrieved from the Intuition Protocol
export function agentIdToAtomId(agentId: string): bigint {
  // Simple hash function to convert string to number
  let hash = 0
  for (let i = 0; i < agentId.length; i++) {
    const char = agentId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  // Ensure positive number
  return BigInt(Math.abs(hash))
}

// Format bigint values for display
export function formatBigInt(value: bigint, decimals: number = 18): string {
  const divisor = BigInt(10 ** decimals)
  const wholePart = value / divisor
  const fractionalPart = value % divisor

  if (fractionalPart === BigInt(0)) {
    return wholePart.toString()
  }

  // Convert fractional part to string with proper padding
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0')
  // Remove trailing zeros
  const trimmed = fractionalStr.replace(/0+$/, '')

  return trimmed.length > 0
    ? `${wholePart}.${trimmed.slice(0, 2)}` // Show max 2 decimal places
    : wholePart.toString()
}