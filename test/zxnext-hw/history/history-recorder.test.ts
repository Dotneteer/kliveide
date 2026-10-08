import { describe, expect, it } from "vitest";

import { HistoryKind, type HistoryRecord } from "@common/history/historyRecord";
import { zxNextPartitionFor } from "@common/history/contexts/zxnextContext";

import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * The execution-history recorder on the ZX Spectrum Next (`src/emu/z80/wasm/z80-history.c`,
 * `.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §6.1). The recorder is a debugger facility, not hardware:
 * its expectations come from the plan's decisions (D3: a record is the state *before* the event) and
 * from what the CPU observably did - registers read by single-stepping, bytes poked into memory.
 */

const CAPACITY = 131072;

async function recording(source: string, entry = "Start"): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(source, { entry });
  s.recordHistory(true).clearHistory();
  return s;
}

const instructions = (records: HistoryRecord[]) => records.filter((r) => r.kind === HistoryKind.Instruction);

describe("execution history: one record per instruction", () => {
  it("records DD CB d op and NEXTREG n,n as one record each, with every byte (T2)", async () => {
    const s = await recording(`
        .org $8000
Start:  ld ix,$9000
        set 0,(ix+5)
        nextreg $7f,$a5
        nop
        jr $`);
    s.step(4);
    const records = s.history();
    expect(records.map((r) => r.kind)).toEqual([0, 0, 0, 0]);
    expect(records.map((r) => r.regs.pc)).toEqual([0x8000, 0x8004, 0x8008, 0x800c]);
    expect(records[0].bytes.slice(0, 4)).toEqual([0xdd, 0x21, 0x00, 0x90]);
    expect(records[1].bytes).toEqual([0xdd, 0xcb, 0x05, 0xc6]);
    expect(records[2].bytes).toEqual([0xed, 0x91, 0x7f, 0xa5]);
    expect(records[3].bytes[0]).toBe(0x00);
  });

  it("holds the registers the CPU had before each instruction, R included (D3, T4)", async () => {
    const s = await recording(`
        .org $8000
Start:  ld a,$12
        ld bc,$3456
        add a,c
        exx
        ld hl,$abcd
        push hl
        ex af,af'
        ld i,a
        ld de,$0102
        jr $`);
    const seen: ReturnType<NextTestSession["registers"]>[] = [];
    for (let i = 0; i < 9; i++) {
      seen.push(s.registers());
      s.step(1);
    }
    const records = s.history();
    expect(records).toHaveLength(9);
    records.forEach((r, i) => {
      const live = seen[i];
      const what = `record ${i} at $${live.pc.toString(16)}`;
      expect(r.regs.pc, what).toBe(live.pc);
      expect(r.regs.af, what).toBe((live.a << 8) | live.f);
      expect([r.regs.bc, r.regs.de, r.regs.hl], what).toEqual([live.bc, live.de, live.hl]);
      expect([r.regs.af_, r.regs.bc_, r.regs.de_, r.regs.hl_], what).toEqual([live.af_, live.bc_, live.de_, live.hl_]);
      expect([r.regs.ix, r.regs.iy, r.regs.sp], what).toEqual([live.ix, live.iy, live.sp]);
      expect(r.regs.ir, what).toBe((live.i << 8) | live.r);
      expect([r.regs.iff1, r.regs.interruptMode], what).toEqual([live.iff1, live.im]);
    });
    // --- Sequence numbers are consecutive
    expect(records.map((r) => r.sequence - records[0].sequence)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("captures the bytes a self-modifying program actually executed (D5)", async () => {
    const s = await recording(`
        .org $8000
Start:  ld a,$3c          ; "inc a"
        ld (Patch),a
Patch:  nop
        ld a,$00          ; "nop"
        ld (Patch),a
        jr $`);
    s.step(3);
    const patched = s.history().at(-1)!;
    s.step(2);
    expect(patched.regs.pc).toBe(s.symbol("Patch"));
    expect(patched.bytes[0], "the patched opcode, not today's").toBe(0x3c);
    expect(s.peek(s.symbol("Patch"))).toBe(0x00);
  });
});

describe("execution history: events", () => {
  /** IM 2 with a 257-byte table of $92 at $9000: every vector lands on $9292 */
  const IM2 = `
        .org $8000
Start:  ld a,$90
        ld i,a
        ld hl,$9000
        ld (hl),$92
        ld de,$9001
        ld bc,256
        ldir
        im 2
        ei
Loop:   inc b
        jr Loop
        .org $9292
Isr:    ei
        reti`;

  it("records an INT acknowledge with the interrupted PC; the ISR's first instruction follows (T5)", async () => {
    const s = await recording(IM2);
    s.runFrames(2);
    const records = s.history();
    const i = records.findIndex((r) => r.kind === HistoryKind.Int);
    expect(i).toBeGreaterThan(0);
    const int = records[i];
    expect([s.symbol("Loop"), s.symbol("Loop") + 1]).toContain(int.regs.pc);
    expect(int.regs.interruptMode).toBe(2);
    expect(int.regs.iff1).toBe(true);
    expect(records[i + 1].kind).toBe(HistoryKind.Instruction);
    expect(records[i + 1].regs.pc).toBe(s.symbol("Isr"));
    // --- The record before it is the instruction the interrupt followed
    expect(records[i - 1].regs.pc === s.symbol("Loop") || records[i - 1].regs.pc === s.symbol("Loop") + 1).toBe(true);
    // --- The IM 2 vector the data bus carried, which picked the table entry
    const vector = int.bytes[0];
    expect(s.peekWord(0x9000 + vector)).toBe(0x9292);
  });

  it("coalesces HALTed cycles into one record per HALT, saturating at 65,535 (T6)", async () => {
    // --- At 28 MHz a frame is ~141,800 HALTed 4-tact cycles: two full records and a remainder
    const s = await recording(`
        .org $8000
Start:  di
        nextreg $07,$03
        halt`);
    s.runFrames(2);
    const records = s.history();
    const haltInstruction = records.findIndex((r) => r.kind === HistoryKind.Instruction && r.bytes[0] === 0x76);
    expect(haltInstruction).toBeGreaterThanOrEqual(0);
    const halts = records.slice(haltInstruction + 1);
    expect(halts.length).toBeGreaterThanOrEqual(3);
    expect(halts.every((r) => r.kind === HistoryKind.Halt && r.regs.pc === records[haltInstruction].regs.pc)).toBe(true);
    expect(halts.slice(0, -1).every((r) => r.repeat === 0xffff)).toBe(true);
    expect(halts.at(-1)!.repeat).toBeGreaterThan(0);
    expect(halts.at(-1)!.repeat).toBeLessThanOrEqual(0xffff);
    expect(halts[0].bytes[0]).toBe(0x76);
  });
});

describe("execution history: what the CPU decoded (T3)", () => {
  const E3 = 0x00e3;
  const CONMEM = 0x80;
  const MAPRAM = 0x40;
  const LD_BC_JP = [0x01, 0x22, 0x11, 0xc3, 0x00, 0x81];

  /** RAM page 3 as a "DivMMC ROM" holding `ld bc,$1122 / jp $8100` at $0008; automap on; RST $08 entry */
  async function divmmc(instant: boolean): Promise<NextTestSession> {
    const s = await createSession();
    await s.loadCode(`
        .org $8000
Start:  di
        ld bc,0
        jp $0008
        .org $8100
        jr $`, { entry: "Start" });
    const page3 = new Array(0x2000).fill(0x00);
    page3.splice(0x08, LD_BC_JP.length, ...LD_BC_JP);
    s.out(E3, CONMEM | 3).poke(0x2000, page3);
    s.out(0x7ffd, 0x00).out(0x1ffd, 0x00);
    s.setNextReg(0x0a, s.readNextReg(0x0a) | 0x10);
    s.out(E3, MAPRAM | 5);
    s.setNextReg(0xb8, 0x02).setNextReg(0xb9, 0x02).setNextReg(0xba, instant ? 0x02 : 0x00);
    return s;
  }

  it("an instant entry point records the DivMMC's bytes, and a context naming the DivMMC map", async () => {
    const s = await divmmc(true);
    s.runTo(0x0008);
    s.recordHistory(true).clearHistory();
    s.step(1);
    const r = s.history().at(-1)!;
    expect(r.regs.pc).toBe(0x0008);
    expect(r.bytes.slice(0, 3)).toEqual([0x01, 0x22, 0x11]);
    expect(s.registers().bc, "the CPU did execute the DivMMC's ld bc").toBe(0x1122);
    expect(r.context[12] & 0x01, "DivMMC mapped").toBe(0x01);
    // --- The instant entry mapped before the fetch: the code came from DivMMC RAM bank 3 (mapram), M3
    expect(zxNextPartitionFor(r.context, 0x0008)).toBe(-11);
    expect(s.partition(0x0008)).toBe(-11);
  });

  it("a delayed entry point records the ROM byte the CPU fetched before the DivMMC paged in", async () => {
    const s = await divmmc(false);
    s.runTo(0x0008);
    const romByte = s.peek(0x0008);
    s.recordHistory(true).clearHistory();
    s.step(1);
    const r = s.history().at(-1)!;
    expect(r.regs.pc).toBe(0x0008);
    expect(r.bytes[0]).toBe(romByte);
    expect(r.bytes[0]).not.toBe(0x01);
    // --- The context names the map the fetch saw: ROM 0, though the DivMMC is mapped now
    expect(zxNextPartitionFor(r.context, 0x0008)).toBe(-1);
    expect(s.partition(0x0008)).toBe(-11);
    expect(s.registers().bc, "the CPU executed the ROM's instruction").not.toBe(0x1122);
  });
});

describe("execution history: the ZX Next context", () => {
  it("names each slot's partition as the live machine's getPartition did", async () => {
    const s = await recording(`
        .org $8000
Start:  nextreg $56,$20
        nextreg $57,$21
        nop
        nextreg $50,$30
        nop
        jr $`);
    for (let i = 0; i < 5; i++) {
      const live = Array.from({ length: 8 }, (_, slot) => s.partition(slot << 13));
      s.step(1);
      const r = s.history().at(-1)!;
      expect(Array.from({ length: 8 }, (_, slot) => zxNextPartitionFor(r.context, slot << 13)), `step ${i}`).toEqual(live);
    }
  });

  it("records a code page by the bank it ran in, not the address alone (T13)", async () => {
    // --- The same code at $C000 in two 8K pages: each record names its own page
    const s = await recording(`
        .org $8000
Start:  nextreg $56,$40
        call $c000
        nextreg $56,$41
        call $c000
        jr $`);
    s.pokePage(0x40, 0, [0x00, 0xc9]).pokePage(0x41, 0, [0x00, 0xc9]);
    s.step(8);
    const atC000 = s.history().filter((r) => r.regs.pc === 0xc000);
    expect(atC000.map((r) => zxNextPartitionFor(r.context, r.regs.pc))).toEqual([0x40, 0x41]);
  });
});

describe("execution history: DMA holds (D15)", () => {
  it("records a continuous transfer as coalesced DMA hold records, with its addresses and length", async () => {
    // --- A 16K continuous fill: 98,304 T-states at 3.5 MHz with the bus held, across a frame end
    const s = await recording(`
        .org $8000
Start:  di
        ld hl,DmaTable
        ld b,DmaTableEnd-DmaTable
        ld c,$6b
        otir
        ld a,$87
        ld bc,$006b
        out (c),a
Done:   jr Done
DmaTable:
        .defb $83, $7d
        .defw Fill
        .defw $4000
        .defb $24, $10, $ad
        .defw $c000
        .defb $82, $cf
DmaTableEnd:
Fill:   .defb $77`);
    s.runFrames(3);
    const records = s.history();
    const holds = records.filter((r) => r.kind === HistoryKind.DmaHold);
    expect(holds.length).toBeGreaterThanOrEqual(2);
    // --- One contiguous hold: nothing between its records, every one before the waiting instruction
    const first = records.indexOf(holds[0]);
    expect(records.slice(first, first + holds.length).every((r) => r.kind === HistoryKind.DmaHold)).toBe(true);
    expect(holds.every((r) => r.regs.pc === s.symbol("Done"))).toBe(true);
    expect(holds.slice(0, -1).every((r) => r.repeat === 0xffff)).toBe(true);
    const held = holds.reduce((sum, r) => sum + r.repeat, 0);
    expect(held).toBeGreaterThanOrEqual(16384 * 6);
    expect(held).toBeLessThan(16384 * 6 + 1000);
    const c = holds[0].context;
    expect(c[0] | (c[1] << 8), "source").toBe(s.symbol("Fill"));
    expect(c[2] | (c[3] << 8), "destination").toBe(0xc000);
    const last = holds.at(-1)!.context;
    expect(last[4] | (last[5] << 8), "nothing left").toBe(0);
    // --- No instruction record while the bus was held
    expect(records[first - 1].regs.pc, "the OUT that started it").toBe(s.symbol("Done") - 2);
    expect(records[first + holds.length].regs.pc).toBe(s.symbol("Done"));
  });
});

describe("execution history: the ring", () => {
  const SPIN = `
        .org $8000
Start:  di
        nextreg $07,$03
Loop:   nop
        jr Loop`;

  it("wraps: the count saturates, sequences stay continuous, the oldest is overwritten (T11)", async () => {
    const s = await recording(SPIN);
    s.runFrames(3);
    const info = s.historyInfo();
    expect(info.capacity).toBe(CAPACITY);
    expect(info.count).toBe(CAPACITY);
    expect(info.newestSequence).toBeGreaterThan(CAPACITY);
    expect(info.oldestSequence).toBe(info.newestSequence - CAPACITY + 1);
    const tail = s.history(1000);
    expect(tail.map((r) => r.sequence - tail[0].sequence)).toEqual(tail.map((_, i) => i));
    // --- The stored low 32 bits agree with the reader's full sequence numbers
    const head = s.historyFrom(info.oldestSequence, 3);
    expect(head.gone).toBe(false);
    expect(head.records.map((r) => r.sequence)).toEqual([0, 1, 2].map((i) => info.oldestSequence + i));

    // --- The ring moves on: what was the oldest is gone, and the reader says so
    s.runFrames(1);
    const later = s.historyFrom(info.oldestSequence, 3);
    expect(later.gone).toBe(true);
    expect(later.records[0].sequence).toBe(s.historyInfo().oldestSequence);
  });

  it("writes nothing while recording is off", async () => {
    const s = await recording(SPIN);
    s.recordHistory(false);
    const before = s.historyInfo();
    s.runFrames(1);
    expect(s.historyInfo()).toEqual(before);
    expect(before.count).toBe(0);
    expect(before.enabled).toBe(false);
  });

  it("clearing empties the ring, bumps the generation and keeps sequences counting", async () => {
    const s = await recording(SPIN);
    s.step(10);
    const before = s.historyInfo();
    s.clearHistory();
    const after = s.historyInfo();
    expect(after.count).toBe(0);
    expect(after.generation).toBe(before.generation + 1);
    s.step(1);
    expect(s.history()[0].sequence).toBe(before.newestSequence + 1);
  });

  it("a checkpoint restore leaves the ring as it is (T7)", async () => {
    const s = await recording(SPIN);
    s.step(5);
    s.captureCheckpoint("k");
    s.step(20);
    const before = s.historyInfo();
    const newest = s.history(3);
    s.restoreCheckpoint("k");
    expect(s.historyInfo()).toEqual(before);
    expect(s.history(3)).toEqual(newest);
  });
});
