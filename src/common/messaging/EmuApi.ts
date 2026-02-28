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
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { IMemorySection } from "@abstractions/MemorySection";

const NO_PROXY_ERROR = "Method should be implemented by a proxy.";

/**
 * This class defines the shape of the Emu process API that can be called from
 * the main and Ide processes. The methods are called through a JavaScript proxy.
 */
class EmuApiImpl {
  /**
   * Sets the machine type and optional model/configuration.
   * @param _machineId The machine type ID.
   * @param _modelId Optional model ID.
   * @param _config Optional configuration object.
   */
  async setMachineType(
    _machineId: string,
    _modelId?: string,
    _config?: Record<string, any>
  ): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Issues a machine command, optionally with a custom command string.
   * @param _command The machine command to issue.
   * @param _customCommand Optional custom command string.
   */
  async issueMachineCommand(_command: MachineCommand, _customCommand?: string): Promise<any> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets the tape file for the emulator.
   * @param _file The tape file name.
   * @param _contents The tape file contents as Uint8Array.
   * @param _confirm Optional flag to show confirmation.
   * @param _suppressError Optional flag to suppress errors.
   */
  async setTapeFile(
    _file: string,
    _contents: Uint8Array,
    _confirm?: boolean,
    _suppressError?: boolean
  ): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets the disk file for the specified drive.
   * @param _diskIndex The disk drive index.
   * @param _file Optional disk file name.
   * @param _contents Optional disk file contents.
   * @param _confirm Optional flag to show confirmation.
   * @param _suppressError Optional flag to suppress errors.
   */
  async setDiskFile(
    _diskIndex: number,
    _file?: string,
    _contents?: Uint8Array,
    _confirm?: boolean,
    _suppressError?: boolean
  ): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets write protection for a disk drive.
   * @param _index The disk drive index.
   * @param _protect True to enable write protection.
   */
  async setDiskWriteProtection(_index: number, _protect: boolean): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the current CPU state.
   */
  async getCpuState(): Promise<CpuState> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the current ULA state.
   */
  async getUlaState(): Promise<UlaState> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the current PSG chip state.
   */
  async getPsgState(): Promise<PsgChipState> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the current Blink device state.
   */
  async getBlinkState(): Promise<BlinkState> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Erases all breakpoints in the emulator.
   */
  async eraseAllBreakpoints(): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets a breakpoint in the emulator.
   * @param _breakpoint The breakpoint information.
   */
  async setBreakpoint(_breakpoint: BreakpointInfo): Promise<boolean> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Removes a breakpoint from the emulator.
   * @param _breakpoint The breakpoint information.
   */
  async removeBreakpoint(_breakpoint: BreakpointInfo): Promise<boolean> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Lists all breakpoints in the emulator.
   */
  async listBreakpoints(): Promise<BreakpointsInfo> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Enables or disables a breakpoint.
   * @param _breakpoint The breakpoint information.
   * @param _enable True to enable, false to disable.
   */
  async enableBreakpoint(_breakpoint: BreakpointInfo, _enable: boolean): Promise<boolean> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the memory contents for the specified partition.
   * @param _partition Optional memory partition index.
   */
  async getMemoryContents(_partition?: number): Promise<MemoryInfo> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the system variables.
   */
  async getSysVars(): Promise<SysVar[]> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Injects code into the emulator.
   * @param _codeToInject The code to inject.
   */
  async injectCodeCommand(_codeToInject: CodeToInject): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Runs code in the emulator, optionally in debug mode.
   * @param _codeToInject The code to run.
   * @package _additionalInfo Additional information for code execution.
   * @param _debug True to run in debug mode.
   * @param _projectDebug True to use project debug mode.
   */
  async runCodeCommand(
    _codeToInject: CodeToInject,
    _additionalInfo: any,
    _debug: boolean,
    _projectDebug: boolean
  ): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Resolves breakpoints in the emulator.
   * @param _breakpoints The breakpoints to resolve.
   */
  async resolveBreakpoints(_breakpoints: ResolvedBreakpoint[]): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Scrolls breakpoints by a shift value within bounds.
   * @param _addr The breakpoint address info.
   * @param _shift The shift value.
   * @param _lowerBound Optional lower bound.
   * @param _upperBound Optional upper bound.
   */
  async scrollBreakpoints(
    _addr: BreakpointInfo,
    _shift: number,
    _lowerBound?: number,
    _upperBound?: number
  ): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Resets breakpoints to the provided set.
   * @param _bps The new set of breakpoints.
   */
  async resetBreakpointsTo(_bps: BreakpointInfo[]): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Normalizes breakpoints for a resource and line count.
   * @param _resource The resource (file) name.
   * @param _lineCount The number of lines in the resource.
   */
  async normalizeBreakpoints(_resource: string, _lineCount: number): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the state of the NEC UPD765 floppy controller.
   */
  async getNecUpd765State(): Promise<FloppyLogEntry[]> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Starts a script in the emulator.
   * @param _id The script ID.
   * @param _scriptFile The script file name.
   * @param _contents The script contents.
   */
  async startScript(_id: number, _scriptFile: string, _contents: string): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Stops a running script in the emulator.
   * @param _id The script ID.
   */
  async stopScript(_id: number): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the Next register descriptors.
   */
  async getNextRegDescriptors(): Promise<NextRegDescriptors> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the Next register state.
   */
  async getNextRegState(): Promise<NextRegState> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the Next memory mapping state.
   */
  async getNextMemoryMapping(): Promise<NextMemoryMapping> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Parses a partition label.
   * @param _label The partition label to parse.
   */
  async parsePartitionLabel(_label: string): Promise<any> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets all partition labels.
   */
  async getPartitionLabels(): Promise<Record<number, string>> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the current call stack information.
   */
  async getCallStack(): Promise<CallStackInfo> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets the key status (pressed/released) for a key.
   * @param _key The key code.
   * @param _isDown True if the key is pressed.
   */
  async setKeyStatus(_key: number, _isDown: boolean): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets palette device information.
   */
  async getPalettedDeviceInfo(): Promise<PaletteDeviceInfo> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets a register value in the emulator.
   * @param _register The register name.
   * @param _value The value to set.
   */
  async setRegisterValue(_register: string, _value: number): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets memory content at a specific address.
   * @param _address The memory address.
   * @param _value The value to set.
   * @param _size The size in bytes.
   * @param _bigEndian True for big-endian byte order.
   */
  async setMemoryContent(
    _address: number,
    _value: number,
    _size: number,
    _bigEndian: boolean
  ): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the ROM flags array.
   */
  async getRomFlags(): Promise<boolean[]> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets a chunk of the CPU state.
   */
  async getCpuStateChunk(): Promise<CpuStateChunk> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Renames breakpoints for a resource.
   * @param _oldResource The old resource name.
   * @param _newResource The new resource name.
   */
  async renameBreakpoints(_oldResource: string, _newResource: string): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets the current VIC state.
   */
  async getVicState(): Promise<VicState> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets a disassembly section of the machine with the specified options.
   * @param _options The options for the disassembly section.
   * @returns The disassembly section.
   */
  async getDisassemblySections(_options: Record<string, any>): Promise<IMemorySection[]> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Issues a recording command to the emu renderer's RecordingManager.
   * @param _command The recording command to execute.
   */
  async issueRecordingCommand(
    _command:
      | "set-fps-native"
      | "set-fps-half"
      | "start-recording"
      | "disarm"
      | "pause-recording"
      | "resume-recording"
  ): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }
}

