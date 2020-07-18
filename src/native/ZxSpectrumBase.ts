import { MachineApi } from "./api";
import {
  SpectrumMachineState,
  MemoryContentionType,
  EmulationMode,
  DebugStepMode,
  ExecutionCompletionReason,
  ExecuteCycleOptions,
  SpectrumMachineStateBase,
} from "./machine-state";
import { MemoryHelper } from "./memory-helpers";
import { SpectrumKeyCode } from "./SpectrumKeyCode";
import { stat } from "fs";

/**
 * Start of the register are in the memory
 */
const REG_AREA_INDEX = 0x1_0000;

/**
 * Start of the CPU state transfer area in the memory
 */
const STATE_TRANSFER_BUFF = 0x1_0040;

/**
 * Buffer of the colorized screen
 */
const COLORIZED_BUFF = 0x0b_4200;

/**
 * This class is intended to be the base class of all ZX Spectrum
 * machine types
 */
export abstract class ZxSpectrumBase {
  /**
   * Creates a new instance of the ZX Spectrum machine
   * @param api Machine API to access WA
   * @param type Machine type
   */
  constructor(public api: MachineApi, public type: number) {
    api.initZxSpectrum(type);
  }

  /**
   * Turns on the machine
   */
  turnOnMachine(): void {
    this.api.turnOnMachine();
  }

  /**
   * Resets the machine
   */
  reset(): void {
    this.api.resetMachine();
  }

  /**
   * Sets the ULA issue used by the machine
   * @param ula ULA issue of the machine
   */
  setUlaIssue(ula: number): void {
    this.api.setUlaIssue(ula);
  }

  /**
   * Sets the beeper's sample rate
   * @param rate Sample rate
   */
  setBeeperSampleRate(rate: number): void {
    this.api.setBeeperSampleRate(rate);
  }

  /**
   * Gets the current state of the ZX Spectrum machine
   */
  getMachineState(): SpectrumMachineState {
    const s = this.createMachineState();
    this.api.getMachineState();

    // --- Get register data from the memory
    let mh = new MemoryHelper(this.api, REG_AREA_INDEX);

    s.bc = mh.readUint16(2);
    s.de = mh.readUint16(4);
    s.hl = mh.readUint16(6);
    s._af_ = mh.readUint16(8);
    s._bc_ = mh.readUint16(10);
    s._de_ = mh.readUint16(12);
    s._hl_ = mh.readUint16(14);
    s.i = mh.readByte(16);
    s.r = mh.readByte(17);
    s.ix = mh.readUint16(22);
    s.iy = mh.readUint16(24);
    s.wz = mh.readUint16(26);

    // --- Get state data
    mh = new MemoryHelper(this.api, STATE_TRANSFER_BUFF);

    s.af = mh.readUint16(0);
    s.pc = mh.readUint16(18);
    s.sp = mh.readUint16(20);

    s.tactsInFrame = mh.readUint32(28);
    s.allowExtendedSet = mh.readBool(32);
    s.tacts = mh.readUint32(33);
    s.stateFlags = mh.readByte(37);
    s.useGateArrayContention = mh.readBool(38);
    s.iff1 = mh.readBool(39);
    s.iff2 = mh.readBool(40);
    s.interruptMode = mh.readByte(41);
    s.isInterruptBlocked = mh.readBool(42);
    s.isInOpExecution = mh.readBool(43);
    s.prefixMode = mh.readByte(44);
    s.indexMode = mh.readByte(45);
    s.maskableInterruptModeEntered = mh.readBool(46);
    s.opCode = mh.readByte(47);

    // --- Get CPU configuration data
    s.baseClockFrequency = mh.readUint32(48);
    s.clockMultiplier = mh.readByte(52);
    s.supportsNextOperations = mh.readBool(53);

    // --- Get memory configuration data
    s.numberOfRoms = mh.readByte(54);
    s.romContentsAddress = mh.readUint32(55);
    s.spectrum48RomIndex = mh.readByte(59);
    s.contentionType = mh.readByte(60) as MemoryContentionType;
    s.ramBanks = mh.readByte(61);
    s.nextMemorySize = mh.readByte(62);

    // --- Get screen frame configuration data
    s.interruptTact = mh.readUint16(63);
    s.verticalSyncLines = mh.readUint16(65);
    s.nonVisibleBorderTopLines = mh.readUint16(67);
    s.borderTopLines = mh.readUint16(69);
    s.displayLines = mh.readUint16(71);
    s.borderBottomLines = mh.readUint16(73);
    s.nonVisibleBorderBottomLines = mh.readUint16(75);
    s.horizontalBlankingTime = mh.readUint16(77);
    s.borderLeftTime = mh.readUint16(79);
    s.displayLineTime = mh.readUint16(81);
    s.borderRightTime = mh.readUint16(83);
    s.nonVisibleBorderRightTime = mh.readUint16(85);
    s.pixelDataPrefetchTime = mh.readUint16(87);
    s.attributeDataPrefetchTime = mh.readUint16(89);

    // --- Get calculated frame attributes
    s.screenLines = mh.readUint32(91);
    s.firstDisplayLine = mh.readUint32(95);
    s.lastDisplayLine = mh.readUint32(99);
    s.borderLeftPixels = mh.readUint32(103);
    s.borderRightPixels = mh.readUint32(107);
    s.displayWidth = mh.readUint32(111);
    s.screenWidth = mh.readUint32(115);
    s.screenLineTime = mh.readUint32(119);
    s.rasterLines = mh.readUint32(123);
    s.firstDisplayPixelTact = mh.readUint32(127);
    s.firstScreenPixelTact = mh.readUint32(131);

    // --- Get engine state
    s.ulaIssue = mh.readByte(135);
    s.lastRenderedUlaTact = mh.readUint32(136);
    s.frameCount = mh.readUint32(140);
    s.frameCompleted = mh.readBool(144);
    s.contentionAccummulated = mh.readUint32(145);
    s.lastExecutionContentionValue = mh.readUint32(149);
    s.emulationMode = mh.readByte(153) as EmulationMode;
    s.debugStepMode = mh.readByte(154) as DebugStepMode;
    s.fastTapeMode = mh.readBool(155);
    s.terminationRom = mh.readByte(156);
    s.terminationPoint = mh.readUint16(157);
    s.fastVmMode = mh.readBool(159);
    s.disableScreenRendering = mh.readBool(160);
    s.executionCompletionReason = mh.readByte(161) as ExecutionCompletionReason;

    // --- Get keyboard state
    s.keyboardLines = [];
    for (let i = 0; i < 8; i++) {
      s.keyboardLines[i] = mh.readByte(162 + i);
    }

    // --- Get port state
    s.portBit3LastValue = mh.readBool(170);
    s.portBit4LastValue = mh.readBool(171);
    s.portBit4ChangedFrom0Tacts = mh.readUint32(172);
    s.portBit4ChangedFrom1Tacts = mh.readUint32(176);

    // --- Get interrupt state
    s.interruptRaised = mh.readBool(180);
    s.interruptRevoked = mh.readBool(181);

    // --- Get screen state
    s.borderColor = mh.readByte(182);
    s.flashPhase = mh.readBool(183);
    s.pixelByte1 = mh.readByte(184);
    s.pixelByte2 = mh.readByte(185);
    s.attrByte1 = mh.readByte(186);
    s.attrByte2 = mh.readByte(187);
    s.flashFrames = mh.readByte(188);
    s.renderingTablePtr = mh.readUint32(189);
    s.pixelBufferPtr = mh.readUint32(193);

    // --- Get beeper state
    s.beeperSampleRate = mh.readUint32(197);
    s.beeperSampleLength = mh.readUint32(201);
    s.beeperLowerGate = mh.readUint32(205);
    s.beeperUpperGate = mh.readUint32(209);
    s.beeperGateValue = mh.readUint32(213);
    s.beeperNextSampleTact = mh.readUint32(217);
    s.beeperLastEarBit = mh.readBool(221);
    s.beeperSampleCount = mh.readUint32(222);

    // --- Done.
    return s;
  }

