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
 * WR0 Register control bits (additional fields beyond direction)
 */
const MASK_WR0_SEARCH_CONTROL = 0x20;   // D5: 0=Transfer, 1=Search
const MASK_WR0_INTERRUPT_MODE = 0x18;   // D4-D3: Interrupt mode
const SHIFT_WR0_INTERRUPT_MODE = 3;     // Bits to shift for interrupt mode

/**
 * WR1/WR2 Register configuration bits
 */
const MASK_WR12_TIMING_FOLLOWS = 0x40;  // D6: Timing byte follows
const MASK_WR12_IO_FLAG = 0x08;         // D3: 1=I/O, 0=Memory
const MASK_WR12_ADDRESS_MODE = 0x30;    // D5-D4: Address mode
const SHIFT_WR12_ADDRESS_MODE = 4;      // Bits to shift for address mode

/**
 * Cycle length extraction from timing bytes
 */
const MASK_CYCLE_LENGTH = 0x03;         // D1-D0: Cycle length bits

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
 * Register routing bit patterns (for port write dispatch)
 */
const MASK_REGISTER_ID = 0x07;        // D2-D0: Register identifier
const PATTERN_WR1 = 0x04;              // xxx100
const PATTERN_WR2 = 0x00;              // xxx000
const PATTERN_WR3_ENABLE = 0x03;       // xxx011 (D2D1D0=011)
const PATTERN_WR3_DISABLE = 0x02;      // xxx010 (D2D1D0=010)
const PATTERN_WR4_MASK = 0x0F;         // Mask for WR4 detection
const PATTERN_WR4_BITS = 0x0D;         // xxxx1101
const PATTERN_WR5_MASK = 0x17;         // Mask for WR5 detection (0x18 with D0)
const PATTERN_WR5_BASE = 0x12;         // xxx1x010 (D4=1, D3=0, D1D0=10)
const PATTERN_WR6_COMMAND = 0x80;      // 1xxxxxxx (command)

// ============================================================================
// Step 1: MAME-style raw register index constants
// Each register group occupies 8 slots: group 0 = WR0, group 1 = WR1, etc.
// RNUM(m, s) = (m << 3) + s
// ============================================================================
const RNUM_WR0_BASE      = 0;   // (0<<3)+0 – WR0 base byte
const RNUM_PORT_A_ADDR_L = 1;   // (0<<3)+1 – Port A starting address (low)
const RNUM_PORT_A_ADDR_H = 2;   // (0<<3)+2 – Port A starting address (high)
const RNUM_BLOCKLEN_L    = 3;   // (0<<3)+3 – Block length (low)
const RNUM_BLOCKLEN_H    = 4;   // (0<<3)+4 – Block length (high)
const RNUM_WR1_BASE      = 8;   // (1<<3)+0 – WR1 base byte
const RNUM_PORT_A_TIMING = 9;   // (1<<3)+1 – Port A timing byte
const RNUM_WR2_BASE      = 16;  // (2<<3)+0 – WR2 base byte
const RNUM_PORT_B_TIMING = 17;  // (2<<3)+1 – Port B timing byte
const RNUM_ZXN_PRESCALER = 18;  // (2<<3)+2 – ZXN prescaler byte
const RNUM_WR3_BASE      = 24;  // (3<<3)+0 – WR3 base byte
const RNUM_MASK_BYTE     = 25;  // (3<<3)+1 – WR3 mask byte parameter
const RNUM_MATCH_BYTE    = 26;  // (3<<3)+2 – WR3 match byte parameter
const RNUM_WR4_BASE      = 32;  // (4<<3)+0 – WR4 base byte
const RNUM_PORT_B_ADDR_L = 33;  // (4<<3)+1 – Port B starting address (low)
const RNUM_PORT_B_ADDR_H = 34;  // (4<<3)+2 – Port B starting address (high)
const RNUM_INTERRUPT_CTRL   = 35;  // (4<<3)+3 – WR4 interrupt control
const RNUM_INTERRUPT_VECTOR = 36;  // (4<<3)+4 – WR4 interrupt vector
const RNUM_PULSE_CTRL       = 37;  // (4<<3)+5 – WR4 pulse control
const RNUM_WR5_BASE      = 40;  // (5<<3)+0 – WR5 base byte
const RNUM_WR6_BASE      = 48;  // (6<<3)+0 – WR6 base byte
const RNUM_READ_MASK     = 49;  // (6<<3)+1 – Read mask byte
const RNUM_ARRAY_SIZE    = 50;  // total entries (max index = 49)

/**
 * Internal register
 */
interface RegisterState {
  // WR0 - Port A and block configuration
  directionAtoB: boolean;  // true = A->B, false = B->A
  portAStartAddress: number;  // 16-bit starting address
  blockLength: number;  // 16-bit transfer length
  