// --- The response with the CPU state chunk
export type CpuStateChunk = {
  state: MachineControllerState;
  pcValue: number;
  tacts: number;
};

// --- The response with the CPU state information
export type Z80CpuState = {
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
  opStartAddress: number;
  lastMemoryReads: Uint16Array;
  lastMemoryReadValue: number;
  lastMemoryWrites: Uint16Array;
  lastMemoryWriteValue: number;
  lastIoReadPort: number;
  lastIoReadValue: number;
  lastIoWritePort: number;
  lastIoWriteValue: number;
};

// --- The response with the CPU state information
export type M6510CpuState = {
  a: number;
  x: number;
  y: number;
  p: number;
  pc: number;
  sp: number;
  tacts: number;
  tactsAtLastStart: number;
  stalled: boolean;
  jammed: boolean;
  nmiRequested: boolean;
  irqRequested: boolean;
  opStartAddress: number;
  lastMemoryReads: number[];
  lastMemoryReadValue: number;
  lastMemoryWrites: number[];
  lastMemoryWriteValue: number;
  lastIoReadPort: number;
  lastIoReadValue: number;
  lastIoWritePort: number;
  lastIoWriteValue: number;
};

// --- The response with the CPU state information
export type CpuState = Z80CpuState | M6510CpuState;

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

export type SpriteInfo = {
  x: number;
  y: number;
  enabled: boolean;
  multicolor: boolean;
  color: number;
  xExpansion: boolean;
  yExpansion: boolean;
  foregroundPriority: boolean;
};

export type VicState = {
  vicBaseAddress: number;
  spriteInfo: SpriteInfo[];
  rst8: boolean;
  ecm: boolean;
  bmm: boolean;
  den: boolean;
  rsel: boolean;
  xScroll: number;
  yScroll: number;
  raster: number;
  lpx: number;
  lpy: number;
  res: boolean;
  mcm: boolean;
  csel: boolean;
  scrMemOffset: number;
  colMemOffset: number;
  irqStatus: boolean;
  ilpStatus: boolean;
  ilpEnabled: boolean;
  immcStatus: boolean;
  immcEnabled: boolean;
  imbcStatus: boolean;
  imbcEnabled: boolean;
  irstStatus: boolean;
  irstEnabled: boolean;
  borderColor: number;
  bgColor0: number;
  bgColor1: number;
  bgColor2: number;
  bgColor3: number;
  spriteMcolor0: number;
  spriteMcolor1: number;
  spriteSpriteCollision: number;
  spriteDataCollision: number;
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

// --- The response with the Next palette device state
export type PaletteDeviceInfo = {
  ulaFirst: number[];
  ulaSecond: number[];
  layer2First: number[];
  layer2Second: number[];
  spriteFirst: number[];
  spriteSecond: number[];
  tilemapFirst: number[];
  tilemapSecond: number[];
  storedPaletteValue: number;
  trancparencyColor: number;
  reg43Value: number;
  reg6bValue: number;
  ulaNextFormat: number;
};

export type EmuApi = EmuApiImpl;

export function createEmuApi(messenger: MessengerBase): EmuApiImpl {
  return buildMessagingProxy(new EmuApiImpl(), messenger, "emu");
}
