import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { createSp48MachineController } from "@emu/sp48/Sp48MachineController";

async function createController() {
  const wasmPath = resolve(process.cwd(), "public/wasm/sp48.wasm");
  return createSp48MachineController(async (path) => {
    if (path === "roms/sp48.rom") {
      return new Uint8Array(readFileSync(resolve(process.cwd(), "src/public/roms/sp48.rom")));
    }
    return new Uint8Array(readFileSync(resolve(process.cwd(), path)));
  }, {
    audioSampleRate: 44_100,
    wasmBytes: readFileSync(wasmPath)
  });
}

describe("SP48 Wasm machine lifecycle", () => {
  it("does not advance frames while stopped", async () => {
    const controller = await createController();

    expect(controller.machineState).toBe(MachineControllerState.None);
    expect(controller.tickFrame()).toBe(false);
    expect(controller.machine.frames).toBe(0);
  });

  it("starts, emits frame completion, and submits Wasm audio metadata", async () => {
    const controller = await createController();
    const events: number[] = [];
    let audioSampleCount = 0;

    controller.frameCompleted.on((event) => {
      events.push(event?.frames ?? -1);
      audioSampleCount = event?.audioSampleCount ?? 0;
    });

    controller.issueMachineCommand("start");

    expect(controller.machineState).toBe(MachineControllerState.Running);
    expect(controller.tickFrame()).toBe(true);
    expect(controller.machine.frames).toBe(1);
    expect(controller.machine.tacts).toBeGreaterThanOrEqual(controller.machine.tactsInFrame);
    expect(controller.machine.getNextFrameStartTact()).toBe(controller.machine.tactsInFrame);
    expect(events).toEqual([1]);
    expect(audioSampleCount).toBeGreaterThan(0);
  });

  it("pauses and single-steps while paused", async () => {
    const controller = await createController();

    controller.issueMachineCommand("start");
    controller.tickFrame();
    controller.issueMachineCommand("pause");

    expect(controller.machineState).toBe(MachineControllerState.Paused);
    expect(controller.tickFrame()).toBe(false);
    expect(controller.machine.frames).toBe(1);

    controller.issueMachineCommand("stepInto");

    expect(controller.machineState).toBe(MachineControllerState.Paused);
    expect(controller.machine.frames).toBe(2);
  });

  it("stops and restarts the Wasm machine", async () => {
    const controller = await createController();

    controller.issueMachineCommand("start");
    controller.tickFrame();
    controller.issueMachineCommand("stop");

    expect(controller.machineState).toBe(MachineControllerState.Stopped);
    expect(controller.machine.frames).toBe(0);

    controller.issueMachineCommand("restart");

    expect(controller.machineState).toBe(MachineControllerState.Running);
    expect(controller.machine.frames).toBe(0);
    expect(controller.tickFrame()).toBe(true);
    expect(controller.machine.frames).toBe(1);
  });

  it("keeps keyboard input routed through the controller", async () => {
    const controller = await createController();

    controller.setKeyStatus(10, true);

    expect(controller.machine.getKeyboardLine(2)).toBe(0x01);
    expect(controller.machine.readPort(0xfbfe)).toBe(0xbe);
    expect(controller.renderInstantScreen().length).toBe(352 * (288 + 4));
  });
});
