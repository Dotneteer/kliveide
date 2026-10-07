import { describe, expect, it } from "vitest";

import { tactToPixel, type BeamPosition } from "@common/utils/beamGeometry";
import { createSp48Session } from "../harness/sp48";
import { createSp128Session } from "../harness/sp128";
import { createTimexSession } from "../harness/timex";
import { processMainToEmuMessages } from "@renderer/appEmu/MainToEmuProcessor";

/*
 * The beam position overlay on the cores built on `zx-spectrum-ula.c`
 * (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` Phase 2): the 48K, the 128K and the Pentagon (sp128), the
 * +2A and +3E (spp3e) and the Timex (the 48K core with the SCLD, two buffer pixels per Spectrum pixel).
 *
 * - The overlay's linear raster agrees with the core's own tact -> pixel table for every tact the
 *   ULA draws, and the paper is where the ULA puts it.
 * - Rendering to the beam (D3) draws exactly up to the beam: the pixels before the last catch-up are
 *   unchanged, the stale ones up to the beam are redrawn, nothing past it moves (T1).
 * - It changes nothing the machine draws later (T2): after more frames - the program writing the
 *   border and screen memory all the while - the memory image equals the same run without it.
 */

/** What every session offers */
type Driver = {
  machine: {
    pc: number;
    getBeamPosition(): BeamPosition;
    renderToBeamPreview(): void;
    getPixelBuffer(): Uint32Array;
    getBufferStartOffset(): number;
    screenWidthInPixels: number;
    screenHeightInPixels: number;
    saveMachineState(): { image: Uint8Array };
  };
  runFrames(n: number): unknown;
  step(n?: number): unknown;
  poke(address: number, bytes: number | ArrayLike<number>): unknown;
};

type Machine = {
  name: string;
  create: () => Promise<Driver>;
  /** The core's export prefix, for its tact -> pixel table */
  prefix: "sp48" | "sp128" | "spp3e";
  scale: number;
  tactsPerLine: number;
  lines: number;
};

const MACHINES: Machine[] = [
  { name: "48K", create: async () => (await createSp48Session()) as unknown as Driver, prefix: "sp48", scale: 1, tactsPerLine: 224, lines: 312 },
  { name: "128K", create: async () => (await createSp128Session("sp128")) as unknown as Driver, prefix: "sp128", scale: 1, tactsPerLine: 228, lines: 311 },
  { name: "Pentagon", create: async () => (await createSp128Session("pentagon")) as unknown as Driver, prefix: "sp128", scale: 1, tactsPerLine: 224, lines: 320 },
  { name: "+2A", create: async () => (await createSp128Session("plus2a")) as unknown as Driver, prefix: "spp3e", scale: 1, tactsPerLine: 228, lines: 311 },
  { name: "+3E", create: async () => (await createSp128Session("nofdd")) as unknown as Driver, prefix: "spp3e", scale: 1, tactsPerLine: 228, lines: 311 },
  { name: "Timex", create: async () => (await createTimexSession()) as unknown as Driver, prefix: "sp48", scale: 2, tactsPerLine: 224, lines: 312 }
];

/*
 * $8000: DI / LD HL,$4000 / Loop: INC A / OUT ($FE),A / LD B,0 / Wait: DJNZ Wait / LD (HL),A /
 *        INC HL / LD C,A / LD A,H / AND $57 / LD H,A / LD A,C / JR Loop
 * The border and one screen byte per pass, a pass every ~3,400 T-states: the ULA catches up at each
 * write, then falls behind the beam for some 15 lines.
 */
const PROGRAM = [
  0xf3, 0x21, 0x00, 0x40, 0x3c, 0xd3, 0xfe, 0x06, 0x00, 0x10, 0xfe, 0x77, 0x23, 0x4f, 0x7c, 0xe6, 0x57, 0x67, 0x79,
  0x18, 0xef
];

async function started(m: Machine): Promise<Driver> {
  const s = await m.create();
  s.runFrames(2);
  s.poke(0x8000, PROGRAM);
  s.machine.pc = 0x8000;
  s.runFrames(2);
  return s;
}

/** Steps until the beam is past `tact` and the ULA has fallen at least `gap` pixels behind it */
function stopBehind(s: Driver, tact: number, gap: number): BeamPosition {
  for (let i = 0; i < 200000; i++) {
    s.step(1);
    const b = s.machine.getBeamPosition();
    if (b.frameTact > tact && b.bufferY !== undefined && b.bufferY * b.bufferWidth + b.bufferX! - b.renderedUpTo > gap) {
      return b;
    }
  }
  throw new Error("The beam never got there");
}

