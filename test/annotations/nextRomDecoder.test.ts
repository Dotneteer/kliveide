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

/*
 * NextZXOS's pages 0-2 follow restarts and ROM-to-ROM stub calls with inline data, each page in its own
 * way (`nextzxos-disassembler.ts`): the listing must step over it.
 */
const ROM = new Uint8Array(readFileSync(join(__dirname, "../../src/public/roms/enNextZX.rom")));
const page = (n: number) => ROM.subarray(n * 0x4000, (n + 1) * 0x4000);
const starts = async (kind: "next-os0" | "next-os1" | "next-os2", n: number, from: number, to: number) =>
  (await romDecoderFor(kind)(page(n), from, to)).map((i) => [i.offset, i.length]);

describe("NextZXOS's inline data", () => {
  it("page 0: RST $28 is followed by a ROM 3 address (RST $10 is RST $28 + $0010)", async () => {
    expect(await starts("next-os0", 0, 0x0010, 0x0016)).toEqual([[0x0010, 1], [0x0011, 2], [0x0013, 1], [0x0014, 3]]);
  });

  it("page 1: RST $08 is followed by an error code, RST $28 and the DivMMC calls by an address", async () => {
    // --- $0DAD: RST $28 / DEFW $5B5D, then DEC A
    expect(await starts("next-os1", 1, 0x0dad, 0x0db0)).toEqual([[0x0dad, 1], [0x0dae, 2], [0x0db0, 1]]);
    // --- $00A8: RST $08 / DEFB $13, then DEC B
    // --- $2BA3: RST $00 / DEFW $01D2 (a ROM 2 address)
    expect(await starts("next-os1", 1, 0x2ba3, 0x2ba4)).toEqual([[0x2ba3, 1], [0x2ba4, 2]]);
    // --- $1995: CALL $08EF / DEFB $1D (an error code), then the next routine at $1999
    expect(await starts("next-os1", 1, 0x1995, 0x1998)).toEqual([[0x1995, 3], [0x1998, 1]]);
    // --- $0059: CALL $26CB / DEFW $299C (an address in the DivMMC's memory) / RET
    expect(await starts("next-os1", 1, 0x0059, 0x005e)).toEqual([[0x0059, 3], [0x005c, 2], [0x005e, 1]]);
    expect(await starts("next-os1", 1, 0x00a8, 0x00aa)).toEqual([[0x00a8, 1], [0x00a9, 1], [0x00aa, 1]]);
  });

  it("page 2: RST $08 is followed by a byte and a word", async () => {
    // --- $0068: RST $08 / DEFB $01 / DEFW $04DD / RET
    expect(await starts("next-os2", 2, 0x0068, 0x006c)).toEqual([[0x0068, 1], [0x0069, 1], [0x006a, 2], [0x006c, 1]]);
  });

  it("decodes no inline data on another kind", async () => {
    expect(await starts("next-os2", 1, 0x0dad, 0x0db0)).toEqual([[0x0dad, 1], [0x0dae, 1], [0x0daf, 1], [0x0db0, 1]]);
  });
});
