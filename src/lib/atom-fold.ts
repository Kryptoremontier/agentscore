/**
 * Atom Fold — shared dual-resolution helper for the "duplicate atom, same
 * label, different term_id" footgun that recurs across the OASF/testnet
 * canon (thesis §7, mine #4: "never trust a single documented term_id on
 * testnet without verification").
 *
 * Extracted from skill-domain-map.ts's refineSkillTriples, which had this
 * exact grouping/representative-selection logic inlined for skill atoms.
 * Reused as-is by cohort-reader.ts for OASF tag/category atoms — same
 * duplicate-atom shape, different source predicate.
 */

export interface FoldableAtom {
  id: string
  label: string
}

export interface FoldResult {
  /** Case-folded label -> the chosen representative {id, label}. */
  representatives: ReadonlyMap<string, { id: string; label: string }>
  /** Non-representative atom id -> representative atom id (omits identity entries). */
  foldedIds: ReadonlyMap<string, string>
}

/**
 * Group atoms sharing a case-folded label onto one representative atom.
 * Representative = most occurrences in the input; ties broken by an
 * uppercase-first label, then lowest term_id (deterministic, no clock/DB
 * dependency). Folding merges, never drops — every input id resolves to
 * either itself (if representative) or an entry in `foldedIds`.
 */
export function foldDuplicateAtoms(atoms: readonly FoldableAtom[]): FoldResult {
  const groups = new Map<string, Map<string, { label: string; count: number }>>()
  for (const a of atoms) {
    if (!a?.id || !a.label) continue
    const foldKey = a.label.toLowerCase()
    const bucket = groups.get(foldKey) ?? new Map()
    const entry = bucket.get(a.id) ?? { label: a.label, count: 0 }
    entry.count++
    bucket.set(a.id, entry)
    groups.set(foldKey, bucket)
  }

  const representatives = new Map<string, { id: string; label: string }>()
  const foldedIds = new Map<string, string>()
  for (const [foldKey, bucket] of groups) {
    let best: { id: string; label: string; count: number } | null = null
    for (const [id, { label, count }] of bucket) {
      if (
        !best ||
        count > best.count ||
        (count === best.count && isUpperFirst(label) && !isUpperFirst(best.label)) ||
        (count === best.count && isUpperFirst(label) === isUpperFirst(best.label) && id < best.id)
      ) {
        best = { id, label, count }
      }
    }
    representatives.set(foldKey, { id: best!.id, label: best!.label })
    for (const id of bucket.keys()) {
      if (id !== best!.id) foldedIds.set(id, best!.id)
    }
  }

  return { representatives, foldedIds }
}

function isUpperFirst(label: string): boolean {
  const c = label.charAt(0)
  return c !== c.toLowerCase()
}
