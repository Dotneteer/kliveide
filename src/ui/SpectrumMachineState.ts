import { UiBinaryReader } from "./UiBinaryReader";
import { OpIndexMode, OpPrefixMode, Z80StateFlags } from "../native/cpu-helpers";
import { ExecutionCompletionReason } from "../native/machine-state";

/**
 * This type represents all ZX Spectrum machine states
 */
export type SpectrumState = Spectrum48State;

/**
 * Base class for all machine state classes
 */
export class SpectrumMachineStateBase {
  type: SpectrumState["type"];
  cpu: Z80CpuState;
  ulaIssue: number;
  baseClockFrequency: number;
  clockMultiplier: number;
  screenConfig: ScreenConfig;
  execCycleState: ExecutionCycleState;
  interruptState: InterruptState;
  keyboardLineStatus: number[];
  screenState: ScreenState;
}

/**
 * The state of the ZX Spectrum 48 machine
 */
export class Spectrum48State extends SpectrumMachineStateBase {
  type: "48";
  portState: Sp48PortState;
  memoryState: Uint8Array;
}

/**
 * Represents the state of the CPU
 */
export class Z80CpuState {
  af: number;
  bc: number;
  de: number;
  hl: number;
  _af_: number;
  _bc_: number;
  _de_: number;
  _hl_: number;
  i: number;
  r: number;
  pc: number;
  sp: number;
  ix: number;
  iy: number;
  wz: number;

  iff1: boolean;
  iff2: boolean;
  indexMode: OpIndexMode;
  interruptMode: number;
  isInOpExecution: boolean;
  isInterruptBlocked: boolean;
  maskableInterruptModeEntered: boolean;
  opCode: number;
  prefixMode: OpPrefixMode;
  stateFlags: Z80StateFlags;
  frameCount: number;
  frameTacts: number;
  useGateArrayContention: boolean;
}

/**
 * This class can be used to describe a Spectrum model's screen data
 * for configuration
 */
export class ScreenConfig {
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
}

/**
 * Represents the engine's execution cycle state
 */
export class ExecutionCycleState {
  lastExecutionStartFrameCount: number;
  lastExecutionStartFrameTacts: number;
  lastRenderedUlaTact: number;
  frameCompleted: boolean;
  overflow: number;
  contentionAccummulated: number;
  lastExecutionContentionValue: number;
  executionCompletionReason: ExecutionCompletionReason;
}

/**
 * Represents the state of the interrupt device
 */
export class InterruptState {
  interruptRaised: boolean;
  interruptRevoked: boolean;
}

/**
 * Represents the state of the screen
 */
export class ScreenState {
  screenBorderColor: number;
  screenFlashPhase: boolean;
  screenPixelByte1: number;
  screenPixelByte2: number;
  screenAttrByte1: number;
  screenAttrByte2: number;
  screenFlashToggleFrames: number;
  screenPixelBuffer: Uint8Array;
}

/**
 * Represents the port device state of ZX Spectrum 48
 */
export class Sp48PortState {
  portBit3LastValue: boolean;
  portBit4LastValue: boolean;
  portBit4ChangedFrom0L: number;
  portBit4ChangedFrom0H: number;
  portBit4ChangedFrom1L: number;
  portBit4ChangedFrom1H: number;
}

/**
 * Reads the state of the CPU from the specified stream
 * @param r Binary stream reader
 */
