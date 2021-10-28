import { getModalDialogService } from "@core/service-registry";

import { ProgramCounterInfo } from "@state/AppState";
import { Z80CpuState } from "@modules/cpu-z80/z80-cpu";
import {
  MachineCreationOptions,
  MachineState,
} from "@abstractions/vm-core-types";
import { Z80MachineCoreBase } from "@modules/cpu-z80/z80-machine-core-base";
import { ICambridgeZ88StateManager } from "./ICambrideZ88StateMananger";
import { Z88_BEEPER_BUFFER, Z88_PIXEL_BUFFER } from "@modules/vm-z88/wa-memory-map";
import { MemoryHelper } from "@modules-core/memory-helpers";
import { KeyMapping } from "@modules-core/keyboard";
import { cz88KeyCodes, cz88KeyMappings } from "./cz88-keys";
import {
  CZ88_BATTERY_LOW,
  CZ88_CARDS,
  CZ88_HARD_RESET,
  CZ88_PRESS_BOTH_SHIFTS,
  CZ88_REFRESH_OPTIONS,
  CZ88_SOFT_RESET,
} from "@modules/vm-z88/macine-commands";
import { getEngineDependencies } from "@modules-core/vm-engine-dependencies";
import {
  BreakpointDefinition,
  CodeToInject,
} from "@abstractions/code-runner-service";
import { getVmEngineService } from "../core/vm-engine-service";
import { BLOCK_LOOKUP_TABLE } from "@modules/cpu-z80/wa-memory-map";
import { VM_MEMORY, VM_STATE_BUFFER } from "@modules-core/wa-memory-map";
import { IAudioRenderer } from "@modules-core/audio/IAudioRenderer";
import { WasmMachineApi } from "@modules-core/abstract-vm";

export const Z88_CARDS_DIALOG_ID = "Z88CardsDialog";

/**
 * Represents the WebAssembly API of Z88
 */
export interface WasmZ88Api extends WasmMachineApi {
  testIncZ88Rtc(inc: number): void;
  testSetRtcRegs(
    tim0: number,
    tim1: number,
    tim2: number,
    tim3: number,
    tim4: number
  ): void;
  setAudioSampleRate(rate: number): void;
  testSetZ88INT(value: number): void;
  testSetZ88STA(value: number): void;
  testSetZ88COM(value: number): void;
  testSetZ88TMK(value: number): void;
  testReadCz88Memory(addr: number): number;
  testWriteCz88Memory(addr: number, value: number): number;
  setZ88ChipMask(slot: number, value: number): void;
  setZ88SlotMask(slot: number, isRom: boolean): void;
  setZ88RndSeed(seed: number): void;
  writePortCz88(addr: number, value: number): void;
  clearMemory(): void;
  setZ88ScreenSize(scw: number, sch: number): void;
  raiseBatteryLow(): void;
}

/**
 * ZX Spectrum common core implementation
 */
export class CambridgeZ88Core extends Z80MachineCoreBase {
  // --- Beeper emulation
  private _beeperRenderer: IAudioRenderer | null = null;

  // --- A factory method for audio renderers
  private _audioRendererFactory: (sampleRate: number) => IAudioRenderer;

  // --- A state manager instance
  private _stateManager: ICambridgeZ88StateManager;

  /**
   * The WA machine API to use the machine core
   */
  public api: WasmZ88Api;

  /**
   * Instantiates a core with the specified options
   * @param options Options to use with machine creation
   */
  constructor(options: MachineCreationOptions) {
    super(options);
    const deps = getEngineDependencies();
    this._audioRendererFactory = deps.audioRendererFactory;
    this._stateManager = deps.cz88StateManager;
  }

  /**
   * Gets the unique model identifier of the machine
   */
  readonly modelId = "cz88";

  /**
   * Get the type of the keyboard to display
   */
  readonly keyboardType: string | null = "cz88";

  /**
   * The name of the module file with the WA machine engine
   */
  readonly waModuleFile: string = "cz88.wasm";

  /**
   * Friendly name to display
   */
  readonly displayName = "Cambridge Z88";

  /**
   * Gets a unique identifier for the particular configuration of the model
   */
  get configurationId(): string {
    return this.modelId;
  }

  /**
   * Override this property to apply multiple engine loops before
   * Refreshing the UI
   */
  readonly engineLoops = 8;

  /**
   * Gets the program counter information of the machine
   * @param state Current machine state
   */
  getProgramCounterInfo(state: CambridgeZ88MachineState): ProgramCounterInfo {
    return {
      label: "PC",
      value: state._pc,
    };
  }

