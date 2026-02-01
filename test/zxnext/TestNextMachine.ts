import { MachineModel } from "@common/machines/info-types";
import { FILE_PROVIDER } from "@emu/machines/machine-props";
import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import { DmaState, BusState, TransferMode, AddressMode } from "@emu/machines/zxNext/DmaDevice";
import { FileProvider } from "./FileProvider";

/**
 * Memory operation log entry
 */
export interface MemoryOp {
  address: number;
  value: number;
  isWrite: boolean;
  tstate: number;
}

/**
 * I/O operation log entry
 */
export interface IoOp {
  address: number;
  value: number;
  isWrite: boolean;
  tstate: number;
}

/**
 * DMA transfer operation log entry
 */
export interface DmaTransferOp {
  tstate: number;
  sourceAddress: number;
  destAddress: number;
  value: number;
  byteNumber: number;
}

/**
 * Bus operation log entry
 */
export interface BusOp {
  tstate: number;
  operation: 'REQUEST' | 'ACKNOWLEDGE' | 'RELEASE';
  state: BusState;
}

/**
 * DMA state snapshot
 */
export interface DmaStateSnapshot {
  dmaState: DmaState;
  busState: BusState;
  dmaEnabled: boolean;
  transferMode: TransferMode;
  byteCounter: number;
  sourceAddress: number;
  destAddress: number;
  blockLength: number;
  portAStartAddress: number;
  portBStartAddress: number;
  portAAddressMode: AddressMode;
  portBAddressMode: AddressMode;
  directionAtoB: boolean;
}

export async function createTestNextMachine(modelInfo?: MachineModel): Promise<TestZxNextMachine> {
  const machine = new TestZxNextMachine(modelInfo);
  machine.setMachineProperty(FILE_PROVIDER, new FileProvider());
  await machine.setup();
  return machine;
  
}

// --- ZX Next machine for test purposes
export class TestZxNextMachine extends ZxNextMachine {
  // Logging arrays
  memoryAccessLog: MemoryOp[] = [];
  ioAccessLog: IoOp[] = [];
  dmaTransferLog: DmaTransferOp[] = [];
  dmaStateLog: DmaState[] = [];
  busRequestLog: BusOp[] = [];
  
  // Logging control
  private loggingEnabled = false;
  
  // Memory snapshot before run
  memoryBeforeRun: Map<number, number> = new Map();
  
  // Register snapshots
  registersBeforeRun: any = null;
  dmaStateBeforeRun: DmaStateSnapshot | null = null;

  constructor(modelInfo?: MachineModel) {
    super(modelInfo);
  }

  initCode(code: number[], startAddress = 0x8000): void {
    const memoryDevice = this.memoryDevice;
    for (let i = 0; i < code.length; i++) {
      memoryDevice.writeMemory(startAddress + i, code[i])
    }
  }

  /**
   * Execute a single instruction (one opcode fetch)
   */
  executeOneInstruction(): void {
    const pcBefore = this.pc;
    this.beforeOpcodeFetch();
    this.executeCpuCycle();
    this.afterOpcodeFetch();
    
    // Check if this instruction was RETN by looking at memory at pcBefore
    // RETN is 0xED 0x45
    try {
      const byte1 = this.memoryDevice.readMemory(pcBefore);
      const byte2 = this.memoryDevice.readMemory(pcBefore + 1);
      if (byte1 === 0xED && byte2 === 0x45) {
        // RETN was executed, notify DivMMC
        this.divMmcDevice.handleRetnExecution();
      }
    } catch (e) {
      // Ignore errors
    }
  }

  /**
   * Execute instructions until a RETN is detected
   */
  executeUntilRetn(): void {
    const maxCycles = 10000;
    let cycleCount = 0;
    
    while (cycleCount < maxCycles) {
      this.beforeOpcodeFetch();
      this.executeCpuCycle();
      this.afterOpcodeFetch();
      
      // Check if we just executed a RETN instruction (0xED 0x45)
      // The PC will have moved past the RETN by now
      cycleCount++;
    }
  }

