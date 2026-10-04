import { expect } from "vitest";

/*
 * Compares two large binary buffers fast.
 *
 * `expect(a).toEqual(b)` walks a typed array element by element through Vitest's generic deep
 * equality: a core's 8 MB memory image takes seconds per comparison, and a 100K-pixel picture
 * compared every frame for 100 frames takes as long. Under CI's load those tests ran past the 30 s
 * test timeout although nothing was wrong. This compares the raw bytes (`Buffer.compare`) and, when
 * they differ, fails with the lengths and the first differing offset - more useful than a diff of
 * millions of elements.
 */

/** The bytes of a typed array (its own bytes only, not the whole underlying buffer) */
function bytesOf(view: ArrayBufferView): Buffer {
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
}

/** The first offset where `a` and `b` differ, or -1 when they are equal */
export function firstByteDifference(a: ArrayBufferView, b: ArrayBufferView): number {
  const x = bytesOf(a);
  const y = bytesOf(b);
  if (x.length === y.length && x.equals(y)) return -1;
  const length = Math.min(x.length, y.length);
  for (let i = 0; i < length; i++) {
    if (x[i] !== y[i]) return i;
  }
  return length;
}

/**
 * Asserts that two typed arrays hold the same bytes
 * @param actual The value under test
 * @param expected The expected value
 * @param what What is compared, for the failure message
 */
export function expectSameBytes(actual: ArrayBufferView, expected: ArrayBufferView, what = "the bytes"): void {
  const at = firstByteDifference(actual, expected);
  if (at < 0) return;
  const a = bytesOf(actual);
  const e = bytesOf(expected);
  const show = (b: Buffer) => (at < b.length ? `$${b[at].toString(16).padStart(2, "0")}` : "(end)");
  expect.fail(
    `${what} differ at byte offset ${at} (0x${at.toString(16)}): ${show(a)} instead of ${show(e)}` +
      ` (lengths ${a.length} and ${e.length})`
  );
}
