import { MachineApi, VmKeyCode } from "../../native/api/api";
import {
  MachineState,
  MemoryContentionType,
  EmulationMode,
  DebugStepMode,
  ExecutionCompletionReason,
  ExecuteCycleOptions,
  SpectrumMachineStateBase,
  Z80MachineStateBase,
} from "./machine-state";
import { MemoryHelper } from "../../native/api/memory-helpers";
import { SpectrumKeyCode } from "../../native/api/SpectrumKeyCode";
import {
  REG_AREA_INDEX,
  STATE_TRANSFER_BUFF,
  COLORIZATION_BUFFER,
  PAGE_INDEX_16,
} from "../../native/api/memory-map";
import { IVmEngineController } from "./IVmEngineController";
import { themeStore } from "../stores/theme-store";

/**
 * This class is intended to be the base class of all Z80 machine
 */
export abstract class Z80MachineBase {
  // --- The engine controlles this machine can use
  private _vmEngineController: IVmEngineController | undefined;

  /**
   * Creates a new instance of the Z80 machine
   * @param api Machine API to access WA
   * @param type Machine type
   */
  constructor(public api: MachineApi, public type: number) {}

  /**
   * Gets the associated controller instance
   */
  get vmEngineController(): IVmEngineController {
    if (!this._vmEngineController) {
      throw new Error("The controller of the virtual machine has not been set yet.")
    }
    return this._vmEngineController;
  }

  /**
   * Sets the associated controller instance
   */
  set vmEngineController(controller: IVmEngineController) {
    this._vmEngineController = controller;
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
    this.api.turnOnMachine();
  }

  /**
   * Override this method to represent the appropriate machine state
   */
  abstract createMachineState(): MachineState;

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
    for (let i = 0; i < code.length; i++) {
      this.writeMemory(codeAddress++, code[i]);
    }

    let ptr = codeAddress;
    while (ptr < 0x10000) {
      this.writeMemory(ptr++, 0);
    }

    // --- Init code execution
    this.api.resetCpu();
    this.api.setPC(startAddress);
  }

  /**
   * Reads a byte from the memory
   * @param addr Memory address
   */
  abstract readMemory(addr: number): number;

  /**
   * Writes a byte into the memory
   * @param addr Memory address
   * @param value Value to write
   */
  abstract writeMemory(addr: number, value: number): void;

  /**
   * Obtains the Z80 CPU's state
   * @param s State to put the Z80 machine state
   */
  protected obtainZ80CpuState(s: Z80MachineStateBase): void {
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
  }
}

/**
 * Represents a Z80 machine that uses execution frames (generally bound to screen rendering)
 */
export abstract class FrameBoundZ80Machine extends Z80MachineBase {
  /**
   * Creates a new instance of the frame-bound Z80 machine
   * @param api Machine API to access WA
   * @param type Machine type
   * @param roms Optional buffers with ROMs
   */
  constructor(public api: MachineApi, public type: number, roms?: Buffer[]) {
    super(api, type);
    api.turnOnMachine();
    this.initRoms(roms);
  }

  /**
   * Initializes the specified ROMs
   * @param roms Optional buffers with ROM contents
   */
  initRoms(roms?: Buffer[]): void {
    if (!roms) {
      return;
    }
    const mh = new MemoryHelper(this.api, this.getRomPageBaseAddress());
    for (let i = 0; i < roms.length; i++) {
      const rom = roms[i];
      for (let j = 0; j < rom.length; j++) {
        mh.writeByte(0x4000 * i + j, rom[j]);
      }
    }
  }

  /**
   * Gets the WA memory address of the first ROM page of the machine
   */
  abstract getRomPageBaseAddress(): number;

  /**
   * Gets the addressable Z80 memory contents from the machine
   */
  abstract getMemoryContents(): Uint8Array;

  /**
   * Retrieves the current state of the machine
   */
  abstract getMachineState(): Z80MachineStateBase;

  /**
   * Gets the screen data of the virtual machine
   */
  abstract getScreenData(): Uint32Array;

  /**
   * Sets the audio sample rate
   * @param rate Sample rate
   */
  abstract setAudioSampleRate(rate: number): void;

  /**
   * Prepares the engine for code injection
   * @param model Model to run in the virtual machine
   */
  abstract prepareForInjection(model: string): Promise<number>;

  /**
   * Sets the status of the specified key
   * @param key Key to set
   * @param isDown Status value
   */
  setKeyStatus(key: VmKeyCode, isDown: boolean): void {
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
   * Executes the machine cycle
   * @param options Execution options
   */
  executeCycle(options: ExecuteCycleOptions): void {
    // --- Copy execution options
    const mh = new MemoryHelper(this.api, STATE_TRANSFER_BUFF);
    mh.writeByte(0, options.emulationMode);
    mh.writeByte(1, options.debugStepMode);
    mh.writeBool(2, options.fastTapeMode);
    mh.writeByte(3, options.terminationRom);
    mh.writeUint16(4, options.terminationPoint);
    mh.writeBool(6, options.fastVmMode);
    mh.writeBool(7, options.disableScreenRendering);
    mh.writeUint32(8, options.stepOverBreakpoint);
    this.api.setExecutionOptions();

    // --- Run the cycle and retrieve state
    this.api.executeMachineCycle();
  }

  /**
   * Reads a byte from the memory
   * @param addr Memory address
   */
  readMemory(addr: number): number {
    const mh = new MemoryHelper(this.api, PAGE_INDEX_16);
    const pageStart = mh.readUint32(((addr >> 14) & 0x03) * 6);
    const mem = new Uint8Array(this.api.memory.buffer, pageStart, 0x4000);
    return mem[addr & 0x3fff];
  }

  /**
   * Writes a byte into the memory
   * @param addr Memory address
   * @param value Value to write
   */
  writeMemory(addr: number, value: number): void {
    const mh = new MemoryHelper(this.api, PAGE_INDEX_16);
    const pageStart = mh.readUint32(((addr >> 14) & 0x03) * 6);
    const mem = new Uint8Array(this.api.memory.buffer, pageStart, 0x4000);
    mem[addr & 0x3fff] = value;
  }
}

/**
 * This class is intended to be the base class of all ZX Spectrum
 * machine types
 */
export abstract class ZxSpectrumBase extends FrameBoundZ80Machine {
  /**
   * Creates a new instance of the ZX Spectrum machine
   * @param api Machine API to access WA
   * @param type Machine type
   * @param roms Optional buffers with ROMs
   */
  constructor(public api: MachineApi, public type: number, roms?: Buffer[]) {
    super(api, type, roms);
  }

