import { describe, expect, it } from "vitest";

import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { parseRzxFile } from "@common/spectrum/rzx/rzxFile";
import { rzxSegments } from "@common/spectrum/rzx/rzxSegments";
import { createSp128Session, type Sp128SessionModel, type Sp128TestSession } from "../../harness/sp128";

/*
 * The RZX round trip on the 128K and the +2E/+3E (`.plans/RZX_PLAN.md` Phase 4): a program of our
 * own that pages banks through $7FFD, writes and reads back AY registers through IN, polls the
 * keyboard and, with a drive, the FDC's main status register. Recorded on the real core, it plays
 * back to identical RAM (every bank), registers, paging and AY state.
 */

const PROGRAM = (fdc: boolean) => `
    .org $8000
Main:
    di
    ld sp,$bf00
    ld a,$90
    ld i,a
    im 2
    ld hl,$9000          ; the vector table: every vector is $9191
    ld (hl),$91
    ld de,$9001
    ld bc,$0100
    ldir
    ld hl,$9191          ; the handler: EI; NOP; RET
    ld (hl),$fb
    inc hl
    ld (hl),$00
    inc hl
    ld (hl),$c9
    ei
Loop:
    ld a,(Bank)          ; page the next bank in at $C000 (ROM 1 stays)
    inc a
    and 7
    ld (Bank),a
    or $10
    ld bc,$7ffd
    out (c),a
    ld hl,$c000
    ld a,(Acc)
    add a,(hl)
    ld (hl),a
    ld a,(Bank)          ; select AY register = bank, write the sum, read it back through IN
    ld bc,$fffd
    out (c),a
    ld b,$bf
    ld a,(Acc)
    out (c),a
    ld b,$ff
    in a,(c)
    ld c,a
    ld a,$fe             ; the keyboard
    in a,($fe)
    xor c
${fdc ? `    ld c,a
    ld b,$2f             ; the FDC's main status register
    push bc
    ld c,$fd
    in a,(c)
    pop bc
    xor c
` : ""}    ld hl,Acc
    add a,(hl)
    ld (hl),a
    ld hl,Count
    inc (hl)
    jr nz,Loop
    halt                 ; every 256 rounds, wait for an interrupt
    jr Loop
Bank:
    .defb 0
Acc:
    .defb 0
Count:
    .defb 0
`;

async function loadProgram(s: Sp128TestSession, fdc: boolean): Promise<number> {
  const options = new AssemblerOptions();
  options.currentModel = SpectrumModelType.Spectrum128;
  const output = await new Z80Assembler().compile(`  .model Spectrum128\n${PROGRAM(fdc)}`, options);
  const errors = output.errors.filter((e) => !e.isWarning);
  if (errors.length) throw new Error(errors.map((e) => `${e.line}: ${e.message}`).join("\n"));
  for (const seg of output.segments) {
    seg.emittedCode.forEach((b, i) => s.machine.doWriteMemory((seg.startAddress + i) & 0xffff, b));
  }
  return output.getSymbol("Main")!.value!.value as number;
}

function fingerprint(s: Sp128TestSession): string | undefined {
  const cpu = s.cpu();
  if (s.machine.wasmV2Runtime == null) return undefined;
  let h = 0x811c9dc5;
  const mix = (v: number) => {
    h ^= v & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  for (let bank = 0; bank < 8; bank++) for (const b of s.bank(bank)) mix(b);
  const p = s.paging();
  const psg: number[] = [];
  for (let r = 0; r < 16; r++) psg.push(s.psgRegister(r));
  const state = [
    cpu.af, cpu.bc, cpu.de, cpu.hl, cpu.af_, cpu.bc_, cpu.de_, cpu.hl_, cpu.ix, cpu.iy, cpu.sp, cpu.pc,
    cpu.ir & 0xff00, +cpu.iff1, cpu.im, +cpu.halted, p.bank, p.rom, +p.shadowScreen, ...psg
  ];
  return `${h.toString(16)}:${state.join(",")}`;
}

async function roundTrip(model: Sp128SessionModel, fdc: boolean) {
  // --- Record
  const s = await createSp128Session(model);
  s.runFrames(20);
  s.machine.pc = await loadProgram(s, fdc);
  const samples = new Map<number, string>();
  const start = s.frames;
  s.startRzxRecording({ autosaveFrames: 0 });
  for (let i = 1; i <= 200; i++) {
    if (i === 40) s.keyDown("A");
    if (i === 70) s.keyUp("A");
    s.runFrames(1);
    if (i % 50 === 0) {
      const fp = fingerprint(s);
      if (fp) samples.set(i, fp);
    }
  }
  const final = fingerprint(s);
  const bytes = s.stopRzxRecording();
  expect(s.frames - start).toBe(200);

  // --- Play on a fresh machine, with other keys held
  const p = await createSp128Session(model);
  p.keyDown("Space", "N5");
  p.playRzx(bytes);
  const seen = new Map<number, string>();
  const stop = p.runRzx({ onFrame: () => samples.has(p.frames) && seen.set(p.frames, fingerprint(p)!) });
  expect(stop.kind).toBe("ended");
  expect(p.frames).toBe(200);
  expect(samples.size).toBe(4);
  for (const [frame, fp] of samples) expect(seen.get(frame), `state at frame ${frame}`).toBe(fp);
  expect(fingerprint(p)).toBe(final);
  return parseRzxFile(bytes);
}

describe("RZX round trip on the 128K and the +2E/+3E", () => {
  it("128K: paging, AY register reads, the keyboard", async () => {
    const file = await roundTrip("sp128", false);
    const frames = rzxSegments(file)[0].inputs[0].frames;
    expect(frames.some((f) => f.ins.length > 100)).toBe(true);
  }, 120_000);

  it("+2E/+3E with a drive: the FDC status poll as well", async () => {
    await roundTrip("fdd1", true);
  }, 120_000);

  it("+2E/+3E without a drive", async () => {
    await roundTrip("nofdd", false);
  }, 120_000);
});