  /**
   * Creates the CPU instance
   */
  configureMachine(): void {
    super.configureMachine();
    this.api.setZ88ScreenSize(
      this.options?.scw ?? 0xff,
      this.options?.sch ?? 8
    );

    this.configureSlot(1);
    this.configureSlot(2);
    this.configureSlot(3);

    const deps = getEngineDependencies();
    this.setAudioSampleRate(deps.sampleRateGetter());
  }

  /**
   * Configures the specified slot
   * @param slot
   */
  private configureSlot(slot: number): void {
    const slotConfig = (this.options as any)[`card${slot}`];
    if (!slotConfig) {
      return;
    }

    const contents = slotConfig.eprom as Uint8Array | undefined;
    const ramSize = slotConfig.ramSize as number | undefined;
    if (slotConfig.eprom) {
      // --- Put the eprom contents into the memory
      let mh = new MemoryHelper(this.api, this.getFirmwareBaseAddress());
      const slotBase = slot * 1024 * 1024;
      for (let i = 0; i < contents.length; i++) {
        mh.writeByte(slotBase + i, contents[i]);
      }
      this.api.setZ88ChipMask(slot + 1, getChipmask(contents.length));
      this.api.setZ88SlotMask(slot, true);
    } else {
      this.api.setZ88ChipMask(slot + 1, getChipmask(ramSize));
      this.api.setZ88SlotMask(slot, false);
    }

    function getChipmask(size: number): number {
      let mask = 0x00;
      switch (size) {
        case 0x00_8000:
          mask = 0x01;
          break;
        case 0x01_0000:
          mask = 0x03;
          break;
        case 0x02_0000:
          mask = 0x07;
          break;
        case 0x04_0000:
          mask = 0x0f;
          break;
        case 0x08_0000:
          mask = 0x1f;
          break;
        case 0x10_0000:
          mask = 0x3f;
          break;
      }
      return mask;
    }
  }

  /**
   * Sets the audio sample rate to use with sound devices
   * @param rate Audio sampe rate to use
   */
  setAudioSampleRate(rate: number): void {
    this.api.setAudioSampleRate(rate);
  }

  /**
   * Gets the screen data of the virtual machine
   */
  /**
   * Gets the screen data of the ZX Spectrum machine
   */
  getScreenData(): Uint32Array {
    const state = this.getMachineState() as CambridgeZ88MachineState;
    const buffer = this.api.memory.buffer as ArrayBuffer;
    const screenData = new Uint32Array(
      buffer.slice(
        Z88_PIXEL_BUFFER,
        Z88_PIXEL_BUFFER + 4 * state.screenWidth * state.screenHeight
      )
    );
    return screenData;
  }

  /**
   * Gets the current state of the ZX Spectrum machine
   */
  getMachineState(): CambridgeZ88MachineState {
    // --- Obtain execution engine state
    const cpuState = this.cpu.getCpuState();
    const engineState = super.getMachineState();
    const s = { ...cpuState, ...engineState } as CambridgeZ88MachineState;

    this.api.getMachineState();
    const mh = new MemoryHelper(this.api, VM_STATE_BUFFER);

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
    s.chipMask5 = mh.readByte(16);

    // --- RTC device
    s.TIM0 = mh.readByte(17);
    s.TIM1 = mh.readByte(18);
    s.TIM2 = mh.readByte(19);
    s.TIM3 = mh.readByte(20);
    s.TIM4 = mh.readByte(21);
    s.TSTA = mh.readByte(22);
    s.TMK = mh.readByte(23);

    // --- Screen device
    s.PB0 = mh.readUint16(24);
    s.PB1 = mh.readUint16(26);
    s.PB2 = mh.readUint16(28);
    s.PB3 = mh.readUint16(30);
    s.SBF = mh.readUint16(32);
    s.SCW = mh.readByte(34);
    s.SCH = mh.readByte(35);
    s.screenFrameCount = mh.readUint32(36);
    s.flashPhase = mh.readBool(40);
    s.textFlashPhase = mh.readBool(41);
    s.lcdWentOff = mh.readBool(42);

    // --- Setup screen size
    s.screenWidth = s.SCW === 100 ? 800 : 640;
    s.screenHeight = s.SCH * 8;

    // --- Audio
    s.audioSampleRate = mh.readUint32(47);
    s.audioSampleLength = mh.readUint32(51);
    s.audioLowerGate = mh.readUint32(55);
    s.audioUpperGate = mh.readUint32(59);
    s.audioGateValue = mh.readUint32(63);
    s.audioNextSampleTact = mh.readUint32(67);
    s.audioSampleCount = mh.readUint32(71);
    s.beeperLastEarBit = mh.readBool(75);

    // --- Others
    s.KBLine0 = mh.readByte(76);
    s.KBLine1 = mh.readByte(77);
    s.KBLine2 = mh.readByte(78);
    s.KBLine3 = mh.readByte(79);
    s.KBLine4 = mh.readByte(80);
    s.KBLine5 = mh.readByte(81);
    s.KBLine6 = mh.readByte(82);
    s.KBLine7 = mh.readByte(83);

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
   * Override this method to set the clock multiplier
   * @param multiplier Clock multiplier to apply from the next frame
   */
  setClockMultiplier(multiplier: number): void {
    this.api.setClockMultiplier(multiplier);
  }

  /**
   * Injects the specified code into the ZX Spectrum machine
   * @param codeToInject Code to inject into the machine
   */
  async injectCodeToRun(codeToInject: CodeToInject): Promise<void> {}

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
    // TODO: Implement this method
  }

