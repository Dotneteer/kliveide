import { MachineApi } from "../wa-api";
import { MemoryHelper } from "../memory-helpers";
import {
  BLOCK_LOOKUP_TABLE,
  Z88_PIXEL_BUFFER,
  VM_MEMORY,
  Z88_MACHINE_STATE_BUFFER,
  Z88_BEEPER_BUFFER,
} from "../memory-map";
import { FrameBoundZ80Machine } from "../FrameBoundZ80Machine";
import {
  CambridgeZ88MachineState,
  MachineState,
} from "../../../shared/machines/machine-state";
import { KeyMapping } from "../keyboard";
import { cz88KeyCodes, cz88KeyMappings } from "./cz88-keys";
import { ExtraMachineFeatures } from "../Z80MachineBase";
import {
  CZ88_BATTERY_LOW,
  CZ88_HARD_RESET,
  CZ88_PRESS_BOTH_SHIFTS,
  CZ88_SOFT_RESET,
} from "../../../shared/machines/macine-commands";
import { IVmEngineController } from "../IVmEngineController";
import { IAudioRenderer } from "../IAudioRenderer";
import { ICambridgeZ88BaseStateManager } from "./ICambrideZ88BaseStateMananger";

/**
 * This class implements the Cambride Z88 machine
 */
export class CambridgeZ88 extends FrameBoundZ80Machine {
  /**
   * The type identifier of the machine
   */
  readonly typeId = "cz88";

  /**
   * Friendly name to display
   */
  readonly displayName = "Cambridge Z88";

  /**
   * The default keyboard type
   */
  readonly keyboardType: string = "cz88";

  // --- Screen dimensions
  private _screenWidth = 0;
  private _screenHeight = 0;

  // --- Beeper emulation
  private _beeperRenderer: IAudioRenderer | null = null;

  // --- A factory method for audio renderers
  private _audioRendererFactory: (sampleRate: number) => IAudioRenderer = () =>
    new SilentAudioRenderer();

  // --- A state manager factory
  private _stateManager: ICambridgeZ88BaseStateManager = new DefaultCambridgeZ88BaseStateManager();

  /**
   * Creates a new instance of the ZX Spectrum machine
   * @param api Machine API to access WA
   * @param scw Optional screen width
   * @param sch Optional screen height
   */
  constructor(
    public api: MachineApi,
    public options?: Record<string, any>,
    roms?: Uint8Array[]
  ) {
    super(api, options?.rom ? [options.rom] : roms);
    this.prepareMachine();

    // --- Save configuration
    const state = this.getMachineState();
    this._screenWidth = state.screenWidth;
    this._screenHeight = state.screenLines;
  }

  /**
   * Override this property to apply multiple engine loops before
   * Refreshing the UI
   */
  readonly engineLoops = 8;

