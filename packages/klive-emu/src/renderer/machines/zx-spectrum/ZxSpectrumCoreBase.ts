import { BinaryReader } from "@shared/utils/BinaryReader";
import { Z80CpuState } from "../../cpu/Z80Cpu";
import { MemoryHelper } from "../wa-interop/memory-helpers";
import {
  BEEPER_SAMPLE_BUFFER,
  COLORIZATION_BUFFER,
  PSG_SAMPLE_BUFFER,
  RENDERING_TACT_TABLE,
  SPECTRUM_MACHINE_STATE_BUFFER,
} from "../wa-interop/memory-map";
import { MachineCreationOptions, MachineState } from "../../../core/abstractions/vm-core-types";
import { Z80MachineCoreBase } from "../core/Z80MachineCoreBase";
import { TzxReader } from "@shared/tape/tzx-file";
import { TapReader } from "@shared/tape/tap-file";
import { IAudioRenderer } from "../audio/IAudioRenderer";
import { IZxSpectrumStateManager } from "./IZxSpectrumStateManager";
import { KeyMapping } from "../core/keyboard";
import { spectrumKeyCodes, spectrumKeyMappings } from "./spectrum-keys";
import { ProgramCounterInfo } from "@state/AppState";
import { getEngineDependencies } from "../core/vm-engine-dependencies";
import { CodeToInject } from "@abstractions/code-runner-service";

/**
 * ZX Spectrum common core implementation
 */
export abstract class ZxSpectrumCoreBase extends Z80MachineCoreBase {
  // --- Tape emulation
  private _defaultTapeSet = new Uint8Array(0);

  // --- Beeper emulation
  private _beeperRenderer: IAudioRenderer | null = null;

  // --- PSG emulation
  private _psgRenderer: IAudioRenderer | null = null;

  // --- A factory method for audio renderers
  private _audioRendererFactory: (sampleRate: number) => IAudioRenderer;

  // --- A state manager instance
  private _stateManager: IZxSpectrumStateManager;

  /**
   * Instantiates a core with the specified options
   * @param options Options to use with machine creation
   */
  constructor(options: MachineCreationOptions) {
    super(options);
    const deps = getEngineDependencies();
    this._audioRendererFactory = deps.audioRendererFactory;
    this._stateManager = deps.spectrumStateManager;
  }

  /**
   * Get the type of the keyboard to display
   */
  readonly keyboardType: string | null = "sp48";

  /**
   * Indicates if this model supports the AY-3-8912 PSG chip
   */
  get supportsPsg(): boolean {
    return false;
  }

  /**
   * Gets the program counter information of the machine
   * @param state Current machine state
   */
  getProgramCounterInfo(state: SpectrumMachineStateBase): ProgramCounterInfo {
    return {
      label: "PC",
      value: state._pc,
    };
  }

  /**
   * Optional import properties for the WebAssembly engine
   */
  readonly waImportProps: Record<string, any> = {
    saveModeLeft: (length: number) => {
      this.storeSavedDataInState(length);
    },
  };

  /**
   * Creates the CPU instance
   */
  configureMachine(): void {
    super.configureMachine();
    const deps = getEngineDependencies();
    this.setAudioSampleRate(deps.sampleRateGetter());
  }

  /**
   * Sets the audio sample rate to use with sound devices
   * @param rate Audio sampe rate to use
   */
  setAudioSampleRate(rate: number): void {
    this.api.setAudioSampleRate(rate);
  }

  /**
   * Gets the screen data of the ZX Spectrum machine
   */
  getScreenData(): Uint32Array {
    const state = this.getMachineState() as SpectrumMachineStateBase;
    const buffer = this.api.memory.buffer as ArrayBuffer;
    const length = state.screenHeight * state.screenWidth;
    const screenData = new Uint32Array(
      buffer.slice(COLORIZATION_BUFFER, COLORIZATION_BUFFER + 4 * length)
    );
    return screenData;
  }

