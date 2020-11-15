import { MachineApi } from "./api";
import { CambridgeZ88MachineState, MachineState } from "./machine-state";
import { MemoryHelper } from "./memory-helpers";
import { PAGE_INDEX_16, STATE_TRANSFER_BUFF, Z88_MEM_AREA } from "./memory-map";
import { FrameBoundZ80Machine } from "./Z80VmBase";

/**
 * This class implements the Cambride Z88 machine
 */
export class CambridgeZ88 extends FrameBoundZ80Machine {
  /**
   * Creates a new instance of the ZX Spectrum machine
   * @param api Machine API to access WA
   * @param type Machine type
   */
  constructor(public api: MachineApi) {
    super(api, 5);
  }

  /**
   * Retrieves a ZX Spectrum 48 machine state object
   */
  createMachineState(): MachineState {
    return new CambridgeZ88MachineState();
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

    // --- Memory device
    s.SR0 = mh.readByte(72);
    s.SR1 = mh.readByte(73);
    s.SR2 = mh.readByte(74);
    s.SR3 = mh.readByte(75);
    s.slotMask0 = mh.readByte(76);
    s.slotMask1 = mh.readByte(77);
    s.slotMask2 = mh.readByte(78);
    s.slotMask3 = mh.readByte(79);
    s.slotMask0Rom = mh.readByte(80);

    const slotMh = new MemoryHelper(this.api, PAGE_INDEX_16);
    s.slot0Offset = slotMh.readUint32(0) - Z88_MEM_AREA;
    s.slot1Offset = slotMh.readUint32(6) - Z88_MEM_AREA;
    s.slot2Offset = slotMh.readUint32(12) - Z88_MEM_AREA;
    s.slot3Offset = slotMh.readUint32(18) - Z88_MEM_AREA;
    return s;
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
