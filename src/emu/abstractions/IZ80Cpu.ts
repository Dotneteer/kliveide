import { IAnyCpu } from "./IAnyCpu";
import type { OpCodePrefix } from "./OpCodePrefix";

/**
 * This interface represents the behavior and state of the Z80 CPU that is available from outside by other components.
 */
export interface IZ80Cpu extends IAnyCpu {
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
   * We need this flag to detect RETN instruction execution for ZX Spectrum Next DivMMC handling.
   */
  retnExecuted: boolean;

  /**
   * This flag is reserved for future extension. The ZX Spectrum Next computer uses additional Z80 instructions.
   * This flag indicates if those are allowed.
   */
  allowExtendedInstructions: boolean;

  /**
   * This method increments the current CPU tacts by N.
   * @param n Number of tact increments
   */
  tactPlusN(n: number): void;

  /**
   * This method increments the current CPU tacts by one, using memory contention with the provided address.
   * @param address
   */
  tactPlus1WithAddress(address: number): void;

  /**
   * This method increments the current CPU tacts by two, using memory contention with the provided address.
   * @param address
   */
  tactPlus2WithAddress(address: number): void;

  /**
   * This method increments the current CPU tacts by four, using memory contention with the provided address.
   * @param address
   */
  tactPlus4WithAddress(address: number): void;

  /**
   * This method increments the current CPU tacts by five, using memory contention with the provided address.
   * @param address
   */
  tactPlus5WithAddress(address: number): void;

  /**
   * This method increments the current CPU tacts by seven, using memory contention with the provided address.
   * @param address
   */
  tactPlus7WithAddress(address: number): void;
}