  /**
   * Represents the state of the machine, including the CPU, memory, and machine
   * devices
   */
  getMachineState(): SpectrumMachineStateBase {
    // --- Obtain execution engine state
    const cpuState = this.cpu.getCpuState();
    const engineState = super.getMachineState();
    const s = { ...cpuState, ...engineState } as SpectrumMachineStateBase;

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
    s.screenHeight = mh.readUint32(96);

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
    return s;
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
   * Override this method to set the clock multiplier
   * @param multiplier Clock multiplier to apply from the next frame
   */
  setClockMultiplier(multiplier: number): void {
    this.api.setClockMultiplier(multiplier);
  }

  /**
   * Gets the cursor mode of the ZX Spectrum machine
   * @returns
   */
  getCursorMode(): number {
    return this.api.getCursorMode();
  }

  /**
   * Indicates if the virtual machine supports code injection for the specified
   * machine mode
   * @param mode Optional machine mode
   * @returns True, if the model supports the code injection
   */
  supportsCodeInjection(mode?: string): boolean {
    return true;
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
    for (let i = 0; i < code.length; i++) {
      this.writeMemory(codeAddress++, code[i]);
    }

    let ptr = codeAddress;
    while (ptr < 0x10000) {
      this.writeMemory(ptr++, 0);
    }

    // --- Init code execution
    this.api.resetCpu(true);
    this.api.setPC(startAddress);
  }

  /**
   * Injects the specified code into the ZX Spectrum machine
   * @param codeToInject Code to inject into the machine
   */
  async injectCodeToRun(codeToInject: CodeToInject): Promise<void> {
    for (const segment of codeToInject.segments) {
      if (segment.bank !== undefined) {
        // TODO: Implement this
      } else {
        const addr = segment.startAddress;
        for (let i = 0; i < segment.emittedCode.length; i++) {
          this.writeMemory(addr + i, segment.emittedCode[i]);
        }
      }
    }

    // --- Prepare the run mode
    if (codeToInject.options.cursork) {
      // --- Set the keyboard in "L" mode
      this.writeMemory(0x5c3b, this.readMemory(0x5c3b) | 0x08);
    }
  }

  /**
   * Prepares the engine for code injection
   * @param _model Model to run in the virtual machine
   */
  async prepareForInjection(_model: string): Promise<number> {
    return 0;
  }

  /**
   * Injects the specified code into the ZX Spectrum machine and runs it
   * @param codeToInject Code to inject into the machine
   * @param debug Start in debug mode?
   */
  async runCode(codeToInject: CodeToInject, debug?: boolean): Promise<void> {
    const controller = this.controller;

    // --- Stop the running machine
    await controller.stop();

    // --- Start the machine and run it while it reaches the injection point
    let mainExec = await this.prepareForInjection(codeToInject.model);

    // --- Inject to code
    await this.injectCodeToRun(codeToInject);

    // --- Set the continuation point
    const startPoint =
      codeToInject.entryAddress ?? codeToInject.segments[0].startAddress;
    this.api.setPC(startPoint);

    // --- Handle subroutine calls
    if (codeToInject.subroutine) {
      const spValue = this.getMachineState().sp;
      this.writeMemory(spValue - 1, mainExec >> 8);
      this.writeMemory(spValue - 2, mainExec & 0xff);
      this.api.setSP(spValue - 2);
    }

    await this.beforeRunInjected(codeToInject, debug);
    if (debug) {
      await controller.startDebug();
    } else {
      await controller.start();
    }
  }

  /**
   * Extracts saved data
   * @param length Data length
   */
  storeSavedDataInState(length: number): void {
    // if (!vmEngine) {
    //   return;
    // }
    // const mh = new MemoryHelper(vmEngine.z80Machine.api, TAPE_SAVE_BUFFER);
    // const savedData = new Uint8Array(mh.readBytes(0, length));
    // rendererProcessStore.dispatch(emulatorSetSavedDataAction(savedData)());
  }

  // ==========================================================================
  // Lifecycle methods

  /**
   * Read the default tape contents before the first start
   */
  async beforeFirstStart(): Promise<void> {
    super.beforeFirstStart();
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
   * Takes care that the screen and the audio gets refreshed as a frame
   * completes
   * @param resultState Machine state on frame completion
   */
  async onFrameCompleted(
    resultState: SpectrumMachineStateBase,
    toWait: number
  ): Promise<void> {
    if (toWait > 0) {
      this.api.colorize();
      this.controller.signScreenRefreshed();
    }

    // --- At this point we have not completed the execution yet
    // --- Initiate the refresh of the screen

    // --- Update load state
    const appState = this._stateManager.getState();
    const emuState = appState.emulatorPanel;
    const spectrumState = appState.spectrumSpecific;
    this._stateManager.setLoadMode(resultState.tapeMode === 1);
    this.api.setFastLoad(spectrumState.fastLoad);

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

    // --- Check if a tape should be loaded
    if (
      resultState.tapeMode === 0 &&
      !spectrumState.tapeLoaded &&
      spectrumState.tapeContents &&
      spectrumState.tapeContents.length > 0
    ) {
      // --- The tape is in passive mode, and we have a new one we can load, so let's load it
      this._defaultTapeSet = spectrumState.tapeContents;
      const binaryReader = new BinaryReader(this._defaultTapeSet);
      this.initTape(binaryReader);
      this._stateManager.initiateTapeLoading();
    }
  }

  // ==========================================================================
  // Helpers

  async initTapeContents(message?: string): Promise<void> {
    const state = this._stateManager.getState();

    // --- Set tape contents
    if (
      !state.spectrumSpecific.tapeContents ||
      state.spectrumSpecific.tapeContents.length === 0
    ) {
      let contents = new Uint8Array(0);
      try {
        contents = await this.readFromStream("./tapes/Pac-Man.tzx");
      } catch (err) {
        console.log(`Load error: ${err}`);
      }
      this._defaultTapeSet = contents;
    } else {
      this._defaultTapeSet = state.spectrumSpecific.tapeContents;
    }

    this._stateManager.setTapeContents(this._defaultTapeSet);
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
}

/**
 * Represents the state of the ZX Spectrum machine
 */
export interface SpectrumMachineStateBase extends MachineState, Z80CpuState {
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
  lastRenderedFrameTact: number;

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