  // WR0 - Control bits (D5, D4-D3)
  searchControl: boolean;  // D5: 0=Transfer mode, 1=Search mode
  interruptControl: number;  // D4-D3: Interrupt mode (0-3)

  // WR1 - Port A configuration
  portAIsIO: boolean;  // true = I/O, false = Memory
  portAAddressMode: AddressMode;
  portATimingCycleLength: CycleLength;
  portATimingValue: number | null;  // Raw timing byte from WR1

  // WR2 - Port B configuration
  portBIsIO: boolean;  // true = I/O, false = Memory
  portBAddressMode: AddressMode;
  portBTimingCycleLength: CycleLength;
  portBTimingValue: number | null;  // Raw timing byte from WR2
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

  // ============================================================================
  // Step 1: Raw register storage (MAME m_regs style)
  // Flat array: index = (group << 3) + slot.  50 entries covers all WR0-WR6.
  // ============================================================================
  private regs: Uint16Array = new Uint16Array(RNUM_ARRAY_SIZE);

  // Step 1: MAME-style independent address/count tracking fields
  // These are loaded by the LOAD command (separate from raw register storage).
  private _addressA: number = 0;   // Current port A running address (m_addressA)
  private _addressB: number = 0;   // Current port B running address (m_addressB)
  private _count: number = 0;      // Block length loaded at LOAD time (m_count)

  // ============================================================================
  // Step 7: MAME-style status and control fields
  // ============================================================================
  private m_status: number = 0x38;     // Raw status byte (m_status in MAME)
  private forceReady: boolean = false;  // FORCE_READY flag (m_force_ready)
  private ip: number = 0;              // Interrupt pending (m_ip)
  private ius: number = 0;             // Interrupt under service (m_ius)
  private resetPointer: number = 0;    // Progressive RESET column index (m_reset_pointer)

  // ============================================================================
  // Step 2: Follow-byte queue (MAME m_regs_follow / m_num_follow / m_cur_follow)
  // When numFollow > 0, writePort() routes follow bytes via this queue rather
  // than the legacy registerWriteSeq mechanism.
  // ============================================================================
  private numFollow: number = 0;
  private curFollow: number = 0;
  private regsFollow: number[] = [0, 0, 0, 0, 0];

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
      
      // WR0 control bits
      searchControl: false,
      interruptControl: 0,
      
      portAIsIO: false,
      portAAddressMode: AddressMode.INCREMENT,
      portATimingCycleLength: CycleLength.CYCLES_3,
      portATimingValue: null,
      portBIsIO: false,
      portBAddressMode: AddressMode.INCREMENT,
      portBTimingCycleLength: CycleLength.CYCLES_3,
      portBTimingValue: null,
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

    // Step 1+2: Clear raw registers and follow state
    this.regs.fill(0);
    this._addressA = 0;
    this._addressB = 0;
    this._count = 0;
    this.numFollow = 0;
    this.curFollow = 0;
    this.regsFollow.fill(0);
    
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

  // Step 7: MAME-style status accessor
  getStatus(): number {
    return this.m_status;
  }

  getForceReady(): boolean {
    return this.forceReady;
  }

  getIp(): number {
    return this.ip;
  }

  getIus(): number {
    return this.ius;
  }

  getResetPointer(): number {
    return this.resetPointer;
  }

  /**
   * Set DMA enabled state (for testing)
   */
  setDmaEnabled(enabled: boolean): void {
    this.registers.dmaEnabled = enabled;
  }

