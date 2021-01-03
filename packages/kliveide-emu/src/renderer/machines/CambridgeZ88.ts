import { MachineApi } from "./wa-api";
import { MemoryHelper } from "./memory-helpers";
import {
  BLOCK_LOOKUP_TABLE,
  PIXEL_BUFFER,
  STATE_TRANSFER_BUFF,
  Z88_MEM_AREA,
} from "./memory-map";
import { FrameBoundZ80Machine } from "./FrameBoundZ80Machine";
import {
  CambridgeZ88MachineState,
  MachineState,
  Z80MachineStateBase,
} from "../../shared/machines/machine-state";
import { KeyMapping } from "./keyboard";
import { cz88KeyCodes, cz88KeyMappings } from "./cz88-keys";
import { ExtraMachineFeatures } from "./Z80MachineBase";
import {
  CZ88_HARD_RESET,
  CZ88_SOFT_RESET,
} from "../../shared/machines/macine-commands";
import { IVmEngineController } from "./IVmEngineController";

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

  /**
   * Creates a new instance of the ZX Spectrum machine
   * @param api Machine API to access WA
   * @param scw Optional screen width
   * @param sch Optional screen height
   */
  constructor(
    public api: MachineApi,
    scw?: number,
    sch?: number,
    roms?: Uint8Array[]
  ) {
    super(api, roms);
    api.setZ88ScreenSize(scw ?? 0xff, sch ?? 8);
    api.turnOnMachine();
    this.initRoms(roms);
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
    const mh = new MemoryHelper(this.api, STATE_TRANSFER_BUFF);

    // --- Blink device data
    s.INT = mh.readByte(160);
    s.STA = mh.readByte(161);
    s.COM = mh.readByte(162);

    // --- RTC device
    s.TIM0 = mh.readByte(163);
    s.TIM1 = mh.readByte(164);
    s.TIM2 = mh.readByte(165);
    s.TIM3 = mh.readByte(166);
    s.TIM4 = mh.readByte(167);
    s.TSTA = mh.readByte(168);
    s.TMK = mh.readByte(169);

    // --- Screen device
    s.PB0 = mh.readUint16(170);
    s.PB1 = mh.readUint16(172);
    s.PB2 = mh.readUint16(174);
    s.PB3 = mh.readUint16(176);
    s.SBF = mh.readUint16(178);
    s.SCW = mh.readByte(180);
    s.SCH = mh.readByte(181);

    // --- Setup screen size
    s.screenWidth = s.SCW === 100 ? 800 : 640;
    s.screenLines = s.SCH * 8;

    // --- Memory device
    s.SR0 = mh.readByte(182);
    s.SR1 = mh.readByte(183);
    s.SR2 = mh.readByte(184);
    s.SR3 = mh.readByte(185);
    s.chipMask0 = mh.readByte(186);
    s.chipMask1 = mh.readByte(187);
    s.chipMask2 = mh.readByte(188);
    s.chipMask3 = mh.readByte(189);
    s.chipMask4 = mh.readByte(190);

    // --- Others
    s.SHFF = mh.readBool(191);
    s.KBLine0 = mh.readByte(192);
    s.KBLine1 = mh.readByte(193);
    s.KBLine2 = mh.readByte(194);
    s.KBLine3 = mh.readByte(195);
    s.KBLine4 = mh.readByte(196);
    s.KBLine5 = mh.readByte(197);
    s.KBLine6 = mh.readByte(198);
    s.KBLine7 = mh.readByte(199);

    const slotMh = new MemoryHelper(this.api, BLOCK_LOOKUP_TABLE);
    s.s0OffsetL = slotMh.readUint32(0) - Z88_MEM_AREA;
    s.s0FlagL = slotMh.readByte(8);
    s.s0OffsetH = slotMh.readUint32(16) - Z88_MEM_AREA;
    s.s0FlagH = slotMh.readByte(24);
    s.s1OffsetL = slotMh.readUint32(32) - Z88_MEM_AREA;
    s.s1FlagL = slotMh.readByte(40);
    s.s1OffsetH = slotMh.readUint32(48) - Z88_MEM_AREA;
    s.s1FlagH = slotMh.readByte(56);
    s.s2OffsetL = slotMh.readUint32(64) - Z88_MEM_AREA;
    s.s2FlagL = slotMh.readByte(72);
    s.s2OffsetH = slotMh.readUint32(80) - Z88_MEM_AREA;
    s.s2FlagH = slotMh.readByte(88);
    s.s3OffsetL = slotMh.readUint32(96) - Z88_MEM_AREA;
    s.s3FlagL = slotMh.readByte(104);
    s.s3OffsetH = slotMh.readUint32(112) - Z88_MEM_AREA;
    s.s3FlagH = slotMh.readByte(120);
    return s;
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
   * Gets the screen data of the virtual machine
   */
  /**
   * Gets the screen data of the ZX Spectrum machine
   */
  getScreenData(): Uint32Array {
    const buffer = this.api.memory.buffer as ArrayBuffer;
    const screenData = new Uint32Array(
      buffer.slice(
        PIXEL_BUFFER,
        PIXEL_BUFFER + 4 * this._screenWidth * this._screenHeight
      )
    );
    return screenData;
  }

  /**
   * Sets the audio sample rate
   * @param rate Sample rate
   */
  setAudioSampleRate(rate: number): void {
    // TODO: Implement this method
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
   * Takes care that the screen and the audio gets refreshed as a frame
   * completes
   * @param resultState Machine state on frame completion
   */
  async onFrameCompleted(
    _resultState: Z80MachineStateBase,
    toWait: number
  ): Promise<void> {
    if (toWait >= 0) {
      this.vmEngineController.signScreenRefreshed();
    }
    // --- At this point we have not completed the execution yet
    // --- Initiate the refresh of the screen
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
        this.api.turnOnMachine();
        //this.api.clearMemory();
        await controller.start();
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
