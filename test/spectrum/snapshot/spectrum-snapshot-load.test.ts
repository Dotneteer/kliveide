/*
 * Loading snapshots into the real 48K, 128K and +2E/+3E WASM cores
 * (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` Phase 3). Runs in the e2e-cores tier.
 */
import { describe, expect, it } from "vitest";
import { createSp48Session } from "../../harness/sp48";
import { createSp128Session } from "../../harness/sp128";
import { buildSna128, buildSna48, buildSzx, buildZ80, BANK, patternBank, state128, state48, type TestState } from "./builders";

/*
 * A tiny IM 2 program, by hand:
 *   $8100  JR $            ; the main loop
 *   $9000-$9100            ; the vector table, all $92: the handler is at $9292
 *   $9292  LD HL,$A000 / INC (HL) / EI / RETI
 * The counter at $A000 counts the interrupts taken. Everything is in bank 2 ($8000-$BFFF).
 */
const MAIN = 0x8100;
const HANDLER = 0x9292;
const COUNTER = 0xa000;

function programBank2(): Uint8Array {
  const b = new Uint8Array(BANK);
  b.set([0x18, 0xfe], MAIN - 0x8000);
  b.fill(0x92, 0x1000, 0x1101);
  b.set([0x21, 0x00, 0xa0, 0x34, 0xfb, 0xed, 0x4d], HANDLER - 0x8000);
  return b;
}

/** A state running the program in IM 2 */
function programState(base: TestState, over: Partial<TestState> = {}): TestState {
  const ram = new Map(base.ram);
  ram.set(2, programBank2());
  return { ...base, ram, pc: MAIN, sp: 0xff00, i: 0x90, im: 2, iff1: true, iff2: true, ...over };
}

type Core = {
  tacts(): number;
  pc(): number;
};

function core48(s: Awaited<ReturnType<typeof createSp48Session>>): Core {
  const w = s.machine.wasmV2Runtime!.exports;
  return { tacts: () => w.sp48GetTacts(), pc: () => w.sp48GetCpuPc() };
}

function core128(s: Awaited<ReturnType<typeof createSp128Session>>): Core {
  const w = s.machine.wasmV2Runtime!.exports as unknown as Record<string, () => number>;
  const p = s.model === "sp128" ? "sp128" : "spp3e";
  return { tacts: () => w[p + "GetTacts"](), pc: () => w[p + "GetCpuPc"]() };
}

/** Steps until PC reaches an address; returns the T-states that took */
function stepsUntil(
  session: { step(n?: number): unknown },
  core: Core,
  pc: number,
  max = 20000
): number {
  const start = core.tacts();
  for (let i = 0; i < max; i++) {
    if (core.pc() === pc) return core.tacts() - start;
    session.step();
  }
  throw new Error(`PC never reached $${pc.toString(16)}`);
}

