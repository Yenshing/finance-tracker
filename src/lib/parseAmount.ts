/**
 * Parse a user-entered amount that may be a plain number or an arithmetic
 * expression like `500*145+20`. Returns null when the input cannot be
 * resolved to a finite number.
 *
 * The expression evaluator uses `Function()` rather than a hand-written
 * parser. This is safe here because:
 *   - input is whitelisted to digits, basic operators, parens, and a few
 *     unicode aliases via SAFE_EXPR_RE — no identifiers, no statements
 *   - the app is purely client-side; the only "user" running the
 *     expression is the user themselves
 */

const SAFE_EXPR_RE = /^[0-9+\-*/().,\s×÷]+$/;
const PLAIN_NUMBER_RE = /^-?\d+(\.\d+)?$/;

export function parseAmount(input: string): number | null {
  if (input == null) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  const plain = trimmed.replace(/,/g, '');
  if (PLAIN_NUMBER_RE.test(plain)) return Number(plain);

  if (!SAFE_EXPR_RE.test(trimmed)) return null;
  const cleaned = trimmed
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/,/g, '')
    .replace(/\s+/g, '');
  if (!cleaned) return null;

  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`'use strict'; return (${cleaned});`)();
    return typeof result === 'number' && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

export function isExpression(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  if (!trimmed) return false;
  const plain = trimmed.replace(/,/g, '');
  return !PLAIN_NUMBER_RE.test(plain);
}

/** Render a number for editing — no thousand separator, drop trailing zeros. */
export function stringifyAmount(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(8).replace(/\.?0+$/, '');
}