  /**
   * Get timing parameters (for testing and debugging)
   */
  getTimingParameters(): {
    portA: { cycleLength: CycleLength; rawValue: number | null };
    portB: { cycleLength: CycleLength; rawValue: number | null };
  } {
    return {
      portA: {
        cycleLength: this.registers.portATimingCycleLength,
        rawValue: this.registers.portATimingValue
      },
      portB: {
        cycleLength: this.registers.portBTimingCycleLength,
        rawValue: this.registers.portBTimingValue
      }
    };
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

  /**
   * Comprehensive validation of entire register configuration
   * Returns detailed error messages for debugging and testing
   * @returns Object with validation result and error list
   */
  validateRegisterState(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Block length validation
    if (this.registers.blockLength === 0) {
      errors.push("Block length is zero - no data will be transferred");
    }
    if (this.registers.blockLength > 0xFFFF) {
      errors.push(`Block length overflow: ${this.registers.blockLength}`);
    }

    // Address mode validation
    if (this.registers.portAAddressMode > AddressMode.FIXED) {
      errors.push(`Invalid Port A address mode: ${this.registers.portAAddressMode}`);
    }
    if (this.registers.portBAddressMode > AddressMode.FIXED) {
      errors.push(`Invalid Port B address mode: ${this.registers.portBAddressMode}`);
    }

    // Address range validation
    if (this.registers.portAStartAddress > 0xFFFF) {
      errors.push(`Port A address overflow: 0x${this.registers.portAStartAddress.toString(16)}`);
    }
    if (this.registers.portBStartAddress > 0xFFFF) {
      errors.push(`Port B address overflow: 0x${this.registers.portBStartAddress.toString(16)}`);
    }

    // Transfer mode validation
    if (this.registers.transferMode !== TransferMode.CONTINUOUS && 
        this.registers.transferMode !== TransferMode.BURST) {
      errors.push(`Invalid transfer mode: ${this.registers.transferMode}`);
    }

    // I/O port validation - addresses must be in 0x00-0xFF range
    if (this.registers.portAIsIO && this.registers.portAStartAddress > 0xFF) {
      errors.push(
        `Port A configured as I/O but address > 0xFF: 0x${this.registers.portAStartAddress.toString(16)}`
      );
    }
    if (this.registers.portBIsIO && this.registers.portBStartAddress > 0xFF) {
      errors.push(
        `Port B configured as I/O but address > 0xFF: 0x${this.registers.portBStartAddress.toString(16)}`
      );
    }

    return {
      valid: errors.length === 0,
      errors
    };
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
  // Step 1: Raw register accessors
  // ============================================================================

  /** Helper: compute register index from group m and slot s */
  private regNum(m: number, s: number): number {
    return (m << 3) + s;
  }

  /** Get a raw register value at group m, slot s (for testing and internal use) */
  getRawReg(m: number, s: number): number {
    return this.regs[this.regNum(m, s)];
  }

  /** Get MAME-style port A address (loaded by LOAD command) */
  getAddressA(): number {
    return this._addressA;
  }

  /** Get MAME-style port B address (loaded by LOAD command) */
  getAddressB(): number {
    return this._addressB;
  }

  /** Get MAME-style count (block length loaded by LOAD command) */
  getMameCount(): number {
    return this._count;
  }

  // ============================================================================
  // Step 2: Follow-byte mechanism helpers
  // ============================================================================

  /** Get current follow queue length (for testing) */
  getNumFollow(): number {
    return this.numFollow;
  }

  /**
   * Map a raw register index back to the legacy RegisterWriteSequence value.
   * Used to keep getRegisterWriteSeq() correct after follow-queue updates.
   */
  private regSeqFromRegNum(nreg: number): RegisterWriteSequence {
    if (nreg === RNUM_PORT_A_ADDR_L) return RegisterWriteSequence.R0_BYTE_0;
    if (nreg === RNUM_PORT_A_ADDR_H) return RegisterWriteSequence.R0_BYTE_1;
    if (nreg === RNUM_BLOCKLEN_L)    return RegisterWriteSequence.R0_BYTE_2;
    if (nreg === RNUM_BLOCKLEN_H)    return RegisterWriteSequence.R0_BYTE_3;
    if (nreg === RNUM_PORT_A_TIMING) return RegisterWriteSequence.R1_BYTE_0;
    if (nreg === RNUM_PORT_B_TIMING) return RegisterWriteSequence.R2_BYTE_0;
    if (nreg === RNUM_ZXN_PRESCALER) return RegisterWriteSequence.R2_BYTE_1;
    if (nreg === RNUM_PORT_B_ADDR_L) return RegisterWriteSequence.R4_BYTE_0;
    if (nreg === RNUM_PORT_B_ADDR_H) return RegisterWriteSequence.R4_BYTE_1;
    if (nreg === RNUM_READ_MASK)     return RegisterWriteSequence.R6_BYTE_0;
    return RegisterWriteSequence.IDLE;
  }

  /**
   * Process a follow byte: write to raw regs and sync the decoded RegisterState.
   * Called by writePort() when numFollow > 0 (AFTER curFollow has been advanced).
   * For the WR2 timing byte, handles the specnext_dma prescaler-follows logic.
   */
  private handleFollowByte(nreg: number, value: number): void {
    this.regs[nreg] = value;
    switch (nreg) {
      case RNUM_PORT_A_ADDR_L:
        this.registers.portAStartAddress =
          (this.registers.portAStartAddress & ADDR_MASK_HIGH_BYTE) | (value & 0xff);
        break;
      case RNUM_PORT_A_ADDR_H:
        this.registers.portAStartAddress =
          (this.registers.portAStartAddress & ADDR_MASK_LOW_BYTE) | ((value & 0xff) << BYTE_SHIFT);
        break;
      case RNUM_BLOCKLEN_L:
        this.registers.blockLength =
          (this.registers.blockLength & ADDR_MASK_HIGH_BYTE) | (value & 0xff);
        break;
      case RNUM_BLOCKLEN_H:
        this.registers.blockLength =
          (this.registers.blockLength & ADDR_MASK_LOW_BYTE) | ((value & 0xff) << BYTE_SHIFT);
        break;
      case RNUM_PORT_A_TIMING:
        this.registers.portATimingValue = value;
        this.registers.portATimingCycleLength = (value & MASK_CYCLE_LENGTH) as CycleLength;
        break;
      case RNUM_PORT_B_TIMING:
        this.registers.portBTimingValue = value;
        this.registers.portBTimingCycleLength = (value & MASK_CYCLE_LENGTH) as CycleLength;
        // specnext_dma override: if D5 of the timing byte is set the prescaler byte follows
        // At this point curFollow has already been advanced and numFollow may be 0; add it fresh.
        if (value & 0x20) {
          this.regsFollow[0] = RNUM_ZXN_PRESCALER;
          this.numFollow = 1;
          this.curFollow = 0;
        }
        break;
      case RNUM_ZXN_PRESCALER:
        this.registers.portBPrescalar = value & 0xff;
        break;
      case RNUM_PORT_B_ADDR_L:
        this.registers.portBStartAddress =
          (this.registers.portBStartAddress & 0xff00) | (value & 0xff);
        break;
      case RNUM_PORT_B_ADDR_H:
        this.registers.portBStartAddress =
          (this.registers.portBStartAddress & 0x00ff) | ((value & 0xff) << BYTE_SHIFT);
        break;
      case RNUM_MASK_BYTE:
        // WR3 mask byte — stored in raw regs; no decoded RegisterState field yet
        break;
      case RNUM_MATCH_BYTE:
        // WR3 match byte — stored in raw regs; no decoded RegisterState field yet
        break;
      case RNUM_INTERRUPT_CTRL:
        // WR4 interrupt control byte — conditionally queue PULSE_CTRL and INTERRUPT_VECTOR
        // This mirrors MAME z80dma.cpp follow-byte processing for REG(4,3)
        this.numFollow = 0;
        this.curFollow = 0;
        if (value & 0x08) this.regsFollow[this.numFollow++] = RNUM_PULSE_CTRL;
        if (value & 0x10) this.regsFollow[this.numFollow++] = RNUM_INTERRUPT_VECTOR;
        break;
      case RNUM_INTERRUPT_VECTOR:
        // WR4 interrupt vector — stored in raw regs
        break;
      case RNUM_PULSE_CTRL:
        // WR4 pulse control — stored in raw regs
        break;
      case RNUM_READ_MASK:
        this.registers.readMask = value & 0x7f;
        break;
      default:
        break;
    }
  }

  /**
   * Set up the follow-byte queue based on the register group and base byte.
   * Called by writePort() after a base byte has been dispatched.
   * Also updates registerWriteSeq to reflect the new queue state.
   */
  private setupFollowQueue(regGroup: number, baseValue: number): void {
    this.numFollow = 0;
    this.curFollow = 0;
    switch (regGroup) {
      case 0: // WR0: D3=portA_addr_lo, D4=portA_addr_hi, D5=blockLen_lo, D6=blockLen_hi
        if (baseValue & 0x08) this.regsFollow[this.numFollow++] = RNUM_PORT_A_ADDR_L;
        if (baseValue & 0x10) this.regsFollow[this.numFollow++] = RNUM_PORT_A_ADDR_H;
        if (baseValue & 0x20) this.regsFollow[this.numFollow++] = RNUM_BLOCKLEN_L;
        if (baseValue & 0x40) this.regsFollow[this.numFollow++] = RNUM_BLOCKLEN_H;
        break;
      case 1: // WR1: D6=port_a_timing
        if (baseValue & 0x40) this.regsFollow[this.numFollow++] = RNUM_PORT_A_TIMING;
        break;
      case 2: // WR2: D6=port_b_timing (prescaler is gated by timing byte D5, handled in handleFollowByte)
        if (baseValue & 0x40) this.regsFollow[this.numFollow++] = RNUM_PORT_B_TIMING;
        break;
      case 4: // WR4: D2=portB_addr_lo, D3=portB_addr_hi
        if (baseValue & 0x04) this.regsFollow[this.numFollow++] = RNUM_PORT_B_ADDR_L;
        if (baseValue & 0x08) this.regsFollow[this.numFollow++] = RNUM_PORT_B_ADDR_H;
        break;
      case 6: // WR6: only READ_MASK_FOLLOWS (0xBB) needs a follow byte
        if (baseValue === 0xbb) this.regsFollow[this.numFollow++] = RNUM_READ_MASK;
        break;
      case 3: // WR3: D3=mask_byte, D4=match_byte; D6 triggers DMA start (not dmaEnabled flag)
        if (baseValue & 0x08) this.regsFollow[this.numFollow++] = RNUM_MASK_BYTE;
        if (baseValue & 0x10) this.regsFollow[this.numFollow++] = RNUM_MATCH_BYTE;
        if (baseValue & 0x40) {
          this.dmaState = DmaState.START_DMA;
        }
        break;
      default: // WR5: no follow bytes
        break;
    }
    // Keep registerWriteSeq in sync with the new queue state
    this.registerWriteSeq = this.numFollow > 0
      ? this.regSeqFromRegNum(this.regsFollow[0])
      : RegisterWriteSequence.IDLE;
  }

  /**
   * Write to DMA port - dispatches to appropriate WRx register based on byte value
   * This is the main entry point for port writes
   * @param value The byte value to write
   */
  writePort(value: number): void {
    // Step 2: Follow-byte mechanism — check if in the middle of a follow sequence.
    // This takes priority over the legacy registerWriteSeq path.
    if (this.numFollow > 0) {
      const nreg = this.regsFollow[this.curFollow];
      this.curFollow++;
      if (this.curFollow >= this.numFollow) {
        this.numFollow = 0;
        this.curFollow = 0;
      }
      this.handleFollowByte(nreg, value);
      // Keep registerWriteSeq in sync with remaining follow state
      this.registerWriteSeq = this.numFollow > 0
        ? this.regSeqFromRegNum(this.regsFollow[this.curFollow])
        : RegisterWriteSequence.IDLE;
      return;
    }

    // Legacy: check if in a multi-byte sequence driven by registerWriteSeq.
    // This path is used when writeWRx() is called directly (e.g. from tests).
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

    // Step 3: Base byte dispatch using MAME's z80dma.cpp write() order and masks exactly.
    //   1. (data & 0x87) == 0x00  → WR2
    //   2. (data & 0x87) == 0x04  → WR1
    //   3. (data & 0x80) == 0x00  → WR0 (catch-all for D7=0)
    //   4. (data & 0x83) == 0x80  → WR3
    //   5. (data & 0x83) == 0x81  → WR4
    //   6. (data & 0xc7) == 0x82  → WR5
    //   7. else                   → WR6
    let regGroup: number;
    if ((value & 0x87) === 0x00) {
      this.writeWR2(value);
      regGroup = 2;
    } else if ((value & 0x87) === 0x04) {
      this.writeWR1(value);
      regGroup = 1;
    } else if ((value & 0x80) === 0x00) {
      // Catch-all for D7=0: WR0
      this.writeWR0(value);
      regGroup = 0;
    } else if ((value & 0x83) === 0x80) {
      this.writeWR3(value);
      regGroup = 3;
    } else if ((value & 0x83) === 0x81) {
      this.writeWR4(value);
      regGroup = 4;
    } else if ((value & 0xc7) === 0x82) {
      this.writeWR5(value);
      regGroup = 5;
    } else {
      // (value & 0x83) === 0x83: WR6 command register
      this.writeWR6(value);
      regGroup = 6;
    }
    // Step 2: Set up the follow queue for the detected register group.
    // This overrides registerWriteSeq set inside writeWRx() so that subsequent
    // writePort() calls use the conditional follow mechanism.
    this.setupFollowQueue(regGroup, value);
  }

  /**
   * Write to WR0 register
   * Base byte: D7=0, D6=direction, D5=search control, D4-D3=interrupt mode, D2-D0=parameters
   * Parameters: Port A start address (16-bit), block length (16-bit)
   */
  writeWR0(value: number): void {
    if (this.registerWriteSeq === RegisterWriteSequence.IDLE) {
      // Step 1: Store base byte in raw register array
      this.regs[RNUM_WR0_BASE] = value;
      // First write - store base byte and extract WR0 control bits
      this._tempRegisterByte = value;
      
      // D6: Direction bit (0=A→B, 1=B→A)
      const direction = (value & MASK_WR0_DIRECTION) !== 0;
      this.registers.directionAtoB = direction;
      
      // D5: Search control (0=Transfer mode, 1=Search mode)
      this.registers.searchControl = (value & MASK_WR0_SEARCH_CONTROL) !== 0;
      
      // D4-D3: Interrupt control mode
      this.registers.interruptControl = (value & MASK_WR0_INTERRUPT_MODE) >> SHIFT_WR0_INTERRUPT_MODE;
      
      this.registerWriteSeq = RegisterWriteSequence.R0_BYTE_0;
    } else if (this.registerWriteSeq === RegisterWriteSequence.R0_BYTE_0) {
      // Step 1: Store in raw register array
      this.regs[RNUM_PORT_A_ADDR_L] = value;
      // Port A start address - low byte
      this.registers.portAStartAddress = (this.registers.portAStartAddress & ADDR_MASK_HIGH_BYTE) | value;
      this.registerWriteSeq = RegisterWriteSequence.R0_BYTE_1;
    } else if (this.registerWriteSeq === RegisterWriteSequence.R0_BYTE_1) {
      // Step 1: Store in raw register array
      this.regs[RNUM_PORT_A_ADDR_H] = value;
      // Port A start address - high byte
      this.registers.portAStartAddress = (this.registers.portAStartAddress & ADDR_MASK_LOW_BYTE) | (value << BYTE_SHIFT);
      this.registerWriteSeq = RegisterWriteSequence.R0_BYTE_2;
    } else if (this.registerWriteSeq === RegisterWriteSequence.R0_BYTE_2) {
      // Step 1: Store in raw register array
      this.regs[RNUM_BLOCKLEN_L] = value;
      // Block length - low byte
      this.registers.blockLength = (this.registers.blockLength & ADDR_MASK_HIGH_BYTE) | value;
      this.registerWriteSeq = RegisterWriteSequence.R0_BYTE_3;
    } else if (this.registerWriteSeq === RegisterWriteSequence.R0_BYTE_3) {
      // Step 1: Store in raw register array
      this.regs[RNUM_BLOCKLEN_H] = value;
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
      // Step 1: Store base byte in raw register array
      this.regs[RNUM_WR1_BASE] = value;
      // First write - store base byte and extract Port A configuration
      this._tempRegisterByte = value;
      
      // D3: Port A type (1=I/O, 0=Memory)
      this.registers.portAIsIO = (value & MASK_WR12_IO_FLAG) !== 0;
      
      // D5-D4: Address mode (0=Decrement, 1=Increment, 2/3=Fixed)
      const addressModeValue = (value & MASK_WR12_ADDRESS_MODE) >> SHIFT_WR12_ADDRESS_MODE;
      this.registers.portAAddressMode = addressModeValue as AddressMode;
      
      // D6: Check if timing byte follows
      if ((value & MASK_WR12_TIMING_FOLLOWS) === 0) {
        // No timing byte follows - return to IDLE
        this.registerWriteSeq = RegisterWriteSequence.IDLE;
      } else {
        // Timing byte follows
        this.registerWriteSeq = RegisterWriteSequence.R1_BYTE_0;
      }
    } else if (this.registerWriteSeq === RegisterWriteSequence.R1_BYTE_0) {
      // Step 1: Store timing byte in raw register array
      this.regs[RNUM_PORT_A_TIMING] = value;
      // Store timing byte and extract cycle length from D1-D0
      this.registers.portATimingValue = value;
      const cycleLengthBits = value & MASK_CYCLE_LENGTH;
      this.registers.portATimingCycleLength = cycleLengthBits as CycleLength;
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
      // Step 1: Store base byte in raw register array
      this.regs[RNUM_WR2_BASE] = value;
      // First write - store base byte and extract Port B configuration
      this._tempRegisterByte = value;
      
      // D3: Port B type (1=I/O, 0=Memory)
      this.registers.portBIsIO = (value & MASK_WR12_IO_FLAG) !== 0;
      
      // D5-D4: Address mode (0=Decrement, 1=Increment, 2/3=Fixed)
      const addressModeValue = (value & MASK_WR12_ADDRESS_MODE) >> SHIFT_WR12_ADDRESS_MODE;
      this.registers.portBAddressMode = addressModeValue as AddressMode;
      
      // D6: Check if timing byte follows
      if ((value & MASK_WR12_TIMING_FOLLOWS) === 0) {
        // No timing byte follows - return to IDLE
        this.registerWriteSeq = RegisterWriteSequence.IDLE;
      } else {
        // Timing byte follows
        this.registerWriteSeq = RegisterWriteSequence.R2_BYTE_0;
      }
    } else if (this.registerWriteSeq === RegisterWriteSequence.R2_BYTE_0) {
      // Step 1: Store timing byte in raw register array
      this.regs[RNUM_PORT_B_TIMING] = value;
      // Store timing byte and extract cycle length from D1-D0
      this.registers.portBTimingValue = value;
      const cycleLengthBits = value & MASK_CYCLE_LENGTH;
      this.registers.portBTimingCycleLength = cycleLengthBits as CycleLength;
      // Step 5: Prescaler follows only when timing byte D5=1 (matches specnext_dma behaviour)
      this.registerWriteSeq = (value & 0x20)
        ? RegisterWriteSequence.R2_BYTE_1
        : RegisterWriteSequence.IDLE;
    } else if (this.registerWriteSeq === RegisterWriteSequence.R2_BYTE_1) {
      // Step 1: Store prescaler in raw register array
      this.regs[RNUM_ZXN_PRESCALER] = value;
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
      // Step 1: Store base byte in raw register array
      this.regs[RNUM_WR3_BASE] = value;
      // D0: DMA enable flag
      this.registers.dmaEnabled = (value & 0x01) !== 0;
      // Step 6: D6=1 triggers DMA start (like MAME's enable()), without changing the dmaEnabled flag
      if (value & 0x40) {
        this.dmaState = DmaState.START_DMA;
      }
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
      // Step 1: Store base byte in raw register array
      this.regs[RNUM_WR4_BASE] = value;
      // First write - store base byte and extract transfer mode
      this._tempRegisterByte = value;
      
      // D4: Transfer mode (1=Continuous, 2=Burst)
      const modeValue = (value >> 4) & 0x01;
      this.registers.transferMode = modeValue === 0 ? TransferMode.BURST : TransferMode.CONTINUOUS;
      
      this.registerWriteSeq = RegisterWriteSequence.R4_BYTE_0;
    } else if (this.registerWriteSeq === RegisterWriteSequence.R4_BYTE_0) {
      // Step 1: Store in raw register array
      this.regs[RNUM_PORT_B_ADDR_L] = value;
      // Port B start address - low byte
      this.registers.portBStartAddress = (this.registers.portBStartAddress & 0xff00) | value;
      this.registerWriteSeq = RegisterWriteSequence.R4_BYTE_1;
    } else if (this.registerWriteSeq === RegisterWriteSequence.R4_BYTE_1) {
      // Step 1: Store in raw register array
      this.regs[RNUM_PORT_B_ADDR_H] = value;
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
      // Step 1: Store base byte in raw register array
      this.regs[RNUM_WR5_BASE] = value;
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
      // Step 1: Store base byte in raw register array
      this.regs[RNUM_WR6_BASE] = value;
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

        case 0xb3: // FORCE_READY
          this.forceReady = true;
          break;
          
        default:
          // Unknown command - ignore
          break;
      }
    } else if (this.registerWriteSeq === RegisterWriteSequence.R6_BYTE_0) {
      // Read mask byte follows READ_MASK_FOLLOWS command
      // Step 1: Store in raw register array
      this.regs[RNUM_READ_MASK] = value;
      this.registers.readMask = value & 0x7f;
      this.registerWriteSeq = RegisterWriteSequence.IDLE;
    }
  }

  /**
   * RESET command (0xC3) - Reset all DMA state
   */
  private executeReset(): void {
    // Step 7: Match MAME COMMAND_RESET
    // Disable DMA (equivalent to disable())
    this.dmaState = DmaState.IDLE;
    this.registers.dmaEnabled = false;

    // Clear control flags (m_force_ready, m_ip, m_ius)
    this.forceReady = false;
    this.ip = 0;
    this.ius = 0;

    // Progressive column reset: clear one column per RESET call (m_reset_pointer)
    // Needs 6 RESET commands to fully clear all register columns (WR0-WR6)
    for (let WRi = 0; WRi < 7; WRi++) {
      this.regs[WRi * 8 + this.resetPointer] = 0;
    }
    this.resetPointer = (this.resetPointer + 1) % 6;

    // specnext override: also clear prescaler on RESET
    this.registers.portBPrescalar = 0;
    this.prescalarTimer = 0;

    // Legacy compat: explicitly reset decoded fields that tests historically expect.
    // In full MAME progressive-reset semantics, these clear across multiple RESETs.
    // Kept for backward compatibility until Step 15 legacy cleanup.
    this.registers.portATimingCycleLength = CycleLength.CYCLES_3;
    this.registers.portBTimingCycleLength = CycleLength.CYCLES_3;
    this.registers.ceWaitMultiplexed = false;
    this.registers.autoRestart = false;

    // Set status to initial value (m_status = 0x38)
    this.m_status = 0x38;

    // Legacy status flags for backward compat
    this.statusFlags.endOfBlockReached = true;
    this.statusFlags.atLeastOneByteTransferred = false;

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

    // Step 7: forceReady = false per MAME COMMAND_LOAD
    this.forceReady = false;

    // Step 7: Reset byte counter (specnext: 0; legacy Zilog: 0xFFFF for length+1 compat)
    if (this.dmaMode === DmaMode.ZXNDMA) {
      this.transferState.byteCounter = 0;
    } else {
      this.transferState.byteCounter = 0xFFFF;  // -1 in 16-bit (legacy mode)
    }

    // Step 7: Load MAME-style independent address/count tracking
    this._addressA = this.registers.portAStartAddress;
    this._addressB = this.registers.portBStartAddress;
    this._count = this.registers.blockLength;

    // Step 7: Set status bits 5 and 4 per MAME (m_status |= 0x30)
    this.m_status |= 0x30;

    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }

  /**
   * CONTINUE command (0xD3) - Reset counter but keep current addresses
   * Used to continue a transfer from current positions
   */
  private executeContinue(): void {
    // Step 7: Reload count from registers per MAME (m_count = BLOCKLEN)
    this._count = this.registers.blockLength;

    // Step 7: Always reset byte counter to 0
    this.transferState.byteCounter = 0;

    // Step 7: Set status bits per MAME (m_status |= 0x30)
    this.m_status |= 0x30;

    // Keep current source and destination addresses unchanged
    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }

  /**
   * ENABLE_DMA command (0x87) - Start DMA transfer
   * Initializes counter based on mode: 0 for zxnDMA, -1 for legacy
   */
  private executeEnableDma(): void {
    // Enable DMA (enable())
    this.registers.dmaEnabled = true;

    // Step 7: mode-dependent byte counter initialization.
    // zxnDMA (specnext) override: set to 0. Legacy Zilog mode: set to 0xFFFF.
    this.transferState.byteCounter = this.dmaMode === DmaMode.ZXNDMA ? 0 : 0xFFFF;

    // Set DMA state to START_DMA so stepDma() will begin transfer
    this.dmaState = DmaState.START_DMA;

    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }

  /**
   * READ_STATUS_BYTE command (0xBF) - Prepare to read status
   * Status format: 00E1101T
   * - E (bit 5): End of block (inverted - 1=not reached, 0=reached)
   * - T (bit 0): At least one byte transferred
   */
  private executeReadStatusByte(): void {
    // Step 7: Set READ_MASK = 1 (status only) per MAME
    this.regs[RNUM_READ_MASK] = 1;
    this.registers.readMask = 1;
    this.registerReadSeq = RegisterReadSequence.RD_STATUS;
    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }

  /**
   * INITIALIZE_READ_SEQUENCE command (0xA7) - Start read sequence
   * Uses read mask to determine which registers to include in read sequence
   */
  private executeInitializeReadSequence(): void {
    // Step 7: setup_next_read(0) — find first set bit in READ_MASK from position 0
    this.setupNextRead(0);
    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }

  /**
   * REINITIALIZE_STATUS_BYTE command (0x8B) - Reset status and read sequence
   * Resets status flags and reinitializes the read sequence
   */
  private executeReinitializeStatusByte(): void {
    // Step 7: Match MAME COMMAND_REINITIALIZE_STATUS_BYTE
    this.m_status |= 0x30;
    this.ip = 0;

    // Legacy compat: reset status flags
    this.statusFlags.endOfBlockReached = true;
    this.statusFlags.atLeastOneByteTransferred = false;

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
      // Step 8: Port A address low byte - always use _addressA (Port A = m_addressA)
      value = this._addressA & 0xff;
      this.advanceReadSequence();
    } else if (this.registerReadSeq === RegisterReadSequence.RD_PORT_A_HI) {
      // Step 8: Port A address high byte - always use _addressA
      value = (this._addressA >> 8) & 0xff;
      this.advanceReadSequence();
    } else if (this.registerReadSeq === RegisterReadSequence.RD_PORT_B_LO) {
      // Step 8: Port B address low byte - always use _addressB (Port B = m_addressB)
      value = this._addressB & 0xff;
      this.advanceReadSequence();
    } else if (this.registerReadSeq === RegisterReadSequence.RD_PORT_B_HI) {
      // Step 8: Port B address high byte - always use _addressB
      value = (this._addressB >> 8) & 0xff;
      this.advanceReadSequence();
    }
    
    return value;
  }

  /**
   * MAME setup_next_read: advance to first enabled position >= rr in read mask
   */
  private setupNextRead(rr: number): void {
    const mask = this.registers.readMask;
    if (!mask) return;
    // RD_STATUS (pos 0) is always enabled; any other position is enabled by its mask bit
    let pos = rr % 7;
    while (!this.isReadPositionEnabled(pos as RegisterReadSequence, mask)) {
      pos = (pos + 1) % 7;
    }
    this.registerReadSeq = pos as RegisterReadSequence;
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

    // Step 8: Sync _addressA/_addressB to always track per-port running addresses.
    // After update, map source/dest back to Port A / Port B based on direction.
    if (this.registers.directionAtoB) {
      this._addressA = this.transferState.sourceAddress;  // Port A is source in A→B
      this._addressB = this.transferState.destAddress;    // Port B is dest in A→B
    } else {
      this._addressB = this.transferState.sourceAddress;  // Port B is source in B→A
      this._addressA = this.transferState.destAddress;    // Port A is dest in B→A
    }

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