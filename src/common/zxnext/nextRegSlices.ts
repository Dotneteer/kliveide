/*
 * Decoding a NextReg value through its descriptor's `slices`.
 *
 * Shared by the Next Registers panel and the Copper decoder (a Copper MOVE is a NextReg write, and
 * its meaning is the same slice text), so it lives outside both of them.
 *
 * Two shapes in the descriptor data the helpers below deliberately tolerate rather than assume away:
 *
 *  - **`mask` is optional.** Reg $00 (Machine ID) has a single slice with no mask at all, meaning
 *    "the whole byte". Missing therefore reads as `0xFF`, not as zero.
 *  - **`view` cannot be trusted to say what a slice is.** The type offers `"flag" | "number"`, but
 *    only 8 of the 338 slices set it and every one of those says `"number"` — *no* slice in the
 *    table is marked `"flag"`. So a flag is recognised by its mask holding exactly one bit, which is
 *    true of the data as written; `view` is honoured only as an override where it is present.
 */
import type { NextRegValueSlice } from "@emu/machines/zxNext/nextRegDescriptors";

/** The slice's mask; a missing mask is the whole byte. */
export const sliceMask = (slice: NextRegValueSlice) => slice.mask ?? 0xff;

/** The slice's own value: masked out of the register byte and shifted down to bit 0. */
export const sliceValue = (regValue: number, slice: NextRegValueSlice) =>
  (regValue & sliceMask(slice)) >> (slice.shift ?? 0);

/** A single-bit slice is a flag. See the `view` note above for why the mask decides, not `view`. */
export const isFlagSlice = (slice: NextRegValueSlice) => {
  if (slice.view === "number") return false;
  const mask = sliceMask(slice);
  return mask !== 0 && (mask & (mask - 1)) === 0;
};

/** `7` for one bit, `5:0` for a range — the notation the Next documentation itself uses. */
export const sliceBits = (slice: NextRegValueSlice) => {
  const mask = sliceMask(slice);
  const high = 31 - Math.clz32(mask);
  const low = Math.log2(mask & -mask);
  return high === low ? `${high}` : `${high}:${low}`;
};

/**
 * The words for a slice's value: the `valueSet` name where one matches, then the slice's own
 * description. Reg $00 has a `valueSet` and no description, most flags have a description and no
 * `valueSet`, and either may be missing, so this is a join of whatever is actually present.
 */
export const sliceText = (regValue: number, slice: NextRegValueSlice) => {
  const named = slice.valueSet?.[sliceValue(regValue, slice)];
  return [named, slice.description].filter(Boolean).join(" — ");
};
