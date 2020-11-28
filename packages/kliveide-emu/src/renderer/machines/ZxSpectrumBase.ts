import * as path from "path";
import * as fs from "fs";

import { MemoryHelper } from "../../native/api/memory-helpers";
import {
  BEEPER_SAMPLE_BUFFER,
  COLORIZATION_BUFFER,
  PAGE_INDEX_16,
  PSG_SAMPLE_BUFFER,
  STATE_TRANSFER_BUFF,
} from "../../native/api/memory-map";
import { MachineApi } from "../../native/api/api";
import { FrameBoundZ80Machine } from "./FrameBoundZ80Machine";
import {
  DebugStepMode,
  EmulationMode,
  ExecutionCompletionReason,
  MemoryContentionType,
  SpectrumMachineStateBase,
  Z80MachineStateBase,
} from "./machine-state";
import { BinaryReader } from "../../shared/utils/BinaryReader";
import { TzxReader } from "../../shared/tape/tzx-file";
import { TapReader } from "../../shared/tape/tap-file";
import { IAudioRenderer } from "./IAudioRenderer";
import { IZxSpectrumBaseStateManager } from "./IZxSpectrumBaseStateManager";

/**
 * This class is intended to be the base class of all ZX Spectrum
 * machine types
 */
export abstract class ZxSpectrumBase extends FrameBoundZ80Machine {
  // --- Tape emulation
  private _defaultTapeSet = new Uint8Array(0);

  // --- Beeper emulation
  private _beeperRenderer: IAudioRenderer | null = null;

  // --- PSG emulation
  private _psgRenderer: IAudioRenderer | null = null;

  // --- A factory method for audio renderers
  private _audioRendererFactory: (sampleRate: number) => IAudioRenderer = () =>
    new SilentAudioRenderer();

  // --- A state manage rfactory
  private _stateManager: IZxSpectrumBaseStateManager = new DefaultZxSpectrumBaseStateManager();

  /**
   * Creates a new instance of the ZX Spectrum machine
   * @param api Machine API to access WA
   * @param roms Optional buffers with ROMs
   */
  constructor(public api: MachineApi, roms?: Buffer[]) {
    super(api, roms);
  }

  /**
   * Assigns an audio renderer factory to this instance
   * @param factory Audio renderer factory
   */
  setAudioRendererFactory(
    factory: (sampleRate: number) => IAudioRenderer
  ): void {
    this._audioRendererFactory = factory;
  }

