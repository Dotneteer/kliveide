import { MachineApi } from "./wa-api";
import { MachineState } from "@shared/machines/machine-state";
import { MemoryHelper } from "./memory-helpers";
import {
  BREAKPOINTS_MAP,
  BRP_PARTITION_MAP,
  CPU_STATE_BUFFER,
  EXEC_ENGINE_STATE_BUFFER,
  REG_AREA_INDEX,
} from "./memory-map";
import { IVmEngineController } from "./IVmEngineController";
import { BreakpointDefinition } from "@shared/machines/api-data";
import { KeyMapping } from "./keyboard";

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
   * Gets the key mapping used by the machine
   */
  abstract getKeyMapping(): KeyMapping;

  /**
   * Resolves a string key code to a key number
   * @param code Key code to resolve
   */
  abstract resolveKeyCode(code: string): number | null;

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
   * Get the list of machine features supported
   */
  getExtraMachineFeatures(): ExtraMachineFeatures[] {
    return [];
  }

  /**
   * Executes a machine specific command. Override in a machine to
   * respond to those commands
   * @param _command Command to execute
   * @param _controller Machine controller
   */
  async executeMachineCommand(_command: string, _controller: IVmEngineController): Promise<void> {
  }

  /**
   * Turns on the machine
   */
  turnOnMachine(): void {
    this.api.setupMachine();
  }

  /**
   * Resets the machine
   */
  reset(): void {
    this.api.setupMachine();
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

    // --- Obtain the CPU state
    this.api.getCpuState();

    // --- Get register data from the memory
    let mh = new MemoryHelper(this.api, REG_AREA_INDEX);
    s.af = mh.readUint16(0);
    s.bc = mh.readUint16(2);
    s.de = mh.readUint16(4);
    s.hl = mh.readUint16(6);
    s._af_ = mh.readUint16(8);
    s._bc_ = mh.readUint16(10);
    s._de_ = mh.readUint16(12);
    s._hl_ = mh.readUint16(14);
    s.pc = mh.readUint16(16);
    s.sp = mh.readUint16(18);
    s.i = mh.readByte(20);
    s.r = mh.readByte(21);
    s.ix = mh.readUint16(22);
    s.iy = mh.readUint16(24);
    s.wz = mh.readUint16(26);

    // --- Get CPU state from memory
    mh = new MemoryHelper(this.api, CPU_STATE_BUFFER);
    s.tactsInFrame = mh.readUint32(0);
    s.tacts = mh.readUint32(4);
    s.iff1 = mh.readBool(8);
    s.iff2 = mh.readBool(9);
    s.interruptMode = mh.readByte(10);
    s.opCode = mh.readByte(11);
    s.ddfdDepth = mh.readUint32(12);
    s.useIx = mh.readBool(16);
    s.cpuSignalFlags = mh.readUint32(17);
    s.cpuSnoozed = mh.readBool(21);
    s.intBacklog = mh.readUint32(22);
    s.retExecuted = mh.readBool(26);
    s.baseClockFrequency = mh.readUint32(27);
    s.clockMultiplier = mh.readUint32(31);
    s.defaultClockMultiplier = mh.readUint32(35);

    // --- Get execution engine state
    this.api.getExecutionEngineState();
    mh = new MemoryHelper(this.api, EXEC_ENGINE_STATE_BUFFER);
    s.frameCount = mh.readUint32(0);
    s.frameCompleted = mh.readBool(4);
    s.lastRenderedFrameTact = mh.readUint32(5)
    s.executionCompletionReason = mh.readUint32(9);

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
    this.api.resetCpu(true);
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

/**
 * Extra machine features supported by only a few machines
 */
export type ExtraMachineFeatures = "UlaDebug" | "Tape" | "Sound" ;