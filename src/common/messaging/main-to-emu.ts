import { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { SysVar } from "@abstractions/SysVar";
import { MessageBase } from "./messages-core";
import { CodeToInject } from "@abstractions/CodeToInject";
import { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
import { FloppyLogEntry } from "@abstractions/FloppyLogEntry";
import { PsgChipState } from "@emu/abstractions/PsgChipState";

// --- Set the emulator's machine type to use
export interface EmuSetMachineTypeRequest extends MessageBase {
  type: "EmuSetMachineType";
  machineId: string;
  modelId?: string;
  config?: Record<string, any>;
}

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

// --- Execute an emulated machine's control command
export interface EmuMachineCommandRequest extends MessageBase {
  type: "EmuMachineCommand";
  command: MachineCommand;
  customCommand?: string;
}

// --- Set the tape file to use
export interface EmuSetTapeFileRequest extends MessageBase {
  type: "EmuSetTapeFile";
  file: string;
  contents: Uint8Array;
  confirm?: boolean;
  suppressError?: boolean;
}

// --- Set the disk file to use
export interface EmuSetDiskFileRequest extends MessageBase {
  type: "EmuSetDiskFile";
  diskIndex: number;
  file?: string;
  contents?: Uint8Array;
  confirm?: boolean;
  suppressError?: boolean;
}

// --- Set the disk write protection state
export interface EmuSetDiskWriteProtectionRequest extends MessageBase {
  type: "EmuSetDiskWriteProtection";
  diskIndex: number;
  protect: boolean;
}

// --- Get the current state of the CPU
export interface EmuGetCpuStateRequest extends MessageBase {
  type: "EmuGetCpuState";
}

// --- Get the current state of the ULA
export interface EmuGetUlaStateRequest extends MessageBase {
  type: "EmuGetUlaState";
}

// --- Get the current state of the PSG chip (AY-3-8912)
export interface EmuGetPsgStateRequest extends MessageBase {
  type: "EmuGetPsgState";
}

// --- Get the current state of the BLINK chip
export interface EmuGetBlinkStateRequest extends MessageBase {
  type: "EmuGetBlinkState";
}

// --- Erase all breakpoints set in the emulator
export interface EmuEraseAllBreakpointsRequest extends MessageBase {
  type: "EmuEraseAllBreakpoints";
}

// --- Set a breakpoint in the emulator
export interface EmuSetBreakpointRequest extends MessageBase {
  type: "EmuSetBreakpoint";
  breakpoint: BreakpointInfo;
}

// --- Remove a breakpoint from the emulator
export interface EmuRemoveBreakpointRequest extends MessageBase {
  type: "EmuRemoveBreakpoint";
  breakpoint: BreakpointInfo;
}

// --- List all breakpoints in the emulator
export interface EmuListBreakpointsRequest extends MessageBase {
  type: "EmuListBreakpoints";
}

// --- Enable/disable a breakpoint
export interface EmuEnableBreakpointRequest extends MessageBase {
  type: "EmuEnableBreakpoint";
  breakpoint: BreakpointInfo;
  enable: boolean;
}

// --- Get the memory contents
export interface EmuGetMemoryRequest extends MessageBase {
  type: "EmuGetMemory";
  partition?: number;
}

// --- Get the system variables of the emulated machine
export interface EmuGetSysVarsRequest extends MessageBase {
  type: "EmuGetSysVars";
}

// --- Inject code into the emulated machine
export interface EmuInjectCodeRequest extends MessageBase {
  type: "EmuInjectCode";
  codeToInject: CodeToInject;
}

// --- Run code in the emulated machine
export interface EmuRunCodeRequest extends MessageBase {
  type: "EmuRunCode";
  codeToInject: CodeToInject;
  debug: boolean;
}

// --- Resolve source code breakpoints
export interface EmuResolveBreakpointsRequest extends MessageBase {
  type: "EmuResolveBreakpoints";
  breakpoints: ResolvedBreakpoint[];
}

// --- Scroll breakpoints in the source code editor
export interface EmuScrollBreakpointsRequest extends MessageBase {
  type: "EmuScrollBreakpoints";
  addr: BreakpointInfo;
  shift: number;
}

// --- Normalize breakpoints in the source code editor
export interface EmuNormalizeBreakpointsRequest extends MessageBase {
  type: "EmuNormalizeBreakpoints";
  resource: string;
  lineCount: number;
}

// --- Get the NEC UPD 765 state information
export interface EmuGetNecUpd765Request extends MessageBase {
  type: "EmuGetNecUpd765State";
}

// --- Start a script running in the emulator process
export interface EmuStartScriptRequest extends MessageBase {
  type: "EmuStartScript";
  id: number;
  scriptFile: string;
  contents: string;
}

// --- Stop a script running in the emulator process
export interface EmuStopScriptRequest extends MessageBase {
  type: "EmuStopScript";
  id: number;
}

// --- The response with the CPU state information
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
  snoozed: boolean;
}

// --- The response with the ULA state information
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

// --- The response with the PSG chip state information
export interface EmuGetPsgStateResponse extends MessageBase {
  type: "EmuGetPsgStateResponse";
  psgState: PsgChipState;
}

// --- The response with the breakpoints set in the emulator
export interface EmuListBreakpointsResponse extends MessageBase {
  type: "EmuListBreakpointsResponse";
  breakpoints: BreakpointInfo[];
  memorySegments?: number[][];
}

// --- The response with the memory contents
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
  partitionLabels: string[];
  selectedRom?: number;
  selectedBank?: number;
  osInitialized: boolean;
  memBreakpoints: BreakpointInfo[];
}

// --- The response with the system variables of the emulated machine
export interface EmuGetSysVarsResponse extends MessageBase {
  type: "EmuGetSysVarsResponse";
  sysVars: SysVar[];
}

// --- The response with the NEC UPD 765 state information
export interface EmuGetNecUpd765Response extends MessageBase {
  type: "EmuGetNecUpd765StateResponse";
  log: FloppyLogEntry[];
}

// --- The response with the BLINK chip state information
export interface EmuGetBlinkStateResponse extends MessageBase {
  type: "EmuGetBlinkStateResponse";
  SR0: number;
  SR1: number;
  SR2: number;
  SR3: number;
  TIM0: number;
  TIM1: number;
  TIM2: number;
  TIM3: number;
  TIM4: number;
  TSTA: number;
  TMK: number;
  INT: number;
  STA: number;
  COM: number;
  EPR: number;
  keyLines: number[];
  oscBit: boolean;
  earBit: boolean;
  PB0: number;
  PB1: number;
  PB2: number;
  PB3: number;
  SBR: number;
  SCW: number;
  SCH: number;
}

// --- Helper function to create a particular machine command
export function createMachineCommand (
  command: MachineCommand,
  customCommand?: string
): EmuMachineCommandRequest {
  return {
    type: "EmuMachineCommand",
    command,
    customCommand
  };
}