  /**
   * Sets the ULA issue used by the machine
   * @param ula ULA issue of the machine
   */
  setUlaIssue(ula: number): void {
    this.api.setUlaIssue(ula);
  }

  /**
   * Sets the audio sample rate
   * @param rate Sample rate
   */
  setAudioSampleRate(rate: number): void {
    this.api.setBeeperSampleRate(rate);
  }

  /**
   * Gets the current state of the ZX Spectrum machine
   */
  getMachineState(): Z80MachineStateBase {
    const s = this.createMachineState() as SpectrumMachineStateBase;
    this.api.getMachineState();
    this.obtainZ80CpuState(s);

    const mh = new MemoryHelper(this.api, STATE_TRANSFER_BUFF);

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
    s.stepOverBreakPoint = mh.readUint16(162);

    // --- Get keyboard state
    s.keyboardLines = [];
    for (let i = 0; i < 8; i++) {
      s.keyboardLines[i] = mh.readByte(164 + i);
    }

    // --- Get port state
    s.portBit3LastValue = mh.readBool(172);
    s.portBit4LastValue = mh.readBool(173);
    s.portBit4ChangedFrom0Tacts = mh.readUint32(174);
    s.portBit4ChangedFrom1Tacts = mh.readUint32(178);

    // --- Get interrupt state
    s.interruptRaised = mh.readBool(182);
    s.interruptRevoked = mh.readBool(183);

    // --- Get screen state
    s.borderColor = mh.readByte(184);
    s.flashPhase = mh.readBool(185);
    s.pixelByte1 = mh.readByte(186);
    s.pixelByte2 = mh.readByte(187);
    s.attrByte1 = mh.readByte(188);
    s.attrByte2 = mh.readByte(189);
    s.flashFrames = mh.readByte(190);
    s.renderingTablePtr = mh.readUint32(181);
    s.pixelBufferPtr = mh.readUint32(195);

    // --- Get beeper state
    s.audioSampleRate = mh.readUint32(199);
    s.audioSampleLength = mh.readUint32(203);
    s.audioLowerGate = mh.readUint32(207);
    s.audioUpperGate = mh.readUint32(211);
    s.audioGateValue = mh.readUint32(215);
    s.audioNextSampleTact = mh.readUint32(219);
    s.beeperLastEarBit = mh.readBool(223);
    s.audioSampleCount = mh.readUint32(224);

    // --- Get sound state
    s.psgSupportsSound = mh.readBool(228);
    s.psgRegisterIndex = mh.readByte(229);
    s.psgClockStep = mh.readUint32(230);
    s.psgNextClockTact = mh.readUint32(234);
    s.psgOrphanSamples = mh.readUint32(238);
    s.psgOrphanSum = mh.readUint32(242);

    // --- Get tape state
    s.tapeMode = mh.readByte(246);
    s.tapeLoadBytesRoutine = mh.readUint16(247);
    s.tapeLoadBytesResume = mh.readUint16(249);
    s.tapeLoadBytesInvalidHeader = mh.readUint16(251);
    s.tapeSaveBytesRoutine = mh.readUint16(253);
    s.tapeBlocksToPlay = mh.readByte(255);
    s.tapeEof = mh.readBool(256);
    s.tapeBufferPtr = mh.readUint32(257);
    s.tapeNextBlockPtr = mh.readUint32(261);
    s.tapePlayPhase = mh.readByte(265);
    s.tapeStartTactL = mh.readUint32(266);
    s.tapeStartTactH = mh.readUint32(270);
    s.tapeBitMask = mh.readByte(274);

    // --- Memory pages
    s.memorySelectedRom = mh.readByte(275);
    s.memoryPagingEnabled = mh.readBool(276);
    s.memorySelectedBank = mh.readByte(277);
    s.memoryUseShadowScreen = mh.readBool(278);
    s.memoryScreenOffset = mh.readUint16(279);

    // --- Done.
    return s;
  }

  /**
   * Gets the addressable Z80 memory contents from the machine
   */
  getMemoryContents(): Uint8Array {
    const result = new Uint8Array(0x10000);
    const mh = new MemoryHelper(this.api, PAGE_INDEX_16);
    for (let i = 0; i < 4; i++) {
      const offs = i * 0x4000;
      const pageStart = mh.readUint32(i * 6);
      const source = new Uint8Array(this.api.memory.buffer, pageStart, 0x4000);
      for (let j = 0; j < 0x4000; j++) {
        result[offs + j] = source[j];
      }
    }
    return result;
  }

  /**
   * Gets the screen data of the ZX Spectrum machine
   */
  getScreenData(): Uint32Array {
    const state = this.getMachineState();
    const buffer = this.api.memory.buffer as ArrayBuffer;
    const length = state.screenLines * state.screenWidth;
    const screenData = new Uint32Array(
      buffer.slice(COLORIZATION_BUFFER, COLORIZATION_BUFFER + 4 * length)
    );
    return screenData;
  }
}
