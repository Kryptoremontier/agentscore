/**
 * Mainnet term_ids for all AgentScore predicates and object atoms.
 *
 * These are immutable keccak256 hashes computed from the JSON-LD payload
 * of each atom registered on Base Mainnet via Intuition Protocol.
 *
 * DO NOT edit these values — they are on-chain facts.
 * Source of truth: docs/PREDICATE_INTEGRATION_GUIDE.md (Quick Reference)
 */

export const MAINNET_TERM_IDS = {
  // ─── Canonical Ontology (PR #7 — Intuition Ontology, do not duplicate) ───
  /** "resolved to" — authoritative finality; filter by trusted publisher */
  resolvedTo:  '0x2c76a5344a15f60565878c8657463f0e2fb201eb05158cf41ad77f8b9d084be1',
  /** "related to" — general association (e.g. name atom → metadata atom) */
  relatedTo:   '0xa1fadfcf5e29bd37e048625f1deee9a6374b249fcda4905649a85022c74070ec',
  /** "belongs to" — membership / grouping */
  belongsTo:   '0x3317b232b1d59ae421283a4ce4d8bef0f739574c3a53386d5d8597d4b272d4e8',
  /** "true" object atom — resolution anchor for [Subject] → resolved to → true */
  trueAtom:    '0x4f2874d4ad8b146c86ac84188e86635a794ddbfa4cfc40670a70467e08db36a2',
  /** "false" object atom — resolution anchor for [Subject] → resolved to → false */
  falseAtom:   '0xa8cc267d1c74e7cd83cc8706fc1eb8d732bc5fa3bc4c8f37b2b992a819b9b550',

  // ─── AgentScore Predicates ────────────────────────────────────────────────
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
  /** "Scam" object atom — general fraud category. Distinct from Drainer (wallet-draining) and Phishing (credential theft). */
  scam:           '0x27f33aaa8e3ff821e0eff6fedfec0b20a29164e21848c5f33e736eede13c39ba',
  /** "Spam" object atom — low-value/unsolicited content. Distinct from Sybil (coordinated identity inflation). */
  spam:           '0x6ae6a37850484a61d76ad868c83d1bbe4d6975fa29cd724d7485141a03cde78f',
  /** "Injection" object atom — prompt injection / instruction hijack */
  injection:      '0x8e7674f0813f000a12951d8bf1ea4c8ffac05a2ab5d56fc4f9550a0a19a5887a',
  /** "Phishing" object atom — credential / signature theft via deceptive UI. Distinct from Drainer (post-auth wallet drain). */
  phishing:       '0x17ea05befad2c4ab6dd95a41177a6a0657ea31966c15ceb6939ed63c2c0fe00b',
  /** "Drainer" object atom — wallet-draining contract / approval abuse. Distinct from Phishing (which captures credentials first). */
  drainer:        '0xb695c13188f0a67f36a7d13f21859900bd929a3793b95b9aab574db7b6b36529',
  /** "Honeypot" object atom — contract that accepts deposits but blocks withdrawals */
  honeypot:       '0xfe8368e39da75a1b43d80633d8ea865456713be53e4e61493f43845c89c29e26',
  /** "Exploit" object atom — known vulnerability or active exploit in deployed code */
  exploit:        '0x21d9e43be9d812babe25a7dcf0dafed4552dfd1dca1109b37b07125744eeef7d',
  /** "Sybil" object atom — coordinated multi-identity manipulation. Distinct from Spam (volume) — Sybil is identity inflation. */
  sybil:          '0xc16b37fb39ec7b14ad3309f0192cc8a3bf32a2eaa1195f137f12d515cd591bea',

  // ─── Soft Signals ─────────────────────────────────────────────────────────
  // Two-tier safety signal: `flagged as` is the soft/early-warning predicate.
  // Hierarchy of severity: suspicious < malicious < reported for (hard category).
  // Use `flagged as` when you have a hunch but not enough evidence to commit
  // to a specific Report Object category (Scam, Drainer, Phishing, etc.).
  /** "flagged as" predicate — soft-signal early warning.
      Used as [Subject] flagged as [suspicious/malicious].
      Lower bar than reported for. */
  flaggedAs:      '0x4bc48a76db9b2b59cdbcab3fec1c405e0208210525e6aa9f23aa0354e04e1a51',
  /** "suspicious" object — unverified, worth caution */
  suspicious:     '0xaecfd2369dfe4bc0160b46b8a13dad8e406cc5f183f667af629393ea3241fd0a',
  /** "malicious" object — believed harmful, vector unknown */
  malicious:      '0xa752a727906d11fffb3f00ba239c2db126a499f151972fc997ce8be7c167b5f6',

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
  [MAINNET_TERM_IDS.phishing]:  'Phishing',
  [MAINNET_TERM_IDS.drainer]:   'Drainer',
  [MAINNET_TERM_IDS.honeypot]:  'Honeypot',
  [MAINNET_TERM_IDS.exploit]:   'Exploit',
  [MAINNET_TERM_IDS.sybil]:     'Sybil',
}
