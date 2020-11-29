import { MachineApi } from "../../native/api/api";
import { CambridgeZ88MachineState, MachineState } from "./machine-state";
import { MemoryHelper } from "../../native/api/memory-helpers";
import {
  STATE_TRANSFER_BUFF,
  Z88_MEM_AREA,
  Z88_PAGE_PTRS,
} from "../../native/api/memory-map";
import { FrameBoundZ80Machine } from "./FrameBoundZ80Machine";

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
  readonly displayName = "Cambridge Z88"

  /**
   * Creates a new instance of the ZX Spectrum machine
   * @param api Machine API to access WA
   */
  constructor(public api: MachineApi) {
    super(api);
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
   * Gets the current state of the ZX Spectrum machine
   */
  getMachineState(): CambridgeZ88MachineState {
    const s = this.createMachineState() as CambridgeZ88MachineState;
    this.api.getMachineState();

    const mh = new MemoryHelper(this.api, STATE_TRANSFER_BUFF);

    // --- Get CPU configuration data
    s.baseClockFrequency = mh.readUint32(48);
    s.clockMultiplier = mh.readByte(52);
    s.supportsNextOperations = mh.readBool(53);

    // --- Blink device data
    s.INT = mh.readByte(54);
    s.STA = mh.readByte(55);
    s.COM = mh.readByte(56);

    // --- RTC device
    s.TIM0 = mh.readByte(57);
    s.TIM1 = mh.readByte(58);
    s.TIM2 = mh.readByte(59);
    s.TIM3 = mh.readByte(60);
    s.TIM4 = mh.readByte(61);
    s.TSTA = mh.readByte(62);
    s.TMK = mh.readByte(63);

    // --- Screen device
    s.PB0 = mh.readByte(64);
    s.PB1 = mh.readByte(65);
    s.PB2 = mh.readByte(66);
    s.PB3 = mh.readByte(67);
    s.SBR = mh.readByte(68);
    s.SCW = mh.readByte(70);
    s.SCH = mh.readByte(71);

    s.screenWidth = 640;
    s.screenLines = 64;

    // --- Memory device
    s.SR0 = mh.readByte(72);
    s.SR1 = mh.readByte(73);
    s.SR2 = mh.readByte(74);
    s.SR3 = mh.readByte(75);
    s.chipMask0 = mh.readByte(76);
    s.chipMask1 = mh.readByte(77);
    s.chipMask2 = mh.readByte(78);
    s.chipMask3 = mh.readByte(79);
    s.chipMask4 = mh.readByte(80);

    const slotMh = new MemoryHelper(this.api, Z88_PAGE_PTRS);
    s.s0OffsetL = slotMh.readUint32(0) - Z88_MEM_AREA;
    s.s0FlagL = slotMh.readByte(4);
    s.s0OffsetH = slotMh.readUint32(5) - Z88_MEM_AREA;
    s.s0FlagH = slotMh.readByte(9);
    s.s1OffsetL = slotMh.readUint32(10) - Z88_MEM_AREA;
    s.s1FlagL = slotMh.readByte(14);
    s.s1OffsetH = slotMh.readUint32(15) - Z88_MEM_AREA;
    s.s1FlagH = slotMh.readByte(19);
    s.s2OffsetL = slotMh.readUint32(20) - Z88_MEM_AREA;
    s.s2FlagL = slotMh.readByte(24);
    s.s2OffsetH = slotMh.readUint32(25) - Z88_MEM_AREA;
    s.s2FlagH = slotMh.readByte(29);
    s.s3OffsetL = slotMh.readUint32(30) - Z88_MEM_AREA;
    s.s3FlagL = slotMh.readByte(34);
    s.s3OffsetH = slotMh.readUint32(35) - Z88_MEM_AREA;
    s.s3FlagH = slotMh.readByte(39);
    return s;
  }

  /**
   * Gets the addressable Z80 memory contents from the machine
   */
  getMemoryContents(): Uint8Array {
    const result = new Uint8Array(0x10000);
    const mh = new MemoryHelper(this.api, Z88_PAGE_PTRS);
    for (let i = 0; i < 8; i++) {
      const offs = i * 0x2000;
      const pageStart = mh.readUint32(i * 5);
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
    const state = this.getMachineState();
    const length = state.screenLines * state.screenWidth;
    const screenData = new Uint32Array(length);
    const pixel = state.frameCount & 0xff;
    for (let i = 0; i < length; i++) {
      screenData[i] = 0xff000000 | (pixel << 24) | (pixel << 16) | (pixel << 8);
    }
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
