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
 * Bus state machine states (Phase 5 optimization)
 * Replaces three separate boolean flags with single enum for clarity
 */
export const enum BusState {
  IDLE = 0,              // No bus request (busRequested=false, busAcknowledged=false)
  REQUESTED = 1,        // Bus requested but not yet acknowledged (busRequested=true, busAcknowledged=false)
  AVAILABLE = 2,        // Bus requested and acknowledged, ready for transfer (busRequested=true, busAcknowledged=true)
  DELAYED = 3           // Bus available but delayed by external signal (busRequested=true, busAcknowledged=true, busDelayed=true)
}

// ============================================================================
// Phase 4: Constants - Magic Numbers Replaced with Named Constants
// ============================================================================

/**
 * WR0 Register direction bit mask
 */
const MASK_WR0_DIRECTION = 0x40;    // Direction bit (A->B vs B->A)

/**
 * Address register assembly masks (16-bit address composition)
 */
const ADDR_MASK_HIGH_BYTE = 0xFF00; // High byte mask
const ADDR_MASK_LOW_BYTE = 0x00FF;  // Low byte mask
const BYTE_SHIFT = 8;               // Shift for byte assembly

/**
 * 16-bit arithmetic masks
 */
const MASK_16BIT = 0xFFFF;          // 16-bit wraparound mask

/**
 * CPU speed constants (from CpuSpeedDevice)
 */
const CPU_SPEED_28MHZ = 3;          // CPU speed value for 28 MHz

/**
 * Bank lookup constants
 */
const BANK_7_ID = 0x0E;             // Bank 7 identifier in memory device
const BANK_SHIFT = 13;              // Bits to shift address for bank lookup (13k window)

/**
 * T-state timing constants
 */
const TSTATES_IO_PORT = 4;          // T-states for I/O port operation
const TSTATES_MEMORY_READ = 3;      // Base T-states for memory read (no contention)
const TSTATES_MEMORY_WRITE = 3;     // T-states for memory write (no wait states on writes)
const TSTATES_WAIT_STATE = 1;       // Additional T-state for bank contention

/**
 * Prescalar frequency constants (for audio sampling)
 */
const PRESCALAR_REFERENCE_FREQ = 3500000;  // Reference frequency in Hz
const PRESCALAR_AUDIO_FREQ = 875000;       // Audio sample frequency in Hz

/**
 * Internal register
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
  // Function pointers for address update operations (Phase 3 optimization)
  updateSourceAddress: () => void;  // Called after each byte to update source
  updateDestAddress: () => void;    // Called after each byte to update destination
}

/**
 * Status flags
 */
interface StatusFlags {
  atLeastOneByteTransferred: boolean;  // T bit - set after first byte
  endOfBlockReached: boolean;  // E bit - cleared when transfer completes
}

/**
 * Bus control state for CPU/DMA arbitration (Phase 5 optimization)
 * Single BusState enum replaces three boolean flags
 */
interface BusControlState {
  state: BusState;        // Current bus state
  delayFlag: boolean;     // External bus delay signal (independent of state)
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

  // Cache for frequently calculated values
  // Cache fields reserved for Phase 2 optimization
  // (Currently unused - prepared for future performance improvements)

