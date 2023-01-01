import { MessageBase } from "./messages-core";

/**
 * The main process signs that the emulator should change to a new emulated machine type
 */
export interface EmuSetMachineTypeRequest extends MessageBase {
  type: "EmuSetMachineType";
  machineId: string;
}

type MachineCommand =
  | "start"
  | "pause"
  | "stop"
  | "restart"
  | "debug"
  | "stepInto"
  | "stepOver"
  | "stepOut";

/**
 * The main process sends a machine command to the emulator
 */
export interface EmuMachineCommandRequest extends MessageBase {
  type: "EmuMachineCommand";
  command: MachineCommand;
}

/**
 * The main process sends a tape file to the emulator
 */
export interface EmuSetTapeFileRequest extends MessageBase {
  type: "EmuSetTapeFile";
  file: string;
  contents: Uint8Array;
}

export function createMachineCommand (
  command: MachineCommand
): EmuMachineCommandRequest {
  return {
    type: "EmuMachineCommand",
    command
  };
}
