import { describe, it, expect } from 'vitest'
import { mapOasfToBucket } from '../oasf-domain-map'
import { UNCATEGORIZED } from '../domain-aliases'

describe('mapOasfToBucket — Crypto / Onchain family', () => {
  it.each(['finance_and_business', 'defi', 'trading', 'blockchain', 'smart_contracts', 'crypto_assets'])(
    'maps %s to Crypto / Onchain',
    (slug) => {
      expect(mapOasfToBucket(slug).bucket).toBe('Crypto / Onchain')
    }
  )

  it('maps the one slash-form label observed live (technology/blockchain)', () => {
    expect(mapOasfToBucket('technology/blockchain').bucket).toBe('Crypto / Onchain')
  })
})

describe('mapOasfToBucket — AI / Coding family', () => {
  it.each(['artificial_intelligence', 'software_engineering', 'web_development', 'apis_integration'])(
    'maps %s to AI / Coding',
    (slug) => {
      expect(mapOasfToBucket(slug).bucket).toBe('AI / Coding')
    }
  )
})

describe('mapOasfToBucket — Knowledge / Productivity family', () => {
  it.each(['education', 'e_learning', 'pedagogy', 'analytical_skills/data_analysis'])(
    'maps %s to Knowledge / Productivity',
    (slug) => {
      expect(mapOasfToBucket(slug).bucket).toBe('Knowledge / Productivity')
    }
  )
})

describe('mapOasfToBucket — Agriculture / Energy / Safety families', () => {
  it.each(['agriculture', 'crop_management', 'precision_agriculture'])('maps %s to Agriculture', (slug) => {
    expect(mapOasfToBucket(slug).bucket).toBe('Agriculture')
  })
  it.each(['energy', 'energy_storage', 'oil_and_gas'])('maps %s to Energy', (slug) => {
    expect(mapOasfToBucket(slug).bucket).toBe('Energy')
  })
  it.each(['identity_verification', 'security', 'harmful_content_detection', 'transaction_monitoring'])(
    'maps %s to Safety / Identity',
    (slug) => {
      expect(mapOasfToBucket(slug).bucket).toBe('Safety / Identity')
    }
  )
})

describe('mapOasfToBucket — prefix fallback rules', () => {
  it('falls back on finance_and_business/* prefix for an unseen slug', () => {
    expect(mapOasfToBucket('finance_and_business/insurance').bucket).toBe('Crypto / Onchain')
  })
  it('falls back on technology/* prefix (excluding the blockchain override) for an unseen slug', () => {
    expect(mapOasfToBucket('technology/robotics').bucket).toBe('AI / Coding')
  })
  it('falls back on analytical_skills/* prefix for an unseen slug', () => {
    expect(mapOasfToBucket('analytical_skills/forecasting').bucket).toBe('Knowledge / Productivity')
  })
})

describe('mapOasfToBucket — honesty: unknown labels are surfaced, never forced', () => {
  it('maps a genuinely unrelated slug to UNCATEGORIZED, not a guessed bucket', () => {
    const res = mapOasfToBucket('chain_of_thought')
    expect(res.bucket).toBe(UNCATEGORIZED)
    expect(res.status).toBe('uncategorized')
    expect(res.termId).toBeNull()
  })

  it('maps empty/whitespace input to UNCATEGORIZED without throwing', () => {
    expect(mapOasfToBucket('').bucket).toBe(UNCATEGORIZED)
    expect(mapOasfToBucket('   ').bucket).toBe(UNCATEGORIZED)
  })

  it('is case- and whitespace-insensitive', () => {
    expect(mapOasfToBucket('  DeFi  ').bucket).toBe('Crypto / Onchain')
    expect(mapOasfToBucket('AGRICULTURE').bucket).toBe('Agriculture')
  })

  it('returns a real term_id for canonical-bucket matches', () => {
    const res = mapOasfToBucket('defi')
    expect(res.status).toBe('canonical')
    expect(res.termId).toMatch(/^0x/)
  })
})
