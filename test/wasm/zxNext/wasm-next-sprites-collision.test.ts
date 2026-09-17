import { describe, expect, it } from "vitest";

import type { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import { defineSpriteCollisionTests } from "../../zxnext/sprite-collision-scenarios";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/* The WASM engine's sprite collisions: the shared scenarios, plus when the flag is raised. */
defineSpriteCollisionTests({
  name: "WASM",
  createMachine: () => createTestZxNextWasmMachine(),
  setNextReg: (machine, reg, value) =>
    (machine as ZxNextWasmV2Machine).wasmV2Runtime!.exports.zxnextSetNextRegisterDirect(reg, value),
  completeFrame: (machine) =>
    (machine as ZxNextWasmV2Machine).wasmV2Runtime!.exports.zxnextAdvanceUlaFrameState()
});

describe("WASM: sprite collisions and the display", () => {
  it("is raised by the emulated frame, not by redrawing the display", async () => {
    /*
     * The WASM engine builds its picture only when a display asks for it, so collisions are detected
     * at frame completion instead — otherwise no display would mean no flag, and two redraws of one
     * frame would raise it twice.
     */
    const machine = await createTestZxNextWasmMachine();
    machine.hardReset();
    const exports = machine.wasmV2Runtime!.exports;
    exports.zxnextSetNextRegisterDirect(0x15, 0x03);
    const memory = new Uint8Array(0x4000).fill(0xe3);
    memory.fill(0xe0, 256, 512);
    machine.doWritePort(0x303b, 0x00);
    for (const value of memory) machine.doWritePort(0x005b, value);
    for (const [index, attrs] of [
      [0, [40, 40, 0x00, 0x81]],
      [1, [48, 44, 0x00, 0x81]]
    ] as const) {
      machine.doWritePort(0x303b, index);
      for (const value of attrs) machine.doWritePort(0x0057, value);
    }

    machine.renderInstantScreen();
    machine.renderInstantScreen();
    expect(machine.doReadPort(0x303b) & 0x01).toBe(0);

    exports.zxnextExecuteFrame();
    expect(machine.doReadPort(0x303b) & 0x01).toBe(1);
  });
});
