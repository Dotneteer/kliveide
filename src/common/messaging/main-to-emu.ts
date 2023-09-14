import { BreakpointAddressInfo, BreakpointInfo } from "@abstractions/BreakpointInfo";
import { SysVar } from "@abstractions/SysVar";
import { MessageBase } from "./messages-core";
import { CodeToInject } from "@abstractions/CodeToInject";
import { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
import { PsgChipState } from "@emu/machines/zxSpectrum128/PsgChip";
import { FloppyLogEntry } from "@abstractions/FloppyLogEntry";

/**
 * The main process signs that the emulator should change to a new emulated machine type
 */
export interface EmuSetMachineTypeRequest extends MessageBase {
  type: "EmuSetMachineType";
  machineId: string;
}

/**
 * Available machine commands
 */
export type MachineCommand =
  | "start"
  | "pause"
  | "stop"
  | "restart"
  | "debug"
  | "stepInto"
  | "stepOver"
  | "stepOut"
  | "rewind";

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

/**
 * The main process sends a disk file to the emulator
 */
export interface EmuSetDiskFileRequest extends MessageBase {
  type: "EmuSetDiskFile";
  diskIndex: number;
  file?: string;
  contents?: Uint8Array;
}

/**
 * The Ide process asks the emu process for CPU state information
 */
export interface EmuGetCpuStateRequest extends MessageBase {
  type: "EmuGetCpuState";
}

/**
 * The Ide process asks the emu process for ULA state information
 */
export interface EmuGetUlaStateRequest extends MessageBase {
  type: "EmuGetUlaState";
}

/**
 * The Ide process asks the emu process for ULA state information
 */
export interface EmuGetPsgStateRequest extends MessageBase {
  type: "EmuGetPsgState";
}


export interface EmuEraseAllBreakpointsRequest extends MessageBase {
  type: "EmuEraseAllBreakpoints";
}

export interface EmuSetBreakpointRequest extends MessageBase {
  type: "EmuSetBreakpoint";
  address?: number;
  partition?: number; 
  resource?: string;
  line?: number;
}

export interface EmuRemoveBreakpointRequest extends MessageBase {
  type: "EmuRemoveBreakpoint";
  address?: number;
  partition?: number; 
  resource?: string;
  line?: number;
}

export interface EmuListBreakpointsRequest extends MessageBase {
  type: "EmuListBreakpoints";
}

export interface EmuEnableBreakpointRequest extends MessageBase {
  type: "EmuEnableBreakpoint";
  address?: number;
  partition?: number; 
  resource?: string;
  line?: number;
  enable: boolean;
}

export interface EmuGetMemoryRequest extends MessageBase {
  type: "EmuGetMemory";
  partition?: number;
}

export interface EmuGetSysVarsRequest extends MessageBase {
  type: "EmuGetSysVars";
}

/**
 * The Ide asks Emu to inject the specified code
 */
export interface EmuInjectCodeRequest extends MessageBase {
  type: "EmuInjectCode";
  codeToInject: CodeToInject;
}

export interface EmuRunCodeRequest extends MessageBase {
  type: "EmuRunCode";
  codeToInject: CodeToInject;
  debug: boolean;
}

export interface EmuResolveBreakpointsRequest extends MessageBase {
  type: "EmuResolveBreakpoints";
  breakpoints: ResolvedBreakpoint[];
}

export interface EmuScrollBreakpointsRequest extends MessageBase {
  type: "EmuScrollBreakpoints";
  addr: BreakpointAddressInfo;
  shift: number;
}

export interface EmuNormalizeBreakpointsRequest extends MessageBase {
  type: "EmuNormalizeBreakpoints";
  resource: string;
  lineCount: number;
}

/**
 * The Ide process asks the emu process for NEC UPD 765 state information
 */
export interface EmuGetNecUpd765Request extends MessageBase {
  type: "EmuGetNecUpd765State";
}

/**
 * The Emu process sends back CPU state information
 */
export interface EmuGetCpuStateResponse extends MessageBase {
  type: "EmuGetCpuStateResponse";
  af: number;
  bc: number;
  de: number;
  hl: number;
  af_: number;
  bc_: number;
  de_: number;
  hl_: number;
  pc: number;
  sp: number;
  ix: number;
  iy: number;
  ir: number;
  wz: number;
  tacts: number;
  tactsAtLastStart: number;
  interruptMode: number;
  iff1: boolean;
  iff2: boolean;
  sigINT: boolean;
  halted: boolean;
}

/**
 * The Emu process sends back CPU state information
 */
export interface EmuGetUlaStateResponse extends MessageBase {
  type: "EmuGetUlaStateResponse";
  fcl: number;
  frm: number;
  ras: number;
  pos: number;
  pix: string;
  bor: string;
  flo: number;
  con: number;
  lco: number;
  ear: boolean;
  mic: boolean;
  keyLines: number[];
  romP: number;
  ramB: number;
}

/**
 * The Emu process sends back CPU state information
 */
export interface EmuGetPsgStateResponse extends MessageBase {
  type: "EmuGetPsgStateResponse";
  psgState: PsgChipState;
}

/**
 * The Emu process sends back CPU state information
 */
export interface EmuListBreakpointsResponse extends MessageBase {
  type: "EmuListBreakpointsResponse";
  breakpoints: BreakpointInfo[];
  memorySegments?: number[][];
}

export interface EmuGetMemoryResponse extends MessageBase {
  type: "EmuGetMemoryResponse";
  memory: Uint8Array;
  pc: number;
  af: number;
  bc: number;
  de: number;
  hl: number;
  af_: number;
  bc_: number;
  de_: number;
  hl_: number;
  sp: number;
  ix: number;
  iy: number;
  ir: number;
  wz: number;
  osInitialized: boolean;
  memBreakpoints: BreakpointInfo[];
}

export interface EmuGetSysVarsResponse extends MessageBase {
  type: "EmuGetSysVarsResponse";
  sysVars: SysVar[];
}

/**
 * The Ide process asks the emu process for NEC UPD 765 state information
 */
export interface EmuGetNecUpd765Response extends MessageBase {
  type: "EmuGetNecUpd765StateResponse";
  log: FloppyLogEntry[];
}

export function createMachineCommand (
  command: MachineCommand
): EmuMachineCommandRequest {
  return {
    type: "EmuMachineCommand",
    command
  };
}