  /**
   * Override this method to represent the appropriate machine state
   */
  abstract createMachineState(): SpectrumMachineState;

  /**
   * Executes the machine cycle
   * @param options Execution options
   */
  executeCycle(options: ExecuteCycleOptions) {
    // --- Copy execution options
    const mh = new MemoryHelper(this.api, STATE_TRANSFER_BUFF);
    mh.writeByte(0, options.emulationMode);
    mh.writeByte(1, options.debugStepMode);
    mh.writeBool(2, options.fastTapeMode);
    mh.writeByte(3, options.terminationRom);
    mh.writeUint16(4, options.terminationPoint);
    mh.writeBool(6, options.fastVmMode);
    mh.writeBool(7, options.disableScreenRendering);
    this.api.setExecutionOptions();

    // --- Run the cycle and retrieve state
    this.api.executeMachineCycle();
  }

  /**
   * Sets the status of the specified key
   * @param key Key to set
   * @param isDown Status value
   */
  setKeyStatus(key: SpectrumKeyCode, isDown: boolean): void {
    this.api.setKeyStatus(key, isDown);
  }

  /**
   * Gets the status of the specified key
   * @param key Key to get
   * @returns True, if key is pressed; otherwise, false
   */
  getKeyStatus(key: SpectrumKeyCode): boolean {
    return this.api.getKeyStatus(key) !== 0;
  }

  /**
   * Initializes the machine with the specified code
   * @param runMode Machine run mode
   * @param code Intial code
   */
  injectCode(
    code: number[],
    codeAddress = 0x8000,
    startAddress = 0x8000
  ): void {
    const mem = new Uint8Array(this.api.memory.buffer, 0, 0x1_0000);
    for (let i = 0; i < code.length; i++) {
      mem[codeAddress++] = code[i];
    }

    let ptr = codeAddress;
    while (ptr < 0x10000) {
      mem[ptr++] = 0;
    }

    // --- Init code execution
    this.reset();
    this.api.setPC(startAddress);
  }

  /**
   * Gets the screen data of the ZX Spectrum machine
   */
  getScreenData(): Uint32Array {
    const state = this.getMachineState();
    const buffer = this.api.memory.buffer as ArrayBuffer;
    const length = state.screenLines * state.screenWidth;
    const screenData = new Uint32Array(
      buffer.slice(
        COLORIZED_BUFF,
        COLORIZED_BUFF + 4*length
      )
    );
    return screenData;
  }
}
