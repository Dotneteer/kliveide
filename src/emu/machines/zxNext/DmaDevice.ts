import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * DMA state machine states
 */
export const enum DmaState {
  IDLE = 0,
  START_DMA = 1,
  WAITING_ACK = 2,
  TRANSFERRING_READ_1 = 3,
  TRANSFERRING_READ_2 = 4,
  TRANSFERRING_READ_3 = 5,
  TRANSFERRING_READ_4 = 6,
  TRANSFERRING_WRITE_1 = 7,
  TRANSFERRING_WRITE_2 = 8,
  TRANSFERRING_WRITE_3 = 9,
  TRANSFERRING_WRITE_4 = 10,
  WAITING_CYCLES = 11,
  FINISH_DMA = 12
}

/**
 * Register write sequence states - tracks which parameter bytes are expected
 */
export const enum RegisterWriteSequence {
  IDLE = 0,
  R0_BYTE_0 = 1,
  R0_BYTE_1 = 2,
  R0_BYTE_2 = 3,
  R0_BYTE_3 = 4,
  R1_BYTE_0 = 5,
  R1_BYTE_1 = 6,
  R2_BYTE_0 = 7,
  R2_BYTE_1 = 8,
  R3_BYTE_0 = 9,
  R3_BYTE_1 = 10,
  R4_BYTE_0 = 11,
  R4_BYTE_1 = 12,
  R4_BYTE_2 = 13,
  R4_BYTE_3 = 14,
  R4_BYTE_4 = 15,
  R6_BYTE_0 = 16
}

/**
 * Register read sequence states - tracks which register to read next
 */
export const enum RegisterReadSequence {
  RD_STATUS = 0,
  RD_COUNTER_LO = 1,
  RD_COUNTER_HI = 2,
  RD_PORT_A_LO = 3,
  RD_PORT_A_HI = 4,
  RD_PORT_B_LO = 5,
  RD_PORT_B_HI = 6
}

/**
 * Address modes for ports A and B
 */
export const enum AddressMode {
  DECREMENT = 0,
  INCREMENT = 1,
  FIXED = 2
}

/**
 * Transfer modes
 */
export const enum TransferMode {
  CONTINUOUS = 1,
  BURST = 2
}

/**
 * Timing cycle lengths (in T-states)
 */
export const enum CycleLength {
  CYCLES_4 = 0,
  CYCLES_3 = 1,
  CYCLES_2 = 2
}

/**
 * DMA Mode - determines port and length behavior
 */
export const enum DmaMode {
  ZXNDMA = 0,  // Port 0x6B - exact length
  LEGACY = 1   // Port 0x0B - length+1 for compatibility
}

/**
 * Internal register storage for WR0-WR6
 */
interface RegisterState {
  // WR0 - Port A and block configuration
  directionAtoB: boolean;  // true = A->B, false = B->A
  portAStartAddress: number;  // 16-bit starting address
  blockLength: number;  // 16-bit transfer length

  // WR1 - Port A configuration
  portAIsIO: boolean;  // true = I/O, false = Memory
  portAAddressMode: AddressMode;
  portATimingCycleLength: CycleLength;

  // WR2 - Port B configuration
  portBIsIO: boolean;  // true = I/O, false = Memory
  portBAddressMode: AddressMode;
  portBTimingCycleLength: CycleLength;
  portBPrescalar: number;  // 8-bit prescalar value for fixed-rate transfers

  // WR3 - Activation (legacy, prefer WR6)
  dmaEnabled: boolean;

  // WR4 - Port B address and mode
  transferMode: TransferMode;  // Continuous or Burst
  portBStartAddress: number;  // 16-bit starting address

  // WR5 - Control
  ceWaitMultiplexed: boolean;  // CE/WAIT vs CE only
  autoRestart: boolean;  // Auto-restart on end of block

  // WR6 - Command-related
  readMask: number;  // 8-bit mask for read sequencing
}

/**
 * Internal transfer state - current addresses and counters
 */
interface TransferState {
  sourceAddress: number;  // 16-bit current source pointer
  destAddress: number;  // 16-bit current destination pointer
  byteCounter: number;  // 16-bit bytes transferred so far
}

/**
 * Status flags
 */
interface StatusFlags {
  atLeastOneByteTransferred: boolean;  // T bit - set after first byte
  endOfBlockReached: boolean;  // E bit - cleared when transfer completes
}

export class DmaDevice implements IGenericDevice<IZxNextMachine> {
  private registers: RegisterState;
  private transferState: TransferState;
  private statusFlags: StatusFlags;

