import { describe, expect, it } from "vitest";

import { buildDmaLogEntries, type DmaLogWriteRow } from "@common/zxnext/dma/dmaLog";
import { DmaWrSeq } from "@common/zxnext/dma/dmaState";
import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * The DMA Port Log (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §11): the core's ring of accesses to $6B and
 * $0B, and the document's rows built from it, on the real core.
 *
 * Hardware (`dev/vendor/next-fpga/3.02.01/src/device/dma.vhd`): the write sequencer decides whether a
 * byte is a base byte (state IDLE) or a follow byte of the group in progress; WR4 with D4 and neither
 * D2 nor D3 enters a state with no handler, and every later write is ignored until a reset.
 */

const ZXN = 0x6b;
const SETUP = [0x83, 0x7d, 0x00, 0xc0, 0x00, 0x08, 0x14, 0x68, 0x21, 55, 0xcd, 0xdf, 0x00, 0x82, 0xcf, 0x87];
const hexBytes = (bytes: number[]) => bytes.map((b) => `$${b.toString(16)}`).join(",");

/** A program that sends `bytes` with OTIR from `Send`, then reads the status with IN A,(C) at `Read` */
async function program(bytes: number[]): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(" .org $8000\n di\nPark: jr Park");
  await s.loadCode(
    `
        .org $8000
Start:  di
        ld hl,Setup
        ld b,SetupEnd-Setup
        ld c,$6b
Send:   otir
        ld a,$bf
Status: out ($6b),a
Read:   in a,(c)
Done:   jr Done
Setup:  .defb ${hexBytes(bytes)}
SetupEnd:`,
    { entry: "Start" }
  );
  return s;
}

async function parked(): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(" .org $8000\n di\nPark: jr Park");
  return s;
}

describe("DMA Port Log: recording", () => {
  it("records an OTIR setup byte by byte with the OTIR's PC and the sequencer's states", async () => {
    const s = await program(SETUP);
    s.recordDmaLog(true).runTo("Done");
    const log = s.dmaLog();
    const writes = log.filter((r) => !r.read);
    expect(writes.map((r) => r.value)).toEqual([...SETUP, 0xbf]);
    expect(writes.slice(0, 16).every((r) => r.pc === s.symbol("Send") && !r.host && !r.port0B)).toBe(true);
    expect(writes[16].pc).toBe(s.symbol("Status"));
    // --- $7D announces port A lo/hi and length lo/hi: the sequencer walks through them
    expect(writes.slice(1, 6).map((r) => [r.before, r.after])).toEqual([
      [DmaWrSeq.Idle, DmaWrSeq.R0Byte0],
      [DmaWrSeq.R0Byte0, DmaWrSeq.R0Byte1],
      [DmaWrSeq.R0Byte1, DmaWrSeq.R0Byte2],
      [DmaWrSeq.R0Byte2, DmaWrSeq.R0Byte3],
      [DmaWrSeq.R0Byte3, DmaWrSeq.Idle]
    ]);
    // --- the read: the status entry, its value and the IN's PC
    const read = log.find((r) => r.read)!;
    expect(read).toMatchObject({ pc: s.symbol("Read"), before: 0, host: false });
    expect(read.value & 0xde).toBe(0x1a);
    // --- frames and positions go forward
    expect(log.every((r, i) => i === 0 || r.seq === log[i - 1].seq + 1)).toBe(true);
  });

  it("records nothing while off", async () => {
    const s = await program(SETUP);
    s.runTo("Done");
    expect(s.dmaLog()).toEqual([]);
  });

  it("flags host writes and port $0B", async () => {
    const s = await parked();
    s.recordDmaLog(true);
    s.out(0x0b, 0xc3);
    expect(s.dmaLog()).toMatchObject([{ value: 0xc3, host: true, port0B: true, pc: 0 }]);
  });

  it("leaves the machine byte-identical", async () => {
    const a = await program(SETUP);
    const b = await program(SETUP);
    b.recordDmaLog(true);
    a.runFrames(3);
    b.runFrames(3);
    expect(a.memoryDifferences(b)).toEqual([]);
    expect(a.registers()).toEqual(b.registers());
  });

  it("wraps: it holds the newest 32,768 records and keeps counting", async () => {
    const s = await parked();
    s.recordDmaLog(true);
    for (let i = 0; i < 32768 + 10; i++) s.out(ZXN, 0x8b);
    const log = s.dmaLog();
    expect(log).toHaveLength(32768);
    expect(log[0].seq).toBe(10);
  });
});

