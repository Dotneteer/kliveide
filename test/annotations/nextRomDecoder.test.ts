import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { romDecoderFor } from "@renderer/appIde/annotations/romDecoder";

/*
 * The Next's ROM pages use the Z80N's extra opcodes, so their listing decodes them; other ROMs do not.
 * NextZXOS's ROM 3 (enNextZX.rom page 3) has `NEXTREG $51,$FF` ($ED $91 $51 $FF) at $090C.
 */
const ROM3 = new Uint8Array(readFileSync(join(__dirname, "../../src/public/roms/zxnext/nextzxos-2.08/enNextZX.rom"))).subarray(0xc000, 0x10000);

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
const ROM = new Uint8Array(readFileSync(join(__dirname, "../../src/public/roms/zxnext/nextzxos-2.08/enNextZX.rom")));
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

  it("page 2: CALL $3E18 is followed by an alternate ROM address", async () => {
    // --- $1093: CALL $3E18 / DEFW $14A7
    expect(await starts("next-os2", 2, 0x1093, 0x1096)).toEqual([[0x1093, 3], [0x1096, 2]]);
  });

  it("decodes no inline data on another kind", async () => {
    expect(await starts("next-os2", 1, 0x0dad, 0x0db0)).toEqual([[0x0dad, 1], [0x0dae, 1], [0x0daf, 1], [0x0db0, 1]]);
  });
});

describe("the DivMMC and Multiface ROMs' inline data", () => {
  const rom = (file: string) => new Uint8Array(readFileSync(join(__dirname, `../../src/public/roms/zxnext/nextzxos-2.08/${file}`)));
  const at = async (kind: "next-divmmc" | "next-multiface", file: string, from: number, to: number) =>
    (await romDecoderFor(kind)(rom(file), from, to)).map((i) => [i.offset, i.length]);

  it("DivMMC: RST $18 is followed by a word, CALL $04F8 by a field offset", async () => {
    // --- $0010: RST $18 / two bytes / RET
    expect(await at("next-divmmc", "enNxtmmc.rom", 0x0010, 0x0013)).toEqual([[0x0010, 1], [0x0011, 2], [0x0013, 1]]);
    // --- $0A57: CALL $04F8 / DEFB $07 / SCF
    expect(await at("next-divmmc", "enNxtmmc.rom", 0x0a57, 0x0a5b)).toEqual([[0x0a57, 3], [0x0a5a, 1], [0x0a5b, 1]]);
  });

  it("DivMMC: RST $30 is a vector entry, followed by the routine's address", async () => {
    // --- $0103: RST $30 / DEFW $0EDA, then the next entry
    expect(await at("next-divmmc", "enNxtmmc.rom", 0x0103, 0x0106)).toEqual([[0x0103, 1], [0x0104, 2], [0x0106, 1]]);
  });

  it("DivMMC: CALL $041F is followed by a bank and an address, CALL $040D by an address", async () => {
    // --- $0310: CALL $041F / DEFB $0C / DEFW $26E7 / RET
    expect(await at("next-divmmc", "enNxtmmc.rom", 0x0310, 0x0316)).toEqual([[0x0310, 3], [0x0313, 1], [0x0314, 2], [0x0316, 1]]);
    // --- $0262: CALL $0407 / DEFW $1C7B, then $0267
    expect(await at("next-divmmc", "enNxtmmc.rom", 0x0262, 0x0267)).toEqual([[0x0262, 3], [0x0265, 2], [0x0267, 2]]);
    // --- $021D: CALL $040D / DEFW $1BA8 / RET
    expect(await at("next-divmmc", "enNxtmmc.rom", 0x021d, 0x0222)).toEqual([[0x021d, 3], [0x0220, 2], [0x0222, 1]]);
  });

  it("Multiface: RST $10 is followed by an address", async () => {
    // --- $0041: RST $10 / DEFW $2767 / POP HL
    expect(await at("next-multiface", "enNextMf.rom", 0x0041, 0x0044)).toEqual([[0x0041, 1], [0x0042, 2], [0x0044, 1]]);
  });
});

describe("the alternate ROM's inline data", () => {
  const alt = new Uint8Array(readFileSync(join(__dirname, "../../src/public/roms/zxnext/nextzxos-2.08/enAltZX.rom")));
  const at = async (kind: "next-alt0" | "next-alt1", page: number, from: number, to: number) =>
    (await romDecoderFor(kind)(alt.subarray(page * 0x4000, (page + 1) * 0x4000), from, to)).map((i) => [i.offset, i.length]);

  it("page 1: CALL $00BA is followed by a ROM 0 address", async () => {
    // --- $2068: CALL $00BA / DEFW $3C10
    expect(await at("next-alt1", 1, 0x2068, 0x206b)).toEqual([[0x2068, 3], [0x206b, 2]]);
  });
});

/*
 * NextZXOS 2.10 moved three of the routines that take inline data: ROM 1's DivMMC call stubs ($26CB and
 * $26E5 in 2.08 are $26C5 and $26DF), ROM 1's error entry ($08EF's byte-reading part is $08E2) and the
 * Multiface's API call ($1569 is $1572). The page kinds are the same in every ROM set, so the decoder
 * lists every set's addresses; that is right only while no set calls another set's address.
 */