  private dmaState: DmaState = DmaState.IDLE;
  private registerWriteSeq: RegisterWriteSequence = RegisterWriteSequence.IDLE;
  private registerReadSeq: RegisterReadSequence = RegisterReadSequence.RD_STATUS;
  private _tempRegisterByte: number = 0;  // Stores first byte of WR0-WR6 for parameter parsing

  private dmaMode: DmaMode = DmaMode.ZXNDMA;
  private prescalarTimer: number = 0;  // Timer for fixed-rate transfers

  constructor(public readonly machine: IZxNextMachine) {
    this.registers = this.initializeRegisters();
    this.transferState = this.initializeTransferState();
    this.statusFlags = this.initializeStatusFlags();
    this.reset();
  }

  private initializeRegisters(): RegisterState {
    return {
      directionAtoB: true,
      portAStartAddress: 0,
      blockLength: 0,
      portAIsIO: false,
      portAAddressMode: AddressMode.INCREMENT,
      portATimingCycleLength: CycleLength.CYCLES_3,
      portBIsIO: false,
      portBAddressMode: AddressMode.INCREMENT,
      portBTimingCycleLength: CycleLength.CYCLES_3,
      portBPrescalar: 0,
      dmaEnabled: false,
      transferMode: TransferMode.CONTINUOUS,
      portBStartAddress: 0,
      ceWaitMultiplexed: false,
      autoRestart: false,
      readMask: 0x7f
    };
  }

  private initializeTransferState(): TransferState {
    return {
      sourceAddress: 0,
      destAddress: 0,
      byteCounter: 0
    };
  }

  private initializeStatusFlags(): StatusFlags {
    return {
      atLeastOneByteTransferred: false,
      endOfBlockReached: true  // Initially true (not reached)
    };
  }

  reset(): void {
    this.registers = this.initializeRegisters();
    this.transferState = this.initializeTransferState();
    this.statusFlags = this.initializeStatusFlags();
    this.dmaState = DmaState.IDLE;
    this.registerWriteSeq = RegisterWriteSequence.IDLE;
    this.registerReadSeq = RegisterReadSequence.RD_STATUS;
    this._tempRegisterByte = 0;
    this.prescalarTimer = 0;
    this.dmaMode = DmaMode.ZXNDMA;
  }

  // Getters for current state (for testing and debugging)
  getDmaState(): DmaState {
    return this.dmaState;
  }

  getRegisterWriteSeq(): RegisterWriteSequence {
    return this.registerWriteSeq;
  }

  getRegisterReadSeq(): RegisterReadSequence {
    return this.registerReadSeq;
  }

  getRegisters(): Readonly<RegisterState> {
    return { ...this.registers };
  }

  getTransferState(): Readonly<TransferState> {
    return { ...this.transferState };
  }

  getStatusFlags(): Readonly<StatusFlags> {
    return { ...this.statusFlags };
  }

  getDmaMode(): DmaMode {
    return this.dmaMode;
  }

  setDmaMode(mode: DmaMode): void {
    this.dmaMode = mode;
  }

  getPrescalarTimer(): number {
    return this.prescalarTimer;
  }

  // Internal helper - used by parameter parsing in future steps
  getTempRegisterByte(): number {
    return this._tempRegisterByte;
  }

  setTempRegisterByte(value: number): void {
    this._tempRegisterByte = value;
  }

  /**
   * Write to WR0 register
   * Base byte: D7=0, D6=direction, D5-D0=parameters
   * Parameters: Port A start address (16-bit), block length (16-bit)
   */
  writeWR0(value: number): void {
    // Extract direction bit (D6)
    const direction = (value & 0x40) !== 0;
    
    if (this.registerWriteSeq === RegisterWriteSequence.IDLE) {
      // First write - store base byte and transition to R0_BYTE_0
      this._tempRegisterByte = value;
      this.registers.directionAtoB = direction;
      this.registerWriteSeq = RegisterWriteSequence.R0_BYTE_0;
    } else if (this.registerWriteSeq === RegisterWriteSequence.R0_BYTE_0) {
      // Port A start address - low byte
      this.registers.portAStartAddress = (this.registers.portAStartAddress & 0xff00) | value;
      this.registerWriteSeq = RegisterWriteSequence.R0_BYTE_1;
    } else if (this.registerWriteSeq === RegisterWriteSequence.R0_BYTE_1) {
      // Port A start address - high byte
      this.registers.portAStartAddress = (this.registers.portAStartAddress & 0x00ff) | (value << 8);
      this.registerWriteSeq = RegisterWriteSequence.R0_BYTE_2;
    } else if (this.registerWriteSeq === RegisterWriteSequence.R0_BYTE_2) {
      // Block length - low byte
      this.registers.blockLength = (this.registers.blockLength & 0xff00) | value;
      this.registerWriteSeq = RegisterWriteSequence.R0_BYTE_3;
    } else if (this.registerWriteSeq === RegisterWriteSequence.R0_BYTE_3) {
      // Block length - high byte (final parameter)
      this.registers.blockLength = (this.registers.blockLength & 0x00ff) | (value << 8);
      this.registerWriteSeq = RegisterWriteSequence.IDLE;
    }
  }

