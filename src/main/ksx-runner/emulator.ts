import type { CodeToInject } from "@abstractions/CodeToInject";
import type { ScriptCallContext } from "./MainScriptManager";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { getEmuApi } from "@common/messaging/MainToEmuMessenger";

export interface EmulatorApi {
  readonly executionState: MachineControllerState;
  start(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  reset(): Promise<void>;
  restart(): Promise<void>;
  debug(): Promise<void>;
  stepInto(): Promise<void>;
  stepOver(): Promise<void>;
  stepOut(): Promise<void>;

  injectCode(code: Uint8Array, org: number, partition?: number): Promise<void>;
  runCode(code: Uint8Array, org: number, partition?: number): Promise<void>;
  debugCode(code: Uint8Array, org: number, partition?: number): Promise<void>;
}

export function createEmulatorApi(context: ScriptCallContext): EmulatorApi {
  return {
    get executionState(): MachineControllerState {
      return context.state?.emulatorState?.machineState ?? MachineControllerState.None;
    },
    start: async () => {
      await getEmuApi().issueMachineCommand("start");
    },
    pause: async () => {
      await getEmuApi().issueMachineCommand("pause");
    },
    stop: async () => {
      await getEmuApi().issueMachineCommand("stop");
    },
    reset: async () => {
      await getEmuApi().issueMachineCommand("reset");
    },
    restart: async () => {
      await getEmuApi().issueMachineCommand("restart");
    },
    debug: async () => {
      await getEmuApi().issueMachineCommand("debug");
    },
    stepInto: async () => {
      await getEmuApi().issueMachineCommand("stepInto");
    },
    stepOver: async () => {
      await getEmuApi().issueMachineCommand("stepOver");
    },
    stepOut: async () => {
      await getEmuApi().issueMachineCommand("stepOut");
    },
    async injectCode(code: Uint8Array, org: number = 0x8000, partition?: number): Promise<void> {
      await getEmuApi().injectCodeCommand(createCodeToInject(code, org, partition));
    },
    runCode: async (code: Uint8Array, org: number = 0x8000, partition?: number): Promise<void> => {
      await getEmuApi().runCodeCommand(createCodeToInject(code, org, partition), false);
    },
    debugCode: async (
      code: Uint8Array,
      org: number = 0x8000,
      partition?: number
    ): Promise<void> => {
      await getEmuApi().runCodeCommand(createCodeToInject(code, org, partition), true);
    }
  };
}

function createCodeToInject(
  code: Uint8Array,
  org: number = 0x8000,
  partition?: number
): CodeToInject {
  return {
    model: "sp48",
    entryAddress: org,
    subroutine: true,
    segments: [
      {
        startAddress: org,
        bank: partition,
        bankOffset: 0,
        emittedCode: Array.from(code)
      }
    ],
    options: {}
  };
}
