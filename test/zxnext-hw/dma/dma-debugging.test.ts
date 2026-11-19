import { describe, expect, it } from "vitest";

import { NEXT_PROFILE_IDS, NEXT_PROFILES } from "@emu/machines/zxNext/nextProfiles";
import { dmaPacing } from "@common/zxnext/dma/dmaState";
import { buildDmaModel } from "@renderer/features/dma/dmaViewModel";
import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * The DMA panel's data (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §3.5): the core's snapshot and the view
 * model's state and diagnostics, for one program per trap of the DMA chapter
 * (`docs/content/en/under-the-hood/emulator-internals/next-dma.mdx`), on the real core.
 *
 * Hardware (`dev/vendor/next-fpga/3.02.01/src/device/dma.vhd`): WR0/WR4 fill the start registers and
 * only $CF copies them into the working addresses; the transfer goes on while counter < length,
 * checked after each byte; WR4 bit 4 without port B address bytes leaves the write sequencer in a state
 * with no handler; the prescaler waits 32 x P master clocks from the start of a byte; burst mode frees
 * the bus while it waits; auto restart in continuous mode never frees it.
 */

const ZXN = 0x6b;
const Z80 = 0x0b;
const DDMA_PROFILE = NEXT_PROFILE_IDS.find((id) => NEXT_PROFILES[id].coreVersion[1] >= 3)!;

const lo = (v: number) => v & 0xff;
const hi = (v: number) => (v >> 8) & 0xff;
const hexBytes = (bytes: number[]) => bytes.map((b) => `$${b.toString(16)}`).join(",");

type Setup = {
  a: number;
  b: number;
  len: number;
  bIo?: boolean;
  bFixed?: boolean;
  mode?: "continuous" | "burst";
  prescaler?: number;
  restart?: boolean;
};

/** Disable, WR0 A -> B, WR1 memory up, WR2, WR4, WR5, load. Not enabled. */
function setup(x: Setup): number[] {
  const wr2 = (x.bIo ? 0x08 : 0) | ((x.bFixed ? 2 : 1) << 4) | (x.prescaler ? 0x40 : 0);
  const wr2Follow = x.prescaler ? [0x21, x.prescaler] : [];
  const wr4 = x.mode === "burst" ? 0xcd : 0xad;
  return [0x83, 0x7d, lo(x.a), hi(x.a), lo(x.len), hi(x.len), 0x14, wr2, ...wr2Follow, wr4, lo(x.b), hi(x.b), x.restart ? 0xa2 : 0x82, 0xcf];
}

/** A program that sends `bytes` to port $6B with OTIR, enables the DMA, and loops at `Main` */
async function program(bytes: number[], opts: { speed?: number } = {}): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(" .org $8000\n di\nPark: jr Park");
  await s.loadCode(
    `
        .org $8000
Start:  di
        nextreg $07,${opts.speed ?? 0}
        ld hl,Setup
        ld b,SetupEnd-Setup
        ld c,$6b
        otir
        ld a,$87
Enable: out (c),a
Main:   nop
        jr Main
Setup:  .defb ${hexBytes(bytes)}
SetupEnd:`,
    { entry: "Start" }
  );
  return s;
}

/** Writes bytes to a DMA port from outside, the CPU parked */
async function parked(): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(" .org $8000\n di\nPark: jr Park");
  return s;
}
const write = (s: NextTestSession, bytes: number[], port = ZXN) => {
  for (const b of bytes) s.out(port, b);
  return s;
};
const diagIds = (s: NextTestSession) => buildDmaModel(s.dmaState()).diagnostics.map((d) => d.id);

