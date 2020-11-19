import { Z80CpuState } from "./cpu-helpers";

/**
 * This type represents ZX Spectrum machine states
 */
export type MachineState =
  | Spectrum48MachineState
  | Spectrum128MachineState
  | CambridgeZ88MachineState;


export abstract class Z80MachineStateBase extends Z80CpuState {
  // --- Type discriminator
  type: MachineState["type"];
}

/**
 * Represents the state of the ZX Spectrum machine
 */
export abstract class SpectrumMachineStateBase extends Z80MachineStateBase {
  // --- CPU configuration
  baseClockFrequency: number;
  clockMultiplier: number;
  supportsNextOperations: boolean;

  // --- Memory configuration
  numberOfRoms: number;
  romContentsAddress: number;
  spectrum48RomIndex: number;
  contentionType: MemoryContentionType;
  ramBanks: number;
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
  screenLines: number;
  firstDisplayLine: number;
  lastDisplayLine: number;
  borderLeftPixels: number;
  displayWidth: number;
  borderRightPixels: number;
  screenWidth: number;
  screenLineTime: number;
  firstDisplayPixelTact: number;
  firstScreenPixelTact: number;
  rasterLines: number;

  // --- Engine state
  ulaIssue: number;
  lastRenderedUlaTact: number;
  frameCount: number;
  frameCompleted: boolean;
  contentionAccummulated: number;
  lastExecutionContentionValue: number;
  emulationMode: EmulationMode;
  debugStepMode: DebugStepMode;
  fastTapeMode: boolean;
  terminationRom: number;
  terminationPoint: number;
  fastVmMode: boolean;
  disableScreenRendering: boolean;
  executionCompletionReason: number;
  stepOverBreakPoint: number;

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
  audioSampleLength: number;
  audioLowerGate: number;
  audioUpperGate: number;
  audioGateValue: number;
  audioNextSampleTact: number;
  beeperLastEarBit: boolean;
  audioSampleCount: number;

  // --- Sound state
  psgSupportsSound: boolean;
  psgRegisterIndex: number;
  psgClockStep: number;
  psgNextClockTact: number;
  psgOrphanSamples: number;
  psgOrphanSum: number;

  // --- Tape state
  tapeMode: number;
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
  memorySelectedRom: number;
  memoryPagingEnabled: boolean;
  memorySelectedBank: number;
  memoryUseShadowScreen: boolean;
  memoryScreenOffset: number;
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
  SBR: number;
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
  UntilHalt,

  /**
   * Run the CPU until the current CPU rendering frame ends
   */
  UntilCpuFrameEnds,

  /**
   * Run the CPU until the current ULA rendering frame ends
   * by the ULA clock
   */
  UntilUlaFrameEnds,

  /**
   * Run the CPU until a specified value of the PC register is reached
   */
  UntilExecutionPoint,
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
    public emulationMode: EmulationMode = EmulationMode.UntilUlaFrameEnds,
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
  TerminationPointReached,

  /**
   * CPU reached any of the specified breakpoints
   */
  BreakpointReached,

  /**
   * CPU reached a HALT instrution
   */
  Halted,

  /**
   * The current CPU frame has been completed
   */
  CpuFrameCompleted,

  /**
   * The current screen rendering frame has been completed
   */
  UlaFrameCompleted,
}
