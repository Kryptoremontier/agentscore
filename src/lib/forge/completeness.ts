import { COMPLETENESS_WEIGHTS } from './constants'
import type { ForgeProject, ForgeProjectRegistrationInput } from './types'

export interface ForgeCompletenessResult {
  percentage: number
  completedFields: string[]
  missingFields: string[]
  suggestions: string[]
}

type ProjectInput = Partial<ForgeProject> | ForgeProjectRegistrationInput

export function calculateForgeCompleteness(project: ProjectInput): ForgeCompletenessResult {
  const w = COMPLETENESS_WEIGHTS
  const p = project as Record<string, unknown>

  const fields: { name: string; weight: number; filled: boolean; suggestion: string }[] = [
    { name: 'name',        weight: w.name,        filled: !!p.name,                          suggestion: 'Add project name' },
    { name: 'tagline',     weight: w.tagline,      filled: !!p.tagline,                       suggestion: 'Add a short tagline' },
    { name: 'description', weight: w.description,  filled: !!p.description,                   suggestion: 'Add a description' },
    { name: 'category',    weight: w.category,     filled: !!p.category,                      suggestion: 'Select a category' },
    { name: 'stage',       weight: w.stage,        filled: !!p.stage,                         suggestion: 'Set project stage' },
    { name: 'website',     weight: w.website,      filled: !!p.website,                       suggestion: 'Add website URL' },
    { name: 'github',      weight: w.github,       filled: !!p.github,                        suggestion: 'Add GitHub repo — builds source credibility' },
    { name: 'twitter',     weight: w.twitter,      filled: !!p.twitter,                       suggestion: 'Add Twitter/X handle' },
    { name: 'discord',     weight: w.discord,      filled: !!p.discord,                       suggestion: 'Add Discord server' },
    { name: 'demo',        weight: w.demo,         filled: !!p.demo,                          suggestion: 'Add live demo URL — proves it works' },
    { name: 'teamSize',    weight: w.teamSize,     filled: !!p.teamSize,                      suggestion: 'Add team size' },
    { name: 'techStack',   weight: w.techStack,    filled: ((p.techStack as string[])?.length || 0) > 0, suggestion: 'Add tech stack tags' },
    { name: 'isOpenSource',weight: w.isOpenSource, filled: p.isOpenSource === true,           suggestion: 'Mark as open source' },
    { name: 'usesFeeProxy',weight: w.usesFeeProxy, filled: p.usesFeeProxy === true,           suggestion: 'Integrate FeeProxy for monetization' },
    { name: 'hasMCPServer',weight: w.hasMCPServer, filled: p.hasMCPServer === true,           suggestion: 'Add MCP Server for AI agent access' },
    { name: 'hasAPI',      weight: w.hasAPI,       filled: p.hasAPI === true,                 suggestion: 'Add REST API' },
  ]

  const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0)
  const filledWeight = fields.filter(f => f.filled).reduce((sum, f) => sum + f.weight, 0)
  const percentage = Math.min(100, Math.round((filledWeight / totalWeight) * 100))

  const completedFields = fields.filter(f => f.filled).map(f => f.name)
  const missing = fields.filter(f => !f.filled)
  const missingFields = missing.map(f => f.name)

  const suggestions = missing
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(f => f.suggestion)

  return { percentage, completedFields, missingFields, suggestions }
}
