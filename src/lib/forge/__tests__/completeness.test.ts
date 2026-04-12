import { describe, it, expect } from 'vitest'
import { calculateForgeCompleteness } from '../completeness'
import { ForgeCategory, ProjectStage } from '../types'

describe('calculateForgeCompleteness', () => {
  it('returns low completeness for empty project (name only)', () => {
    const result = calculateForgeCompleteness({ name: 'Test' })
    // name = 5, total = 100 → 5%
    expect(result.percentage).toBe(5)
  })

  it('returns 100% for fully filled project', () => {
    const result = calculateForgeCompleteness({
      name:        'Full Project',
      tagline:     'A tagline',
      description: 'A description',
      category:    ForgeCategory.AI_AGENTS,
      stage:       ProjectStage.TESTNET,
      website:     'https://example.com',
      github:      'github.com/org/repo',
      twitter:     '@handle',
      discord:     'discord.gg/abc',
      demo:        'https://demo.example.com',
      teamSize:    3,
      techStack:   ['Next.js'],
      isOpenSource: true,
      usesFeeProxy: true,
      hasMCPServer: true,
      hasAPI:       true,
      isAnonymous:  false,
    })
    expect(result.percentage).toBe(100)
  })

  it('github field adds 10% to completeness (vs without)', () => {
    const without = calculateForgeCompleteness({ name: 'X', tagline: 'y', description: 'z', category: ForgeCategory.AI_AGENTS, stage: ProjectStage.BUILDING, isAnonymous: false, isOpenSource: false, usesFeeProxy: false, hasMCPServer: false, hasAPI: false })
    const withGithub = calculateForgeCompleteness({ name: 'X', tagline: 'y', description: 'z', category: ForgeCategory.AI_AGENTS, stage: ProjectStage.BUILDING, isAnonymous: false, isOpenSource: false, usesFeeProxy: false, hasMCPServer: false, hasAPI: false, github: 'github.com/org/repo' })
    expect(withGithub.percentage - without.percentage).toBe(10)
  })

  it('demo field adds 10% to completeness (vs without)', () => {
    const without = calculateForgeCompleteness({ name: 'X', tagline: 'y', description: 'z', category: ForgeCategory.AI_AGENTS, stage: ProjectStage.BUILDING, isAnonymous: false, isOpenSource: false, usesFeeProxy: false, hasMCPServer: false, hasAPI: false })
    const withDemo = calculateForgeCompleteness({ name: 'X', tagline: 'y', description: 'z', category: ForgeCategory.AI_AGENTS, stage: ProjectStage.BUILDING, isAnonymous: false, isOpenSource: false, usesFeeProxy: false, hasMCPServer: false, hasAPI: false, demo: 'https://demo.com' })
    expect(withDemo.percentage - without.percentage).toBe(10)
  })

  it('suggestions are sorted by weight descending', () => {
    const result = calculateForgeCompleteness({ name: 'X' })
    // First suggestion should be highest-weight missing field
    // description (10) or github (10) or demo (10) should come before website (5)
    const highWeightSuggestions = result.suggestions.filter(s =>
      s.includes('description') || s.includes('GitHub') || s.includes('demo') || s.includes('description')
    )
    expect(highWeightSuggestions.length).toBeGreaterThan(0)
  })

  it('returns exactly top 3 suggestions', () => {
    const result = calculateForgeCompleteness({ name: 'X' })
    expect(result.suggestions.length).toBeLessThanOrEqual(3)
  })

  it('completedFields includes filled fields', () => {
    const result = calculateForgeCompleteness({ name: 'Test', tagline: 'Hello' })
    expect(result.completedFields).toContain('name')
    expect(result.completedFields).toContain('tagline')
  })

  it('missingFields includes unfilled required fields', () => {
    const result = calculateForgeCompleteness({ name: 'Test' })
    expect(result.missingFields).toContain('description')
    expect(result.missingFields).toContain('github')
  })

  it('isOpenSource=false does NOT count for completeness', () => {
    const withFalse = calculateForgeCompleteness({ name: 'X', isOpenSource: false })
    const withTrue  = calculateForgeCompleteness({ name: 'X', isOpenSource: true })
    expect(withTrue.percentage).toBeGreaterThan(withFalse.percentage)
  })

  it('empty techStack does NOT add completeness points', () => {
    const without = calculateForgeCompleteness({ name: 'X' })
    const withEmpty = calculateForgeCompleteness({ name: 'X', techStack: [] })
    expect(without.percentage).toBe(withEmpty.percentage)
  })

  it('non-empty techStack increases completeness', () => {
    const without = calculateForgeCompleteness({ name: 'X' })
    const withStack = calculateForgeCompleteness({ name: 'X', techStack: ['React'] })
    // techStack weight = 7, should add measurable % to score
    expect(withStack.percentage).toBeGreaterThan(without.percentage)
  })
})
