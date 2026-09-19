import { describe, expect, it } from "vitest";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

// --- ctc_chan.vhd state machine: S_CONTROL_WORD = 0, S_TIME_CONSTANT = 1, S_WAIT = 2, S_RUNNING = 3
const CTC_STATE_RUNNING = 3;

describe("ZX Next WASM CTC device", () => {
  it("steps one channel clock by clock through control word, time constant and run state", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    const clock = (iowr: boolean, data: number, clkTrg = false, intEnWr = false, intEn = false): void => {
      exports.zxnextCtcClock(0, iowr ? 1 : 0, data, clkTrg ? 1 : 0, intEnWr ? 1 : 0, intEn ? 1 : 0);
    };

    // --- Control word $05: timer, prescaler 16, D2 = time constant follows; then time constant 3
    clock(true, 0x05);
    clock(false, 0x05);
    clock(true, 0x03);
    clock(false, 0x03);
    for (let i = 0; i < 20; i++) clock(false, 0x00);
    clock(false, 0x00, false, true, true);

    // --- The time constant loaded, so the channel runs; 20+ clocks at prescaler 16 count once: 3 -> 2
    expect(exports.zxnextGetCtcState(0)).toBe(CTC_STATE_RUNNING);
    expect(exports.zxnextGetCtcTimeConstant(0)).toBe(3);
    expect(exports.zxnextGetCtcCount(0)).toBe(2);
    expect(exports.zxnextGetCtcZcTo(0)).toBe(0);
    // --- The int-enable write ($C5 path) sets the enable
    expect(exports.zxnextGetCtcIntEnabled(0)).toBe(1);
    expect(exports.zxnextGetCtcExpectingTimeConstant(0)).toBe(0);
    // --- Pinned: the value both cores (TypeScript and WASM) agreed on at tag
    // --- pre-zxnext-ts-removal-2026-09-19.
    expect(exports.zxnextGetCtcControlReg(0)).toBe(0x20);
  });

  // Ports, gating and timing on the machine: test/zxnext-hw/ctc/ctc.test.ts.
});