describe("DMA debugging: the DMA panel's snapshot", () => {
  it("the article's sample player: burst mode waits for prescaler 55 with the bus free", async () => {
    const s = await program(setup({ a: 0xc000, b: 0x00df, len: 2048, bIo: true, bFixed: true, mode: "burst", prescaler: 55 }));
    s.runTo("Main").runFrames(1);
    const st = s.dmaState();
    expect(st).toMatchObject({ dialect: "zxn", operatingMode: "burst", prescaler: 55, aToB: true, busAcknowledged: false });
    expect(st.portB).toMatchObject({ start: 0x00df, working: 0x00df, isIo: true, step: "fixed", cycleClocks: 3 });
    expect(st.portA.start).toBe(0xc000);
    const m = buildDmaModel(st);
    expect(m.header).toBe("waiting");
    expect(m.behavesAs).toBe("burst");
    expect(m.bytesToMove).toBe(2048);
    // --- about one byte every 226 T-states for one frame and a bit
    expect(m.bytesMoved).toBeGreaterThan(200);
    expect(m.bytesMoved).toBeLessThan(2048);
    expect(st.portA.working).toBe(0xc000 + m.bytesMoved);
    expect(m.pacing).toMatchObject({ effective: true, periodClocks: 223 });
    expect(m.status).toBe(0x3b);
    expect(m.diagnostics).toEqual([]);
  });

  it("is read without side effects: a session that reads it often stays byte-identical", async () => {
    const bytes = setup({ a: 0xc000, b: 0x00df, len: 2048, bIo: true, bFixed: true, mode: "burst", prescaler: 55 });
    const a = await program(bytes);
    const b = await program(bytes);
    for (let f = 0; f < 4; f++) {
      a.runFrames(1);
      b.runFrames(1);
      for (let k = 0; k < 3; k++) b.dmaState();
    }
    expect(a.memoryDifferences(b)).toEqual([]);
  });

  it("a 16K continuous copy paused at a frame boundary holds the bus", async () => {
    const s = await program(setup({ a: 0x4000, b: 0xc000, len: 0x4000 }));
    s.runFrames(1);
    const st = s.dmaState();
    const m = buildDmaModel(st);
    expect(st.busAcknowledged).toBe(true);
    expect(m.header).toBe("holding");
    expect(m.bytesMoved).toBeGreaterThan(0);
    expect(m.bytesMoved).toBeLessThan(0x4000);
    expect(m.diagnostics.map((d) => d.id)).toContain("framePause");
  });

  it("WR4 bit 4 without port B's address leaves it deaf", async () => {
    const s = write(await parked(), [0xc3, 0x91]);
    const m = buildDmaModel(s.dmaState());
    expect(m.header).toBe("deaf");
    expect(m.diagnostics[0]).toMatchObject({ id: "deaf", args: { base: "$91" } });
    expect(m.pending).toBeUndefined();
  });

  it("an enable after new start addresses without $CF uses the old working addresses", async () => {
    const s = await parked();
    s.poke(0xc000, [1, 2, 3, 4, 5, 6, 7, 8]);
    write(s, [...setup({ a: 0xc000, b: 0xd000, len: 4 }), 0x87]);
    s.runFrames(1);
    expect([...s.peekBytes(0xd000, 4)]).toEqual([1, 2, 3, 4]);
    // --- new port A start, no load: the panel warns, and the old working addresses move on
    write(s, [0x7d, 0x00, 0xe0, 0x04, 0x00]);
    expect(s.dmaState().startsSinceLoad).toBe(true);
    write(s, [0x87]);
    const st = s.dmaState();
    expect(st.enableNote & 0x01).toBe(1);
    const m = buildDmaModel(st);
    expect(m.diagnostics.find((d) => d.id === "noLoad")?.args).toMatchObject({ portA: "$C004", portB: "$D004" });
    // --- $CF clears both notes
    write(s, [0x83, 0xcf]);
    expect(s.dmaState()).toMatchObject({ startsSinceLoad: false, enableNote: 0 });
  });

  it("an enable after a finished block without $CF moves one more byte from past the end", async () => {
    const s = await parked();
    s.poke(0xc000, [1, 2, 3, 4, 5, 6, 7, 8]);
    write(s, [...setup({ a: 0xc000, b: 0xd000, len: 4 }), 0x87]);
    s.runFrames(1);
    expect(buildDmaModel(s.dmaState()).finished).toBe(true);
    write(s, [0x87]);
    expect(diagIds(s)).toContain("afterEnd");
    s.runFrames(1);
    expect([...s.peekBytes(0xd000, 6)]).toEqual([1, 2, 3, 4, 5, 0]);
  });

  it("a register group waiting for followers lists them", async () => {
    const s = write(await parked(), [0xc3, 0x7d, 0x00, 0xc0]);
    const m = buildDmaModel(s.dmaState());
    expect(m.pending).toEqual({ group: "WR0", roles: ["lengthLo", "lengthHi"] });
    expect(m.diagnostics.find((d) => d.id === "partial")?.args).toEqual({ group: "WR0", count: 2 });
    write(s, [0x10, 0x00]);
    expect(buildDmaModel(s.dmaState()).pending).toBeUndefined();
  });

  it("auto restart in continuous mode locks the bus", async () => {
    const s = await program(setup({ a: 0xc000, b: 0xd000, len: 16, restart: true }));
    s.runFrames(1);
    const st = s.dmaState();
    expect(st.busAcknowledged).toBe(true);
    const m = buildDmaModel(st);
    expect(m.header).toBe("locked");
    expect(m.diagnostics[0]).toMatchObject({ id: "lock", args: { count: 0 } });
  });

  it("a load through $0B is Z80 DMA mode: a length of 4 moves 5 bytes", async () => {
    const s = write(await parked(), setup({ a: 0xc000, b: 0xd000, len: 4 }), Z80);
    const st = s.dmaState();
    expect(st.dialect).toBe("z80");
    expect(st.counter).toBe(0xffff);
    const m = buildDmaModel(st);
    expect(m.bytesToMove).toBe(5);
    expect(m.bytesMoved).toBe(0);
    expect(m.diagnostics.find((d) => d.id === "z80")?.args).toEqual({ length: 4, bytes: 5 });
  });

  it("port $6B switched off in NextReg $82 is reported", async () => {
    const s = await parked();
    s.setNextReg(0x82, s.nextRegValue(0x82) & ~0x20);
    expect(diagIds(s)).toContain("portOff");
  });

  it("step-aside sources come from NextRegs $CC-$CE", async () => {
    const s = await parked();
    s.setNextReg(0xcc, 0x01).setNextReg(0xcd, 0x01);
    const m = buildDmaModel(s.dmaState());
    expect(m.stepAside).toEqual(["CTC 0", "ULA"]);
    expect(m.diagnostics.map((d) => d.id)).toContain("stepAsideIm");
  });

  it("has no zxnDDMA section before core 3.03", async () => {
    const s = await parked();
    expect(s.dmaState().ddma).toBeUndefined();
  });

  it(`on ${DDMA_PROFILE}, physical mode left on after a copy is reported with 22-bit addresses`, async () => {
    const s = await createSession({ profile: DDMA_PROFILE });
    await s.loadCode(" .org $8000\n di\nPark: jr Park");
    // --- page 40 ($090000) to page 41 ($092000), 16 bytes, physical
    write(s, [0xc3, 0xd7, 0x09, 0xdb, 0x09, 0xdf, 0x01, 0x7d, 0x00, 0x00, 0x10, 0x00, 0x14, 0x10, 0xad, 0x00, 0x20, 0x82, 0xcf, 0x87]);
    s.runFrames(1);
    const st = s.dmaState();
    expect(st.ddma).toMatchObject({ flags: 0x01, extA: 0x09, extB: 0x09 });
    const m = buildDmaModel(st);
    expect(m.physical).toBe(true);
    expect(m.ddmaFlags).toEqual(["physical"]);
    expect(m.diagnostics.find((d) => d.id === "ddmaOn")?.args).toEqual({ flags: "physical" });
    // --- $C3 clears the zxnDDMA settings
    write(s, [0xc3]);
    expect(s.dmaState().ddma?.flags).toBe(0);
  });
});

