/*
 * Saving snapshots from the real 48K, 128K and +2E/+3E WASM cores
 * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` Phase 2). Runs in the e2e-cores tier.
 *
 * The central check is "save, load into a fresh machine, run" equals "keep running": a program is
 * run to an odd point in a frame, saved, loaded into a second machine, and both then run the same
 * frames; RAM, registers, paging and the AY must agree.
 */
import { describe, expect, it } from "vitest";
import { createSp48Session } from "../../harness/sp48";
import { createSp128Session, type Sp128SessionModel } from "../../harness/sp128";
import { SnapshotRefusedError } from "@common/spectrum/snapshot/snapshotBytes";
import { BANK, buildSzx, state128, state48, szxBlock, type TestState } from "./builders";

/*
 * An IM 2 program (as in the load tests): the main loop at $8100, the vector table at $9000, and a
 * handler at $9292 that counts interrupts at $A000 and, on a 128K, also writes an AY register.
 *   $8100  INC A / LD ($A010),A / JR $8100     ; busy, so every frame ends somewhere new
 *   $9292  LD HL,$A000 / INC (HL) / EI / RETI
 */
const MAIN = 0x8100;
const HANDLER = 0x9292;
const COUNTER = 0xa000;

function programBank2(halt = false): Uint8Array {
  const b = new Uint8Array(BANK);
  b.set(halt ? [0x76, 0x18, 0xfd] : [0x3c, 0x32, 0x10, 0xa0, 0x18, 0xfa], MAIN - 0x8000);
  b.fill(0x92, 0x1000, 0x1101);
  b.set([0x21, 0x00, 0xa0, 0x34, 0xfb, 0xed, 0x4d], HANDLER - 0x8000);
  return b;
}

function programState(base: TestState, halt = false): TestState {
  const ram = new Map(base.ram);
  ram.set(2, programBank2(halt));
  return { ...base, ram, pc: MAIN, sp: 0xff00, i: 0x90, im: 2, iff1: true, iff2: true };
}

type Session48 = Awaited<ReturnType<typeof createSp48Session>>;
type Session128 = Awaited<ReturnType<typeof createSp128Session>>;

/** Everything compared between the two machines of a 48K test */
function fingerprint48(s: Session48) {
  const m = s.machine;
  const w = m.wasmV2Runtime!.exports;
  const ram: number[] = [];
  for (let a = 0x4000; a < 0x10000; a++) ram.push(s.peek(a));
  return {
    regs: [m.af, m.bc, m.de, m.hl, m.af_, m.bc_, m.de_, m.hl_, m.ix, m.iy, m.sp, m.pc, m.ir],
    iff: [w.sp48GetCpuIff1(), w.sp48GetCpuIff2(), w.sp48GetCpuInterruptMode()],
    halted: w.sp48GetCpuHalted(),
    frameTact: w.sp48GetCurrentFrameTact(),
    border: w.sp48GetBorderColor(),
    ram
  };
}

function fingerprint128(s: Session128) {
  const banks: Uint8Array[] = [];
  for (let b = 0; b < 8; b++) banks.push(s.bank(b).slice());
  const psg: number[] = [];
  for (let r = 0; r < 16; r++) psg.push(s.psgRegister(r));
  return {
    cpu: s.cpu(),
    paging: s.paging(),
    frameTact: s.frameTact(),
    border: s.border(),
    psg,
    selected: s.psgSelected(),
    banks
  };
}

