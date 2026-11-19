import { describe, expect, it } from "vitest";

import { blockBytes, transferDestination, transferSource, xferClocksToT } from "@common/zxnext/dma/dmaTransfers";
import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * The DMA Transfers (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §14): the core's ring of transfers, one
 * record from an enable to its end, on the real core.
 */

const hexBytes = (bytes: number[]) => bytes.map((b) => `$${b.toString(16)}`).join(",");

/** A continuous copy of `len` bytes from $8000 to $C000 */
const COPY = (len: number) => [0x83, 0x7d, 0x00, 0x80, len & 0xff, len >> 8, 0x14, 0x10, 0xad, 0x00, 0xc0, 0x82, 0xcf, 0x87];
/** A burst transfer of `len` bytes from $C000 at prescaler `p` to the DAC on $DF, auto restart */
const PACED = (p: number, len = 0x800) => [
  0x83, 0x7d, 0x00, 0xc0, len & 0xff, len >> 8, 0x14, 0x68, 0x21, p, 0xcd, 0xdf, 0x00, 0xa2, 0xcf, 0x87
];

/** A program that sends the setup with OTIR (at `Send`) and spins, interrupts disabled */
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
Send:   otir
Main:   nop
        jr Main
Setup:  .defb ${hexBytes(setup)}
SetupEnd:`,
    { entry: "Start" }
  );
  return s;
}

describe("DMA Transfers: recording", () => {
  it("a copy is one transfer with its ranges, bytes, bus time and end", async () => {
    const s = await program(COPY(256));
    s.recordDmaTransfers(true).runTo("Main").runFrames(1);
    const xfers = s.dmaTransfers();
    expect(xfers).toHaveLength(1);
    const t = xfers[0];
    expect(t).toMatchObject({
      seq: 0,
      bytes: 256,
      length: 256,
      aToB: true,
      mode: "continuous",
      autoRestart: false,
      end: "endOfBlock",
      restarts: 0,
      intLost: false,
      notLoaded: false,
      pc: s.symbol("Send")
    });
    expect(t.portA).toEqual({ start: 0x8000, io: false, mode: "increment" });
    expect(t.portB).toEqual({ start: 0xc000, io: false, mode: "increment" });
    expect(transferSource(t)).toEqual({ kind: "memory", physical: false, ranges: [{ from: 0x8000, to: 0x80ff }] });
    expect(transferDestination(t)).toEqual({ kind: "memory", physical: false, ranges: [{ from: 0xc000, to: 0xc0ff }] });
    const held = xferClocksToT(t.held28, t.speed);
    expect(held).toBeGreaterThanOrEqual(256 * 6);
    expect(held).toBeLessThanOrEqual(256 * 6 + 8);
    expect(t.endFrame! * 1e7 + t.endPos28!).toBeGreaterThan(t.frame * 1e7 + t.pos28);
  });

  it("an auto-restarting transfer stays open and counts its blocks", async () => {
    const s = await program(PACED(1, 0x100));
    s.recordDmaTransfers(true).runTo("Main").runFrames(2);
    const xfers = s.dmaTransfers();
    expect(xfers).toHaveLength(1);
    const t = xfers[0];
    expect(t).toMatchObject({ end: "running", mode: "burst", autoRestart: true, prescaler: 1 });
    expect(t.endFrame).toBeUndefined();
    expect(t.restarts).toBeGreaterThan(0);
    expect(t.bytes).toBeGreaterThan(0x100 * t.restarts);
    expect(transferDestination(t)).toEqual({ kind: "port", port: 0xdf });
    // --- a restarted block has covered the whole source range
    expect(transferSource(t)).toEqual({ kind: "memory", physical: false, ranges: [{ from: 0xc000, to: 0xc0ff }] });
    expect(blockBytes(t)).toBe(0x100);
  });

  it("$83 ends a running transfer as disabled, $C3 as reset", async () => {
    for (const [cmd, end] of [
      [0x83, "disabled"],
      [0xc3, "reset"]
    ] as const) {
      const s = await program(PACED(55));
      s.recordDmaTransfers(true).runTo("Main").runFrames(1);
      s.out(0x6b, cmd).runFrames(1);
      const xfers = s.dmaTransfers();
      expect(xfers).toHaveLength(1);
      expect(xfers[0].end).toBe(end);
      expect(xfers[0].pc).toBe(s.symbol("Send"));
      expect(xfers[0].bytes).toBeGreaterThan(0);
      expect(xfers[0].bytes).toBeLessThan(0x800);
    }
  });

  it("an enable while a transfer runs does not start another", async () => {
    const s = await program(PACED(55));
    s.recordDmaTransfers(true).runTo("Main").runFrames(1);
    s.out(0x6b, 0x87).runFrames(1);
    expect(s.dmaTransfers()).toHaveLength(1);
  });

  it("a copy across the frame interrupt is flagged as having lost it", async () => {
    const s = await program(COPY(0x4000));
    s.recordDmaTransfers(true).runTo("Main").runFrames(3);
    const [t] = s.dmaTransfers();
    expect(t).toMatchObject({ bytes: 0x4000, end: "endOfBlock", intLost: true });
    expect(transferSource(t)).toEqual({ kind: "memory", physical: false, ranges: [{ from: 0x8000, to: 0xbfff }] });
  });

  it("switched on while a transfer runs, it joins it; switched off, it ends it as stopped", async () => {
    const s = await program(PACED(55));
    s.runTo("Main").runFrames(1);
    s.recordDmaTransfers(true).recordDmaTransfers(true).runFrames(1);
    const [t] = s.dmaTransfers();
    expect(t).toMatchObject({ joined: true, pc: undefined, end: "running" });
    expect(t.bytes).toBeGreaterThan(0);
    // --- switching it on again (each refresh does) changes nothing
    s.recordDmaTransfers(true).runFrames(1);
    expect(s.dmaTransfers()).toHaveLength(1);
    expect(s.dmaTransfers()[0].bytes).toBeGreaterThan(t.bytes);
    s.recordDmaTransfers(false);
    expect(s.dmaTransfers()[0].end).toBe("stopped");
  });

  it("records nothing while off", async () => {
    const s = await program(COPY(256));
    s.runTo("Main").runFrames(1);
    expect(s.dmaTransfers()).toEqual([]);
  });

  it("leaves the machine byte-identical", async () => {
    const a = await program(PACED(10));
    const b = await program(PACED(10));
    b.recordDmaTransfers(true);
    a.runFrames(3);
    b.runFrames(3);
    expect(a.memoryDifferences(b)).toEqual([]);
    expect(a.registers()).toEqual(b.registers());
  });
});
