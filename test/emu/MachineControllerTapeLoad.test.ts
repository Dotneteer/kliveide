import { describe, expect, it, vi } from "vitest";

import type { Channel, RequestMessage } from "@messaging/messages-core";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";

import createAppStore from "@state/store";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import { processMainToEmuMessages } from "@renderer/appEmu/MainToEmuProcessor";
import { MI_SPECTRUM_48 } from "@common/machines/constants";
import { menuTapeLoadFlow, sp48TapeLoadFlow } from "@emu/machines/tapeLoadFlows";
import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";

/*
 * "Load and run" a tape (`.plans/TAPE_VIEWER_PLAN.md` §4.6): `MachineController.runTapeLoad` runs a
 * machine's tape-load flow - reset, reach the editor or the menu, type - and injects nothing. The
 * 48K flow's keys load a real tape on the real ROM in `test/tape/tape-load-flow.test.ts`.
 */

describe("tape load flows", () => {
  it('types LOAD "" and ENTER on the 48K, keeping the ROM\'s PC', () => {
    const flow = sp48TapeLoadFlow();
    expect(flow.some((s) => s.type === "Inject")).toBe(false);
    expect(flow.some((s) => s.type === "KeepPc")).toBe(true);
    const keys = flow.flatMap((s) => (s.type === "QueueKey" ? [[s.primary, s.secondary]] : []));
    expect(keys).toEqual([
      [SpectrumKeyCode.J, undefined],
      [SpectrumKeyCode.P, SpectrumKeyCode.SShift],
      [SpectrumKeyCode.P, SpectrumKeyCode.SShift],
      [SpectrumKeyCode.Enter, undefined]
    ]);
  });

  it("picks the first menu item on the 128K and +2/+3", () => {
    const flow = menuTapeLoadFlow(0x2653, "Tape Loader");
    expect(flow[0]).toMatchObject({ type: "ReachExecPoint", rom: 0, execPoint: 0x2653 });
    const keys = flow.filter((s) => s.type === "QueueKey");
    expect(keys).toEqual([expect.objectContaining({ primary: SpectrumKeyCode.Enter })]);
  });
});

describe("MachineController.runTapeLoad", () => {
  it("runs the flow, types its keys, injects nothing and starts the machine", async () => {
    const machine = new TapeFlowMachine();
    const controller = new MachineController(
      createAppStore("test-tape-load"),
      new ResolvingMessenger(),
      machine as any
    );
    await controller.runTapeLoad(false);
    expect(machine.queueKeystroke).toHaveBeenCalledWith(
      0,
      5,
      SpectrumKeyCode.Enter,
      undefined,
      undefined
    );
    expect(machine.injectCodeToRun).not.toHaveBeenCalled();
    expect(machine.getCodeInjectionFlow).not.toHaveBeenCalled();
    // --- KeepPc: the ROM carries on where the flow left it
    expect(machine.pc).toBe(0x1234);
    // --- Started, not left stopped (the stub reports an execution point every frame, so it may
    // --- already have paused again)
    expect([MachineControllerState.Running, MachineControllerState.Paused]).toContain(
      controller.state
    );
    await controller.stop();
  });

  it("refuses a machine with no tape-load flow", async () => {
    const machine = new TapeFlowMachine();
    machine.getTapeLoadFlow = undefined;
    const controller = new MachineController(
      createAppStore("test-tape-load-none"),
      new ResolvingMessenger(),
      machine as any
    );
    await expect(controller.runTapeLoad(false)).rejects.toThrow(/cannot start loading a tape/);
  });

  it("is reached through the emulator's startTapeLoad message", async () => {
    const runTapeLoad = vi.fn(async () => undefined);
    const response = await processMainToEmuMessages(
      { type: "ApiMethodRequest", method: "startTapeLoad", args: [true] },
      createAppStore("test-tape-load-ipc"),
      new ResolvingMessenger(),
      { machineService: { getMachineController: () => ({ runTapeLoad }) } } as any
    );
    expect(response).toMatchObject({ type: "ApiMethodResponse" });
    expect(runTapeLoad).toHaveBeenCalledWith(true);
  });
});

class TapeFlowMachine {
  readonly machineId = MI_SPECTRUM_48;
  readonly executionContext = {
    frameTerminationMode: FrameTerminationMode.Normal,
    debugStepMode: DebugStepMode.NoDebug,
    canceled: false
  };

  pc = 0x0000;
  sp = 0xffff;
  frames = 0;
  frameJustCompleted = false;
  tacts = 0;
  tactsInFrame = 69_888;
  frameTactMultiplier = 1;
  baseClockFrequency = 3_500_000;
  uiFrameFrequency = 1;
  targetClockMultiplier = 1;
  clockMultiplier = 1;
  contentionDelaySincePause = 0;
  resetContentionDelaySincePause = vi.fn(() => {
    this.contentionDelaySincePause = 0;
  });
  tactsAtLastStart = 0;
  softResetOnFirstStart = false;

  private readonly properties = new Map<string, any>();

  getCodeInjectionFlow = vi.fn();
  getTapeLoadFlow?: () => CodeInjectionFlow = vi.fn(() => [
    ...menuTapeLoadFlow(0x1234, "Tape Loader")
  ]);
  injectCodeToRun = vi.fn(() => 0x8000);
  hardReset = vi.fn(async () => undefined);
  reset = vi.fn();
  onStop = vi.fn();
  queueKeystroke = vi.fn();
  awakeCpu = vi.fn();
  markStepOutAddress = vi.fn();

  executeMachineFrame(): FrameTerminationMode {
    this.frames++;
    this.pc = 0x1234;
    return FrameTerminationMode.UntilExecutionPoint;
  }

  getFrameCommand(): undefined {
    return undefined;
  }

  processFrameCommand(): Promise<void> {
    return Promise.resolve();
  }

  setFrameCommand(): void {}

  setMachineProperty(key: string, value?: any): void {
    if (value === undefined) {
      this.properties.delete(key);
    } else {
      this.properties.set(key, value);
    }
  }

  getMachineProperty(key: string): any {
    return this.properties.get(key);
  }

  getCurrentPartitionLabels(): Record<number, string> {
    return {};
  }
}

async function waitForControllerState(
  controller: MachineController,
  state: MachineControllerState
): Promise<void> {
  const deadline = Date.now() + 500;
  while (controller.state !== state) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for controller state ${MachineControllerState[state]}.`);
    }
    await wait(1);
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
