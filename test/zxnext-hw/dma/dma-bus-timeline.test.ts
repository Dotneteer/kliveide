import { describe, expect, it } from "vitest";

import { clocksToT, dmaBusFrame, dmaBusFrames } from "@common/zxnext/dma/dmaBus";
import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * The DMA Bus Timeline (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §13): the core's ring of bus holds and
 * the per-frame figures built from it, on the real core.
 *
 * Hardware (`dev/vendor/next-fpga/3.02.01/src/device/dma.vhd`, `zxnext.vhd`): a continuous transfer
 * keeps the bus for the whole block, 6 CPU clocks a byte with 3-clock cycles; a burst transfer with a
 * prescaler gives the bus back while it waits, so each byte is a hold of its own, 4 x P + 3 T-states apart
 * at 3.5 MHz plus the grant; a pulse-mode interrupt that begins and ends while the DMA holds the bus is
 * never seen by the CPU.
 */

const hexBytes = (bytes: number[]) => bytes.map((b) => `$${b.toString(16)}`).join(",");

/** A continuous copy of `len` bytes from $8000 to $C000 (from the ROM-free area into bank 0) */
const COPY = (len: number) => [0x83, 0x7d, 0x00, 0x80, len & 0xff, len >> 8, 0x14, 0x10, 0xad, 0x00, 0xc0, 0x82, 0xcf, 0x87];
/** A burst transfer at prescaler `p` to the DAC on $DF, auto restart */
const PACED = (p: number) => [0x83, 0x7d, 0x00, 0xc0, 0x00, 0x08, 0x14, 0x68, 0x21, p, 0xcd, 0xdf, 0x00, 0xa2, 0xcf, 0x87];

/**
 * A program that sends the setup with OTIR and spins, interrupts disabled (the ROM's handler would ask
 * for the SD card); the ULA's pulse still comes every frame in pulse mode, which is what a lost pulse is
 */
async function program(setup: number[]): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(" .org $6000\n di\nPark: jr Park");
  await s.loadCode(
    `
        .org $6000
Start:  di
        ld hl,Setup
        ld b,SetupEnd-Setup
        ld c,$6b
        otir
Main:   nop
        jr Main
Setup:  .defb ${hexBytes(setup)}
SetupEnd:`,
    { entry: "Start" }
  );
  return s;
}

describe("DMA Bus Timeline: recording", () => {
  it("a continuous copy is one hold, 6 T-states a byte", async () => {
    const s = await program(COPY(256));
    s.recordDmaBus(true).runTo("Main").runFrames(1);
    const holds = s.dmaBus();
    expect(holds).toHaveLength(1);
    expect(holds[0]).toMatchObject({ bytes: 256, continues: false, continued: false });
    const t = clocksToT(holds[0].duration28, holds[0].speed);
    expect(t).toBeGreaterThanOrEqual(256 * 6);
    expect(t).toBeLessThanOrEqual(256 * 6 + 8);
  });

  it("a burst transfer at prescaler 55 is one hold a byte, about 226 T-states apart", async () => {
    const s = await program(PACED(55));
    s.recordDmaBus(true).runTo("Main").runFrames(2);
    const holds = s.dmaBus();
    expect(holds.length).toBeGreaterThan(200);
    expect(holds.every((h) => h.bytes === 1)).toBe(true);
    const frame = dmaBusFrame(holds, holds[holds.length - 1].frame - 1, s.machine.getDmaBus().tactsInFrame);
    expect(frame.period!.min).toBeGreaterThanOrEqual(223);
    // --- plus the grant: the CPU's machine cycle ends first (up to 5 T-states in JR) and the handover
    expect(frame.period!.max).toBeLessThanOrEqual(240);
    expect(frame.share).toBeGreaterThan(0.03);
    expect(frame.share).toBeLessThan(0.08);
  });

  it("a hold across a frame end is two parts, flagged both ways, and swallows the frame interrupt", async () => {
    // --- 16K at 6 T-states a byte is ~98,000 T-states: longer than a frame
    const s = await program(COPY(0x4000));
    s.recordDmaBus(true).runTo("Main").runFrames(3);
    const holds = s.dmaBus();
    expect(holds.length).toBeGreaterThanOrEqual(2);
    expect(holds[0].continues).toBe(true);
    expect(holds[1].continued).toBe(true);
    expect(holds.reduce((n, h) => n + h.bytes, 0)).toBe(0x4000);
    // --- the ULA's pulse at the next frame's start came and went while the DMA held the bus
    expect(holds.some((h) => h.intLost)).toBe(true);
    const frames = dmaBusFrames(holds, s.machine.getDmaBus().tactsInFrame);
    expect(frames.some((f) => f.share > 0.99)).toBe(true);
    expect(frames.some((f) => f.intLost)).toBe(true);
  });

  it("a short copy loses no interrupt", async () => {
    const s = await program(COPY(256));
    s.recordDmaBus(true).runTo("Main").runFrames(1);
    expect(s.dmaBus().some((h) => h.intLost)).toBe(false);
  });

  it("records nothing while off", async () => {
    const s = await program(COPY(256));
    s.runTo("Main").runFrames(1);
    expect(s.dmaBus()).toEqual([]);
  });

  it("leaves the machine byte-identical", async () => {
    const a = await program(PACED(10));
    const b = await program(PACED(10));
    b.recordDmaBus(true);
    a.runFrames(3);
    b.runFrames(3);
    expect(a.memoryDifferences(b)).toEqual([]);
    expect(a.registers()).toEqual(b.registers());
  });
});