  runCode(startAddress = 0x8000, mode?: "one-instr" | "until-end" | "until-addr", endAddr?: number): void {
    // TODO: Implement this
  }

  /**
   * Run CPU until HALT instruction is reached
   */
  runUntilHalt(maxCycles: number = 100000): void {
    this.pc = this.pc || 0x8000;
    let cycleCount = 0;
    
    while (!this.halted && cycleCount < maxCycles) {
      this.beforeOpcodeFetch();
      this.executeCpuCycle();
      this.afterOpcodeFetch();
      cycleCount++;
    }
  }

  /**
   * Run until DMA completes or max cycles reached.
   * Automatically handles bus arbitration.
   */
  runUntilDmaComplete(maxCycles: number = 100000): void {
    let cycleCount = 0;
    
    // Request and acknowledge bus if DMA is enabled
    if (this.dmaDevice.getRegisters().dmaEnabled) {
      this.dmaDevice.requestBus();
      this.dmaDevice.acknowledgeBus();
    }
    
    while (cycleCount < maxCycles) {
      const dmaState = this.dmaDevice.getDmaState();
      
      // Check if DMA is complete (IDLE or FINISH_DMA state)
      if (dmaState === DmaState.IDLE || dmaState === DmaState.FINISH_DMA) {
        break;
      }
      
      // Execute DMA step
      this.dmaDevice.stepDma();
      
      cycleCount++;
    }
  }

  /**
   * Execute one complete machine cycle (CPU instruction + DMA step)
   */
  executeMachineCycle(): void {
    // Execute DMA step if active
    const tStatesBeforeDma = this.tacts;
    this.beforeInstructionExecuted();
    const dmaTStates = tStatesBeforeDma - this.tacts;
    
    // Execute CPU instruction
    if (!this.halted) {
      this.beforeOpcodeFetch();
      this.executeCpuCycle();
      this.afterOpcodeFetch();
    }
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.memoryAccessLog = [];
    this.ioAccessLog = [];
    this.dmaTransferLog = [];
  }

  /**
   * Take snapshot of memory before test run
   */
  snapshotMemory(addresses: number[]): void {
    this.memoryBeforeRun.clear();
    for (const addr of addresses) {
      this.memoryBeforeRun.set(addr, this.memoryDevice.readMemory(addr));
    }
  }

  /**
   * Assert memory block matches expected values
   */
  assertMemoryBlock(startAddr: number, expectedBytes: number[]): void {
    const actual: number[] = [];
    for (let i = 0; i < expectedBytes.length; i++) {
      actual.push(this.memoryDevice.readMemory(startAddr + i));
    }
    
    for (let i = 0; i < expectedBytes.length; i++) {
      if (actual[i] !== expectedBytes[i]) {
        throw new Error(
          `Memory mismatch at 0x${(startAddr + i).toString(16)}: ` +
          `expected 0x${expectedBytes[i].toString(16)}, ` +
          `got 0x${actual[i].toString(16)}`
        );
      }
    }
  }

  /**
   * Assert DMA performed expected transfer
   */
  assertDmaTransferred(expectedBytes: number): void {
    const dmaState = this.dmaDevice.getTransferState();
    if (dmaState.byteCounter !== expectedBytes) {
      throw new Error(
        `DMA byte counter mismatch: expected ${expectedBytes}, ` +
        `got ${dmaState.byteCounter}`
      );
    }
  }

  /**
   * Get current DMA state for inspection
   */
  getDmaState(): DmaState {
    return this.dmaDevice.getDmaState();
  }

  /**
   * Get DMA byte counter
   */
  getDmaByteCounter(): number {
    return this.dmaDevice.getTransferState().byteCounter;
  }

  /**
   * Get DMA registers snapshot
   */
  getDmaRegisters() {
    return this.dmaDevice.getRegisters();
  }