  /**
   * Write to WR1 register
   * Base byte: D7=0, D6=timing parameter follows, D5-D4=address mode, D3=I/O flag, D2-D0=register identifier (100)
   * Optional: Timing byte for cycle length configuration
   */
  writeWR1(value: number): void {
    if (this.registerWriteSeq === RegisterWriteSequence.IDLE) {
      // First write - store base byte and extract Port A configuration
      this._tempRegisterByte = value;
      
      // D3: Port A type (1=I/O, 0=Memory)
      this.registers.portAIsIO = (value & 0x08) !== 0;
      
      // D5-D4: Address mode (0=Decrement, 1=Increment, 2/3=Fixed)
      const addressModeValue = (value >> 4) & 0x03;
      this.registers.portAAddressMode = addressModeValue as AddressMode;
      
      // D6: Check if timing byte follows
      if ((value & 0x40) === 0) {
        // No timing byte follows - return to IDLE
        this.registerWriteSeq = RegisterWriteSequence.IDLE;
      } else {
        // Timing byte follows
        this.registerWriteSeq = RegisterWriteSequence.R1_BYTE_0;
      }
    } else if (this.registerWriteSeq === RegisterWriteSequence.R1_BYTE_0) {
      // Optional timing byte - for future timing parameter expansion
      // For now, just complete the sequence
      this.registerWriteSeq = RegisterWriteSequence.IDLE;
    }
  }

  /**
   * Write to WR2 register
   * Base byte: D7=0, D6=timing parameter follows, D5-D4=address mode, D3=I/O flag, D2-D0=register identifier (000)
   * Parameters: Timing byte, prescalar byte
   */
  writeWR2(value: number): void {
    if (this.registerWriteSeq === RegisterWriteSequence.IDLE) {
      // First write - store base byte and extract Port B configuration
      this._tempRegisterByte = value;
      
      // D3: Port B type (1=I/O, 0=Memory)
      this.registers.portBIsIO = (value & 0x08) !== 0;
      
      // D5-D4: Address mode (0=Decrement, 1=Increment, 2/3=Fixed)
      const addressModeValue = (value >> 4) & 0x03;
      this.registers.portBAddressMode = addressModeValue as AddressMode;
      
      // D6: Check if timing byte follows
      if ((value & 0x40) === 0) {
        // No timing byte follows - return to IDLE
        this.registerWriteSeq = RegisterWriteSequence.IDLE;
      } else {
        // Timing byte follows
        this.registerWriteSeq = RegisterWriteSequence.R2_BYTE_0;
      }
    } else if (this.registerWriteSeq === RegisterWriteSequence.R2_BYTE_0) {
      // Timing byte - for future timing parameter expansion
      // For now, just store and move to next byte
      this.registerWriteSeq = RegisterWriteSequence.R2_BYTE_1;
    } else if (this.registerWriteSeq === RegisterWriteSequence.R2_BYTE_1) {
      // Prescalar byte (8-bit value for fixed-rate transfers)
      this.registers.portBPrescalar = value & 0xff;
      this.registerWriteSeq = RegisterWriteSequence.IDLE;
    }
  }

  /**
   * Write to WR3 register
   * Base byte: D7=0, D0=dmaEnabled
   * Note: Prefer WR6 for DMA control in modern implementations
   */
  writeWR3(value: number): void {
    if (this.registerWriteSeq === RegisterWriteSequence.IDLE) {
      // D0: DMA enable flag
      this.registers.dmaEnabled = (value & 0x01) !== 0;
      this.registerWriteSeq = RegisterWriteSequence.IDLE;
    }
  }