  /**
   * Set the specified breakpoint definition
   * @param def
   */
  async setBreakpoint(def: BreakpointDefinition): Promise<void> {
    // TODO: Implement this method
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
    const vmEngineService = getVmEngineService();
    vmEngineService.setUiMessage(
      state.lcdWentOff
        ? "Z88 turned the LCD off (no activity). Press F6 to use Z88 again."
        : null
    );
    if (toWait >= 0) {
      vmEngineService.signScreenRefreshed();
    }

    // --- Update load state
    const emuState = this._stateManager.getState().emulatorPanel;

    // --- Obtain beeper samples
    let mh = new MemoryHelper(this.api, Z88_BEEPER_BUFFER);
    const beeperSamples = mh
      .readBytes(0, resultState.audioSampleCount)
      .map((smp) => (emuState.muted ? 0 : smp * (emuState.soundLevel ?? 0)));
    this._beeperRenderer.storeSamples(beeperSamples);
    this._beeperRenderer.resume();
  }

  // ==========================================================================
  // Helpers

  /**
   * Cleans up audio
   */
  async cleanupAudio(): Promise<void> {
    if (this._beeperRenderer) {
      await this._beeperRenderer.closeAudio();
      this._beeperRenderer = null;
    }
  }

  /**
   * Executes a machine specific command. Override in a machine to
   * respond to those commands
   * @param command Command to execute
   * @param args Optional command arguments
   */
  async executeMachineCommand(
    command: string,
    args?: unknown
  ): Promise<unknown> {
    const vmEngineService = getVmEngineService();
    switch (command) {
      case CZ88_SOFT_RESET:
        vmEngineService.resetCpu();
        return;

      case CZ88_HARD_RESET:
        await vmEngineService.restart();
        return;

      case CZ88_PRESS_BOTH_SHIFTS:
        this.api.setKeyStatus(cz88KeyCodes.ShiftL, true);
        this.api.setKeyStatus(cz88KeyCodes.ShiftR, true);
        await new Promise((r) => setTimeout(r, 400));
        this.api.setKeyStatus(cz88KeyCodes.ShiftL, false);
        this.api.setKeyStatus(cz88KeyCodes.ShiftR, false);
        return;

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
        return;

      case CZ88_CARDS:
        const result = await getModalDialogService().showModalDialog(
          Z88_CARDS_DIALOG_ID,
          args
        );
        return result;

      case CZ88_REFRESH_OPTIONS:
        const card1 = (args as any).card1;
        this.options.card1 = { ...card1 };
        this.configureSlot(1);

        const card2 = (args as any).card2;
        this.options.card2 = { ...card2 };
        this.configureSlot(2);

        const card3 = (args as any).card3;
        this.options.card3 = { ...card3 };
        this.configureSlot(3);
        break;

      default:
        console.error(`Unknown command type received: ${command}`);
        return;
    }
  }
}

/**
 * Represents the state of a Cambridge Z88 machine
 */
export interface CambridgeZ88MachineState extends MachineState, Z80CpuState {
  // --- Blink device status
  COM: number;
  EPR: number;

  // --- Machine modes
  shiftsReleased: boolean;
  isInSleepMode: boolean;

  // --- Interrupt
  INT: number;
  STA: number;
  interruptSignalActive: boolean;

  SR0: number;
  SR1: number;
  SR2: number;
  SR3: number;
  chipMask0: number;
  chipMask1: number;
  chipMask2: number;
  chipMask3: number;
  chipMask4: number;
  chipMask5: number;

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
  screenFrameCount: number;
  flashPhase: boolean;
  textFlashPhase: boolean;
  lcdWentOff: boolean;

  // --- Keyboard
  KBLine0: number;
  KBLine1: number;
  KBLine2: number;
  KBLine3: number;
  KBLine4: number;
  KBLine5: number;
  KBLine6: number;
  KBLine7: number;

  // --- Beeper state
  audioSampleRate: number;
  audioSampleLength: number;
  audioLowerGate: number;
  audioUpperGate: number;
  audioGateValue: number;
  audioNextSampleTact: number;
  audioSampleCount: number;
  beeperLastEarBit: boolean;

  // --- Memory device
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
