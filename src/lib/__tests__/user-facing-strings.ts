/**
 * The strings a person reads, from source (Etap 8a): string literals, template pieces and JSX text,
 * read with the TypeScript parser — never identifiers, imports, class names, test ids, URLs, query
 * params or GraphQL. For the vocabulary guards (trust-vocabulary.test.ts).
 * Not a test file (no `.test.ts`), so vitest doesn't collect it.
 */
import ts from 'typescript'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

export interface UiString { file: string; line: number; text: string }

/** Attributes whose value is code, not words. */
const CODE_ATTRS = new Set(['className', 'data-testid', 'data-state', 'data-term', 'data-step', 'data-seal', 'href', 'key', 'id', 'htmlFor', 'name', 'value', 'src', 'role', 'type', 'target', 'rel', 'aria-controls', 'aria-describedby', 'method', 'action'])

export function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f)
    if (statSync(p).isDirectory()) return f === '__tests__' || f.startsWith('.') ? [] : sourceFiles(p)
    return /\.(ts|tsx)$/.test(f) ? [p] : []
  })
}

export function uiStrings(file: string): UiString[] {
  const src = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out: UiString[] = []
  const visit = (n: ts.Node) => {
    let text: string | null = null
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) text = n.text
    else if (n.kind === ts.SyntaxKind.TemplateHead || n.kind === ts.SyntaxKind.TemplateMiddle || n.kind === ts.SyntaxKind.TemplateTail) text = (n as ts.TemplateLiteralLikeNode).text
    else if (ts.isJsxText(n)) text = n.text.trim() ? n.text : null
    if (text != null && !isCode(n, text, sf)) {
      out.push({ file, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, text: text.replace(/\s+/g, ' ').trim() })
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

function isCode(n: ts.Node, text: string, sf: ts.SourceFile): boolean {
  const p = n.parent
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || ts.isCaseClause(p) || ts.isElementAccessExpression(p)) return true
  if (ts.isCallExpression(p) && /^(import|require)$/.test(p.expression.getText(sf))) return true
  if (ts.isPropertyAssignment(p) && p.name === n) return true
  if (ts.isJsxAttribute(p) && CODE_ATTRS.has(p.name.getText(sf))) return true
  if (ts.isPropertyAssignment(p) && /^(id|key|href|testId|className|value|kind|status|type|origin|sort|tier)$/.test(p.name.getText(sf))) return true
  if (ts.isBinaryExpression(p) && /^(===|!==|==|!=)$/.test(p.operatorToken.getText(sf))) return true
  if (ts.isCallExpression(p) && /console\.\w+$|\.(get|has|set|includes|startsWith|endsWith|getItem|setItem|getByTestId|querySelector)$/.test(p.expression.getText(sf))) return true
  // A single identifier-like token (an enum value, a key, a sort id, a test id) or a path is not prose.
  if (/^[A-Za-z0-9_$-]+$/.test(text) && !/\s/.test(text) && !/^[A-Z][a-z]+$/.test(text)) return true
  if (/^[/#?]|^https?:/.test(text)) return true
  if (/\bquery \w+|_eq\b|_in:|order_by/.test(text)) return true
  return false
}
