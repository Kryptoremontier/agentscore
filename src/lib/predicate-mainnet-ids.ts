/**
 * Mainnet term_ids for all AgentScore predicates and object atoms.
 *
 * These are immutable keccak256 hashes computed from the JSON-LD payload
 * of each atom registered on Base Mainnet via Intuition Protocol.
 *
 * DO NOT edit these values — they are on-chain facts.
 * Source of truth: docs/MAINNET_PREDICATES.md (TermID Tracker)
 */

export const MAINNET_TERM_IDS = {
  // ─── Predicates ───────────────────────────────────────────────────────────
  /** "has agent skill" — AgentScore + ecosystem use */
  hasAgentSkill:  '0x638fd866e4564e213a11ebeb98bbaea58e81f677860d90fa4ad01e50bb007108',
  /** "trusts" — REUSE from Intuition Ontology */
  trusts:         '0x3a73f3b1613d166eea141a25a2adc70db9304ab3c4e90daecad05f86487c3ee9',
  /** "opposes" — canonical lowercase counter-vault to trusts */
  opposes:        '0x3ce0f03b579b0b3d2dcbfbbfb7adb0dd00ab2cf3393ab7201518fabae6dc05f7',
  /** "evaluated by" — links subject to evaluator for quality assessment */
  evaluatedBy:    '0xb769bc51460e2dc29927c825f743238174c02901603a0c9604dd2e8ea40f8226',
  /** "reported for" — single predicate, object atom carries the category */
  reportedFor:    '0x51f1febac0b9d05953442f082597c5d1ce827bd2f888446ad811692e0a0f428d',

  // ─── Report Object Atoms ──────────────────────────────────────────────────
  /** "Scam" object atom — used as: [Agent] → reported for → Scam */
  scam:           '0x27f33aaa8e3ff821e0eff6fedfec0b20a29164e21848c5f33e736eede13c39ba',
  /** "Spam" object atom — used as: [Agent] → reported for → Spam */
  spam:           '0x6ae6a37850484a61d76ad868c83d1bbe4d6975fa29cd724d7485141a03cde78f',
  /** "Injection" object atom — used as: [Agent] → reported for → Injection */
  injection:      '0x8e7674f0813f000a12951d8bf1ea4c8ffac05a2ab5d56fc4f9550a0a19a5887a',

  // ─── Identity ─────────────────────────────────────────────────────────────
  /** "same as" — canonical schema.org sameAs identity equivalence primitive */
  sameAs:            '0xbeebfb7d177cbd96ffc239d2196c72ec346efe81f39dc595773f13d83506f5f0',

  // ─── Tag Atom ─────────────────────────────────────────────────────────────
  /** "In Use By AgentScore" — tag applied to all 8 atoms above */
  inUseByAgentScore: '0xed484ed04e06699c7815f18654c0f48f3e3ba32d25bd5d7289c92532b1910b89',
} as const

export type MainnetTermIdKey = keyof typeof MAINNET_TERM_IDS

/**
 * Maps the old testnet ReportCategory to the mainnet object atom term_id.
 * Used by submitReport() on mainnet.
 */
export const REPORT_CATEGORY_TO_MAINNET_OBJECT: Record<string, string> = {
  scam:             MAINNET_TERM_IDS.scam,
  spam:             MAINNET_TERM_IDS.spam,
  prompt_injection: MAINNET_TERM_IDS.injection,
  impersonation:    MAINNET_TERM_IDS.injection, // closest match — no dedicated atom yet
}

/**
 * Maps mainnet object term_id back to a display label.
 * Used by AttestationCard / report rendering on mainnet.
 */
export const MAINNET_REPORT_OBJECT_LABELS: Record<string, string> = {
  [MAINNET_TERM_IDS.scam]:      'Scam',
  [MAINNET_TERM_IDS.spam]:      'Spam',
  [MAINNET_TERM_IDS.injection]: 'Injection',
}
