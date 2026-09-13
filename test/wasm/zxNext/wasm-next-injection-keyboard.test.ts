import { describe, expect, it } from "vitest";

import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Spectrum Next WASM emulated keystroke playback", () => {
  it("propagates queueKeystroke() (the run-project code-injection mechanism) into the WASM keyboard matrix", async () => {
    // MachineController.runCode()'s QueueKey step - the only mechanism that
    // drives ".nexload <file>" after OS init - calls machine.queueKeystroke(),
    // which is played back frame-by-frame by emulateKeystroke(). It never
    // calls machine.setKeyStatus() (the manual-typing path, which is bridged
    // to the WASM core via an override). Regression test for the resulting
    // stall: queued keystrokes must still reach the WASM keyboard matrix.
    const machine = await createTestZxNextWasmMachine();
    machine.reset();

    const line = Math.floor(SpectrumKeyCode.N6 / 5);
    const bitMask = 1 << SpectrumKeyCode.N6 % 5;

    const before = machine.wasmV2Runtime!.exports.zxnextGetKeyboardLine(line);
    expect(before & bitMask).toBe(0);

    machine.queueKeystroke(0, 1, SpectrumKeyCode.N6);

    // While the queued keystroke is held, the WASM keyboard matrix must show it.
    machine.executeMachineFrame();
    const during = machine.wasmV2Runtime!.exports.zxnextGetKeyboardLine(line);
    expect(during & bitMask).toBe(bitMask);

    // Once the hold duration elapses, emulateKeystroke() releases the key and
    // that release must also reach the WASM matrix.
    machine.executeMachineFrame();
    machine.executeMachineFrame();
    const after = machine.wasmV2Runtime!.exports.zxnextGetKeyboardLine(line);
    expect(after & bitMask).toBe(0);
  });
});
