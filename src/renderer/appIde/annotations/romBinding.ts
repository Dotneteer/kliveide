import type { BankAnnotation } from "./programAnnotations";

/*
 * Byte binding (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §5.3).
 *
 * A shipped ROM sidecar describes the bytes of one ROM. Applied to another — the 128K's ROM 1, which
 * is mostly the 48K ROM; a user's patched 48K ROM; a TC2048 — a label may only name code that is
 * still there. So each label owns a span, from its offset to the next label (or the end of the page),
 * and the label and every comment and operand reference in its span apply only where the span's
 * bytes are identical. A changed routine loses its name rather than being named wrongly (T6).
 *
 * A data region applies when all of its bytes match. Bytes above the first label belong to no label
 * and bind on their own, byte for byte.
 */

export type RomBinding = {
  /** Every page offset whose annotations apply. */
  bound: Set<number>;
  /** The start offsets of the data regions that apply. */
  boundRegions: Set<number>;
  /** How many of the sidecar's labels bound, of how many: `ann-info` reports it (Q7). */
  labelsBound: number;
  labelsTotal: number;
};

/**
 * Bind a sidecar's page against another ROM's bytes.
 *
 * @param bank The sidecar's page
 * @param described The bytes the sidecar was written for
 * @param target The bytes it is being applied to
 */
export function bindRomPage(
  bank: BankAnnotation,
  described: Uint8Array,
  target: Uint8Array
): RomBinding {
  const size = Math.min(described.length, target.length);
  const same = (from: number, to: number): boolean => {
    for (let i = from; i < to; i++) {
      if (i >= size || described[i] !== target[i]) return false;
    }
    return true;
  };

  const bound = new Set<number>();
  const offsets = [...new Set((bank.localLabels ?? []).map((label) => label.value))].sort(
    (a, b) => a - b
  );
  let labelsBound = 0;

  // --- Before the first label: byte by byte
  const firstLabel = offsets.length ? offsets[0] : size;
  for (let i = 0; i < firstLabel && i < size; i++) {
    if (described[i] === target[i]) bound.add(i);
  }

  for (let i = 0; i < offsets.length; i++) {
    const start = offsets[i];
    const end = i + 1 < offsets.length ? offsets[i + 1] : Math.max(size, start + 1);
    if (start >= size || !same(start, Math.min(end, size))) continue;
    for (let at = start; at < end; at++) bound.add(at);
    labelsBound++;
  }

  const boundRegions = new Set<number>();
  for (const region of bank.regions) {
    if (region.type !== "disassemble" && same(region.start, region.end + 1)) boundRegions.add(region.start);
  }

  return {
    bound,
    boundRegions,
    labelsBound,
    labelsTotal: (bank.localLabels ?? []).length
  };
}
