import { ProgramCounterInfo } from "../../../shared/state/AppState";
import { Z80CpuState } from "../../cpu/Z80Cpu";
import { IAudioRenderer } from "../audio/IAudioRenderer";
import { MachineCreationOptions, MachineState } from "../core/vm-core-types";
import { Z80MachineCoreBase } from "../core/Z80MachineCoreBase";
import { ICambridgeZ88StateManager } from "./ICambrideZ88StateMananger";
import {
  BLOCK_LOOKUP_TABLE,
  VM_MEMORY,
  Z88_BEEPER_BUFFER,
  Z88_MACHINE_STATE_BUFFER,
  Z88_PIXEL_BUFFER,
} from "../wa-interop/memory-map";
import { MemoryHelper } from "../wa-interop/memory-helpers";
import { KeyMapping } from "../core/keyboard";
import { cz88KeyCodes, cz88KeyMappings } from "./cz88-keys";
import { vmEngineService } from "../core/vm-engine-service";
import {
  CZ88_BATTERY_LOW,
  CZ88_CARDS,
  CZ88_HARD_RESET,
  CZ88_PRESS_BOTH_SHIFTS,
  CZ88_REFRESH_OPTIONS,
  CZ88_SOFT_RESET,
} from "../../../shared/machines/macine-commands";
import { getEngineDependencies } from "../core/vm-engine-dependencies";
import { modalDialogService } from "../../common-ui/modal-service";
import {
  ICustomDisassembler,
  IDisassemblyApi,
} from "../../../shared/z80/disassembler/custom-disassembly";
import {
  DisassemblyItem,
  FetchResult,
  intToX2,
  MemorySection,
} from "../../../shared/z80/disassembler/disassembly-helper";
import { VirtualMachineToolBase } from "../core/VitualMachineToolBase";
import { Store } from "redux";
import { getStore } from "../../emulator/emuStore";

export const Z88_CARDS_DIALOG_ID = "Z88CardsDialog";

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
        const result = await modalDialogService.showModalDialog(
          getStore() as Store,
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

/**
 * Represents the custom tools associated with Cambridge Z88
 */
export class CambridgeZ88Tools extends VirtualMachineToolBase {
  /**
   * The virtual machine can provide its custom disassember
   * @returns The custom disassebler, if supported; otherwise, null
   */
  provideCustomDisassembler(): ICustomDisassembler | null {
    return new CambridgeZ88CustomDisassembler();
  }
}

/**
 * Custom disassembler for the Cambridge Z88 model
 */
export class CambridgeZ88CustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;

  /**
   * Klive passes the disassembly API to the custom disassembler
   * @param api
   */
  setDisassemblyApi(api: IDisassemblyApi): void {
    this._api = api;
  }

  /**
   * The disassembler starts disassembling a memory section
   * @param _section
   */
  startSectionDisassembly(_section: MemorySection): void {}

  /**
   * The disassembler is about to disassemble the subsequent instruction. The custom disassembler
   * can sign up to take the job.
   * @param peekResult The result of a peek(0) operation
   * @returns True, if the custom disassembler wants to disassemble the next instruction(s);
   * otherwise, false
   */
  beforeInstruction(peekResult: FetchResult): boolean {
    if (peekResult.opcode === 0xdf) {
      // --- Handle RST 18H
      this._api.fetch();
      const opByte = this._api.fetch().opcode;
      const apiName = z88FppApis[opByte] ?? "<unknown>";

      // --- Create the item
      const newItem: DisassemblyItem = {
        address: peekResult.offset,
        opCodes: `${intToX2(peekResult.opcode)} ${intToX2(opByte)}`,
        instruction: `fpp ${apiName}`,
      };
      this._api.addDisassemblyItem(newItem);
      return true;
    } else if (peekResult.opcode === 0xe7) {
      // --- Handle RST 20H
      this._api.fetch();
      let opByte = this._api.fetch().opcode;
      let opCodes = `${intToX2(peekResult.opcode)} ${intToX2(opByte)}`;
      if (opByte === 6 || opByte === 9 || opByte === 12) {
        const opByte2 = this._api.fetch().opcode;
        opByte = (opByte2 << 8) + opByte;
        opCodes += ` ${intToX2(opByte2)}`;
      }
      const apiName = z88OzApis[opByte] ?? "<unknown>";

      // --- Create the item
      const newItem: DisassemblyItem = {
        address: peekResult.offset,
        opCodes,
        instruction: `oz ${apiName}`,
      };
      this._api.addDisassemblyItem(newItem);
      if (opByte === 0x93) {
        // --- Special case, add a 0-terminated string
        let str = ".defb ";
        let ch = 0;
        let isFirst = true;
        let usedString = false;
        do {
          ch = this._api.fetch().opcode;
          if (ch >= 32 && ch <= 127) {
            if (usedString) {
              str += String.fromCharCode(ch);
            } else {
              if (!isFirst) {
                str += ", ";
              }
              str += '"' + String.fromCharCode(ch);
            }
            usedString = true;
          } else {
            if (usedString) {
              str += '"';
            }
            if (!isFirst) {
              str += ", ";
            }
            str += `$${intToX2(ch)}`
            usedString = false;
          }
          isFirst = false;
        } while (ch);
        const strItem: DisassemblyItem = {
          address: peekResult.offset,
          opCodes: "",
          instruction: str,
        };
        this._api.addDisassemblyItem(strItem);
      }

      return true;
    } else if (peekResult.opcode === 0xef) {
      // --- Handle RST 28H
      // --- Consume th operation code
      this._api.fetch();

      // --- Get the 24-bit LSB address
      const byte1 = this._api.fetch().opcode;
      const byte2 = this._api.fetch().opcode;
      const byte3 = this._api.fetch().opcode;
      const addr = (byte3 << 16) | (byte2 << 8) | byte1;

      // --- Create the item
      const newItem: DisassemblyItem = {
        address: peekResult.offset,
        opCodes: `${intToX2(peekResult.opcode)} ${intToX2(byte1)} ${intToX2(
          byte2
        )} ${intToX2(byte3)}`,
        instruction: `extcall $${addr
          .toString(16)
          .padStart(6, "")
          .toLowerCase()}`,
      };
      this._api.addDisassemblyItem(newItem);
      return true;
    } else if (peekResult.opcode === 0xf7) {
      // --- Handle RST 30H
      this._api.fetch();
      // --- Create the item
      const newItem: DisassemblyItem = {
        address: peekResult.offset,
        opCodes: `${intToX2(peekResult.opcode)}`,
        instruction: "rst oz_mbp",
      };
      this._api.addDisassemblyItem(newItem);
      return true;
    }

    // --- Use the default disassembly
    return false;
  }

  /**
   * The disassembler decoded the subsequent instruction. The custom disassembler can change the
   * details of the disassembled item, or update its internal state accordingly
   * @param _item Disassembled item
   */
  afterInstruction(_item: DisassemblyItem): void {}
}

