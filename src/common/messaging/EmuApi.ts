import { PsgChipState } from "@emu/abstractions/PsgChipState";
import { MachineCommand } from "@abstractions/MachineCommand";
import { buildMessagingProxy } from "./MessageProxy";
import { MessengerBase } from "./MessengerBase";
import { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { SysVar } from "@abstractions/SysVar";
import { CodeToInject } from "@abstractions/CodeToInject";
import { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
import { FloppyLogEntry } from "@abstractions/FloppyLogEntry";
import { MemoryPageInfo } from "@emu/machines/zxNext/MemoryDevice";
import { CallStackInfo } from "@emu/abstractions/CallStack";

const NO_PROXY_ERROR = "Method should be implemented by a proxy.";

/**
 * This class defines the shape of the Emu process API that can be called from
 * the main and Ide processes. The methods are called through a JavaScript proxy.
 */
class EmuApiImpl {
  async setMachineType(
    _machineId: string,
    _modelId?: string,
    _config?: Record<string, any>
  ): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async issueMachineCommand(_command: MachineCommand, _customCommand?: string): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async setTapeFile(
    _file: string,
    _contents: Uint8Array,
    _confirm?: boolean,
    _suppressError?: boolean
  ): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async setDiskFile(
    _diskIndex: number,
    _file?: string,
    _contents?: Uint8Array,
    _confirm?: boolean,
    _suppressError?: boolean
  ): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async setDiskWriteProtection(_index: number, _protect: boolean): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async getCpuState(): Promise<CpuState> {
    throw new Error(NO_PROXY_ERROR);
  }

  async getUlaState(): Promise<UlaState> {
    throw new Error(NO_PROXY_ERROR);
  }

  async getPsgState(): Promise<PsgChipState> {
    throw new Error(NO_PROXY_ERROR);
  }

  async getBlinkState(): Promise<BlinkState> {
    throw new Error(NO_PROXY_ERROR);
  }

  async eraseAllBreakpoints(): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async setBreakpoint(_breakpoint: BreakpointInfo): Promise<boolean> {
    throw new Error(NO_PROXY_ERROR);
  }

  async removeBreakpoint(_breakpoint: BreakpointInfo): Promise<boolean> {
    throw new Error(NO_PROXY_ERROR);
  }

  async listBreakpoints(): Promise<BreakpointsInfo> {
    throw new Error(NO_PROXY_ERROR);
  }

  async enableBreakpoint(_breakpoint: BreakpointInfo, _enable: boolean): Promise<boolean> {
    throw new Error(NO_PROXY_ERROR);
  }

  async getMemoryContents(_partition?: number): Promise<MemoryInfo> {
    throw new Error(NO_PROXY_ERROR);
  }

  async getSysVars(): Promise<SysVar[]> {
    throw new Error(NO_PROXY_ERROR);
  }

  async injectCodeCommand(_codeToInject: CodeToInject): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async runCodeCommand(_codeToInject: CodeToInject, _debug: boolean): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async resolveBreakpoints(_breakpoints: ResolvedBreakpoint[]): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async scrollBreakpoints(_addr: BreakpointInfo, _shift: number): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async normalizeBreakpoints(_resource: string, _lineCount: number): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async getNecUpd765State(): Promise<FloppyLogEntry[]> {
    throw new Error(NO_PROXY_ERROR);
  }

  async startScript(_id: number, _scriptFile: string, _contents: string): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async stopScript(_id: number): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }

  async getNextRegDescriptors(): Promise<NextRegDescriptors> {
    throw new Error(NO_PROXY_ERROR);
  }

  async getNextRegState(): Promise<NextRegState> {
    throw new Error(NO_PROXY_ERROR);
  }

  async getNextMemoryMapping(): Promise<NextMemoryMapping> {
    throw new Error(NO_PROXY_ERROR);
  }

  async parsePartitionLabel(_label: string): Promise<any> {
    throw new Error(NO_PROXY_ERROR);
  }

  async getPartitionLabels(): Promise<any> {
    throw new Error(NO_PROXY_ERROR);
  }

  async getCallStack(): Promise<CallStackInfo> {
    throw new Error(NO_PROXY_ERROR);
  }

  async setKeyStatus(_key: number, _isDown: boolean): Promise<void> {
    throw new Error(NO_PROXY_ERROR);
  }
}

// --- The response with the CPU state information
export type CpuState = {
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
};

export type UlaState = {
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
};

export type BlinkState = {
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
};

// --- The response with the breakpoints set in the emulator
export type BreakpointsInfo = {
  breakpoints: BreakpointInfo[];
  memorySegments?: number[][];
};

// --- The response with the memory contents
export type MemoryInfo = {
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
};

// --- The response with the Next register descriptors
export type NextRegDescriptors = {
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
};

// --- The response with the Next register device state
export type NextRegState = {
  lastRegisterIndex: number;
  regs: {
    id: number;
    lastWrite?: number;
    value?: number;
  }[];
};

// --- The response with the Next register device state
export type NextMemoryMapping = {
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
};

export type EmuApi = EmuApiImpl;

export function createEmuApi(messenger: MessengerBase): EmuApiImpl {
  return buildMessagingProxy(new EmuApiImpl(), messenger, "emu");
}