  /**
   * Get DMA validation result without throwing
   */
  getDmaValidation() {
    return this.dmaDevice.validateRegisterState();
  }

  /**
   * Validate DMA configuration and throw if invalid
   */
  assertDmaConfigurationValid(): void {
    const result = this.dmaDevice.validateRegisterState();
    if (!result.valid) {
      throw new Error(
        `DMA configuration invalid:\n${result.errors.map(e => `  - ${e}`).join('\n')}`
      );
    }
  }
  
  // ===== Phase 1 Enhancements =====
  
  /**
   * Enable/disable logging for memory, I/O, and DMA operations
   */
  enableLogging(enabled: boolean = true): void {
    this.loggingEnabled = enabled;
  }
  
  /**
   * Request and acknowledge bus in one call
   */
  requestAndAcknowledgeBus(): void {
    this.dmaDevice.requestBus();
    this.dmaDevice.acknowledgeBus();
  }
  
  /**
   * Run with automatic bus control handling
   */
  runWithBusControl(action: () => void): void {
    if (this.dmaDevice.getRegisters().dmaEnabled) {
      this.requestAndAcknowledgeBus();
    }
    action();
  }
  
  /**
   * Take snapshot of CPU registers
   */
  snapshotRegisters(): void {
    this.registersBeforeRun = {
      af: this.af,
      bc: this.bc,
      de: this.de,
      hl: this.hl,
      af_: this.af_,
      bc_: this.bc_,
      de_: this.de_,
      hl_: this.hl_,
      ix: this.ix,
      iy: this.iy,
      sp: this.sp,
      pc: this.pc,
      i: this.i,
      r: this.r,
      iff1: this.iff1,
      iff2: this.iff2,
      im: this.im
    };
  }
  
  /**
   * Get current DMA state snapshot
   */
  getDmaStateSnapshot(): DmaStateSnapshot {
    const regs = this.dmaDevice.getRegisters();
    const state = this.dmaDevice.getTransferState();
    
    return {
      dmaState: this.dmaDevice.getDmaState(),
      busState: this.dmaDevice.getBusState(),
      dmaEnabled: regs.dmaEnabled,
      transferMode: regs.transferMode,
      byteCounter: state.byteCounter,
      sourceAddress: state.sourceAddress,
      destAddress: state.destAddress,
      blockLength: regs.blockLength,
      portAStartAddress: regs.portAStartAddress,
      portBStartAddress: regs.portBStartAddress,
      portAAddressMode: regs.portAAddressMode,
      portBAddressMode: regs.portBAddressMode,
      directionAtoB: regs.directionAtoB
    };
  }
  
  /**
   * Take snapshot of DMA state before test run
   */
  snapshotDmaState(): void {
    this.dmaStateBeforeRun = this.getDmaStateSnapshot();
  }
  
  /**
   * Compare two DMA snapshots
   */
  compareDmaSnapshots(before: DmaStateSnapshot, after: DmaStateSnapshot): {
    changed: boolean;
    differences: string[];
  } {
    const differences: string[] = [];
    
    if (before.dmaState !== after.dmaState) {
      differences.push(`dmaState: ${before.dmaState} -> ${after.dmaState}`);
    }
    if (before.busState !== after.busState) {
      differences.push(`busState: ${before.busState} -> ${after.busState}`);
    }
    if (before.dmaEnabled !== after.dmaEnabled) {
      differences.push(`dmaEnabled: ${before.dmaEnabled} -> ${after.dmaEnabled}`);
    }
    if (before.byteCounter !== after.byteCounter) {
      differences.push(`byteCounter: ${before.byteCounter} -> ${after.byteCounter}`);
    }
    if (before.sourceAddress !== after.sourceAddress) {
      differences.push(`sourceAddress: 0x${before.sourceAddress.toString(16)} -> 0x${after.sourceAddress.toString(16)}`);
    }
    if (before.destAddress !== after.destAddress) {
      differences.push(`destAddress: 0x${before.destAddress.toString(16)} -> 0x${after.destAddress.toString(16)}`);
    }
    
    return {
      changed: differences.length > 0,
      differences
    };
  }
  
