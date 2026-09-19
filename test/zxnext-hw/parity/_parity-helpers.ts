/*
 * Shared pieces of the cross-core parity tests (catalogue PAR-*).
 */

/** mulberry32: a small seeded PRNG, so a failing seed reproduces exactly. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random integer in [0, n). */
export function pick(rnd: () => number, n: number): number {
  return Math.floor(rnd() * n);
}

export const hex = (v: number, digits = 2) => `$${v.toString(16).padStart(digits, "0")}`;

/**
 * The entries of two equal-length arrays that differ, as `label=ts/wasm` strings - short enough to read
 * in a failure message.
 */
export function differences(
  ts: ArrayLike<number>,
  wasm: ArrayLike<number>,
  label: (i: number) => string,
  limit = 40
): string[] {
  const out: string[] = [];
  const n = Math.max(ts.length, wasm.length);
  for (let i = 0; i < n && out.length < limit; i++) {
    if (ts[i] !== wasm[i]) out.push(`${label(i)}=${ts[i]}/${wasm[i]}`);
  }
  return out;
}