describe("DMA Port Log: the document's rows", () => {
  it("one setup, ending with the enable, with each command decoded from its recorded bytes", async () => {
    const s = await program(SETUP);
    s.recordDmaLog(true).runTo("Done");
    const entries = buildDmaLogEntries(s.dmaLog());
    const setups = entries.filter((e) => e.type === "setup");
    // --- the status-read command after the enable ($BF) is not a setup of its own
    expect(setups).toHaveLength(1);
    const first = setups[0].type === "setup" ? setups[0].setup : undefined;
    expect(first).toMatchObject({ index: 1, writes: 16, enables: true, anomalies: 0 });
    expect(first!.commands.map((c) => c.kind)).toEqual(["wr6", "wr0", "wr1", "wr2", "wr4", "wr5", "wr6", "wr6"]);
    const rows = entries.flatMap((e) => (e.type === "row" && e.row.kind === "write" ? [e.row as DmaLogWriteRow] : []));
    expect(rows[1]).toMatchObject({ role: "base", group: "WR0" });
    expect(rows[1].command).toMatchObject({ kind: "wr0", portA: 0xc000, blockLength: 2048 });
    expect(rows.slice(2, 6).map((r) => [r.role, r.field])).toEqual([
      ["follow", "portALo"],
      ["follow", "portAHi"],
      ["follow", "lengthLo"],
      ["follow", "lengthHi"]
    ]);
    expect(rows[9]).toMatchObject({ role: "follow", field: "prescaler", group: "WR2" });
  });

  it("a swallowed byte is shown as the follow byte the DMA took it as", async () => {
    const s = await parked();
    s.recordDmaLog(true);
    // --- WR0 announces 4 follow bytes but only 2 come before WR1's $14
    for (const b of [0x7d, 0x00, 0xc0, 0x14, 0x10]) s.out(ZXN, b);
    const rows = buildDmaLogEntries(s.dmaLog()).flatMap((e) => (e.type === "row" ? [e.row as DmaLogWriteRow] : []));
    expect(rows.map((r) => [r.record.value, r.role, r.field])).toEqual([
      [0x7d, "base", undefined],
      [0x00, "follow", "portALo"],
      [0xc0, "follow", "portAHi"],
      [0x14, "follow", "lengthLo"],
      [0x10, "follow", "lengthHi"]
    ]);
  });

  it("marks the deaf trap, ignored bytes and an enable without a load", async () => {
    const s = await parked();
    s.recordDmaLog(true);
    for (const b of [0xc3, 0x86, 0xad, 0x00, 0x48, 0x87, 0x91, 0x87]) s.out(ZXN, b);
    const rows = buildDmaLogEntries(s.dmaLog()).flatMap((e) => (e.type === "row" ? [e.row as DmaLogWriteRow] : []));
    expect(rows.map((r) => [r.record.value, r.role, r.anomalies])).toEqual([
      [0xc3, "base", []],
      [0x86, "ignored", ["ignored"]],
      [0xad, "base", []],
      [0x00, "follow", []],
      [0x48, "follow", []],
      [0x87, "base", ["enableWithoutLoad"]],
      [0x91, "base", ["becomesDeaf"]],
      [0x87, "ignored", ["deaf"]]
    ]);
  });

  it("a zxnDDMA command through $0B is marked", async () => {
    const s = await parked();
    s.recordDmaLog(true);
    s.out(0x0b, 0xd7);
    const rows = buildDmaLogEntries(s.dmaLog()).flatMap((e) => (e.type === "row" ? [e.row as DmaLogWriteRow] : []));
    expect(rows[0].anomalies).toEqual(["ddmaOn0B"]);
  });
});
