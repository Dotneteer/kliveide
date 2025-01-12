import type { MessageBase } from "./messages-core";
import { CallStackInfo } from "@emu/abstractions/CallStack";
import { MemoryPageInfo } from "@emu/machines/zxNext/MemoryDevice";

/**
 * Available machine commands
 */
export type MachineCommand =
  | "start"
  | "pause"
  | "stop"
  | "reset"
  | "restart"
  | "debug"
  | "stepInto"
  | "stepOver"
  | "stepOut"
  | "rewind"
  | "custom";

// --- Gets the Next register descriptors
export interface EmuGetNextRegDescriptorsRequest extends MessageBase {
  type: "EmuGetNextRegDescriptors";
}

// --- Gets the Next register device state
export interface EmuGetNextRegStateRequest extends MessageBase {
  type: "EmuGetNextRegState";
}

// --- Gets the Next memory mapping data
export interface EmuGetNextMemoryMappingRequest extends MessageBase {
  type: "EmuGetNextMemoryMapping";
}

// --- Gets the Next memory mapping data
export interface EmuParsePartitionLabelRequest extends MessageBase {
  type: "EmuParsePartitionLabel";
  label: string;
}

export interface EmuGetPartitionLabelsRequest extends MessageBase {
  type: "EmuGetPartitionLabels";
}

export interface EmuGetCallStackRequest extends MessageBase {
  type: "EmuGetCallStack";
}

export interface EmuSetKeyStateRequest extends MessageBase {
  type: "EmuSetKeyState";
  key: number;
  isDown: boolean;
}

// --- The response with the Next register descriptors
export interface EmuGetNextRegDescriptorsResponse extends MessageBase {
  type: "EmuGetNextRegDescriptorsResponse";
  descriptors: {
    id: number;
    description: string;
    isReadOnly?: boolean;
    isWriteOnly?: boolean;
    slices?: {
      mask?: number;
      shift?: number;
      description?: string;
      valueSet?: Record<number, string>;
      view?: "flag" | "number";
    }[];
  }[];
}

// --- The response with the Next register device state
export interface EmuGetNextRegStateResponse extends MessageBase {
  type: "EmuGetNextRegStateResponse";
  lastRegisterIndex: number;
  regs: {
    id: number;
    lastWrite?: number;
    value?: number;
  }[];
}

// --- The response with the Next register device state
export interface EmuGetNextMemoryMappingResponse extends MessageBase {
  type: "EmuGetNextMemoryMappingResponse";
  allRamsBanks?: number[];
  selectedRom: number;
  selectedBank: number;
  port7ffd: number;
  port1ffd: number;
  portDffd: number;
  portEff7: number;
  portLayer2: number;
  portTimex: number;
  divMmc: number;
  divMmcIn: boolean;
  pageInfo: MemoryPageInfo[];
}

export interface EmuGetCallStackResponse extends MessageBase {
  type: "EmuGetCallStackResponse";
  callStack: CallStackInfo;
}
