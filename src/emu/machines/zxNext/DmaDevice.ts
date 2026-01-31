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

/**
 * Bus control state for CPU/DMA arbitration
 */
interface BusControlState {
  busRequested: boolean;      // BUSREQ signal asserted
  busAcknowledged: boolean;   // BUSAK signal received
  busDelayed: boolean;        // dma_delay signal active
}

export class DmaDevice implements IGenericDevice<IZxNextMachine> {
  private registers: RegisterState;
  private transferState: TransferState;
  private statusFlags: StatusFlags;
  private busControl: BusControlState;

  private dmaState: DmaState = DmaState.IDLE;
  private registerWriteSeq: RegisterWriteSequence = RegisterWriteSequence.IDLE;
  private registerReadSeq: RegisterReadSequence = RegisterReadSequence.RD_STATUS;
  private _tempRegisterByte: number = 0;  // Stores first byte of WR0-WR6 for parameter parsing
  private _transferDataByte: number = 0;  // Stores data byte during read-write cycle

  private dmaMode: DmaMode = DmaMode.ZXNDMA;
  private prescalarTimer: number = 0;  // Timer for fixed-rate transfers

  constructor(public readonly machine: IZxNextMachine) {
    this.registers = this.initializeRegisters();
    this.transferState = this.initializeTransferState();
    this.statusFlags = this.initializeStatusFlags();
    this.busControl = this.initializeBusControl();
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

  private initializeBusControl(): BusControlState {
    return {
      busRequested: false,
      busAcknowledged: false,
      busDelayed: false
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
          
        case 0xcf: // LOAD
          this.executeLoad();
          break;
          
        case 0xd3: // CONTINUE
          this.executeContinue();
          break;
          
        case 0x87: // ENABLE_DMA
          this.executeEnableDma();
          break;
          
        case 0xbf: // READ_STATUS_BYTE
          this.executeReadStatusByte();
          break;
          
        case 0xa7: // INITIALIZE_READ_SEQUENCE
          this.executeInitializeReadSequence();
          break;
          
        case 0x8b: // REINITIALIZE_STATUS_BYTE
          this.executeReinitializeStatusByte();
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

  /**
   * LOAD command (0xCF) - Load addresses from registers to transfer state
   * Direction determines which address goes to source/destination
   */
  private executeLoad(): void {
    if (this.registers.directionAtoB) {
      // A → B: Port A is source, Port B is destination
      this.transferState.sourceAddress = this.registers.portAStartAddress;
      this.transferState.destAddress = this.registers.portBStartAddress;
    } else {
      // B → A: Port B is source, Port A is destination
      this.transferState.sourceAddress = this.registers.portBStartAddress;
      this.transferState.destAddress = this.registers.portAStartAddress;
    }
    
    // Reset byte counter
    this.transferState.byteCounter = 0;
    
    // Keep register write sequence in IDLE
    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }

  /**
   * CONTINUE command (0xD3) - Reset counter but keep current addresses
   * Used to continue a transfer from current positions
   */
  private executeContinue(): void {
    // Reset byte counter to restart counting
    this.transferState.byteCounter = 0;
    
    // Keep current source and destination addresses unchanged
    // Keep register write sequence in IDLE
    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }

  /**
   * ENABLE_DMA command (0x87) - Start DMA transfer
   * Initializes counter based on mode: 0 for zxnDMA, -1 for legacy
   */
  private executeEnableDma(): void {
    // Enable DMA
    this.registers.dmaEnabled = true;
    
    // Initialize byte counter based on mode
    // zxnDMA mode: counter starts at 0
    // Legacy mode: counter starts at -1 (0xFFFF) for compatibility
    if (this.dmaMode === DmaMode.ZXNDMA) {
      this.transferState.byteCounter = 0;
    } else {
      this.transferState.byteCounter = 0xFFFF;  // -1 in 16-bit
    }
    
    // Set DMA state to ready for transfer
    // (actual transfer will start when bus is available)
    this.dmaState = DmaState.IDLE;  // Will transition to TRANSFERRING in future steps
    
    // Keep register write sequence in IDLE
    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }

  /**
   * READ_STATUS_BYTE command (0xBF) - Prepare to read status
   * Status format: 00E1101T
   * - E (bit 5): End of block (inverted - 1=not reached, 0=reached)
   * - T (bit 0): At least one byte transferred
   */
  private executeReadStatusByte(): void {
    // Set read sequence to return status byte on next read
    this.registerReadSeq = RegisterReadSequence.RD_STATUS;
    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }

  /**
   * INITIALIZE_READ_SEQUENCE command (0xA7) - Start read sequence
   * Uses read mask to determine which registers to include in read sequence
   */
  private executeInitializeReadSequence(): void {
    // Initialize read sequence to first position
    this.registerReadSeq = RegisterReadSequence.RD_STATUS;
    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }

  /**
   * REINITIALIZE_STATUS_BYTE command (0x8B) - Reset status and read sequence
   * Resets status flags and reinitializes the read sequence
   */
  private executeReinitializeStatusByte(): void {
    // Reset status flags
    this.statusFlags.endOfBlockReached = true;
    this.statusFlags.atLeastOneByteTransferred = false;
    
    // Reinitialize read sequence to status byte
    this.registerReadSeq = RegisterReadSequence.RD_STATUS;
    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }

  /**
   * Read the next byte in the register read sequence
   * Called when DMA port is read after a read command
   * Status format: 00E1101T where E=end of block (inverted), T=at least one byte
   */
  readStatusByte(): number {
    let value = 0;
    
    if (this.registerReadSeq === RegisterReadSequence.RD_STATUS) {
      // Format: 00E1101T
      // Bit 5 (E): End of block reached (inverted - 1 means not reached)
      const eBit = this.statusFlags.endOfBlockReached ? 0 : (1 << 5);
      
      // Bit 0 (T): At least one byte transferred
      const tBit = this.statusFlags.atLeastOneByteTransferred ? 1 : 0;
      
      // Fixed bits: bits 4-1 = 1101 (0x1A in positions 4-1)
      value = eBit | 0x1a | tBit;
      
      // Advance to next read position based on read mask
      this.advanceReadSequence();
    } else if (this.registerReadSeq === RegisterReadSequence.RD_COUNTER_LO) {
      // Counter low byte
      value = this.transferState.byteCounter & 0xff;
      this.advanceReadSequence();
    } else if (this.registerReadSeq === RegisterReadSequence.RD_COUNTER_HI) {
      // Counter high byte
      value = (this.transferState.byteCounter >> 8) & 0xff;
      this.advanceReadSequence();
    } else if (this.registerReadSeq === RegisterReadSequence.RD_PORT_A_LO) {
      // Port A address low byte
      value = this.transferState.sourceAddress & 0xff;
      this.advanceReadSequence();
    } else if (this.registerReadSeq === RegisterReadSequence.RD_PORT_A_HI) {
      // Port A address high byte
      value = (this.transferState.sourceAddress >> 8) & 0xff;
      this.advanceReadSequence();
    } else if (this.registerReadSeq === RegisterReadSequence.RD_PORT_B_LO) {
      // Port B address low byte
      value = this.transferState.destAddress & 0xff;
      this.advanceReadSequence();
    } else if (this.registerReadSeq === RegisterReadSequence.RD_PORT_B_HI) {
      // Port B address high byte
      value = (this.transferState.destAddress >> 8) & 0xff;
      this.advanceReadSequence();
    }
    
    return value;
  }

  /**
   * Advance read sequence to next position based on read mask
   */
  private advanceReadSequence(): void {
    const mask = this.registers.readMask;
    let nextSeq = (this.registerReadSeq + 1) % 7;
    
    // Skip positions not enabled by mask
    while (nextSeq !== RegisterReadSequence.RD_STATUS && !this.isReadPositionEnabled(nextSeq, mask)) {
      nextSeq = (nextSeq + 1) % 7;
    }
    
    this.registerReadSeq = nextSeq as RegisterReadSequence;
  }

  /**
   * Check if a read position is enabled by the read mask
   */
  private isReadPositionEnabled(position: RegisterReadSequence, mask: number): boolean {
    // Read mask bits:
    // Bit 6: Counter low
    // Bit 5: Counter high
    // Bit 4: Port A address low
    // Bit 3: Port A address high
    // Bit 2: Port B address low
    // Bit 1: Port B address high
    // Bit 0: (unused/reserved)
    
    switch (position) {
      case RegisterReadSequence.RD_STATUS:
        return true; // Status is always included
      case RegisterReadSequence.RD_COUNTER_LO:
        return (mask & 0x40) !== 0;
      case RegisterReadSequence.RD_COUNTER_HI:
        return (mask & 0x20) !== 0;
      case RegisterReadSequence.RD_PORT_A_LO:
        return (mask & 0x10) !== 0;
      case RegisterReadSequence.RD_PORT_A_HI:
        return (mask & 0x08) !== 0;
      case RegisterReadSequence.RD_PORT_B_LO:
        return (mask & 0x04) !== 0;
      case RegisterReadSequence.RD_PORT_B_HI:
        return (mask & 0x02) !== 0;
      default:
        return false;
    }
  }

  /**
   * Get bus control state
   */
  getBusControl(): BusControlState {
    return this.busControl;
  }

  /**
   * Request bus access from CPU
   * Asserts BUSREQ signal
   */
  requestBus(): void {
    if (!this.busControl.busRequested) {
      this.busControl.busRequested = true;
      this.busControl.busAcknowledged = false;
    }
  }

  /**
   * Acknowledge bus grant from CPU
   * Called when BUSAK signal is received
   */
  acknowledgeBus(): void {
    if (this.busControl.busRequested) {
      this.busControl.busAcknowledged = true;
    }
  }

  /**
   * Release bus back to CPU
   * Clears BUSREQ signal
   */
  releaseBus(): void {
    this.busControl.busRequested = false;
    this.busControl.busAcknowledged = false;
  }

  /**
   * Check if bus is available for DMA transfer
   * Returns true if BUSREQ was acknowledged and not delayed
   */
  isBusAvailable(): boolean {
    return this.busControl.busRequested &&
           this.busControl.busAcknowledged &&
           !this.busControl.busDelayed;
  }

  /**
   * Set bus delay signal
   * Used by external devices to delay DMA transfer
   */
  setBusDelay(delayed: boolean): void {
    this.busControl.busDelayed = delayed;
  }

  /**
   * Check if DMA should request bus
   * Returns true if DMA is enabled and not in IDLE state
   */
  shouldRequestBus(): boolean {
    return this.registers.dmaEnabled &&
           this.dmaState !== DmaState.IDLE &&
           this.dmaState !== DmaState.FINISH_DMA;
  }

  /**
   * Release bus in burst mode
   * In burst mode, release bus between byte transfers to allow CPU execution
   */
  releaseBusForBurst(): void {
    if (this.registers.transferMode === TransferMode.BURST) {
      this.releaseBus();
    }
  }

  /**
   * Perform a read cycle from source port
   * Reads data from memory or IO port based on source configuration
   * @returns The data byte read from the source
   */
  performReadCycle(): number {
    // Determine which port is the source based on transfer direction
    let sourceAddress: number;
    let isIO: boolean;
    
    if (this.registers.directionAtoB) {
      // A->B: Port A is source
      sourceAddress = this.transferState.sourceAddress;
      isIO = this.registers.portAIsIO;
    } else {
      // B->A: Port B is source
      sourceAddress = this.transferState.destAddress;
      isIO = this.registers.portBIsIO;
    }

    // Read from memory or IO port
    if (isIO) {
      // IO port read
      this._transferDataByte = this.machine.portManager.readPort(sourceAddress);
    } else {
      // Memory read
      this._transferDataByte = this.machine.memoryDevice.readMemory(sourceAddress);
    }

    return this._transferDataByte;
  }

  /**
   * Get the transfer data byte (for testing)
   */
  getTransferDataByte(): number {
    return this._transferDataByte;
  }

  /**
   * Set source address in transfer state (for testing)
   */
  setSourceAddress(address: number): void {
    this.transferState.sourceAddress = address;
  }

  /**
   * Set destination address in transfer state (for testing)
   */
  setDestAddress(address: number): void {
    this.transferState.destAddress = address;
  }
}