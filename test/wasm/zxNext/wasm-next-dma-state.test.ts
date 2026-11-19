import { describe, expect, it } from "vitest";

import { NEXT_PROFILE_IDS, NEXT_PROFILES } from "@emu/machines/zxNext/nextProfiles";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/*
 * The DMA panel's snapshot (`zxnextGetDmaStatePtr`, `dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §3.2): its
 * byte layout against `decodeDmaState`, on a profile without and one with the zxnDDMA, and that taking
 * it leaves the read sequence where it was.
 */

const ZXNDMA = 0;
const PRE_303 = NEXT_PROFILE_IDS.find((id) => NEXT_PROFILES[id].coreVersion[1] < 3)!;
const WITH_303 = NEXT_PROFILE_IDS.find((id) => NEXT_PROFILES[id].coreVersion[1] >= 3)!;

describe("ZX Next WASM DMA state snapshot", () => {
  for (const profile of [PRE_303, WITH_303]) {
    it(`decodes every register on ${profile}`, async () => {
      const m = await createTestZxNextWasmMachine(profile);
      const ex = m.wasmV2Runtime!.exports;
      const write = (...values: number[]) => {
        for (const v of values) {
          ex.zxnextDmaSetMode(ZXNDMA);
          ex.zxnextDmaWritePort(v);
        }
      };
      // --- WR0 B->A, port A $1234, length $0010; WR1 I/O fixed, timing 2 clocks; WR2 down, timing
      // --- 4 clocks + prescaler $37; WR4 burst, port B $5678; WR5 auto restart; load; read mask $06
      write(0x79, 0x34, 0x12, 0x10, 0x00, 0x6c, 0x02, 0x40, 0x20, 0x37, 0xcd, 0x78, 0x56, 0xa2, 0xcf, 0xbb, 0x06);
      const s = m.getDmaState();
      expect(s).toMatchObject({
        dialect: "zxn",
        seq: "idle",
        aToB: false,
        blockLength: 0x10,
        counter: 0,
        prescaler: 0x37,
        operatingMode: "burst",
        autoRestart: true,
        readMask: 0x06,
        nextRead: "counterLo",
        endOfBlockN: true,
        atLeastOne: false,
        wrSeq: 0,
        startsSinceLoad: false,
        enableNote: 0,
        cpuSpeed: 0
      });
      // --- B -> A: port B is the source, port A the destination; both loaded from their starts
      expect(s.portA).toEqual({ start: 0x1234, working: 0x1234, isIo: true, step: "fixed", timingCode: 2, cycleClocks: 2 });
      expect(s.portB).toEqual({ start: 0x5678, working: 0x5678, isIo: false, step: "down", timingCode: 0, cycleClocks: 4 });
      expect(s.nextRegs.r82 & 0x20).toBe(0x20);
      expect(s.tactsInFrame).toBe(ex.zxnextGetTactsInFrame());
      expect(s.ddma === undefined).toBe(profile === PRE_303);

      // --- taking the snapshot twice does not move the read sequence: the next read is the counter
      m.getDmaState();
      expect(ex.zxnextDmaReadStatusByte()).toBe(0x00);
      expect(m.getDmaState().nextRead).toBe("counterHi");

      // --- a half-written WR0 shows in the write sequencer
      write(0x7d, 0x00);
      expect(m.getDmaState()).toMatchObject({ wrSeq: 2, regTemp: 0x7d, startsSinceLoad: true });
    });
  }

  it(`decodes the zxnDDMA settings on ${WITH_303}`, async () => {
    const m = await createTestZxNextWasmMachine(WITH_303);
    const ex = m.wasmV2Runtime!.exports;
    for (const v of [0xc3, 0xd7, 0x09, 0xdb, 0x0a, 0xdf, 0x03, 0xe3, 0x20, 0x00, 0xe7, 0x08, 0x00, 0xeb, 0x00, 0x01, 0xef, 0x40, 0x01, 0xf3, 0xe3, 0xf7, 0x55]) {
      ex.zxnextDmaSetMode(ZXNDMA);
      ex.zxnextDmaWritePort(v);
    }
    expect(m.getDmaState().ddma).toMatchObject({
      flags: 0x03,
      extA: 0x09,
      extB: 0x0a,
      rowLength: 0x20,
      rowCount: 0x08,
      strideA: 0x100,
      strideB: 0x140,
      transparent: 0xe3,
      fill: 0x55
    });
  });
});
