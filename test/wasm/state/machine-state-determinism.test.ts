/*
 * The determinism proof of Klive state files (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md`
 * Phase 6), on every WASM core:
 *
 *   1. machine A runs a busy workload and stops at an odd point inside a frame;
 *   2. its state is saved;
 *   3. A runs N more frames;
 *   4. machine B - a separate instance that has been running something else, so its volatile
 *      buffers, frame counters and host caches all differ - loads the state and runs the same N frames;
 *   5. both machines' whole memory images, and their CPU registers, are equal byte for byte.
 *
 * Any machine state outside linear memory, or anything in a "volatile" static the core actually
 * reads, shows up here as a difference. This is also the reusable check the reverse-debugging work
 * (G4.4) builds on.
 */
import { describe, expect, it } from "vitest";
import type { MachineStateParts } from "@emu/machines/state/wasmStateImage";
import { MachineStateMismatchError } from "@emu/machines/state/wasmStateImage";
import { createSp48Session } from "../../harness/sp48";
import { createSp128Session, type Sp128SessionModel } from "../../harness/sp128";
import { createTimexSession } from "../../harness/timex";
import { createZ88Session } from "../../harness/z88";
import { createZx81Session } from "../../harness/zx81";
import { createSession as createNextSession } from "../../harness/zxnext";
import { BANK, buildSzx, state128, state48, szxBlock } from "../../spectrum/snapshot/builders";
import { expectSameBytes } from "../../expectBytes";

/** What every machine under test offers */
type StateMachine = {
  saveMachineState(): MachineStateParts;
  loadMachineState(parts: MachineStateParts): void;
  setHistoryEnabled(enabled: boolean): void;
  pc: number;
  sp: number;
  af: number;
  ir: number;
};

type Driver = {
  machine: StateMachine;
  runFrames(n: number): unknown;
  step(n?: number): unknown;
};

/** The state that must be equal: the memory image (volatile statics zeroed) and the registers */
function fingerprint(m: StateMachine) {
  const parts = m.saveMachineState();
  return { image: parts.image, regs: [m.pc, m.sp, m.af, m.ir] };
}

/**
 * Steps 1-5 above. A records execution history and B does not
 * (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` T10): the recorder writes only volatile memory, so
 * the images are still equal.
 */
function proveDeterminism(a: Driver, b: Driver, frames: number): void {
  a.machine.setHistoryEnabled(true);
  b.machine.setHistoryEnabled(false);
  const saved = a.machine.saveMachineState();
  a.runFrames(frames);
  b.runFrames(3);
  b.step(17);
  b.machine.loadMachineState(saved);
  b.runFrames(frames);
  const fa = fingerprint(a.machine);
  const fb = fingerprint(b.machine);
  expect(fb.regs).toEqual(fa.regs);
  // --- Compare the images without printing megabytes on a failure
  expectSameBytes(fb.image, fa.image, "the images");
}

/*
 * The Spectrum workload: an IM 2 program that counts interrupts, keeps the CPU busy, and on the
 * 128K models writes the AY and pages banks every interrupt.
 *   $8100  INC A / LD ($A010),A / JR $8100
 *   $9292  LD HL,$A000 / INC (HL) / LD A,(HL) / AND 7 / OR $10 / LD BC,$7FFD / OUT (C),A
 *          / LD BC,$FFFD / LD A,8 / OUT (C),A / LD B,$BF / LD A,(HL) / OUT (C),A / EI / RETI
 */
function spectrumProgram(paged: boolean): Uint8Array {
  const b = new Uint8Array(BANK);
  b.set([0x3c, 0x32, 0x10, 0xa0, 0x18, 0xfa], 0x0100);
  b.fill(0x92, 0x1000, 0x1101);
  const handler = paged
    ? [
        0x21, 0x00, 0xa0, 0x34, 0x7e, 0xe6, 0x07, 0xf6, 0x10, 0x01, 0xfd, 0x7f, 0xed, 0x79,
        0x01, 0xfd, 0xff, 0x3e, 0x08, 0xed, 0x79, 0x06, 0xbf, 0x7e, 0xed, 0x79, 0xfb, 0xed, 0x4d
      ]
    : [0x21, 0x00, 0xa0, 0x34, 0xfb, 0xed, 0x4d];
  b.set(handler, 0x1292);
  return b;
}

