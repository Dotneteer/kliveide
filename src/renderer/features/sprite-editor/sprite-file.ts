import { t } from "@common/i18n/i18n";
import { type NexSpriteFormat, patternSize } from "@common/zxnext/sprites/spritePatterns";
import { SPRITE_SIZE } from "./sprite-raster";

/**
 * Reading and writing `.spr` files.
 *
 * A `.spr` is a flat sequence of 256-byte patterns, each one a 16x16 sprite of 8-bit palette
 * indices. The previous loader walked it with a `BinaryReader`, whose `readBytes` **throws** at
 * EOF - so a file whose length was not a multiple of 256 threw part-way through the last chunk,
 * `GenericFilePanel` caught it, and the *whole file* was reported invalid, discarding every
 * complete sprite already parsed. A zero-byte file took the opposite path: it parsed "successfully"
 * to an empty list, and the editor then crashed on `Array.from(undefined)`.
 *
 * Both are format questions, not React questions, so they are answered here:
 *
 * - **A partial tail is kept, not fatal.** The complete sprites load, the leftover bytes are
 *   carried in `trailing`, and `serializeSprFile` writes them back - so opening and saving a file
 *   with an odd tail cannot silently truncate it.
 * - **An empty file yields one blank sprite.** The rest of the editor already assumes at least one
 *   sprite exists (Cut is disabled at a count of 1), so establishing that invariant at the parse
 *   boundary removes the whole class of undefined-sprite bugs rather than guarding each one.
 *
 * **4-bit sheets** (`dev/plans/SPRITE_EDITOR_4BIT_PLAN.md`). The same file can hold 128-byte 4-bit
 * patterns: two pixels per byte, the **high nibble on the left** (even x), as the hardware reads them
 * (`spritePatterns.ts`). Nothing in a `.spr` says which format it is, so the caller passes it. The
 * packing happens here and nowhere else: in memory a 4-bit sprite is still 256 pixel values, each
 * 0..15, so every tool, the undo history and the clipboard work on it unchanged.
 */

/** How a `.spr`'s bytes are read: 256-byte 8-bit patterns or 128-byte 4-bit ones. */
export type SprFormat = NexSpriteFormat;

export const DEFAULT_SPR_FORMAT: SprFormat = "8bit";

/** The largest pixel value a format can hold. */
export const maxPixelValue = (format: SprFormat): number => (format === "4bit" ? 0x0f : 0xff);

/**
 * The Next's sprite transparency index at power-on (Next register $4B).
 *
 * This is a **fallback**, not the truth: the running machine's value arrives with the sprite
 * palette via `getPalettedDeviceInfo()`. It exists so the parser and the "new sprite" path have a
 * defined value with no machine attached - and so the constant that used to be eight scattered
 * `0xe3` literals has exactly one home.
 */
export const DEFAULT_SPRITE_TRANSPARENCY = 0xe3;

export type SprParseResult = {
  /** Always at least one sprite. */
  sprites: Uint8Array[];
  /** Bytes after the last complete sprite. Preserved verbatim so a save round-trips them. */
  trailing?: Uint8Array;
  /** Set when the file was not a clean sequence of whole sprites. Not an error; worth surfacing. */
  warning?: string;
  /**
   * The file had no bytes at all, so its one sprite is a placeholder. A format switch replaces it
   * with a blank sprite of the new format instead of reinterpreting it (plan D3).
   */
  empty?: boolean;
};

/** A 16x16 pattern filled with one index (masked to a nibble for a 4-bit sprite). */
export function createEmptySprite(
  fillIndex = DEFAULT_SPRITE_TRANSPARENCY,
  format: SprFormat = DEFAULT_SPR_FORMAT
): Uint8Array {
  return new Uint8Array(SPRITE_SIZE).fill(fillIndex & maxPixelValue(format));
}

