import { describe, test, expect } from 'vitest'
import { effectiveLabel } from '../api-data'

describe('effectiveLabel', () => {
  test('plain string atom: uses label when data is not JSON', () => {
    expect(effectiveLabel({ label: 'XYZ', data: 'XYZ' })).toBe('XYZ')
  })

  test('schema.org atom: prefers data over short label', () => {
    const data = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Thing',
      name: 'SchemaTest-002',
      description: 'Verifying schema.org Thing on-chain',
    })
    expect(effectiveLabel({ label: 'SchemaTest-002', data })).toBe(data)
  })

  test('legacy custom JSON without @context: prefers data', () => {
    const data = JSON.stringify({ name: 'OPEN CLAW', description: 'Legacy agent' })
    expect(effectiveLabel({ label: 'OPEN CLAW', data })).toBe(data)
  })

  test('label json object placeholder: uses data', () => {
    expect(effectiveLabel({ label: 'json object', data: '{"name":"X"}' })).toBe('{"name":"X"}')
  })
})
