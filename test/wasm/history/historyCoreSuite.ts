import { describe, expect, it } from "vitest";

import { historyContextDecoder } from "@common/history/contexts";
import { HistoryKind, type HistoryRecord } from "@common/history/historyRecord";
import { HISTORY_RECORD_SIZE, type ExecutionHistoryInfo } from "@common/history/historyTypes";
import type { IExecutionHistorySource } from "@emu/abstractions/IExecutionHistorySource";
import type { MachineStateParts } from "@emu/machines/state/wasmStateImage";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

import { historyFromOf, historyInfoOf, historyOf } from "../../harness/historySupport";

/*
 * The execution-history checks every Z80 core runs (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` §6),
 * written once and instantiated per core with its harness. The recorder is a debugger facility, not
 * hardware: the expectations come from the plan's decisions (a record is the state *before* its
 * instruction) and from what the CPU observably did - registers read by single-stepping, bytes
 * written into memory, the machine's own `getPartition`.
 */

/** The machine surface the suite reads: the history source, the registers and the partitions */
export type HistoryTestMachine = IExecutionHistorySource & {
  pc: number;
  sp: number;
  af: number;
  bc: number;
  de: number;
  hl: number;
  af_: number;
  bc_: number;
  de_: number;
  hl_: number;
  ix: number;
  iy: number;
  i: number;
  r: number;
  iff1: boolean;
  interruptMode: number;
  getPartition(address: number): number | undefined;
  saveMachineState(): MachineStateParts;
  loadMachineState(parts: MachineStateParts): void;
};

/** One core under test, driven through its harness session */
export type HistoryCoreDriver = {
  machine: HistoryTestMachine;
  /** Writes bytes into memory as the CPU sees it */
  poke(address: number, bytes: ArrayLike<number>): void;
  peek(address: number): number;
  /** Executes `count` whole instructions */
  step(count: number): void;
  runFrames(count: number): void;
};

export type HistoryCoreSpec = {
  /** The machine id the records' decoder is named by */
  machineId: string;
  create(): Promise<HistoryCoreDriver>;
  /** Where the suite's programs go: RAM the CPU sees at this address, unpaged, below $8000 on the ZX81 */
  codeBase: number;
  /** Executing a HALT leaves the CPU in halted cycles the recorder sees (false: the Z88 snoozes) */
  halts?: boolean;
  /**
   * A program that changes the paging as it runs, in Klive assembler, starting at `codeBase` with
   * `Start`: the partition check (D4) steps through it. Omitted: a machine without paging.
   */
  pagingProgram?: (base: number) => string;
  /** Instructions the partition check steps through */
  pagingSteps?: number;
  /** The ring's capacity */
  capacity?: number;
};

const CAPACITY = 65536;

/** Assembles Klive Z80 source into bytes, per segment */
export async function assemble(source: string): Promise<{ segments: [number, number[]][]; symbol(name: string): number }> {
  const output = await new Z80Assembler().compile(source, new AssemblerOptions());
  const errors = output.errors.filter((e) => !e.isWarning);
  if (errors.length) throw new Error(errors.map((e) => `line ${e.line}: ${e.message}`).join("\n"));
  return {
    segments: output.segments.filter((s) => s.emittedCode.length).map((s) => [s.startAddress, s.emittedCode]),
    symbol: (name: string) => output.getSymbol(name)!.value.value as number
  };
}

/** Loads a program, points PC at `Start` and SP below the code, and empties the ring with recording on */
export async function loadRecording(d: HistoryCoreDriver, base: number, source: string): Promise<(name: string) => number> {
  const program = await assemble(source);
  for (const [address, bytes] of program.segments) d.poke(address, bytes);
  d.machine.pc = program.symbol("Start");
  d.machine.sp = (base + 0x1f00) & 0xffff;
  d.machine.setHistoryEnabled(true);
  d.machine.clearHistory();
  return program.symbol;
}

export function history(d: HistoryCoreDriver, count?: number): HistoryRecord[] {
  return historyOf(d.machine, count);
}

export function historyInfo(d: HistoryCoreDriver): ExecutionHistoryInfo {
  return historyInfoOf(d.machine);
}

const hex = (value: number) => `$${value.toString(16).padStart(4, "0")}`;