function spectrumSnapshot(paged: boolean, machineId: number, extra: number[][] = []): Uint8Array {
  const base = paged ? state128({ port7ffd: 0x10 }) : state48();
  const ram = new Map(base.ram);
  ram.set(2, spectrumProgram(paged));
  // --- The Scorpion (machine 10) has sixteen banks
  if (machineId === 10) for (let bank = 8; bank < 16; bank++) ram.set(bank, new Uint8Array(BANK).fill(bank));
  return buildSzx(
    { ...base, ram, pc: 0x8100, sp: 0xff00, i: 0x90, im: 2, iff1: true, iff2: true },
    { machineId, extra }
  );
}

describe("machine state: save, load into another machine, run = keep running", () => {
  it("ZX Spectrum 48K", async () => {
    const a = await createSp48Session();
    const b = await createSp48Session();
    a.loadSnapshot("p.szx", spectrumSnapshot(false, 1));
    b.bootToBasic();
    a.runFrames(4).step(1237);
    proveDeterminism(a as unknown as Driver, b as unknown as Driver, 25);
    expect(a.peek(0xa000)).toBeGreaterThan(20);
  });

  it("Timex Computer 2048 (in the 64-column mode)", async () => {
    const a = await createTimexSession();
    const b = await createTimexSession();
    // --- machine id 8 with an SCLD block: the 64-column mode, ink 5
    a.loadSnapshot("p.szx", spectrumSnapshot(false, 8, [szxBlock("SCLD", [0x00, 0x2e])]));
    b.bootToBasic();
    a.runFrames(4).step(1237);
    expect(a.portFf).toBe(0x2e);
    proveDeterminism(a as unknown as Driver, b as unknown as Driver, 25);
    expect(b.portFf).toBe(0x2e);
    expect(a.peek(0xa000)).toBeGreaterThan(20);
  });

  it("Timex Sinclair 2068 (a cartridge chunk mapped, the AY running)", async () => {
    const a = await createTimexSession({ model: "ts2068" });
    const b = await createTimexSession({ model: "ts2068" });
    // --- machine id 12; chunk 6 from cartridge RAM; an AY tone
    const dock = [0x06, 0x00, 0x06, ...new Array(0x2000).fill(0)];
    const ay = [0x00, 0x07, 0x40, 0x00, 0, 0, 0, 0, 0, 0x3e, 0x0f, 0, 0, 0, 0, 0, 0, 0];
    a.loadSnapshot("p.szx", spectrumSnapshot(false, 12, [szxBlock("SCLD", [0x40, 0x00]), szxBlock("DOCK", dock), szxBlock("AY", ay)]));
    b.bootToBasic();
    a.runFrames(4).step(1237);
    expect(a.exports.timexGetPortF4()).toBe(0x40);
    proveDeterminism(a as unknown as Driver, b as unknown as Driver, 25);
    expect(b.exports.timexGetChunkSource(6)).toBe(1);
    expect(a.peek(0xa000)).toBeGreaterThan(20);
  });

  it.each<Sp128SessionModel>(["sp128", "nofdd", "fdd1", "scorpion"])("ZX Spectrum 128K / +3E / Scorpion (%s)", async (model) => {
    const a = await createSp128Session(model);
    const b = await createSp128Session(model);
    const machineId = model === "sp128" ? 2 : model === "scorpion" ? 10 : 6;
    const extra = model === "fdd1" ? [szxBlock("+3", [1, 0])] : [];
    a.loadSnapshot("p.szx", spectrumSnapshot(true, machineId, extra));
    a.runFrames(4).step(2001);
    proveDeterminism(a as unknown as Driver, b as unknown as Driver, 25);
  });

  it("ZX81", async () => {
    const a = await createZx81Session();
    const b = await createZx81Session();
    a.bootToBasic();
    a.typeKeys("10 PRINT 1");
    a.runFrames(7).step(333);
    proveDeterminism(a as unknown as Driver, b as unknown as Driver, 30);
  });

  it("Cambridge Z88", async () => {
    const a = await createZ88Session();
    const b = await createZ88Session();
    a.runFrames(60).step(4321);
    proveDeterminism(a as unknown as Driver, b as unknown as Driver, 40);
  });

  it("ZX Spectrum Next", async () => {
    const a = await createNextSession();
    const b = await createNextSession();
    // --- No SD card in the script tier: a loaded program instead of a boot. It writes the border,
    // --- a NextReg (palette index), the beeper and banked memory, and plays a note on the AY
    await a.loadCode(`
      .org $8000
start:
      ld bc,$fffd
      ld a,7
      out (c),a
      ld b,$bf
      ld a,$3e
      out (c),a
loop:
      inc a
      out ($fe),a
      nextreg $40,a
      ld hl,$c000
      ld (hl),a
      inc hl
      ld (hl),a
      jr loop
`);
    a.runFrames(6).step(999);
    proveDeterminism(a as unknown as Driver, b as unknown as Driver, 20);
  });

  /*
   * The layer debug view is debugging state (`.plans/LAYER_COMPOSITION_PLAN.md` D2, T8): A hides the
   * ULA, captures, recomposes and probes; B does none of it. Everything but the picture - which the
   * mask is meant to change - must still be equal, and neither machine takes the other's view.
   */
  it("ZX Spectrum Next with a layer hidden, capture on and a probe (only on one machine)", async () => {
    const a = await createNextSession();
    const b = await createNextSession();
    await a.loadCode(`
      .org $8000
start:
      inc a
      out ($fe),a
      nextreg $40,a
      nextreg $15,a
      ld ($c000),a
      jr start
`);
    a.setLayerDebug({ hide: ["ula"], showTransparent: true }).setLayerCapture(true);
    a.runFrames(4).step(777);
    a.recomposeLayers();
    a.probePixel(300, 120);
    const saved = a.machine.saveMachineState();
    a.runFrames(12);
    a.recomposeLayers();
    a.probePixel(10, 10);
    b.runFrames(3);
    b.machine.loadMachineState(saved);
    b.runFrames(12);
    expect(b.layerDebug()).toEqual({ hidden: 0, solo: 0, showTransparent: false });
    expect(a.layerDebug()).toEqual({ hidden: 1, solo: 0, showTransparent: true });
    const fa = fingerprint(a.machine as unknown as StateMachine);
    const fb = fingerprint(b.machine as unknown as StateMachine);
    expect(fb.regs).toEqual(fa.regs);
    // --- The picture differs by design (A's ULA is hidden): blank it in both, compare the rest
    const pixels = a.machine.wasmV2Runtime!.exports.zxnextPixelBufferPtr();
    const pixelBytes = a.machine.wasmV2Runtime!.pixelBuffer.byteLength;
    fa.image.fill(0, pixels, pixels + pixelBytes);
    fb.image.fill(0, pixels, pixels + pixelBytes);
    expectSameBytes(fb.image, fa.image, "the images");
  });
});

