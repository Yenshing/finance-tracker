import { describe, expect, it } from 'vitest';
import { isExpression, parseAmount, stringifyAmount } from '../src/lib/parseAmount';

describe('parseAmount', () => {
  it('parses plain integers', () => {
    expect(parseAmount('1000')).toBe(1000);
    expect(parseAmount('-500')).toBe(-500);
  });

  it('parses decimals', () => {
    expect(parseAmount('1.5')).toBe(1.5);
    expect(parseAmount('0.000023')).toBeCloseTo(0.000023);
  });

  it('parses thousand separators', () => {
    expect(parseAmount('1,000')).toBe(1000);
    expect(parseAmount('1,234.56')).toBe(1234.56);
  });

  it('evaluates arithmetic expressions', () => {
    expect(parseAmount('500*145+20')).toBe(72520);
    expect(parseAmount('500 * 145 + 20')).toBe(72520);
    expect(parseAmount('(100+50)*145')).toBe(21750);
    expect(parseAmount('100-50/2')).toBe(75);
  });

  it('accepts unicode × and ÷', () => {
    expect(parseAmount('500×145')).toBe(72500);
    expect(parseAmount('1000÷4')).toBe(250);
  });

  it('rejects invalid input', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('1+abc')).toBeNull();
    expect(parseAmount('500*')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('   ')).toBeNull();
  });

  it('rejects non-finite results', () => {
    expect(parseAmount('1/0')).toBeNull();
  });
});

describe('isExpression', () => {
  it('returns false for plain numbers', () => {
    expect(isExpression('1000')).toBe(false);
    expect(isExpression('1,234.56')).toBe(false);
    expect(isExpression('-500')).toBe(false);
    expect(isExpression('')).toBe(false);
  });

  it('returns true for arithmetic strings', () => {
    expect(isExpression('500*145')).toBe(true);
    expect(isExpression('100+50')).toBe(true);
  });
});

describe('stringifyAmount', () => {
  it('keeps integers tidy', () => {
    expect(stringifyAmount(72500)).toBe('72500');
  });
  it('drops trailing zeros', () => {
    expect(stringifyAmount(0.5)).toBe('0.5');
    expect(stringifyAmount(1234.56)).toBe('1234.56');
  });
});