export function readZ80CpuState(r: UiBinaryReader): Z80CpuState {
  const s = new Z80CpuState();
  s.af = r.readUint16();
  s.bc = r.readUint16();
  s.de = r.readUint16();
  s.hl = r.readUint16();
  s._af_ = r.readUint16();
  s._bc_ = r.readUint16();
  s._de_ = r.readUint16();
  s._hl_ = r.readUint16();
  s.i = r.readByte();
  s.r = r.readByte();
  s.pc = r.readUint16();
  s.sp = r.readUint16();
  s.ix = r.readUint16();
  s.iy = r.readUint16();
  s.wz = r.readUint16();

  s.iff1 = r.readByte() !== 0;
  s.iff2 = r.readByte() !== 0;
  s.indexMode = <OpIndexMode>r.readByte();
  s.interruptMode = r.readByte();
  s.isInOpExecution = r.readByte() !== 0;
  s.isInterruptBlocked = r.readByte() !== 0;
  s.maskableInterruptModeEntered = r.readByte() !== 0;
  s.opCode = r.readByte();
  s.prefixMode = <OpPrefixMode>r.readByte();
  s.stateFlags = <Z80StateFlags>r.readByte();
  s.frameCount = r.readUint32();
  s.frameTacts = r.readUint32();
  s.useGateArrayContention = r.readByte() !== 0;
  return s;
}

/**
 * Reads the configuration of the screen from the specified stream
 * @param r Binary stream reader
 */
export function readScreenConfig(r: UiBinaryReader): ScreenConfig {
  const s = new ScreenConfig();
  s.interruptTact = r.readUint32();
  s.verticalSyncLines = r.readUint32();
  s.nonVisibleBorderTopLines = r.readUint32();
  s.borderTopLines = r.readUint32();
  s.displayLines = r.readUint32();
  s.borderBottomLines = r.readUint32();
  s.nonVisibleBorderBottomLines = r.readUint32();
  s.horizontalBlankingTime = r.readUint32();
  s.borderLeftTime = r.readUint32();
  s.displayLineTime = r.readUint32();
  s.borderRightTime = r.readUint32();
  s.nonVisibleBorderRightTime = r.readUint32();
  s.pixelDataPrefetchTime = r.readUint32();
  s.attributeDataPrefetchTime = r.readUint32();
  return s;
}

/**
 * Reads the state of the execution cycle from the specified stream
 * @param r Binary stream reader
 */
export function readExecutionCycleState(
  r: UiBinaryReader
): ExecutionCycleState {
  const s = new ExecutionCycleState();
  s.lastExecutionStartFrameCount = r.readUint32();
  s.lastExecutionStartFrameTacts = r.readUint32();
  s.lastRenderedUlaTact = r.readUint32();
  s.frameCompleted = r.readByte() !== 0;
  s.overflow = r.readUint32();
  s.contentionAccummulated = r.readUint32();
  s.lastExecutionContentionValue = r.readUint32();
  s.executionCompletionReason = r.readByte();
  return s;
}

/**
 * Reads the state of the interrupt device from the specified stream
 * @param r Binary stream reader
 */
export function readInterruptState(r: UiBinaryReader): InterruptState {
  const s = new InterruptState();
  s.interruptRaised = r.readByte() !== 0;
  s.interruptRevoked = r.readByte() !== 0;
  return s;
}

/**
 * Reads the state of the screen device from the specified stream
 * @param r Binary stream reader
 */
export function readScreenState(r: UiBinaryReader): ScreenState {
  const s = new ScreenState();
  s.screenBorderColor = r.readByte();
  s.screenFlashPhase = r.readByte() != 0;
  s.screenPixelByte1 = r.readByte();
  s.screenPixelByte2 = r.readByte();
  s.screenAttrByte1 = r.readByte();
  s.screenAttrByte2 = r.readByte();
  s.screenFlashToggleFrames = r.readUint16();
  s.screenPixelBuffer = new Uint8Array(r.readBytes());
  return s;
}

/**
 * Reads the state of the ZX Spectrum 48 port device from the specified stream
 * @param r Binary stream reader
 */
export function readSp48PortState(r: UiBinaryReader): Sp48PortState {
  const s = new Sp48PortState();
  s.portBit3LastValue = r.readByte() !== 0;
  s.portBit4LastValue = r.readByte() !== 0;
  s.portBit4ChangedFrom0L = r.readUint32();
  s.portBit4ChangedFrom0H = r.readUint32();
  s.portBit4ChangedFrom1L = r.readUint32();
  s.portBit4ChangedFrom1H = r.readUint32();
  return s;
}
