import { describe, expect, it } from "vitest";

import { createTestNextMachine } from "../../zxnext/TestNextMachine";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/*
 * The copper must run *during emulation*, not only when a test pokes its tick function.
 *
 * Before this suite existed, `zxnextCopperTick` was exported from the WASM core and
 * correctly implemented, `$60`-`$64` writes reached it, and the unit test in
 * `wasm-next-copper.test.ts` passed — but nothing in the core ever called the tick while a
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
  it("executes the copper list while a frame runs, and matches the TypeScript core", async () => {
    const oracle = await createTestNextMachine();
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    const write = (reg: number, value: number): void => {
      oracle.nextRegDevice.directSetRegValue(reg, value);
      exports.zxnextSetNextRegisterDirect(reg, value);
    };

    // Upload the list through the 8-bit path ($60 auto-increments), then start the copper.
    write(0x61, 0x00);
    for (const word of PROGRAM) {
      write(0x60, (word >> 8) & 0xff);
      write(0x60, word & 0xff);
    }
    write(0x61, 0x00);
    write(0x62, 0x40); // start mode 0b01: start from zero and loop

    // Nothing has run yet.
    expect(exports.zxnextGetNextRegisterDirect(USER_REG)).not.toBe(COPPER_VALUE);
    expect(exports.zxnextGetCopperListAddress()).toBe(0);

    // Two frames, because of a pre-existing quirk in the TypeScript core: `MachineFrameRunner`
    // only calls `onInitNewFrame` once a previous frame has completed, and
    // `lastRenderedFrameTact` is initialised nowhere else — so on a freshly built machine the
    // whole of frame 1 has `undefined < currentFrameTact`, and neither the copper nor
    // `renderTact` runs. The WASM core has no such gap and would pass with one frame.
    oracle.executeMachineFrame();
    oracle.executeMachineFrame();
    wasm.executeMachineFrame();
    wasm.executeMachineFrame();

    // The copper advanced its own program counter — it was actually ticked.
    expect(exports.zxnextGetCopperListAddress()).toBeGreaterThan(0);
    expect((oracle.copperDevice as unknown as { _copperListAddr: number })._copperListAddr).toBeGreaterThan(0);

    // And it delivered its MOVE to the NextReg, in both cores.
    //
    // The TypeScript side is checked through the stored field rather than a register read:
    // its $7F entry has a `writeFn` but no `readFn` (NextRegDevice.ts:1692-1695), so reading
    // it back yields $FF while the WASM core returns what was written. That read-back
    // difference is a separate, unrelated divergence — noted, not relied on here.
    expect(exports.zxnextGetNextRegisterDirect(USER_REG)).toBe(COPPER_VALUE);
    expect(oracle.nextRegDevice.userRegister0).toBe(COPPER_VALUE);
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