  /**
   * Override this method to configure the virtual machine before turning it on
   */
  configureMachine(): void {
    this.api.setZ88ScreenSize(
      this.options?.scw ?? 0xff,
      this.options?.sch ?? 8
    );
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
  setStateManager(manager: ICambridgeZ88BaseStateManager): void {
    this._stateManager = manager;
  }

  /**
   * Get the list of machine features supported
   */
  getExtraMachineFeatures(): ExtraMachineFeatures[] {
    return ["Sound"];
  }

  /**
   * Gets the key mapping used by the machine
   */
  getKeyMapping(): KeyMapping {
    return cz88KeyMappings;
  }

  /**
   * Resolves a string key code to a key number
   * @param code Key code to resolve
   */
  resolveKeyCode(code: string): number | null {
    return cz88KeyCodes[code] ?? null;
  }

  /**
   * Retrieves a ZX Spectrum 48 machine state object
   */
  createMachineState(): MachineState {
    return new CambridgeZ88MachineState();
  }

  /**
   * Gets the memory address of the first ROM page of the machine
   */
  getRomPageBaseAddress(): number {
    return 0x00_0000;
  }

  /**
   * Gets the specified memory partition
   * @param partition Partition index
   */
  getMemoryPartition(partition: number): Uint8Array {
    const mh = new MemoryHelper(this.api, (partition & 0xff) * 0x4000);
    const result = new Uint8Array(0x4000);
    for (let j = 0; j < 0x4000; j++) {
      result[j] = mh.readByte(j);
    }
    return result;
  }

  /**
   * Gets the current state of the ZX Spectrum machine
   */
  getMachineState(): CambridgeZ88MachineState {
    const s = super.getMachineState() as CambridgeZ88MachineState;

    this.api.getMachineState();
    const mh = new MemoryHelper(this.api, Z88_MACHINE_STATE_BUFFER);

    // --- Blink device data
    s.COM = mh.readByte(0);
    s.EPR = mh.readByte(1);

    // --- Machine modes
    s.shiftsReleased = mh.readBool(2);
    s.isInSleepMode = mh.readBool(3);

    // --- Interrupt
    s.INT = mh.readByte(4);
    s.STA = mh.readByte(5);
    s.interruptSignalActive = mh.readBool(6);

    // --- Memory device
    s.SR0 = mh.readByte(7);
    s.SR1 = mh.readByte(8);
    s.SR2 = mh.readByte(9);
    s.SR3 = mh.readByte(10);
    s.chipMask0 = mh.readByte(11);
    s.chipMask1 = mh.readByte(12);
    s.chipMask2 = mh.readByte(13);
    s.chipMask3 = mh.readByte(14);
    s.chipMask4 = mh.readByte(15);

    // --- RTC device
    s.TIM0 = mh.readByte(16);
    s.TIM1 = mh.readByte(17);
    s.TIM2 = mh.readByte(18);
    s.TIM3 = mh.readByte(19);
    s.TIM4 = mh.readByte(20);
    s.TSTA = mh.readByte(21);
    s.TMK = mh.readByte(22);

    // --- Screen device
    s.PB0 = mh.readUint16(23);
    s.PB1 = mh.readUint16(25);
    s.PB2 = mh.readUint16(27);
    s.PB3 = mh.readUint16(29);
    s.SBF = mh.readUint16(31);
    s.SCW = mh.readByte(33);
    s.SCH = mh.readByte(34);
    s.screenFrameCount = mh.readUint32(35);
    s.flashPhase = mh.readBool(39);
    s.textFlashPhase = mh.readBool(40);
    s.lcdWentOff = mh.readBool(41);

    // --- Setup screen size
    s.screenWidth = s.SCW === 100 ? 800 : 640;
    s.screenLines = s.SCH * 8;

    // --- Audio
    s.audioSampleRate = mh.readUint32(50);
    s.audioSampleLength = mh.readUint32(54);
    s.audioLowerGate = mh.readUint32(58);
    s.audioUpperGate = mh.readUint32(62);
    s.audioGateValue = mh.readUint32(66);
    s.audioNextSampleTact = mh.readUint32(70);
    s.audioSampleCount = mh.readUint32(74);
    s.beeperLastEarBit = mh.readBool(78);

    // --- Others
    s.KBLine0 = mh.readByte(79);
    s.KBLine1 = mh.readByte(80);
    s.KBLine2 = mh.readByte(81);
    s.KBLine3 = mh.readByte(82);
    s.KBLine4 = mh.readByte(83);
    s.KBLine5 = mh.readByte(84);
    s.KBLine6 = mh.readByte(85);
    s.KBLine7 = mh.readByte(86);

    const slotMh = new MemoryHelper(this.api, BLOCK_LOOKUP_TABLE);
    s.s0OffsetL = slotMh.readUint32(0) - VM_MEMORY;
    s.s0FlagL = slotMh.readByte(8);
    s.s0OffsetH = slotMh.readUint32(16) - VM_MEMORY;
    s.s0FlagH = slotMh.readByte(24);
    s.s1OffsetL = slotMh.readUint32(32) - VM_MEMORY;
    s.s1FlagL = slotMh.readByte(40);
    s.s1OffsetH = slotMh.readUint32(48) - VM_MEMORY;
    s.s1FlagH = slotMh.readByte(56);
    s.s2OffsetL = slotMh.readUint32(64) - VM_MEMORY;
    s.s2FlagL = slotMh.readByte(72);
    s.s2OffsetH = slotMh.readUint32(80) - VM_MEMORY;
    s.s2FlagH = slotMh.readByte(88);
    s.s3OffsetL = slotMh.readUint32(96) - VM_MEMORY;
    s.s3FlagL = slotMh.readByte(104);
    s.s3OffsetH = slotMh.readUint32(112) - VM_MEMORY;
    s.s3FlagH = slotMh.readByte(120);
    return s;
  }

  /**
   * Gets the addressable Z80 memory contents from the machine
   */
  getMemoryContents(): Uint8Array {
    const result = new Uint8Array(0x1_0000);
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
   * Gets the screen data of the virtual machine
   */
  /**
   * Gets the screen data of the ZX Spectrum machine
   */
  getScreenData(): Uint32Array {
    const buffer = this.api.memory.buffer as ArrayBuffer;
    const screenData = new Uint32Array(
      buffer.slice(
        Z88_PIXEL_BUFFER,
        Z88_PIXEL_BUFFER + 4 * this._screenWidth * this._screenHeight
      )
    );
    return screenData;
  }

  /**
   * Sets the audio sample rate
   * @param rate Sample rate
   */
  setAudioSampleRate(rate: number): void {
    this.api.setBeeperSampleRate(rate);
  }

  /**
   * Prepares the engine for code injection
   * @param model Model to run in the virtual machine
   */
  async prepareForInjection(_model: string): Promise<number> {
    // TODO: Implement this method
    return 0;
  }

  /**
   * Cleans up audio
   */
  async cleanupAudio(): Promise<void> {
    if (this._beeperRenderer) {
      await this._beeperRenderer.closeAudio();
      this._beeperRenderer = null;
    }
  }

  // ==========================================================================
  // Lifecycle methods

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
    resultState: CambridgeZ88MachineState,
    toWait: number
  ): Promise<void> {
    const state = resultState as CambridgeZ88MachineState;
    this.vmEngineController.setUiMessage(
      state.lcdWentOff
        ? "Z88 turned the LCD off (no activity). Press F6 to use Z88 again."
        : null
    );
    if (toWait >= 0) {
      this.vmEngineController.signScreenRefreshed();
    }

    // --- Update load state
    const emuState = this._stateManager.getState().emulatorPanelState;

    if (!this.executionOptions.disableScreenRendering) {
      // --- Obtain beeper samples
      let mh = new MemoryHelper(this.api, Z88_BEEPER_BUFFER);
      const beeperSamples = mh
        .readBytes(0, resultState.audioSampleCount)
        .map((smp) => (emuState.muted ? 0 : smp * (emuState.soundLevel ?? 0)));
      this._beeperRenderer.storeSamples(beeperSamples);
      this._beeperRenderer.resume();
    }
  }

  /**
   * Executes a machine specific command.
   * @param command Command to execute
   * @param controller Machine controller
   */
  async executeMachineCommand(
    command: string,
    controller: IVmEngineController
  ): Promise<void> {
    switch (command) {
      case CZ88_SOFT_RESET:
        await controller.stop();
        await controller.start();
        break;
      case CZ88_HARD_RESET:
        await controller.stop();
        this.api.setupMachine();
        await controller.start();
        break;
      case CZ88_PRESS_BOTH_SHIFTS:
        this.api.setKeyStatus(cz88KeyCodes.ShiftL, true);
        this.api.setKeyStatus(cz88KeyCodes.ShiftR, true);
        await new Promise((r) => setTimeout(r, 400));
        this.api.setKeyStatus(cz88KeyCodes.ShiftL, false);
        this.api.setKeyStatus(cz88KeyCodes.ShiftR, false);
        break;
      case CZ88_BATTERY_LOW:
        const state = this.getMachineState();
        if (state.isInSleepMode) {
          this.api.setKeyStatus(cz88KeyCodes.ShiftL, true);
          this.api.setKeyStatus(cz88KeyCodes.ShiftR, true);
          await new Promise((r) => setTimeout(r, 400));
          this.api.setKeyStatus(cz88KeyCodes.ShiftL, false);
          this.api.setKeyStatus(cz88KeyCodes.ShiftR, false);
        }
        this.api.raiseBatteryLow();
        break;
    }
  }
}

/**
 * Z88 INT flag values
 */
export enum IntFlags {
  BM_INTKWAIT = 0x80,
  BM_INTA19 = 0x40,
  BM_INTFLAP = 0x20,
  BM_INTUART = 0x10,
  BM_INTBTL = 0x08,
  BM_INTKEY = 0x04,
  BM_INTTIME = 0x02,
  BM_INTGINT = 0x01,
}

/**
 * Z88 TSTA flag values
 */
export enum TstaFlags {
  BM_TSTATICK = 0x01,
  BM_TSTASEC = 0x02,
  BM_TSTAMIN = 0x04,
}

/**
 * Z88 TMK flag values
 */
export enum TmkFlags {
  BM_TMKTICK = 0x01,
  BM_TMKSEC = 0x02,
  BM_TMKMIN = 0x04,
}

/**
 * Provides a way to test a Z88 virtual machine in Node
 */
class SilentAudioRenderer implements IAudioRenderer {
  async initializeAudio(): Promise<void> {}
  storeSamples(_samples: number[]): void {}
  suspend(): void {}
  resume(): void {}
  async closeAudio(): Promise<void> {}
}

/**
 * A no-op implementation of class DefaultZxSpectrumBaseStateManager implements ICambridgeZ88BaseStateManager {

 */
class DefaultCambridgeZ88BaseStateManager
  implements ICambridgeZ88BaseStateManager {
  getState(): any {}
}