/**
 * List of Z88 RST 18H APIs
 */
export const z88FppApis: Record<number, string> = {
  0x21: "FP_AND",
  0x24: "FP_IDV",
  0x27: "FP_EOR",
  0x2a: "FP_MOD",
  0x2d: "FP_OR",
  0x30: "FP_LEQ",
  0x33: "FP_NEQ",
  0x36: "FP_GEQ",
  0x39: "FP_LT",
  0x3c: "FP_EQ",
  0x3f: "FP_MUL",
  0x42: "FP_ADD",
  0x45: "FP_GT",
  0x48: "FP_SUB",
  0x4b: "FP_PWR",
  0x4e: "FP_DIV",
  0x51: "FP_ABS",
  0x54: "FP_ACS",
  0x57: "FP_ASN",
  0x5a: "FP_ATN",
  0x5d: "FP_COS",
  0x60: "FP_DEG",
  0x63: "FP_EXP",
  0x66: "FP_INT",
  0x6c: "FP_LOG",
  0x6f: "FP_NOT",
  0x72: "FP_RAD",
  0x75: "FP_SGN",
  0x78: "FP_SIN",
  0x7b: "FP_SQR",
  0x7e: "FP_TAN",
  0x81: "FP_ZER",
  0x84: "FP_ONE",
  0x87: "FP_TRU",
  0x8a: "FP_PI",
  0x8d: "FP_VAL",
  0x90: "FP_STR",
  0x93: "FP_FIX",
  0x96: "FP_FLT",
  0x9c: "FP_CMP",
  0x9f: "FP_NEG",
  0xa2: "FP_BAS",
};

