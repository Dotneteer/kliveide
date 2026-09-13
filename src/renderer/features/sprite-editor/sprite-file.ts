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
 */

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
};

/** A 16x16 pattern filled with one index. */
export function createEmptySprite(fillIndex = DEFAULT_SPRITE_TRANSPARENCY): Uint8Array {
  return new Uint8Array(SPRITE_SIZE).fill(fillIndex & 0xff);
}

export function parseSprFile(
  contents: Uint8Array,
  fillIndex = DEFAULT_SPRITE_TRANSPARENCY
): SprParseResult {
  const bytes = contents ?? new Uint8Array(0);

  if (bytes.length === 0) {
    return {
      sprites: [createEmptySprite(fillIndex)],
      warning: "The file is empty; started with one blank sprite."
    };
  }

  const count = Math.floor(bytes.length / SPRITE_SIZE);
  const sprites: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    sprites.push(new Uint8Array(bytes.subarray(i * SPRITE_SIZE, (i + 1) * SPRITE_SIZE)));
  }

  const remainder = bytes.length - count * SPRITE_SIZE;
  if (remainder === 0) return { sprites };

  const trailing = new Uint8Array(bytes.subarray(count * SPRITE_SIZE));
  if (sprites.length === 0) {
    // Shorter than a single sprite: pad it out rather than refusing the file.
    const padded = createEmptySprite(fillIndex);
    padded.set(trailing, 0);
    return {
      sprites: [padded],
      warning: `The file holds only ${remainder} byte(s); padded to one sprite.`
    };
  }

  return {
    sprites,
    trailing,
    warning:
      `${remainder} trailing byte(s) are not part of a complete sprite. ` +
      `They are preserved and written back unchanged.`
  };
}

export function serializeSprFile(sprites: Uint8Array[], trailing?: Uint8Array): Uint8Array {
  const list = sprites ?? [];
  const tail = trailing?.length ? trailing : undefined;
  const out = new Uint8Array(list.length * SPRITE_SIZE + (tail?.length ?? 0));
  list.forEach((sprite, i) => {
    // A short or over-long entry writes what it can rather than throwing; `set` would throw on
    // an over-long source, and a corrupt in-memory sprite must not be able to fail a save.
    out.set(sprite.subarray(0, SPRITE_SIZE), i * SPRITE_SIZE);
  });
  if (tail) out.set(tail, list.length * SPRITE_SIZE);
  return out;
}
