import { Z80CpuState } from "./z80-helpers";

export type MachineState =
  | Spectrum48MachineState
  | Spectrum128MachineState
  | CambridgeZ88MachineState;

export abstract class Z80MachineStateBase extends Z80CpuState {
  // --- Type discriminator
  type: MachineState["type"];

  // --- Execution engine state
  frameCount: number;
  frameCompleted: boolean;
  lastRenderedFrameTact: number;
  executionCompletionReason: number;

  // --- Screen dimensions
  screenWidth: number;
  screenLines: number;
}

/**
 * Represents the state of the ZX Spectrum machine
 */
export abstract class SpectrumMachineStateBase extends Z80MachineStateBase {
  // --- Port $fe state
  portBit3LastValue: boolean;
  portBit4LastValue: boolean;
  portBit4ChangedFrom0Tacts: number;
  portBit4ChangedFrom1Tacts: number;

  // --- Keyboard state
  keyboardLines: number[];

  // --- Interrupt configuration
  interruptTact: number;
  interruptEndTact: number;

  // --- Memory state
  numberOfRoms: number;
  ramBanks: number;
  memorySelectedRom: number;
  memorySelectedBank: number;
  memoryPagingEnabled: boolean;
  memoryUseShadowScreen: boolean;
  memoryScreenOffset: number;
  
  // --- Screen frame configuration
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

  // --- Calculated screen data
  firstDisplayLine: number;
  lastDisplayLine: number;
  borderLeftPixels: number;
  borderRightPixels: number;
  displayWidth: number;
  screenLineTime: number;
  rasterLines: number;
  firstDisplayPixelTact: number;
  firstScreenPixelTact: number;

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
  audioSampleLength: number;
  audioLowerGate: number;
  audioUpperGate: number;
  audioGateValue: number;
  audioNextSampleTact: number;
  audioSampleCount: number;
  beeperLastEarBit: boolean;

  // --- Tape state
  tapeMode: number;
  tapeBlocksToPlay: number;
  tapeEof: boolean;
  tapeBufferPtr: number;
  tapeNextBlockPtr: number;
  tapePlayPhase: number;
  tapeStartTactL: number;
  tapeStartTactH: number;
  tapeFastLoad: boolean;
  tapeSavePhase: number;

  // --- Engine state
  ulaIssue: number;
  contentionAccumulated: number;
  lastExecutionContentionValue: number;

  // --- Sound state
  psgSupportsSound: boolean;
  psgRegisterIndex: number;
  psgClockStep: number;
  psgNextClockTact: number;
  psgOrphanSamples: number;
  psgOrphanSum: number;

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
  isInSleepMode: boolean;
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
   * Run the CPU until the current ULA rendering frame ends
   * by the ULA clock
   */
  UntilFrameEnds = 2,

  /**
   * Run the CPU until a specified value of the PC register is reached
   */
  UntilExecutionPoint = 3,
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
