import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import { TVC12_TOKENS, TVC22_TOKENS, tvcTokenName } from "@common/tvc/basicTokens";

/*
 * The TVC BASIC token tables (`basicTokens.ts`), decoded from the shipped ROMs.
 */
const romOf = (name: string) => new Uint8Array(readFileSync(join(__dirname, `../../src/public/roms/${name}.rom`)));

/** The words between the table's two FFh entries */
function tableOf(rom: Uint8Array, offset: number): string[] {
  expect(rom[offset]).toBe(0xff);
  const words: string[] = [];
  let word = "";
  for (let i = offset + 1; rom[i] !== 0xff; i++) {
    word += String.fromCharCode(rom[i] & 0x7f);
    if (rom[i] & 0x80) {
      words.push(word);
      word = "";
    }
  }
  return words;
}

describe("TVC BASIC tokens", () => {
  it("are BASIC 1.2's table at DE6Dh", () => {
    expect(tableOf(romOf("tvc12-d4"), 0x1e6d)).toEqual(TVC12_TOKENS);
  });

  it("are BASIC 2.2's table at D73Ah", () => {
    expect(tableOf(romOf("tvc22-d6"), 0x173a)).toEqual(TVC22_TOKENS);
  });

  it("name the tokens the core was seen to store", () => {
    expect(tvcTokenName(0xdd, false)).toBe("PRINT");
    expect(tvcTokenName(0x9a, false)).toBe("=");
    expect(tvcTokenName(0xfd, false)).toBe(":");
    expect(tvcTokenName(0xcf, false)).toBe("!");
    expect(tvcTokenName(0xcf, true)).toBe("AUTO");
    expect(tvcTokenName(0x94, true)).toBeUndefined();
    expect(tvcTokenName(0xff, true)).toBeUndefined();
  });
});
