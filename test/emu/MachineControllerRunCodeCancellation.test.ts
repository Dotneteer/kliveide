import { describe, expect, it, vi } from "vitest";

import type { Channel, RequestMessage } from "@messaging/messages-core";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { CodeToInject } from "@abstractions/CodeToInject";

import createAppStore from "@state/store";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import { processMainToEmuMessages } from "@renderer/appEmu/MainToEmuProcessor";
import { MI_SPECTRUM_48 } from "@common/machines/constants";

describe("MachineController project startup cancellation", () => {
  it("does not resume a project startup after a user stop during the startup flow", async () => {
    const machine = new StartupFlowMachine();
    const controller = new MachineController(
      createAppStore("test-run-code-cancel"),
      new ResolvingMessenger(),
      machine as any
    );

    const runResult = controller.runCode(createCodeToInject(), null, false, false).catch((err) => err);

    await waitForControllerState(controller, MachineControllerState.Paused);
    await controller.stop();

    const error = await runResult;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Project startup canceled.");
    expect(controller.state).toBe(MachineControllerState.Stopped);
    expect(machine.injectCodeToRun).not.toHaveBeenCalled();

    await wait(30);
    expect(controller.state).toBe(MachineControllerState.Stopped);
    expect(machine.injectCodeToRun).not.toHaveBeenCalled();
  });

  it("waits for runCodeCommand before returning the emulator IPC response", async () => {
    const runCode = vi.fn<() => Promise<void>>();
    let finishRunCode!: () => void;
    runCode.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishRunCode = resolve;
        })
    );

    let completed = false;
    const responsePromise = processMainToEmuMessages(
      {
        type: "ApiMethodRequest",
        method: "runCodeCommand",
        args: [createCodeToInject(), null, false, false]
      },
      createAppStore("test-run-code-ipc"),
      new ResolvingMessenger(),
      {
        machineService: {
          getMachineController: () => ({ runCode })
        }
      } as any
    ).then((response) => {
      completed = true;
      return response;
    });

    await Promise.resolve();
    expect(completed).toBe(false);

    finishRunCode();

    await expect(responsePromise).resolves.toMatchObject({
      type: "ApiMethodResponse",
      result: undefined
    });
    expect(runCode).toHaveBeenCalledWith(createCodeToInject(), null, false, false);
  });
});

function createCodeToInject(): CodeToInject {
  return {
    model: MI_SPECTRUM_48,
    entryAddress: 0x8000,
    segments: [
      {
        startAddress: 0x8000,
        bankOffset: 0,
        emittedCode: [0x00]
      }
    ],
    options: {}
  };
}

class StartupFlowMachine {
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
  tactsAtLastStart = 0;
  softResetOnFirstStart = false;

  private readonly properties = new Map<string, any>();

  getCodeInjectionFlow = vi.fn<() => Promise<CodeInjectionFlow>>().mockResolvedValue([
    {
      type: "ReachExecPoint",
      rom: 0,
      execPoint: 0x1234
    },
    {
      type: "Wait",
      duration: 20
    },
    {
      type: "Inject"
    }
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