/** The ULA panel's state, through the emulator's message processor as the IDE requests it */
async function ulaState(s: Driver): Promise<{ ras: number; pos: number; fcl: number }> {
  const response = (await processMainToEmuMessages(
    { type: "ApiMethodRequest", method: "getUlaState", args: [] } as never,
    undefined as never,
    undefined as never,
    { machineService: { getMachineController: () => ({ machine: s.machine }) } } as never
  )) as { result?: { ras: number; pos: number; fcl: number }; message?: string };
  if (!response.result) throw new Error(`getUlaState failed: ${response.message}`);
  return response.result;
}

function picture(s: Driver): Uint32Array {
  const m = s.machine;
  const start = m.getBufferStartOffset();
  return m.getPixelBuffer().slice(start, start + m.screenWidthInPixels * m.screenHeightInPixels);
}

function firstDiff(a: Uint32Array, b: Uint32Array, from = 0, to = a.length): number {
  for (let i = from; i < to; i++) if (a[i] !== b[i]) return i;
  return -1;
}

describe("beam position (Spectrum family)", () => {
  for (const m of MACHINES) {
    it(`${m.name}: the overlay's raster is the core's tact -> pixel table`, async () => {
      const s = await started(m);
      const b = s.machine.getBeamPosition();
      const ex = (s.machine as unknown as { wasmV2Runtime: { exports: Record<string, (n?: number) => number> } })
        .wasmV2Runtime.exports;
      expect(b.unit).toBe("T");
      expect([b.tactsPerLine, b.linesPerFrame]).toEqual([m.tactsPerLine, m.lines]);
      expect(b.tactsPerBufferPixel).toBe(1 / (2 * m.scale));
      expect([b.paperWidth, b.paperHeight]).toEqual([256 * m.scale, 192]);
      const start = s.machine.getBufferStartOffset();
      let checked = 0;
      for (let t = 0; t < m.tactsPerLine * m.lines; t++) {
        if (ex[`${m.prefix}GetRenderingPhase`](t) === 0) continue;
        const index = ex[`${m.prefix}GetRenderingPixelIndex`](t) * m.scale - start;
        if (index < 0 || index >= b.bufferWidth * b.bufferHeight) continue;
        const where = tactToPixel(b, t);
        expect(where.y! * b.bufferWidth + where.x!, `tact ${t}`).toBe(index);
        // --- the ULA's first paper pixel is the overlay's paper corner
        if (index === b.paperTop * b.bufferWidth + b.paperLeft) expect(where.region).toBe("paper");
        checked++;
      }
      expect(checked).toBeGreaterThan(40000);
    });

    it(`${m.name}: T6: the ULA panel's RAS and POS are the raster line and the tact in it`, async () => {
      const s = await started(m);
      stopBehind(s, 30000, 0);
      const b = s.machine.getBeamPosition();
      const ula = await ulaState(s);
      expect({ ras: ula.ras, pos: ula.pos }).toEqual({ ras: b.line, pos: b.lineTact });
      // --- a line is tactsPerLine long, not the buffer's width (the old formula's divisor)
      const shift = m.name === "Pentagon" ? 62 : 0;
      expect(ula.ras * m.tactsPerLine + ula.pos).toBe((b.frameTact - shift + m.tactsPerLine * m.lines) % (m.tactsPerLine * m.lines));
    });

    it(`${m.name}: rendering to the beam draws the stale pixels up to the beam and nothing else`, async () => {
      const s = await started(m);
      const b = stopBehind(s, 30000, 4000);
      const beam = b.bufferY! * b.bufferWidth + b.bufferX!;
      const before = picture(s);
      s.machine.renderToBeamPreview();
      const after = picture(s);
      const now = s.machine.getBeamPosition();
      expect(firstDiff(after, before, 0, b.renderedUpTo)).toBe(-1);
      expect(firstDiff(after, before, b.renderedUpTo, beam)).toBeGreaterThanOrEqual(0);
      // --- the beam's own pixel pair is drawn with its tact; nothing after it
      expect(firstDiff(after, before, beam + 2 * m.scale)).toBe(-1);
      expect(now.renderedUpTo).toBeGreaterThanOrEqual(beam);
      expect(now.renderedUpTo).toBeLessThanOrEqual(beam + 2 * m.scale);
    });

    it(`${m.name}: rendering to the beam changes nothing the machine draws later (T2)`, async () => {
      const a = await started(m);
      const b = await started(m);
      for (const s of [a, b]) stopBehind(s, 20000, 4000);
      a.machine.renderToBeamPreview();
      for (const s of [a, b]) {
        s.step(700);
        s.runFrames(2);
        s.step(333);
      }
      a.machine.renderToBeamPreview();
      for (const s of [a, b]) s.runFrames(2);
      expect(firstDiff(picture(a), picture(b))).toBe(-1);
      expect(Buffer.compare(Buffer.from(a.machine.saveMachineState().image), Buffer.from(b.machine.saveMachineState().image))).toBe(0);
    });
  }
});
