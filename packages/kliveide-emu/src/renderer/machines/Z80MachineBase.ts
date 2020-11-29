import { MachineApi } from "../../native/api/api";
import { MachineState } from "./machine-state";
import { MemoryHelper } from "../../native/api/memory-helpers";
import {
  REG_AREA_INDEX,
  STATE_TRANSFER_BUFF,
} from "../../native/api/memory-map";
import { IVmEngineController } from "./IVmEngineController";

/**
 * This class is intended to be the base class of all Z80 machine
 */
export abstract class Z80MachineBase {
  // --- The engine controlles this machine can use
  private _vmEngineController: IVmEngineController | undefined;

  /**
   * Creates a new instance of the Z80 machine
   * @param api Machine API to access WA
   */
  constructor(public api: MachineApi) {}

  /**
   * The type identifier of the machine
   */
  abstract readonly typeId: string;

  /**
   * Friendly name to display
   */
  abstract readonly displayName: string;

  /**
   * Gets the associated controller instance
   */
  get vmEngineController(): IVmEngineController {
    if (!this._vmEngineController) {
      throw new Error(
        "The controller of the virtual machine has not been set yet."
      );
    }
    return this._vmEngineController;
  }

  /**
   * Sets the associated controller instance
   */
  set vmEngineController(controller: IVmEngineController) {
    this._vmEngineController = controller;
  }

  /**
   * Turns on the machine
   */
  turnOnMachine(): void {
    this.api.turnOnMachine();
  }

  /**
   * Resets the machine
   */
  reset(): void {
    this.api.turnOnMachine();
  }

  /**
   * The default keyboard type
   */
  readonly keyboardType: string = "";

  /**
   * Override this method to represent the appropriate machine state
   */
  abstract createMachineState(): MachineState;

  /**
   * Override this method to obtain machine state
   */
  getMachineState(): MachineState {
    const s = this.createMachineState();
    this.api.getMachineState();

    // --- Get register data from the memory
    let mh = new MemoryHelper(this.api, REG_AREA_INDEX);

    s.bc = mh.readUint16(2);
    s.de = mh.readUint16(4);
    s.hl = mh.readUint16(6);
    s._af_ = mh.readUint16(8);
    s._bc_ = mh.readUint16(10);
    s._de_ = mh.readUint16(12);
    s._hl_ = mh.readUint16(14);
    s.i = mh.readByte(16);
    s.r = mh.readByte(17);
    s.ix = mh.readUint16(22);
    s.iy = mh.readUint16(24);
    s.wz = mh.readUint16(26);

    mh = new MemoryHelper(this.api, STATE_TRANSFER_BUFF);

    s.af = mh.readUint16(0);
    s.pc = mh.readUint16(18);
    s.sp = mh.readUint16(20);

    s.tactsInFrame = mh.readUint32(28);
    s.allowExtendedSet = mh.readBool(32);
    s.tacts = mh.readUint32(33);
    s.stateFlags = mh.readByte(37);
    s.useGateArrayContention = mh.readBool(38);
    s.iff1 = mh.readBool(39);
    s.iff2 = mh.readBool(40);
    s.interruptMode = mh.readByte(41);
    s.isInterruptBlocked = mh.readBool(42);
    s.isInOpExecution = mh.readBool(43);
    s.prefixMode = mh.readByte(44);
    s.indexMode = mh.readByte(45);
    s.maskableInterruptModeEntered = mh.readBool(46);
    s.opCode = mh.readByte(47);

    // --- Get CPU configuration data
    s.baseClockFrequency = mh.readUint32(48);
    s.clockMultiplier = mh.readByte(52);
    s.supportsNextOperations = mh.readBool(53);

    return s;
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
    this.api.resetCpu();
    this.api.setPC(startAddress);
  }

  /**
   * Reads a byte from the memory
   * @param addr Memory address
   */
  abstract readMemory(addr: number): number;

  /**
   * Writes a byte into the memory
   * @param addr Memory address
   * @param value Value to write
   */
  abstract writeMemory(addr: number, value: number): void;
}
