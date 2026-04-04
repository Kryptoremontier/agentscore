import { describe, test, expect } from 'vitest'
import {
  calculateProfileCompleteness,
  parseAgentCard,
  serializeAgentCard,
  type AgentCardData,
} from '../agent-card'

describe('calculateProfileCompleteness', () => {
  test('name only = 10%', () => {
    const result = calculateProfileCompleteness({ name: 'TestAgent' })
    expect(result.percentage).toBe(10)
    expect(result.isA2AReady).toBe(false)
  })

  test('full profile = 100%', () => {
    const full: AgentCardData = {
      name: 'CodeBuddy',
      description: 'AI assistant',
      category: 'developer-tools',
      skills: ['code-review'],
      endpoints: {
        api:     'https://api.example.com',
        mcp:     'https://mcp.example.com',
        a2aCard: 'https://example.com/.well-known/agent.json',
        website: 'https://example.com',
        docs:    'https://docs.example.com',
      },
      source: {
        github:  'github.com/org/repo',
        version: 'v1.0.0',
        license: 'MIT',
      },
      social: {
        twitter: '@test',
        discord: 'discord.gg/test',
      },
    }
    const result = calculateProfileCompleteness(full)
    expect(result.percentage).toBe(100)
    expect(result.isA2AReady).toBe(true)
    expect(result.missingFields).toHaveLength(0)
  })

  test('A2A ready requires endpoint + skill', () => {
    const withEndpointOnly: AgentCardData = {
      name: 'Test',
      endpoints: { api: 'https://api.test.com' },
    }
    expect(calculateProfileCompleteness(withEndpointOnly).isA2AReady).toBe(false)

    const withSkillOnly: AgentCardData = {
      name: 'Test',
      skills: ['coding'],
    }
    expect(calculateProfileCompleteness(withSkillOnly).isA2AReady).toBe(false)

    const withBoth: AgentCardData = {
      name: 'Test',
      skills: ['coding'],
      endpoints: { mcp: 'https://mcp.test.com' },
    }
    expect(calculateProfileCompleteness(withBoth).isA2AReady).toBe(true)
  })

  test('missing fields suggests next actions', () => {
    const partial: AgentCardData = {
      name: 'Test',
      description: 'A test agent',
    }
    const result = calculateProfileCompleteness(partial)
    expect(result.missingFields).toContain('skills')
    expect(result.missingFields).toContain('github')
    expect(result.completedFields).toContain('name')
    expect(result.completedFields).toContain('description')
  })

  test('mcp endpoint counts as A2A endpoint', () => {
    const withMcp: AgentCardData = {
      name: 'Test',
      skills: ['coding'],
      endpoints: { mcp: 'https://mcp.test.com' },
    }
    expect(calculateProfileCompleteness(withMcp).isA2AReady).toBe(true)
  })

  test('empty skills array = not filled', () => {
    const result = calculateProfileCompleteness({ name: 'Test', skills: [] })
    expect(result.missingFields).toContain('skills')
  })
})

describe('parseAgentCard', () => {
  test('parses JSON atom label', () => {
    const json = JSON.stringify({
      name: 'Test',
      description: 'Hello',
      category: 'developer-tools',
    })
    const card = parseAgentCard(json)
    expect(card.name).toBe('Test')
    expect(card.description).toBe('Hello')
    expect(card.category).toBe('developer-tools')
  })

  test('parses JSON with nested objects', () => {
    const json = JSON.stringify({
      name: 'CodeBuddy',
      endpoints: { api: 'https://api.codebuddy.ai', mcp: 'https://mcp.codebuddy.ai' },
      source: { github: 'github.com/dev/codebuddy', version: 'v2.1.0' },
      social: { twitter: '@codebuddy' },
    })
    const card = parseAgentCard(json)
    expect(card.name).toBe('CodeBuddy')
    expect(card.endpoints?.api).toBe('https://api.codebuddy.ai')
    expect(card.source?.github).toBe('github.com/dev/codebuddy')
    expect(card.social?.twitter).toBe('@codebuddy')
  })

  test('handles plain string label (backward compat)', () => {
    const card = parseAgentCard('OldAgent')
    expect(card.name).toBe('OldAgent')
  })

  test('handles "Name - description" plain format', () => {
    const card = parseAgentCard('CodeHelper - Helps with code review and debugging')
    expect(card.name).toBe('CodeHelper')
    expect(card.description).toBe('Helps with code review and debugging')
  })

  test('handles Agent: prefix in plain format', () => {
    const card = parseAgentCard('Agent:Legacy - Old style agent')
    expect(card.name).toBe('Legacy')
  })

  test('handles malformed JSON gracefully', () => {
    const card = parseAgentCard('{broken json')
    expect(card.name).toBe('{broken json')
  })

  test('handles JSON without name field as plain string', () => {
    const card = parseAgentCard('{"foo": "bar"}')
    // no .name field → treated as plain string
    expect(card.name).toBe('{"foo": "bar"}')
  })
})

describe('serializeAgentCard', () => {
  test('serializes to valid JSON', () => {
    const card: AgentCardData = {
      name: 'TestAgent',
      description: 'A test agent',
    }
    const json = serializeAgentCard(card)
    const parsed = JSON.parse(json)
    expect(parsed.name).toBe('TestAgent')
    expect(parsed.description).toBe('A test agent')
  })

  test('omits empty/undefined fields', () => {
    const card: AgentCardData = {
      name: 'TestAgent',
      description: undefined,
      endpoints: {},
      social: { twitter: '' },
    }
    const json = serializeAgentCard(card)
    const parsed = JSON.parse(json)
    expect(parsed.description).toBeUndefined()
    expect(parsed.endpoints).toBeUndefined()
    expect(parsed.social).toBeUndefined()
  })

  test('roundtrip: serialize → parse', () => {
    const original: AgentCardData = {
      name: 'CodeBuddy',
      description: 'AI code review',
      category: 'developer-tools',
      endpoints: { api: 'https://api.test.com' },
      source: { github: 'github.com/test/repo', version: 'v1.0.0' },
    }
    const json   = serializeAgentCard(original)
    const parsed = parseAgentCard(json)
    expect(parsed.name).toBe(original.name)
    expect(parsed.description).toBe(original.description)
    expect(parsed.category).toBe(original.category)
    expect(parsed.endpoints?.api).toBe(original.endpoints?.api)
    expect(parsed.source?.github).toBe(original.source?.github)
  })
})
