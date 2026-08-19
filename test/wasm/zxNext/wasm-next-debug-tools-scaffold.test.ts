import { readFileSync } from "node:fs";

import type { Channel, RequestMessage, ResponseMessage } from "@messaging/messages-core";
import type { Store } from "@state/redux-light";

import createAppStore from "@state/store";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MemorySectionType } from "@abstractions/MemorySection";
import { MessengerBase } from "@messaging/MessengerBase";
import { processMainToEmuMessages } from "@renderer/appEmu/MainToEmuProcessor";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import { buildZxNextWasm, productionOutput } from "../../../scripts/build-zxnext-wasm.cjs";
import { describe, expect, it } from "vitest";

describe("ZX Spectrum Next WASM v2 debug tools scaffold", () => {
  it("runs debug commands as scaffold debug steps without breakpoint semantic parity claims", async () => {
    const { controller, machine } = await createControllerHarness("debug-tools");

    await controller.startDebug();
    await waitForControllerState(controller, MachineControllerState.Paused);
    expect(machine.executionContext.debugStepMode).toBe(DebugStepMode.StopAtBreakpoint);
    expect(machine.executionContext.lastTerminationReason).toBe(FrameTerminationMode.DebugEvent);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      debugSteps: 1,
      lastScaffoldStopReason: "scaffoldDebugStep"
    });

    await controller.start();
    await waitForControllerState(controller, MachineControllerState.Running);
    await waitForCompletedFrames(controller, 1);
    await controller.pause();
    expect(controller.state).toBe(MachineControllerState.Paused);
    expect(machine.getWasmV2Diagnostics().lastScaffoldStopReason).toBe("scaffoldFrameComplete");

    await controller.stepInto();
    await waitForControllerState(controller, MachineControllerState.Paused);
    await controller.stepOver();
    await waitForControllerState(controller, MachineControllerState.Paused);
    await controller.stepOut();
    await waitForControllerState(controller, MachineControllerState.Paused);

    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      debugSteps: 4,
      lastScaffoldStopReason: "scaffoldDebugStep"
    });
    expect(machine.getWasmV2Diagnostics().lastScaffoldStopReason).not.toMatch(/breakpoint|cpu|device/i);

    await controller.stop();
    expect(controller.state).toBe(MachineControllerState.Stopped);
  });

  it("keeps register, memory, disassembly, and breakpoint-list plumbing available", async () => {
    const harness = await createControllerHarness("debug-plumbing");
    const { controller, machine, messenger, store } = harness;

    machine.pc = 0x4567;
    machine.doWriteMemory(0x4000, 0x5a);
    controller.debugSupport.addBreakpoint({ address: 0x4000, exec: true });

    const cpuState = machine.getCpuState();
    expect(cpuState.pc).toBe(0x4567);

    const memoryResponse = await sendProcessorRequest("getMemoryContents", [], harness);
    expect(memoryResponse.result).toMatchObject({
      pc: 0x4567,
      osInitialized: false
    });
    expect(memoryResponse.result.memory[0x4000]).toBe(0x5a);

    const disassemblyResponse = await sendProcessorRequest(
      "getDisassemblySections",
      [{ ram: true, screen: true }],
      { controller, machine, messenger, store }
    );
    expect(disassemblyResponse.result).toContainEqual({
      startAddress: 0x0000,
      endAddress: 0xffff,
      sectionType: MemorySectionType.Disassemble
    });

    const breakpointResponse = await sendProcessorRequest("listBreakpoints", [], harness);
    expect(breakpointResponse.result.breakpoints).toHaveLength(1);
    expect(breakpointResponse.result.breakpoints[0]).toMatchObject({
      address: 0x4000,
      exec: true
    });
    expect(breakpointResponse.result.memorySegments[0][0]).toBe(0x5a);
  });
});

type ControllerHarness = {
  controller: MachineController;
  machine: ZxNextWasmV2Machine;
  messenger: ResolvingMessenger;
  store: Store;
};

async function createControllerHarness(name: string): Promise<ControllerHarness> {
  buildZxNextWasm();
  const machine = new ZxNextWasmV2Machine(
    undefined,
    undefined,
    undefined,
    {
      artifactName: `test-zxnext-${name}.wasm`,
      readArtifact: async () => readFileSync(productionOutput)
    }
  );
  await machine.setup();
  const store = createAppStore(`test-${name}`);
  const messenger = new ResolvingMessenger();
  const controller = new MachineController(store, messenger, machine);
  controller.debugSupport = new DebugSupport(store);
  return { controller, machine, messenger, store };
}

async function sendProcessorRequest(
  method: string,
  args: any[],
  harness: ControllerHarness
): Promise<ResponseMessage & { result?: any }> {
  return await processMainToEmuMessages(
    {
      type: "ApiMethodRequest",
      method,
      args
    },
    harness.store,
    harness.messenger,
    {
      machineService: {
        getMachineController: () => harness.controller
      }
    } as any
  ) as ResponseMessage & { result?: any };
}

async function waitForCompletedFrames(controller: MachineController, frameCount: number): Promise<void> {
  if (controller.machine.frames >= frameCount) return;
  await new Promise<void>((resolve) => {
    const handler = () => {
      if (controller.machine.frames >= frameCount) {
        controller.frameCompleted.off(handler);
        resolve();
      }
    };
    controller.frameCompleted.on(handler);
  });
}

async function waitForControllerState(
  controller: MachineController,
  state: MachineControllerState
): Promise<void> {
  const deadline = Date.now() + 1000;
  while (controller.state !== state) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for controller state ${MachineControllerState[state]}.`);
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
