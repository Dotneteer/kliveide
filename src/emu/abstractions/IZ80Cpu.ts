import type { OpCodePrefix } from "./OpCodePrefix";

/**
 * This interface represents the behavior and state of the Z80 CPU that is available from outside by other components.
 */
export interface IZ80Cpu {
  /**
   * The A register
   */
  a: number;

  /**
   * The F register
   */
  f: number;

  /**
   * The AF register pair
   */
  af: number;

  /**
   * The B register
   */
  b: number;

  /**
   * The C register
   */
  c: number;

  /**
   * The BC register pair
   */
  bc: number;

  /**
   * The D register
   */
  d: number;

  /**
   * The E Register;
   */
  e: number;

  /**
   * The DE register pair
   */
  de: number;

  /**
   * The H register
   */
  h: number;

  /**
   * The L register
   */
  l: number;

  /**
   * The HL register pair
   */
  hl: number;

  /**
   * The alternate AF' register pair
   */
  af_: number;

  /**
   * The alternate BC' register pair
   */
  bc_: number;

  /**
   * The alternate DE' register pair
   */
  de_: number;

  /**
   * The alternate HL' register pair
   */
  hl_: number;

  /**
   * The higher 8 bits of the IX register pair
   */
  xh: number;

  /**
   * The lower 8 bits of the IX register pair
   */
  xl: number;

  /**
   * The IX register pair
   */
  ix: number;

  /**
   * The higher 8 bits of the IY register pair
   */
  yh: number;

  /**
   * The lower 8 bits of the IY register pair
   */
  yl: number;

  /**
   * The IY register pair
   */
  iy: number;

  /**
   * The I (interrupt vector) register
   */
  i: number;

  /**
   * The R (refresh) register
   */
  r: number;

  /**
   * The IR register pair
   */
  ir: number;

  /**
   * The Program Counter register
   */
  pc: number;

  /**
   * The Stack Pointer register
   */
  sp: number;

  /**
   * The higher 8 bits of the WZ (MEMPTR) register
   */
  wh: number;

  /**
   * The lower 8 bits of the WZ (MEMPTR) register
   */
  wl: number;

  /**
   * The WZ (MEMPTR) register
   */
  wz: number;

  /**
   * The state of the INT signal (true: active, false: passive)
   */
  sigINT: boolean;

  /**
   * The state of the NMI signal (true: active, false: passive)
   */
  sigNMI: boolean;

  /**
   * The state of the RST signal (true: active, false: passive)
   */
  sigRST: boolean;

  /**
   * The current maskable interrupt mode (0, 1, or 2)
   */
  interruptMode: number;

  /**
   * The state of the Interrupt Enable Flip-Flop
   */
  iff1: boolean;

  /**
   * Temporary storage for Iff1.
   */
  iff2: boolean;

  /**
   * This flag indicates if the CPU is in a halted state.
   */
  halted: boolean;

  /**
   * Get the base clock frequency of the CPU. We use this value to calculate the machine frame rate.
   */
  baseClockFrequency: number;

  /**
   * This property gets or sets the value of the current clock multiplier.
   *
   * By default, the CPU works with its regular (base) clock frequency; however, you can use an integer clock
   * frequency multiplier to emulate a faster CPU.
   */
  clockMultiplier: number;

  /**
   * The number of T-states (clock cycles) elapsed since the last reset
   */
  readonly tacts: number;

  /**
   * Show the number of machine frames completed since the CPU started.
   */
  readonly frames: number;

  /**
   * The number of T-states within the current frame
   */
  readonly frameTacts: number;

  /**
   * Get the current frame tact within the machine frame being executed.
   */
  readonly currentFrameTact: number;

  /**
   * Get the number of T-states in a machine frame with clock multiplier of 1
   */
  readonly tactsInFrame: number;

  /**
   * Get the number of T-states in the current machine frame, which have a higher
   * clock multiplier than 1.
   */
  readonly tactsInCurrentFrame: number;

  /**
   * Sets the number of tacts within a single machine frame
   * @param tacts Tacts to set
   */
  setTactsInFrame(tacts: number): void;

  /**
   * Get the number of T-states in a display line (use -1, if this info is not available)
   */
  get tactsInDisplayLine(): number;

  /**
   * The last fetched opcode. If an instruction is prefixed, it contains the prefix or the opcode following the
   * prefix, depending on which was fetched last.
   */
  opCode: number;

  /**
   * The current prefix to consider when processing the subsequent opcode.
   */
  prefix: OpCodePrefix;

  /**
   * We use this variable to handle the EI instruction properly.
   */
  eiBacklog: number;

