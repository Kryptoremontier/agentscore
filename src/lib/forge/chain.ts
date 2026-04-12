/**
 * IntuForge client-side chain helpers.
 *
 * Re-exports registerForgeProjectBatch from intuition.ts — the canonical
 * 2-tx registration flow (Tx1: batch atoms, Tx2: batch triples).
 */

export { registerForgeProjectBatch } from '@/lib/intuition'
