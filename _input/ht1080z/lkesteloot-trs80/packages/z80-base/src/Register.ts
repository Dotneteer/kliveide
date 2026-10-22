
/**
 * All byte registers.
 */
const BYTE_REG_ARRAY = ["a", "f", "b", "c", "d", "e", "h", "l", "ixh", "ixl", "iyh", "iyl", "i", "r"] as const;
const BYTE_REG_SET = new Set(BYTE_REG_ARRAY as readonly string[]);
type ByteReg = typeof BYTE_REG_ARRAY[number];

/**
 * All word registers. Uses the "Prime" suffix instead of an apostrophe so that
 * this can be used as a field name for the RegisterSet class.
 */
const WORD_REG_ARRAY = ["af", "bc", "de", "hl", "afPrime", "bcPrime", "dePrime", "hlPrime",
    "ix", "iy", "sp", "pc"] as const;
const WORD_REG_SET = new Set(WORD_REG_ARRAY as readonly string[]);
type WordReg = typeof WORD_REG_ARRAY[number];

/**
 * Parallel array with apostrophe, for dealing with registers as they appear in assembly language.
 */
const WORD_REG_PRIME_ARRAY = WORD_REG_ARRAY.map((reg) => reg.replace("Prime", "'"));
const WORD_REG_PRIME_SET = new Set(WORD_REG_PRIME_ARRAY);

/**
 * All internal registers.
 */
const INTERNAL_REG_ARRAY = ["memptr", "i", "r", "iff1", "iff2", "im", "halted"] as const;
const INTERNAL_REG_SET = new Set(INTERNAL_REG_ARRAY as readonly string[]);
export type InternalReg = typeof INTERNAL_REG_ARRAY[number];

/**
 * All registers.
 */
export type Register = ByteReg | WordReg | InternalReg;

/**
 * Determine whether a register stores a word. The prime version should use an apostrophe, like hl'.
 */
export function isWordReg(s: string): boolean {
    return WORD_REG_PRIME_SET.has(s.toLowerCase());
}

/**
 * Determine whether a register stores a byte.
 */
export function isByteReg(s: string): boolean {
    return BYTE_REG_SET.has(s.toLowerCase());
}

/**
 * Whether the string can be used as a field of the RegisterSet structure, in its getValue() method.
 */
export function isRegisterSetField(s: string): s is Register {
    return BYTE_REG_SET.has(s) || WORD_REG_SET.has(s) || INTERNAL_REG_SET.has(s);
}