export const z88OzApis: Record<number, string> = {
  0x21: "OS_BYE",
  0x24: "OS_PRT",
  0x27: "OS_OUT",
  0x2a: "OS_IN",
  0x2d: "OS_TIN",
  0x30: "OS_XIN",
  0x33: "OS_PUR",
  0x36: "OS_UGB",
  0x39: "OS_GB",
  0x3c: "OS_PB",
  0x3f: "OS_GBT",
  0x42: "OS_PBT",
  0x45: "OS_MV",
  0x48: "OS_FRM",
  0x4b: "OS_FWM",
  0x4e: "OS_MOP",
  0x51: "OS_MCL",
  0x54: "OS_MAL",
  0x57: "OS_MFR",
  0x5a: "OS_MGB",
  0x5d: "OS_MPB",
  0x60: "OS_BIX",
  0x63: "OS_BOX",
  0x66: "OS_NQ",
  0x69: "OS_SP",
  0x6c: "OS_SR",
  0x6f: "OS_ESC",
  0x72: "OS_ERC",
  0x75: "OS_ERH",
  0x78: "OS_UST",
  0x7b: "OS_FN",
  0x7e: "OS_WAIT",
  0x81: "OS_ALM",
  0x84: "OS_CLI",
  0x87: "OS_DOR",
  0x8a: "OS_FC",
  0x8d: "OS_SI",
  0x90: "OS_BOUT",
  0x93: "OS_POUT",
  0x96: "OS_HOUT",
  0x99: "OS_SOUT",
  0x9c: "OS_KIN",
  0x9f: "OS_NLN",

  0xb606: "OS_FAT",
  0xb806: "OS_ISO",
  0xba06: "OS_FDP",
  0xbc06: "OS_WTS",
  0xc006: "OS_FXM",
  0xc206: "OS_AXM",
  0xc406: "OS_FMA",
  0xc606: "OS_PLOZ",
  0xc806: "OS_FEP",
  0xca06: "OS_WTB",
  0xcc06: "OS_WRT",
  0xce06: "OS_WSQ",
  0xd006: "OS_ISQ",
  0xd206: "OS_AXP",
  0xd406: "OS_SCI",
  0xd606: "OS_DLY",
  0xd806: "OS_BLP",
  0xda06: "OS_BDE",
  0xdc06: "OS_BHL",
  0xde06: "OS_FTH",
  0xe006: "OS_VTH",
  0xe206: "OS_GTH",
  0xe406: "OS_REN",
  0xe606: "OS_DEL",
  0xe806: "OS_CL",
  0xea06: "OS_OP",
  0xec06: "OS_OFF",
  0xee06: "OS_USE",
  0xf006: "OS_EPR",
  0xf206: "OS_HT",
  0xf406: "OS_MAP",
  0xf606: "OS_EXIT",
  0xf806: "OS_STK",
  0xfa06: "OS_POLL",
  0xfc06: "OS_???",
  0xfe06: "OS_DOM",

  0x0609: "GN_GDT",
  0x0809: "GN_PDT",
  0x0a09: "GN_GTM",
  0x0c09: "GN_PTM",
  0x0e09: "GN_SDO",
  0x1009: "GN_GDN",
  0x1209: "GN_PDN",
  0x1409: "GN_DIE",
  0x1609: "GN_DEI",
  0x1809: "GN_GMD",
  0x1a09: "GN_GMT",
  0x1c09: "GN_PMD",
  0x1e09: "GN_PMT",
  0x2009: "GN_MSC",
  0x2209: "GN_FLO",
  0x2409: "GN_FLC",
  0x2609: "GN_FLW",
  0x2809: "GN_FLR",
  0x2a09: "GN_FLF",
  0x2c09: "GN_FPB",
  0x2e09: "GN_NLN",
  0x3009: "GN_CLS",
  0x3209: "GN_SKC",
  0x3409: "GN_SKF",
  0x3609: "GN_SKT",
  0x3809: "GN_SIP",
  0x3a09: "GN_SOP",
  0x3c09: "GN_SOE",
  0x3e09: "GN_RBE",
  0x4009: "GN_WBE",
  0x4209: "GN_CME",
  0x4409: "GN_XNX",
  0x4609: "GN_XIN",
  0x4809: "GN_XDL",
  0x4a09: "GN_ERR",
  0x4c09: "GN_ESP",
  0x4e09: "GN_FCM",
  0x5009: "GN_FEX",
  0x5209: "GN_OPW",
  0x5409: "GN_WCL",
  0x5609: "GN_WFN",
  0x5809: "GN_PRS",
  0x5a09: "GN_PFS",
  0x5c09: "GN_WSM",
  0x5e09: "GN_ESA",
  0x6009: "GN_OPF",
  0x6209: "GN_CL",
  0x6409: "GN_DEL",
  0x6609: "GN_REN",
  0x6809: "GN_AAB",
  0x6a09: "GN_FAB",
  0x6c09: "GN_LAB",
  0x6e09: "GN_UAB",
  0x7009: "GN_ALP",
  0x7209: "GN_M16",
  0x7409: "GN_D16",
  0x7609: "GN_M24",
  0x7809: "GN_D24",
  0x7a09: "GN_WIN",
  0x7c09: "GN_CRC",
  0x7e09: "GN_GAB",
  0x8009: "GN_LDM",
  0x8209: "GN_ELF",
  0x8409: "GN_GHN",
  0x8609: "GN_PHN",
  0x8809: "GN_DIR",
  0x8a09: "GN_MOV",
  0x8c09: "GN_CPY",
  0x8e09: "GN_LUT",

  0x060c: "DC_INI",
  0x080c: "DC_BYE",
  0x0a0c: "DC_ENT",
  0x0c0c: "DC_NAM",
  0x0e0c: "DC_IN",
  0x100c: "DC_OUT",
  0x120c: "DC_PRT",
  0x140c: "DC_ICL",
  0x160c: "DC_NQ",
  0x180c: "DC_SP",
  0x1a0c: "DC_ALT",
  0x1c0c: "DC_RBD",
  0x1e0c: "DC_XIN",
  0x200c: "DC_GEN",
  0x220c: "DC_POL",
  0x240c: "DC_RTE",
  0x260c: "DC_ELF",
  0x280c: "DC_DBG",
  0x2a0c: "DC_DIS",
  0x2c0c: "DC_SBP",
  0x2e0c: "DC_RBP",
  0x300c: "DC_LCK",
};