  /**
   * Helper: Configure DMA for continuous memory-to-memory transfer
   */
  configureContinuousTransfer(sourceAddr: number, destAddr: number, length: number): number[] {
    return [
      // Set up BC = 0x6B (DMA port)
      0x01, 0x6B, 0x00,          // LD BC, 006BH
      
      // WR0: Port A start address and block length
      0x3E, 0x79,                // LD A, 79H (WR0 base)
      0xED, 0x79,                // OUT (C), A
      0x3E, sourceAddr & 0xFF,   // LD A, low byte
      0xED, 0x79,                // OUT (C), A
      0x3E, (sourceAddr >> 8) & 0xFF, // LD A, high byte
      0xED, 0x79,                // OUT (C), A
      0x3E, length & 0xFF,       // LD A, length low
      0xED, 0x79,                // OUT (C), A
      0x3E, (length >> 8) & 0xFF, // LD A, length high
      0xED, 0x79,                // OUT (C), A
      
      // WR1: Port A = Memory, Increment
      0x3E, 0x14,                // LD A, 14H
      0xED, 0x79,                // OUT (C), A
      
      // WR2: Port B = Memory, Increment
      0x3E, 0x10,                // LD A, 10H
      0xED, 0x79,                // OUT (C), A
      
      // WR4: Port B address, Continuous mode
      0x3E, 0xBD,                // LD A, BDH (continuous mode)
      0xED, 0x79,                // OUT (C), A
      0x3E, destAddr & 0xFF,     // LD A, low byte
      0xED, 0x79,                // OUT (C), A
      0x3E, (destAddr >> 8) & 0xFF, // LD A, high byte
      0xED, 0x79,                // OUT (C), A
      
      // WR6: LOAD command
      0x3E, 0xCF,                // LD A, CFH
      0xED, 0x79,                // OUT (C), A
      
      // WR6: ENABLE_DMA command
      0x3E, 0x87,                // LD A, 87H
      0xED, 0x79,                // OUT (C), A
      
      0x76                       // HALT
    ];
  }
  
  /**
   * Helper: Configure DMA for burst mode transfer
   */
  configureBurstTransfer(sourceAddr: number, destAddr: number, length: number, prescalar: number = 0): number[] {
    return [
      // Set up BC = 0x6B (DMA port)
      0x01, 0x6B, 0x00,          // LD BC, 006BH
      
      // WR0: Port A start address and block length
      0x3E, 0x79,                // LD A, 79H (WR0 base)
      0xED, 0x79,                // OUT (C), A
      0x3E, sourceAddr & 0xFF,
      0xED, 0x79,
      0x3E, (sourceAddr >> 8) & 0xFF,
      0xED, 0x79,
      0x3E, length & 0xFF,
      0xED, 0x79,
      0x3E, (length >> 8) & 0xFF,
      0xED, 0x79,
      
      // WR1: Port A = Memory, Increment
      0x3E, 0x14,
      0xED, 0x79,
      
      // WR2: Port B = Memory, Increment, prescalar follows
      0x3E, 0x50,                // D6=1 (prescalar follows)
      0xED, 0x79,
      0x3E, prescalar,           // Prescalar value
      0xED, 0x79,
      
      // WR4: Port B address, Burst mode
      0x3E, 0xAD,                // Burst mode (bit 4 = 0)
      0xED, 0x79,
      0x3E, destAddr & 0xFF,
      0xED, 0x79,
      0x3E, (destAddr >> 8) & 0xFF,
      0xED, 0x79,
      
      // WR6: LOAD + ENABLE_DMA
      0x3E, 0xCF,
      0xED, 0x79,
      0x3E, 0x87,
      0xED, 0x79,
      
      0x76
    ];
  }
}