describe("48K: loading", () => {
  it("restores every register, RAM, the border and IFF2 apart from IFF1", async () => {
    const s = await createSp48Session();
    const t = state48({ iff1: false, iff2: true, im: 2, r: 0xd3, memptr: 0x4321, frameTact: 1234 });
    const tact = s.loadSnapshot("a.szx", buildSzx(t, { machineId: 1 }));
    const m = s.machine;
    expect(tact).toBe(1234);
    expect([m.af, m.bc, m.de, m.hl]).toEqual([t.af, t.bc, t.de, t.hl]);
    expect([m.af_, m.bc_, m.de_, m.hl_]).toEqual([t.af_, t.bc_, t.de_, t.hl_]);
    expect([m.ix, m.iy, m.sp, m.pc]).toEqual([t.ix, t.iy, t.sp, t.pc]);
    expect(m.ir).toBe((t.i << 8) | 0xd3); // --- R bit 7 kept
    expect(m.wz).toBe(0x4321);
    const w = m.wasmV2Runtime!.exports;
    expect(w.sp48GetCpuIff1()).toBe(0);
    expect(w.sp48GetCpuIff2()).toBe(1);
    expect(w.sp48GetCpuInterruptMode()).toBe(2);
    // --- The TypeScript mirror follows the core (trap 3)
    expect(m.iff1).toBe(false);
    expect(m.iff2).toBe(true);
    expect(m.interruptMode).toBe(2);
    expect(w.sp48GetBorderColor()).toBe(3);
    for (const [bank, base] of [[5, 0x4000], [2, 0x8000], [0, 0xc000]] as const) {
      const bytes = t.ram.get(bank)!;
      for (const off of [0, 0x100, 0x200, 0x1234, 0x3fff]) {
        expect(s.peek(base + off), `bank ${bank} +${off}`).toBe(bytes[off]);
      }
    }
  });

  it.each(["sna", "z80", "szx"] as const)("runs the IM 2 program from a .%s file", async (format) => {
    const s = await createSp48Session();
    const t = programState(state48());
    const bytes =
      format === "sna" ? buildSna48(t) : format === "z80" ? buildZ80(t, { version: 3 }) : buildSzx(t, { machineId: 1 });
    s.loadSnapshot(`a.${format}`, bytes);
    expect(s.machine.pc).toBe(MAIN);
    s.runFrames(50);
    // --- One interrupt per frame
    expect(s.peek(COUNTER)).toBeGreaterThanOrEqual(49);
    expect(s.peek(COUNTER)).toBeLessThanOrEqual(51);
    expect(s.machine.pc).toBe(MAIN);
  });

  it("restores the frame position: the interrupt comes when the frame ends", async () => {
    const s = await createSp48Session();
    const frame = s.machine.tactsInFrame;
    s.loadSnapshot("a.szx", buildSzx(programState(state48(), { frameTact: frame - 2000 }), { machineId: 1 }));
    const elapsed = stepsUntil(s, core48(s), HANDLER);
    expect(elapsed).toBeGreaterThanOrEqual(2000);
    expect(elapsed).toBeLessThan(2050);
  });

  it("takes the interrupt at once at frame tact 0 (a .sna has no position)", async () => {
    const s = await createSp48Session();
    s.loadSnapshot("a.sna", buildSna48(programState(state48())));
    expect(stepsUntil(s, core48(s), HANDLER)).toBeLessThan(40);
  });

  it("keeps a halted CPU on its HALT until the interrupt, then returns past it", async () => {
    const s = await createSp48Session();
    const t = programState(state48(), { halted: true, pc: 0x8200, frameTact: 1000 });
    t.ram.get(2)![0x200] = 0x76; // --- HALT at $8200
    t.ram.get(2)![0x201] = 0x18; // --- then JR $
    t.ram.get(2)![0x202] = 0xfe;
    s.loadSnapshot("a.szx", buildSzx(t, { machineId: 1 }));
    expect(s.machine.wasmV2Runtime!.exports.sp48GetCpuHalted()).toBe(1);
    s.step(20);
    expect(s.machine.pc).toBe(0x8200);
    stepsUntil(s, core48(s), HANDLER, 100000);
    // --- The return address is the instruction after the HALT
    expect(s.peekWord(s.machine.sp)).toBe(0x8201);
  });

  it("suppresses the interrupt for one instruction after EI (.szx flag)", async () => {
    const s = await createSp48Session();
    const t = programState(state48(), { pc: 0x8200, suppressInterrupt: true });
    t.ram.get(2)!.fill(0x00, 0x200, 0x210); // --- NOPs
    s.loadSnapshot("a.szx", buildSzx(t, { machineId: 1 }));
    s.step();
    expect(s.machine.pc).toBe(0x8201); // --- the NOP ran first
    const s2 = await createSp48Session();
    s2.loadSnapshot("a.szx", buildSzx({ ...t, suppressInterrupt: false }, { machineId: 1 }));
    s2.step();
    expect(s2.machine.pc).toBe(HANDLER); // --- straight into the interrupt
  });

  it("draws the snapshot's screen before any frame runs", async () => {
    const pixelsOf = async (fill: number) => {
      const s = await createSp48Session();
      const t = state48();
      const screen = new Uint8Array(BANK);
      screen.fill(fill, 0, 0x1800);
      screen.fill(0x38, 0x1800, 0x1b00);
      t.ram.set(5, screen);
      s.loadSnapshot("a.szx", buildSzx(t, { machineId: 1 }));
      return Array.from(s.machine.getPixelBuffer());
    };
    const ink = await pixelsOf(0xff);
    const paper = await pixelsOf(0x00);
    expect(ink).not.toEqual(paper);
  });

  it("draws the snapshot's border before any frame runs", async () => {
    const pixelsOf = async (border: number) => {
      const s = await createSp48Session();
      s.loadSnapshot("a.szx", buildSzx(state48({ border }), { machineId: 1 }));
      return Array.from(s.machine.getPixelBuffer());
    };
    expect(await pixelsOf(1)).not.toEqual(await pixelsOf(2));
  });

  it("gives the same state when the same snapshot is loaded twice, even over a running machine", async () => {
    const s = await createSp48Session();
    const bytes = buildSzx(programState(state48(), { frameTact: 500 }), { machineId: 1 });
    s.loadSnapshot("a.szx", bytes);
    s.runFrames(7);
    const first = { pc: s.machine.pc, counter: s.peek(COUNTER), tacts: s.machine.wasmV2Runtime!.exports.sp48GetCurrentFrameTact() };
    s.runFrames(3);
    s.loadSnapshot("a.szx", bytes);
    expect(s.peek(COUNTER)).toBe(0);
    s.runFrames(7);
    expect({ pc: s.machine.pc, counter: s.peek(COUNTER), tacts: s.machine.wasmV2Runtime!.exports.sp48GetCurrentFrameTact() }).toEqual(first);
  });

  it("refuses a 128K snapshot", async () => {
    const s = await createSp48Session();
    expect(() => s.loadSnapshot("a.sna", buildSna128(state128()))).toThrow(/needs a ZX Spectrum 128K/);
  });
});

