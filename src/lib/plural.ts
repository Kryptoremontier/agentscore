/**
 * The one pluralisation helper (Etap 5b): "1 person vouching", never "1 Attesters". Tiny on
 * purpose — any surface can import it without pulling in a data module.
 */

/** The word for n: "agent" / "agents". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many
}

/** "1 agent" / "273 agents". */
export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${plural(n, one, many)}`
}
