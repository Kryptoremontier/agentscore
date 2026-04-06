/**
 * IntuForge client-side chain helpers.
 *
 * Thin wrappers over intuition.ts functions — never modifies them.
 * Called from client components (registration form, etc.).
 */

import { parseEther } from 'viem'
import {
  createTriple,
  findOrCreateAtom,
  type WriteConfig,
} from '@/lib/intuition'
import { FORGE_ATOM_PREDICATE, FORGE_TYPE_PREDICATE, FORGE_TYPE_OBJECT } from '@/lib/forge/constants'

const TRIPLE_DEPOSIT = parseEther('0.001')

/**
 * Tag a project atom with [project] [is] [Intuition Project].
 * Fire-and-forget — logs warnings but never throws.
 */
export async function tagForgeProjectType(
  cfg: WriteConfig,
  projectTermId: `0x${string}`,
  onProgress?: (msg: string) => void,
): Promise<void> {
  try {
    onProgress?.('Finding "is" predicate atom…')
    const isPredicateId = await findOrCreateAtom(cfg, FORGE_TYPE_PREDICATE, onProgress)
    onProgress?.('Finding "Intuition Project" atom…')
    const intuitionProjectId = await findOrCreateAtom(cfg, FORGE_TYPE_OBJECT, onProgress)
    onProgress?.('Creating type triple…')
    await createTriple(cfg, projectTermId, isPredicateId, intuitionProjectId, TRIPLE_DEPOSIT)
  } catch (err) {
    console.warn('[tagForgeProjectType] Failed (non-blocking):', err)
  }
}

/**
 * Tag a project atom with [project] [hasForgeCategory] [CategoryLabel].
 * Fire-and-forget — logs warnings but never throws.
 */
export async function tagForgeProjectCategory(
  cfg: WriteConfig,
  projectTermId: `0x${string}`,
  categoryLabel: string,
  onProgress?: (msg: string) => void,
): Promise<void> {
  try {
    onProgress?.('Finding "hasForgeCategory" predicate atom…')
    const predicateId = await findOrCreateAtom(cfg, FORGE_ATOM_PREDICATE, onProgress)
    onProgress?.(`Finding "${categoryLabel}" category atom…`)
    const categoryAtomId = await findOrCreateAtom(cfg, categoryLabel, onProgress)
    onProgress?.('Creating category triple…')
    await createTriple(cfg, projectTermId, predicateId, categoryAtomId, TRIPLE_DEPOSIT)
  } catch (err) {
    console.warn('[tagForgeProjectCategory] Failed (non-blocking):', err)
  }
}
