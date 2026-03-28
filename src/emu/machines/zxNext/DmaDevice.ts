import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * DMA state machine states (legacy – kept for backward-compat)
 * getDmaState() derives a value from dmaSeq for callers that still import this enum.
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
 * Step 10: MAME-style DMA sequence states (m_dma_seq in z80dma.cpp).
 * stepDma() uses this enum internally; getDmaState() maps back to DmaState.
 */
export const enum DmaSeq {
  SEQ_IDLE = 0,
  SEQ_WAIT_READY = 1,
  SEQ_REQUEST_BUS = 2,
  SEQ_WAITING_ACK = 3,
  SEQ_TRANS1_INC_DEC_SOURCE = 4,
  SEQ_TRANS1_READ_SOURCE = 5,
  SEQ_TRANS1_INC_DEC_DEST = 6,
  SEQ_TRANS1_WRITE_DEST = 7,
  SEQ_FINISH = 8
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
 * Matches MAME z80dma OPERATING_MODE encoding (WR4 D6-D5):
 *   0b00 = Byte (one byte per bus cycle, not yet used by zxnDMA)
 *   0b01 = Continuous
 *   0b10 = Burst
 */
export const enum TransferMode {
  BYTE = 0,
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
 * WR0 Register direction bit mask.
 * Per Z80 DMA spec and MAME: PORTA_IS_SOURCE = (WR0 >> 2) & 0x01 — bit D2.
 * D2=1 → Port A is source (A→B transfer); D2=0 → Port B is source (B→A).
 */
const MASK_WR0_DIRECTION = 0x04;    // Direction bit D2 (A->B vs B->A)

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
  
  // WR0 - Control bits (D1-D0)
  // Note: D3-D6 are follow-byte indicators only (not decoded here).
  transferModeWR0: number;  // D1-D0: Transfer mode (01=Transfer, 10=Search, 11=Search+Transfer)

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
  // Step 10: MAME-style sequence state (replaces dmaState internally)
  private dmaSeq: DmaSeq = DmaSeq.SEQ_IDLE;
  // Step 12: specnext_dma m_dma_delay — stalls DMA at WAIT_READY and forces single-byte
  // mode for continuous transfers (one byte per external trigger).
  private dmaDelay: boolean = false;
  private registerWriteSeq: RegisterWriteSequence = RegisterWriteSequence.IDLE;
  private registerReadSeq: RegisterReadSequence = RegisterReadSequence.RD_STATUS;
  private _tempRegisterByte: number = 0;  // Stores first byte of WR0-WR6 for parameter parsing
  private _transferDataByte: number = 0;  // Stores data byte during read-write cycle

  private dmaMode: DmaMode = DmaMode.ZXNDMA;
  private prescalarTimer: number = 0;  // Timer for fixed-rate transfers
  // Monotonically-increasing counter incremented each time handleTransferFinish() runs.
  // Used by executeContinuousTransfer() to detect block completions without relying on
  // SEQ_FINISH being a stable observable state (it is immediately overwritten inline).
  private _blockCompletionCount: number = 0;

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
  private m_status: number = 0;        // Raw status byte (m_status in MAME); 0x38 set by COMMAND_RESET only
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
      transferModeWR0: 0,
      
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
    this.dmaSeq = DmaSeq.SEQ_IDLE;  // Step 10
    this.dmaDelay = false;           // Step 12
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

    // Step 36: MAME device_reset() sets m_status = 0 (COMMAND_RESET sets 0x38)
    this.m_status = 0;
    
    // Cache fields cleared on reset
  }

  // ============================================================================
  // State Getters & Setters
  // ============================================================================

  getDmaState(): DmaState {
    // Step 10: derive from MAME-style dmaSeq for backward compatibility
    switch (this.dmaSeq) {
      case DmaSeq.SEQ_IDLE:             return DmaState.IDLE;
      case DmaSeq.SEQ_WAIT_READY:
      case DmaSeq.SEQ_REQUEST_BUS:      return DmaState.START_DMA;
      case DmaSeq.SEQ_WAITING_ACK:      return DmaState.WAITING_ACK;
      case DmaSeq.SEQ_TRANS1_INC_DEC_SOURCE: return DmaState.TRANSFERRING_READ_1;
      case DmaSeq.SEQ_TRANS1_READ_SOURCE:    return DmaState.TRANSFERRING_READ_2;
      case DmaSeq.SEQ_TRANS1_INC_DEC_DEST:   return DmaState.TRANSFERRING_WRITE_1;
      case DmaSeq.SEQ_TRANS1_WRITE_DEST:     return DmaState.TRANSFERRING_WRITE_2;
      case DmaSeq.SEQ_FINISH:           return DmaState.FINISH_DMA;
      default:                          return DmaState.IDLE;
    }
  }

  getDmaSeq(): DmaSeq {
    return this.dmaSeq;
  }

  getDmaDelay(): boolean {
    return this.dmaDelay;
  }

  setDmaDelay(value: boolean): void {
    this.dmaDelay = value;
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
    // Derive source/dest addresses from the MAME-style independent A/B addresses.
    // Port A is source when WR0 bit 6 = 1 (A→B direction); Port B is source otherwise.
    const portAIsSource = this.portaIsSource();
    return {
      ...this.transferState,
      sourceAddress: portAIsSource ? this._addressA : this._addressB,
      destAddress:   portAIsSource ? this._addressB : this._addressA,
    };
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

    // Transfer mode validation (BYTE mode is not yet used by zxnDMA but is a valid Z80 DMA mode)
    if (this.registers.transferMode !== TransferMode.CONTINUOUS && 
        this.registers.transferMode !== TransferMode.BURST &&
        this.registers.transferMode !== TransferMode.BYTE) {
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
        // Step 35: MAME calls setup_next_read(0) after the READ_MASK follow byte is
        // consumed, re-initialising the read pointer to the first set bit in the new mask.
        this.setupNextRead(0);
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
      case 4: // WR4: D2=portB_addr_lo, D3=portB_addr_hi, D4=interrupt_ctrl
        if (baseValue & 0x04) this.regsFollow[this.numFollow++] = RNUM_PORT_B_ADDR_L;
        if (baseValue & 0x08) this.regsFollow[this.numFollow++] = RNUM_PORT_B_ADDR_H;
        if (baseValue & 0x10) this.regsFollow[this.numFollow++] = RNUM_INTERRUPT_CTRL;
        break;
      case 6: // WR6: only READ_MASK_FOLLOWS (0xBB) needs a follow byte
        if (baseValue === 0xbb) this.regsFollow[this.numFollow++] = RNUM_READ_MASK;
        break;
      case 3: // WR3: D3=mask_byte, D4=match_byte; D6 triggers DMA start (not dmaEnabled flag)
        if (baseValue & 0x08) this.regsFollow[this.numFollow++] = RNUM_MASK_BYTE;
        if (baseValue & 0x10) this.regsFollow[this.numFollow++] = RNUM_MATCH_BYTE;
        if (baseValue & 0x40) {
          this.enable();  // Step 10: D6=1 → enable() (sets dmaSeq = SEQ_WAIT_READY)
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
      // Step 33: MAME increments m_reset_pointer after every follow byte (wraps at 6).
      this.resetPointer = (this.resetPointer + 1) % 6;
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
    // Step 32: MAME resets m_reset_pointer to 0 at the start of every base-byte write.
    this.resetPointer = 0;
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
   * Base byte: D7=0, D6=Block length hi follows, D5=Block length lo follows,
   *            D4=Port A addr hi follows, D3=Port A addr lo follows,
   *            D2=PORTA_IS_SOURCE (direction), D1-D0=Transfer mode
   * Parameters: Port A start address (16-bit), block length (16-bit)
   */
  writeWR0(value: number): void {
    if (this.registerWriteSeq === RegisterWriteSequence.IDLE) {
      // Step 1: Store base byte in raw register array
      this.regs[RNUM_WR0_BASE] = value;
      // First write - store base byte and extract WR0 control bits
      this._tempRegisterByte = value;
      
      // D2: Direction bit — 1 = Port A is source (A→B); 0 = Port B is source (B→A)
      // Per Z80 DMA spec and MAME: PORTA_IS_SOURCE = (WR0 >> 2) & 0x01
      this.registers.directionAtoB = (value & MASK_WR0_DIRECTION) !== 0;

      // D1-D0: Transfer mode (01=Transfer, 10=Search, 11=Search+Transfer)
      // Step 18b: D3-D6 are follow-byte indicators only, not decoded as control fields.
      this.registers.transferModeWR0 = value & 0x03;
      
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
      // Step 6/10: D6=1 triggers DMA start via enable() (like MAME's enable())
      if (value & 0x40) {
        this.enable();
      }
      this.registerWriteSeq = RegisterWriteSequence.IDLE;
    }
  }

  /**
   * Write to WR4 register
   * Base byte: D7=1, D6-D5=operatingMode, D4=interrupt ctrl follows, D3=portB addr hi follows,
   *            D2=portB addr lo follows, D1=0, D0=1 (WR4 identifier)
   * Parameters: Port B start address (16-bit), optionally interrupt ctrl byte
   */
  writeWR4(value: number): void {
    if (this.registerWriteSeq === RegisterWriteSequence.IDLE) {
      // Step 1: Store base byte in raw register array
      this.regs[RNUM_WR4_BASE] = value;
      // First write - store base byte and extract operating mode
      this._tempRegisterByte = value;
      
      // D6-D5: Operating mode per MAME z80dma: 0b00=Byte, 0b01=Continuous, 0b10=Burst, 0b11=do not program
      const modeValue = (value >> 5) & 0x03;
      if (modeValue === 0b01) this.registers.transferMode = TransferMode.CONTINUOUS;
      else if (modeValue === 0b10) this.registers.transferMode = TransferMode.BURST;
      else if (modeValue === 0b00) this.registers.transferMode = TransferMode.BYTE;
      // 0b11 = "do not program": leave transferMode unchanged
      
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

        case 0xaf: // DISABLE_INTERRUPTS: WR3 &= ~0x20 (clear interrupt enable bit D5)
          this.regs[RNUM_WR3_BASE] &= ~0x20;
          break;

        case 0xab: // ENABLE_INTERRUPTS: WR3 |= 0x20 (set interrupt enable bit D5)
          this.regs[RNUM_WR3_BASE] |= 0x20;
          break;

        case 0xa3: // RESET_AND_DISABLE_INTERRUPTS: disable interrupts + clear ip/ius/force_ready
          this.regs[RNUM_WR3_BASE] &= ~0x20;
          this.ip = 0;
          this.ius = 0;
          this.forceReady = false;
          this.m_status |= 0x08;
          break;

        case 0xb3: // FORCE_READY
          this.forceReady = true;
          break;

        case 0xb7: // ENABLE_AFTER_RETI — not implemented (matches MAME fatalerror)
          // MAME calls fatalerror(); we silently ignore.
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
    // Step 7/10: Match MAME COMMAND_RESET — disable() then progressive column reset
    this.disableDma();  // dmaSeq = SEQ_IDLE, bus released (does not touch dmaEnabled)
    this.registers.dmaEnabled = false;  // explicitly clear on RESET

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
    // Step 34: MAME writes PORTA_TIMING = REG(1,1) = 0; zero raw register too.
    this.regs[RNUM_PORT_A_TIMING] = 0;
    this.registers.portATimingCycleLength = CycleLength.CYCLES_3;
    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }

  /**
   * RESET_PORT_B_TIMING command (0xCB) - Reset Port B timing to default
   */
  private executeResetPortBTiming(): void {
    // Step 34: MAME writes PORTB_TIMING = REG(2,1) = 0; zero raw register too.
    this.regs[RNUM_PORT_B_TIMING] = 0;
    this.registers.portBTimingCycleLength = CycleLength.CYCLES_3;
    this.registers.portBPrescalar = 0;
    this.prescalarTimer = 0;
    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }

  /**
   * DISABLE_DMA command (0x83) - Stop DMA transfer
   */
  private executeDisableDma(): void {
    this.registers.dmaEnabled = false;  // explicitly clear dmaEnabled flag
    this.disableDma();  // Step 10: use shared helper (does not touch dmaEnabled)
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
    // Step 7: mode-dependent byte counter initialization.
    // zxnDMA (specnext) override: set to 0. Legacy Zilog mode: set to 0xFFFF.
    this.transferState.byteCounter = this.dmaMode === DmaMode.ZXNDMA ? 0 : 0xFFFF;

    // Explicitly set dmaEnabled flag (enable() does not touch it)
    this.registers.dmaEnabled = true;

    // Step 10: call enable() like MAME (sets dmaSeq = SEQ_WAIT_READY)
    this.enable();

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

    // Step 13: MAME does NOT reset readCurFollow on REINITIALIZE_STATUS_BYTE.
    // Only INITIALIZE_READ_SEQUENCE (0xA7) resets the read position.
    this.registerWriteSeq = RegisterWriteSequence.IDLE;
  }

  // ============================================================================
  // Status Byte Management & Read Sequences
  // ============================================================================

  /**
   * Read the next byte in the register read sequence.
   * Step 13: Matches MAME z80dma_device::read() exactly.
   * - Position 0: m_status (raw status byte, NOT computed from legacy flags)
   * - Positions 1-6: byte counter, addressA, addressB
   * - Advance only when READ_MASK has more than one bit set
   *   (READ_STATUS_BYTE sets mask=1, so status is returned permanently).
   */
  readStatusByte(): number {
    const pos = this.registerReadSeq;
    let value: number;

    switch (pos) {
      case 0: value = this.m_status;                                break; // RR0: status
      case 1: value = this.transferState.byteCounter & 0xff;       break; // RR1: byte counter lo
      case 2: value = (this.transferState.byteCounter >> 8) & 0xff; break; // RR2: byte counter hi
      case 3: value = this._addressA & 0xff;                        break; // RR3: port A lo
      case 4: value = (this._addressA >> 8) & 0xff;                 break; // RR4: port A hi
      case 5: value = this._addressB & 0xff;                        break; // RR5: port B lo
      default: value = (this._addressB >> 8) & 0xff;                break; // RR6: port B hi
    }

    // MAME advance condition: only advance when READ_MASK has more than one bit set.
    // Single-bit mask (e.g. READ_MASK=1) keeps cursor fixed on that position forever.
    const mask = this.regs[RNUM_READ_MASK];
    if ((mask & (mask - 1)) !== 0) {
      this.setupNextRead((pos + 1) & 7);
    }

    return value;
  }

  /**
   * Step 13: MAME setup_next_read — find first enabled position >= rr in READ_MASK.
   * READ_MASK bit layout (MAME): bit n enables position n.
   *   Bit 0 → pos 0 (status)       Bit 4 → pos 4 (port A hi)
   *   Bit 1 → pos 1 (byte ctr lo)  Bit 5 → pos 5 (port B lo)
   *   Bit 2 → pos 2 (byte ctr hi)  Bit 6 → pos 6 (port B hi)
   *   Bit 3 → pos 3 (port A lo)
   */
  private setupNextRead(rr: number): void {
    const mask = this.regs[RNUM_READ_MASK];
    if (!mask) return;  // no bits set — leave cursor unchanged
    while (!(mask & (1 << rr))) {
      rr = (rr + 1) & 7;
    }
    this.registerReadSeq = rr as RegisterReadSequence;
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
    // Step 10: use dmaSeq (SEQ_IDLE means DMA is off / done)
    return this.dmaSeq !== DmaSeq.SEQ_IDLE;
  }

  // ============================================================================
  // Step 10: MAME-style enable / disable / isReady helpers
  // ============================================================================

  /**
   * Enable DMA – sets the MAME SEQ_WAIT_READY state (m_dma_seq = SEQ_WAIT_READY).
   * Called internally by ENABLE_DMA command and WR3/WR0 D6 trigger.
   * Does NOT touch registers.dmaEnabled — callers manage that flag explicitly.
   */
  private enable(): void {
    this.dmaSeq = DmaSeq.SEQ_WAIT_READY;
    this.dmaState = DmaState.START_DMA;  // keep legacy field in sync
  }

  /**
   * Disable DMA – stops the state machine, releases bus.
   * Equivalent to MAME's z80dma_device::disable().
   * Does NOT touch registers.dmaEnabled — callers manage that flag explicitly.
   */
  private disableDma(): void {
    this.dmaSeq = DmaSeq.SEQ_IDLE;
    this.dmaState = DmaState.IDLE;       // keep legacy field in sync
    this.releaseBus();
  }

  /**
   * Check if DMA is ready to transfer (MAME is_ready()).
   * In this emulator there is no external RDY pin, so the DMA is always
   * considered ready (unless forceReady is the only gate – which still passes).
   */
  private isReady(): boolean {
    return true;  // No external RDY signal in this emulator
  }

  // ============================================================================
  // Step 23: MAME-aligned interrupt trigger
  // ============================================================================

  /**
   * Trigger a DMA interrupt — mirrors MAME z80dma_device::trigger_interrupt(level).
   *
   * Guards:
   *   1. !m_ius — do not fire if an interrupt is already under service.
   *   2. INTERRUPT_ENABLE (WR3 bit D5) — global interrupt enable gate.
   *
   * Vector computation:
   *   If STATUS_AFFECTS_VECTOR (INTERRUPT_CTRL bit D2 of WR4 follow byte):
   *     vector = (INTERRUPT_VECTOR & 0xF9) | (level << 1)
   *   Else:
   *     vector = INTERRUPT_VECTOR
   *
   * @param level  Interrupt level (0 = INT_END_OF_BLOCK, as used by MAME)
   */
  private triggerInterrupt(level: number): void {
    // Guard 1: do not fire if an interrupt is already under service
    if (this.ius) return;

    // Guard 2: INTERRUPT_ENABLE — WR3 bit D5
    const interruptEnable = (this.regs[RNUM_WR3_BASE] & 0x20) !== 0;
    if (!interruptEnable) return;

    // Set interrupt pending
    this.ip = 1;

    // STATUS_AFFECTS_VECTOR — INTERRUPT_CTRL bit D2 (WR4 interrupt control byte)
    const statusAffectsVector = (this.regs[RNUM_INTERRUPT_CTRL] & 0x04) !== 0;
    if (statusAffectsVector) {
      this.regs[RNUM_INTERRUPT_VECTOR] =
        (this.regs[RNUM_INTERRUPT_VECTOR] & 0xF9) | ((level & 0x03) << 1);
    }
    // (else: INTERRUPT_VECTOR remains as programmed)

    // MAME trigger_interrupt clears bit 3 of m_status (IUS flag in status byte)
    this.m_status &= ~0x08;
    // Note: interrupt_check() drives the INT output line; not applicable
    // in a pure-emulator context without external interrupt routing.
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
   * Step 10: Step the MAME-style DMA state machine forward by one "clock tick".
   *
   * Modelled on z80dma_device::clock_w() (base) and specnext_dma_device::clock_w()
   * (overrides for dma_delay / prescaler).  In our emulator the state machine runs
   * synchronously inside this method instead of via hardware timers:
   *
   *   SEQ_IDLE → (never enters)
   *   SEQ_WAIT_READY → SEQ_REQUEST_BUS (or skip to SEQ_TRANS1 in continuous mode)
   *   SEQ_REQUEST_BUS → SEQ_WAITING_ACK (bus request sent, return 0)
   *   SEQ_WAITING_ACK → SEQ_TRANS1_INC_DEC_SOURCE + full byte transfer
   *   SEQ_TRANS1_* → full byte transfer in one call (read + write) → return T-states
   *   SEQ_FINISH → disable() + auto-restart check, return 0
   *
   * Returns the T-states consumed (0 when waiting / done, >0 when a byte was moved).
   */
  stepDma(): number {
    switch (this.dmaSeq) {
      case DmaSeq.SEQ_IDLE:
        return 0;

      case DmaSeq.SEQ_WAIT_READY: {
        if (!this.isReady()) return 0;
        // Step 12: dma_delay stall — mirrors specnext_dma clock_w early return at WAIT_READY.
        // When delay is active, do NOT request the bus.  An external setDmaDelay(false) call
        // is needed to allow the transfer to continue.
        if (this.dmaDelay) return 0;
        // Step 24: Zero-length transfer — intentional deviation from MAME.
        // MAME: when m_count=0, is_final is always false (m_count && ... short-circuits),
        // so the transfer runs indefinitely (acknowledged as a "hack" in MAME comments).
        // We treat count=0 as an immediate no-op / completion, which is more practical:
        // transferring 0 bytes should finish cleanly rather than loop forever.
        if (this._count === 0) {
          this.handleTransferFinish();
          return 0;
        }
        // Determine configured operating mode from decoded registers (not raw WR4 bits)
        const configuredOpMode = this.registers.transferMode === TransferMode.BURST ? 0b10
                               : this.registers.transferMode === TransferMode.CONTINUOUS ? 0b01
                               : 0b00;
        // Continuous mode skips bus re-request after the first byte
        if (configuredOpMode === 0b01 && this.transferState.byteCounter !== 0) {
          this.dmaSeq = DmaSeq.SEQ_TRANS1_INC_DEC_SOURCE;
          return this.executeTransferByte();
        }
        this.requestBus();
        this.dmaSeq = DmaSeq.SEQ_WAITING_ACK;
        return 0;
      }

      case DmaSeq.SEQ_REQUEST_BUS:
        // Bus request was already sent in SEQ_WAIT_READY; just wait for ack.
        return 0;

      case DmaSeq.SEQ_WAITING_ACK:
        if (!this.isBusAvailable()) return 0;
        this.dmaSeq = DmaSeq.SEQ_TRANS1_INC_DEC_SOURCE;
        return this.executeTransferByte();

      case DmaSeq.SEQ_TRANS1_INC_DEC_SOURCE:
      case DmaSeq.SEQ_TRANS1_READ_SOURCE:
      case DmaSeq.SEQ_TRANS1_INC_DEC_DEST:
      case DmaSeq.SEQ_TRANS1_WRITE_DEST:
        return this.executeTransferByte();

      case DmaSeq.SEQ_FINISH:
        this.handleTransferFinish();
        return 0;

      default:
        return 0;
    }
  }

  /**
   * Execute one complete byte transfer (INC_DEC_SOURCE → READ → INC_DEC_DEST → WRITE)
   * and dispatch to the next state based on the operating mode / is_final flag.
   * Returns the T-states consumed by the read+write cycle.
   *
   * is_final logic: triggers when (byteCounter + 1) === count, meaning the CURRENT byte
   * being processed is the last one.  After performWriteCycle() increments byteCounter,
   * the final value will be exactly equal to _count.  No separate specnext pre-increment
   * is needed — this formula naturally handles both zxnDMA (exact N bytes) and legacy
   * (N+1 bytes, since byteCounter starts at 0xFFFF = -1) modes.
   */
  private executeTransferByte(): number {
    // INC_DEC_SOURCE + READ_SOURCE: do_read
    this.dmaSeq = DmaSeq.SEQ_TRANS1_INC_DEC_SOURCE;
    this.performReadCycle();

    // Step 26: Search mode — check for byte match after reading.
    // transferModeWR0: 0b01=Transfer, 0b10=Search, 0b11=Search+Transfer.
    // Bit 1 (0x02) of transferModeWR0 means "search active".
    const searchActive = (this.registers.transferModeWR0 & 0x02) !== 0;
    let matchFound = false;
    if (searchActive) {
      const maskByte  = this.regs[RNUM_MASK_BYTE];
      const matchByte = this.regs[RNUM_MATCH_BYTE];
      // Step 29: MAME do_search() OR semantics — mask 1-bits are don't-care.
      // (byte | MASK) === (MATCH | MASK): both sides have mask bits forced to 1,
      // so only bits where MASK=0 are compared.
      //   MASK=0x00 → exact byte match;  MASK=0xFF → always matches (all bits don't-care).
      matchFound = (this._transferDataByte | maskByte) === (matchByte | maskByte);
      if (matchFound) {
        // Step 31: bit 2 (0x04) is a ZXN-specific extension — not in Z80 DMA spec or MAME.
        // MAME do_search() fires an interrupt but sets no status bit; the match is signalled
        // only via INT_MATCH. We keep this bit as a useful non-standard diagnostic indicator.
        this.m_status |= 0x04;
        // Step 30: Gate the interrupt on INT_ON_MATCH (INTERRUPT_CTRL bit 0), mirroring MAME:
        //   `if (INT_ON_MATCH && load_byte == match_byte) trigger_interrupt(INT_MATCH);`
        const intOnMatch = (this.regs[RNUM_INTERRUPT_CTRL] & 0x01) !== 0;
        if (intOnMatch) {
          this.triggerInterrupt(1);  // INT_MATCH = level 1
        }
      }
    }

    // is_final: true when this is the last byte to transfer.
    // (byteCounter + 1) == count means "writing this byte will bring counter to count".
    // Also final when search mode produced a match and STOP_ON_MATCH (WR5 D2) is set.
    const stopOnMatch = (this.regs[RNUM_WR5_BASE] & 0x04) !== 0;
    const isFinal = (this._count !== 0 &&
                     (this.transferState.byteCounter + 1) === this._count)
                 || (searchActive && matchFound && stopOnMatch);

    // INC_DEC_DEST + WRITE_DEST: do_write (updates addresses + increments byteCounter).
    // Pure Search mode (transferModeWR0=0b10, bit 0 clear) skips the actual memory write
    // but still updates addresses and the counter (mirrors MAME do_write() behaviour).
    const doWrite = (this.registers.transferModeWR0 & 0x01) !== 0  // Transfer bit
                 || this.registers.transferModeWR0 === 0;            // mode 0 = default transfer
    this.dmaSeq = DmaSeq.SEQ_TRANS1_WRITE_DEST;
    this.performWriteCycle(doWrite);

    // Configured operating mode from decoded registers (handles WR4 byte encoding correctly)
    const configuredOpMode = this.registers.transferMode === TransferMode.BURST ? 0b10
                            : this.registers.transferMode === TransferMode.CONTINUOUS ? 0b01
                            : 0b00;

    // Effective mode: override to 0b11 (FINISH) when this was the last byte
    const effectiveOpMode = isFinal ? 0b11 : configuredOpMode;

    switch (effectiveOpMode) {
      case 0b00: // Byte mode: release bus, wait for next trigger
        this.releaseBus();
        this.dmaSeq = DmaSeq.SEQ_WAIT_READY;
        break;

      case 0b01: // Continuous: stay on bus, go straight back to INC_DEC_SOURCE
        this.dmaSeq = this.isReady()
          ? DmaSeq.SEQ_TRANS1_INC_DEC_SOURCE
          : DmaSeq.SEQ_WAIT_READY;
        break;

      case 0b10: // Burst: keep bus if ready (MAME behavior), release only if not ready
        if (this.isReady()) {
          this.dmaSeq = DmaSeq.SEQ_TRANS1_INC_DEC_SOURCE;
        } else {
          this.releaseBus();
          this.dmaSeq = DmaSeq.SEQ_WAIT_READY;
        }
        break;

      default: // 0b11 = is_final → FINISH
        this.dmaSeq = DmaSeq.SEQ_FINISH;
        this.handleTransferFinish();
        break;
    }

    // Step 12: dma_delay override — mirrors specnext_dma clock_w logic:
    //   if (dma_delay && next-state == SEQ_TRANS1_INC_DEC_SOURCE_ADDRESS) {
    //     set_busrq(CLEAR_LINE); dma_seq = SEQ_WAIT_READY; return; }
    // When the delay is active and the mode dispatch has set the next state to
    // INC_DEC_SOURCE (continuous or burst mode continuing to the next byte),
    // intercept and force "release bus → WAIT_READY" instead.
    if (this.dmaDelay && this.dmaSeq === DmaSeq.SEQ_TRANS1_INC_DEC_SOURCE) {
      this.releaseBus();
      this.dmaSeq = DmaSeq.SEQ_WAIT_READY;
    }

    // Return T-states based on the CONFIGURED mode (not the effective/overridden mode).
    // Step 28: When ZXN_PRESCALER is non-zero, apply prescaler timing for ALL operating
    // modes, not just Burst — mirroring MAME specnext_dma_device::clock_w() which gates
    // the prescaler delay on `m_r2_portB_preescaler_s != 0` regardless of mode.
    // The bus is only released (forcing WAIT_READY) for Burst mode.
    if (this.registers.portBPrescalar !== 0) {
      const prescalar = this.registers.portBPrescalar;
      return Math.floor((prescalar * PRESCALAR_REFERENCE_FREQ) / PRESCALAR_AUDIO_FREQ);
    }
    return this.calculateDmaTransferTiming();
  }

  /**
   * Handle transfer completion (MAME SEQ_FINISH handler + specnext auto-restart).
   * Sets m_status, disables DMA, and restarts if AUTO_RESTART is set.
   */
  private handleTransferFinish(): void {
    this._blockCompletionCount++;
    this.disableDma();  // stops state machine and releases bus (does not clear dmaEnabled)

    // MAME: m_status = 0x09 | (!is_ready << 1) | (TM_TRANSFER ? 0x10 : 0)
    // Step 31: Preserve ZXN-specific match bit (0x04) — MAME sets m_status=0x09 unconditionally
    // (bit 2 is undefined/reserved in the Z80 DMA spec). Klive extends it as a non-standard
    // "match found this block" indicator, cleared only when a new block starts.
    const matchBit = this.m_status & 0x04;
    this.m_status = 0x09 | matchBit;
    // In our emulator is_ready() is always true, so bit 1 stays 0.
    const transferMode = this.regs[RNUM_WR0_BASE] & 0x03;
    if (transferMode === 1) {  // TM_TRANSFER
      this.m_status |= 0x10;
    }

    // Legacy status flags: endOfBlock reached; atLeastOneByteTransferred preserved
    // (remains true if bytes were transferred; cleared only by REINITIALIZE_STATUS_BYTE)
    this.statusFlags.endOfBlockReached = true;

    // Step 14 / Step 23: INT_ON_END_OF_BLOCK — bit 1 of INTERRUPT_CTRL (WR4 interrupt control byte)
    // Mirrors MAME: if (INT_ON_END_OF_BLOCK) { trigger_interrupt(INT_END_OF_BLOCK); }
    if (this.regs[RNUM_INTERRUPT_CTRL] & 0x02) {
      this.triggerInterrupt(0); // INT_END_OF_BLOCK = 0
    }

    // Auto-restart (MAME AUTO_RESTART handler)
    if (this.registers.autoRestart) {
      this._addressA = this.registers.portAStartAddress;
      this._addressB = this.registers.portBStartAddress;
      this._count = this.registers.blockLength;
      this.transferState.byteCounter = 0;
      this.m_status |= 0x30;
      // Also reinitialise legacy transferState addresses
      this.transferState.sourceAddress = this.registers.portAStartAddress;
      this.transferState.destAddress = this.registers.portBStartAddress;
      this.enable();
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
   * Step 9: Perform a read cycle from the correct source port.
   * Uses PORTA_IS_SOURCE (WR0 bit 2) per MAME: read from _addressA when port A
   * is the source, else from _addressB.
   *
   * Note: the docstring previously stated that a byte-counter pre-increment was
   * applied here (matching specnext_dma::do_read()). That pre-increment is NOT
   * present in this implementation. The equivalent effect is achieved by the
   * isFinal check in executeTransferByte(), which evaluates
   * `(byteCounter + 1) === _count` between the read and write phases — the same
   * condition MAME would reach after do_read()'s pre-increment.
   *
   * @returns The data byte read from the source
   */
  performReadCycle(): number {
    // Step 9: MAME PORTA_IS_SOURCE selects read address
    let address: number;
    let isIO: boolean;

    if (this.portaIsSource()) {
      address = this._addressA;
      isIO = this.registers.portAIsIO;
    } else {
      address = this._addressB;
      isIO = this.registers.portBIsIO;
    }

    if (isIO) {
      this._transferDataByte = this.machine.portManager.readPort(address);
    } else {
      this._transferDataByte = this.machine.memoryDevice.readMemory(address);
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
   * Step 9: Direction bit — bit 6 of WR0 (matches the legacy directionAtoB encoding).
   * Returns true when Port A is the source (A→B direction).
   * Note: bit 6=1 means A→B (portA is source), bit 6=0 means B→A (portB is source).
   * This matches MASK_WR0_DIRECTION and the directionAtoB decoded field.
   */
  private portaIsSource(): boolean {
    // Use the decoded registers.directionAtoB rather than the raw regs[] value:
    // the RESET command's progressive column wipe clears regs[RNUM_WR0_BASE] but does
    // NOT clear the decoded registers object, so directionAtoB remains reliable.
    return this.registers.directionAtoB;
  }

  /**
   * Set source address in transfer state (for testing).
   * Step 9: also syncs _addressA for MAME-aligned reads.
   */
  setSourceAddress(address: number): void {
    this.transferState.sourceAddress = address;
    this._addressA = address;  // Step 9: sourceAddress = portA addr in all conventions
  }

  /**
   * Set destination address in transfer state (for testing).
   * Step 9: also syncs _addressB for MAME-aligned writes.
   */
  setDestAddress(address: number): void {
    this.transferState.destAddress = address;
    this._addressB = address;  // Step 9: destAddress = portB addr in all conventions
  }

  /**
   * Step 9: Perform a write cycle to the correct destination port.
   * Uses PORTA_IS_SOURCE (WR0 bit 2) per MAME: write to _addressB when port A
   * is the source (A→B), else write to _addressA (B→A).
   *
   * After the write, both _addressA and _addressB are updated independently
   * based on their respective port address modes (MAME do_write() behaviour).
   * The legacy transferState.sourceAddress/destAddress fields are also updated
   * via existing function pointers for backward-compat with older tests.
   *
   * Finally, byteCounter is incremented (16-bit wraparound).
   *
   * @param writeData  When false (Search-only mode, Step 26), skip the actual
   *                   memory/IO write but still update addresses and counters.
   */
  performWriteCycle(writeData: boolean = true): void {
    // Ensure function pointers are up-to-date (for tests that bypass LOAD)
    this.updateAddressFunctionPointers();

    // Step 9: MAME PORTA_IS_SOURCE selects write address
    let destAddress: number;
    let isIO: boolean;

    if (this.portaIsSource()) {
      // Port A is source → write to Port B
      destAddress = this._addressB;
      isIO = this.registers.portBIsIO;
    } else {
      // Port B is source → write to Port A
      destAddress = this._addressA;
      isIO = this.registers.portAIsIO;
    }

    // Write to memory or IO port (skipped in pure Search mode)
    if (writeData) {
      if (isIO) {
        this.machine.portManager.writePort(destAddress, this._transferDataByte);
      } else {
        this.machine.memoryDevice.writeMemory(destAddress, this._transferDataByte);
      }
    }

    // Step 9: Update legacy transferState.source/dest via old function pointers
    // (kept for backward-compat with tests that check transferState.*)
    this.transferState.updateSourceAddress();
    this.transferState.updateDestAddress();

    // Step 9: MAME-style independent _addressA/_addressB update.
    // Each port's address advances according to its own address mode,
    // regardless of which is source or destination.
    const portADelta = this.registers.portAAddressMode === AddressMode.FIXED ? 0
                     : this.registers.portAAddressMode === AddressMode.INCREMENT ? 1 : -1;
    const portBDelta = this.registers.portBAddressMode === AddressMode.FIXED ? 0
                     : this.registers.portBAddressMode === AddressMode.INCREMENT ? 1 : -1;
    this._addressA = (this._addressA + portADelta) & MASK_16BIT;
    this._addressB = (this._addressB + portBDelta) & MASK_16BIT;

    // Increment byte counter (16-bit with wraparound)
    this.transferState.byteCounter = (this.transferState.byteCounter + 1) & MASK_16BIT;

    // Update status flags
    const isFirstByte = this.dmaMode === DmaMode.LEGACY
      ? this.transferState.byteCounter === 0
      : this.transferState.byteCounter === 1;

    if (isFirstByte) {
      this.statusFlags.atLeastOneByteTransferred = true;
      this.statusFlags.endOfBlockReached = false;
    }
  }

  /**
   * Execute a complete continuous transfer using the MAME-aligned state machine.
   * Runs stepDma() in a loop (acknowledging bus requests as the machine would) until
   * the transfer completes or the auto-restart safety limit is reached.
   * @returns Number of bytes transferred
   */
  executeContinuousTransfer(): number {
    if (!this.registers.dmaEnabled) return 0;
    if (this.registers.transferMode !== TransferMode.CONTINUOUS) return 0;

    let bytesTransferred = 0;
    // Track block completions via the monotonic counter incremented by handleTransferFinish().
    // SEQ_FINISH is NOT a stable observable state (it is set then immediately overwritten
    // inline, so prevSeq === SEQ_FINISH is never seen by this loop).
    const startCount = this._blockCompletionCount;
    // maxBlocks total completions we are willing to execute:
    //   No auto-restart → 1 (state machine goes SEQ_IDLE naturally after 1 block).
    //   Auto-restart    → 2 (run original block + 1 restart, then stop).
    const maxCount = startCount + (this.registers.autoRestart ? 2 : 1);

    while (this.dmaSeq !== DmaSeq.SEQ_IDLE) {
      // Acknowledge bus request (mirrors ZxNextMachine.beforeInstructionExecuted)
      if (this.busControl.state === BusState.REQUESTED) {
        this.acknowledgeBus();
      }
      const tStates = this.stepDma();
      if (tStates > 0) bytesTransferred++;

      // Did handleTransferFinish() run?  If so, check limit.
      if (this._blockCompletionCount >= maxCount) break;

      // Zero-length guard: SEQ_WAIT_READY → handleTransferFinish (blockCount bumped)
      // with auto-restart loops back to SEQ_WAIT_READY with no bytes.
      // The maxCount check above handles this naturally, but also guard the degenerate
      // case where _count === 0 and autoRestart is false (would exit via SEQ_IDLE anyway,
      // but belt-and-suspenders: if somehow stuck, prevent infinite empty loops).
      if (tStates === 0 && bytesTransferred === 0 &&
          this.dmaSeq === DmaSeq.SEQ_WAIT_READY &&
          this._blockCompletionCount > startCount) {
        break;
      }
    }

    return bytesTransferred;
  }

  /**
   * Execute a burst transfer with prescalar timing using the MAME-aligned state machine.
   * Runs stepDma() within the given T-state budget, acknowledging bus requests as needed.
   * Stops after one block's worth of bytes (auto-restart reloads addresses for the next call).
   * @param tStatesToExecute Number of T-states available for transfer
   * @returns Number of bytes transferred
   */
  executeBurstTransfer(tStatesToExecute: number): number {
    if (!this.registers.dmaEnabled) return 0;
    if (this.registers.transferMode !== TransferMode.BURST) return 0;

    const targetBytes = this.getTransferLength() - this.getBytesTransferred();
    if (targetBytes <= 0) return 0;

    let bytesTransferred = 0;
    let tStatesUsed = 0;

    while (bytesTransferred < targetBytes &&
           tStatesUsed < tStatesToExecute &&
           this.dmaSeq !== DmaSeq.SEQ_IDLE) {
      if (this.busControl.state === BusState.REQUESTED) {
        this.acknowledgeBus();
      }
      const tStates = this.stepDma();
      if (tStates > 0) {
        bytesTransferred++;
        tStatesUsed += tStates;
      }
      // Stop after the block completes (FINISH handler may have called enable() for auto-restart)
      if (bytesTransferred >= targetBytes) break;
    }

    return bytesTransferred;
  }

  /**
   * Check if current transfer block is complete
   * @returns true if byteCounter has reached blockLength
   */
  isTransferComplete(): boolean {
    return this.transferState.byteCounter >= this.registers.blockLength;
  }
}