  // ============================================================================
  // Constructor & Initialization
  // ============================================================================

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
      byteCounter: 0,
      updateSourceAddress: this.noOpAddressUpdate.bind(this),  // Default to no-op
      updateDestAddress: this.noOpAddressUpdate.bind(this)     // Will be set in executeLoad()
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
      state: BusState.IDLE,
      delayFlag: false
    };
  }

  // ============================================================================
  // Reset & State Management
  // ============================================================================

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
    
    // Cache fields cleared on reset
  }

  // ============================================================================
  // State Getters & Setters
  // ============================================================================

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

  /**
   * Set DMA enabled state (for testing)
   */
  setDmaEnabled(enabled: boolean): void {
    this.registers.dmaEnabled = enabled;
  }

  // ============================================================================
  // Phase 7: Validation Methods
  // ============================================================================

  /**
   * Check if a DMA transfer is currently active
   * @returns true if DMA is not in IDLE or FINISH_DMA state
   */
  isTransferActive(): boolean {
    return this.registers.dmaEnabled && 
           this.dmaState !== DmaState.IDLE &&
           this.dmaState !== DmaState.FINISH_DMA;
  }

  /**
   * Validate that register changes are allowed
   * Prevents modifications during active transfer
   * @param registerName Name of register being modified
   * @throws Error if modification attempted during active transfer
   */
  validateRegisterWrite(registerName: string): void {
    if (this.isTransferActive()) {
      let stateName = "UNKNOWN";
      if (this.dmaState === DmaState.IDLE) stateName = "IDLE";
      else if (this.dmaState === DmaState.START_DMA) stateName = "START_DMA";
      else if (this.dmaState === DmaState.WAITING_ACK) stateName = "WAITING_ACK";
      else if (this.dmaState === DmaState.TRANSFERRING_READ_1) stateName = "TRANSFERRING_READ_1";
      else if (this.dmaState === DmaState.TRANSFERRING_WRITE_1) stateName = "TRANSFERRING_WRITE_1";
      else if (this.dmaState === DmaState.FINISH_DMA) stateName = "FINISH_DMA";

      throw new Error(
        `Cannot modify ${registerName} register during active DMA transfer. ` +
        `Current DMA state: ${stateName}. ` +
        `Disable DMA or wait for transfer to complete.`
      );
    }
  }

  /**
   * Check for counter overflow in zxnDMA mode
   * In legacy mode, overflow is expected behavior
   * @returns true if counter wrapped around unexpectedly
   */
  detectCounterOverflow(): boolean {
    // Only detect overflow in zxnDMA mode
    if (this.dmaMode !== DmaMode.ZXNDMA) {
      return false;
    }

    // In zxnDMA mode, byteCounter should never exceed transfer length
    const transferLength = this.getTransferLength();
    return this.transferState.byteCounter >= transferLength;
  }

  /**
   * Get maximum transfer size in bytes
   * @returns Maximum bytes that can be transferred (65536 for 16-bit counter)
   */
  getMaxTransferSize(): number {
    return 0x10000; // 2^16 = 65536 bytes
  }

  /**
   * Validate transfer size is within limits
   * @throws Error if transfer size exceeds maximum
   */
  validateTransferSize(): void {
    const blockLength = this.registers.blockLength;
    const transferLength = this.getTransferLength();
    const maxSize = this.getMaxTransferSize();

    if (transferLength > maxSize) {
      throw new Error(
        `Transfer size ${transferLength} exceeds maximum of ${maxSize} bytes. ` +
        `Block length register value: 0x${blockLength.toString(16).padStart(4, '0')}`
      );
    }
  }

  /**
   * Validate source and destination addresses are within memory bounds
   * @returns true if addresses are valid
   */
  validateAddressBounds(): boolean {
    const maxAddress = 0xFFFF; // Assuming 16-bit addressing
    
    const sourceValid = this.transferState.sourceAddress <= maxAddress;
    const destValid = this.transferState.destAddress <= maxAddress;
    
    return sourceValid && destValid;
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

  // ============================================================================
  // Port I/O & Register Write Methods
  // ============================================================================

  /**
   * Write to DMA port - dispatches to appropriate WRx register based on byte value
   * This is the main entry point for port writes
   * @param value The byte value to write
   */
  writePort(value: number): void {
    // Check if we're in the middle of a multi-byte sequence
    if (this.registerWriteSeq !== RegisterWriteSequence.IDLE) {
      // Continue the current sequence
      if (this.registerWriteSeq >= RegisterWriteSequence.R0_BYTE_0 && this.registerWriteSeq <= RegisterWriteSequence.R0_BYTE_3) {
        this.writeWR0(value);
      } else if (this.registerWriteSeq >= RegisterWriteSequence.R1_BYTE_0 && this.registerWriteSeq <= RegisterWriteSequence.R1_BYTE_1) {
        this.writeWR1(value);
      } else if (this.registerWriteSeq >= RegisterWriteSequence.R2_BYTE_0 && this.registerWriteSeq <= RegisterWriteSequence.R2_BYTE_1) {
        this.writeWR2(value);
      } else if (this.registerWriteSeq >= RegisterWriteSequence.R4_BYTE_0 && this.registerWriteSeq <= RegisterWriteSequence.R4_BYTE_2) {
        this.writeWR4(value);
      } else if (this.registerWriteSeq === RegisterWriteSequence.R6_BYTE_0) {
        this.writeWR6(value);
      }
      return;
    }

    // We're in IDLE state, so this is a base byte
    // In Z80 DMA, the register is identified by specific bit patterns:
    // - WR6 (commands): 10xxxxxx or 11xxxxxx specific patterns
    // - WR4: 1xxx1101 (burst/continuous mode)
    // - WR0-WR5: Various patterns with D7=0
    
    // The safest approach: route ALL writes through the write methods
    // and let them handle the byte based on context. But we need to determine
    // the initial target register.
    
    // Simplified Z80 DMA logic:
    // 1. WR6 commands have D7=1 with specific patterns (0xC3, 0xC7, 0xCB, 0x83, 0x87, 0xBB, 0xBF, 0xA7, 0xCF, 0xD3, etc.)
    // 2. WR4 has pattern 1xxx1101 (0x8D, 0xCD, etc.)  
    // 3. Everything else with D7=0 is configuration (WR0-WR5)
    
    if ((value & 0x80) !== 0) {
      // D7=1: Check if it's WR4 or WR6
      // WR4 pattern: bits 3,2,1,0 must be 1101 (xxxx1101)
      // WR4 values: 0x8D (burst), 0xCD (continuous)
      if ((value & 0x0F) === 0x0D) {
        this.writeWR4(value);
      } else {
        // It's a WR6 command
        this.writeWR6(value);
      }
    } else {
      // D7=0: Start of a register configuration
      // Z80 DMA register identification by bit patterns:
      // - WR1 (Port A config): D2=1, D1D0=00 → xxx100  
      // - WR2 (Port B config): D2D1D0=000 → xxx000
      // - WR5 (auto-restart): D4D3=10, D1D0=10 → xxx1x010  
      // - WR0 (transfer): Everything else with D7=0
      const lowBits = value & 0x07;
      
      if (lowBits === 0x04) {
        // WR1: xxx100 (D2=1, D1D0=00)
        this.writeWR1(value);
      } else if (lowBits === 0x00) {
        // WR2: xxx000 (D2D1D0=000)
        this.writeWR2(value);
      } else if ((value & 0x18) === 0x10 && (value & 0x03) === 0x02) {
        // WR5: xxx1x010 (D4=1, D3=0, D1D0=10)
        this.writeWR5(value);
      } else {
        // WR0: Everything else
        this.writeWR0(value);
      }
    }
  }

  /**
   * Write to WR0 register
   * Base byte: D7=0, D6=direction, D5-D0=parameters
   * Parameters: Port A start address (16-bit), block length (16-bit)
   */
  writeWR0(value: number): void {
    // Extract direction bit (D6)
    const direction = (value & MASK_WR0_DIRECTION) !== 0;
    
    if (this.registerWriteSeq === RegisterWriteSequence.IDLE) {
      // First write - store base byte and transition to R0_BYTE_0
      this._tempRegisterByte = value;
      this.registers.directionAtoB = direction;
      this.registerWriteSeq = RegisterWriteSequence.R0_BYTE_0;
    } else if (this.registerWriteSeq === RegisterWriteSequence.R0_BYTE_0) {
      // Port A start address - low byte
      this.registers.portAStartAddress = (this.registers.portAStartAddress & ADDR_MASK_HIGH_BYTE) | value;
      this.registerWriteSeq = RegisterWriteSequence.R0_BYTE_1;
    } else if (this.registerWriteSeq === RegisterWriteSequence.R0_BYTE_1) {
      // Port A start address - high byte
      this.registers.portAStartAddress = (this.registers.portAStartAddress & ADDR_MASK_LOW_BYTE) | (value << BYTE_SHIFT);
      this.registerWriteSeq = RegisterWriteSequence.R0_BYTE_2;
    } else if (this.registerWriteSeq === RegisterWriteSequence.R0_BYTE_2) {
      // Block length - low byte
      this.registers.blockLength = (this.registers.blockLength & ADDR_MASK_HIGH_BYTE) | value;
      this.registerWriteSeq = RegisterWriteSequence.R0_BYTE_3;
    } else if (this.registerWriteSeq === RegisterWriteSequence.R0_BYTE_3) {
      // Block length - high byte (final parameter)
      this.registers.blockLength = (this.registers.blockLength & ADDR_MASK_LOW_BYTE) | (value << BYTE_SHIFT);
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
    // Phase 7: Validate transfer size before loading
    try {
      this.validateTransferSize();
    } catch (error) {
      console.error(`[DMA] ${(error as Error).message}`);
      // Continue anyway - may be intentional
    }

    if (this.registers.directionAtoB) {
      // A → B: Port A is source, Port B is destination
      this.transferState.sourceAddress = this.registers.portAStartAddress;
      this.transferState.destAddress = this.registers.portBStartAddress;
    } else {
      // B → A: Port B is source, Port A is destination
      this.transferState.sourceAddress = this.registers.portBStartAddress;
      this.transferState.destAddress = this.registers.portAStartAddress;
    }

    // Phase 7: Validate address bounds
    if (!this.validateAddressBounds()) {
      console.warn(
        `[DMA] Invalid addresses detected. ` +
        `Source: 0x${this.transferState.sourceAddress.toString(16)}, ` +
        `Dest: 0x${this.transferState.destAddress.toString(16)}`
      );
    }
    
    // Set up function pointers for address update operations (Phase 3 optimization)
    this.updateAddressFunctionPointers();
    
    // Reset byte counter based on mode
    // zxnDMA mode: counter starts at 0
    // Legacy mode: counter starts at -1 (0xFFFF) for compatibility
    if (this.dmaMode === DmaMode.ZXNDMA) {
      this.transferState.byteCounter = 0;
    } else {
      this.transferState.byteCounter = 0xFFFF;  // -1 in 16-bit
    }
    
    // Keep register write sequence in IDLE
    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }

  /**
   * CONTINUE command (0xD3) - Reset counter but keep current addresses
   * Used to continue a transfer from current positions
   */
  private executeContinue(): void {
    // Reset byte counter to restart counting based on mode
    // zxnDMA mode: counter starts at 0
    // Legacy mode: counter starts at -1 (0xFFFF) for compatibility
    if (this.dmaMode === DmaMode.ZXNDMA) {
      this.transferState.byteCounter = 0;
    } else {
      this.transferState.byteCounter = 0xFFFF;  // -1 in 16-bit
    }
    
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
    
    // Transfer length will be calculated on-demand during transfer
    
    // Set DMA state to START_DMA so stepDma() will begin transfer
    // (actual transfer will start when bus is available)
    this.dmaState = DmaState.START_DMA;
    
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

  // ============================================================================
  // Status Byte Management & Read Sequences
  // ============================================================================

  /**
   * Read the next byte in the register read sequence
   * Called when DMA port is read after a read command
   * Status format: 00E1101T where E=end of block (inverted), T=at least one byte
   */
  readStatusByte(): number {
    let value = 0;
    
    if (this.registerReadSeq === RegisterReadSequence.RD_STATUS) {
      // Format depends on end-of-block status:
      // Complete (E): 00110110 (0x36) + T bit
      // In progress (!E): 00011011 (0x1B) - bit 3 + T bit, without bits 5,2
      const tBit = this.statusFlags.atLeastOneByteTransferred ? 1 : 0;
      
      if (this.statusFlags.endOfBlockReached) {
        // Complete: bits 5,4,2,1 set (0x36) plus T at bit 0
        value = 0x36 | tBit;
      } else {
        // In progress: bits 4,3,1 set (0x1A) plus T at bit 0
        value = 0x1a | tBit;
      }
      
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
  // ============================================================================
  // Bus Control & Arbitration
  // ============================================================================

  /**
   * Request bus access from CPU
   * Asserts BUSREQ signal
   */
  requestBus(): void {
    if (this.busControl.state === BusState.IDLE) {
      this.busControl.state = BusState.REQUESTED;
    }
  }

  /**
   * Acknowledge bus grant from CPU
   * Called when BUSAK signal is received
   */
  acknowledgeBus(): void {
    if (this.busControl.state === BusState.REQUESTED) {
      this.busControl.state = BusState.AVAILABLE;
    }
  }

  /**
   * Release bus back to CPU
   * Clears BUSREQ signal
   */
  releaseBus(): void {
    this.busControl.state = BusState.IDLE;
  }

  /**
   * Check if bus is available for DMA transfer
   * Returns true if bus is in AVAILABLE state (not delayed)
   */
  isBusAvailable(): boolean {
    return this.busControl.state === BusState.AVAILABLE;
  }

  /**
   * Set bus delay signal
   * Used by external devices to delay DMA transfer
   */
  setBusDelay(delayed: boolean): void {
    this.busControl.delayFlag = delayed;
    
    // If we have an active bus request and delay changes, update state accordingly
    if (delayed && this.busControl.state === BusState.AVAILABLE) {
      this.busControl.state = BusState.DELAYED;
    } else if (!delayed && this.busControl.state === BusState.DELAYED) {
      this.busControl.state = BusState.AVAILABLE;
    }
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
   * Get the total number of bytes to transfer
   * In legacy mode, adds 1 to blockLength for compatibility
   * In zxnDMA mode, returns exact blockLength
   * @returns Total bytes to transfer
   */
  private getTransferLength(): number {
    return this.dmaMode === DmaMode.LEGACY 
      ? this.registers.blockLength + 1 
      : this.registers.blockLength;
  }

  /**
   * Get the number of bytes already transferred
   * Handles legacy mode counter wrapping (0xFFFF = 0 bytes transferred)
   * @returns Number of bytes transferred so far
   */
  private getBytesTransferred(): number {
    if (this.dmaMode === DmaMode.LEGACY && this.transferState.byteCounter === 0xFFFF) {
      return 0;  // Haven't transferred any bytes yet
    }
    
    if (this.dmaMode === DmaMode.LEGACY) {
      return this.transferState.byteCounter + 1;
    }
    
    return this.transferState.byteCounter;
  }

  /**
   * Check if transfer should continue based on current progress
   * @returns true if more bytes need to be transferred
   */
  private shouldContinueTransfer(): boolean {
    return this.getBytesTransferred() < this.getTransferLength();
  }

  // ============================================================================
  // Address Update & Helper Methods
  // ============================================================================

  /**
   * Increment source address (for Phase 3 optimization)
   * Used as function pointer in hot path
   */
  private incrementSourceAddress(): void {
    this.transferState.sourceAddress = (this.transferState.sourceAddress + 1) & MASK_16BIT;
  }

  /**
   * Decrement source address (for Phase 3 optimization)
   * Used as function pointer in hot path
   */
  private decrementSourceAddress(): void {
    this.transferState.sourceAddress = (this.transferState.sourceAddress - 1) & MASK_16BIT;
  }

  /**
   * Increment destination address (for Phase 3 optimization)
   * Used as function pointer in hot path
   */
  private incrementDestAddress(): void {
    this.transferState.destAddress = (this.transferState.destAddress + 1) & MASK_16BIT;
  }

  /**
   * Decrement destination address (for Phase 3 optimization)
   * Used as function pointer in hot path
   */
  private decrementDestAddress(): void {
    this.transferState.destAddress = (this.transferState.destAddress - 1) & MASK_16BIT;
  }

  /**
   * No-op address update (for Phase 3 optimization)
   * Used when address mode is FIXED
   */
  private noOpAddressUpdate(): void {
    // No-op: address stays the same
  }

  /**
   * Get the appropriate address update function for a given address mode and port
   * Returns a bound method that will be called in the hot path
   * @param mode The address mode (INCREMENT, DECREMENT, FIXED)
   * @param port The port (source or dest)
   * @returns A bound function to call on each byte transfer
   */
  private getAddressUpdateFunction(mode: AddressMode, port: 'source' | 'dest'): () => void {
    switch (mode) {
      case AddressMode.INCREMENT:
        return port === 'source' ? this.incrementSourceAddress.bind(this) : this.incrementDestAddress.bind(this);
      case AddressMode.DECREMENT:
        return port === 'source' ? this.decrementSourceAddress.bind(this) : this.decrementDestAddress.bind(this);
      case AddressMode.FIXED:
      default:
        return this.noOpAddressUpdate.bind(this);
    }
  }

  /**
   * Update function pointers to match current register configuration (Phase 3 optimization)
   * Called in executeLoad() and at the start of performWriteCycle() to ensure consistency
   */
  private updateAddressFunctionPointers(): void {
    if (this.registers.directionAtoB) {
      // A->B: Update Port A (source) and Port B (destination)
      this.transferState.updateSourceAddress = this.getAddressUpdateFunction(this.registers.portAAddressMode, 'source');
      this.transferState.updateDestAddress = this.getAddressUpdateFunction(this.registers.portBAddressMode, 'dest');
    } else {
      // B->A: Update Port B (source) and Port A (destination)
      this.transferState.updateSourceAddress = this.getAddressUpdateFunction(this.registers.portBAddressMode, 'source');
      this.transferState.updateDestAddress = this.getAddressUpdateFunction(this.registers.portAAddressMode, 'dest');
    }
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
   * Get current bus control state
   * Used by machine to check if DMA owns the bus
   * @returns Bus control state object
   */
  getBusControl(): Readonly<BusControlState & { busRequested: boolean; busAcknowledged: boolean; busDelayed: boolean }> {
    return {
      ...this.busControl,
      // Backward-compatible boolean properties for tests
      busRequested: this.busControl.state !== BusState.IDLE,
      busAcknowledged: this.busControl.state === BusState.AVAILABLE || this.busControl.state === BusState.DELAYED,
      busDelayed: this.busControl.delayFlag
    };
  }

  /**
   * Get current bus state (Phase 5 - for testing and debugging)
   * @returns Current BusState enum value
   */
  getBusState(): BusState {
    return this.busControl.state;
  }

  // ============================================================================
  // Transfer Operations & Timing
  // ============================================================================

  /**
   * Step DMA state machine forward by one operation
   * This method is called from the machine frame loop to allow incremental DMA execution
   * Returns the number of T-states consumed by this step
   * @returns T-states consumed (0 if no operation performed)
   */
  stepDma(): number {
    // If DMA is not enabled or idle, nothing to do
    if (!this.registers.dmaEnabled || this.dmaState === DmaState.IDLE) {
      return 0;
    }

    // Check if transfer is already complete
    if (!this.shouldContinueTransfer()) {
      // Transfer complete - check for auto-restart
      if (this.checkAndHandleAutoRestart()) {
        // Restarted - continue with next byte
      } else {
        // No restart - mark complete and release bus (if held)
        this.statusFlags.endOfBlockReached = true;
        this.releaseBus();
        this.dmaState = DmaState.IDLE;
        return 0;
      }
    }

    // Check if we need bus access
    if (!this.isBusAvailable()) {
      // Request bus if not already requested
      if (this.busControl.state !== BusState.REQUESTED) {
        this.requestBus();
      }
      // Wait for bus acknowledgment - no T-states consumed yet
      return 0;
    }

    // Perform one byte transfer
    // Read cycle: typically 3 T-states for memory, 4 for I/O
    // Write cycle: typically 3 T-states for memory, 4 for I/O
    this.performReadCycle();
    this.performWriteCycle();

    // Check if transfer just completed
    if (!this.shouldContinueTransfer()) {
      // Transfer complete - check for auto-restart
      if (this.checkAndHandleAutoRestart()) {
        // Restarted - keep bus for next iteration
      } else {
        // No restart - mark complete and release bus
        this.statusFlags.endOfBlockReached = true;
        this.releaseBus();
        this.dmaState = DmaState.IDLE;
      }
    }

    // In burst mode, release bus after each byte
    if (this.registers.transferMode === TransferMode.BURST) {
      this.releaseBusForBurst();
      
      // Calculate prescalar delay for burst mode
      const prescalar = this.registers.portBPrescalar || 1;
      const cpuFreq = PRESCALAR_REFERENCE_FREQ; // 3.5MHz base clock
      const prescalarFreq = PRESCALAR_AUDIO_FREQ; // 875kHz reference
      const tStatesPerByte = Math.floor((prescalar * cpuFreq) / prescalarFreq);
      return tStatesPerByte;
    } else {
      // Continuous mode - calculate accurate transfer time including contention/wait states
      return this.calculateDmaTransferTiming();
    }
  }

  /**
   * Calculate accurate T-state timing for DMA transfer
   * Takes into account:
   * - CPU speed (3.5MHz, 7MHz, 14MHz, 28MHz)
   * - SRAM wait states at 28MHz
   * - Bank 7 direct access (no wait state)
   * - Memory vs I/O port timing
   * 
   * @returns T-states consumed for one byte transfer (read + write)
   */
  calculateDmaTransferTiming(): number {
    const sourceAddr = this.transferState.sourceAddress;
    
    // Get current CPU speed from machine
    const cpuSpeed = this.machine.cpuSpeedDevice.effectiveSpeed;
    
    let readTStates = 0;
    let writeTStates = 0;
    
    // Calculate read timing
    if (this.registers.portAIsIO) {
      // I/O port read: typically 4 T-states
      readTStates = TSTATES_IO_PORT;
    } else {
      // Memory read: base 3 T-states
      readTStates = TSTATES_MEMORY_READ;
      
      // At 28 MHz, add 1 wait state unless it's Bank 7
      if (cpuSpeed === CPU_SPEED_28MHZ) {
        const pageIndex = (sourceAddr >>> BANK_SHIFT) & 0x07;
        const isBank7 = this.machine.memoryDevice.bank8kLookup[pageIndex] === BANK_7_ID;
        
        if (!isBank7) {
          readTStates += TSTATES_WAIT_STATE; // Wait state for SRAM or Bank 5
        }
      }
    }
    
    // Calculate write timing  
    if (this.registers.portBIsIO) {
      // I/O port write: typically 4 T-states
      writeTStates = TSTATES_IO_PORT;
    } else {
      // Memory write: always 3 T-states (no wait states on writes, even at 28MHz)
      writeTStates = TSTATES_MEMORY_WRITE;
    }
    
    return readTStates + writeTStates;
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

  /**
   * Perform a write cycle to destination port
   * Writes data to memory or IO port based on destination configuration
   * Updates addresses based on address mode and increments byte counter
   */
  performWriteCycle(): void {
    // Ensure function pointers are up-to-date with current register settings
    // (This handles test cases that call performWriteCycle() directly without LOAD)
    this.updateAddressFunctionPointers();
    
    // Determine which port is the destination based on transfer direction
    let destAddress: number;
    let isIO: boolean;
    
    if (this.registers.directionAtoB) {
      // A->B: Port B is destination
      destAddress = this.transferState.destAddress;
      isIO = this.registers.portBIsIO;
    } else {
      // B->A: Port A is destination
      destAddress = this.transferState.sourceAddress;
      isIO = this.registers.portAIsIO;
    }

    // Write to memory or IO port
    if (isIO) {
      // IO port write
      this.machine.portManager.writePort(destAddress, this._transferDataByte);
    } else {
      // Memory write
      this.machine.memoryDevice.writeMemory(destAddress, this._transferDataByte);
    }

    // Update addresses using function pointers (Phase 3 optimization)
    // Replaces string-based dispatch with direct function calls
    this.transferState.updateSourceAddress();
    this.transferState.updateDestAddress();

    // Increment byte counter (16-bit with wraparound)
    this.transferState.byteCounter = (this.transferState.byteCounter + 1) & MASK_16BIT;
    
    // Phase 7: Detect counter overflow in zxnDMA mode (potential bug indicator)
    if (this.detectCounterOverflow()) {
      // Log warning but don't halt transfer - could be legitimate in some cases
      // This helps identify unexpected behavior during debugging
      console.warn(
        `[DMA] Counter overflow detected in zxnDMA mode. ` +
        `byteCounter=${this.transferState.byteCounter}, ` +
        `blockLength=${this.registers.blockLength}. ` +
        `Transfer may have completed unexpectedly.`
      );
    }
    
    // Update status flags
    // In zxnDMA mode: first byte = byteCounter 1
    // In legacy mode: first byte = byteCounter 0 (starts at 0xFFFF, wraps to 0)
    const isFirstByte = this.dmaMode === DmaMode.LEGACY 
      ? this.transferState.byteCounter === 0
      : this.transferState.byteCounter === 1;
    
    if (isFirstByte) {
      // First byte transferred
      this.statusFlags.atLeastOneByteTransferred = true;
      this.statusFlags.endOfBlockReached = false;
    }
  }

  /**
   * Execute a complete continuous transfer
   * Performs the entire block transfer without releasing the bus
   * @returns Number of bytes transferred
   */
  executeContinuousTransfer(): number {
    if (!this.registers.dmaEnabled) {
      return 0;
    }

    // Check if transfer mode is continuous
    if (this.registers.transferMode !== TransferMode.CONTINUOUS) {
      return 0;
    }

    const bytesToTransfer = this.getTransferLength();
    let totalBytesTransferred = 0;
    const maxIterations = this.registers.autoRestart ? 1000 : 1; // Safety limit for auto-restart

    // Request and wait for bus
    this.requestBus();
    
    // Perform the transfer (with potential auto-restart loops)
    let iteration = 0;
    do {
      let bytesTransferred = 0;
      
      while (bytesTransferred < bytesToTransfer) {
        // Read from source
        this.performReadCycle();
        
        // Write to destination
        this.performWriteCycle();
        
        bytesTransferred++;
        totalBytesTransferred++;

        // Check if we've completed the block
        if (bytesTransferred >= bytesToTransfer) {
          break;
        }
      }
      
      iteration++;
      
      // Check for auto-restart after completing the block
      // If auto-restart is enabled, this will reset addresses and counter
      // Safety: limit iterations to prevent infinite loops
    } while (this.checkAndHandleAutoRestart() && iteration < maxIterations);
    
    // If we exited the loop without auto-restart, mark block as complete
    if (!this.registers.autoRestart || iteration >= maxIterations) {
      this.statusFlags.endOfBlockReached = true;
    }

    // Release bus
    this.releaseBus();

    return totalBytesTransferred;
  }

  /**
   * Execute a burst transfer with prescalar timing
   * Performs transfers with delays between each byte, releasing the bus to allow CPU execution
   * @param tStatesToExecute Number of T-states available for transfer
   * @returns Number of bytes transferred
   */
  executeBurstTransfer(tStatesToExecute: number): number {
    if (!this.registers.dmaEnabled) {
      return 0;
    }

    // Check if transfer mode is burst
    if (this.registers.transferMode !== TransferMode.BURST) {
      return 0;
    }

    const bytesToTransfer = this.getTransferLength();
    const bytesAlreadyTransferred = this.getBytesTransferred();
    const bytesRemaining = bytesToTransfer - bytesAlreadyTransferred;
    
    if (bytesRemaining <= 0) {
      return 0; // Transfer already complete
    }
    
    let bytesTransferred = 0;
    let tStatesUsed = 0;

    // Calculate T-states per transfer based on prescalar
    // Prescalar formula: Frate = 875kHz / prescalar
    // At 3.5MHz base clock (3500000 Hz), 875kHz = 3500000 / 4
    // Delay in T-states = (prescalar * CPU_FREQ) / 875000
    const prescalar = this.registers.portBPrescalar || 1; // Minimum 1 to avoid divide by zero
    const cpuFreq = PRESCALAR_REFERENCE_FREQ; // 3.5MHz base clock
    const prescalarFreq = PRESCALAR_AUDIO_FREQ; // 875kHz reference
    const tStatesPerByte = Math.floor((prescalar * cpuFreq) / prescalarFreq);

    // Perform transfers while we have T-states and bytes to transfer
    while (bytesTransferred < bytesRemaining && tStatesUsed < tStatesToExecute) {
      // Request bus for this byte
      this.requestBus();
      
      // Read from source
      this.performReadCycle();
      
      // Write to destination
      this.performWriteCycle();
      
      bytesTransferred++;
      
      // Release bus between transfers (burst mode behavior)
      this.releaseBusForBurst();
      
      // Account for T-states used (prescalar delay + transfer time)
      tStatesUsed += tStatesPerByte;
      
      // Check if we've completed the block
      if (bytesTransferred >= bytesRemaining) {
        break;
      }
      
      // Check if we've run out of T-states for this execution slice
      if (tStatesUsed >= tStatesToExecute) {
        break;
      }
    }

    // Check for auto-restart if block is complete
    if (bytesTransferred >= bytesRemaining) {
      if (!this.checkAndHandleAutoRestart()) {
        // Transfer complete, no auto-restart
        this.statusFlags.endOfBlockReached = true;
      }
    }

    return bytesTransferred;
  }

  /**
   * Check if transfer is complete and handle auto-restart
   * @returns true if transfer restarted, false otherwise
   */
  private checkAndHandleAutoRestart(): boolean {
    // Check if we've completed the block
    if (this.transferState.byteCounter < this.registers.blockLength) {
      return false; // Transfer not complete yet
    }

    // Transfer is complete - check auto-restart flag
    if (!this.registers.autoRestart) {
      return false; // No auto-restart
    }

    // Auto-restart: reload addresses and reset counter
    if (this.registers.directionAtoB) {
      // A → B: Port A is source, Port B is destination
      this.transferState.sourceAddress = this.registers.portAStartAddress;
      this.transferState.destAddress = this.registers.portBStartAddress;
    } else {
      // B → A: Port B is source, Port A is destination
      this.transferState.sourceAddress = this.registers.portBStartAddress;
      this.transferState.destAddress = this.registers.portAStartAddress;
    }

    // Reset byte counter based on DMA mode
    if (this.dmaMode === DmaMode.ZXNDMA) {
      this.transferState.byteCounter = 0;
    } else {
      this.transferState.byteCounter = 0xFFFF;  // -1 in 16-bit for legacy mode
    }

    return true; // Transfer restarted
  }

  /**
   * Check if current transfer block is complete
   * @returns true if byteCounter has reached blockLength
   */
  isTransferComplete(): boolean {
    return this.transferState.byteCounter >= this.registers.blockLength;
  }
}