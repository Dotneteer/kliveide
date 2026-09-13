import { describe, it, expect } from "vitest";
import {
  DEFAULT_SPRITE_TRANSPARENCY,
  createEmptySprite,
  parseSprFile,
  serializeSprFile
} from "@renderer/features/sprite-editor/sprite-file";
import { SPRITE_SIZE } from "@renderer/features/sprite-editor/sprite-raster";

/** A file of `count` sprites, each filled with its own index so they are distinguishable. */
const fileOf = (count: number, extra = 0) => {
  const bytes = new Uint8Array(count * SPRITE_SIZE + extra);
  for (let i = 0; i < count; i++) bytes.fill(i + 1, i * SPRITE_SIZE, (i + 1) * SPRITE_SIZE);
  for (let i = 0; i < extra; i++) bytes[count * SPRITE_SIZE + i] = 0xa0 + i;
  return bytes;
};

describe("parseSprFile", () => {
  it("reads a clean file with no warning", () => {
    const result = parseSprFile(fileOf(3));
    expect(result.sprites.length).toBe(3);
    expect(result.warning).toBeUndefined();
    expect(result.trailing).toBeUndefined();
    expect(result.sprites[1].every((v) => v === 2)).toBe(true);
  });

  /*
   * The old loader walked the file with a BinaryReader, whose readBytes THROWS at EOF. A file whose
   * length was not a multiple of 256 threw inside the last chunk, GenericFilePanel caught it, and
   * the whole file was reported invalid - discarding every complete sprite already parsed.
   */
  it("keeps the complete sprites when the file has a partial tail", () => {
    const result = parseSprFile(fileOf(2, 3));
    expect(result.sprites.length).toBe(2);
    expect(result.sprites[0].every((v) => v === 1)).toBe(true);
    expect([...result.trailing!]).toEqual([0xa0, 0xa1, 0xa2]);
    expect(result.warning).toMatch(/trailing/i);
  });

  it("round-trips a partial tail rather than truncating it", () => {
    const original = fileOf(2, 3);
    const { sprites, trailing } = parseSprFile(original);
    expect([...serializeSprFile(sprites, trailing)]).toEqual([...original]);
  });

  /*
   * An empty file used to parse "successfully" to an empty list, after which the grid crashed on
   * Array.from(undefined). The rest of the editor already assumes at least one sprite exists - Cut
   * is disabled at a count of 1 - so the invariant is established here.
   */
  it("yields one blank sprite for an empty file, and says so", () => {
    const result = parseSprFile(new Uint8Array(0));
    expect(result.sprites.length).toBe(1);
    expect(result.sprites[0].every((v) => v === DEFAULT_SPRITE_TRANSPARENCY)).toBe(true);
    expect(result.warning).toMatch(/empty/i);
  });

  it("treats a missing buffer the same as an empty one", () => {
    expect(parseSprFile(undefined as unknown as Uint8Array).sprites.length).toBe(1);
  });

  it("pads a file shorter than a single sprite instead of refusing it", () => {
    const result = parseSprFile(Uint8Array.from([1, 2, 3]));
    expect(result.sprites.length).toBe(1);
    expect([...result.sprites[0].subarray(0, 3)]).toEqual([1, 2, 3]);
    expect(result.sprites[0][3]).toBe(DEFAULT_SPRITE_TRANSPARENCY);
    expect(result.warning).toMatch(/padded/i);
  });

  it("honours a caller-supplied transparency index", () => {
    const result = parseSprFile(new Uint8Array(0), 0x00);
    expect(result.sprites[0].every((v) => v === 0)).toBe(true);
  });

  it("copies rather than aliasing the source buffer", () => {
    const bytes = fileOf(1);
    const { sprites } = parseSprFile(bytes);
    sprites[0][0] = 0xff;
    expect(bytes[0]).toBe(1);
  });
});

describe("serializeSprFile", () => {
  it("is the inverse of parse for a clean file", () => {
    const original = fileOf(4);
    expect([...serializeSprFile(parseSprFile(original).sprites)]).toEqual([...original]);
  });

  it("writes an exact multiple of the sprite size when there is no tail", () => {
    expect(serializeSprFile([createEmptySprite(), createEmptySprite()]).length).toBe(2 * SPRITE_SIZE);
  });

  it("survives a corrupt in-memory sprite rather than failing the save", () => {
    // `set` throws on an over-long source; a bad sprite must not be able to lose the whole file.
    const tooLong = new Uint8Array(SPRITE_SIZE + 10).fill(7);
    const tooShort = new Uint8Array(4).fill(9);
    const out = serializeSprFile([tooLong, tooShort]);
    expect(out.length).toBe(2 * SPRITE_SIZE);
    expect(out[0]).toBe(7);
    expect(out[SPRITE_SIZE]).toBe(9);
  });

  it("handles an empty list", () => {
    expect(serializeSprFile([]).length).toBe(0);
  });
});
