import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { Sp48FakeMachineController } from "@emu/sp48/Sp48FakeMachineController";
import { instantiateWasmZxSpectrum48Machine } from "@emu/sp48/WasmZxSpectrum48Machine";

async function createController() {
  const wasmPath = resolve(process.cwd(), "public/wasm/sp48.wasm");
  const machine = await instantiateWasmZxSpectrum48Machine(readFileSync(wasmPath));
  machine.hardReset();
  return new Sp48FakeMachineController(machine);
}

describe("Sp48 fake machine lifecycle", () => {
  it("does not advance frames while stopped", async () => {
    const controller = await createController();

    expect(controller.machineState).toBe(MachineControllerState.None);
    expect(controller.tickFrame()).toBe(false);
    expect(controller.machine.frames).toBe(0);
  });

  it("starts, emits frame completion, and submits fake audio metadata", async () => {
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
    expect(controller.machine.tacts).toBe(69_888);
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

  it("stops and restarts the fake machine", async () => {
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

    expect(controller.machine.getKeyboardLine(1)).toBe(0xfb);
    expect(controller.renderInstantScreen().length).toBe(256 * 192);
  });
});