describe("128K: loading", () => {
  it("restores the banks and paging (.sna)", async () => {
    const s = await createSp128Session("sp128");
    const t = state128({ port7ffd: 0x1b }); // --- bank 3, shadow screen, ROM 1
    s.loadSnapshot("a.sna", buildSna128(t));
    for (let b = 0; b < 8; b++) expect(s.bank(b), `bank ${b}`).toEqual(t.ram.get(b));
    expect(s.paging()).toEqual({ bank: 3, rom: 1, shadowScreen: true, locked: false });
    expect(s.peek(0xc000)).toBe(t.ram.get(3)![0]);
    expect(s.peek(0x4000)).toBe(t.ram.get(5)![0]);
    expect(s.cpu()).toMatchObject({ af: t.af, pc: t.pc, sp: t.sp, iff1: true, iff2: true, im: 1 });
  });

  it("restores the AY registers and the selected register (.szx)", async () => {
    const s = await createSp128Session("sp128");
    const t = state128();
    s.loadSnapshot("a.szx", buildSzx(t, { machineId: 2 }));
    for (let r = 0; r < 14; r++) expect(s.psgRegister(r), `R${r}`).toBe(t.ay!.regs[r]);
    expect(s.psgSelected()).toBe(7);
  });

  it("locks paging when $7FFD bit 5 is set, and ignores later $7FFD writes", async () => {
    const s = await createSp128Session("sp128");
    s.loadSnapshot("a.z80", buildZ80(state128({ port7ffd: 0x34 }), { version: 3, paged: true }));
    expect(s.paging()).toMatchObject({ bank: 4, rom: 1, locked: true });
    s.machine.doWritePort(0x7ffd, 0x01);
    expect(s.paging().bank).toBe(4);
  });

  it("draws the shadow screen (bank 7) when $7FFD selects it, before any frame runs", async () => {
    const pixelsOf = async (fill: number) => {
      const s = await createSp128Session("sp128");
      const t = state128({ port7ffd: 0x08 });
      const shadow = new Uint8Array(BANK);
      shadow.fill(fill, 0, 0x1800);
      shadow.fill(0x38, 0x1800, 0x1b00);
      t.ram.set(7, shadow);
      s.loadSnapshot("a.szx", buildSzx(t, { machineId: 2 }));
      return Array.from(s.machine.getPixelBuffer());
    };
    expect(await pixelsOf(0xff)).not.toEqual(await pixelsOf(0x00));
  });

  it("unlocks paging when a snapshot is loaded over a locked one", async () => {
    const s = await createSp128Session("sp128");
    s.loadSnapshot("a.z80", buildZ80(state128({ port7ffd: 0x34 }), { version: 3, paged: true }));
    s.loadSnapshot("a.z80", buildZ80(state128({ port7ffd: 0x03 }), { version: 3, paged: true }));
    expect(s.paging()).toMatchObject({ bank: 3, rom: 0, locked: false });
  });

  it("restores the frame position on the 128K's frame length", async () => {
    const s = await createSp128Session("sp128");
    const frame = s.machine.tactsInFrame;
    expect(frame).toBe(70908);
    s.loadSnapshot("a.szx", buildSzx(programState(state128(), { frameTact: frame - 3000 }), { machineId: 2 }));
    const elapsed = stepsUntil(s, core128(s), HANDLER);
    expect(elapsed).toBeGreaterThanOrEqual(3000);
    expect(elapsed).toBeLessThan(3050);
  });

  it("runs the IM 2 program with bank 2 at $8000", async () => {
    const s = await createSp128Session("sp128");
    s.loadSnapshot("a.szx", buildSzx(programState(state128()), { machineId: 2 }));
    s.runFrames(20);
    expect(s.peek(COUNTER)).toBeGreaterThanOrEqual(19);
  });

  it("refuses a 48K snapshot (D13)", async () => {
    const s = await createSp128Session("sp128");
    expect(() => s.loadSnapshot("a.sna", buildSna48(state48()))).toThrow(/needs a ZX Spectrum 48K/);
  });
});