describe("machine state: refusals", () => {
  it("refuses a state of another core", async () => {
    const sp48 = await createSp48Session();
    const sp128 = await createSp128Session("sp128");
    const parts = sp48.machine.saveMachineState();
    expect(() => sp128.machine.loadMachineState(parts)).toThrow(MachineStateMismatchError);
    expect(() => sp128.machine.loadMachineState(parts)).toThrow(/sp48 core/);
  });

  it("refuses a state from another memory layout, and leaves the machine untouched", async () => {
    const a = await createSp48Session();
    a.bootToBasic();
    const parts = { ...a.machine.saveMachineState(), fingerprint: "0".repeat(32) };
    const before = a.machine.saveMachineState().image;
    expect(() => a.machine.loadMachineState(parts)).toThrow(/memory layout/);
    expectSameBytes(a.machine.saveMachineState().image, before, "the images");
  });

  it("keeps the live core's breakpoint conditions (volatile) across a restore", async () => {
    const a = await createZx81Session();
    a.bootToBasic();
    const saved = a.machine.saveMachineState();
    a.breakpoint(0x0038);
    a.machine.loadMachineState(saved);
    // --- The breakpoint set after the save is still in the core's flags: the run stops on it
    expect(a.debug("continue", { maxFrames: 5 })).toBe(0x0038);
  });
});
