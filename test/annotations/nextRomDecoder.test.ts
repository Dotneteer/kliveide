import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { romDecoderFor } from "@renderer/appIde/annotations/romDecoder";

/*
 * The Next's ROM pages use the Z80N's extra opcodes, so their listing decodes them; other ROMs do not.
 * NextZXOS's ROM 3 (enNextZX.rom page 3) has `NEXTREG $51,$FF` ($ED $91 $51 $FF) at $090C.
 */
const ROM3 = new Uint8Array(readFileSync(join(__dirname, "../../src/public/roms/enNextZX.rom"))).subarray(0xc000, 0x10000);

describe("the Next's ROM decoding", () => {
  it("decodes NEXTREG n,n as one four-byte instruction on a next-basic page", async () => {
    const decoded = await romDecoderFor("next-basic")(ROM3, 0x090c, 0x090f);
    expect(decoded.map((i) => [i.offset, i.length])).toEqual([[0x090c, 4]]);
  });

  it("does not decode it on a 48K page, where $ED $91 is no instruction", async () => {
    const decoded = await romDecoderFor("sp48-basic")(ROM3, 0x090c, 0x090f);
    expect(decoded[0]).toMatchObject({ offset: 0x090c, length: 2 });
  });
});
