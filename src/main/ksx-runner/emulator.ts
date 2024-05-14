import { CodeToInject } from "@abstractions/CodeToInject";
import { ScriptCallContext } from "./MainScriptManager";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { sendFromMainToEmu } from "@common/messaging/MainToEmuMessenger";

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
      await sendFromMainToEmu({ type: "EmuMachineCommand", command: "start" });
    },
    pause: async () => {
      await sendFromMainToEmu({ type: "EmuMachineCommand", command: "pause" });
    },
    stop: async () => {
      await sendFromMainToEmu({ type: "EmuMachineCommand", command: "stop" });
    },
    reset: async () => {
      await sendFromMainToEmu({ type: "EmuMachineCommand", command: "reset" });
    },
    restart: async () => {
      await sendFromMainToEmu({ type: "EmuMachineCommand", command: "restart" });
    },
    debug: async () => {
      await sendFromMainToEmu({ type: "EmuMachineCommand", command: "debug" });
    },
    stepInto: async () => {
      await sendFromMainToEmu({ type: "EmuMachineCommand", command: "stepInto" });
    },
    stepOver: async () => {
      await sendFromMainToEmu({ type: "EmuMachineCommand", command: "stepOver" });
    },
    stepOut: async () => {
      await sendFromMainToEmu({ type: "EmuMachineCommand", command: "stepOut" });
    },
    async injectCode(code: Uint8Array, org: number = 0x8000, partition?: number): Promise<void> {
      await sendFromMainToEmu({ type: "EmuInjectCode", codeToInject: createCodeToInject(code, org, partition) });
    },
    runCode: async (code: Uint8Array, org: number = 0x8000, partition?: number): Promise<void> => {
      await sendFromMainToEmu({ type: "EmuRunCode", codeToInject: createCodeToInject(code, org, partition), debug: false });
    },
    debugCode: async (code: Uint8Array, org: number = 0x8000, partition?: number): Promise<void> => {
      await sendFromMainToEmu({ type: "EmuRunCode", codeToInject: createCodeToInject(code, org, partition), debug: true });
    }
  };
}

function createCodeToInject(code: Uint8Array, org: number = 0x8000, partition?: number): CodeToInject {
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