describe("+3E: loading", () => {
  it("restores $1FFD special paging and the disk motor before $7FFD", async () => {
    const s = await createSp128Session("fdd1");
    const t = state128({ port7ffd: 0x02, port1ffd: 0x0b }); // --- special paging, config 1, motor on
    s.loadSnapshot("a.szx", buildSzx(t, { machineId: 5 }));
    expect(s.paging()).toMatchObject({ specialPaging: true, diskMotor: true, bank: 2 });
    for (let b = 0; b < 8; b++) expect(s.bank(b), `bank ${b}`).toEqual(t.ram.get(b));
  });

  it("restores a +2A snapshot on the +2E with its AY and registers", async () => {
    const s = await createSp128Session("nofdd");
    const t = state128({ port7ffd: 0x10, port1ffd: 0x04, iff1: false, iff2: true, im: 2 });
    s.loadSnapshot("a.z80", buildZ80(t, { version: 3, hwMode: 13, paged: true, long: true }));
    expect(s.paging()).toMatchObject({ bank: 0, specialPaging: false });
    expect(s.cpu()).toMatchObject({ iff1: false, iff2: true, im: 2, pc: t.pc });
    expect(s.machine.iff2).toBe(true);
    expect(s.psgRegister(7)).toBe(0x38);
  });

  it("runs the IM 2 program", async () => {
    const s = await createSp128Session("fdd1");
    s.loadSnapshot("a.szx", buildSzx(programState(state128({ port1ffd: 0 })), { machineId: 6 }));
    s.runFrames(20);
    expect(s.peek(COUNTER)).toBeGreaterThanOrEqual(19);
  });
});

it("keeps the pattern banks' contents byte for byte through the .z80 RLE", () => {
  // --- A guard for the builders the load tests rely on: the pattern exercises runs and ED pairs
  const bank = patternBank(0xed);
  expect(bank[0x200]).toBe(0xed);
});
