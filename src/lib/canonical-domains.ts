/**
 * Canonical Domain Registry — single source of truth for the attest picker.
 * ──────────────────────────────────────────────────────────────────────────
 * The 8 canonical domain buckets of the AgentScore taxonomy, with everything
 * needed to attest against them on-chain:
 *
 *  - `termId`  — deterministic atom id: keccak-derived from the EXACT data
 *    bytes (`payload`), so the SAME payload minted on any Intuition network
 *    yields the SAME term_id. All 8 exist on MAINNET; on TESTNET only
 *    Social + Entertainment are minted (verified 8 Jul 2026) — the rest are
 *    created on first attest from `payload` (create-if-missing).
 *  - `payload` — exact atom data string recovered from the mainnet atoms
 *    (`atom.data`): an ipfs:// URI pointing to the rich Thing JSON.
 *    DO NOT edit — any byte change breaks the term_id (unit-tested).
 *  - `emoji` / `color` — UI hints for the attest picker.
 *
 * Curator provenance: buckets minted by 0x665e3192… (first 3) and community
 * curators (see project memory: canonical domain taxonomy).
 *
 * TODO (post-merge, not done): `domain-aliases.ts` still defines its own
 * overlapping bucket list (`CANONICAL_DOMAINS`) instead of importing this
 * registry. NOT a trivial swap — the shapes have diverged:
 *   - `CanonicalDomain` (domain-aliases.ts) carries a `status:
 *     'canonical' | 'pending_canonical'` axis and allows `termId: null`;
 *     `skill-domain-map.test.ts` asserts exactly that (Agriculture/Energy/
 *     Safety → status 'pending_canonical', termId null).
 *   - `CanonicalDomainDef` (this file) has no `status` field and all 8
 *     term_ids populated (Agriculture/Energy/Safety were minted on mainnet
 *     14 Jun — see project memory), because this registry answers a
 *     different question (attest-picker: mint-if-missing on testnet) than
 *     domain-aliases answers (category-fold: is there a reusable atom at all).
 * Unifying requires either adding a status axis here or reworking the
 * pending_canonical tests in skill-domain-map — do that as its own change,
 * not folded into a merge.
 */

export interface CanonicalDomainDef {
  /** Display label — matches the on-chain atom label exactly. */
  label: string
  /** Deterministic atom term_id (same on testnet + mainnet for this payload). */
  termId: `0x${string}`
  /** Exact atom data bytes (UTF-8 string) — hash(payload) === termId. */
  payload: string
  /** UI hint for the attest picker. */
  emoji: string
  /** UI accent color hint. */
  color: string
}

/**
 * The `is skilled in` predicate — the cross-network canonical skill predicate
 * (same term_id on testnet and mainnet; 69 triples on testnet, verified).
 * Payload is the plain-text label.
 */
export const IS_SKILLED_IN: CanonicalDomainDef = {
  label: 'is skilled in',
  termId: '0xe332e7d663cda20970d2e9a9278b6a5be9575c0514379e8574aa61203c549103',
  payload: 'is skilled in',
  emoji: '🔗',
  color: '#8B5CF6',
}

export const CANONICAL_DOMAINS_REGISTRY: readonly CanonicalDomainDef[] = [
  {
    label: 'Crypto / Onchain',
    termId: '0xecc2b1dce5f8269777d9001faa532642691d7038eed3c639f04895ac5b312d42',
    payload: 'ipfs://bafkreigib4dxp6k5b3ld723xpap7cfgwdruipcr4deudf66eizni3jyk4m',
    emoji: '⛓️',
    color: '#C8963C',
  },
  {
    label: 'AI / Coding',
    termId: '0x0caa623ae3f31ffaa9bf4e27acd1c25d1f7fe3a141145fd77c82cd21b4f59226',
    payload: 'ipfs://bafkreicy4ebpm7xs75lzyfom5p42cxkrdsqrwwno25f4ukswr4jer2pski',
    emoji: '🤖',
    color: '#8B5CF6',
  },
  {
    label: 'Knowledge / Productivity',
    termId: '0x8a0e3710014141458ee303a6cc504704ee3da370450d7f5cd5a898186a2f66e4',
    payload: 'ipfs://bafkreia6sn6rohhw4fmgvqwnwbc2nlm5mggbsvgizbgzlyohoipe25ynbu',
    emoji: '📚',
    color: '#2EE6D6',
  },
  {
    label: 'Social',
    termId: '0x9c7db27885e2e35f9a2f674943f61b02f321ea22d91dd48dea6d82647f884a91',
    payload: 'ipfs://bafkreiat5zmk5pbpfddfbxppahslpvijtnzcd3qppp4ju3pamqoazogfxm',
    emoji: '💬',
    color: '#F59E0B',
  },
  {
    label: 'Entertainment',
    termId: '0x4e0095d1e2ecfcdccc5abe6e562c513924fb5cddc35c5974ea45327c842618e6',
    payload: 'ipfs://bafkreidgxwuvrmwzrxby4u3aipjkudr6muavhlfhttpkt6hgwa56yamwju',
    emoji: '🎭',
    color: '#EC4899',
  },
  {
    label: 'Agriculture',
    termId: '0x19c043b6065719f719ceb67cbbb6989d41d69ba81c3c5cc43327ed7a4a135c0e',
    payload: 'ipfs://bafkreieekb3ysrrn32fp5kpv3ih3mpbaujnhgldk7noylr6inyskfimcze',
    emoji: '🌾',
    color: '#10B981',
  },
  {
    label: 'Energy',
    termId: '0xbfac4ea93d9ffa5126ee9a13d97e5fad326a8aeeec33c95d6f93e311b8818968',
    payload: 'ipfs://bafkreibbqn7czoha6xoy3bbvabi55g6ahb5mom6zu7ql7xxtjeavnlzc6e',
    emoji: '⚡',
    color: '#EAB308',
  },
  {
    label: 'Safety / Identity',
    termId: '0xa4f404dee0ff69863e6782150aecf688dc6337659da87a3fa0ff0b3ff5214eaf',
    payload: 'ipfs://bafkreieudnbi6mgdx6glax2xvjheqdi4f33rc3eurl4meo2nxhnz5qubxe',
    emoji: '🛡️',
    color: '#EF4444',
  },
] as const
