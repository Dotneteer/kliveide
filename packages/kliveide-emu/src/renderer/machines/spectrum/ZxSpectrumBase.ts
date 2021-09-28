import { MemoryHelper } from "../memory-helpers";
import {
  BEEPER_SAMPLE_BUFFER,
  COLORIZATION_BUFFER,
  BLOCK_LOOKUP_TABLE,
  PSG_SAMPLE_BUFFER,
  RENDERING_TACT_TABLE,
  SPECTRUM_MACHINE_STATE_BUFFER,
} from "../memory-map";
import { MachineApi } from "../wa-api";
import { FrameBoundZ80Machine } from "../FrameBoundZ80Machine";
import {
  MachineState,
  SpectrumMachineStateBase,
} from "@shared/machines/machine-state";
import { BinaryReader } from "@shared/utils/BinaryReader";
import { TzxReader } from "@shared/tape/tzx-file";
import { TapReader } from "@shared/tape/tap-file";
import { IAudioRenderer } from "../IAudioRenderer";
import { IZxSpectrumBaseStateManager } from "../IZxSpectrumBaseStateManager";
import { KeyMapping } from "../keyboard";
import { spectrumKeyCodes, spectrumKeyMappings } from "../spectrum-keys";
import { ExtraMachineFeatures } from "../Z80MachineBase";

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

  // --- A state manager factory
  private _stateManager: IZxSpectrumBaseStateManager = new DefaultZxSpectrumBaseStateManager();

  /**
   * Creates a new instance of the ZX Spectrum machine
   * @param api Machine API to access WA
   * @param roms Optional buffers with ROMs
   */
  constructor(public api: MachineApi, roms?: Uint8Array[]) {
    super(api, roms);
    this.prepareMachine();
  }

  /**
   * Get the list of machine features supported
   */
  getExtraMachineFeatures(): ExtraMachineFeatures[] {
    return ["UlaDebug", "Tape", "Sound"];
  }

  /**
   * Indicates if this modes supports the AY-3-8912 PSG chip
   */
  get supportsPsg(): boolean {
    return false;
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
    // --- Obtain execution engine state
    const s = super.getMachineState() as SpectrumMachineStateBase;

    // --- Obtain ZX Spectrum specific state
    this.api.getMachineState();
    let mh = new MemoryHelper(this.api, SPECTRUM_MACHINE_STATE_BUFFER);

    // --- Get port state
    s.portBit3LastValue = mh.readBool(0);
    s.portBit4LastValue = mh.readBool(1);
    s.portBit4ChangedFrom0Tacts = mh.readUint32(2);
    s.portBit4ChangedFrom1Tacts = mh.readUint32(6);

    // --- Get keyboard state
    s.keyboardLines = [];
    for (let i = 0; i < 8; i++) {
      s.keyboardLines[i] = mh.readByte(10 + i);
    }

    // --- Interrupt state
    s.interruptTact = mh.readUint16(18);
    s.interruptEndTact = mh.readUint16(20);

    // --- Memory state
    s.numberOfRoms = mh.readByte(22);
    s.ramBanks = mh.readByte(23);
    s.memorySelectedRom = mh.readByte(24);
    s.memoryPagingEnabled = mh.readBool(25);
    s.memorySelectedBank = mh.readByte(26);
    s.memoryUseShadowScreen = mh.readBool(27);
    s.memoryScreenOffset = mh.readUint16(28);

    // --- Screen device state
    s.verticalSyncLines = mh.readUint16(30);
    s.nonVisibleBorderTopLines = mh.readUint16(32);
    s.borderTopLines = mh.readUint16(34);
    s.displayLines = mh.readUint16(36);
    s.borderBottomLines = mh.readUint16(38);
    s.nonVisibleBorderBottomLines = mh.readUint16(40);
    s.horizontalBlankingTime = mh.readUint16(42);
    s.borderLeftTime = mh.readUint16(44);
    s.displayLineTime = mh.readUint16(46);
    s.borderRightTime = mh.readUint16(48);
    s.nonVisibleBorderRightTime = mh.readUint16(50);
    s.pixelDataPrefetchTime = mh.readUint16(52);
    s.attributeDataPrefetchTime = mh.readUint16(54);

    // --- Get calculated screen attributes
    s.firstDisplayLine = mh.readUint32(56);
    s.lastDisplayLine = mh.readUint32(60);
    s.borderLeftPixels = mh.readUint32(64);
    s.borderRightPixels = mh.readUint32(68);
    s.displayWidth = mh.readUint32(72);
    s.screenLineTime = mh.readUint32(76);
    s.rasterLines = mh.readUint32(80);
    s.firstDisplayPixelTact = mh.readUint32(84);
    s.firstScreenPixelTact = mh.readUint32(88);
    s.screenWidth = mh.readUint32(92);
    s.screenLines = mh.readUint32(96);

    // --- Get screen state
    s.borderColor = mh.readByte(100);
    s.flashPhase = mh.readBool(101);
    s.pixelByte1 = mh.readByte(102);
    s.pixelByte2 = mh.readByte(103);
    s.attrByte1 = mh.readByte(104);
    s.attrByte2 = mh.readByte(105);
    s.flashFrames = mh.readByte(106);
    s.renderingTablePtr = mh.readUint32(107);
    s.pixelBufferPtr = mh.readUint32(111);

    // --- Get beeper state
    s.audioSampleRate = mh.readUint32(115);
    s.audioSampleLength = mh.readUint32(119);
    s.audioLowerGate = mh.readUint32(123);
    s.audioUpperGate = mh.readUint32(127);
    s.audioGateValue = mh.readUint32(131);
    s.audioNextSampleTact = mh.readUint32(135);
    s.audioSampleCount = mh.readUint32(139);
    s.beeperLastEarBit = mh.readBool(143);

    // --- Get tape device state
    s.tapeMode = mh.readByte(144);
    s.tapeBlocksToPlay = mh.readUint16(145);
    s.tapeEof = mh.readBool(147);
    s.tapeBufferPtr = mh.readUint32(148);
    s.tapeNextBlockPtr = mh.readUint32(152);
    s.tapePlayPhase = mh.readByte(156);
    s.tapeStartTactL = mh.readUint32(157);
    s.tapeStartTactH = mh.readUint32(161);
    s.tapeFastLoad = mh.readBool(165);
    s.tapeSavePhase = mh.readByte(166);

    // --- Engine state
    s.ulaIssue = mh.readByte(167);
    s.contentionAccumulated = mh.readUint32(168);
    s.lastExecutionContentionValue = mh.readUint32(172);

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
    const state = this.getMachineState() as SpectrumMachineStateBase;
    const buffer = this.api.memory.buffer as ArrayBuffer;
    const length = state.screenLines * state.screenWidth;
    const screenData = new Uint32Array(
      buffer.slice(COLORIZATION_BUFFER, COLORIZATION_BUFFER + 4 * length)
    );
    return screenData;
  }

  async initTapeContents(message?: string): Promise<void> {
    const state = this._stateManager.getState();
    const emuState = state.emulatorPanelState;

    // --- Set tape contents
    if (!emuState.tapeContents || emuState.tapeContents.length === 0) {
      let contents = new Uint8Array(0);
      try {
        contents = await this.readFromStream("./tapes/Pac-Man.tzx");
      } catch (err) {
        console.log(`Load error: ${err}`);
      }
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
    if (this.supportsPsg && this._psgRenderer) {
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
    await this.initTapeContents();
  }

  /**
   * Override this method to define an action when the virtual machine has
   * started.
   * @param debugging Is started in debug mode?
   */
  async beforeStarted(debugging: boolean): Promise<void> {
    await super.beforeStarted(debugging);

    // --- Init audio renderers
    const state = this.getMachineState() as SpectrumMachineStateBase;
    this._beeperRenderer = this._audioRendererFactory(
      state.tactsInFrame / state.audioSampleLength
    );
    this._beeperRenderer.suspend();
    await this._beeperRenderer.initializeAudio();
    if (this.supportsPsg) {
      this._psgRenderer = this._audioRendererFactory(
        state.tactsInFrame / state.audioSampleLength
      );
      this._psgRenderer.suspend();
      await this._psgRenderer.initializeAudio();
    }
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
    resultState: SpectrumMachineStateBase
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
    resultState: SpectrumMachineStateBase,
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
      if (this.supportsPsg) {
        mh = new MemoryHelper(this.api, PSG_SAMPLE_BUFFER);
        const psgSamples = mh
          .readWords(0, resultState.audioSampleCount)
          .map((smp) =>
            emuState.muted ? 0 : (smp / 65535) * (emuState.soundLevel ?? 0)
          );
        this._psgRenderer.storeSamples(psgSamples);
        this._psgRenderer.resume();
      }
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

  /**
   * Read data from the specified URI
   * @param uri URI to read form
   */
  async readFromStream(uri: string): Promise<Uint8Array> {
    const buffers: Uint8Array[] = [];
    const data = await fetch(uri);
    let done = false;
    const reader = data.body.getReader();
    do {
      const read = await reader.read();
      if (read.value) {
        buffers.push(read.value);
      }
      done = read.done;
    } while (!done);
    const length = buffers.reduce((a, b) => a + b.length, 0);
    const resultArray = new Uint8Array(length);
    let offset = 0;
    for (let i = 0; i < buffers.length; i++) {
      resultArray.set(buffers[i], offset);
      offset += buffers[i].length;
    }
    return resultArray;
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