  /**
   * We need this flag to implement the step-over debugger function that continues the execution and stops when the
   * current subroutine returns to its caller. The debugger will observe the change of this flag and manage its
   * internal tracking of the call stack accordingly.
   */
  retExecuted: boolean;

  /**
   * This flag is reserved for future extension. The ZX Spectrum Next computer uses additional Z80 instructions.
   * This flag indicates if those are allowed.
   */
  allowExtendedInstructions: boolean;

  /**
   * Accumulates the total contention value since the last start
   */
  totalContentionDelaySinceStart: number;

  /**
   * Accumulates the contention since the last pause
   */
  contentionDelaySincePause: number;

  /**
   * Number of clock cycles at the last machine frame cycle start
   */
  tactsAtLastStart: number;

  /**
   * The start address of the operation being executed;
   */
  opStartAddress: number;

  /**
   * Executes a hard reset as if the machine and the CPU had just been turned on.
   */
  hardReset(): void | Promise<void>;

  /**
   * Handles the active RESET signal of the CPU.
   */
  reset(): void;

  /**
   * Checks if the next instruction to be executed is a call instruction or not
   * @return 0, if the next instruction is not a call; otherwise the length of the call instruction
   */
  getCallInstructionLength(): number;

  /**
   * Call this method to execute a CPU instruction cycle.
   */
  executeCpuCycle(): void;

  /**
   * Execute this method before fetching the opcode of the next instruction
   */
  beforeOpcodeFetch(): void;

  /**
   * Execute this method after fetching the opcode of the next instruction
   */
  afterOpcodeFetch(): void;

  /**
   * Read the byte at the specified memory address.
   * @param address 16-bit memory address
   * @return The byte read from the memory
   */
  doReadMemory(address: number): number;

  /**
   * This function implements the memory read delay of the CPU.
   * @param address Memory address to read
   * Normally, it is exactly 3 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 3-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 3 T-states!
   */
  delayMemoryRead(address: number): void;

  /**
   * Write the given byte to the specified memory address.
   * @param address 16-bit memory address
   * @param value Byte to write into the memory
   */
  doWriteMemory(address: number, value: number): void;

  /**
   * This function implements the memory write delay of the CPU.
   * @param address Memory address to write
   * Normally, it is exactly 3 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 3-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 3 T-states!
   */
  delayMemoryWrite(address: number): void;

  /**
   * This function handles address-based memory read contention.
   * @param address Address to use for contention delay calculation
   */
  delayAddressBusAccess(address: number): void;

  /**
   * This function reads a byte (8-bit) from an I/O port using the provided 16-bit address.
   * @param address 16-bit port address to read
   * When placing the CPU into an emulated environment, you must provide a concrete function that emulates the
   * I/O port read operation.
   */
  doReadPort(address: number): number;

  /**
   * This function implements the I/O port read delay of the CPU.
   * @param address 16-bit port address
   * Normally, it is exactly 4 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 4-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 4 T-states!
   */
  delayPortRead(address: number): void;

  /**
   * This function writes a byte (8-bit) to the 16-bit I/O port address provided in the first argument.
   * @param address 16-bit port address to write
   * @param value The value to write to the specified port
   * When placing the CPU into an emulated environment, you must provide a concrete function that emulates the
   * I/O port write operation.
   */
  doWritePort(address: number, value: number): void;

  /**
   * This function implements the I/O port write delay of the CPU.
   * @param address 16-bit port address
   * Normally, it is exactly 4 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 4-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 4 T-states!
   */
  delayPortWrite(address: number): void;

  /**
   * Every time the CPU clock is incremented with a single T-state, this function is executed.
   * @param increment The tact increment value
   * With this function, you can emulate hardware activities running simultaneously with the CPU. For example,
   * rendering the screen or sound,  handling peripheral devices, and so on.
   */
  onTactIncremented(increment: number): void;

  /**
   * This method increments the current CPU tacts by one.
   */
  tactPlus1(): void;

  /**
   * This method increments the current CPU tacts by three.
   */
  tactPlus3(): void;

  /**
   * This method increments the current CPU tacts by four.
   */
  tactPlus4(): void;

  /**
   * This method increments the current CPU tacts by N.
   * @param n Number of tact increments
   */
  tactPlusN(n: number): void;

  /**
   * Indicates if the CPU is currently snoozed
   */
  isCpuSnoozed(): boolean;

  /**
   * Awakes the CPU from the snoozed state
   */
  awakeCpu(): void;

  /**
   * Puts the CPU into snoozed state
   */
  snoozeCpu(): void;

  /**
   * Define what to do when CPU is snoozed. You should increment the tacts emulating the snoozing.
   */
  onSnooze(): void;
}
