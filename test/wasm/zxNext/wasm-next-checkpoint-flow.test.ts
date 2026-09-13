import { readFileSync } from "node:fs";

import type { Channel, RequestMessage } from "@messaging/messages-core";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { Store } from "@state/redux-light";

import { describe, expect, it } from "vitest";

import createAppStore from "@state/store";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { FILE_PROVIDER } from "@emu/machines/machine-props";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import {
  productionOutput,
  waitForZxNextWasmBuildLock
} from "../../../scripts/build-zxnext-wasm.cjs";
import { buildZxNextWasmArtifact } from "./wasm-next-test-helpers";
import { FileProvider } from "../../zxnext/FileProvider";

const CHECKPOINT_KEY = "test-boot";

/**
 * These cover the seam that makes the boot checkpoint pay off: `MachineController.runCode()` has to
 * consult the machine BEFORE single-stepping to the execution point, and capture AFTER arriving.
 */
describe("ZX Spectrum Next checkpointed injection flow", () => {
  it("restores a held checkpoint instead of reaching the execution point", async () => {
    const { controller, machine } = await createHarness("restore");

    // --- Stand in for a previous run having already booted the machine.
    machine.captureCheckpoint(CHECKPOINT_KEY);

    // --- Reaching an execution point is the one thing that puts the machine into
    // --- `UntilExecutionPoint`. If the restore did its job, no frame ever runs in that mode.
    const terminationModes = new Set<FrameTerminationMode>();
    const realExecuteFrame = machine.executeMachineFrame.bind(machine);
    machine.executeMachineFrame = () => {
      terminationModes.add(machine.executionContext.frameTerminationMode);
      return realExecuteFrame();
    };

    let restoreCalls = 0;
    const realRestore = machine.tryRestoreCheckpoint.bind(machine);
    machine.tryRestoreCheckpoint = (key: string) => {
      restoreCalls++;
      return realRestore(key);
    };

    // --- An execution point the machine would never reach on its own: if the controller ran the
    // --- step instead of restoring, this would spin instead of completing.
    setInjectionFlow(machine, [
      { type: "KeepPc" },
      { type: "ReachExecPoint", rom: 0, execPoint: 0xffff, checkpoint: CHECKPOINT_KEY }
    ]);

    await controller.runCode(emptyCode(), undefined, false, false);
    await controller.stop();

    expect(restoreCalls).toBe(1);
    expect(terminationModes.has(FrameTerminationMode.UntilExecutionPoint)).toBe(false);
  });

  it("captures a checkpoint once the execution point is reached", async () => {
    const { controller, machine } = await createHarness("capture");

    const execPoint = pcAfterOneInstructionFromReset(machine);
    let captureCalls = 0;
    const realCapture = machine.captureCheckpoint.bind(machine);
    machine.captureCheckpoint = (key: string) => {
      captureCalls++;
      realCapture(key);
    };

    setInjectionFlow(machine, [
      { type: "KeepPc" },
      { type: "ReachExecPoint", rom: 0, execPoint, checkpoint: CHECKPOINT_KEY }
    ]);

    await controller.runCode(emptyCode(), undefined, false, false);
    await controller.stop();

    expect(captureCalls).toBe(1);
    expect(machine.tryRestoreCheckpoint(CHECKPOINT_KEY)).toBe(true);
  });

  it("drops the checkpoint as soon as the machine writes to the SD card", async () => {
    const { machine, messenger } = await createHarness("sd-write");

    machine.captureCheckpoint(CHECKPOINT_KEY);
    expect(machine.tryRestoreCheckpoint(CHECKPOINT_KEY)).toBe(true);

    // --- The SD image is a real file the checkpoint cannot rewind, so writing to it has to
    // --- invalidate any state captured before the write.
    machine.setFrameCommand({
      command: "sd-write",
      sector: 3,
      data: new Uint8Array(512)
    });
    await machine.processFrameCommand(messenger);

    expect(machine.tryRestoreCheckpoint(CHECKPOINT_KEY)).toBe(false);
  });

  it("keeps the checkpoint when the machine only reads the SD card", async () => {
    const { machine, messenger } = await createHarness("sd-read");

    machine.captureCheckpoint(CHECKPOINT_KEY);
    machine.setFrameCommand({ command: "sd-read", sector: 3 });
    await machine.processFrameCommand(messenger);

    expect(machine.tryRestoreCheckpoint(CHECKPOINT_KEY)).toBe(true);
  });

  it("leaves an unmarked step alone", async () => {
    const { controller, machine } = await createHarness("unmarked");

    let captureCalls = 0;
    machine.captureCheckpoint = () => {
      captureCalls++;
    };

    const execPoint = pcAfterOneInstructionFromReset(machine);
    setInjectionFlow(machine, [
      { type: "KeepPc" },
      { type: "ReachExecPoint", rom: 0, execPoint }
    ]);

    await controller.runCode(emptyCode(), undefined, false, false);
    await controller.stop();

    expect(captureCalls).toBe(0);
  });
});

function setInjectionFlow(machine: ZxNextWasmV2Machine, flow: CodeInjectionFlow): void {
  machine.getCodeInjectionFlow = async () => flow;
}

function emptyCode(): CodeToInject {
  return { model: "zxnext", segments: [], options: {} };
}

/**
 * The address the machine reaches after a single instruction from a reset - an execution point the
 * controller is guaranteed to hit almost immediately, so these tests never depend on how far into
 * its boot the ROM happens to get.
 */
function pcAfterOneInstructionFromReset(machine: ZxNextWasmV2Machine): number {
  machine.hardReset();
  machine.executeWasmV2Instruction();
  const pc = machine.pc;
  machine.hardReset();
  return pc;
}

async function createHarness(
  name: string
): Promise<{
  controller: MachineController;
  machine: ZxNextWasmV2Machine;
  store: Store<any>;
  messenger: MessengerBase;
}> {
  await buildZxNextWasmArtifact();
  const machine = new ZxNextWasmV2Machine(undefined, undefined, undefined, {
    artifactName: `test-zxnext-checkpoint-${name}.wasm`,
    readArtifact: async () => {
      waitForZxNextWasmBuildLock();
      return readFileSync(productionOutput);
    }
  });
  machine.setMachineProperty(FILE_PROVIDER, new FileProvider());
  await machine.setup();
  const store = createAppStore(`test-checkpoint-${name}`);
  const messenger = new ResolvingMessenger();
  const controller = new MachineController(store, messenger, machine);
  controller.debugSupport = new DebugSupport(store);
  expect(controller.state).toBe(MachineControllerState.None);
  return { controller, machine, store, messenger };
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
