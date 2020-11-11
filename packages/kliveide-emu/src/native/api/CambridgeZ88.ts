import { MachineApi } from "./api";
import { CambridgeZ88MachineState, MachineState } from "./machine-state";
import { MemoryHelper } from "./memory-helpers";
import { STATE_TRANSFER_BUFF } from "./memory-map";
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

    return s;
  }
}