/** One pattern's bytes as 256 pixel values. A short 4-bit source leaves the rest of `into` alone. */
function decodePattern(bytes: Uint8Array, format: SprFormat, into: Uint8Array): Uint8Array {
  if (format === "8bit") {
    into.set(bytes.subarray(0, SPRITE_SIZE), 0);
    return into;
  }
  const count = Math.min(bytes.length, SPRITE_SIZE / 2);
  for (let i = 0; i < count; i++) {
    into[2 * i] = bytes[i] >> 4;
    into[2 * i + 1] = bytes[i] & 0x0f;
  }
  return into;
}

/** 256 pixel values as one pattern's bytes. A value too large for 4 bits keeps its low nibble. */
function encodePattern(sprite: Uint8Array, format: SprFormat, out: Uint8Array, at: number): void {
  if (format === "8bit") {
    // A short or over-long entry writes what it can rather than throwing; `set` would throw on
    // an over-long source, and a corrupt in-memory sprite must not be able to fail a save.
    out.set(sprite.subarray(0, SPRITE_SIZE), at);
    return;
  }
  for (let i = 0; i < SPRITE_SIZE / 2; i++) {
    out[at + i] = (((sprite[2 * i] ?? 0) & 0x0f) << 4) | ((sprite[2 * i + 1] ?? 0) & 0x0f);
  }
}

export function parseSprFile(
  contents: Uint8Array,
  fillIndex = DEFAULT_SPRITE_TRANSPARENCY,
  format: SprFormat = DEFAULT_SPR_FORMAT
): SprParseResult {
  const bytes = contents ?? new Uint8Array(0);

  if (bytes.length === 0) {
    return {
      sprites: [createEmptySprite(fillIndex, format)],
      warning: t("panels.spriteEditor.file.empty"),
      empty: true
    };
  }

  const size = patternSize(format);
  const count = Math.floor(bytes.length / size);
  const sprites: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    sprites.push(
      decodePattern(bytes.subarray(i * size, (i + 1) * size), format, new Uint8Array(SPRITE_SIZE))
    );
  }

  const remainder = bytes.length - count * size;
  if (remainder === 0) return { sprites };

  const trailing = new Uint8Array(bytes.subarray(count * size));
  if (sprites.length === 0) {
    // Shorter than a single sprite: pad it out rather than refusing the file.
    const padded = decodePattern(trailing, format, createEmptySprite(fillIndex, format));
    return {
      sprites: [padded],
      warning: t("panels.spriteEditor.file.padded", { count: remainder })
    };
  }

  return {
    sprites,
    trailing,
    warning: t("panels.spriteEditor.file.trailing", { count: remainder })
  };
}

export function serializeSprFile(
  sprites: Uint8Array[],
  trailing?: Uint8Array,
  format: SprFormat = DEFAULT_SPR_FORMAT
): Uint8Array {
  const list = sprites ?? [];
  const size = patternSize(format);
  const tail = trailing?.length ? trailing : undefined;
  const out = new Uint8Array(list.length * size + (tail?.length ?? 0));
  list.forEach((sprite, i) => encodePattern(sprite, format, out, i * size));
  if (tail) out.set(tail, list.length * size);
  return out;
}

/**
 * Read the same sheet in another format (plan D3).
 *
 * The bytes do not change: the sheet is written in the format it was read in and read back in the
 * new one, so one 8-bit sprite becomes two 4-bit patterns and two 4-bit patterns one 8-bit sprite,
 * and switching back gives the original sprites. Bytes after the last whole pattern stay in
 * `trailing`. An `empty` sheet - a file that had no bytes - is not reinterpreted: its placeholder
 * becomes a blank sprite of the new format.
 */
export function reinterpretSprSheet(
  sheet: { sprites: Uint8Array[]; trailing?: Uint8Array; empty?: boolean },
  from: SprFormat,
  to: SprFormat,
  fillIndex = DEFAULT_SPRITE_TRANSPARENCY
): SprParseResult {
  if (sheet.empty) {
    return { sprites: [createEmptySprite(fillIndex, to)], empty: true };
  }
  if (from === to) {
    return { sprites: sheet.sprites, trailing: sheet.trailing };
  }
  const bytes = serializeSprFile(sheet.sprites, sheet.trailing, from);
  const { sprites, trailing, warning } = parseSprFile(bytes, fillIndex, to);
  return { sprites, trailing, warning };
}