describe("DMA debugging: the pacing figures agree with the core", () => {
  /**
   * CPU clocks a byte of a 20-byte continuous block takes: the time from the enabling OUT to `Done`,
   * less the OUT (12) and the two NOPs (8), as DMA-009 in dma.test.ts measures it.
   */
  async function measuredPeriod(prescaler: number, speed: number): Promise<number> {
    const s = await createSession();
    await s.loadCode(" .org $8000\n di\nPark: jr Park");
    await s.loadCode(
      `
        .org $8000
Start:  di
        nextreg $07,${speed}
        ld hl,Setup
        ld b,SetupEnd-Setup
        ld c,$6b
        otir
        ld a,$87
Enable: out (c),a
        nop
        nop
Done:   jr Done
Setup:  .defb ${hexBytes(setup({ a: 0xc000, b: 0xd000, len: 20, prescaler }))}
SetupEnd:`,
      { entry: "Start" }
    );
    s.runTo("Enable");
    const t0 = s.tacts;
    s.runTo("Done");
    return (s.tacts - t0 - 20) / 20;
  }

  for (const prescaler of [1, 55, 100]) {
    for (const speed of [0, 1, 2, 3]) {
      it(`prescaler ${prescaler} at speed ${speed}`, async () => {
        const pacing = dmaPacing(prescaler, speed, 6)!;
        const period = await measuredPeriod(prescaler, speed);
        if (pacing.effective) {
          // --- the exact period, plus at most the handover and 28 MHz memory waits spread over 20 bytes
          expect(period, `${period} clocks a byte`).toBeGreaterThanOrEqual(pacing.periodClocks);
          expect(period).toBeLessThanOrEqual(pacing.periodClocks + 1.5);
        } else {
          // --- no effect: a byte takes its own six clocks, as without a prescaler
          expect(period, `${period} clocks a byte`).toBeGreaterThanOrEqual(6);
          expect(period).toBeLessThanOrEqual(7);
        }
      });
    }
  }
});
