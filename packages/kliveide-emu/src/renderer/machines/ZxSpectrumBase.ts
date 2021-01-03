import * as path from "path";
import * as fs from "fs";

import { MemoryHelper } from "./memory-helpers";
import {
  BEEPER_SAMPLE_BUFFER,
  COLORIZATION_BUFFER,
  BLOCK_LOOKUP_TABLE,
  PSG_SAMPLE_BUFFER,
  RENDERING_TACT_TABLE,
  STATE_TRANSFER_BUFF,
} from "./memory-map";
import { MachineApi } from "./wa-api";
import { FrameBoundZ80Machine } from "./FrameBoundZ80Machine";
import {
  MachineState,
  MemoryContentionType,
  SpectrumMachineStateBase,
  Z80MachineStateBase,
} from "../../shared/machines/machine-state";
import { BinaryReader } from "../../shared/utils/BinaryReader";
import { TzxReader } from "../../shared/tape/tzx-file";
import { TapReader } from "../../shared/tape/tap-file";
import { IAudioRenderer } from "./IAudioRenderer";
import { IZxSpectrumBaseStateManager } from "./IZxSpectrumBaseStateManager";
import { KeyMapping } from "./keyboard";
import { spectrumKeyCodes, spectrumKeyMappings } from "./spectrum-keys";
import { ExtraMachineFeatures } from "./Z80MachineBase";

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
  constructor(public api: MachineApi, roms?: Uint8Array[]) {
    super(api, roms);
  }

  /**
   * Get the list of machine features supported
   */
  getExtraMachineFeatures(): ExtraMachineFeatures[] {
    return ["UlaDebug", "Tape", "Sound"];
  }

  /**
   * Gets the key mapping used by the machine
   */
  getKeyMapping(): KeyMapping {
    return spectrumKeyMappings;
  }

  /**
   * Resolves a string key code to a key number
   * @param code Key code to resolve
   */
  resolveKeyCode(code: string): number | null {
    return spectrumKeyCodes[code] ?? null;
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
  getMachineState(): MachineState {
    const s = super.getMachineState() as SpectrumMachineStateBase;

    let mh = new MemoryHelper(this.api, STATE_TRANSFER_BUFF);

    // --- Get Spectrum-specific execution engine state
    s.ulaIssue = mh.readByte(160);
    s.fastTapeMode = mh.readBool(161);
    s.terminationRom = mh.readByte(162);
    s.terminationPoint = mh.readUint16(163);
    s.fastVmMode = mh.readBool(165);

    // --- Get memory configuration data
    s.numberOfRoms = mh.readByte(180);
    s.romContentsAddress = mh.readUint32(181);
    s.spectrum48RomIndex = mh.readByte(185);
    s.contentionType = mh.readByte(186) as MemoryContentionType;
    s.ramBanks = mh.readByte(187);
    s.nextMemorySize = mh.readByte(188);

    // --- Get screen frame configuration data
    s.interruptTact = mh.readUint16(189);
    s.verticalSyncLines = mh.readUint16(191);
    s.nonVisibleBorderTopLines = mh.readUint16(193);
    s.borderTopLines = mh.readUint16(195);
    s.displayLines = mh.readUint16(197);
    s.borderBottomLines = mh.readUint16(199);
    s.nonVisibleBorderBottomLines = mh.readUint16(201);
    s.horizontalBlankingTime = mh.readUint16(203);
    s.borderLeftTime = mh.readUint16(205);
    s.displayLineTime = mh.readUint16(207);
    s.borderRightTime = mh.readUint16(209);
    s.nonVisibleBorderRightTime = mh.readUint16(211);
    s.pixelDataPrefetchTime = mh.readUint16(213);
    s.attributeDataPrefetchTime = mh.readUint16(215);

    // --- Get calculated screen attributes
    s.screenLines = mh.readUint32(240);
    s.firstDisplayLine = mh.readUint32(244);
    s.lastDisplayLine = mh.readUint32(248);
    s.borderLeftPixels = mh.readUint32(252);
    s.borderRightPixels = mh.readUint32(256);
    s.displayWidth = mh.readUint32(260);
    s.screenWidth = mh.readUint32(264);
    s.screenLineTime = mh.readUint32(268);
    s.rasterLines = mh.readUint32(272);
    s.firstDisplayPixelTact = mh.readUint32(276);
    s.firstScreenPixelTact = mh.readUint32(280);

    // --- Get keyboard state
    s.keyboardLines = [];
    for (let i = 0; i < 8; i++) {
      s.keyboardLines[i] = mh.readByte(284 + i);
    }

    // --- Get port state
    s.portBit3LastValue = mh.readBool(292);
    s.portBit4LastValue = mh.readBool(293);
    s.portBit4ChangedFrom0Tacts = mh.readUint32(294);
    s.portBit4ChangedFrom1Tacts = mh.readUint32(298);

    // --- Get interrupt state
    s.interruptRaised = mh.readBool(302);
    s.interruptRevoked = mh.readBool(303);

    // --- Get screen state
    s.borderColor = mh.readByte(304);
    s.flashPhase = mh.readBool(305);
    s.pixelByte1 = mh.readByte(306);
    s.pixelByte2 = mh.readByte(307);
    s.attrByte1 = mh.readByte(308);
    s.attrByte2 = mh.readByte(309);
    s.flashFrames = mh.readByte(310);
    s.renderingTablePtr = mh.readUint32(311);
    s.pixelBufferPtr = mh.readUint32(315);

    // --- Get beeper state
    s.audioSampleRate = mh.readUint32(319);
    s.audioSampleLength = mh.readUint32(323);
    s.audioLowerGate = mh.readUint32(327);
    s.audioUpperGate = mh.readUint32(331);
    s.audioGateValue = mh.readUint32(335);
    s.audioNextSampleTact = mh.readUint32(339);
    s.beeperLastEarBit = mh.readBool(343);
    s.audioSampleCount = mh.readUint32(344);

    // --- Get sound state
    s.psgSupportsSound = mh.readBool(348);
    s.psgRegisterIndex = mh.readByte(349);
    s.psgClockStep = mh.readUint32(350);
    s.psgNextClockTact = mh.readUint32(354);
    s.psgOrphanSamples = mh.readUint32(358);
    s.psgOrphanSum = mh.readUint32(362);

    // --- Get tape state
    s.tapeMode = mh.readByte(366);
    s.tapeLoadBytesRoutine = mh.readUint16(367);
    s.tapeLoadBytesResume = mh.readUint16(369);
    s.tapeLoadBytesInvalidHeader = mh.readUint16(371);
    s.tapeSaveBytesRoutine = mh.readUint16(373);
    s.tapeBlocksToPlay = mh.readByte(375);
    s.tapeEof = mh.readBool(376);
    s.tapeBufferPtr = mh.readUint32(377);
    s.tapeNextBlockPtr = mh.readUint32(381);
    s.tapePlayPhase = mh.readByte(385);
    s.tapeStartTactL = mh.readUint32(386);
    s.tapeStartTactH = mh.readUint32(390);
    s.tapeBitMask = mh.readByte(394);

    // --- Memory pages
    s.memorySelectedRom = mh.readByte(395);
    s.memoryPagingEnabled = mh.readBool(396);
    s.memorySelectedBank = mh.readByte(397);
    s.memoryUseShadowScreen = mh.readBool(398);
    s.memoryScreenOffset = mh.readUint16(399);

    // --- Screen rendering tact
    mh = new MemoryHelper(this.api, RENDERING_TACT_TABLE);
    const tactStart = 5 * s.lastRenderedFrameTact;
    s.renderingPhase = mh.readByte(tactStart);
    s.pixelAddr = mh.readUint16(tactStart + 1);
    s.attrAddr = mh.readUint16(tactStart + 3);

    // --- Done.
    return s as MachineState;
  }

  /**
   * Gets the addressable Z80 memory contents from the machine
   */
  getMemoryContents(): Uint8Array {
    const result = new Uint8Array(0x10000);
    const mh = new MemoryHelper(this.api, BLOCK_LOOKUP_TABLE);
    for (let i = 0; i < 8; i++) {
      const offs = i * 0x2000;
      const pageStart = mh.readUint32(i * 16);
      const source = new Uint8Array(this.api.memory.buffer, pageStart, 0x2000);
      for (let j = 0; j < 0x2000; j++) {
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
    super.beforeFirstStart();

    // --- Take care of tape contents
    this.initTapeContents();
  }

  /**
   * Override this method to define an action when the virtual machine has
   * started.
   * @param debugging Is started in debug mode?
   */
  async beforeStarted(debugging: boolean): Promise<void> {
    await super.beforeStarted(debugging);
    
    // --- Init audio renderers
    const state = this.getMachineState();
    this._beeperRenderer = this._audioRendererFactory(
      state.tactsInFrame / state.audioSampleLength
    );
    this._beeperRenderer.suspend();
    await this._beeperRenderer.initializeAudio();
    this._psgRenderer = this._audioRendererFactory(
      state.tactsInFrame / state.audioSampleLength
    );
    this._psgRenderer.suspend();
    await this._psgRenderer.initializeAudio();
  }

  /**
   * Stops audio when the machine has paused
   * @param isFirstPause Is the machine paused the first time?
   */
  async onPaused(isFirstPause: boolean): Promise<void> {
    await super.onPaused(isFirstPause);
    this.cleanupAudio();
  }

  /**
   * Stops audio when the machine has stopped
   */
  async onStopped(): Promise<void> {
    await super.onStopped();
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
  async onFrameCompleted(
    resultState: Z80MachineStateBase,
    toWait: number
  ): Promise<void> {
    if (!this.executionOptions.disableScreenRendering && toWait > 0) {
      this.api.colorize();
      this.vmEngineController.signScreenRefreshed();
    }

    // --- At this point we have not completed the execution yet
    // --- Initiate the refresh of the screen

    // --- Update load state
    const emuState = this._stateManager.getState().emulatorPanelState;
    this._stateManager.setLoadMode(resultState.tapeMode === 1);
    this.api.setFastLoad(emuState.fastLoad);

    if (!this.executionOptions.disableScreenRendering) {
      // --- Obtain beeper samples
      let mh = new MemoryHelper(this.api, BEEPER_SAMPLE_BUFFER);
      const beeperSamples = mh
        .readBytes(0, resultState.audioSampleCount)
        .map((smp) => (emuState.muted ? 0 : smp * (emuState.soundLevel ?? 0)));
      this._beeperRenderer.storeSamples(beeperSamples);
      this._beeperRenderer.resume();

      // --- Obtain psg samples
      mh = new MemoryHelper(this.api, PSG_SAMPLE_BUFFER);
      const psgSamples = mh
        .readWords(0, resultState.audioSampleCount)
        .map((smp) =>
          emuState.muted ? 0 : (smp / 8192) * (emuState.soundLevel ?? 0)
        );
      this._psgRenderer.storeSamples(psgSamples);
      this._psgRenderer.resume();
    }

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
  suspend(): void {}
  resume(): void {}
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