  /**
   * Sets the ZX Spectrum base state manage object
   * @param manager State manager object
   */
  setStateManager(manager: IZxSpectrumBaseStateManager): void {
    this._stateManager = manager;
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

  initTapeContents(message?: string): void {
    const state = this._stateManager.getState();
    const emuState = state.emulatorPanelState;

    // --- Set tape contents
    if (!emuState.tapeContents || emuState.tapeContents.length === 0) {
      let contents = new Uint8Array(0);
      try {
        contents = fs.readFileSync(path.join(__dirname, "./tapes/Pac-Man.tzx"));
      } catch (err) {}
      this._stateManager.setTapeContents(contents);
      this._defaultTapeSet = contents;
    } else {
      this._defaultTapeSet = emuState.tapeContents;
    }

    const binaryReader = new BinaryReader(this._defaultTapeSet);
    this.initTape(binaryReader);

    if (message) {
      (async () => {
        this._stateManager.setPanelMessage(message);
        await new Promise((r) => setTimeout(r, 3000));
        this._stateManager.setPanelMessage("");
      })();
    }
  }

  /**
   * Cleans up audio
   */
  async cleanupAudio(): Promise<void> {
    if (this._beeperRenderer) {
      await this._beeperRenderer.closeAudio();
      this._beeperRenderer = null;
    }
    if (this._psgRenderer) {
      await this._psgRenderer.closeAudio();
      this._psgRenderer = null;
    }
  }

  // ==========================================================================
  // Lifecycle methods

  /**
   * Read the default tape contents before the first start
   */
  async beforeFirstStart(): Promise<void> {
    this.initTapeContents();
  }

  /**
   * Stops audio when the machine has paused
   * @param _isFirstPause Is the machine paused the first time?
   */
  async onPaused(_isFirstPause: boolean): Promise<void> {
    this.cleanupAudio();
  }

  /**
   * Stops audio when the machine has stopped
   */
  async onStopped(): Promise<void> {
    this.cleanupAudio();
  }

  /**
   * Override this method in derived classes to define an action when
   * the machine's execution cycle has completed and waits for
   * evaluations (whether to continue the cycle of not)
   */
  async beforeEvalLoopCompletion(
    resultState: Z80MachineStateBase
  ): Promise<void> {
    this._stateManager.selectRom(resultState.memorySelectedRom);
    this._stateManager.selectBank(resultState.memorySelectedBank);
  }

  /**
   * Takes care that the screen and the audio gets refreshed as a frame
   * completes
   * @param resultState Machine state on frame completion
   */
  async onFrameCompleted(resultState: Z80MachineStateBase): Promise<void> {
    // --- At this point we have not completed the execution yet
    // --- Initiate the refresh of the screen
    this.api.colorize();
    this.vmEngineController.signScreenRefreshed();

    // --- Update load state
    const emuState = this._stateManager.getState().emulatorPanelState;
    this._stateManager.setLoadMode(resultState.tapeMode === 1);
    this.api.setFastLoad(emuState.fastLoad);

    // --- Obtain beeper samples
    if (!this._beeperRenderer) {
      this._beeperRenderer = this._audioRendererFactory(
        resultState.tactsInFrame / resultState.audioSampleLength
      );
      await this._beeperRenderer.initializeAudio();
    }
    let mh = new MemoryHelper(this.api, BEEPER_SAMPLE_BUFFER);
    const beeperSamples = mh
      .readBytes(0, resultState.audioSampleCount)
      .map((smp) => (emuState.muted ? 0 : smp * (emuState.soundLevel ?? 0)));
    this._beeperRenderer.storeSamples(beeperSamples);

    // --- Obtain psg samples
    if (!this._psgRenderer) {
      this._psgRenderer = this._audioRendererFactory(
        resultState.tactsInFrame / resultState.audioSampleLength
      );
      await this._psgRenderer.initializeAudio();
    }
    mh = new MemoryHelper(this.api, PSG_SAMPLE_BUFFER);
    const psgSamples = mh
      .readWords(0, resultState.audioSampleCount)
      .map((smp) =>
        emuState.muted ? 0 : (smp / 32768) * (emuState.soundLevel ?? 0)
      );
    this._psgRenderer.storeSamples(psgSamples);

    // --- Check if a tape should be loaded
    if (
      resultState.tapeMode === 0 &&
      !emuState.tapeLoaded &&
      emuState.tapeContents &&
      emuState.tapeContents.length > 0
    ) {
      // --- The tape is in passive mode, and we have a new one we can load, so let's load it
      this._defaultTapeSet = emuState.tapeContents;
      const binaryReader = new BinaryReader(this._defaultTapeSet);
      this.initTape(binaryReader);
      this._stateManager.initiateTapeLoading();
    }
  }

  // ==========================================================================
  // Helpers

  /**
   * Initializes the tape from the specified binary reader
   * @param reader Reader to use
   */
  private initTape(reader: BinaryReader): boolean {
    const tzxReader = new TzxReader(reader);
    if (tzxReader.readContents()) {
      const blocks = tzxReader.sendTapeFileToEngine(this.api);
      this.api.initTape(blocks);
      return true;
    }

    reader.seek(0);
    const tapReader = new TapReader(reader);
    if (tapReader.readContents()) {
      const blocks = tapReader.sendTapeFileToEngine(this.api);
      this.api.initTape(blocks);
      return true;
    }
    return false;
  }
}

/**
 * Provides a way to test a ZX Spectrum virtual machine in Node
 */
class SilentAudioRenderer implements IAudioRenderer {
  async initializeAudio(): Promise<void> {}
  storeSamples(_samples: number[]): void {}
  async closeAudio(): Promise<void> {}
}

/**
 * A no-op implementation of IZxSpectrumBaseStateManager
 */
class DefaultZxSpectrumBaseStateManager implements IZxSpectrumBaseStateManager {
  getState(): any {}
  setTapeContents(_contents: Uint8Array): void {}
  setPanelMessage(_message: string): void {}
  selectRom(_rom: number): void {}
  selectBank(_bank: number): void {}
  setLoadMode(_isLoad: boolean): void {}
  initiateTapeLoading(): void {}
}