/** The suite: `describe` it once per core */
export function describeHistoryCore(name: string, spec: HistoryCoreSpec): void {
  const base = spec.codeBase;
  const data = base + 0x0100;
  const capacity = spec.capacity ?? CAPACITY;

  describe(`execution history on ${name}: one record per instruction`, () => {
    it("records DD CB d op as one record with every byte (T1)", async () => {
      const d = await spec.create();
      await loadRecording(
        d,
        base,
        `
        .org ${base}
Start:  ld ix,${data}
        set 0,(ix+5)
        nop
        jr $`
      );
      d.step(3);
      const records = history(d);
      expect(records.map((r) => r.kind)).toEqual([0, 0, 0]);
      expect(records.map((r) => r.regs.pc)).toEqual([base, base + 4, base + 8]);
      expect(records[0].bytes.slice(0, 4)).toEqual([0xdd, 0x21, data & 0xff, data >> 8]);
      expect(records[1].bytes).toEqual([0xdd, 0xcb, 0x05, 0xc6]);
      expect(records[2].bytes[0]).toBe(0x00);
      expect(d.peek(data + 5) & 0x01).toBe(1);
    });

    it("holds the registers the CPU had before each instruction, R included", async () => {
      const d = await spec.create();
      await loadRecording(
        d,
        base,
        `
        .org ${base}
Start:  ld a,$12
        ld bc,$3456
        add a,c
        exx
        ld hl,$abcd
        push hl
        ex af,af'
        ld i,a
        ld de,$0102
        jr $`
      );
      const m = d.machine;
      const seen: Record<string, number | boolean>[] = [];
      for (let i = 0; i < 9; i++) {
        seen.push({
          pc: m.pc, af: m.af, bc: m.bc, de: m.de, hl: m.hl, af_: m.af_, bc_: m.bc_, de_: m.de_, hl_: m.hl_,
          ix: m.ix, iy: m.iy, sp: m.sp, ir: (m.i << 8) | m.r, iff1: m.iff1, im: m.interruptMode
        });
        d.step(1);
      }
      const records = history(d);
      expect(records).toHaveLength(9);
      records.forEach((r, i) => {
        const live = seen[i];
        const what = `record ${i} at ${hex(live.pc as number)}`;
        expect(
          {
            pc: r.regs.pc, af: r.regs.af, bc: r.regs.bc, de: r.regs.de, hl: r.regs.hl, af_: r.regs.af_, bc_: r.regs.bc_,
            de_: r.regs.de_, hl_: r.regs.hl_, ix: r.regs.ix, iy: r.regs.iy, sp: r.regs.sp, ir: r.regs.ir,
            iff1: r.regs.iff1, im: r.regs.interruptMode
          },
          what
        ).toEqual(live);
      });
      expect(records.map((r) => r.sequence - records[0].sequence)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it("captures the bytes a self-modifying program actually executed", async () => {
      const d = await spec.create();
      const symbol = await loadRecording(
        d,
        base,
        `
        .org ${base}
Start:  ld a,$3c          ; "inc a"
        ld (Patch),a
Patch:  nop
        ld a,$00
        ld (Patch),a
        jr $`
      );
      d.step(5);
      const patched = history(d).find((r) => r.regs.pc === symbol("Patch"))!;
      expect(patched.bytes[0], "the patched opcode, not today's").toBe(0x3c);
      expect(d.peek(symbol("Patch"))).toBe(0x00);
    });
  });

  describe(`execution history on ${name}: events`, () => {
    /** IM 2 with a 257-byte table of V at T: every vector lands on VV */
    const table = (data + 0x0100) & 0xff00;
    const v = (table >> 8) + 1;
    const isr = (v << 8) | v;
    const IM2 = `
        .org ${base}
Start:  di
        ld a,${table >> 8}
        ld i,a
        ld hl,${table}
        ld (hl),${v}
        ld de,${table + 1}
        ld bc,256
        ldir
        im 2
        ei
Loop:   inc b
        jr Loop
        .org ${isr}
Isr:    ei
        reti`;

    it("records an INT acknowledge with the interrupted PC; the ISR's first instruction follows", async () => {
      const d = await spec.create();
      const symbol = await loadRecording(d, base, IM2);
      d.runFrames(3);
      const records = history(d, 20000);
      const at = records.findIndex((r) => r.kind === HistoryKind.Int);
      expect(at, "an INT record").toBeGreaterThan(0);
      const int = records[at];
      expect([symbol("Loop"), symbol("Loop") + 1, symbol("Loop") + 2, isr, isr + 1]).toContain(int.regs.pc);
      expect(int.regs.interruptMode).toBe(2);
      expect(records[at + 1].kind).toBe(HistoryKind.Instruction);
      expect(records[at + 1].regs.pc).toBe(isr);
      // --- The acknowledge pushed the interrupted PC
      expect(records[at + 1].regs.sp).toBe((int.regs.sp - 2) & 0xffff);
      // --- The viewer folds the INT, EI and RETI into one row (D10)
      const span = d.machine.getHistoryServiceSpans()!.find((s) => s.first === int.sequence);
      expect(span).toMatchObject({ kind: HistoryKind.Int, last: int.sequence + 2, instructions: 2 });
    });

    if (spec.halts !== false) {
      it("coalesces consecutive HALTed cycles into one record", async () => {
        const d = await spec.create();
        const symbol = await loadRecording(
          d,
          base,
          `
        .org ${base}
Start:  di
Stop:   halt`
        );
        d.step(1);
        d.runFrames(1);
        const records = history(d);
        expect(records[0].regs.pc).toBe(base);
        expect(records[1]).toMatchObject({ kind: HistoryKind.Instruction, regs: { pc: symbol("Stop") } });
        const halts = records.slice(2);
        expect(halts.length, "HALT records").toBeGreaterThan(0);
        expect(halts.every((r) => r.kind === HistoryKind.Halt)).toBe(true);
        expect(halts[0].bytes[0]).toBe(0x76);
        expect(halts[0].repeat).toBeGreaterThan(100);
        expect(halts.slice(0, -1).every((r) => r.repeat === 0xffff)).toBe(true);
      });
    }
  });

  describe(`execution history on ${name}: the ring`, () => {
    const LOOP = `
        .org ${base}
Start:  di
Loop:   inc a
        inc hl
        jr Loop`;

    it("wraps, keeps sequences continuous, and reports a start that left the ring as gone", async () => {
      const d = await spec.create();
      await loadRecording(d, base, LOOP);
      for (let i = 0; i < 60 && historyInfo(d).newestSequence < capacity + 5000; i++) d.runFrames(1);
      const info = historyInfo(d);
      expect(info.capacity).toBe(capacity);
      expect(info.count).toBe(capacity);
      expect(info.oldestSequence).toBe(info.newestSequence - capacity + 1);
      // --- The raw sequence numbers across the whole ring, wrap included, are consecutive
      const page = d.machine.readHistory(info.oldestSequence, capacity)!;
      const view = new DataView(page.records.buffer, page.records.byteOffset);
      for (let i = 0; i < capacity; i++) {
        const sequence = view.getUint32(i * HISTORY_RECORD_SIZE, true);
        if (sequence !== ((info.oldestSequence + i) >>> 0)) {
          expect(sequence, `the record ${i} after the oldest`).toBe((info.oldestSequence + i) >>> 0);
        }
      }
      const old = historyFromOf(d.machine, info.oldestSequence - 10, 4);
      expect(old.gone).toBe(true);
      expect(old.records[0].sequence).toBe(info.oldestSequence);
    });

    it("writes nothing while recording is off", async () => {
      const d = await spec.create();
      await loadRecording(d, base, LOOP);
      d.machine.setHistoryEnabled(false);
      d.step(20);
      d.runFrames(1);
      expect(historyInfo(d)).toMatchObject({ count: 0, enabled: false });
    });

    it("keeps the ring across a state restore (volatile; the controller clears it) and grows it by steps", async () => {
      const d = await spec.create();
      await loadRecording(d, base, LOOP);
      d.step(10);
      const saved = d.machine.saveMachineState();
      d.step(10);
      const before = historyInfo(d);
      d.machine.loadMachineState(saved);
      expect(historyInfo(d)).toEqual(before);
      d.step(5);
      expect(historyInfo(d).newestSequence).toBe(before.newestSequence + 5);
    });
  });

  describe(`execution history on ${name}: the context`, () => {
    it("names the partition the live machine's getPartition named when the instruction ran (D4)", async () => {
      const d = await spec.create();
      const decoder = historyContextDecoder(spec.machineId);
      expect(decoder, "a context decoder").toBeDefined();
      const source =
        spec.pagingProgram?.(base) ??
        `
        .org ${base}
Start:  di
Loop:   inc a
        ld (${data}),a
        jr Loop`;
      await loadRecording(d, base, source);
      let seed = 12345;
      const random = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) & 0x1fff;
      const steps = spec.pagingSteps ?? 400;
      let compared = 0;
      for (let i = 0; i < steps; i++) {
        const addresses = Array.from({ length: 8 }, (_, slot) => (slot << 13) | random());
        const before = addresses.map((a) => d.machine.getPartition(a));
        d.step(1);
        const record = history(d, 1)[0];
        if (record.kind !== HistoryKind.Instruction) continue;
        const decoded = addresses.map((a) => decoder!.partitionFor(record.context, a));
        expect(decoded, `step ${i} at ${hex(record.regs.pc)}`).toEqual(before);
        compared++;
      }
      expect(compared).toBeGreaterThan(steps / 2);
      expect(decoder!.describe(history(d, 1)[0].context).length).toBeGreaterThan(0);
    });
  });
}
