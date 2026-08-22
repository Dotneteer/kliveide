import { readFileSync } from "node:fs";

import type { Channel, RequestMessage } from "@messaging/messages-core";

import createAppStore from "@state/store";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import { buildZxNextWasm, productionOutput } from "../../../scripts/build-zxnext-wasm.cjs";
import { describe, expect, it } from "vitest";

describe("ZX Spectrum Next WASM v2 status bar integration", () => {
  it("updates FrameStats and status-bar-readable PC data from WASM frames", async () => {
    const machine = await createTestZxNextWasmMachine();
    const store = createAppStore("test-zxnext-status");
    const controller = new MachineController(store, new ResolvingMessenger(), machine);
    controller.debugSupport = new DebugSupport(store);
    const statusSnapshots: { frameCount: number; pc: string }[] = [];

    controller.frameCompleted.on(() => {
      statusSnapshots.push({
        frameCount: controller.frameStats.frameCount,
        pc: controller.machine.pc.toString(16).toUpperCase().padStart(4, "0")
      });
    });

    await controller.start();
    await waitForMachineFrames(machine, 2);
    await controller.pause();

    expect(controller.state).toBe(MachineControllerState.Paused);
    expect(controller.frameStats.frameCount).toBeGreaterThanOrEqual(2);
    expect(controller.frameStats.lastCpuFrameTimeInMs).toBeGreaterThanOrEqual(0);
    expect(controller.frameStats.lastFrameTimeInMs).toBeGreaterThanOrEqual(0);
    expect(controller.frameStats.avgCpuFrameTimeInMs).toBeGreaterThanOrEqual(0);
    expect(controller.frameStats.avgFrameTimeInMs).toBeGreaterThanOrEqual(0);
    expect(statusSnapshots.length).toBeGreaterThanOrEqual(2);
    expect(statusSnapshots[statusSnapshots.length - 1]).toMatchObject({
      frameCount: expect.any(Number),
      pc: expect.stringMatching(/^[0-9A-F]{4}$/)
    });
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      lastWasmStopReason: "wasmFrameComplete",
      frameCompleted: true
    });

    await controller.stop();
  });
});

async function createTestZxNextWasmMachine(): Promise<ZxNextWasmV2Machine> {
  buildZxNextWasm();
  const machine = new ZxNextWasmV2Machine(
    undefined,
    undefined,
    undefined,
    {
      artifactName: "test-zxnext-status.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    }
  );
  await machine.setup();
  return machine;
}

async function waitForMachineFrames(machine: ZxNextWasmV2Machine, frameCount: number): Promise<void> {
  const deadline = Date.now() + 1500;
  while (machine.frames < frameCount) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${frameCount} WASM frames.`);
    }
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

class ResolvingMessenger extends MessengerBase {
  protected send(message: RequestMessage): void {
    if (message.correlationId != null) {
      this.processResponse({
        type: "ApiMethodResponse",
        correlationId: message.correlationId,
        result: undefined
      });
    }
  }

  get requestChannel(): Channel {
    return "EmuToMain";
  }

  get responseChannel(): Channel {
    return "EmuToMainResponse";
  }
}
