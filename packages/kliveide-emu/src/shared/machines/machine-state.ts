import { Z80CpuState } from "./z80-helpers";

export type MachineState =
  | Spectrum48MachineState
  | Spectrum128MachineState
  | CambridgeZ88MachineState;

export abstract class Z80MachineStateBase extends Z80CpuState {
  // --- Type discriminator
  type: MachineState["type"];

  // --- CPU configuration
  baseClockFrequency: number;
  clockMultiplier: number;
  defaultClockMultiplier: number;

  // --- CPU diagnostics
  cpuDiagnostics: number;
  cpuSnoozed: boolean;

  // --- Common screen configuration
  screenWidth: number;
  screenLines: number;

  // --- Engine state
  frameCount: number;
  frameCompleted: boolean;
  executionCompletionReason: number;
  stepOverBreakPoint: number;

  // --- Temporary state properties, move them to spectrum
  numberOfRoms: number;
  ramBanks: number;

  memorySelectedRom: number;
  memorySelectedBank: number;
  memoryPagingEnabled: boolean;

  tapeMode: number;

  audioSampleLength: number;
  audioSampleCount: number;
}

/**
 * Represents the state of a frame-bound Z80 machine
 */
export class FrameBoundZ80MachineState extends Z80MachineStateBase {
  lastRenderedFrameTact: number;
  contentionAccummulated: number;
  lastExecutionContentionValue: number;
  emulationMode: EmulationMode;
  debugStepMode: DebugStepMode;
  disableScreenRendering: boolean;
}

/**
 * Represents the state of the ZX Spectrum machine
 */
export abstract class SpectrumMachineStateBase extends FrameBoundZ80MachineState {
  // --- Memory configuration
  romContentsAddress: number;
  spectrum48RomIndex: number;
  contentionType: MemoryContentionType;
  nextMemorySize: number;

  // --- Screen frame configuration
  interruptTact: number;
  verticalSyncLines: number;
  nonVisibleBorderTopLines: number;
  borderTopLines: number;
  displayLines: number;
  borderBottomLines: number;
  nonVisibleBorderBottomLines: number;
  horizontalBlankingTime: number;
  borderLeftTime: number;
  displayLineTime: number;
  borderRightTime: number;
  nonVisibleBorderRightTime: number;
  pixelDataPrefetchTime: number;
  attributeDataPrefetchTime: number;
  firstDisplayLine: number;
  lastDisplayLine: number;
  borderLeftPixels: number;
  displayWidth: number;
  borderRightPixels: number;
  screenLineTime: number;
  firstDisplayPixelTact: number;
  firstScreenPixelTact: number;
  rasterLines: number;

  // --- Engine state
  ulaIssue: number;
  fastTapeMode: boolean;
  terminationRom: number;
  terminationPoint: number;
  fastVmMode: boolean;

  // --- Keyboard state
  keyboardLines: number[];

  // --- Port $fe state
  portBit3LastValue: boolean;
  portBit4LastValue: boolean;
  portBit4ChangedFrom0Tacts: number;
  portBit4ChangedFrom1Tacts: number;

  // --- InterruptState
  interruptRaised: boolean;
  interruptRevoked: boolean;

  // --- Screen state
  borderColor: number;
  flashPhase: boolean;
  pixelByte1: number;
  pixelByte2: number;
  attrByte1: number;
  attrByte2: number;
  flashFrames: number;
  renderingTablePtr: number;
  pixelBufferPtr: number;

  // --- Beeper state
  audioSampleRate: number;
  audioLowerGate: number;
  audioUpperGate: number;
  audioGateValue: number;
  audioNextSampleTact: number;
  beeperLastEarBit: boolean;

  // --- Sound state
  psgSupportsSound: boolean;
  psgRegisterIndex: number;
  psgClockStep: number;
  psgNextClockTact: number;
  psgOrphanSamples: number;
  psgOrphanSum: number;

  // --- Tape state
  tapeLoadBytesRoutine: number;
  tapeLoadBytesResume: number;
  tapeLoadBytesInvalidHeader: number;
  tapeSaveBytesRoutine: number;
  tapeBlocksToPlay: number;
  tapeEof: boolean;
  tapeBufferPtr: number;
  tapeNextBlockPtr: number;
  tapePlayPhase: number;
  tapeStartTactL: number;
  tapeStartTactH: number;
  tapeBitMask: number;
  tapeLastMicBitTact: number;
  tapeLastMicBitTactH: number;
  tapeLastMicBit: boolean;
  tapeSavePhase: number;
  tapePilotPulseCount: number;
  tapeDataBlockCount: number;
  tapePrevDataPulse: number;
  tapeSaveDataLen: number;
  tapeBitOffs: number;
  tapeDataByte: number;

  // --- Memory paging info
  memoryUseShadowScreen: boolean;
  memoryScreenOffset: number;

  // --- Screen rendering tact
  renderingPhase: number;
  pixelAddr: number;
  attrAddr: number;
}

/**
 * Represents the state of a ZX Spectrum 48 machine
 */
export class Spectrum48MachineState extends SpectrumMachineStateBase {
  type: "48";
}

/**
 * Represents the state of a ZX Spectrum 128 machine
 */
export class Spectrum128MachineState extends SpectrumMachineStateBase {
  type: "128";

