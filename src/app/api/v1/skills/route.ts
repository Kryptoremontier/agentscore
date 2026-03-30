import { type NextRequest } from 'next/server'
import { apiSuccess, apiError, corsOptions } from '@/lib/api-helpers'
import { getSkills } from '@/lib/api-data'

export async function GET(_request: NextRequest) {
  try {
    const skills = await getSkills()
    return apiSuccess(skills, { total: skills.length })
  } catch (error) {
    console.error('[API] /skills error:', error)
    return apiError('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return corsOptions()
}
