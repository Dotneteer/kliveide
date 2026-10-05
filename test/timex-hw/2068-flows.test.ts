import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BinaryReader } from "@common/utils/BinaryReader";
import { TapReader } from "@emu/machines/tape/TapReader";
import { DCK_BANK_DOCK, parseDckFile, writeDckFile } from "@common/timex/dckFile";
import { createTimexSession, hasTimexRom } from "../harness/timex";

/*
 * The IDE's flows on the 2068s (`.plans/TIMEX_SCORPION_PLAN.md` G9.4b, P6). Without a 2068 ROM the
 * machines boot the Sinclair 48K ROM, so the flows wait at the 48K's addresses; with the TS2068 ROM
 * (`KLIVE_TS2068_ROM`, CRC-32 48004230) they wait at its own: the main loop at $0E32 in the HOME
 * ROM, and the tape routines - the 48K's, moved - in the EXROM, which the ROM pages into chunk 0
 * around a load. These were found by running the ROM and comparing it with the 48K ROM (P6).
 */

const FLOAT_SPY = new Uint8Array(readFileSync(join(__dirname, "../testfiles/floatspy.tap")));

function tapBlocks(bytes: Uint8Array) {
  const reader = new TapReader(new BinaryReader(bytes));
  expect(reader.readContent()).toBeNull();
  return reader.dataBlocks;
}

describe("2068 flows on the 48K ROM", () => {
  it("waits at the 48K main loop for code injection", async () => {
    const s = await createTimexSession({ model: "ts2068" });
    const flow = await s.timex.getCodeInjectionFlow("sp48");
    expect(flow[0]).toMatchObject({ execPoint: 0x12ac });
    s.bootToBasic();
    expect(s.machine.pc).toBe(0x12ac);
  });
});

describe.skipIf(!hasTimexRom("ts2068"))("TS2068 flows on its own ROM", () => {
  it("boots to its main loop at $0E32; injected code runs and returns there", async () => {
    const s = await createTimexSession({ model: "ts2068", rom: "own" });
    expect(s.timex.romInUse).toBe("ts2068");
    expect(s.timex.romTraits?.name).toBe("TS2068");
    const flow = await s.timex.getCodeInjectionFlow("sp48");
    expect(flow[0]).toMatchObject({ execPoint: 0x0e32 });
    s.runTo(0x0e32, { maxFrames: 400 });
    expect(s.machine.isOsInitialized).toBe(true);
    await s.loadCode(`
          .org $8000
      Main:
          ld hl,$5a5a
          ld (Result),hl
          ret
      Result:
          .defw 0
    `);
    s.call("Main");
    expect(s.machine.pc).toBe(0x0e32);
    expect(s.peekWord(s.program!.symbol("Result"))).toBe(0x5a5a);
    // --- And BASIC goes on: its interrupt keeps counting FRAMES, its system variables intact
    const frames = () => s.peek(23672) | (s.peek(23673) << 8);
    const before = frames();
    s.runFrames(20);
    expect(frames() - before).toBeGreaterThanOrEqual(19);
    expect(s.machine.isOsInitialized).toBe(true);
  });

  it('types LOAD "" and loads a tape through the EXROM\'s routines', async () => {
    const blocks = tapBlocks(FLOAT_SPY);
    const program = blocks[1].data.subarray(1, blocks[1].data.length - 1);
    const s = await createTimexSession({ model: "ts2068", rom: "own" });
    s.runTo(0x0e32, { maxFrames: 400 });
    s.insertTape(blocks);
    s.typeFlowKeys(s.timex.getTapeLoadFlow(), { gap: 8 });
    const prog = s.peekWord(0x5c53);
    let loaded = false;
    for (let frame = 0; frame < 3000 && !loaded; frame += 10) {
      s.runFrames(10);
      loaded = Array.from(program.subarray(0, 64)).every((b, i) => s.peek(prog + i) === b);
    }
    expect(loaded).toBe(true);
    expect(s.exports.sp48TapeGetLoadStartCount()).toBeGreaterThan(0);
  }, 60_000);

  it("starts a Klive-made LROS cartridge from the DOCK", async () => {
    // --- An LROS (TS2068 Technical Manual 5.1.1): byte 1 = 1, bytes 2-3 the start address,
    // --- byte 4 the chunks it uses, low active (chunk 0 in use, chunk 3 kept HOME as 5.1.1 asks)
    const chunk0 = new Uint8Array(0x2000);
    chunk0.set([0x00, 0x01, 0x10, 0x00, 0xfe], 0);
    // --- $0010: LD A,$C3 / LD ($9000),A / LD A,2 / OUT ($FE),A / JR $
    chunk0.set([0x3e, 0xc3, 0x32, 0x00, 0x90, 0x3e, 0x02, 0xd3, 0xfe, 0x18, 0xfe], 0x10);
    // --- RST 38 (an interrupt before the cartridge disables it): EI / RET
    chunk0.set([0xfb, 0xc9], 0x38);
    const dck = writeDckFile({
      banks: [{ bank: DCK_BANK_DOCK, chunkTypes: [0, 0, 0, 0, 0, 0, 0, 0], chunks: [chunk0] }]
    });
    const s = await createTimexSession({ model: "ts2068", rom: "own" });
    s.insertCartridge(parseDckFile(dck));
    s.timex.hardReset();
    s.runFrames(300);
    expect(s.peek(0x9000)).toBe(0xc3);
    expect(s.exports.sp48GetBorderColor()).toBe(2);
    expect(s.exports.timexGetChunkSource(0)).toBe(1);
  });
});