describe("the decoding of every NextZXOS release Klive ships", () => {
  const set = (setId: string, file: string) =>
    new Uint8Array(readFileSync(join(__dirname, `../../src/public/roms/zxnext/${setId}/${file}`)));
  const page210 = (n: number) => set("nextzxos-2.10", "enNextZX.rom").subarray(n * 0x4000, (n + 1) * 0x4000);

  it("2.10 page 1: CALL $26C5 and CALL $26DF are followed by a DivMMC address, CALL $08E2 by an error code", async () => {
    // --- $0059: CALL $26C5 / DEFW $2993 / RET
    expect((await romDecoderFor("next-os1")(page210(1), 0x0059, 0x005e)).map((i) => [i.offset, i.length])).toEqual([
      [0x0059, 3], [0x005c, 2], [0x005e, 1]
    ]);
    // --- $2BD6: CALL $26DF / DEFW $279F / PUSH AF
    expect((await romDecoderFor("next-os1")(page210(1), 0x2bd6, 0x2bdb)).map((i) => [i.offset, i.length])).toEqual([
      [0x2bd6, 3], [0x2bd9, 2], [0x2bdb, 1]
    ]);
    // --- $0E2E: CALL $08E2 / DEFB $FF, then RST $30
    expect((await romDecoderFor("next-os1")(page210(1), 0x0e2e, 0x0e32)).map((i) => [i.offset, i.length])).toEqual([
      [0x0e2e, 3], [0x0e31, 1], [0x0e32, 1]
    ]);
  });

  it("2.10 Multiface: CALL $1572 is followed by an API function byte", async () => {
    // --- $1159: CALL $1572 / DEFB $86 / POP AF
    const mf = set("nextzxos-2.10", "enNextMf.rom");
    expect((await romDecoderFor("next-multiface")(mf, 0x1159, 0x115d)).map((i) => [i.offset, i.length])).toEqual([
      [0x1159, 3], [0x115c, 1], [0x115d, 1]
    ]);
  });

  // --- Each set's own addresses, and the ones only the other set uses
  const MOVED: { file: string; page: number; kind: Parameters<typeof romDecoderFor>[0]; own: Record<string, number[]> }[] = [
    { file: "enNextZX.rom", page: 1, kind: "next-os1", own: { "nextzxos-2.08": [0x08ef, 0x26cb, 0x26e5], "nextzxos-2.10": [0x08e2, 0x26c5, 0x26df] } },
    { file: "enNextMf.rom", page: 0, kind: "next-multiface", own: { "nextzxos-2.08": [0x1569], "nextzxos-2.10": [0x1572] } }
  ];

  for (const { file, page, kind, own } of MOVED) {
    for (const setId of Object.keys(own)) {
      it(`${setId} ${file}: calls only its own set's inline-data routines`, async () => {
        const bytes = set(setId, file).subarray(page * 0x4000, (page + 1) * 0x4000);
        const sidecar = JSON.parse(readFileSync(join(__dirname, `../../src/public/roms/zxnext/${setId}/${file}.dis`), "utf8"));
        const others = Object.entries(own)
          .filter(([id]) => id !== setId)
          .flatMap(([, addresses]) => addresses);
        const called = new Set<number>();
        for (const region of sidecar.banks[String(page)].regions.filter((r: { type: string }) => r.type === "disassemble")) {
          for (const instr of await romDecoderFor(kind)(bytes, region.start, Math.min(region.end, bytes.length - 1))) {
            if (bytes[instr.offset] === 0xcd && instr.length === 3 && instr.target !== undefined) called.add(instr.target);
          }
        }
        expect(own[setId].filter((address) => called.has(address)).length).toBeGreaterThan(0);
        expect(others.filter((address) => called.has(address))).toEqual([]);
      });
    }
  }
});

/*
 * NextZXOS 2.10's alternate ROM page 0 gained `RST $30` + a ROM 2 address ($0030 jumps to $0099, which calls
 * the word's address through $5B43); 2.08's page has no `RST $30` in its code, so the one table serves both.
 */
describe("the alternate ROM page 0's RST $30", () => {
  const alt0 = (setId: string) =>
    new Uint8Array(readFileSync(join(__dirname, `../../src/public/roms/zxnext/${setId}/enAltZX.rom`))).subarray(0, 0x4000);

  it("2.10: RST $30 is followed by a ROM 2 address", async () => {
    // --- $22B4: RST $30 / DEFW (DOS_OPEN's address in ROM 2)
    const decoded = await romDecoderFor("next-alt0")(alt0("nextzxos-2.10"), 0x22b4, 0x22b7);
    expect(decoded.map((i) => [i.offset, i.length])).toEqual([[0x22b4, 1], [0x22b5, 2], [0x22b7, expect.any(Number)]]);
  });

  it("2.08: the page's code has no RST $30", async () => {
    const bytes = alt0("nextzxos-2.08");
    const sidecar = JSON.parse(readFileSync(join(__dirname, "../../src/public/roms/zxnext/nextzxos-2.08/enAltZX.rom.dis"), "utf8"));
    let rst30 = 0;
    for (const region of sidecar.banks["0"].regions.filter((r: { type: string }) => r.type === "disassemble")) {
      for (const instr of await romDecoderFor("next-alt0")(bytes, region.start, region.end)) {
        if (instr.length === 1 && bytes[instr.offset] === 0xf7) rst30++;
      }
    }
    expect(rst30).toBe(0);
  });
});
