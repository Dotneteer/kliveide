import { MachineApi } from "./wa-api";
import { MachineState } from "../../shared/machines/machine-state";
import { MemoryHelper } from "./memory-helpers";
import {
  BREAKPOINTS_MAP,
  BRP_PARTITION_MAP,
  REG_AREA_INDEX,
  STATE_TRANSFER_BUFF,
} from "./memory-map";
import { IVmEngineController } from "./IVmEngineController";
import { BreakpointDefinition } from "../../shared/machines/api-data";

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
    this.api.resetMachine();
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
   * CPU hook. Invoked when the CPU fetches an operation code
   * @param _opCode The fetched operation code
   * @param _pcAfter The value of PC after the fetch operation
   */
  opCodeFetched(_opCode: number, _pcAfter: number): void {}

  /**
   * CPU hook. Invoked when the CPU has completed a standard instruction
   * @param _opCode The fetched operation code
   * @param _pcAfter The value of PC after the operation
   */
  standardOpExecuted(_opCode: number, _pcAfter: number): void {}

  /**
   * CPU hook. Invoked when the CPU has completed an extended instruction
   * @param _opCode The fetched operation code
   * @param _pcAfter The value of PC after the operation
   */
  extendedOpExecuted(_opCode: number, _pcAfter: number): void {}

  /**
   * CPU hook. Invoked when the CPU has completed an indexed instruction
   * @param _opCode The fetched operation code
   * @param _indexMode The index mode: IX=0, IY=1
   * @param _pcAfter The value of PC after the operation
   */
  indexedOpExecuted(
    _opCode: number,
    _indexMode: number,
    _pcAfter: number
  ): void {}

  /**
   * CPU hook. Invoked when the CPU has completed a bit instruction
   * @param _opCode The fetched operation code
   * @param _pcAfter The value of PC after the operation
   */
  bitOpExecuted(_opCode: number, _pcAfter: number): void {}

  /**
   * CPU hook. Invoked when the CPU has completed an IX-indexed bit
   * instruction
   * @param _opCode The fetched operation code
   * @param _indexMode The index mode: IX=0, IY=1
   * @param _pcAfter The value of PC after the operation
   */
  indexedBitOpExecuted(
    _opCode: number,
    _indexMode: number,
    _pcAfter: number
  ): void {}

  /**
   * CPU hook. Invoked when a maskable interrupt is about to be executed
   * @param _pcInt The value of PC that points to the beginning of the
   * interrupt routine
   */
  intExecuted(_pcInt: number): void {}

  /**
   * CPU hook. Invoked when a non-maskable interrupt is about to be executed
   * interrupt routine
   */
  nmiExecuted(): void {}

  /**
   * CPU hook. Invoked when the CPU has been halted.
   * @param _pcHalt The value of PC that points to the HALT statement
   * interrupt routine
   */
  halted(_pcHalt: number): void {}

  /**
   * CPU hook. Invoked when the CPU reads memory while processing a statement
   * @param _address The memory address read
   * @param _value The memory value read
   */
  memoryRead(_address: number, _value: number): void {}

  /**
   * CPU hook. Invoked when the CPU writes memory while processing a statement
   * @param _address The memory address read
   * @param _value The memory value read
   */
  memoryWritten(_address: number, _value: number): void {}

  /**
   * CPU hook. Invoked when the CPU reads from an I/O port
   * @param _address The memory address read
   * @param _value The memory value read
   */
  ioRead(_address: number, _value: number): void {}

  /**
   * CPU hook. Invoked when the CPU writes to an I/O port
   * @param _address The memory address read
   * @param _value The memory value read
   */
  ioWritten(_address: number, _value: number): void {}

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
    s.tacts = mh.readUint32(32);
    s.stateFlags = mh.readByte(36);
    s.useGateArrayContention = mh.readBool(37);
    s.iff1 = mh.readBool(38);
    s.iff2 = mh.readBool(39);
    s.interruptMode = mh.readByte(40);
    s.isInterruptBlocked = mh.readBool(41);
    s.isInOpExecution = mh.readBool(42);
    s.prefixMode = mh.readByte(43);
    s.indexMode = mh.readByte(44);
    s.maskableInterruptModeEntered = mh.readBool(45);
    s.opCode = mh.readByte(46);

    // --- Get CPU configuration data
    s.baseClockFrequency = mh.readUint32(47);
    s.clockMultiplier = mh.readByte(51);
    s.cpuDiagnostics = mh.readUint16(52);

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
   * Set the breakpoint definitions in the WA virtual machine
   * @param bps Breakpoint definitions
   */
  setupBreakpoints(bps: BreakpointDefinition[]): void {
    const mapMh = new MemoryHelper(this.api, BREAKPOINTS_MAP);
    const partMh = new MemoryHelper(this.api, BRP_PARTITION_MAP);

    // --- Erase the breakpoint maps
    for (let i = 0; i < 0x1_0000; i++) {
      mapMh.writeByte(i, 0);
      partMh.writeUint16(i * 2, 0xffff);
    }

    // --- Set up breakpoints
    bps.forEach((bp) => {
      bp.address = bp.address & 0xffff;
      switch (bp.mode) {
        case "mr":
        case "mw":
        case "ir":
        case "iw":
          // TODO: Implement these breakpoint types
          break;
        default: {
          let flags = mapMh.readByte(bp.address & 0xffff);
          if (bp.partition !== undefined) {
            flags |= 0x02;
            partMh.writeUint16(bp.address * 2, bp.partition & 0xffff);
          } else {
            flags |= 0x01;
          }
          mapMh.writeByte(bp.address, flags);
          break;
        }
      }
    });
  }

  /**
   * Updates the breakpoint definitions in the WA virtual machine
   * @param bps Breakpoint definitions
   */
  updateBreakpoints(bps: BreakpointDefinition[]): void {
    this.setupBreakpoints(bps);
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
