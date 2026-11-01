import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { alignPages, translateRam } from "@common/reverse/pipeline/align/alignPages";
import { carryPage } from "@common/reverse/pipeline/align/carryPage";
import { imageFromRomPage, romPageBytes } from "@common/reverse/pipeline/image/romImage";
import { decodeBank } from "@common/reverse/pipeline/preprocess/decode";

/*
 * Version alignment (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §4.7, P6): instructions matched between two
 * versions, the stretches, the RAM map, the routine statuses, and a real carry from EXOS 2.1 to 2.0.
 */

const ROMS = join(__dirname, "../../src/public/roms");

async function decoded(bytes: number[]) {
  const image = imageFromRomPage(new Uint8Array(bytes), { name: "t", cpu: "z80" });
  return { image, decoded: await decodeBank(image, "0", { regions: [{ start: 0, end: bytes.length - 1, type: "disassemble" }] }) };
}

describe("alignPages", () => {
  it("finds the stretch, the RAM that moved and each routine's status", async () => {
    // --- old: LD A,($8000); LD A,($8000); RET | INC A; RET
    // --- new: two bytes inserted, the variable at $8005, and the second routine changed to DEC A; DEC A; RET
    const oldCode = [0x3a, 0x00, 0x80, 0x3a, 0x00, 0x80, 0xc9, 0x3c, 0xc9];
    const newCode = [0x00, 0x00, 0x3a, 0x05, 0x80, 0x3a, 0x05, 0x80, 0xc9, 0x3d, 0x3d, 0xc9];
    const before = await decoded(oldCode);
    const after = await decoded(newCode);
    const alignment = alignPages({
      oldDecoded: before.decoded,
      newDecoded: after.decoded,
      oldBytes: new Uint8Array(oldCode),
      newBytes: new Uint8Array(newCode),
      anchors: new Map([[0, 2]]),
      oldRoutines: [
        { start: 0, end: 6 },
        { start: 7, end: 8 }
      ]
    });
    expect(alignment.stretches[0]).toEqual({ oldStart: 0, oldEnd: 6, newStart: 2, newEnd: 8, delta: 2 });
    expect(alignment.ramMap).toEqual([{ from: 0x8000, to: 0x8005, count: 2 }]);
    expect(alignment.routines.map((r) => r.status)).toEqual(["shifted", "different"]);
    expect(alignment.routines[1]).toMatchObject({ unmatched: 1, instructions: 2 });
  });

  it("translates RAM addresses in text, and nothing else", () => {
    const { text, swaps } = translateRam("Reads $8000 and $8001; calls $0B40", [{ from: 0x8000, to: 0x8005, count: 2 }]);
    expect(text).toBe("Reads $8005 and $8001; calls $0B40");
    expect(swaps).toEqual(["$8000 -> $8005"]);
  });
});

describe("carryPage", () => {
  it("carries EXOS 2.1's page 0 onto EXOS 2.0, by signature and by alignment", async () => {
    const sidecar = JSON.parse(readFileSync(join(ROMS, "ep-exos21.rom.dis"), "utf8"));
    const page = (rom: string) => imageFromRomPage(romPageBytes(new Uint8Array(readFileSync(join(ROMS, rom))), 0), { name: rom });
    const result = await carryPage(page("ep-exos21.rom"), sidecar.banks["0"], page("ep-exos20.rom"));
    // --- 579 of 1,132 labels by signature alone (the 2026-11-01 session); the alignment places most of the rest
    expect(result.bank.localLabels!.length).toBeGreaterThan(1050);
    expect(result.aligned).toBeGreaterThan(500);
    // --- The stretch the EXOS 2.0 session found by hand: 2.0 runs $35 bytes earlier there
    expect(result.alignment.stretches).toContainEqual({ oldStart: 0x1ac6, oldEnd: 0x25d1, newStart: 0x1a91, newEnd: 0x259c, delta: -0x35 });
    const statuses = result.alignment.routines.map((r) => r.status);
    expect(statuses.filter((s) => s === "shifted").length).toBeGreaterThan(900);
    expect(statuses.filter((s) => s === "different").length).toBeLessThan(60);
    expect(result.translated.length).toBeGreaterThan(0);
  });
});
