import { describe, expect, it } from "vitest";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/*
 * The copper must run *during emulation*, not only when a test pokes its tick function.
 *
 * Before this suite existed, `zxnextCopperTick` was exported from the WASM core and
 * correctly implemented, `$60`-`$64` writes reached it, and a unit test that ticked it directly
 * passed — but nothing in the core ever called the tick while a
 * frame ran, so the copper was inert in the emulator while looking healthy in tests. Every
 * assertion here therefore drives a real frame rather than calling the tick directly.
 *
 * See .plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md §15.5c / §15.10.
 */

/** MOVE: bit 15 = 0, bits 14:8 = register, bits 7:0 = value. */
function moveInstr(reg: number, val: number): number {
  return ((reg & 0x7f) << 8) | (val & 0xff);
}

/** WAIT: bit 15 = 1, bits 14:9 = hc/8, bits 8:0 = copper line. */
function waitInstr(hc6: number, line: number): number {
  return 0x8000 | ((hc6 & 0x3f) << 9) | (line & 0x1ff);
}

/**
 * NextReg $7F — "user register 0". Nothing in the ROM or the boot sequence writes it, so it
 * isolates the copper's effect from everything else running in the frame.
 */
const USER_REG = 0x7f;
const COPPER_VALUE = 0xab;

/**
 * A list that writes USER_REG once and then parks forever: copper line 400 never occurs in a
 * 311-line frame, so the WAIT never completes and the MOVE cannot repeat or wrap.
 */
const PROGRAM = [moveInstr(USER_REG, COPPER_VALUE), waitInstr(0, 400)];

describe("ZX Next WASM copper — runs during emulation", () => {
  it("executes the copper list while a frame runs", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    // Upload the list through the 8-bit path ($60 auto-increments), then start the copper.
    exports.zxnextSetNextRegisterDirect(0x61, 0x00);
    for (const word of PROGRAM) {
      exports.zxnextSetNextRegisterDirect(0x60, (word >> 8) & 0xff);
      exports.zxnextSetNextRegisterDirect(0x60, word & 0xff);
    }
    exports.zxnextSetNextRegisterDirect(0x61, 0x00);
    exports.zxnextSetNextRegisterDirect(0x62, 0x40); // start mode 0b01: start from zero and loop

    // Nothing has run yet.
    expect(exports.zxnextGetNextRegisterDirect(USER_REG)).not.toBe(COPPER_VALUE);
    expect(exports.zxnextGetCopperListAddress()).toBe(0);

    wasm.executeMachineFrame();
    wasm.executeMachineFrame();

    // The copper advanced its own program counter — it was actually ticked.
    expect(exports.zxnextGetCopperListAddress()).toBeGreaterThan(0);

    // And it delivered its MOVE to the NextReg.
    expect(exports.zxnextGetNextRegisterDirect(USER_REG)).toBe(COPPER_VALUE);
  });

  it("does not run the copper list while the copper is stopped", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    exports.zxnextSetNextRegisterDirect(0x61, 0x00);
    for (const word of PROGRAM) {
      exports.zxnextSetNextRegisterDirect(0x60, (word >> 8) & 0xff);
      exports.zxnextSetNextRegisterDirect(0x60, word & 0xff);
    }
    // Deliberately leave the start mode at 0b00 (fully stopped).

    wasm.executeMachineFrame();

    expect(exports.zxnextGetCopperListAddress()).toBe(0);
    expect(exports.zxnextGetNextRegisterDirect(USER_REG)).not.toBe(COPPER_VALUE);
  });

  it("keeps the copper running across a frame boundary", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    // A single WAIT for copper line 100, looping from zero: it must be satisfied once per
    // frame, so the list address keeps moving rather than stalling after the first frame.
    exports.zxnextSetNextRegisterDirect(0x61, 0x00);
    exports.zxnextSetNextRegisterDirect(0x60, 0x80 | ((100 >> 8) & 0x01));
    exports.zxnextSetNextRegisterDirect(0x60, 100 & 0xff);
    exports.zxnextSetNextRegisterDirect(0x60, (moveInstr(USER_REG, COPPER_VALUE) >> 8) & 0xff);
    exports.zxnextSetNextRegisterDirect(0x60, moveInstr(USER_REG, COPPER_VALUE) & 0xff);
    exports.zxnextSetNextRegisterDirect(0x61, 0x00);
    exports.zxnextSetNextRegisterDirect(0x62, 0x40);

    wasm.executeMachineFrame();
    expect(exports.zxnextGetNextRegisterDirect(USER_REG)).toBe(COPPER_VALUE);

    // Clear it and prove the next frame writes it again — the beam counters reset per frame
    // rather than running away and leaving every subsequent WAIT unsatisfiable.
    exports.zxnextSetNextRegisterDirect(USER_REG, 0x00);
    wasm.executeMachineFrame();
    expect(exports.zxnextGetNextRegisterDirect(USER_REG)).toBe(COPPER_VALUE);
  });
});