  /**
   * Write to WR4 register
   * Base byte: D7=0, D4=transferMode, D3-D0=parameters
   * Parameters: Port B start address (16-bit)
   */
  writeWR4(value: number): void {
    if (this.registerWriteSeq === RegisterWriteSequence.IDLE) {
      // First write - store base byte and extract transfer mode
      this._tempRegisterByte = value;
      
      // D4: Transfer mode (1=Continuous, 2=Burst)
      const modeValue = (value >> 4) & 0x01;
      this.registers.transferMode = modeValue === 0 ? TransferMode.BURST : TransferMode.CONTINUOUS;
      
      this.registerWriteSeq = RegisterWriteSequence.R4_BYTE_0;
    } else if (this.registerWriteSeq === RegisterWriteSequence.R4_BYTE_0) {
      // Port B start address - low byte
      this.registers.portBStartAddress = (this.registers.portBStartAddress & 0xff00) | value;
      this.registerWriteSeq = RegisterWriteSequence.R4_BYTE_1;
    } else if (this.registerWriteSeq === RegisterWriteSequence.R4_BYTE_1) {
      // Port B start address - high byte (final parameter)
      this.registers.portBStartAddress = (this.registers.portBStartAddress & 0x00ff) | (value << 8);
      this.registerWriteSeq = RegisterWriteSequence.IDLE;
    }
  }

  /**
   * Write to WR5 register
   * Base byte: D7=0, D5=autoRestart, D4=ceWaitMultiplexed
   */
  writeWR5(value: number): void {
    if (this.registerWriteSeq === RegisterWriteSequence.IDLE) {
      // D5: Auto-restart flag
      this.registers.autoRestart = (value & 0x20) !== 0;
      
      // D4: CE/WAIT multiplexed flag
      this.registers.ceWaitMultiplexed = (value & 0x10) !== 0;
      
      this.registerWriteSeq = RegisterWriteSequence.IDLE;
    }
  }

  /**
   * Write to WR6 register - Command register
   * Implements command bytes for DMA control
   */
  writeWR6(value: number): void {
    if (this.registerWriteSeq === RegisterWriteSequence.IDLE) {
      this._tempRegisterByte = value;
      
      // Parse command byte
      switch (value) {
        case 0xc3: // RESET
          this.executeReset();
          break;
          
        case 0xc7: // RESET_PORT_A_TIMING
          this.executeResetPortATiming();
          break;
          
        case 0xcb: // RESET_PORT_B_TIMING
          this.executeResetPortBTiming();
          break;
          
        case 0x83: // DISABLE_DMA
          this.executeDisableDma();
          break;
          
        case 0xbb: // READ_MASK_FOLLOWS
          // Next byte will be the read mask
          this.registerWriteSeq = RegisterWriteSequence.R6_BYTE_0;
          break;
          
        default:
          // Unknown command - ignore
          break;
      }
    } else if (this.registerWriteSeq === RegisterWriteSequence.R6_BYTE_0) {
      // Read mask byte follows READ_MASK_FOLLOWS command
      this.registers.readMask = value & 0x7f;
      this.registerWriteSeq = RegisterWriteSequence.IDLE;
    }
  }

  /**
   * RESET command (0xC3) - Reset all DMA state
   */
  private executeReset(): void {
    // Reset DMA state
    this.dmaState = DmaState.IDLE;
    
    // Reset status flags
    this.statusFlags.endOfBlockReached = true;
    this.statusFlags.atLeastOneByteTransferred = false;
    
    // Reset timing to default (3 cycles)
    this.registers.portATimingCycleLength = CycleLength.CYCLES_3;
    this.registers.portBTimingCycleLength = CycleLength.CYCLES_3;
    
    // Reset prescalar
    this.registers.portBPrescalar = 0;
    this.prescalarTimer = 0;
    
    // Reset control flags
    this.registers.ceWaitMultiplexed = false;
    this.registers.autoRestart = false;
    
    // Keep register write sequence in IDLE
    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }

  /**
   * RESET_PORT_A_TIMING command (0xC7) - Reset Port A timing to default
   */
  private executeResetPortATiming(): void {
    this.registers.portATimingCycleLength = CycleLength.CYCLES_3;
    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }

  /**
   * RESET_PORT_B_TIMING command (0xCB) - Reset Port B timing to default
   */
  private executeResetPortBTiming(): void {
    this.registers.portBTimingCycleLength = CycleLength.CYCLES_3;
    this.registers.portBPrescalar = 0;
    this.prescalarTimer = 0;
    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }

  /**
   * DISABLE_DMA command (0x83) - Stop DMA transfer
   */
  private executeDisableDma(): void {
    this.dmaState = DmaState.IDLE;
    this.registers.dmaEnabled = false;
    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }
}