  psgToneA: number;
  psgToneAEnabled: boolean;
  psgNoiseAEnabled: boolean;
  psgVolA: number;
  psgEnvA: boolean;
  psgCntA: number;
  psgBitA: boolean;

  psgToneB: number;
  psgToneBEnabled: boolean;
  psgNoiseBEnabled: boolean;
  psgVolB: number;
  psgEnvB: boolean;
  psgCntB: number;
  psgBitB: boolean;

  psgToneC: number;
  psgToneCEnabled: boolean;
  psgNoiseCEnabled: boolean;
  psgVolC: number;
  psgEnvC: boolean;
  psgCntC: number;
  psgBitC: boolean;

  psgNoiseSeed: number;
  psgNoiseFreq: number;
  psgCntNoise: number;
  psgBitNoise: boolean;
  psgEvnFreq: number;
  psgEnvStyle: number;
  psgCntEnv: number;
  psgPosEnv: number;
}

/**
 * Represents the state of a Cambridge Z88 machine
 */
export class CambridgeZ88MachineState extends Z80MachineStateBase {
  type: "cz88";

  // --- CPU configuration
  baseClockFrequency: number;
  clockMultiplier: number;
  supportsNextOperations: boolean;

  // --- BLINK Device
  INT: number;
  STA: number;
  COM: number;
  SHFF: boolean;

  // --- RTC device
  TIM0: number;
  TIM1: number;
  TIM2: number;
  TIM3: number;
  TIM4: number;
  TSTA: number;
  TMK: number;

  // --- Screen device
  PB0: number;
  PB1: number;
  PB2: number;
  PB3: number;
  SBF: number;
  SCW: number;
  SCH: number;

  // --- Memory device
  SR0: number;
  SR1: number;
  SR2: number;
  SR3: number;
  chipMask1: number;
  chipMask2: number;
  chipMask3: number;
  chipMask4: number;
  chipMask0: number;
  s0OffsetL: number;
  s0FlagL: number;
  s0OffsetH: number;
  s0FlagH: number;
  s1OffsetL: number;
  s1FlagL: number;
  s1OffsetH: number;
  s1FlagH: number;
  s2OffsetL: number;
  s2FlagL: number;
  s2OffsetH: number;
  s2FlagH: number;
  s3OffsetL: number;
  s3FlagL: number;
  s3OffsetH: number;
  s3FlagH: number;

  KBLine0: number;
  KBLine1: number;
  KBLine2: number;
  KBLine3: number;
  KBLine4: number;
  KBLine5: number;
  KBLine6: number;
  KBLine7: number;

  // --- Other
  lcdWentOff: boolean;
}

/**
 * This enumeration represents the contention type of memory
 */
export enum MemoryContentionType {
  /**
   * No contended memory
   */
  None,

  /**
   * ULA-type memory contention
   */
  Ula,

  /**
   * Gate-array-type memory contention
   */
  GateArray,

  /**
   * Spectrum Next type memory contention
   */
  Next,
}

/**
 * This enumeration defines how the spectrum emulation mode
 * should work
 */
export enum EmulationMode {
  /**
   * Run the virtual machine in debugger mode
   */
  Debugger = 0,

  /**
   * Run the VM until the CPU is halted
   */
  UntilHalt = 1,

  /**
   * Run the CPU until the current CPU rendering frame ends
   */
  UntilCpuFrameEnds = 2,

  /**
   * Run the CPU until the current ULA rendering frame ends
   * by the ULA clock
   */
  UntilFrameEnds = 3,

  /**
   * Run the CPU until a specified value of the PC register is reached
   */
  UntilExecutionPoint = 4,
}

/**
 * The mode the execution cycle should run in debug mode
 */
export enum DebugStepMode {
  /**
   * Do not use debugger
   */
  None = 0,

  /**
   * Execution stops at the next breakpoint
   */
  StopAtBreakpoint = 1,

  /**
   * Execution stops after the next instruction
   */
  StepInto = 2,

  /**
   * Execution stops after the next instruction. If that should
   * be a subroutine call, the execution stops after returning
   * from the subroutine.
   */
  StepOver = 3,

  /**
   * Execution stops after the first RET (unconditional or conditional)
   * returns from the latest subroutine call.
   */
  StepOut = 4,
}

/**
 * This class provides options for the ExecuteCycle function.
 */
export class ExecuteCycleOptions {
  constructor(
    public emulationMode: EmulationMode = EmulationMode.UntilFrameEnds,
    public debugStepMode: DebugStepMode = DebugStepMode.None,
    public fastTapeMode: boolean = false,
    public terminationRom: number = -1,
    public terminationPoint: number = -1,
    public fastVmMode: boolean = false,
    public disableScreenRendering = false,
    public stepOverBreakpoint = -1
  ) {}
}

/**
 * This enumeration tells the reason why the execution cycle
 * of the SpectrumEngine completed.
 */
export enum ExecutionCompletionReason {
  /**
   * The machine is still executing
   */
  None = 0,

  /**
   * CPU reached the specified termination point
   */
  TerminationPointReached = 1,

  /**
   * CPU reached any of the specified breakpoints
   */
  BreakpointReached = 2,

  /**
   * CPU reached a HALT instrution
   */
  Halted = 3,

  /**
   * The current screen rendering frame has been completed
   */
  FrameCompleted = 4,
}
