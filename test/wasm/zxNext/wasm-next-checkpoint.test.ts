import { describe, expect, it } from "vitest";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/**
 * Traces the machine over a few frames. Two runs that agree here have agreed about every register,
 * the tact and frame counters and the program counter at each step, which is what makes a restored
 * checkpoint indistinguishable from having arrived the long way round.
 */
function trace(machine: any, frames: number): string {
  const out: string[] = [];
  for (let i = 0; i < frames; i++) {
    machine.executeMachineFrame();
    const d = machine.getWasmV2Diagnostics();
    out.push(`${d.frames}:${d.tacts}:${d.currentFrameTact}:${machine.pc}:${machine.af}:${machine.sp}`);
  }
  return out.join("|");
}

describe("ZX Spectrum Next WASM checkpoints", () => {
  it("replays identically after a restore", async () => {
    const machine: any = await createTestZxNextWasmMachine();
    machine.reset();
    trace(machine, 5);

    machine.captureCheckpoint("boot");
    const pcAtCapture = machine.pc;
    const expected = trace(machine, 8);

    expect(machine.tryRestoreCheckpoint("boot")).toBe(true);
    expect(machine.pc).toBe(pcAtCapture);
    expect(trace(machine, 8)).toBe(expected);
  });

  it("survives a hard reset between capture and restore", async () => {
    const machine: any = await createTestZxNextWasmMachine();
    machine.reset();
    trace(machine, 5);

    machine.captureCheckpoint("boot");
    const pcAtCapture = machine.pc;
    const expected = trace(machine, 6);

    machine.hardReset();
    expect(machine.pc).not.toBe(pcAtCapture);

    expect(machine.tryRestoreCheckpoint("boot")).toBe(true);
    expect(machine.pc).toBe(pcAtCapture);
    expect(trace(machine, 6)).toBe(expected);
  });

  it("refuses a key it holds nothing for", async () => {
    const machine: any = await createTestZxNextWasmMachine();
    machine.reset();

    expect(machine.tryRestoreCheckpoint("boot")).toBe(false);
    machine.captureCheckpoint("boot");
    expect(machine.tryRestoreCheckpoint("something-else")).toBe(false);
    expect(machine.tryRestoreCheckpoint("boot")).toBe(true);
  });

  it("keeps only the most recently captured state", async () => {
    const machine: any = await createTestZxNextWasmMachine();
    machine.reset();
    machine.captureCheckpoint("first");
    trace(machine, 3);
    machine.captureCheckpoint("second");

    expect(machine.tryRestoreCheckpoint("first")).toBe(false);
    expect(machine.tryRestoreCheckpoint("second")).toBe(true);
  });

  it("drops the state when it is explicitly invalidated", async () => {
    const machine: any = await createTestZxNextWasmMachine();
    machine.reset();
    machine.captureCheckpoint("boot");

    machine.invalidateCheckpoints();

    expect(machine.tryRestoreCheckpoint("boot")).toBe(false);
  });

  it("clears a pending frame command and the keystroke queue on restore", async () => {
    const machine: any = await createTestZxNextWasmMachine();
    machine.reset();
    machine.captureCheckpoint("boot");

    machine.setFrameCommand({ command: "sd-read", sector: 7 });
    machine.queueKeystroke(0, 5, 1, 2);
    expect(machine.getKeyQueueLength()).toBeGreaterThan(0);

    expect(machine.tryRestoreCheckpoint("boot")).toBe(true);
    expect(machine.getFrameCommand()).toBeNull();
    expect(machine.getKeyQueueLength()).toBe(0);
  });

  it("excludes every volatile range - the trace and the history ring among them - from the captured state", async () => {
    const machine: any = await createTestZxNextWasmMachine();
    machine.reset();
    machine.captureCheckpoint("boot");

    const checkpoint = (machine as any).wasmV2Checkpoint;
    const spans: { offset: number; bytes: Uint8Array }[] = checkpoint.memory;
    const captured = spans.reduce((sum, span) => sum + span.bytes.length, 0);
    const runtime = machine.wasmV2Runtime;
    const total = runtime.memoryBuffer.byteLength;
    const traceStart = runtime.exports.zxnextTraceGetStartOffset();
    const traceEnd = traceStart + runtime.frameTrace.byteLength;
    const header = new DataView(runtime.memoryBuffer);
    const ringStart = header.getUint32(runtime.exports.z80HistoryGetHeaderOffset() + 36, true);
    const ringEnd = ringStart + 131072 * 64;
    const overlaps = (from: number, to: number) => spans.some((s) => s.offset < to && s.offset + s.bytes.length > from);

    expect(overlaps(traceStart, traceEnd)).toBe(false);
    expect(overlaps(ringStart, ringEnd)).toBe(false);
    expect(captured).toBeLessThan(total - runtime.frameTrace.byteLength - 131072 * 64 + 1);
    expect(captured).toBeLessThan(total / 2);
  });
});
