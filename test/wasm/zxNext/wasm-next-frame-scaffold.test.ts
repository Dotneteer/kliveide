import { readFileSync } from "node:fs";

import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import {
  ZXNEXT_WASM_V2_SCREEN_HEIGHT,
  ZXNEXT_WASM_V2_SCREEN_WIDTH
} from "@emu/machines/zxNext/wasm/ZxNextWasmV2Loader";
import { buildZxNextWasm, productionOutput } from "../../../scripts/build-zxnext-wasm.cjs";
import { describe, expect, it } from "vitest";

describe("ZX Spectrum Next WASM v2 frame scaffold", () => {
  it("executes scaffold frames with deterministic counters and empty screen output", async () => {
    const machine = await createTestZxNextWasmMachine();
    const tactsInFrame = machine.tactsInFrame;

    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      frames: 0,
      tacts: 0,
      currentFrameTact: 0,
      frameCompleted: false,
      lastScaffoldStopReason: "scaffoldReset"
    });

    expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.Normal);
    expect(machine.frameJustCompleted).toBe(true);
    expect(machine.frames).toBe(1);
    expect(machine.tacts).toBe(tactsInFrame);
    expect(machine.currentFrameTact).toBe(0);
    expect(machine.executionContext.lastTerminationReason).toBe(FrameTerminationMode.Normal);

    const diagnostics = machine.getWasmV2Diagnostics();
    expect(diagnostics).toMatchObject({
      frames: 1,
      tacts: tactsInFrame,
      tactsInFrame,
      currentFrameTact: 0,
      frameCompleted: true,
      normalFrames: 1,
      lastScaffoldStopReason: "scaffoldFrameComplete"
    });
    expect(diagnostics.lastScaffoldStopReason).not.toMatch(/cpu|device/i);

    const pixels = machine.getPixelBuffer();
    expect(pixels.length).toBe(ZXNEXT_WASM_V2_SCREEN_WIDTH * ZXNEXT_WASM_V2_SCREEN_HEIGHT);
    expect(pixels.every(pixel => pixel === 0xff000000)).toBe(true);
    expect(machine.getPixelBufferBytes().byteLength).toBe(pixels.length * 4);

    expect(machine.renderInstantScreen().length).toBe(pixels.length);
    expect(machine.getWasmV2UlaState()).toMatchObject({
      fcl: true,
      frm: 1,
      pos: 0
    });
  });
});

async function createTestZxNextWasmMachine(): Promise<ZxNextWasmV2Machine> {
  buildZxNextWasm();
  const machine = new ZxNextWasmV2Machine(
    undefined,
    undefined,
    undefined,
    {
      artifactName: "test-zxnext-frame-scaffold.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    }
  );
  await machine.setup();
  return machine;
}