describe("48K: saving", () => {
  // --- fingerprint48 leaves out MEMPTR (WZ), which .z80 and .sna do not hold
  it.each(["szx", "z80", "sna"] as const)(
    "a .%s saved mid-frame and loaded into a fresh machine continues identically",
    async (format) => {
      const a = await createSp48Session();
      a.loadSnapshot("p.szx", buildSzx(programState(state48()), { machineId: 1 }));
      a.runFrames(3).step(1237);
      // --- .sna has no frame position and .z80 keeps it; only .szx and .z80 continue exactly
      const { bytes, losses } = a.saveSnapshot(format);
      const b = await createSp48Session();
      b.loadSnapshot(`p.${format}`, bytes);

      if (format === "sna") {
        // --- A .sna restarts at the start of a frame: same registers and RAM, frame tact 0
        expect(losses.join()).toMatch(/frame position/);
        const fa = fingerprint48(a);
        const fb = fingerprint48(b);
        expect(fb.regs).toEqual(fa.regs);
        expect(fb.frameTact).toBe(0);
        // --- Only the two stack bytes below SP differ (the pushed PC)
        const diffs = fa.ram.flatMap((v, i) => (v !== fb.ram[i] ? [i + 0x4000] : []));
        expect(diffs.every((addr) => addr === a.machine.sp - 2 || addr === a.machine.sp - 1)).toBe(true);
        return;
      }
      expect(losses).toEqual([]);
      expect(fingerprint48(b)).toEqual(fingerprint48(a));
      a.runFrames(10);
      b.runFrames(10);
      expect(fingerprint48(b)).toEqual(fingerprint48(a));
      expect(a.peek(COUNTER)).toBeGreaterThan(10);
    }
  );

  it("does not change the machine it saves", async () => {
    const a = await createSp48Session();
    const b = await createSp48Session();
    const file = buildSzx(programState(state48()), { machineId: 1 });
    a.loadSnapshot("p.szx", file);
    b.loadSnapshot("p.szx", file);
    a.runFrames(2).step(500);
    b.runFrames(2).step(500);
    a.saveSnapshot("szx");
    a.saveSnapshot("sna");
    a.runFrames(5);
    b.runFrames(5);
    expect(fingerprint48(a)).toEqual(fingerprint48(b));
  });

  it("captures the frame position the core reports", async () => {
    const s = await createSp48Session();
    s.loadSnapshot("p.szx", buildSzx(programState(state48()), { machineId: 1 }));
    s.runFrames(1).step(777);
    const w = s.machine.wasmV2Runtime!.exports;
    expect(s.captureSnapshot().ula.frameTact).toBe(w.sp48GetCurrentFrameTact());
    expect(s.captureSnapshot().ula.frameTact).toBeGreaterThan(0);
  });

  it("captures HALT, and a halted machine resumes identically", async () => {
    const a = await createSp48Session();
    a.loadSnapshot("p.szx", buildSzx(programState(state48(), true), { machineId: 1 }));
    a.runFrames(1).step(300);
    const snap = a.captureSnapshot();
    expect(snap.cpu.halted).toBe(true);
    expect(snap.cpu.pc).toBe(MAIN);
    const b = await createSp48Session();
    b.loadSnapshot("p.szx", a.saveSnapshot("szx").bytes);
    a.runFrames(4);
    b.runFrames(4);
    expect(fingerprint48(b)).toEqual(fingerprint48(a));
  });

  it("captures the EI delay right after EI, and only then", async () => {
    const s = await createSp48Session();
    s.loadSnapshot("p.szx", buildSzx(programState(state48()), { machineId: 1 }));
    for (let i = 0; i < 100000 && s.machine.pc !== HANDLER + 5; i++) s.step();
    expect(s.machine.pc).toBe(HANDLER + 5); // --- just past EI
    expect(s.captureSnapshot().cpu.suppressInterrupt).toBe(true);
    expect(s.saveSnapshot("z80").losses.join()).toMatch(/EI/);
    s.step(); // --- RETI's ED prefix: the opcode is still to come, so no format can hold it
    expect(() => s.captureSnapshot()).toThrow(/prefix/);
    s.step(); // --- RETI completes, and the delay is over
    expect(s.captureSnapshot().cpu.suppressInterrupt).toBe(false);
  });

  it("keeps IFF2 apart from IFF1 in .szx and .z80", async () => {
    const s = await createSp48Session();
    s.loadSnapshot("p.szx", buildSzx(state48({ iff1: false, iff2: true, pc: 0x8000 }), { machineId: 1 }));
    for (const f of ["szx", "z80"] as const) {
      const b = await createSp48Session();
      b.loadSnapshot(`p.${f}`, s.saveSnapshot(f).bytes);
      const w = b.machine.wasmV2Runtime!.exports;
      expect([w.sp48GetCpuIff1(), w.sp48GetCpuIff2()]).toEqual([0, 1]);
    }
  });

  it("refuses a .sna whose PC push would land in ROM", async () => {
    const s = await createSp48Session();
    s.loadSnapshot("p.szx", buildSzx(state48({ sp: 0x4001, pc: 0x8000 }), { machineId: 1 }));
    expect(() => s.saveSnapshot("sna")).toThrow(SnapshotRefusedError);
  });
});

describe.each<Sp128SessionModel>(["sp128", "nofdd", "fdd1", "fdd2"])("%s: saving", (model) => {
  const machineId = model === "sp128" ? 2 : 6;
  const p3 = model === "fdd1" || model === "fdd2";
  const extra = p3 ? [szxBlock("+3", [model === "fdd2" ? 2 : 1, 0])] : [];

  async function running(over: Partial<TestState> = {}): Promise<Session128> {
    const s = await createSp128Session(model);
    const t = { ...programState(state128()), port7ffd: 0x13, ...over };
    s.loadSnapshot("p.szx", buildSzx(t, { machineId, extra }));
    s.runFrames(3).step(2001);
    return s;
  }

  it.each(["szx", "z80"] as const)("a .%s continues identically in a fresh machine", async (format) => {
    const a = await running();
    const { bytes, losses } = a.saveSnapshot(format);
    if (format === "szx") expect(losses).toEqual([]);
    const b = await createSp128Session(model);
    b.loadSnapshot(`p.${format}`, bytes);
    // --- .z80 has no MEMPTR (WZ); the next instruction that uses it rewrites it
    const same = (x: Session128) => {
      const f = fingerprint128(x);
      return format === "z80" ? { ...f, cpu: { ...f.cpu, wz: 0 } } : f;
    };
    expect(same(b)).toEqual(same(a));
    a.runFrames(8);
    b.runFrames(8);
    expect(fingerprint128(b)).toEqual(fingerprint128(a));
  });

  it("captures $7FFD exactly, and a locked machine reloads locked", async () => {
    const a = await running({ port7ffd: 0x3c }); // --- bank 4, shadow screen, ROM 1, locked
    const snap = a.captureSnapshot();
    expect(snap.paging?.port7ffd).toBe(0x3c);
    const b = await createSp128Session(model);
    b.loadSnapshot("p.szx", a.saveSnapshot("szx").bytes);
    expect(b.paging()).toEqual(a.paging());
    // --- A later $7FFD write is ignored
    const w = b.machine.wasmV2Runtime!.exports as unknown as Record<string, (...a: number[]) => number>;
    w[(model === "sp128" ? "sp128" : "spp3e") + "WritePort"](0x7ffd, 0x00);
    expect(b.paging()).toEqual(a.paging());
  });

  it("captures the AY registers and the selected register", async () => {
    const a = await running();
    const snap = a.captureSnapshot();
    expect(snap.ay?.regs[7]).toBe(0x38);
    expect(snap.ay?.selected).toBe(7);
  });

  if (model !== "sp128") {
    it("captures $1FFD exactly (special paging, motor)", async () => {
      const a = await running({ port1ffd: 0x0d });
      const snap = a.captureSnapshot();
      expect(snap.paging?.port1ffd).toBe(0x0d);
      const b = await createSp128Session(model);
      b.loadSnapshot("p.szx", a.saveSnapshot("szx").bytes);
      expect(b.paging()).toEqual(a.paging());
      expect(() => a.saveSnapshot("sna")).toThrow(/special paging/);
    });

    it("names the machine so it maps back to the same model", async () => {
      const a = await running();
      const snap = a.captureSnapshot();
      expect(snap.machine).toBe("plus3e");
      expect(snap.peripherals.plus3?.drives).toBe(p3 ? (model === "fdd2" ? 2 : 1) : undefined);
    });
  }
});
