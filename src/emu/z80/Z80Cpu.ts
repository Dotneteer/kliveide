import type { IZ80Cpu } from "../abstractions/IZ80Cpu";

import { FlagsSetMask } from "../abstractions/FlagSetMask";
import { OpCodePrefix } from "../abstractions/OpCodePrefix";

const MAX_STEP_OUT_STACK_SIZE = 256;

/**
 * This class implements the emulation of the Z80 CPU
 */
export class Z80Cpu implements IZ80Cpu {
  // --- Register variable
  private _regBuffer = new ArrayBuffer(16);
  private _viewA = new DataView(this._regBuffer, 0, 1);
  private _viewF = new DataView(this._regBuffer, 1, 1);
  private _viewAF = new DataView(this._regBuffer, 0, 2);
  private _viewB = new DataView(this._regBuffer, 2, 1);
  private _viewC = new DataView(this._regBuffer, 3, 1);
  private _viewBC = new DataView(this._regBuffer, 2, 2);
  private _viewD = new DataView(this._regBuffer, 4, 1);
  private _viewE = new DataView(this._regBuffer, 5, 1);
  private _viewDE = new DataView(this._regBuffer, 4, 2);
  private _viewH = new DataView(this._regBuffer, 6, 1);
  private _viewL = new DataView(this._regBuffer, 7, 1);
  private _viewHL = new DataView(this._regBuffer, 6, 2);
  private _viewXH = new DataView(this._regBuffer, 8, 1);
  private _viewXL = new DataView(this._regBuffer, 9, 1);
  private _viewIX = new DataView(this._regBuffer, 8, 2);
  private _viewYH = new DataView(this._regBuffer, 10, 1);
  private _viewYL = new DataView(this._regBuffer, 11, 1);
  private _viewIY = new DataView(this._regBuffer, 10, 2);
  private _viewI = new DataView(this._regBuffer, 12, 1);
  private _viewR = new DataView(this._regBuffer, 13, 1);
  private _viewIR = new DataView(this._regBuffer, 12, 2);
  private _viewWH = new DataView(this._regBuffer, 14, 1);
  private _viewWL = new DataView(this._regBuffer, 15, 1);
  private _viewWZ = new DataView(this._regBuffer, 14, 2);

  private _af_: number;
  private _bc_ = 0xffff;
  private _de_ = 0xffff;
  private _hl_ = 0xffff;
  private _pc: number;
  private _sp: number;
  private _tactsInFrame: number;
  private _tactsInDisplayLine: number;

  private _snoozed = false;

  // ----------------------------------------------------------------------------------------------------------------
  // Register access

  /**
   * The A register
   */
  get a(): number {
    return this._viewA.getUint8(0);
  }
  set a(value: number) {
    this._viewA.setUint8(0, value);
  }

  /**
   * The F register
   */
  get f(): number {
    return this._viewF.getUint8(0);
  }
  set f(value: number) {
    this._viewF.setUint8(0, value);
  }

  /**
   * The AF register pair
   */
  get af(): number {
    return this._viewAF.getUint16(0);
  }
  set af(value: number) {
    this._viewAF.setUint16(0, value);
  }

  /**
   * The B register
   */
  get b(): number {
    return this._viewB.getUint8(0);
  }
  set b(value: number) {
    this._viewB.setUint8(0, value);
  }

  /**
   * The C register
   */
  get c(): number {
    return this._viewC.getUint8(0);
  }
  set c(value: number) {
    this._viewC.setUint8(0, value);
  }

  /**
   * The BC register pair
   */
  get bc(): number {
    return this._viewBC.getUint16(0);
  }
  set bc(value: number) {
    this._viewBC.setUint16(0, value);
  }

  /**
   * The D register
   */
  get d(): number {
    return this._viewD.getUint8(0);
  }
  set d(value: number) {
    this._viewD.setUint8(0, value);
  }

  /**
   * The E register
   */
  get e(): number {
    return this._viewE.getUint8(0);
  }
  set e(value: number) {
    this._viewE.setUint8(0, value);
  }

  /**
   * The DE register pair
   */
  get de(): number {
    return this._viewDE.getUint16(0);
  }
  set de(value: number) {
    this._viewDE.setUint16(0, value);
  }

  /**
   * The H register
   */
  get h(): number {
    return this._viewH.getUint8(0);
  }
  set h(value: number) {
    this._viewH.setUint8(0, value);
  }

  /**
   * The L register
   */
  get l(): number {
    return this._viewL.getUint8(0);
  }
  set l(value: number) {
    this._viewL.setUint8(0, value);
  }

  /**
   * The HL register pair
   */
  get hl(): number {
    return this._viewHL.getUint16(0);
  }
  set hl(value: number) {
    this._viewHL.setUint16(0, value);
  }

  /**
   * The alternate AF' register pair
   */
  get af_(): number {
    return this._af_;
  }
  set af_(value: number) {
    this._af_ = value & 0xffff;
  }

  /**
   * The alternate BC' register pair
   */
  get bc_(): number {
    return this._bc_;
  }
  set bc_(value: number) {
    this._bc_ = value & 0xffff;
  }

  /**
   * The alternate DE' register pair
   */
  get de_(): number {
    return this._de_;
  }
  set de_(value: number) {
    this._de_ = value & 0xffff;
  }

  /**
   * The alternate HL' register pair
   */
  get hl_(): number {
    return this._hl_;
  }
  set hl_(value: number) {
    this._hl_ = value & 0xffff;
  }

  /**
   * The higher 8 bits of the IX register pair
   */
  get xh(): number {
    return this._viewXH.getUint8(0);
  }
  set xh(value: number) {
    this._viewXH.setUint8(0, value);
  }

  /**
   * The lower 8 bits of the IX register pair
   */
  get xl(): number {
    return this._viewXL.getUint8(0);
  }
  set xl(value: number) {
    this._viewXL.setUint8(0, value);
  }

  /**
   * The IX register pair
   */
  get ix(): number {
    return this._viewIX.getUint16(0);
  }
  set ix(value: number) {
    this._viewIX.setUint16(0, value);
  }

  /**
   * The higher 8 bits of the IY register pair
   */
  get yh(): number {
    return this._viewYH.getUint8(0);
  }
  set yh(value: number) {
    this._viewYH.setUint8(0, value);
  }

  /**
   * The lower 8 bits of the IY register pair
   */
  get yl(): number {
    return this._viewYL.getUint8(0);
  }
  set yl(value: number) {
    this._viewYL.setUint8(0, value);
  }

  /**
   * The IY register pair
   */
  get iy(): number {
    return this._viewIY.getUint16(0);
  }
  set iy(value: number) {
    this._viewIY.setUint16(0, value);
  }

  /**
   * The I (interrupt vector) register
   */
  get i(): number {
    return this._viewI.getUint8(0);
  }
  set i(value: number) {
    this._viewI.setUint8(0, value);
  }

  /**
   * The R (refresh) register
   */
  get r(): number {
    return this._viewR.getUint8(0);
  }
  set r(value: number) {
    this._viewR.setUint8(0, value);
  }

  /**
   * The IR register pair
   */
  get ir(): number {
    return this._viewIR.getUint16(0);
  }
  set ir(value: number) {
    this._viewIR.setUint16(0, value);
  }

  /**
   * The Program Counter register
   */
  get pc(): number {
    return this._pc;
  }
  set pc(value: number) {
    this._pc = value & 0xffff;
  }

  /**
   * The Stack Pointer register
   */
  get sp(): number {
    return this._sp;
  }
  set sp(value: number) {
    this._sp = value & 0xffff;
  }

  /**
   * The higher 8 bits of the WZ register pair
   */
  get wh(): number {
    return this._viewWH.getUint8(0);
  }
  set wh(value: number) {
    this._viewWH.setUint8(0, value);
  }

  /**
   * The lower 8 bits of the WZ register pair
   */
  get wl(): number {
    return this._viewWL.getUint8(0);
  }
  set wl(value: number) {
    this._viewWL.setUint8(0, value);
  }

  /**
   * The WZ (MEMPTR) register pair
   */
  get wz(): number {
    return this._viewWZ.getUint16(0);
  }
  set wz(value: number) {
    this._viewWZ.setUint16(0, value);
  }

  /**
   * Get or set the value of the current index register
   */
  get indexReg(): number {
    return this.prefix == OpCodePrefix.DD || this.prefix == OpCodePrefix.DDCB ? this.ix : this.iy;
  }
  set indexReg(value: number) {
    if (this.prefix == OpCodePrefix.DD || this.prefix == OpCodePrefix.DDCB) {
      this.ix = value;
    } else {
      this.iy = value;
    }
  }

  /**
   * Get or set the LSB value of the current index register
   */
  get indexL(): number {
    return this.prefix == OpCodePrefix.DD || this.prefix == OpCodePrefix.DDCB ? this.xl : this.yl;
  }
  set indexL(value: number) {
    if (this.prefix == OpCodePrefix.DD || this.prefix == OpCodePrefix.DDCB) {
      this.xl = value;
    } else {
      this.yl = value;
    }
  }

  /**
   * Get or set the MSB value of the current index register
   */
  get indexH(): number {
    return this.prefix == OpCodePrefix.DD || this.prefix == OpCodePrefix.DDCB ? this.xh : this.yh;
  }
  set indexH(value: number) {
    if (this.prefix == OpCodePrefix.DD || this.prefix == OpCodePrefix.DDCB) {
      this.xh = value;
    } else {
      this.yh = value;
    }
  }

  /**
   * Gets the value of the Carry flag
   */
  get flagCValue(): number {
    return this.f & FlagsSetMask.C;
  }

  /**
   * Gets the bits that represent the value of SZPV flag group
   */
  get flagsSZPVValue(): number {
    return this.f & FlagsSetMask.SZPV;
  }

  // ----------------------------------------------------------------------------------------------------------------
  // Z80 signal and state variables

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
  tacts: number;

  /**
   * Show the number of machine frames completed since the CPU started.
   */
  frames: number;

  /**
   * The number of T-states within the current frame
   */
  frameTacts: number;

  /**
   * Get the current frame tact within the machine frame being executed.
   */
  currentFrameTact: number;

  /**
   * Get the number of T-states in the current machine frame, which have a higher
   * clock multiplier than 1.
   */
  tactsInCurrentFrame: number;

  /**
   * Get the number of T-states in a machine frame.
   */
  get tactsInFrame(): number {
    return this._tactsInFrame;
  }

  /**
   * Sets the number of tacts within a single machine frame
   * @param tacts Tacts to set
   */
  setTactsInFrame(tacts: number): void {
    this._tactsInFrame = tacts;
    this.tactsInCurrentFrame = tacts * this.clockMultiplier;
  }

  /**
   * Get the number of T-states in a display line (use -1, if this info is not available)
   */
  get tactsInDisplayLine(): number {
    return this._tactsInDisplayLine;
  }
  set tactsInDisplayLine(value: number) {
    this._tactsInDisplayLine = value;
  }

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
   * We keep subroutine return addresses in this stack to implement the step-over debugger function
   */
  stepOutStack: number[];

  /**
   * We store the step out depth in this variable to implement the step-out debugger function
   */
  stepOutAddress: number;

  /**
   * Invoke this method to mark the current depth of the call stack when the step-out operation starts.
   */
  markStepOutAddress(): void {
    if (this.stepOutStack.length > 0) {
      this.stepOutAddress = this.stepOutStack[this.stepOutStack.length - 1];
    } else {
      this.stepOutAddress = -1;
    }
    console.log("Step out address marked: " + this.stepOutAddress, this.stepOutStack);
  }

  /**
   * This flag is reserved for future extension. The ZX Spectrum Next computer uses additional Z80 instructions.
   * This flag indicates if those are allowed.
   */
  allowExtendedInstructions = false;

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

  // ----------------------------------------------------------------------------------------------------------------
  // Z80 debugging support

  /**
   * The memory addresses of the last memory read operations
   */
  lastMemoryReads: number[] = [];

  /**
   * The last value read from memory
   */
  lastMemoryReadValue: number;

  /**
   * The memory addresses of the last memory write operations
   */
  lastMemoryWrites: number[] = [];

  /**
   * The last value written to memory
   */
  lastMemoryWriteValue: number;

  /**
   * The port address of the last I/O read operation
   */
  lastIoReadPort: number;

  /**
   * The last value read from the I/O port
   */
  lastIoReadValue: number;

  /**
   * The port address of the last I/O write operation
   */
  lastIoWritePort: number;

  /**
   * The last value written to the I/O port
   */
  lastIoWriteValue: number;

  // ----------------------------------------------------------------------------------------------------------------
  // Z80 core methods

  /**
   * Executes a hard reset as if the machine and the CPU had just been turned on.
   */
  hardReset(): void {
    this.af = 0xffff;
    this.af_ = 0xffff;
    this.bc = 0x0000;
    this.bc_ = 0x0000;
    this.de = 0x0000;
    this.de_ = 0x0000;
    this.hl = 0x0000;
    this.hl_ = 0x0000;
    this.ix = 0x0000;
    this.iy = 0x0000;
    this.ir = 0x0000;
    this.pc = 0x0000;
    this.sp = 0xffff;
    this.wz = 0x0000;

    this.sigINT = false;
    this.sigNMI = false;
    this.sigRST = false;
    this.halted = false;
    this.interruptMode = 0;
    this.iff1 = false;
    this.iff2 = false;
    this.clockMultiplier = 1;

    this.opCode = 0;
    this.prefix = OpCodePrefix.None;
    this.eiBacklog = 0;
    this.retExecuted = false;
    this.stepOutStack = [];
    this.stepOutAddress = -1;
    this.totalContentionDelaySinceStart = 0;
    this.contentionDelaySincePause = 0;

    this.tacts = 0;
    this.tactsAtLastStart = 0;
    this.opStartAddress = 0;
    this.frames = 0;
    this.frameTacts = 0;
    this.setTactsInFrame(1_000_000);

    this.lastMemoryReads = [];
    this.lastMemoryWrites = [];
    this.lastIoReadPort = undefined;
    this.lastIoWritePort = undefined;
  }

  /**
   * Handles the active RESET signal of the CPU.
   */
  reset(): void {
    this.af = 0xffff;
    this.af_ = 0xffff;
    this.ir = 0x0000;
    this.pc = 0x0000;
    this.sp = 0xffff;
    this.wz = 0x0000;

    this.sigINT = false;
    this.sigNMI = false;
    this.sigRST = false;
    this.halted = false;
    this.interruptMode = 0;
    this.iff1 = false;
    this.iff2 = false;
    this.clockMultiplier = 1;

    this.opCode = 0;
    this.prefix = OpCodePrefix.None;
    this.eiBacklog = 0;
    this.retExecuted = false;
    this.stepOutStack = [];
    this.stepOutAddress = -1;
    this.totalContentionDelaySinceStart = 0;
    this.contentionDelaySincePause = 0;

    this.tacts = 0;
    this.tactsAtLastStart = 0;
    this.opStartAddress = 0;
    this.frames = 0;
    this.frameTacts = 0;
    this.setTactsInFrame(1_000_000);

    this._snoozed = false;

    this.lastMemoryReads = [];
    this.lastMemoryWrites = [];
    this.lastIoReadPort = undefined;
    this.lastIoWritePort = undefined;
  }

  /**
   * Indicates if the CPU is currently snoozed
   */
  isCpuSnoozed(): boolean {
    return this._snoozed;
  }

  /**
   * Awakes the CPU from the snoozed state
   */
  awakeCpu(): void {
    this._snoozed = false;
  }

  /**
   * Puts the CPU into snoozed state
   */
  snoozeCpu(): void {
    this._snoozed = true;
  }

  /**
   * Define what to do when CPU is snoozed. You should increment the tacts emulating the snoozing.
   */
  onSnooze(): void {
    // --- Emulate 4 NOPs
    this.tactPlusN(16);
  }

  /**
   * Checks if the next instruction to be executed is a call instruction or not
   * @return 0, if the next instruction is not a call; otherwise the length of the call instruction
   */
  getCallInstructionLength(): number {
    // --- We intentionally avoid using ReadMemory() directly
    // --- So that we can prevent false memory touching.
    var opCode = this.doReadMemory(this.pc);

    // --- CALL instruction
    if (opCode == 0xcd) return 3;

    // --- Call instruction with condition
    if ((opCode & 0xc7) == 0xc4) return 3;

    // --- Check for RST instructions
    if ((opCode & 0xc7) == 0xc7) return 1;

    // --- Check for HALT instruction
    if (opCode == 0x76) return 1;

    // --- Check for extended instruction prefix
    if (opCode != 0xed) return 0;

    // --- Check for I/O and block transfer instructions
    opCode = this.doReadMemory(this.pc + 1);
    return (opCode & 0xb4) == 0xb0 ? 2 : 0;
  }

  /**
   * Override this method in derived classes to refine extended operations
   */
  getExtendedOpsTable(): Z80Operation[] {
    return this.extendedOps;
  }

  /**
   * Call this method to execute a CPU instruction cycle.
   */
  executeCpuCycle(): void {
    // --- No RET executed yet
    this.retExecuted = false;

    // --- Modify the EI interrupt backlog value
    if (this.eiBacklog > 0) {
      this.eiBacklog--;
    }

    // --- The CPU senses the RESET signal in any phase of the instruction execution
    if (this.sigRST) {
      // --- RESET is active. Process it and then inactivate the signal
      this.reset();
      this.sigRST = false;
      return;
    }
    // --- The CPU does not test the NMI signal while an instruction is being executed
    else if (this.sigNMI && this.prefix === OpCodePrefix.None) {
      // --- NMI is active. Process the non-maskable interrupt
      this.processNmi();
      return;
    }
    // --- The CPU does not test the INT signal while an instruction is being executed
    else if (this.sigINT && this.prefix === OpCodePrefix.None) {
      // --- NMI is active. Check, if the interrupt is enabled
      if (this.iff1 && this.eiBacklog === 0) {
        // --- Yes, INT is enabled, and the CPU has already executed the first instruction after EI.
        this.processInt();
        return;
      }
    }

    // --- Let's handle the halted state.
    if (this.halted) {
      // --- While in halted state, the CPU does not execute any instructions. It just refreshes the memory
      // --- page pointed by R and waits for four T-states.
      this.refreshMemory();
      this.tactPlus4();
      return;
    }

    // --- Second, let's execute the M1 machine cycle that reads the next opcode from the memory.
    // --- For IX and IY indexed bit operations, the opcode is already read, the next byte is the displacement.
    const m1Active = this.prefix === OpCodePrefix.None;
    if (m1Active) {
      this.lastMemoryReads = [];
      this.lastMemoryWrites = [];
      this.lastIoReadPort = undefined;
      this.lastIoWritePort = undefined;

      // --- During M1, DivMMC may page out memory banks
      this.beforeOpcodeFetch();
    }
    this.opCode = this.readMemory(this.pc);
    if (m1Active) {
      this.refreshMemory();
      this.tactPlus1();

      // --- After the M1 refresh cycle, DivMMC may page out memory banks
      this.afterOpcodeFetch();
    }
    this.pc++;

    // --- It's time to execute the fetched instruction
    switch (this.prefix) {
      // --- Standard Z80 instructions
      case OpCodePrefix.None:
        this.opStartAddress = this.pc - 1;
        switch (this.opCode) {
          case 0xcb:
            this.prefix = OpCodePrefix.CB;
            break;
          case 0xed:
            this.prefix = OpCodePrefix.ED;
            break;
          case 0xdd:
            this.prefix = OpCodePrefix.DD;
            break;
          case 0xfd:
            this.prefix = OpCodePrefix.FD;
            break;
          default:
            this.standardOps[this.opCode](this);
            this.prefix = OpCodePrefix.None;
            break;
        }
        break;

      // --- Bit instructions
      case OpCodePrefix.CB:
        this.bitOps[this.opCode](this);
        this.tactPlus1();
        this.prefix = OpCodePrefix.None;
        break;

      // --- Extended instructions
      case OpCodePrefix.ED:
        this.getExtendedOpsTable()[this.opCode](this);
        this.tactPlus1();
        this.prefix = OpCodePrefix.None;
        break;

      // --- IX- or IY-indexed instructions
      case OpCodePrefix.DD:
      case OpCodePrefix.FD:
        if (this.opCode == 0xdd) {
          this.prefix = OpCodePrefix.DD;
        } else if (this.opCode == 0xfd) {
          this.prefix = OpCodePrefix.FD;
        } else if (this.opCode == 0xcb) {
          this.prefix = this.prefix == OpCodePrefix.DD ? OpCodePrefix.DDCB : OpCodePrefix.FDCB;
        } else {
          this.indexedOps[this.opCode](this);
          this.tactPlus1();
          this.prefix = OpCodePrefix.None;
        }
        break;

      // --- IX- or IY-indexed bit instructions
      case OpCodePrefix.DDCB:
      case OpCodePrefix.FDCB:
        // --- OpCode is the distance
        this.wz = this.indexReg + sbyte(this.opCode);
        this.opCode = this.readMemory(this.pc);
        this.tactPlus2WithAddress(this.pc);
        this.pc++;
        this.indexedBitOps[this.opCode](this);
        this.tactPlus1();
        this.prefix = OpCodePrefix.None;
        break;
    }
  }

  /**
   * Execute this method before fetching the opcode of the next instruction
   */
  beforeOpcodeFetch(): void {
    // --- Implement this method in derived classes
  }

  /**
   * Execute this method after fetching the opcode of the next instruction
   */
  afterOpcodeFetch(): void {
    // --- Implement this method in derived classes
  }

  /**
   * This method processes the active non-maskable interrupt.
   */
  private processNmi(): void {
    // --- Acknowledge the NMI
    this.tactPlus4();

    this.removeFromHaltedState();

    // --- Update the interrupt flip-flops: The purpose of IFF2 is to save the status of IFF1 when a non-maskable
    // --- interrupt occurs. When a non-maskable interrupt is accepted, IFF1 resets to prevent further interrupts
    // --- until reenabled by the programmer. Therefore, after a non-maskable interrupt is accepted, maskable
    // --- interrupts are disabled, but the previous state of IFF1 is saved so that the complete state of the CPU
    // --- just prior to the non-maskable interrupt can be restored at any time.
    this.iff2 = this.iff1;
    this.iff1 = false;

    // --- Push the return address to the stack
    this.pushPC();
    this.refreshMemory();

    // --- Carry on the execution at the NMI handler routine address, $0066.
    this.pc = 0x0066;
  }

  /**
   * This method executes an active and enabled maskable interrupt using the current Interrupt Mode.
   */
  private processInt(): void {
    // --- It takes six T-states to acknowledge the interrupt
    this.tactPlusN(6);

    this.removeFromHaltedState();

    // --- Disable the maskable interrupt unless it is enabled again with the EI instruction.
    this.iff1 = false;
    this.iff2 = false;

    // --- Push the return address to the stack
    this.pushPC();
    this.refreshMemory();

    if (this.interruptMode === 2) {
      // --- The official Zilog documentation states this:
      // --- "The programmer maintains a table of 16-bit starting addresses for every interrupt service routine.
      // --- This table can be located anywhere in memory. When an interrupt is accepted, a 16-bit pointer must
      // --- be formed to obtain the required interrupt service routine starting address from the table. The
      // --- upper eight bits of this pointer is formed from the contents of the I register. The I register must
      // --- be loaded with the applicable value by the programmer. A CPU reset clears the I register so that it
      // --- is initialized to 0.
      // --- The lower eight bits of the pointer must be supplied by the interrupting device. Only seven bits are
      // --- required from the interrupting device because the least-significant bit must be a 0.This process is
      // --- required because the pointer must receive two adjacent bytes to form a complete 16 - bit service
      // --- routine starting address; addresses must always start in even locations."
      // --- However, this article shows that we need to reset the least significant bit of:
      // --- http://www.z80.info/interrup2.htm
      var addr = (this.i << 8) + 0xff;
      this.wl = this.readMemory(addr++);
      this.wh = this.readMemory(addr);
    } else {
      // --- On ZX Spectrum, Interrupt Mode 0 and 1 result in the same behavior, as no peripheral device would put
      // --- an instruction on the data bus. In Interrupt Mode 0, the CPU would read a $FF value from the bus, the
      // --- opcode for the RST $38 instruction. In Interrupt Mode 1, the CPU responds to an interrupt by executing
      // --- an RST $38 instruction.
      this.wz = 0x0038;
    }

    // --- Observe that the interrupt handler routine address is first assembled in WZ and moved to PC.
    this.pc = this.wz;
  }

  /**
   * Remove the CPU from its HALTED state.
   */
  removeFromHaltedState(): void {
    if (this.halted) {
      this.pc++;
      this.halted = false;
    }
  }

  /**
   * Test the Sign flag
   */
  isSFlagSet(): boolean {
    return (this.f & FlagsSetMask.S) !== 0;
  }

  /**
   * Test the Zero flag
   */
  isZFlagSet(): boolean {
    return (this.f & FlagsSetMask.Z) !== 0;
  }

  /**
   * Test the R5 flag
   */
  isR5FlagSet(): boolean {
    return (this.f & FlagsSetMask.R5) !== 0;
  }

  /**
   * Test the Half Carry flag
   */
  isHFlagSet(): boolean {
    return (this.f & FlagsSetMask.H) !== 0;
  }

  /**
   * Test the R3 flag
   */
  isR3FlagSet(): boolean {
    return (this.f & FlagsSetMask.R3) !== 0;
  }

  /**
   * Test the Parity/overflow flag
   */
  isPvFlagSet(): boolean {
    return (this.f & FlagsSetMask.PV) !== 0;
  }

  /**
   * Test the Subtract flag
   */
  isNFlagSet(): boolean {
    return (this.f & FlagsSetMask.N) !== 0;
  }

  /**
   * Test the Carry flag
   */
  isCFlagSet(): boolean {
    return (this.f & FlagsSetMask.C) !== 0;
  }

  /**
   * Push the current value of PC to the stack.
   */
  pushPC(): void {
    this.sp--;
    this.tactPlus1();
    this.writeMemory(this.sp, this.pc >>> 8);
    this.sp--;
    this.writeMemory(this.sp, this.pc & 0xff);
  }

  /**
   * Execute a relative jump with the specified distance.
   * @param e 8-bit signed distance
   */
  relativeJump(e: number): void {
    this.tactPlus5WithAddress(this.pc);
    this.pc = this.wz = this.pc + sbyte(e);
  }

  /**
   * The core of the CALL instruction
   */
  callCore(): void {
    this.pushToStepOutStack(this.pc);
    this.tactPlus1WithAddress(this.pc);
    this.sp--;
    this.writeMemory(this.sp, this.pc >>> 8);
    this.sp--;
    this.writeMemory(this.sp, this.pc);
    this.pc = this.wz;
  }

  /**
   * The core of the RST instruction
   * @param addr Restart address to call
   */
  rstCore(addr: number): void {
    this.pushToStepOutStack(this.pc);
    this.tactPlus1WithAddress(this.ir);
    this.sp--;
    this.writeMemory(this.sp, this.pc >>> 8);
    this.sp--;
    this.writeMemory(this.sp, this.pc);
    this.pc = this.wz = addr;
  }

  pushToStepOutStack(returnAddress: number): void {
    this.stepOutStack.push(returnAddress);
    if (this.stepOutStack.length > MAX_STEP_OUT_STACK_SIZE) {
      this.stepOutStack.shift();
    }
  }

  /**
   * Adds the `regHl` value and `regOther` value according to the rule of ADD HL,QQ operation
   * @param regHl HL (IX, IY) value
   * @param regOther Other value
   * @returns Result value
   */
  add16(regHl: number, regOther: number): number {
    const tmpVal = regHl + regOther;
    const lookup =
      ((regHl & 0x0800) >>> 11) | ((regOther & 0x0800) >>> 10) | ((tmpVal & 0x0800) >>> 9);
    this.wz = regHl + 1;
    this.f =
      this.flagsSZPVValue |
      ((tmpVal & 0x10000) !== 0 ? FlagsSetMask.C : 0x00) |
      ((tmpVal >>> 8) & FlagsSetMask.R3R5) |
      halfCarryAddFlags[lookup];
    return tmpVal & 0xffff;
  }

  /**
   * The core of the 16-bit ADC operation.
   * @param value Value to subtract from HL
   */
  adc16(value: number): void {
    const tmpVal = this.hl + value + this.flagCValue;
    const lookup =
      ((this.hl & 0x8800) >>> 11) | ((value & 0x8800) >>> 10) | ((tmpVal & 0x8800) >>> 9);
    this.wz = this.hl + 1;
    this.hl = tmpVal;
    this.f =
      ((tmpVal & 0x10000) !== 0 ? FlagsSetMask.C : 0) |
      overflowAddFlags[lookup >>> 4] |
      (this.h & (FlagsSetMask.R3R5 | FlagsSetMask.S)) |
      halfCarryAddFlags[lookup & 0x07] |
      (this.hl !== 0 ? 0 : FlagsSetMask.Z);
  }

  /**
   * The core of the 16-bit SBC operation.
   * @param value Value to subtract from HL
   */
  sbc16(value: number): void {
    const tmpVal = this.hl - value - this.flagCValue;
    var lookup =
      ((this.hl & 0x8800) >>> 11) | ((value & 0x8800) >>> 10) | ((tmpVal & 0x8800) >>> 9);
    this.wz = this.hl + 1;
    this.hl = tmpVal;
    this.f =
      ((tmpVal & 0x10000) !== 0 ? FlagsSetMask.C : 0) |
      FlagsSetMask.N |
      overflowSubFlags[lookup >>> 4] |
      (this.h & (FlagsSetMask.R3R5 | FlagsSetMask.S)) |
      halfCarrySubFlags[lookup & 0x07] |
      (this.hl !== 0 ? 0 : FlagsSetMask.Z);
  }

  /**
   * Store two 8-bit values to the address in the code
   * @param low LSB value to store
   * @param high MSB value to store
   */
  store16(low: number, high: number): void {
    let tmp = this.fetchCodeByte();
    tmp += this.fetchCodeByte() << 8;
    this.writeMemory(tmp, low);
    tmp += 1;
    this.wz = tmp;
    this.writeMemory(tmp, high);
  }

  /**
   * The core of the 8-bit SUB operation
   * @param value Value to subtract from A
   */
  sub8(value: number): void {
    const tmp = this.a - value;
    const lookup = ((this.a & 0x88) >>> 3) | ((value & 0x88) >>> 2) | ((tmp & 0x88) >>> 1);
    this.a = tmp;
    this.f =
      ((tmp & 0x100) !== 0 ? FlagsSetMask.C : 0) |
      FlagsSetMask.N |
      halfCarrySubFlags[lookup & 0x07] |
      overflowSubFlags[lookup >>> 4] |
      sz53Table[this.a];
  }

  /**
   * The core of the 8-bit SBC operation
   * @param value Value to subtract from A
   */
  sbc8(value: number): void {
    const tmp = this.a - value - this.flagCValue;
    const lookup = ((this.a & 0x88) >>> 3) | ((value & 0x88) >>> 2) | ((tmp & 0x88) >>> 1);
    this.a = tmp;
    this.f =
      ((tmp & 0x100) !== 0 ? FlagsSetMask.C : 0) |
      FlagsSetMask.N |
      halfCarrySubFlags[lookup & 0x07] |
      overflowSubFlags[lookup >>> 4] |
      sz53Table[this.a];
  }

  /**
   * The core of the 8-bit ADD operation
   * @param value Value to add to A
   */
  add8(value: number): void {
    const tmp = this.a + value;
    var lookup = ((this.a & 0x88) >>> 3) | ((value & 0x88) >>> 2) | ((tmp & 0x88) >>> 1);
    this.a = tmp;
    this.f =
      ((tmp & 0x100) != 0 ? FlagsSetMask.C : 0) |
      halfCarryAddFlags[lookup & 0x07] |
      overflowAddFlags[lookup >> 4] |
      sz53Table[this.a];
  }

  /**
   * The core of the 8-bit ADD operation
   * @param value Value to add to A
   */
  adc8(value: number): void {
    const tmp = this.a + value + this.flagCValue;
    var lookup = ((this.a & 0x88) >>> 3) | ((value & 0x88) >>> 2) | ((tmp & 0x88) >>> 1);
    this.a = tmp;
    this.f =
      ((tmp & 0x100) != 0 ? FlagsSetMask.C : 0) |
      halfCarryAddFlags[lookup & 0x07] |
      overflowAddFlags[lookup >>> 4] |
      sz53Table[this.a];
  }

  /**
   * The core of the 8-bit AND operation
   * @param value Value to AND with A
   */
  and8(value: number): void {
    this.a &= value;
    this.f = FlagsSetMask.H | sz53pvTable[this.a];
  }

  /**
   * The core of the 8-bit XOR operation
   * @param value Value to XOR with A
   */
  xor8(value: number): void {
    this.a ^= value;
    this.f = sz53pvTable[this.a];
  }

  /**
   * The core of the 8-bit OR operation
   * @param value Value to OR with A
   */
  or8(value: number): void {
    this.a |= value;
    this.f = sz53pvTable[this.a];
  }

  /**
   * The core of the 8-bit CP operation
   * @param value Value to compare with A
   */
  cp8(value: number): void {
    const tmp = this.a - value;
    const lookup = ((this.a & 0x88) >>> 3) | ((value & 0x88) >>> 2) | ((tmp & 0x88) >>> 1);
    this.f =
      ((tmp & 0x100) != 0 ? FlagsSetMask.C : 0) |
      (tmp != 0 ? 0 : FlagsSetMask.Z) |
      FlagsSetMask.N |
      halfCarrySubFlags[lookup & 0x07] |
      overflowSubFlags[lookup >>> 4] |
      (value & FlagsSetMask.R3R5) |
      (tmp & FlagsSetMask.S);
  }

  /**
   * The core of the 8-bit RLC operation.
   * @param oper Operand
   * @returns Operation result
   */
  rlc8(oper: number): number {
    const result = ((oper << 1) | (oper >>> 7)) & 0xff;
    this.f = (result & FlagsSetMask.C) | sz53pvTable[result];
    return result;
  }

  /**
   * The core of the 8-bit RRC operation.
   * @param oper Operand
   * @returns Operation result
   */
  rrc8(oper: number): number {
    this.f = oper & FlagsSetMask.C;
    const result = ((oper >>> 1) | (oper << 7)) & 0xff;
    this.f |= sz53pvTable[result];
    return result;
  }

  /**
   * The core of the 8-bit RL operation.
   * @param oper Operand
   * @returns Operation result
   */
  rl8(oper: number): number {
    const result = ((oper << 1) | this.flagCValue) & 0xff;
    this.f = (oper >>> 7) | sz53pvTable[result];
    return result;
  }

  /**
   * The core of the 8-bit RR operation.
   * @param oper Operand
   * @returns Operation result
   */
  rr8(oper: number): number {
    const result = ((oper >>> 1) | (this.f << 7)) & 0xff;
    this.f = (oper & FlagsSetMask.C) | sz53pvTable[result];
    return result;
  }

  /**
   * The core of the 8-bit SLA operation.
   * @param oper Operand
   * @returns Operation result
   */
  sla8(oper: number): number {
    this.f = oper >>> 7;
    const result = (oper << 1) & 0xff;
    this.f |= sz53pvTable[result];
    return result;
  }

  /**
   * The core of the 8-bit SRA operation.
   * @param oper Operand
   * @returns Operation result
   */
  sra8(oper: number): number {
    this.f = oper & FlagsSetMask.C;
    const result = ((oper & 0x80) | (oper >> 1)) & 0xff;
    this.f |= sz53pvTable[result];
    return result;
  }

  /**
   * The core of the 8-bit SLL operation.
   * @param oper Operand
   * @returns Operation result
   */
  sll8(oper: number): number {
    this.f = oper >>> 7;
    const result = ((oper << 1) | 0x01) & 0xff;
    this.f |= sz53pvTable[result];
    return result;
  }

  /**
   * The core of the 8-bit SRL operation.
   * @param oper Operand
   * @returns Operation result
   */
  srl8(oper: number): number {
    this.f = oper & FlagsSetMask.C;
    const result = oper >>> 1;
    this.f |= sz53pvTable[result];
    return result;
  }

  /**
   * The core of the 8-bit BIT operation.
   * @param bit Bit index (0-7)
   * @param oper Operand
   */
  bit8(bit: number, oper: number): void {
    this.f = this.flagCValue | FlagsSetMask.H | (oper & FlagsSetMask.R3R5);
    const bitVal = oper & (0x01 << bit);
    if (bitVal === 0) {
      this.f |= FlagsSetMask.PV | FlagsSetMask.Z;
    }
    this.f |= bitVal & FlagsSetMask.S;
  }

  /**
   * The core of the 8-bit BIT operation with WZ.
   * @param bit Bit index (0-7)
   * @param oper Operand
   */
  bit8W(bit: number, oper: number): void {
    this.f = this.flagCValue | FlagsSetMask.H | (this.wh & FlagsSetMask.R3R5);
    const bitVal = oper & (0x01 << bit);
    if (bitVal === 0) {
      this.f |= FlagsSetMask.PV | FlagsSetMask.Z;
    }
    this.f |= bitVal & FlagsSetMask.S;
  }

  // --------------------------------------------------------------------------------------------------------------
  // Z80 memory and I/O management

  /**
   * Calculate the new value of Register F.
   *
   * Seven bits of this 8-bit register are automatically incremented after each instruction fetch. The eighth bit
   * remains as programmed, resulting from an LD R, A instruction.
   */
  refreshMemory(): void {
    this.r = ((this.r + 1) & 0x7f) | (this.r & 0x80);
  }

  /**
   * Reads the specified memory address.
   * @param address Memory address to read
   * @returns The byte the CPU has read from the memory
   * If the emulated hardware uses any delay when reading the memory, increment the CPU tacts accordingly.
   */
  readMemory(address: number): number {
    this.delayMemoryRead(address);
    this.lastMemoryReads.push(address);
    return (this.lastMemoryReadValue = this.doReadMemory(address));
  }

  /**
   * Writes a byte to the specfied memory address.
   * @param address Memory address
   * @param data Data byte to write
   * If the emulated hardware uses any delay when writing the memory, increment the CPU tacts accordingly.
   */
  writeMemory(address: number, data: number): void {
    this.delayMemoryWrite(address);
    this.lastMemoryWrites.push(address);
    this.lastMemoryWriteValue = data;
    this.doWriteMemory(address, data);
  }

  /**
   * Read the byte at the specified memory address.
   * @param _address 16-bit memory address
   * @return The byte read from the memory
   * Note: the default implementation always returns 0xff
   */
  doReadMemory(_address: number): number {
    return 0xff;
  }

  /**
   * This function implements the memory read delay of the CPU.
   * @param _address Memory address to read
   * Normally, it is exactly 3 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 3-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 3 T-states!
   */
  delayMemoryRead(_address: number): void {
    this.tactPlus3();
  }

  /**
   * Write the given byte to the specified memory address.
   * @param _address 16-bit memory address
   * @param _value Byte to write into the memory
   * Note: the default implementation does not write the memory
   */
  doWriteMemory(_address: number, _value: number): void {
    // --- Override this method in derived classes
  }

  /**
   * This function implements the memory write delay of the CPU.
   * @param _address Memory address to write
   * Normally, it is exactly 3 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 3-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 3 T-states!
   */
  delayMemoryWrite(_address: number): void {
    this.tactPlus3();
  }

  /**
   * This function handles address-based memory read contention.
   * @param _address Address to use for contention delay calculation
   */
  delayAddressBusAccess(_address: number): void {
    // --- Override this method in derived classes
  }

  /**
   * Reads the code byte from the current Program Counter address and then increments the Program Counter.
   * @returns The byte read
   */
  fetchCodeByte(): number {
    this.delayMemoryRead(this.pc);
    this.lastMemoryReads.push(this.pc);
    return this.doReadMemory(this.pc++);
  }

  /**
   * Reads the specified I/O port.
   * @param address I/O port address to read
   * @returns The byte the CPU has read from the port
   * If the emulated hardware uses any delay when reading the port, increment the CPU tacts accordingly.
   */
  readPort(address: number): number {
    this.delayPortRead(address);
    this.lastIoReadPort = address;
    return (this.lastIoReadValue = this.doReadPort(address));
  }

  /**
   * Writes a byte to the specfied I/O port.
   * @param address I/O port address
   * @param data Data byte to write
   * If the emulated hardware uses any delay when writing the port, increment the CPU tacts accordingly.
   */
  writePort(address: number, data: number): void {
    this.delayPortWrite(address);
    this.lastIoWritePort = address;
    this.lastIoWriteValue = data;
    this.doWritePort(address, data);
  }

  /**
   * This function reads a byte (8-bit) from an I/O port using the provided 16-bit address.
   * @param _address 16-bit port address to read
   * When placing the CPU into an emulated environment, you must provide a concrete function that emulates the
   * I/O port read operation.
   */
  doReadPort(_address: number): number {
    // --- Override this method in derived classes
    return 0xff;
  }

  /**
   * This function implements the I/O port read delay of the CPU.
   * @param _address 16-bit port address
   * Normally, it is exactly 4 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 4-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 4 T-states!
   */
  delayPortRead(_address: number): void {
    this.tactPlus4();
  }

  /**
   * This function writes a byte (8-bit) to the 16-bit I/O port address provided in the first argument.
   * @param _address 16-bit port address to write
   * @param _value The value to write to the specified port
   * When placing the CPU into an emulated environment, you must provide a concrete function that emulates the
   * I/O port write operation.
   */
  doWritePort(_address: number, _value: number): void {
    // --- Override this method in derived classes
  }

  /**
   * This function implements the I/O port write delay of the CPU.
   * @param _address 16-bit port address
   * Normally, it is exactly 4 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 4-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 4 T-states!
   */
  delayPortWrite(_address: number): void {
    this.tactPlus4();
  }

  /**
   * Every time the CPU clock is incremented with a single T-state, this function is executed.
   * With this function, you can emulate hardware activities running simultaneously with the CPU. For example,
   * rendering the screen or sound,  handling peripheral devices, and so on.
   */
  onTactIncremented(): void {
    // --- Override this method in derived classes
  }

  // ----------------------------------------------------------------------------------------------------------------
  // Z80 clock methods

  /**
   * This flag indicates whether the Z80 CPU works in hardware with ULA-controlled memory contention between the
   * CPU and other components.
   */
  delayedAddressBus: boolean;

  /**
   * This method increments the current CPU tacts by one.
   */
  tactPlus1(): void {
    this.tactPlusN(1);
  }

  /**
   * This method increments the current CPU tacts by one, using memory contention with the provided address.
   * @param address
   */
  tactPlus1WithAddress(address: number): void {
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
  }

  /**
   * This method increments the current CPU tacts by two, using memory contention with the provided address.
   * @param address
   */
  tactPlus2WithAddress(address: number): void {
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
  }

  /**
   * This method increments the current CPU tacts by three.
   */
  tactPlus3(): void {
    this.tactPlusN(3);
  }

  /**
   * This method increments the current CPU tacts by four.
   */
  tactPlus4(): void {
    this.tactPlusN(4);
  }

  /**
   * This method increments the current CPU tacts by four, using memory contention with the provided address.
   * @param address
   */
  tactPlus4WithAddress(address: number): void {
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
  }

  /**
   * This method increments the current CPU tacts by five, using memory contention with the provided address.
   * @param address
   */
  tactPlus5WithAddress(address: number): void {
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
  }

  /**
   * This method increments the current CPU tacts by seven, using memory contention with the provided address.
   * @param address
   */
  tactPlus7WithAddress(address: number): void {
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
    if (this.delayedAddressBus) this.delayAddressBusAccess(address);
    this.tactPlus1();
  }

  /**
   * This method increments the current CPU tacts by N.
   * @param n Number of tact increments
   */
  tactPlusN(n: number): void {
    this.tacts += n;
    this.frameTacts += n;
    if (this.frameTacts >= this.tactsInCurrentFrame) {
      this.frames++;
      this.frameTacts -= this.tactsInCurrentFrame;
    }
    this.currentFrameTact = Math.floor(this.frameTacts / this.clockMultiplier);
    this.onTactIncremented();
  }

  // ----------------------------------------------------------------------------------------------------------------
  // Z80 operation tables

  readonly standardOps: Z80Operation[] = [
    nop,
    ldBcNN,
    ldBciA,
    incBc,
    incB,
    decB,
    ldBN,
    rlca, // 00-07
    exAf,
    addHlBc,
    ldABci,
    decBc,
    incC,
    decC,
    ldCN,
    rrca, // 08-0f
    djnz,
    ldDeNN,
    ldDeiA,
    incDe,
    incD,
    decD,
    ldDN,
    rla, // 10-17
    jr,
    addHlDe,
    ldADei,
    decDe,
    incE,
    decE,
    ldEN,
    rra, // 18-1f
    jrnz,
    ldHlNN,
    ldNNiHl,
    incHl,
    incH,
    decH,
    ldHN,
    daa, // 20-27
    jrz,
    addHlHl,
    ldHlNNi,
    decHl,
    incL,
    decL,
    ldLN,
    cpl, // 28-2f
    jrnc,
    ldSpNN,
    ldNNiA,
    incSp,
    incHli,
    decHli,
    ldHliN,
    scf, // 30-37
    jrc,
    addHlSp,
    ldANNi,
    decSp,
    incA,
    decA,
    ldAN,
    ccf, // 38-3f

    nop,
    ldBC,
    ldBD,
    ldBE,
    ldBH,
    ldBL,
    ldBHli,
    ldBA, // 40-47
    ldCB,
    nop,
    ldCD,
    ldCE,
    ldCH,
    ldCL,
    ldCHli,
    ldCA, // 48-4f
    ldDB,
    ldDC,
    nop,
    ldDE,
    ldDH,
    ldDL,
    ldDHli,
    ldDA, // 50-57
    ldEB,
    ldEC,
    ldED,
    nop,
    ldEH,
    ldEL,
    ldEHli,
    ldEA, // 58-5f
    ldHB,
    ldHC,
    ldHD,
    ldHE,
    nop,
    ldHL,
    ldHHli,
    ldHA, // 60-67
    ldLB,
    ldLC,
    ldLD,
    ldLE,
    ldLH,
    nop,
    ldLHli,
    ldLA, // 68-6f
    ldHliB,
    ldHliC,
    ldHliD,
    ldHliE,
    ldHliH,
    ldHliL,
    halt,
    ldHliA, // 70-77
    ldAB,
    ldAC,
    ldAD,
    ldAE,
    ldAH,
    ldAL,
    ldAHli,
    nop, // 78-7f

    addAB,
    addAC,
    addAD,
    addAE,
    addAH,
    addAL,
    addAHli,
    addAA, // 80-87
    adcAB,
    adcAC,
    adcAD,
    adcAE,
    adcAH,
    adcAL,
    adcAHli,
    adcAA, // 88-8f
    subAB,
    subAC,
    subAD,
    subAE,
    subAH,
    subAL,
    subAHli,
    subAA, // 90-97
    sbcAB,
    sbcAC,
    sbcAD,
    sbcAE,
    sbcAH,
    sbcAL,
    sbcAHli,
    sbcAA, // 98-9f
    andAB,
    andAC,
    andAD,
    andAE,
    andAH,
    andAL,
    andAHli,
    andAA, // a0-a7
    xorAB,
    xorAC,
    xorAD,
    xorAE,
    xorAH,
    xorAL,
    xorAHli,
    xorAA, // a8-af
    orAB,
    orAC,
    orAD,
    orAE,
    orAH,
    orAL,
    orAHli,
    orAA, // b0-b7
    cpB,
    cpC,
    cpD,
    cpE,
    cpH,
    cpL,
    cpHli,
    cpA, // b8-bf

    retNz,
    popBc,
    jpNz,
    jp,
    callNz,
    pushBc,
    addAN,
    rst00, // c0-c7
    retZ,
    ret,
    jpZ,
    nop,
    callZ,
    call,
    adcAN,
    rst08, // c8-cf
    retNc,
    popDe,
    jpNc,
    outNA,
    callNc,
    pushDe,
    subAN,
    rst10, // d0-d7
    retC,
    exx,
    jpC,
    inAN,
    callC,
    nop,
    sbcAN,
    rst18, // d8-df
    retPo,
    popHl,
    jpPo,
    exSpiHl,
    callPo,
    pushHl,
    andAN,
    rst20, // e0-e7
    retPe,
    jpHl,
    jpPe,
    exDeHl,
    callPe,
    nop,
    xorAN,
    rst28, // e8-ef
    retP,
    popAf,
    jpP,
    di,
    callP,
    pushAf,
    orAN,
    rst30, // f0-f7
    retM,
    ldSpHl,
    jpM,
    ei,
    callM,
    nop,
    cpAN,
    rst38 // f8-ff
  ];

  readonly bitOps: Z80Operation[] = [
    rlcB,
    rlcC,
    rlcD,
    rlcE,
    rlcH,
    rlcL,
    rlcHli,
    rlcA, // 00-07
    rrcB,
    rrcC,
    rrcD,
    rrcE,
    rrcH,
    rrcL,
    rrcHli,
    rrcA, // 08-0f
    rlB,
    rlC,
    rlD,
    rlE,
    rlH,
    rlL,
    rlHli,
    rlA, // 10-17
    rrB,
    rrC,
    rrD,
    rrE,
    rrH,
    rrL,
    rrHli,
    rrA, // 18-1f
    slaB,
    slaC,
    slaD,
    slaE,
    slaH,
    slaL,
    slaHli,
    slaA, // 20-27
    sraB,
    sraC,
    sraD,
    sraE,
    sraH,
    sraL,
    sraHli,
    sraA, // 28-2f
    sllB,
    sllC,
    sllD,
    sllE,
    sllH,
    sllL,
    sllHli,
    sllA, // 30-37
    srlB,
    srlC,
    srlD,
    srlE,
    srlH,
    srlL,
    srlHli,
    srlA, // 38-3f

    bit0B,
    bit0C,
    bit0D,
    bit0E,
    bit0H,
    bit0L,
    bit0Hli,
    bit0A, // 40-47
    bit1B,
    bit1C,
    bit1D,
    bit1E,
    bit1H,
    bit1L,
    bit1Hli,
    bit1A, // 48-4f
    bit2B,
    bit2C,
    bit2D,
    bit2E,
    bit2H,
    bit2L,
    bit2Hli,
    bit2A, // 50-57
    bit3B,
    bit3C,
    bit3D,
    bit3E,
    bit3H,
    bit3L,
    bit3Hli,
    bit3A, // 58-5f
    bit4B,
    bit4C,
    bit4D,
    bit4E,
    bit4H,
    bit4L,
    bit4Hli,
    bit4A, // 60-67
    bit5B,
    bit5C,
    bit5D,
    bit5E,
    bit5H,
    bit5L,
    bit5Hli,
    bit5A, // 68-6f
    bit6B,
    bit6C,
    bit6D,
    bit6E,
    bit6H,
    bit6L,
    bit6Hli,
    bit6A, // 70-77
    bit7B,
    bit7C,
    bit7D,
    bit7E,
    bit7H,
    bit7L,
    bit7Hli,
    bit7A, // 78-7f

    res0B,
    res0C,
    res0D,
    res0E,
    res0H,
    res0L,
    res0Hli,
    res0A, // 80-87
    res1B,
    res1C,
    res1D,
    res1E,
    res1H,
    res1L,
    res1Hli,
    res1A, // 88-8f
    res2B,
    res2C,
    res2D,
    res2E,
    res2H,
    res2L,
    res2Hli,
    res2A, // 90-97
    res3B,
    res3C,
    res3D,
    res3E,
    res3H,
    res3L,
    res3Hli,
    res3A, // 98-9f
    res4B,
    res4C,
    res4D,
    res4E,
    res4H,
    res4L,
    res4Hli,
    res4A, // a0-a7
    res5B,
    res5C,
    res5D,
    res5E,
    res5H,
    res5L,
    res5Hli,
    res5A, // a8-af
    res6B,
    res6C,
    res6D,
    res6E,
    res6H,
    res6L,
    res6Hli,
    res6A, // b0-b7
    res7B,
    res7C,
    res7D,
    res7E,
    res7H,
    res7L,
    res7Hli,
    res7A, // b8-bf

    set0B,
    set0C,
    set0D,
    set0E,
    set0H,
    set0L,
    set0Hli,
    set0A, // c0-c7
    set1B,
    set1C,
    set1D,
    set1E,
    set1H,
    set1L,
    set1Hli,
    set1A, // c8-cf
    set2B,
    set2C,
    set2D,
    set2E,
    set2H,
    set2L,
    set2Hli,
    set2A, // d0-d7
    set3B,
    set3C,
    set3D,
    set3E,
    set3H,
    set3L,
    set3Hli,
    set3A, // d8-df
    set4B,
    set4C,
    set4D,
    set4E,
    set4H,
    set4L,
    set4Hli,
    set4A, // e0-e7
    set5B,
    set5C,
    set5D,
    set5E,
    set5H,
    set5L,
    set5Hli,
    set5A, // e8-ef
    set6B,
    set6C,
    set6D,
    set6E,
    set6H,
    set6L,
    set6Hli,
    set6A, // f0-f7
    set7B,
    set7C,
    set7D,
    set7E,
    set7H,
    set7L,
    set7Hli,
    set7A // f8-ff
  ];

  readonly indexedOps: Z80Operation[] = [
    nop,
    ldBcNN,
    ldBciA,
    incBc,
    incB,
    decB,
    ldBN,
    rlca, // 00-07
    exAf,
    addXBc,
    ldABci,
    decBc,
    incC,
    decC,
    ldCN,
    rrca, // 08-0f
    djnz,
    ldDeNN,
    ldDeiA,
    incDe,
    incD,
    decD,
    ldDN,
    rla, // 10-17
    jr,
    addXDe,
    ldADei,
    decDe,
    incE,
    decE,
    ldEN,
    rra, // 18-1f
    jrnz,
    ldXNN,
    ldNNiX,
    incX,
    incXh,
    decXh,
    ldXhN,
    daa, // 20-27
    jrz,
    addXX,
    ldXNNi,
    decX,
    incXl,
    decXl,
    ldXlN,
    cpl, // 28-2f
    jrnc,
    ldSpNN,
    ldNNiA,
    incSp,
    incXi,
    decXi,
    ldXiN,
    scf, // 30-37
    jrc,
    addXSp,
    ldANNi,
    decSp,
    incA,
    decA,
    ldAN,
    ccf, // 38-3f

    nop,
    ldBC,
    ldBD,
    ldBE,
    ldBXh,
    ldBXl,
    ldBXi,
    ldBA, // 40-47
    ldCB,
    nop,
    ldCD,
    ldCE,
    ldCXh,
    ldCXl,
    ldCXi,
    ldCA, // 48-4f
    ldDB,
    ldDC,
    nop,
    ldDE,
    ldDXh,
    ldDXl,
    ldDXi,
    ldDA, // 50-57
    ldEB,
    ldEC,
    ldED,
    nop,
    ldEXh,
    ldEXl,
    ldEXi,
    ldEA, // 58-5f
    ldXhB,
    ldXhC,
    ldXhD,
    ldXhE,
    nop,
    ldXhXl,
    ldHXi,
    ldXhA, // 60-67
    ldXlB,
    ldXlC,
    ldXlD,
    ldXlE,
    ldXlXh,
    nop,
    ldLXi,
    ldXlA, // 68-6f
    ldXiB,
    ldXiC,
    ldXiD,
    ldXiE,
    ldXiH,
    ldXiL,
    halt,
    ldXiA, // 70-77
    ldAB,
    ldAC,
    ldAD,
    ldAE,
    ldAXh,
    ldAXl,
    ldAXi,
    nop, // 78-7f

    addAB,
    addAC,
    addAD,
    addAE,
    addAXh,
    addAXl,
    addAXi,
    addAA, // 80-87
    adcAB,
    adcAC,
    adcAD,
    adcAE,
    adcAXh,
    adcAXl,
    adcAXi,
    adcAA, // 88-8f
    subAB,
    subAC,
    subAD,
    subAE,
    subAXh,
    subAXl,
    subAXi,
    subAA, // 90-97
    sbcAB,
    sbcAC,
    sbcAD,
    sbcAE,
    sbcAXh,
    sbcAXl,
    sbcAXi,
    sbcAA, // 98-9f
    andAB,
    andAC,
    andAD,
    andAE,
    andAXh,
    andAXl,
    andAXi,
    andAA, // a0-a7
    xorAB,
    xorAC,
    xorAD,
    xorAE,
    xorAXh,
    xorAXl,
    xorAXi,
    xorAA, // a8-af
    orAB,
    orAC,
    orAD,
    orAE,
    orAXh,
    orAXl,
    orAXi,
    orAA, // b0-b7
    cpB,
    cpC,
    cpD,
    cpE,
    cpAXh,
    cpAXl,
    cpAXi,
    cpA, // b8-bf

    retNz,
    popBc,
    jpNz,
    jp,
    callNz,
    pushBc,
    addAN,
    rst00, // c0-c7
    retZ,
    ret,
    jpZ,
    nop,
    callZ,
    call,
    adcAN,
    rst08, // c8-cf
    retNc,
    popDe,
    jpNc,
    outNA,
    callNc,
    pushDe,
    subAN,
    rst10, // d0-d7
    retC,
    exx,
    jpC,
    inAN,
    callC,
    nop,
    sbcAN,
    rst18, // d8-df
    retPo,
    popX,
    jpPo,
    exSpiX,
    callPo,
    pushX,
    andAN,
    rst20, // e0-e7
    retPe,
    jpX,
    jpPe,
    exDeHl,
    callPe,
    nop,
    xorAN,
    rst28, // e8-ef
    retP,
    popAf,
    jpP,
    di,
    callP,
    pushAf,
    orAN,
    rst30, // f0-f7
    retM,
    ldSpX,
    jpM,
    ei,
    callM,
    nop,
    cpAN,
    rst38 // f8-ff
  ];

  readonly indexedBitOps: Z80Operation[] = [
    xrlcB,
    xrlcC,
    xrlcD,
    xrlcE,
    xrlcH,
    xrlcL,
    xrlc,
    xrlcA, // 00-07
    xrrcB,
    xrrcC,
    xrrcD,
    xrrcE,
    xrrcH,
    xrrcL,
    xrrc,
    xrrcA, // 08-0f
    xrlB,
    xrlC,
    xrlD,
    xrlE,
    xrlH,
    xrlL,
    xrl,
    xrlA, // 10-17
    xrrB,
    xrrC,
    xrrD,
    xrrE,
    xrrH,
    xrrL,
    xrr,
    xrrA, // 18-1f
    xslaB,
    xslaC,
    xslaD,
    xslaE,
    xslaH,
    xslaL,
    xsla,
    xslaA, // 20-27
    xsraB,
    xsraC,
    xsraD,
    xsraE,
    xsraH,
    xsraL,
    xsra,
    xsraA, // 28-2f
    xsllB,
    xsllC,
    xsllD,
    xsllE,
    xsllH,
    xsllL,
    xsll,
    xsllA, // 30-37
    xsrlB,
    xsrlC,
    xsrlD,
    xsrlE,
    xsrlH,
    xsrlL,
    xsrl,
    xsrlA, // 38-3f

    xbit0,
    xbit0,
    xbit0,
    xbit0,
    xbit0,
    xbit0,
    xbit0,
    xbit0, // 40-47
    xbit1,
    xbit1,
    xbit1,
    xbit1,
    xbit1,
    xbit1,
    xbit1,
    xbit1, // 48-4f
    xbit2,
    xbit2,
    xbit2,
    xbit2,
    xbit2,
    xbit2,
    xbit2,
    xbit2, // 50-57
    xbit3,
    xbit3,
    xbit3,
    xbit3,
    xbit3,
    xbit3,
    xbit3,
    xbit3, // 58-5f
    xbit4,
    xbit4,
    xbit4,
    xbit4,
    xbit4,
    xbit4,
    xbit4,
    xbit4, // 60-67
    xbit5,
    xbit5,
    xbit5,
    xbit5,
    xbit5,
    xbit5,
    xbit5,
    xbit5, // 68-6f
    xbit6,
    xbit6,
    xbit6,
    xbit6,
    xbit6,
    xbit6,
    xbit6,
    xbit6, // 70-77
    xbit7,
    xbit7,
    xbit7,
    xbit7,
    xbit7,
    xbit7,
    xbit7,
    xbit7, // 78-7f

    xres0B,
    xres0C,
    xres0D,
    xres0E,
    xres0H,
    xres0L,
    xres0,
    xres0A, // 80-87
    xres1B,
    xres1C,
    xres1D,
    xres1E,
    xres1H,
    xres1L,
    xres1,
    xres1A, // 88-8f
    xres2B,
    xres2C,
    xres2D,
    xres2E,
    xres2H,
    xres2L,
    xres2,
    xres2A, // 90-97
    xres3B,
    xres3C,
    xres3D,
    xres3E,
    xres3H,
    xres3L,
    xres3,
    xres3A, // 98-9f
    xres4B,
    xres4C,
    xres4D,
    xres4E,
    xres4H,
    xres4L,
    xres4,
    xres4A, // a0-a7
    xres5B,
    xres5C,
    xres5D,
    xres5E,
    xres5H,
    xres5L,
    xres5,
    xres5A, // a8-af
    xres6B,
    xres6C,
    xres6D,
    xres6E,
    xres6H,
    xres6L,
    xres6,
    xres6A, // b0-b7
    xres7B,
    xres7C,
    xres7D,
    xres7E,
    xres7H,
    xres7L,
    xres7,
    xres7A, // b8-bf

    xset0B,
    xset0C,
    xset0D,
    xset0E,
    xset0H,
    xset0L,
    xset0,
    xset0A, // 80-87
    xset1B,
    xset1C,
    xset1D,
    xset1E,
    xset1H,
    xset1L,
    xset1,
    xset1A, // 88-8f
    xset2B,
    xset2C,
    xset2D,
    xset2E,
    xset2H,
    xset2L,
    xset2,
    xset2A, // 90-97
    xset3B,
    xset3C,
    xset3D,
    xset3E,
    xset3H,
    xset3L,
    xset3,
    xset3A, // 98-9f
    xset4B,
    xset4C,
    xset4D,
    xset4E,
    xset4H,
    xset4L,
    xset4,
    xset4A, // a0-a7
    xset5B,
    xset5C,
    xset5D,
    xset5E,
    xset5H,
    xset5L,
    xset5,
    xset5A, // a8-af
    xset6B,
    xset6C,
    xset6D,
    xset6E,
    xset6H,
    xset6L,
    xset6,
    xset6A, // b0-b7
    xset7B,
    xset7C,
    xset7D,
    xset7E,
    xset7H,
    xset7L,
    xset7,
    xset7A // b8-bf
  ];

  readonly extendedOps: Z80Operation[] = [
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // 00-07
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // 08-0f
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // 10-17
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // 18-1f
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // 20-27
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // 28-2f
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // 30-37
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // 38-3f

    inBC,
    outCB,
    sbcHlBc,
    ldNniBc,
    neg,
    retn,
    im0,
    ldIA, // 40-47
    inCC,
    outCC,
    adcHlBc,
    ldBcNni,
    neg,
    retn,
    im0,
    ldRA, // 48-4f
    inDC,
    outCD,
    sbcHlDe,
    ldNniDe,
    neg,
    retn,
    im1,
    ldAI, // 50-57
    inEC,
    outCE,
    adcHlDe,
    ldDeNni,
    neg,
    retn,
    im2,
    ldAR, // 58-5f
    inHC,
    outCH,
    sbcHlHl,
    ldNniHl,
    neg,
    retn,
    im0,
    rrd, // 60-67
    inLC,
    outCL,
    adcHlHl,
    ldHlNni,
    neg,
    retn,
    im0,
    rld, // 68-6f
    in0C,
    outC0,
    sbcHlSp,
    ldNniSp,
    neg,
    retn,
    im1,
    nop, // 70-77
    inAC,
    outCA,
    adcHlSp,
    ldSpNni,
    neg,
    retn,
    im2,
    nop, // 78-7f

    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // 80-87
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // 88-8f
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // 90-97
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // 98-9f
    ldi,
    cpi,
    ini,
    outi,
    nop,
    nop,
    nop,
    nop, // a0-a7
    ldd,
    cpd,
    ind,
    outd,
    nop,
    nop,
    nop,
    nop, // a8-af
    ldir,
    cpir,
    inir,
    otir,
    nop,
    nop,
    nop,
    nop, // b0-b7
    lddr,
    cpdr,
    indr,
    otdr,
    nop,
    nop,
    nop,
    nop, // b8-bf

    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // c0-c7
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // c8-cf
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // d0-d7
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // d8-df
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // e0-e7
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // e8-ef
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop, // f0-f7
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop,
    nop // f8-ff
  ];
}

// --------------------------------------------------------------------------------------------------------------------
// ALU helpers
const incFlags: number[] = [];
const decFlags: number[] = [];
const halfCarryAddFlags: number[] = [0x00, 0x10, 0x10, 0x10, 0x00, 0x00, 0x00, 0x10];
const halfCarrySubFlags: number[] = [0x00, 0x00, 0x10, 0x00, 0x10, 0x00, 0x10, 0x10];
const overflowAddFlags: number[] = [0x00, 0x00, 0x00, 0x04, 0x04, 0x00, 0x00, 0x00];
const overflowSubFlags: number[] = [0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00];

// --- We use these tables from Z80N CPU, too
export const parityTable: number[] = [];
export const sz53Table: number[] = [];
export const sz53pvTable: number[] = [];

/**
 * Converts an unsigned byte value to a signed byte value
 */
function sbyte(dist: number): number {
  return dist >= 128 ? dist - 256 : dist;
}

// --- Initialize ALU tables
(function initializeAluTables() {
  // --- Initialize increment flags
  for (var b = 0; b < 0x100; b++) {
    const oldVal = b;
    const newVal = (oldVal + 1) & 0xff;
    const flags =
      // --- C is unaffected, we keep it 0 here in this table.
      (newVal & FlagsSetMask.R3) |
      (newVal & FlagsSetMask.R5) |
      ((newVal & 0x80) !== 0 ? FlagsSetMask.S : 0) |
      (newVal === 0 ? FlagsSetMask.Z : 0) |
      ((oldVal & 0x0f) === 0x0f ? FlagsSetMask.H : 0) |
      (oldVal === 0x7f ? FlagsSetMask.PV : 0);
    // --- Observe, N is 0, as this is an increment operation
    incFlags[b] = flags;
  }

  // --- Initialize decrement flags
  for (var b = 0; b < 0x100; b++) {
    const oldVal = b;
    const newVal = (oldVal - 1) & 0xff;
    const flags =
      // --- C is unaffected, we keep it 0 here in this table.
      (newVal & FlagsSetMask.R3) |
      (newVal & FlagsSetMask.R5) |
      ((newVal & 0x80) !== 0 ? FlagsSetMask.S : 0) |
      (newVal === 0 ? FlagsSetMask.Z : 0) |
      ((oldVal & 0x0f) === 0x00 ? FlagsSetMask.H : 0) |
      (oldVal === 0x80 ? FlagsSetMask.PV : 0) |
      // --- Observe, N is 1, as this is a decrement operation
      FlagsSetMask.N;
    decFlags[b] = flags;
  }

  // --- Initialize the parity table
  for (let i = 0; i < 0x100; i++) {
    let parity = 0;
    let b = i;
    for (let j = 0; j < 8; j++) {
      parity ^= b & 0x01;
      b = b >>> 1;
    }
    parityTable[i] = parity == 0 ? FlagsSetMask.PV : 0;
  }

  // --- Initialize the SZ53 and SZ53PV tables
  for (let i = 0; i < 0x100; i++) {
    sz53Table[i] = i & (FlagsSetMask.S | FlagsSetMask.R5 | FlagsSetMask.R3);
    sz53pvTable[i] = sz53Table[i] | parityTable[i];
  }
  sz53Table[0] |= FlagsSetMask.Z;
  sz53pvTable[0] |= FlagsSetMask.Z;
})();

// --------------------------------------------------------------------------------------------------------------------
// Z80 standard operations

/**
 * The function represents a Z80 operation
 */
export type Z80Operation = (cpu: Z80Cpu) => void;

// 0x00: NOP
function nop(_cpu: Z80Cpu) {}

// 0x01: LD BC,nn
function ldBcNN(cpu: Z80Cpu) {
  cpu.c = cpu.fetchCodeByte();
  cpu.b = cpu.fetchCodeByte();
}

// 0x02: LD (BC),A
function ldBciA(cpu: Z80Cpu) {
  cpu.writeMemory(cpu.bc, cpu.a);
  cpu.wh = cpu.a;
}

// 0x03: INC BC
function incBc(cpu: Z80Cpu) {
  cpu.bc++;
  cpu.tactPlus2WithAddress(cpu.ir);
}

// 0x04: INC B
function incB(cpu: Z80Cpu) {
  cpu.f = incFlags[cpu.b++] | cpu.flagCValue;
}

// 0x05: DEC B
function decB(cpu: Z80Cpu) {
  cpu.f = decFlags[cpu.b--] | cpu.flagCValue;
}

// 0x06: LD B,n
function ldBN(cpu: Z80Cpu) {
  cpu.b = cpu.fetchCodeByte();
}

// 0x07: RLCA
function rlca(cpu: Z80Cpu) {
  let rlcaVal = cpu.a;
  rlcaVal = rlcaVal << 1;
  const cf = (rlcaVal & 0x100) !== 0 ? FlagsSetMask.C : 0;
  if (cf !== 0) {
    rlcaVal = (rlcaVal | 0x01) & 0xff;
  }
  cpu.a = rlcaVal;
  cpu.f = cf | cpu.flagsSZPVValue | (cpu.a & FlagsSetMask.R3R5);
}

// 0x08: EX AF,AF'
function exAf(cpu: Z80Cpu) {
  const tmp = cpu.af;
  cpu.af = cpu.af_;
  cpu.af_ = tmp;
}

// 0x09: ADD HL,BC
function addHlBc(cpu: Z80Cpu) {
  cpu.tactPlus7WithAddress(cpu.ir);
  cpu.hl = cpu.add16(cpu.hl, cpu.bc);
}

// 0x0a: LD A,(BC)
function ldABci(cpu: Z80Cpu) {
  cpu.wz = cpu.bc + 1;
  cpu.a = cpu.readMemory(cpu.bc);
}

// 0x0b: DEC BC
function decBc(cpu: Z80Cpu) {
  cpu.bc--;
  cpu.tactPlus2WithAddress(cpu.ir);
}

// 0x0c: INC C
function incC(cpu: Z80Cpu) {
  cpu.f = incFlags[cpu.c++] | cpu.flagCValue;
}

// 0x0d: DEC C
function decC(cpu: Z80Cpu) {
  cpu.f = decFlags[cpu.c--] | cpu.flagCValue;
}

// 0x0e: LD C,n
function ldCN(cpu: Z80Cpu) {
  cpu.c = cpu.fetchCodeByte();
}

// 0x0f: RRCA
function rrca(cpu: Z80Cpu) {
  let rrcaVal = cpu.a;
  const cf = (rrcaVal & 0x01) !== 0 ? FlagsSetMask.C : 0;
  if ((rrcaVal & 0x01) !== 0) {
    rrcaVal = (rrcaVal >>> 1) | 0x80;
  } else {
    rrcaVal = rrcaVal >>> 1;
  }
  cpu.a = rrcaVal;
  cpu.f = cf | cpu.flagsSZPVValue | (cpu.a & FlagsSetMask.R3R5);
}

// 0x10: DJNZ d
function djnz(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  const e = cpu.fetchCodeByte();
  if (--cpu.b !== 0) {
    cpu.relativeJump(e);
  }
}

// 0x11: LD DE,nn
function ldDeNN(cpu: Z80Cpu) {
  cpu.e = cpu.fetchCodeByte();
  cpu.d = cpu.fetchCodeByte();
}

// 0x12: LD (BC),A
function ldDeiA(cpu: Z80Cpu) {
  cpu.writeMemory(cpu.de, cpu.a);
  cpu.wh = cpu.a;
}

// 0x13: INC DE
function incDe(cpu: Z80Cpu) {
  cpu.de++;
  cpu.tactPlus2WithAddress(cpu.ir);
}

// 0x14: INC D
function incD(cpu: Z80Cpu) {
  cpu.f = incFlags[cpu.d++] | cpu.flagCValue;
}

// 0x15: DEC D
function decD(cpu: Z80Cpu) {
  cpu.f = decFlags[cpu.d--] | cpu.flagCValue;
}

// 0x16: LD D,n
function ldDN(cpu: Z80Cpu) {
  cpu.d = cpu.fetchCodeByte();
}

// 0x17: RLA
function rla(cpu: Z80Cpu) {
  let rlaVal = cpu.a;
  const newCF = (rlaVal & 0x80) !== 0 ? FlagsSetMask.C : 0;
  rlaVal = rlaVal << 1;
  if (cpu.isCFlagSet()) {
    rlaVal |= 0x01;
  }
  cpu.a = rlaVal;
  cpu.f = newCF | cpu.flagsSZPVValue | (cpu.a & FlagsSetMask.R3R5);
}

// 0x18: JR e
function jr(cpu: Z80Cpu) {
  cpu.relativeJump(cpu.fetchCodeByte());
}

// 0x19: ADD HL,DE
function addHlDe(cpu: Z80Cpu) {
  cpu.tactPlus7WithAddress(cpu.ir);
  cpu.hl = cpu.add16(cpu.hl, cpu.de);
}

// 0x1a: LD A,(DE)
function ldADei(cpu: Z80Cpu) {
  cpu.wz = cpu.de + 1;
  cpu.a = cpu.readMemory(cpu.de);
}

// 0x1b: DEC DE
function decDe(cpu: Z80Cpu) {
  cpu.de--;
  cpu.tactPlus2WithAddress(cpu.ir);
}

// 0x1c: INC E
function incE(cpu: Z80Cpu) {
  cpu.f = incFlags[cpu.e++] | cpu.flagCValue;
}

// 0x1d: DEC E
function decE(cpu: Z80Cpu) {
  cpu.f = decFlags[cpu.e--] | cpu.flagCValue;
}

// 0x1e: LD E,n
function ldEN(cpu: Z80Cpu) {
  cpu.e = cpu.fetchCodeByte();
}

// 0x1f: RRA
function rra(cpu: Z80Cpu) {
  let rraVal = cpu.a;
  const newCF = (rraVal & 0x01) !== 0 ? FlagsSetMask.C : 0;
  rraVal = rraVal >>> 1;
  if (cpu.isCFlagSet()) {
    rraVal |= 0x80;
  }
  cpu.a = rraVal;
  cpu.f = newCF | cpu.flagsSZPVValue | (cpu.a & FlagsSetMask.R3R5);
}

// 0x20: JR NZ,e
function jrnz(cpu: Z80Cpu) {
  const e = cpu.fetchCodeByte();
  if (!cpu.isZFlagSet()) {
    cpu.relativeJump(e);
  }
}

// 0x21: LD HL,nn
function ldHlNN(cpu: Z80Cpu) {
  cpu.l = cpu.fetchCodeByte();
  cpu.h = cpu.fetchCodeByte();
}

// 0x22: LD (nn),HL
function ldNNiHl(cpu: Z80Cpu) {
  cpu.store16(cpu.l, cpu.h);
}

// 0x23: INC HL
function incHl(cpu: Z80Cpu) {
  cpu.hl++;
  cpu.tactPlus2WithAddress(cpu.ir);
}

// 0x24: INC H
function incH(cpu: Z80Cpu) {
  cpu.f = incFlags[cpu.h++] | cpu.flagCValue;
}

// 0x25: DEC H
function decH(cpu: Z80Cpu) {
  cpu.f = decFlags[cpu.h--] | cpu.flagCValue;
}

// 0x26: LD H,n
function ldHN(cpu: Z80Cpu) {
  cpu.h = cpu.fetchCodeByte();
}

// 0x27: DAA
function daa(cpu: Z80Cpu) {
  let add = 0;
  let carry = cpu.flagCValue;
  if (cpu.isHFlagSet() || (cpu.a & 0x0f) > 9) {
    add = 6;
  }
  if (carry !== 0 || cpu.a > 0x99) {
    add |= 0x60;
  }
  if (cpu.a > 0x99) {
    carry = FlagsSetMask.C;
  }
  if (cpu.isNFlagSet()) {
    cpu.sub8(add);
  } else {
    cpu.add8(add);
  }

  cpu.f = (cpu.f & ~(FlagsSetMask.C | FlagsSetMask.PV)) | carry | parityTable[cpu.a];
}

// 0x28: JR Z,e
function jrz(cpu: Z80Cpu) {
  const e = cpu.fetchCodeByte();
  if (cpu.isZFlagSet()) {
    cpu.relativeJump(e);
  }
}

// 0x29: ADD HL,HL
function addHlHl(cpu: Z80Cpu) {
  cpu.tactPlus7WithAddress(cpu.ir);
  cpu.hl = cpu.add16(cpu.hl, cpu.hl);
}

// 0x2a: LD HL,(nn)
function ldHlNNi(cpu: Z80Cpu) {
  let adr = cpu.fetchCodeByte();
  adr += cpu.fetchCodeByte() << 8;
  cpu.wz = adr + 1;
  let val = cpu.readMemory(adr);
  val += cpu.readMemory(cpu.wz) << 8;
  cpu.hl = val;
}

// 0x2b: DEC HL
function decHl(cpu: Z80Cpu) {
  cpu.hl--;
  cpu.tactPlus2WithAddress(cpu.ir);
}

// 0x2c: INC L
function incL(cpu: Z80Cpu) {
  cpu.f = incFlags[cpu.l++] | cpu.flagCValue;
}

// 0x2d: DEC L
function decL(cpu: Z80Cpu) {
  cpu.f = decFlags[cpu.l--] | cpu.flagCValue;
}

// 0x2e: LD L,n
function ldLN(cpu: Z80Cpu) {
  cpu.l = cpu.fetchCodeByte();
}

// 0x2f: CPL
function cpl(cpu: Z80Cpu) {
  cpu.a ^= 0xff;
  cpu.f =
    (cpu.f & (FlagsSetMask.C | FlagsSetMask.PV | FlagsSetMask.Z | FlagsSetMask.S)) |
    (cpu.a & FlagsSetMask.R3R5) |
    FlagsSetMask.N |
    FlagsSetMask.H;
}

// 0x30: JR NC,e
function jrnc(cpu: Z80Cpu) {
  const e = cpu.fetchCodeByte();
  if (!cpu.isCFlagSet()) {
    cpu.relativeJump(e);
  }
}

// 0x31: LD SP,nn
function ldSpNN(cpu: Z80Cpu) {
  const l = cpu.fetchCodeByte();
  const h = cpu.fetchCodeByte();
  cpu.sp = (h << 8) | l;
}

// 0x32: LD (nn),A
function ldNNiA(cpu: Z80Cpu) {
  const l = cpu.fetchCodeByte();
  const addr = (cpu.fetchCodeByte() << 8) | l;
  cpu.wl = addr + 1;
  cpu.wh = cpu.a;
  cpu.writeMemory(addr, cpu.a);
}

// 0x33: INC SP
function incSp(cpu: Z80Cpu) {
  cpu.sp++;
  cpu.tactPlus2WithAddress(cpu.ir);
}

// 0x34: INC (HL)
function incHli(cpu: Z80Cpu) {
  let memValue = cpu.readMemory(cpu.hl);
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.f = incFlags[memValue++] | cpu.flagCValue;
  cpu.writeMemory(cpu.hl, memValue);
}

// 0x35: DEC (HL)
function decHli(cpu: Z80Cpu) {
  let memValue = cpu.readMemory(cpu.hl);
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.f = decFlags[memValue--] | cpu.flagCValue;
  cpu.writeMemory(cpu.hl, memValue);
}

// 0x36: LD (HL),n
function ldHliN(cpu: Z80Cpu) {
  cpu.writeMemory(cpu.hl, cpu.fetchCodeByte());
}

// 0x37: SCF
function scf(cpu: Z80Cpu) {
  cpu.f = cpu.flagsSZPVValue | FlagsSetMask.C;
  cpu.f = (cpu.f & ~FlagsSetMask.R3R5) | (cpu.a & FlagsSetMask.R3R5);
}

// 0x38: JR C,e
function jrc(cpu: Z80Cpu) {
  const e = cpu.fetchCodeByte();
  if (cpu.isCFlagSet()) {
    cpu.relativeJump(e);
  }
}

// 0x39: ADD HL,SP
function addHlSp(cpu: Z80Cpu) {
  cpu.tactPlus7WithAddress(cpu.ir);
  cpu.hl = cpu.add16(cpu.hl, cpu.sp);
}

// 0x3a: LD A,(nn)
function ldANNi(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  cpu.a = cpu.readMemory(cpu.wz);
  cpu.wz++;
}

// 0x3b: DEC SP
function decSp(cpu: Z80Cpu) {
  cpu.sp--;
  cpu.tactPlus2WithAddress(cpu.ir);
}

// 0x3c: INC A
function incA(cpu: Z80Cpu) {
  cpu.f = incFlags[cpu.a++] | cpu.flagCValue;
}

// 0x3d: DEC A
function decA(cpu: Z80Cpu) {
  cpu.f = decFlags[cpu.a--] | cpu.flagCValue;
}

// 0x3e: LD A,n
function ldAN(cpu: Z80Cpu) {
  cpu.a = cpu.fetchCodeByte();
}

// 0x3f: CCF
function ccf(cpu: Z80Cpu) {
  cpu.f = cpu.flagsSZPVValue | (cpu.isCFlagSet() ? FlagsSetMask.H : FlagsSetMask.C);
  cpu.f = (cpu.f & ~FlagsSetMask.R3R5) | (cpu.a & FlagsSetMask.R3R5);
}

// 0x41: LD B,C
function ldBC(cpu: Z80Cpu) {
  cpu.b = cpu.c;
}

// 0x42: LD B,D
function ldBD(cpu: Z80Cpu) {
  cpu.b = cpu.d;
}

// 0x43: LD B,E
function ldBE(cpu: Z80Cpu) {
  cpu.b = cpu.e;
}

// 0x44: LD B,H
function ldBH(cpu: Z80Cpu) {
  cpu.b = cpu.h;
}

// 0x45: LD B,L
function ldBL(cpu: Z80Cpu) {
  cpu.b = cpu.l;
}

// 0x46: LD B,(HL)
function ldBHli(cpu: Z80Cpu) {
  cpu.b = cpu.readMemory(cpu.hl);
}

// 0x47: LD B,A
function ldBA(cpu: Z80Cpu) {
  cpu.b = cpu.a;
}

// 0x48: LD C,B
function ldCB(cpu: Z80Cpu) {
  cpu.c = cpu.b;
}

// 0x4a: LD C,D
function ldCD(cpu: Z80Cpu) {
  cpu.c = cpu.d;
}

// 0x4b LD C,E
function ldCE(cpu: Z80Cpu) {
  cpu.c = cpu.e;
}

// 0x4c: LD C,H
function ldCH(cpu: Z80Cpu) {
  cpu.c = cpu.h;
}

// 0x4d: LD C,L
function ldCL(cpu: Z80Cpu) {
  cpu.c = cpu.l;
}

// 0x4e: LD C,(HL)
function ldCHli(cpu: Z80Cpu) {
  cpu.c = cpu.readMemory(cpu.hl);
}

// 0x4f: LD C,A
function ldCA(cpu: Z80Cpu) {
  cpu.c = cpu.a;
}

// 0x50: LD D,B
function ldDB(cpu: Z80Cpu) {
  cpu.d = cpu.b;
}

// 0x51: LD D,C
function ldDC(cpu: Z80Cpu) {
  cpu.d = cpu.c;
}

// 0x53: LD D,E
function ldDE(cpu: Z80Cpu) {
  cpu.d = cpu.e;
}

// 0x54: LD D,H
function ldDH(cpu: Z80Cpu) {
  cpu.d = cpu.h;
}

// 0x55: LD D,L
function ldDL(cpu: Z80Cpu) {
  cpu.d = cpu.l;
}

// 0x56: LD D,(HL)
function ldDHli(cpu: Z80Cpu) {
  cpu.d = cpu.readMemory(cpu.hl);
}

// 0x57: LD D,A
function ldDA(cpu: Z80Cpu) {
  cpu.d = cpu.a;
}

// 0x58: LD E,B
function ldEB(cpu: Z80Cpu) {
  cpu.e = cpu.b;
}

// 0x59: LD E,C
function ldEC(cpu: Z80Cpu) {
  cpu.e = cpu.c;
}

// 0x5a: LD E,D
function ldED(cpu: Z80Cpu) {
  cpu.e = cpu.d;
}

// 0x5c: LD E,H
function ldEH(cpu: Z80Cpu) {
  cpu.e = cpu.h;
}

// 0x5d: LD E,L
function ldEL(cpu: Z80Cpu) {
  cpu.e = cpu.l;
}

// 0x5e: LD E,(HL)
function ldEHli(cpu: Z80Cpu) {
  cpu.e = cpu.readMemory(cpu.hl);
}

// 0x5f: LD E,A
function ldEA(cpu: Z80Cpu) {
  cpu.e = cpu.a;
}

// 0x60: LD H,B
function ldHB(cpu: Z80Cpu) {
  cpu.h = cpu.b;
}

// 0x61: LD H,C
function ldHC(cpu: Z80Cpu) {
  cpu.h = cpu.c;
}

// 0x62: LD H,D
function ldHD(cpu: Z80Cpu) {
  cpu.h = cpu.d;
}

// 0x63: LD H,E
function ldHE(cpu: Z80Cpu) {
  cpu.h = cpu.e;
}

// 0x65: LD H,L
function ldHL(cpu: Z80Cpu) {
  cpu.h = cpu.l;
}

// 0x66: LD H,(HL)
function ldHHli(cpu: Z80Cpu) {
  cpu.h = cpu.readMemory(cpu.hl);
}

// 0x67: LD H,A
function ldHA(cpu: Z80Cpu) {
  cpu.h = cpu.a;
}

// 0x68: LD L,B
function ldLB(cpu: Z80Cpu) {
  cpu.l = cpu.b;
}

// 0x69: LD L,C
function ldLC(cpu: Z80Cpu) {
  cpu.l = cpu.c;
}

// 0x6a: LD L,D
function ldLD(cpu: Z80Cpu) {
  cpu.l = cpu.d;
}

// 0x6b: LD L,E
function ldLE(cpu: Z80Cpu) {
  cpu.l = cpu.e;
}

// 0x6c: LD L,H
function ldLH(cpu: Z80Cpu) {
  cpu.l = cpu.h;
}

// 0x6e: LD L,(HL)
function ldLHli(cpu: Z80Cpu) {
  cpu.l = cpu.readMemory(cpu.hl);
}

// 0x6f: LD L,A
function ldLA(cpu: Z80Cpu) {
  cpu.l = cpu.a;
}

// 0x70: LD (HL),B
function ldHliB(cpu: Z80Cpu) {
  cpu.writeMemory(cpu.hl, cpu.b);
}

// 0x71: LD (HL),C
function ldHliC(cpu: Z80Cpu) {
  cpu.writeMemory(cpu.hl, cpu.c);
}

// 0x72: LD (HL),D
function ldHliD(cpu: Z80Cpu) {
  cpu.writeMemory(cpu.hl, cpu.d);
}

// 0x73: LD (HL),E
function ldHliE(cpu: Z80Cpu) {
  cpu.writeMemory(cpu.hl, cpu.e);
}

// 0x74: LD (HL),H
function ldHliH(cpu: Z80Cpu) {
  cpu.writeMemory(cpu.hl, cpu.h);
}

// 0x75: LD (HL),L
function ldHliL(cpu: Z80Cpu) {
  cpu.writeMemory(cpu.hl, cpu.l);
}

// 0x76: HALT
function halt(cpu: Z80Cpu) {
  cpu.halted = true;
  cpu.pc--;
}

// 0x77: LD (HL),A
function ldHliA(cpu: Z80Cpu) {
  cpu.writeMemory(cpu.hl, cpu.a);
}

// 0x78: LD A,B
function ldAB(cpu: Z80Cpu) {
  cpu.a = cpu.b;
}

// 0x79: LD A,C
function ldAC(cpu: Z80Cpu) {
  cpu.a = cpu.c;
}

// 0x7A: LD A,D
function ldAD(cpu: Z80Cpu) {
  cpu.a = cpu.d;
}

// 0x7B: LD A,E
function ldAE(cpu: Z80Cpu) {
  cpu.a = cpu.e;
}

// 0x7C: LD A,H
function ldAH(cpu: Z80Cpu) {
  cpu.a = cpu.h;
}

// 0x7D: LD A,L
function ldAL(cpu: Z80Cpu) {
  cpu.a = cpu.l;
}

// 0x7E: LD A,(HL)
function ldAHli(cpu: Z80Cpu) {
  cpu.a = cpu.readMemory(cpu.hl);
}

// 0x80: ADD A,B
function addAB(cpu: Z80Cpu) {
  cpu.add8(cpu.b);
}

// 0x81: ADD A,C
function addAC(cpu: Z80Cpu) {
  cpu.add8(cpu.c);
}

// 0x82: ADD A,D
function addAD(cpu: Z80Cpu) {
  cpu.add8(cpu.d);
}

// 0x83: ADD A,E
function addAE(cpu: Z80Cpu) {
  cpu.add8(cpu.e);
}

// 0x84: ADD A,H
function addAH(cpu: Z80Cpu) {
  cpu.add8(cpu.h);
}

// 0x85: ADD A,L
function addAL(cpu: Z80Cpu) {
  cpu.add8(cpu.l);
}

// 0x86: ADD A,(HL)
function addAHli(cpu: Z80Cpu) {
  cpu.add8(cpu.readMemory(cpu.hl));
}

// 0x87: ADD A,A
function addAA(cpu: Z80Cpu) {
  cpu.add8(cpu.a);
}

// 0x88: ADC A,B
function adcAB(cpu: Z80Cpu) {
  cpu.adc8(cpu.b);
}

// 0x89: ADC A,C
function adcAC(cpu: Z80Cpu) {
  cpu.adc8(cpu.c);
}

// 0x8A: ADC A,D
function adcAD(cpu: Z80Cpu) {
  cpu.adc8(cpu.d);
}

// 0x8B: ADC A,E
function adcAE(cpu: Z80Cpu) {
  cpu.adc8(cpu.e);
}

// 0x8C: ADC A,H
function adcAH(cpu: Z80Cpu) {
  cpu.adc8(cpu.h);
}

// 0x8D: ADC A,L
function adcAL(cpu: Z80Cpu) {
  cpu.adc8(cpu.l);
}

// 0x8E: ADC A,(HL)
function adcAHli(cpu: Z80Cpu) {
  cpu.adc8(cpu.readMemory(cpu.hl));
}

// 0x8F: ADC A,A
function adcAA(cpu: Z80Cpu) {
  cpu.adc8(cpu.a);
}

// 0x90: SUB A,B
function subAB(cpu: Z80Cpu) {
  cpu.sub8(cpu.b);
}

// 0x91: SUB A,C
function subAC(cpu: Z80Cpu) {
  cpu.sub8(cpu.c);
}

// 0x92: SUB A,D
function subAD(cpu: Z80Cpu) {
  cpu.sub8(cpu.d);
}

// 0x93: SUB A,E
function subAE(cpu: Z80Cpu) {
  cpu.sub8(cpu.e);
}

// 0x94: SUB A,H
function subAH(cpu: Z80Cpu) {
  cpu.sub8(cpu.h);
}

// 0x95: SUB A,L
function subAL(cpu: Z80Cpu) {
  cpu.sub8(cpu.l);
}

// 0x96: SUB A,(HL)
function subAHli(cpu: Z80Cpu) {
  cpu.sub8(cpu.readMemory(cpu.hl));
}

// 0x97: SUB A,A
function subAA(cpu: Z80Cpu) {
  cpu.sub8(cpu.a);
}

// 0x98: SBC A,B
function sbcAB(cpu: Z80Cpu) {
  cpu.sbc8(cpu.b);
}

// 0x99: SBC A,C
function sbcAC(cpu: Z80Cpu) {
  cpu.sbc8(cpu.c);
}

// 0x9A: SBC A,D
function sbcAD(cpu: Z80Cpu) {
  cpu.sbc8(cpu.d);
}

// 0x9B: SBC A,E
function sbcAE(cpu: Z80Cpu) {
  cpu.sbc8(cpu.e);
}

// 0x9C: SBC A,H
function sbcAH(cpu: Z80Cpu) {
  cpu.sbc8(cpu.h);
}

// 0x9D: SBC A,L
function sbcAL(cpu: Z80Cpu) {
  cpu.sbc8(cpu.l);
}

// 0x9E: SBC A,(HL)
function sbcAHli(cpu: Z80Cpu) {
  cpu.sbc8(cpu.readMemory(cpu.hl));
}

// 0x9f: SBC A,A
function sbcAA(cpu: Z80Cpu) {
  cpu.sbc8(cpu.a);
}

// 0xa0: AND A,B
function andAB(cpu: Z80Cpu) {
  cpu.and8(cpu.b);
}

// 0xa1: AND A,C
function andAC(cpu: Z80Cpu) {
  cpu.and8(cpu.c);
}

// 0xa2: AND A,D
function andAD(cpu: Z80Cpu) {
  cpu.and8(cpu.d);
}

// 0xa3: AND A,E
function andAE(cpu: Z80Cpu) {
  cpu.and8(cpu.e);
}

// 0xa4: AND A,H
function andAH(cpu: Z80Cpu) {
  cpu.and8(cpu.h);
}

// 0xa5: AND A,L
function andAL(cpu: Z80Cpu) {
  cpu.and8(cpu.l);
}

// 0xa6: AND A,(HL)
function andAHli(cpu: Z80Cpu) {
  cpu.and8(cpu.readMemory(cpu.hl));
}

// 0xa7: AND A,A
function andAA(cpu: Z80Cpu) {
  cpu.and8(cpu.a);
}

// 0xa8: XOR A,B
function xorAB(cpu: Z80Cpu) {
  cpu.xor8(cpu.b);
}

// 0xa9: XOR A,C
function xorAC(cpu: Z80Cpu) {
  cpu.xor8(cpu.c);
}
// 0xaa: XOR A,D
function xorAD(cpu: Z80Cpu) {
  cpu.xor8(cpu.d);
}

// 0xab: XOR A,E
function xorAE(cpu: Z80Cpu) {
  cpu.xor8(cpu.e);
}

// 0xac: XOR A,H
function xorAH(cpu: Z80Cpu) {
  cpu.xor8(cpu.h);
}

// 0xad: XOR A,L
function xorAL(cpu: Z80Cpu) {
  cpu.xor8(cpu.l);
}

// 0xae: XOR A,(HL)
function xorAHli(cpu: Z80Cpu) {
  cpu.xor8(cpu.readMemory(cpu.hl));
}

// 0xaf: XOR A,A
function xorAA(cpu: Z80Cpu) {
  cpu.xor8(cpu.a);
}

// 0xb0: OR A,B
function orAB(cpu: Z80Cpu) {
  cpu.or8(cpu.b);
}

// 0xb1: OR A,C
function orAC(cpu: Z80Cpu) {
  cpu.or8(cpu.c);
}

// 0xb2: OR A,D
function orAD(cpu: Z80Cpu) {
  cpu.or8(cpu.d);
}

// 0xb3: OR A,E
function orAE(cpu: Z80Cpu) {
  cpu.or8(cpu.e);
}

// 0xb4: OR A,H
function orAH(cpu: Z80Cpu) {
  cpu.or8(cpu.h);
}

// 0xb5: OR A,L
function orAL(cpu: Z80Cpu) {
  cpu.or8(cpu.l);
}

// 0xb6: OR A,(HL)
function orAHli(cpu: Z80Cpu) {
  cpu.or8(cpu.readMemory(cpu.hl));
}

// 0xb7: OR A,A
function orAA(cpu: Z80Cpu) {
  cpu.or8(cpu.a);
}

// 0xb8: CP B
function cpB(cpu: Z80Cpu) {
  cpu.cp8(cpu.b);
}

// 0xb9: CP C
function cpC(cpu: Z80Cpu) {
  cpu.cp8(cpu.c);
}

// 0xba: CP D
function cpD(cpu: Z80Cpu) {
  cpu.cp8(cpu.d);
}

// 0xbb: CP E
function cpE(cpu: Z80Cpu) {
  cpu.cp8(cpu.e);
}

// 0xbc: CP H
function cpH(cpu: Z80Cpu) {
  cpu.cp8(cpu.h);
}

// 0xbd: CP L
function cpL(cpu: Z80Cpu) {
  cpu.cp8(cpu.l);
}

// 0xbe: CP (HL)
function cpHli(cpu: Z80Cpu) {
  cpu.cp8(cpu.readMemory(cpu.hl));
}

// 0xbf: CP A
function cpA(cpu: Z80Cpu) {
  cpu.cp8(cpu.a);
}

// 0xc0: RET NZ
function retNz(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  if (!cpu.isZFlagSet()) {
    ret(cpu);
  }
}

// 0xc1: POP BC
function popBc(cpu: Z80Cpu) {
  cpu.c = cpu.readMemory(cpu.sp);
  cpu.sp++;
  cpu.b = cpu.readMemory(cpu.sp);
  cpu.sp++;
}

// 0xc2: JP NZ,nn
function jpNz(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  if (!cpu.isZFlagSet()) {
    cpu.pc = cpu.wz;
  }
}

// 0xc3: JP nn
function jp(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  cpu.pc = cpu.wz;
}

// 0xc4: CALL NZ,nn
function callNz(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  if (!cpu.isZFlagSet()) {
    cpu.callCore();
  }
}

// 0xc5: PUSH BC
function pushBc(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  cpu.sp--;
  cpu.writeMemory(cpu.sp, cpu.b);
  cpu.sp--;
  cpu.writeMemory(cpu.sp, cpu.c);
}

// 0xc6: ADD A,N
function addAN(cpu: Z80Cpu) {
  cpu.add8(cpu.fetchCodeByte());
}

// 0xc7: RST 00
function rst00(cpu: Z80Cpu) {
  cpu.rstCore(0x0000);
}

// 0xc8: RET Z
function retZ(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  if (cpu.isZFlagSet()) {
    ret(cpu);
  }
}

// 0xc9: RET
function ret(cpu: Z80Cpu) {
  cpu.wl = cpu.readMemory(cpu.sp);
  cpu.sp++;
  cpu.wh = cpu.readMemory(cpu.sp);
  cpu.sp++;
  cpu.pc = cpu.wz;
  cpu.retExecuted = true;
}

// 0xca: JP Z,nn
function jpZ(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  if (cpu.isZFlagSet()) {
    cpu.pc = cpu.wz;
  }
}

// 0xcc: CALL Z,nn
function callZ(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  if (cpu.isZFlagSet()) {
    cpu.callCore();
  }
}

// 0xcd: CALL nn
function call(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  cpu.callCore();
}

// 0xce: ADC A,N
function adcAN(cpu: Z80Cpu) {
  cpu.adc8(cpu.fetchCodeByte());
}

// 0xcf: RST 08
function rst08(cpu: Z80Cpu) {
  cpu.rstCore(0x0008);
}

// 0xd0: RET NC
function retNc(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  if (!cpu.isCFlagSet()) {
    ret(cpu);
  }
}

// 0xd1: POP DE
function popDe(cpu: Z80Cpu) {
  cpu.e = cpu.readMemory(cpu.sp);
  cpu.sp++;
  cpu.d = cpu.readMemory(cpu.sp);
  cpu.sp++;
}

// 0xd2: JP NC,nn
function jpNc(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  if (!cpu.isCFlagSet()) {
    cpu.pc = cpu.wz;
  }
}

// 0xd3: OUT (n),A
function outNA(cpu: Z80Cpu) {
  const nn = cpu.fetchCodeByte();
  const port = nn | (cpu.a << 8);
  cpu.wh = cpu.a;
  cpu.wl = nn + 1;
  cpu.writePort(port, cpu.a);
}

// 0xd4: CALL NC,nn
function callNc(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  if (!cpu.isCFlagSet()) {
    cpu.callCore();
  }
}

// 0xd5: PUSH DE
function pushDe(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  cpu.sp--;
  cpu.writeMemory(cpu.sp, cpu.d);
  cpu.sp--;
  cpu.writeMemory(cpu.sp, cpu.e);
}

// 0xd6: SUB A,N
function subAN(cpu: Z80Cpu) {
  cpu.sub8(cpu.fetchCodeByte());
}

// 0xd7: RST 10
function rst10(cpu: Z80Cpu) {
  cpu.rstCore(0x0010);
}

// 0xd8: RET C
function retC(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  if (cpu.isCFlagSet()) {
    ret(cpu);
  }
}

// 0xd9: EXX
function exx(cpu: Z80Cpu) {
  let tmp = cpu.bc;
  cpu.bc = cpu.bc_;
  cpu.bc_ = tmp;
  tmp = cpu.de;
  cpu.de = cpu.de_;
  cpu.de_ = tmp;
  tmp = cpu.hl;
  cpu.hl = cpu.hl_;
  cpu.hl_ = tmp;
}

// 0xda: JP C,nn
function jpC(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  if (cpu.isCFlagSet()) {
    cpu.pc = cpu.wz;
  }
}

// 0xdb: IN A,(n)
function inAN(cpu: Z80Cpu) {
  const inTemp = cpu.fetchCodeByte() | (cpu.a << 8);
  cpu.a = cpu.readPort(inTemp);
  cpu.wz = inTemp + 1;
}

// 0xdc: CALL C,nn
function callC(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  if (cpu.isCFlagSet()) {
    cpu.callCore();
  }
}

// 0xde: SBC A,N
function sbcAN(cpu: Z80Cpu) {
  cpu.sbc8(cpu.fetchCodeByte());
}

// 0xdf: RST 18
function rst18(cpu: Z80Cpu) {
  cpu.rstCore(0x0018);
}

// 0xe0: RET PO
function retPo(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  if (!cpu.isPvFlagSet()) {
    ret(cpu);
  }
}

// 0xe1: POP HL
function popHl(cpu: Z80Cpu) {
  cpu.l = cpu.readMemory(cpu.sp);
  cpu.sp++;
  cpu.h = cpu.readMemory(cpu.sp);
  cpu.sp++;
}

// 0xe2: JP PO,nn
function jpPo(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  if (!cpu.isPvFlagSet()) {
    cpu.pc = cpu.wz;
  }
}

// 0xe3: EX (SP),HL
function exSpiHl(cpu: Z80Cpu) {
  const sp1 = cpu.sp + 1;
  const tempL = cpu.readMemory(cpu.sp);
  const tempH = cpu.readMemory(sp1);
  cpu.tactPlus1WithAddress(sp1);
  cpu.writeMemory(sp1, cpu.h);
  cpu.writeMemory(cpu.sp, cpu.l);
  cpu.tactPlus2WithAddress(cpu.sp);
  cpu.wl = tempL;
  cpu.wh = tempH;
  cpu.hl = cpu.wz;
}

// 0xe4: CALL PO,nn
function callPo(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  if (!cpu.isPvFlagSet()) {
    cpu.callCore();
  }
}

// 0xe5: PUSH HL
function pushHl(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  cpu.sp--;
  cpu.writeMemory(cpu.sp, cpu.h);
  cpu.sp--;
  cpu.writeMemory(cpu.sp, cpu.l);
}

// 0xe6: AND A,N
function andAN(cpu: Z80Cpu) {
  cpu.and8(cpu.fetchCodeByte());
}

// 0xe7: RST 20
function rst20(cpu: Z80Cpu) {
  cpu.rstCore(0x0020);
}

// 0xe8: RET PE
function retPe(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  if (cpu.isPvFlagSet()) {
    ret(cpu);
  }
}

// 0xe9: JP (HL)
function jpHl(cpu: Z80Cpu) {
  cpu.pc = cpu.hl;
}

// 0xea: JP PE,nn
function jpPe(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  if (cpu.isPvFlagSet()) {
    cpu.pc = cpu.wz;
  }
}

// 0xeb: EX DE,HL
function exDeHl(cpu: Z80Cpu) {
  const tmp = cpu.de;
  cpu.de = cpu.hl;
  cpu.hl = tmp;
}

// 0xec: CALL PE,nn
function callPe(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  if (cpu.isPvFlagSet()) {
    cpu.callCore();
  }
}

// 0xee: XOR A,N
function xorAN(cpu: Z80Cpu) {
  cpu.xor8(cpu.fetchCodeByte());
}

// 0xef: RST 28
function rst28(cpu: Z80Cpu) {
  cpu.rstCore(0x0028);
}

// 0xf0: RET P
function retP(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  if (!cpu.isSFlagSet()) {
    ret(cpu);
  }
}

// 0xf1: POP AF
function popAf(cpu: Z80Cpu) {
  cpu.f = cpu.readMemory(cpu.sp);
  cpu.sp++;
  cpu.a = cpu.readMemory(cpu.sp);
  cpu.sp++;
}

// 0xf2: JP P,nn
function jpP(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  if (!cpu.isSFlagSet()) {
    cpu.pc = cpu.wz;
  }
}

// 0xf3: DI
function di(cpu: Z80Cpu) {
  cpu.iff2 = cpu.iff1 = false;
}

// 0xf4: CALL P,nn
function callP(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  if (!cpu.isSFlagSet()) {
    cpu.callCore();
  }
}

// 0xf5: PUSH AF
function pushAf(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  cpu.sp--;
  cpu.writeMemory(cpu.sp, cpu.a);
  cpu.sp--;
  cpu.writeMemory(cpu.sp, cpu.f);
}

// 0xf6: OR A,N
function orAN(cpu: Z80Cpu) {
  cpu.or8(cpu.fetchCodeByte());
}

// 0xf7: RST 30
function rst30(cpu: Z80Cpu) {
  cpu.rstCore(0x0030);
}

// 0xf8: RET M
function retM(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  if (cpu.isSFlagSet()) {
    ret(cpu);
  }
}

// 0xf9: LD SP,HL
function ldSpHl(cpu: Z80Cpu) {
  cpu.tactPlus2WithAddress(cpu.ir);
  cpu.sp = cpu.hl;
}

// 0xfa: JP M,nn
function jpM(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  if (cpu.isSFlagSet()) {
    cpu.pc = cpu.wz;
  }
}

// 0xfb: EI
function ei(cpu: Z80Cpu) {
  cpu.iff2 = cpu.iff1 = true;
  cpu.eiBacklog = 2;
}

// 0xfc: CALL M,nn
function callM(cpu: Z80Cpu) {
  cpu.wl = cpu.fetchCodeByte();
  cpu.wh = cpu.fetchCodeByte();
  if (cpu.isSFlagSet()) {
    cpu.callCore();
  }
}

// 0xfe: CP A,N
function cpAN(cpu: Z80Cpu) {
  cpu.cp8(cpu.fetchCodeByte());
}

// 0xff: RST 38
function rst38(cpu: Z80Cpu) {
  cpu.rstCore(0x0038);
}

// --------------------------------------------------------------------------------------------------------------------
// Z80 bit operations

// 0x00: RLC B
function rlcB(cpu: Z80Cpu) {
  cpu.b = cpu.rlc8(cpu.b);
}

// 0x01: RLC C
function rlcC(cpu: Z80Cpu) {
  cpu.c = cpu.rlc8(cpu.c);
}

// 0x02: RLC D
function rlcD(cpu: Z80Cpu) {
  cpu.d = cpu.rlc8(cpu.d);
}

// 0x03: RLC E
function rlcE(cpu: Z80Cpu) {
  cpu.e = cpu.rlc8(cpu.e);
}

// 0x04: RLC H
function rlcH(cpu: Z80Cpu) {
  cpu.h = cpu.rlc8(cpu.h);
}

// 0x05: RLC L
function rlcL(cpu: Z80Cpu) {
  cpu.l = cpu.rlc8(cpu.l);
}

// 0x06: RLC (HL)
function rlcHli(cpu: Z80Cpu) {
  const tmp = cpu.rlc8(cpu.readMemory(cpu.hl));
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0x07: RLC A
function rlcA(cpu: Z80Cpu) {
  cpu.a = cpu.rlc8(cpu.a);
}

// 0x08: RRC B
function rrcB(cpu: Z80Cpu) {
  cpu.b = cpu.rrc8(cpu.b);
}

// 0x09: RRC C
function rrcC(cpu: Z80Cpu) {
  cpu.c = cpu.rrc8(cpu.c);
}

// 0x0a: RRC D
function rrcD(cpu: Z80Cpu) {
  cpu.d = cpu.rrc8(cpu.d);
}

// 0x0b: RRC E
function rrcE(cpu: Z80Cpu) {
  cpu.e = cpu.rrc8(cpu.e);
}

// 0x0c: RRC H
function rrcH(cpu: Z80Cpu) {
  cpu.h = cpu.rrc8(cpu.h);
}

// 0x0d: RRC L
function rrcL(cpu: Z80Cpu) {
  cpu.l = cpu.rrc8(cpu.l);
}

// 0x0e: RRC (HL)
function rrcHli(cpu: Z80Cpu) {
  const tmp = cpu.rrc8(cpu.readMemory(cpu.hl));
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0x0f: RRC A
function rrcA(cpu: Z80Cpu) {
  cpu.a = cpu.rrc8(cpu.a);
}

// 0x10: RL B
function rlB(cpu: Z80Cpu) {
  cpu.b = cpu.rl8(cpu.b);
}

// 0x11: RL C
function rlC(cpu: Z80Cpu) {
  cpu.c = cpu.rl8(cpu.c);
}

// 0x12: RL D
function rlD(cpu: Z80Cpu) {
  cpu.d = cpu.rl8(cpu.d);
}

// 0x13: RL E
function rlE(cpu: Z80Cpu) {
  cpu.e = cpu.rl8(cpu.e);
}

// 0x14: RL H
function rlH(cpu: Z80Cpu) {
  cpu.h = cpu.rl8(cpu.h);
}

// 0x15: RL L
function rlL(cpu: Z80Cpu) {
  cpu.l = cpu.rl8(cpu.l);
}

// 0x16: RL (HL)
function rlHli(cpu: Z80Cpu) {
  const tmp = cpu.rl8(cpu.readMemory(cpu.hl));
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0x17: RL A
function rlA(cpu: Z80Cpu) {
  cpu.a = cpu.rl8(cpu.a);
}

// 0x18: RR B
function rrB(cpu: Z80Cpu) {
  cpu.b = cpu.rr8(cpu.b);
}

// 0x19: RR C
function rrC(cpu: Z80Cpu) {
  cpu.c = cpu.rr8(cpu.c);
}

// 0x1a: RR D
function rrD(cpu: Z80Cpu) {
  cpu.d = cpu.rr8(cpu.d);
}

// 0x1b: RR E
function rrE(cpu: Z80Cpu) {
  cpu.e = cpu.rr8(cpu.e);
}

// 0x1c: RR H
function rrH(cpu: Z80Cpu) {
  cpu.h = cpu.rr8(cpu.h);
}

// 0x1d: RR L
function rrL(cpu: Z80Cpu) {
  cpu.l = cpu.rr8(cpu.l);
}

// 0x1e: RR (HL)
function rrHli(cpu: Z80Cpu) {
  const tmp = cpu.rr8(cpu.readMemory(cpu.hl));
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0x1f: RR A
function rrA(cpu: Z80Cpu) {
  cpu.a = cpu.rr8(cpu.a);
}

// 0x20: SLA B
function slaB(cpu: Z80Cpu) {
  cpu.b = cpu.sla8(cpu.b);
}

// 0x21: SLA C
function slaC(cpu: Z80Cpu) {
  cpu.c = cpu.sla8(cpu.c);
}

// 0x22: SLA D
function slaD(cpu: Z80Cpu) {
  cpu.d = cpu.sla8(cpu.d);
}

// 0x23: SLA E
function slaE(cpu: Z80Cpu) {
  cpu.e = cpu.sla8(cpu.e);
}

// 0x24: SLA H
function slaH(cpu: Z80Cpu) {
  cpu.h = cpu.sla8(cpu.h);
}

// 0x25: SLA L
function slaL(cpu: Z80Cpu) {
  cpu.l = cpu.sla8(cpu.l);
}

// 0x26: SLA (HL)
function slaHli(cpu: Z80Cpu) {
  const tmp = cpu.sla8(cpu.readMemory(cpu.hl));
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0x27: SLA A
function slaA(cpu: Z80Cpu) {
  cpu.a = cpu.sla8(cpu.a);
}

// 0x28: SRA B
function sraB(cpu: Z80Cpu) {
  cpu.b = cpu.sra8(cpu.b);
}

// 0x29: SRA C
function sraC(cpu: Z80Cpu) {
  cpu.c = cpu.sra8(cpu.c);
}

// 0x2A: SRA D
function sraD(cpu: Z80Cpu) {
  cpu.d = cpu.sra8(cpu.d);
}

// 0x2B: SRA E
function sraE(cpu: Z80Cpu) {
  cpu.e = cpu.sra8(cpu.e);
}

// 0x2C: SRA H
function sraH(cpu: Z80Cpu) {
  cpu.h = cpu.sra8(cpu.h);
}

// 0x2D: SRA L
function sraL(cpu: Z80Cpu) {
  cpu.l = cpu.sra8(cpu.l);
}

// 0x2E: SLA (HL)
function sraHli(cpu: Z80Cpu) {
  const tmp = cpu.sra8(cpu.readMemory(cpu.hl));
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0x2F: SRA A
function sraA(cpu: Z80Cpu) {
  cpu.a = cpu.sra8(cpu.a);
}

// 0x30: SLL B
function sllB(cpu: Z80Cpu) {
  cpu.b = cpu.sll8(cpu.b);
}

// 0x31: SLL C
function sllC(cpu: Z80Cpu) {
  cpu.c = cpu.sll8(cpu.c);
}

// 0x32: SLL D
function sllD(cpu: Z80Cpu) {
  cpu.d = cpu.sll8(cpu.d);
}

// 0x33: SLL E
function sllE(cpu: Z80Cpu) {
  cpu.e = cpu.sll8(cpu.e);
}

// 0x34: SLL H
function sllH(cpu: Z80Cpu) {
  cpu.h = cpu.sll8(cpu.h);
}

// 0x35: SLL L
function sllL(cpu: Z80Cpu) {
  cpu.l = cpu.sll8(cpu.l);
}

// 0x36: SLL (HL)
function sllHli(cpu: Z80Cpu) {
  const tmp = cpu.sll8(cpu.readMemory(cpu.hl));
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0x37: SLL A
function sllA(cpu: Z80Cpu) {
  cpu.a = cpu.sll8(cpu.a);
}

// 0x38: SRL B
function srlB(cpu: Z80Cpu) {
  cpu.b = cpu.srl8(cpu.b);
}

// 0x39: SRL C
function srlC(cpu: Z80Cpu) {
  cpu.c = cpu.srl8(cpu.c);
}

// 0x3A: SRL D
function srlD(cpu: Z80Cpu) {
  cpu.d = cpu.srl8(cpu.d);
}

// 0x3B: SRL E
function srlE(cpu: Z80Cpu) {
  cpu.e = cpu.srl8(cpu.e);
}

// 0x3C: SRL H
function srlH(cpu: Z80Cpu) {
  cpu.h = cpu.srl8(cpu.h);
}

// 0x3D: SRL L
function srlL(cpu: Z80Cpu) {
  cpu.l = cpu.srl8(cpu.l);
}

// 0x3E: SRL (HL)
function srlHli(cpu: Z80Cpu) {
  const tmp = cpu.srl8(cpu.readMemory(cpu.hl));
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0x3F: SRL A
function srlA(cpu: Z80Cpu) {
  cpu.a = cpu.srl8(cpu.a);
}

// 0x40: BIT 0,B
function bit0B(cpu: Z80Cpu) {
  cpu.bit8(0, cpu.b);
}

// 0x41: BIT 0,C
function bit0C(cpu: Z80Cpu) {
  cpu.bit8(0, cpu.c);
}

// 0x42: BIT 0,D
function bit0D(cpu: Z80Cpu) {
  cpu.bit8(0, cpu.d);
}

// 0x43: BIT 0,E
function bit0E(cpu: Z80Cpu) {
  cpu.bit8(0, cpu.e);
}

// 0x44: BIT 0,H
function bit0H(cpu: Z80Cpu) {
  cpu.bit8(0, cpu.h);
}

// 0x45: BIT 0,L
function bit0L(cpu: Z80Cpu) {
  cpu.bit8(0, cpu.l);
}

// 0x46: BIT 0,(HL)
function bit0Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl);
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.bit8W(0, tmp);
}

// 0x47: BIT 0,A
function bit0A(cpu: Z80Cpu) {
  cpu.bit8(0, cpu.a);
}

// 0x48: BIT 1,B
function bit1B(cpu: Z80Cpu) {
  cpu.bit8(1, cpu.b);
}

// 0x49: BIT 1,C
function bit1C(cpu: Z80Cpu) {
  cpu.bit8(1, cpu.c);
}

// 0x4A: BIT 1,D
function bit1D(cpu: Z80Cpu) {
  cpu.bit8(1, cpu.d);
}

// 0x4B: BIT 1,E
function bit1E(cpu: Z80Cpu) {
  cpu.bit8(1, cpu.e);
}

// 0x4C: BIT 1,H
function bit1H(cpu: Z80Cpu) {
  cpu.bit8(1, cpu.h);
}

// 0x4D: BIT 1,L
function bit1L(cpu: Z80Cpu) {
  cpu.bit8(1, cpu.l);
}

// 0x4E: BIT 1,(HL)
function bit1Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl);
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.bit8W(1, tmp);
}

// 0x4F: BIT 1,A
function bit1A(cpu: Z80Cpu) {
  cpu.bit8(1, cpu.a);
}

// 0x50: BIT 2,B
function bit2B(cpu: Z80Cpu) {
  cpu.bit8(2, cpu.b);
}

// 0x51: BIT 2,C
function bit2C(cpu: Z80Cpu) {
  cpu.bit8(2, cpu.c);
}

// 0x52: BIT 2,D
function bit2D(cpu: Z80Cpu) {
  cpu.bit8(2, cpu.d);
}

// 0x53: BIT 2,E
function bit2E(cpu: Z80Cpu) {
  cpu.bit8(2, cpu.e);
}

// 0x54: BIT 2,H
function bit2H(cpu: Z80Cpu) {
  cpu.bit8(2, cpu.h);
}

// 0x55: BIT 2,L
function bit2L(cpu: Z80Cpu) {
  cpu.bit8(2, cpu.l);
}

// 0x56: BIT 2,(HL)
function bit2Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl);
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.bit8W(2, tmp);
}

// 0x57: BIT 2,A
function bit2A(cpu: Z80Cpu) {
  cpu.bit8(2, cpu.a);
}

// 0x58: BIT 3,B
function bit3B(cpu: Z80Cpu) {
  cpu.bit8(3, cpu.b);
}

// 0x59: BIT 3,C
function bit3C(cpu: Z80Cpu) {
  cpu.bit8(3, cpu.c);
}

// 0x5A: BIT 3,D
function bit3D(cpu: Z80Cpu) {
  cpu.bit8(3, cpu.d);
}

// 0x5B: BIT 3,E
function bit3E(cpu: Z80Cpu) {
  cpu.bit8(3, cpu.e);
}

// 0x5C: BIT 3,H
function bit3H(cpu: Z80Cpu) {
  cpu.bit8(3, cpu.h);
}

// 0x5D: BIT 3,L
function bit3L(cpu: Z80Cpu) {
  cpu.bit8(3, cpu.l);
}

// 0x5E: BIT 3,(HL)
function bit3Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl);
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.bit8W(3, tmp);
}

// 0x5F: BIT 3,A
function bit3A(cpu: Z80Cpu) {
  cpu.bit8(3, cpu.a);
}

// 0x60: BIT 4,B
function bit4B(cpu: Z80Cpu) {
  cpu.bit8(4, cpu.b);
}

// 0x61: BIT 4,C
function bit4C(cpu: Z80Cpu) {
  cpu.bit8(4, cpu.c);
}

// 0x62: BIT 4,D
function bit4D(cpu: Z80Cpu) {
  cpu.bit8(4, cpu.d);
}

// 0x63: BIT 4,E
function bit4E(cpu: Z80Cpu) {
  cpu.bit8(4, cpu.e);
}

// 0x64: BIT 4,H
function bit4H(cpu: Z80Cpu) {
  cpu.bit8(4, cpu.h);
}

// 0x65: BIT 4,L
function bit4L(cpu: Z80Cpu) {
  cpu.bit8(4, cpu.l);
}

// 0x66: BIT 4,(HL)
function bit4Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl);
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.bit8W(4, tmp);
}

// 0x67: BIT 4,A
function bit4A(cpu: Z80Cpu) {
  cpu.bit8(4, cpu.a);
}

// 0x68: BIT 5,B
function bit5B(cpu: Z80Cpu) {
  cpu.bit8(5, cpu.b);
}

// 0x69: BIT 5,C
function bit5C(cpu: Z80Cpu) {
  cpu.bit8(5, cpu.c);
}

// 0x6A: BIT 5,D
function bit5D(cpu: Z80Cpu) {
  cpu.bit8(5, cpu.d);
}

// 0x6B: BIT 5,E
function bit5E(cpu: Z80Cpu) {
  cpu.bit8(5, cpu.e);
}

// 0x6C: BIT 5,H
function bit5H(cpu: Z80Cpu) {
  cpu.bit8(5, cpu.h);
}

// 0x6D: BIT 5,L
function bit5L(cpu: Z80Cpu) {
  cpu.bit8(5, cpu.l);
}

// 0x6E: BIT 5,(HL)
function bit5Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl);
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.bit8W(5, tmp);
}

// 0x6F: BIT 5,A
function bit5A(cpu: Z80Cpu) {
  cpu.bit8(5, cpu.a);
}

// 0x70: BIT 6,B
function bit6B(cpu: Z80Cpu) {
  cpu.bit8(6, cpu.b);
}

// 0x71: BIT 6,C
function bit6C(cpu: Z80Cpu) {
  cpu.bit8(6, cpu.c);
}

// 0x72: BIT 6,D
function bit6D(cpu: Z80Cpu) {
  cpu.bit8(6, cpu.d);
}

// 0x73: BIT 6,E
function bit6E(cpu: Z80Cpu) {
  cpu.bit8(6, cpu.e);
}

// 0x74: BIT 6,H
function bit6H(cpu: Z80Cpu) {
  cpu.bit8(6, cpu.h);
}

// 0x75: BIT 6,L
function bit6L(cpu: Z80Cpu) {
  cpu.bit8(6, cpu.l);
}

// 0x76: BIT 6,(HL)
function bit6Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl);
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.bit8W(6, tmp);
}

// 0x77: BIT 6,A
function bit6A(cpu: Z80Cpu) {
  cpu.bit8(6, cpu.a);
}

// 0x78: BIT 7,B
function bit7B(cpu: Z80Cpu) {
  cpu.bit8(7, cpu.b);
}

// 0x79: BIT 7,C
function bit7C(cpu: Z80Cpu) {
  cpu.bit8(7, cpu.c);
}

// 0x7A: BIT 7,D
function bit7D(cpu: Z80Cpu) {
  cpu.bit8(7, cpu.d);
}

// 0x7B: BIT 7,E
function bit7E(cpu: Z80Cpu) {
  cpu.bit8(7, cpu.e);
}

// 0x7C: BIT 7,H
function bit7H(cpu: Z80Cpu) {
  cpu.bit8(7, cpu.h);
}

// 0x7D: BIT 7,L
function bit7L(cpu: Z80Cpu) {
  cpu.bit8(7, cpu.l);
}

// 0x7E: BIT 7,(HL)
function bit7Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl);
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.bit8W(7, tmp);
}

// 0x7F: BIT 7,A
function bit7A(cpu: Z80Cpu) {
  cpu.bit8(7, cpu.a);
}

// 0x80: RES 0,B
function res0B(cpu: Z80Cpu) {
  cpu.b &= 0xfe;
}

// 0x81: RES 0,C
function res0C(cpu: Z80Cpu) {
  cpu.c &= 0xfe;
}

// 0x82: RES 0,D
function res0D(cpu: Z80Cpu) {
  cpu.d &= 0xfe;
}

// 0x83: RES 0,E
function res0E(cpu: Z80Cpu) {
  cpu.e &= 0xfe;
}

// 0x84: RES 0,H
function res0H(cpu: Z80Cpu) {
  cpu.h &= 0xfe;
}

// 0x85: RES 0,L
function res0L(cpu: Z80Cpu) {
  cpu.l &= 0xfe;
}

// 0x86: RES 0,(HL)
function res0Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl) & 0xfe;
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0x87: RES 0,A
function res0A(cpu: Z80Cpu) {
  cpu.a &= 0xfe;
}

// 0x88: RES 1,B
function res1B(cpu: Z80Cpu) {
  cpu.b &= 0xfd;
}

// 0x89: RES 1,C
function res1C(cpu: Z80Cpu) {
  cpu.c &= 0xfd;
}

// 0x8A: RES 1,D
function res1D(cpu: Z80Cpu) {
  cpu.d &= 0xfd;
}

// 0x8B: RES 1,E
function res1E(cpu: Z80Cpu) {
  cpu.e &= 0xfd;
}

// 0x8C: RES 1,H
function res1H(cpu: Z80Cpu) {
  cpu.h &= 0xfd;
}

// 0x8D: RES 1,L
function res1L(cpu: Z80Cpu) {
  cpu.l &= 0xfd;
}

// 0x8E: RES 1,(HL)
function res1Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl) & 0xfd;
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0x8F: RES 1,A
function res1A(cpu: Z80Cpu) {
  cpu.a &= 0xfd;
}

// 0x90: RES 2,B
function res2B(cpu: Z80Cpu) {
  cpu.b &= 0xfb;
}

// 0x91: RES 2,C
function res2C(cpu: Z80Cpu) {
  cpu.c &= 0xfb;
}

// 0x92: RES 2,D
function res2D(cpu: Z80Cpu) {
  cpu.d &= 0xfb;
}

// 0x93: RES 2,E
function res2E(cpu: Z80Cpu) {
  cpu.e &= 0xfb;
}

// 0x94: RES 2,H
function res2H(cpu: Z80Cpu) {
  cpu.h &= 0xfb;
}

// 0x95: RES 2,L
function res2L(cpu: Z80Cpu) {
  cpu.l &= 0xfb;
}

// 0x96: RES 2,(HL)
function res2Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl) & 0xfb;
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0x97: RES 2,A
function res2A(cpu: Z80Cpu) {
  cpu.a &= 0xfb;
}

// 0x98: RES 3,B
function res3B(cpu: Z80Cpu) {
  cpu.b &= 0xf7;
}

// 0x99: RES 3,C
function res3C(cpu: Z80Cpu) {
  cpu.c &= 0xf7;
}

// 0x9A: RES 3,D
function res3D(cpu: Z80Cpu) {
  cpu.d &= 0xf7;
}

// 0x9B: RES 3,E
function res3E(cpu: Z80Cpu) {
  cpu.e &= 0xf7;
}

// 0x9C: RES 3,H
function res3H(cpu: Z80Cpu) {
  cpu.h &= 0xf7;
}

// 0x9D: RES 3,L
function res3L(cpu: Z80Cpu) {
  cpu.l &= 0xf7;
}

// 0x9E: RES 3,(HL)
function res3Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl) & 0xf7;
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0x9F: RES 3,A
function res3A(cpu: Z80Cpu) {
  cpu.a &= 0xf7;
}

// 0xA0: RES 4,B
function res4B(cpu: Z80Cpu) {
  cpu.b &= 0xef;
}

// 0xA1: RES 4,C
function res4C(cpu: Z80Cpu) {
  cpu.c &= 0xef;
}

// 0xA2: RES 4,D
function res4D(cpu: Z80Cpu) {
  cpu.d &= 0xef;
}

// 0xA3: RES 4,E
function res4E(cpu: Z80Cpu) {
  cpu.e &= 0xef;
}

// 0xA4: RES 4,H
function res4H(cpu: Z80Cpu) {
  cpu.h &= 0xef;
}

// 0xA5: RES 4,L
function res4L(cpu: Z80Cpu) {
  cpu.l &= 0xef;
}

// 0xA6: RES 4,(HL)
function res4Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl) & 0xef;
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0xA7: RES 4,A
function res4A(cpu: Z80Cpu) {
  cpu.a &= 0xef;
}

// 0xA8: RES 5,B
function res5B(cpu: Z80Cpu) {
  cpu.b &= 0xdf;
}

// 0xA9: RES 5,C
function res5C(cpu: Z80Cpu) {
  cpu.c &= 0xdf;
}

// 0xAA: RES 5,D
function res5D(cpu: Z80Cpu) {
  cpu.d &= 0xdf;
}

// 0xAB: RES 5,E
function res5E(cpu: Z80Cpu) {
  cpu.e &= 0xdf;
}

// 0xAC: RES 5,H
function res5H(cpu: Z80Cpu) {
  cpu.h &= 0xdf;
}

// 0xAD: RES 5,L
function res5L(cpu: Z80Cpu) {
  cpu.l &= 0xdf;
}

// 0xAE: RES 5,(HL)
function res5Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl) & 0xdf;
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0xAF: RES 5,A
function res5A(cpu: Z80Cpu) {
  cpu.a &= 0xdf;
}

// 0xB0: RES 6,B
function res6B(cpu: Z80Cpu) {
  cpu.b &= 0xbf;
}

// 0xB1: RES 6,C
function res6C(cpu: Z80Cpu) {
  cpu.c &= 0xbf;
}

// 0xB2: RES 6,D
function res6D(cpu: Z80Cpu) {
  cpu.d &= 0xbf;
}

// 0xB3: RES 6,E
function res6E(cpu: Z80Cpu) {
  cpu.e &= 0xbf;
}

// 0xB4: RES 6,H
function res6H(cpu: Z80Cpu) {
  cpu.h &= 0xbf;
}

// 0xB5: RES 6,L
function res6L(cpu: Z80Cpu) {
  cpu.l &= 0xbf;
}

// 0xB6: RES 6,(HL)
function res6Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl) & 0xbf;
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0xB7: RES 6,A
function res6A(cpu: Z80Cpu) {
  cpu.a &= 0xbf;
}

// 0xB8: RES 7,B
function res7B(cpu: Z80Cpu) {
  cpu.b &= 0x7f;
}

// 0xB9: RES 7,C
function res7C(cpu: Z80Cpu) {
  cpu.c &= 0x7f;
}

// 0xBA: RES 7,D
function res7D(cpu: Z80Cpu) {
  cpu.d &= 0x7f;
}

// 0xBB: RES 7,E
function res7E(cpu: Z80Cpu) {
  cpu.e &= 0x7f;
}

// 0xBC: RES 7,H
function res7H(cpu: Z80Cpu) {
  cpu.h &= 0x7f;
}

// 0xBD: RES 7,L
function res7L(cpu: Z80Cpu) {
  cpu.l &= 0x7f;
}

// 0xBE: RES 7,(HL)
function res7Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl) & 0x7f;
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0xBF: RES 7,A
function res7A(cpu: Z80Cpu) {
  cpu.a &= 0x7f;
}

// 0xC0: SET 0,B
function set0B(cpu: Z80Cpu) {
  cpu.b |= 0x1;
}

// 0xC1: SET 0,C
function set0C(cpu: Z80Cpu) {
  cpu.c |= 0x1;
}

// 0xC2: SET 0,D
function set0D(cpu: Z80Cpu) {
  cpu.d |= 0x1;
}

// 0xC3: SET 0,E
function set0E(cpu: Z80Cpu) {
  cpu.e |= 0x1;
}

// 0xC4: SET 0,H
function set0H(cpu: Z80Cpu) {
  cpu.h |= 0x1;
}

// 0xC5: SET 0,L
function set0L(cpu: Z80Cpu) {
  cpu.l |= 0x1;
}

// 0xC6: SET 0,(HL)
function set0Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl) | 0x1;
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0xC7: SET 0,A
function set0A(cpu: Z80Cpu) {
  cpu.a |= 0x1;
}

// 0xC8: SET 1,B
function set1B(cpu: Z80Cpu) {
  cpu.b |= 0x2;
}

// 0xC9: SET 1,C
function set1C(cpu: Z80Cpu) {
  cpu.c |= 0x2;
}

// 0xCA: SET 1,D
function set1D(cpu: Z80Cpu) {
  cpu.d |= 0x2;
}

// 0xCB: SET 1,E
function set1E(cpu: Z80Cpu) {
  cpu.e |= 0x2;
}

// 0xCC: SET 1,H
function set1H(cpu: Z80Cpu) {
  cpu.h |= 0x2;
}

// 0xCD: SET 1,L
function set1L(cpu: Z80Cpu) {
  cpu.l |= 0x2;
}

// 0xCE: SET 1,(HL)
function set1Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl) | 0x2;
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0xCF: SET 1,A
function set1A(cpu: Z80Cpu) {
  cpu.a |= 0x2;
}

// 0xD0: SET 2,B
function set2B(cpu: Z80Cpu) {
  cpu.b |= 0x4;
}

// 0xD1: SET 2,C
function set2C(cpu: Z80Cpu) {
  cpu.c |= 0x4;
}

// 0xD2: SET 2,D
function set2D(cpu: Z80Cpu) {
  cpu.d |= 0x4;
}

// 0xD3: SET 2,E
function set2E(cpu: Z80Cpu) {
  cpu.e |= 0x4;
}

// 0xD4: SET 2,H
function set2H(cpu: Z80Cpu) {
  cpu.h |= 0x4;
}

// 0xD5: SET 2,L
function set2L(cpu: Z80Cpu) {
  cpu.l |= 0x4;
}

// 0xD6: SET 2,(HL)
function set2Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl) | 0x4;
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0xD7: SET 2,A
function set2A(cpu: Z80Cpu) {
  cpu.a |= 0x4;
}

// 0xD8: SET 3,B
function set3B(cpu: Z80Cpu) {
  cpu.b |= 0x8;
}

// 0xD9: SET 3,C
function set3C(cpu: Z80Cpu) {
  cpu.c |= 0x8;
}

// 0xDA: SET 3,D
function set3D(cpu: Z80Cpu) {
  cpu.d |= 0x8;
}

// 0xDB: SET 3,E
function set3E(cpu: Z80Cpu) {
  cpu.e |= 0x8;
}

// 0xDC: SET 3,H
function set3H(cpu: Z80Cpu) {
  cpu.h |= 0x8;
}

// 0xDD: SET 3,L
function set3L(cpu: Z80Cpu) {
  cpu.l |= 0x8;
}

// 0xDE: SET 3,(HL)
function set3Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl) | 0x8;
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0xDF: SET 3,A
function set3A(cpu: Z80Cpu) {
  cpu.a |= 0x8;
}

// 0xE0: SET 4,B
function set4B(cpu: Z80Cpu) {
  cpu.b |= 0x10;
}

// 0xE1: SET 4,C
function set4C(cpu: Z80Cpu) {
  cpu.c |= 0x10;
}

// 0xE2: SET 4,D
function set4D(cpu: Z80Cpu) {
  cpu.d |= 0x10;
}

// 0xE3: SET 4,E
function set4E(cpu: Z80Cpu) {
  cpu.e |= 0x10;
}

// 0xE4: SET 4,H
function set4H(cpu: Z80Cpu) {
  cpu.h |= 0x10;
}

// 0xE5: SET 4,L
function set4L(cpu: Z80Cpu) {
  cpu.l |= 0x10;
}

// 0xE6: SET 4,(HL)
function set4Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl) | 0x10;
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0xE7: SET 4,A
function set4A(cpu: Z80Cpu) {
  cpu.a |= 0x10;
}

// 0xE8: SET 5,B
function set5B(cpu: Z80Cpu) {
  cpu.b |= 0x20;
}

// 0xE9: SET 5,C
function set5C(cpu: Z80Cpu) {
  cpu.c |= 0x20;
}

// 0xEA: SET 5,D
function set5D(cpu: Z80Cpu) {
  cpu.d |= 0x20;
}

// 0xEB: SET 5,E
function set5E(cpu: Z80Cpu) {
  cpu.e |= 0x20;
}

// 0xEC: SET 5,H
function set5H(cpu: Z80Cpu) {
  cpu.h |= 0x20;
}

// 0xED: SET 5,L
function set5L(cpu: Z80Cpu) {
  cpu.l |= 0x20;
}

// 0xEE: SET 5,(HL)
function set5Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl) | 0x20;
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0xEF: SET 5,A
function set5A(cpu: Z80Cpu) {
  cpu.a |= 0x20;
}

// 0xF0: SET 6,B
function set6B(cpu: Z80Cpu) {
  cpu.b |= 0x40;
}

// 0xF1: SET 6,C
function set6C(cpu: Z80Cpu) {
  cpu.c |= 0x40;
}

// 0xF2: SET 6,D
function set6D(cpu: Z80Cpu) {
  cpu.d |= 0x40;
}

// 0xF3: SET 6,E
function set6E(cpu: Z80Cpu) {
  cpu.e |= 0x40;
}

// 0xF4: SET 6,H
function set6H(cpu: Z80Cpu) {
  cpu.h |= 0x40;
}

// 0xF5: SET 6,L
function set6L(cpu: Z80Cpu) {
  cpu.l |= 0x40;
}

// 0xF6: SET 6,(HL)
function set6Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl) | 0x40;
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0xF7: SET 6,A
function set6A(cpu: Z80Cpu) {
  cpu.a |= 0x40;
}

// 0xF8: SET 7,B
function set7B(cpu: Z80Cpu) {
  cpu.b |= 0x80;
}

// 0xF9: SET 7,C
function set7C(cpu: Z80Cpu) {
  cpu.c |= 0x80;
}

// 0xFA: SET 7,D
function set7D(cpu: Z80Cpu) {
  cpu.d |= 0x80;
}

// 0xFB: SET 7,E
function set7E(cpu: Z80Cpu) {
  cpu.e |= 0x80;
}

// 0xFC: SET 7,H
function set7H(cpu: Z80Cpu) {
  cpu.h |= 0x80;
}

// 0xFD: SET 7,L
function set7L(cpu: Z80Cpu) {
  cpu.l |= 0x80;
}

// 0xFE: SET 7,(HL)
function set7Hli(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl) | 0x80;
  cpu.tactPlus1WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, tmp);
}

// 0xFF: SET 7,A
function set7A(cpu: Z80Cpu) {
  cpu.a |= 0x80;
}

// --------------------------------------------------------------------------------------------------------------------
// Z80 indexed bit operations

// 0x00: RLC (IX+d),B
function xrlcB(cpu: Z80Cpu) {
  cpu.b = cpu.rlc8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0x01: RLC (IX+d),C
function xrlcC(cpu: Z80Cpu) {
  cpu.c = cpu.rlc8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0x02: RLC (IX+d),D
function xrlcD(cpu: Z80Cpu) {
  cpu.d = cpu.rlc8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0x03: RLC (IX+d),E
function xrlcE(cpu: Z80Cpu) {
  cpu.e = cpu.rlc8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0x04: RLC (IX+d),H
function xrlcH(cpu: Z80Cpu) {
  cpu.h = cpu.rlc8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0x05: RLC (IX+d),L
function xrlcL(cpu: Z80Cpu) {
  cpu.l = cpu.rlc8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0x06: RLC (IX+d)
function xrlc(cpu: Z80Cpu) {
  const tmp = cpu.rlc8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0x07: RLC (IX+d),A
function xrlcA(cpu: Z80Cpu) {
  cpu.a = cpu.rlc8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0x08: RRC (IX+d),B
function xrrcB(cpu: Z80Cpu) {
  cpu.b = cpu.rrc8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0x09: RRC (IX+d),C
function xrrcC(cpu: Z80Cpu) {
  cpu.c = cpu.rrc8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0x0A: RRC (IX+d),D
function xrrcD(cpu: Z80Cpu) {
  cpu.d = cpu.rrc8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0x0B: RRC (IX+d),E
function xrrcE(cpu: Z80Cpu) {
  cpu.e = cpu.rrc8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0x0C: RRC (IX+d),H
function xrrcH(cpu: Z80Cpu) {
  cpu.h = cpu.rrc8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0x0D: RRC (IX+d),L
function xrrcL(cpu: Z80Cpu) {
  cpu.l = cpu.rrc8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0x0E: RRC (IX+d)
function xrrc(cpu: Z80Cpu) {
  const tmp = cpu.rrc8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0x0F: RRC (IX+d),A
function xrrcA(cpu: Z80Cpu) {
  cpu.a = cpu.rrc8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0x10: RL (IX+d),B
function xrlB(cpu: Z80Cpu) {
  cpu.b = cpu.rl8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0x11: RL (IX+d),C
function xrlC(cpu: Z80Cpu) {
  cpu.c = cpu.rl8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0x12: RL (IX+d),D
function xrlD(cpu: Z80Cpu) {
  cpu.d = cpu.rl8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0x13: RL (IX+d),E
function xrlE(cpu: Z80Cpu) {
  cpu.e = cpu.rl8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0x14: RL (IX+d),H
function xrlH(cpu: Z80Cpu) {
  cpu.h = cpu.rl8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0x15: RL (IX+d),L
function xrlL(cpu: Z80Cpu) {
  cpu.l = cpu.rl8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0x16: RL (IX+d)
function xrl(cpu: Z80Cpu) {
  const tmp = cpu.rl8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0x17: RL (IX+d),A
function xrlA(cpu: Z80Cpu) {
  cpu.a = cpu.rl8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0x18: RR (IX+d),B
function xrrB(cpu: Z80Cpu) {
  cpu.b = cpu.rr8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0x19: RR (IX+d),C
function xrrC(cpu: Z80Cpu) {
  cpu.c = cpu.rr8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0x1A: RR (IX+d),D
function xrrD(cpu: Z80Cpu) {
  cpu.d = cpu.rr8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0x1B: RR (IX+d),E
function xrrE(cpu: Z80Cpu) {
  cpu.e = cpu.rr8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0x1C: RR (IX+d),H
function xrrH(cpu: Z80Cpu) {
  cpu.h = cpu.rr8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0x1D: RR (IX+d),L
function xrrL(cpu: Z80Cpu) {
  cpu.l = cpu.rr8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0x1E: RR (IX+d)
function xrr(cpu: Z80Cpu) {
  const tmp = cpu.rr8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0x1F: RR (IX+d),A
function xrrA(cpu: Z80Cpu) {
  cpu.a = cpu.rr8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0x20: SLA (IX+d),B
function xslaB(cpu: Z80Cpu) {
  cpu.b = cpu.sla8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0x21: SLA (IX+d),C
function xslaC(cpu: Z80Cpu) {
  cpu.c = cpu.sla8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0x22: SLA (IX+d),D
function xslaD(cpu: Z80Cpu) {
  cpu.d = cpu.sla8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0x23: SLA (IX+d),E
function xslaE(cpu: Z80Cpu) {
  cpu.e = cpu.sla8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0x24: SLA (IX+d),H
function xslaH(cpu: Z80Cpu) {
  cpu.h = cpu.sla8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0x25: SLA (IX+d),L
function xslaL(cpu: Z80Cpu) {
  cpu.l = cpu.sla8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0x26: SLA (IX+d)
function xsla(cpu: Z80Cpu) {
  const tmp = cpu.sla8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0x27: SLA (IX+d),A
function xslaA(cpu: Z80Cpu) {
  cpu.a = cpu.sla8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0x28: SRA (IX+d),B
function xsraB(cpu: Z80Cpu) {
  cpu.b = cpu.sra8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0x29: SRA (IX+d),C
function xsraC(cpu: Z80Cpu) {
  cpu.c = cpu.sra8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0x2A: SRA (IX+d),D
function xsraD(cpu: Z80Cpu) {
  cpu.d = cpu.sra8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0x2B: SRA (IX+d),E
function xsraE(cpu: Z80Cpu) {
  cpu.e = cpu.sra8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0x2C: SRA (IX+d),H
function xsraH(cpu: Z80Cpu) {
  cpu.h = cpu.sra8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0x2D: SRA (IX+d),L
function xsraL(cpu: Z80Cpu) {
  cpu.l = cpu.sra8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0x2E: SRA (IX+d)
function xsra(cpu: Z80Cpu) {
  const tmp = cpu.sra8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0x2F: SRA (IX+d),A
function xsraA(cpu: Z80Cpu) {
  cpu.a = cpu.sra8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0x30: SLL (IX+d),B
function xsllB(cpu: Z80Cpu) {
  cpu.b = cpu.sll8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0x31: SLL (IX+d),C
function xsllC(cpu: Z80Cpu) {
  cpu.c = cpu.sll8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0x32: SLL (IX+d),D
function xsllD(cpu: Z80Cpu) {
  cpu.d = cpu.sll8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0x33: SLL (IX+d),E
function xsllE(cpu: Z80Cpu) {
  cpu.e = cpu.sll8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0x34: SLL (IX+d),H
function xsllH(cpu: Z80Cpu) {
  cpu.h = cpu.sll8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0x35: SLL (IX+d),L
function xsllL(cpu: Z80Cpu) {
  cpu.l = cpu.sll8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0x36: SLL (IX+d)
function xsll(cpu: Z80Cpu) {
  const tmp = cpu.sll8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0x37: SLL (IX+d),A
function xsllA(cpu: Z80Cpu) {
  cpu.a = cpu.sll8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0x38: SRL (IX+d),B
function xsrlB(cpu: Z80Cpu) {
  cpu.b = cpu.srl8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0x39: SRL (IX+d),C
function xsrlC(cpu: Z80Cpu) {
  cpu.c = cpu.srl8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0x3A: SRL (IX+d),D
function xsrlD(cpu: Z80Cpu) {
  cpu.d = cpu.srl8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0x3B: SRL (IX+d),E
function xsrlE(cpu: Z80Cpu) {
  cpu.e = cpu.srl8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0x3C: SRL (IX+d),H
function xsrlH(cpu: Z80Cpu) {
  cpu.h = cpu.srl8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0x3D: SRL (IX+d),L
function xsrlL(cpu: Z80Cpu) {
  cpu.l = cpu.srl8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0x3E: SRL (IX+d)
function xsrl(cpu: Z80Cpu) {
  const tmp = cpu.srl8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0x3F: SRL (IX+d),A
function xsrlA(cpu: Z80Cpu) {
  cpu.a = cpu.srl8(cpu.readMemory(cpu.wz));
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0x40-47: BIT 0,(IX+d)
function xbit0(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz);
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.bit8W(0, tmp);
}

// 0x48-4f: BIT 1,(IX+d)
function xbit1(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz);
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.bit8W(1, tmp);
}

// 0x50-57: BIT 2,(IX+d)
function xbit2(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz);
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.bit8W(2, tmp);
}

// 0x58-5F: BIT 3,(IX+d)
function xbit3(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz);
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.bit8W(3, tmp);
}

// 0x60-67: BIT 4,(IX+d)
function xbit4(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz);
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.bit8W(4, tmp);
}

// 0x68-6F: BIT 5,(IX+d)
function xbit5(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz);
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.bit8W(5, tmp);
}

// 0x70-77: BIT 6,(IX+d)
function xbit6(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz);
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.bit8W(6, tmp);
}

// 0x78-7f: BIT 7,(IX+d)
function xbit7(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz);
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.bit8W(7, tmp);
}

// 0x80: RES 0,(IX+d),B
function xres0B(cpu: Z80Cpu) {
  cpu.b = cpu.readMemory(cpu.wz) & 0xfe;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0x81: RES 0,(IX+d),C
function xres0C(cpu: Z80Cpu) {
  cpu.c = cpu.readMemory(cpu.wz) & 0xfe;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0x82: RES 0,(IX+d),D
function xres0D(cpu: Z80Cpu) {
  cpu.d = cpu.readMemory(cpu.wz) & 0xfe;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0x83: RES 0,(IX+d),E
function xres0E(cpu: Z80Cpu) {
  cpu.e = cpu.readMemory(cpu.wz) & 0xfe;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0x84: RES 0,(IX+d),H
function xres0H(cpu: Z80Cpu) {
  cpu.h = cpu.readMemory(cpu.wz) & 0xfe;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0x85: RES 0,(IX+d),L
function xres0L(cpu: Z80Cpu) {
  cpu.l = cpu.readMemory(cpu.wz) & 0xfe;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0x86: RES 0,(IX+d)
function xres0(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz) & 0xfe;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0x87: RES 0,(IX+d),A
function xres0A(cpu: Z80Cpu) {
  cpu.a = cpu.readMemory(cpu.wz) & 0xfe;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0x88: RES 1,(IX+d),B
function xres1B(cpu: Z80Cpu) {
  cpu.b = cpu.readMemory(cpu.wz) & 0xfd;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0x89: RES 1,(IX+d),C
function xres1C(cpu: Z80Cpu) {
  cpu.c = cpu.readMemory(cpu.wz) & 0xfd;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0x8A: RES 1,(IX+d),D
function xres1D(cpu: Z80Cpu) {
  cpu.d = cpu.readMemory(cpu.wz) & 0xfd;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0x8B: RES 1,(IX+d),E
function xres1E(cpu: Z80Cpu) {
  cpu.e = cpu.readMemory(cpu.wz) & 0xfd;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0x8C: RES 1,(IX+d),H
function xres1H(cpu: Z80Cpu) {
  cpu.h = cpu.readMemory(cpu.wz) & 0xfd;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0x8D: RES 1,(IX+d),L
function xres1L(cpu: Z80Cpu) {
  cpu.l = cpu.readMemory(cpu.wz) & 0xfd;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0x8E: RES 1,(IX+d)
function xres1(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz) & 0xfd;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0x8F: RES 1,(IX+d),A
function xres1A(cpu: Z80Cpu) {
  cpu.a = cpu.readMemory(cpu.wz) & 0xfd;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0x90: RES 2,(IX+d),B
function xres2B(cpu: Z80Cpu) {
  cpu.b = cpu.readMemory(cpu.wz) & 0xfb;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0x91: RES 2,(IX+d),C
function xres2C(cpu: Z80Cpu) {
  cpu.c = cpu.readMemory(cpu.wz) & 0xfb;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0x92: RES 2,(IX+d),D
function xres2D(cpu: Z80Cpu) {
  cpu.d = cpu.readMemory(cpu.wz) & 0xfb;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0x93: RES 2,(IX+d),E
function xres2E(cpu: Z80Cpu) {
  cpu.e = cpu.readMemory(cpu.wz) & 0xfb;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0x94: RES 2,(IX+d),H
function xres2H(cpu: Z80Cpu) {
  cpu.h = cpu.readMemory(cpu.wz) & 0xfb;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0x95: RES 2,(IX+d),L
function xres2L(cpu: Z80Cpu) {
  cpu.l = cpu.readMemory(cpu.wz) & 0xfb;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0x96: RES 2,(IX+d)
function xres2(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz) & 0xfb;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0x97: RES 2,(IX+d),A
function xres2A(cpu: Z80Cpu) {
  cpu.a = cpu.readMemory(cpu.wz) & 0xfb;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0x98: RES 3,(IX+d),B
function xres3B(cpu: Z80Cpu) {
  cpu.b = cpu.readMemory(cpu.wz) & 0xf7;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0x99: RES 3,(IX+d),C
function xres3C(cpu: Z80Cpu) {
  cpu.c = cpu.readMemory(cpu.wz) & 0xf7;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0x9A: RES 3,(IX+d),D
function xres3D(cpu: Z80Cpu) {
  cpu.d = cpu.readMemory(cpu.wz) & 0xf7;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0x9B: RES 3,(IX+d),E
function xres3E(cpu: Z80Cpu) {
  cpu.e = cpu.readMemory(cpu.wz) & 0xf7;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0x9C: RES 3,(IX+d),H
function xres3H(cpu: Z80Cpu) {
  cpu.h = cpu.readMemory(cpu.wz) & 0xf7;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0x9D: RES 3,(IX+d),L
function xres3L(cpu: Z80Cpu) {
  cpu.l = cpu.readMemory(cpu.wz) & 0xf7;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0x9E: RES 3,(IX+d)
function xres3(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz) & 0xf7;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0x9F: RES 3,(IX+d),A
function xres3A(cpu: Z80Cpu) {
  cpu.a = cpu.readMemory(cpu.wz) & 0xf7;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0xA0: RES 4,(IX+d),B
function xres4B(cpu: Z80Cpu) {
  cpu.b = cpu.readMemory(cpu.wz) & 0xef;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0xA1: RES 4,(IX+d),C
function xres4C(cpu: Z80Cpu) {
  cpu.c = cpu.readMemory(cpu.wz) & 0xef;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0xA2: RES 4,(IX+d),D
function xres4D(cpu: Z80Cpu) {
  cpu.d = cpu.readMemory(cpu.wz) & 0xef;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0xA3: RES 4,(IX+d),E
function xres4E(cpu: Z80Cpu) {
  cpu.e = cpu.readMemory(cpu.wz) & 0xef;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0xA4: RES 4,(IX+d),H
function xres4H(cpu: Z80Cpu) {
  cpu.h = cpu.readMemory(cpu.wz) & 0xef;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0xA5: RES 4,(IX+d),L
function xres4L(cpu: Z80Cpu) {
  cpu.l = cpu.readMemory(cpu.wz) & 0xef;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0xA6: RES 4,(IX+d)
function xres4(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz) & 0xef;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0xA7: RES 4,(IX+d),A
function xres4A(cpu: Z80Cpu) {
  cpu.a = cpu.readMemory(cpu.wz) & 0xef;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0xA8: RES 5,(IX+d),B
function xres5B(cpu: Z80Cpu) {
  cpu.b = cpu.readMemory(cpu.wz) & 0xdf;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0xA9: RES 5,(IX+d),C
function xres5C(cpu: Z80Cpu) {
  cpu.c = cpu.readMemory(cpu.wz) & 0xdf;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0xAA: RES 5,(IX+d),D
function xres5D(cpu: Z80Cpu) {
  cpu.d = cpu.readMemory(cpu.wz) & 0xdf;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0xAB: RES 5,(IX+d),E
function xres5E(cpu: Z80Cpu) {
  cpu.e = cpu.readMemory(cpu.wz) & 0xdf;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0xAC: RES 5,(IX+d),H
function xres5H(cpu: Z80Cpu) {
  cpu.h = cpu.readMemory(cpu.wz) & 0xdf;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0xAD: RES 5,(IX+d),L
function xres5L(cpu: Z80Cpu) {
  cpu.l = cpu.readMemory(cpu.wz) & 0xdf;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0xAE: RES 5,(IX+d)
function xres5(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz) & 0xdf;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0xAF: RES 5,(IX+d),A
function xres5A(cpu: Z80Cpu) {
  cpu.a = cpu.readMemory(cpu.wz) & 0xdf;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0xB0: RES 6,(IX+d),B
function xres6B(cpu: Z80Cpu) {
  cpu.b = cpu.readMemory(cpu.wz) & 0xbf;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0xB1: RES 6,(IX+d),C
function xres6C(cpu: Z80Cpu) {
  cpu.c = cpu.readMemory(cpu.wz) & 0xbf;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0xB2: RES 6,(IX+d),D
function xres6D(cpu: Z80Cpu) {
  cpu.d = cpu.readMemory(cpu.wz) & 0xbf;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0xB3: RES 6,(IX+d),E
function xres6E(cpu: Z80Cpu) {
  cpu.e = cpu.readMemory(cpu.wz) & 0xbf;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0xB4: RES 6,(IX+d),H
function xres6H(cpu: Z80Cpu) {
  cpu.h = cpu.readMemory(cpu.wz) & 0xbf;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0xB5: RES 6,(IX+d),L
function xres6L(cpu: Z80Cpu) {
  cpu.l = cpu.readMemory(cpu.wz) & 0xbf;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0xB6: RES 6,(IX+d)
function xres6(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz) & 0xbf;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0xB7: RES 6,(IX+d),A
function xres6A(cpu: Z80Cpu) {
  cpu.a = cpu.readMemory(cpu.wz) & 0xbf;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0xB8: RES 7,(IX+d),B
function xres7B(cpu: Z80Cpu) {
  cpu.b = cpu.readMemory(cpu.wz) & 0x7f;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0xB9: RES 7,(IX+d),C
function xres7C(cpu: Z80Cpu) {
  cpu.c = cpu.readMemory(cpu.wz) & 0x7f;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0xBA: RES 7,(IX+d),D
function xres7D(cpu: Z80Cpu) {
  cpu.d = cpu.readMemory(cpu.wz) & 0x7f;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0xBB: RES 7,(IX+d),E
function xres7E(cpu: Z80Cpu) {
  cpu.e = cpu.readMemory(cpu.wz) & 0x7f;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0xBC: RES 7,(IX+d),H
function xres7H(cpu: Z80Cpu) {
  cpu.h = cpu.readMemory(cpu.wz) & 0x7f;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0xBD: RES 7,(IX+d),L
function xres7L(cpu: Z80Cpu) {
  cpu.l = cpu.readMemory(cpu.wz) & 0x7f;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0xBE: RES 7,(IX+d)
function xres7(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz) & 0x7f;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0xBF: RES 7,(IX+d),A
function xres7A(cpu: Z80Cpu) {
  cpu.a = cpu.readMemory(cpu.wz) & 0x7f;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0xC0: RES 0,(IX+d),B
function xset0B(cpu: Z80Cpu) {
  cpu.b = cpu.readMemory(cpu.wz) | 0x1;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0xC1: RES 0,(IX+d),C
function xset0C(cpu: Z80Cpu) {
  cpu.c = cpu.readMemory(cpu.wz) | 0x1;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0xC2: RES 0,(IX+d),D
function xset0D(cpu: Z80Cpu) {
  cpu.d = cpu.readMemory(cpu.wz) | 0x1;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0xC3: RES 0,(IX+d),E
function xset0E(cpu: Z80Cpu) {
  cpu.e = cpu.readMemory(cpu.wz) | 0x1;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0xC4: RES 0,(IX+d),H
function xset0H(cpu: Z80Cpu) {
  cpu.h = cpu.readMemory(cpu.wz) | 0x1;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0xC5: RES 0,(IX+d),L
function xset0L(cpu: Z80Cpu) {
  cpu.l = cpu.readMemory(cpu.wz) | 0x1;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0xC6: RES 0,(IX+d)
function xset0(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz) | 0x1;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0xC7: RES 0,(IX+d),A
function xset0A(cpu: Z80Cpu) {
  cpu.a = cpu.readMemory(cpu.wz) | 0x1;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0xC8: RES 1,(IX+d),B
function xset1B(cpu: Z80Cpu) {
  cpu.b = cpu.readMemory(cpu.wz) | 0x2;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0xC9: RES 1,(IX+d),C
function xset1C(cpu: Z80Cpu) {
  cpu.c = cpu.readMemory(cpu.wz) | 0x2;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0xCA: RES 1,(IX+d),D
function xset1D(cpu: Z80Cpu) {
  cpu.d = cpu.readMemory(cpu.wz) | 0x2;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0xCB: RES 1,(IX+d),E
function xset1E(cpu: Z80Cpu) {
  cpu.e = cpu.readMemory(cpu.wz) | 0x2;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0xCC: RES 1,(IX+d),H
function xset1H(cpu: Z80Cpu) {
  cpu.h = cpu.readMemory(cpu.wz) | 0x2;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0xCD: RES 1,(IX+d),L
function xset1L(cpu: Z80Cpu) {
  cpu.l = cpu.readMemory(cpu.wz) | 0x2;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0xCE: RES 1,(IX+d)
function xset1(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz) | 0x2;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0xCF: RES 1,(IX+d),A
function xset1A(cpu: Z80Cpu) {
  cpu.a = cpu.readMemory(cpu.wz) | 0x2;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0xD0: RES 2,(IX+d),B
function xset2B(cpu: Z80Cpu) {
  cpu.b = cpu.readMemory(cpu.wz) | 0x4;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0xD1: RES 2,(IX+d),C
function xset2C(cpu: Z80Cpu) {
  cpu.c = cpu.readMemory(cpu.wz) | 0x4;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0xD2: RES 2,(IX+d),D
function xset2D(cpu: Z80Cpu) {
  cpu.d = cpu.readMemory(cpu.wz) | 0x4;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0xD3: RES 2,(IX+d),E
function xset2E(cpu: Z80Cpu) {
  cpu.e = cpu.readMemory(cpu.wz) | 0x4;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0xD4: RES 2,(IX+d),H
function xset2H(cpu: Z80Cpu) {
  cpu.h = cpu.readMemory(cpu.wz) | 0x4;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0xD5: RES 2,(IX+d),L
function xset2L(cpu: Z80Cpu) {
  cpu.l = cpu.readMemory(cpu.wz) | 0x4;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0xD6: RES 2,(IX+d)
function xset2(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz) | 0x4;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0xD7: RES 2,(IX+d),A
function xset2A(cpu: Z80Cpu) {
  cpu.a = cpu.readMemory(cpu.wz) | 0x4;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0xD8: RES 3,(IX+d),B
function xset3B(cpu: Z80Cpu) {
  cpu.b = cpu.readMemory(cpu.wz) | 0x8;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0xD9: RES 3,(IX+d),C
function xset3C(cpu: Z80Cpu) {
  cpu.c = cpu.readMemory(cpu.wz) | 0x8;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0xDA: RES 3,(IX+d),D
function xset3D(cpu: Z80Cpu) {
  cpu.d = cpu.readMemory(cpu.wz) | 0x8;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0xDB: RES 3,(IX+d),E
function xset3E(cpu: Z80Cpu) {
  cpu.e = cpu.readMemory(cpu.wz) | 0x8;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0xDC: RES 3,(IX+d),H
function xset3H(cpu: Z80Cpu) {
  cpu.h = cpu.readMemory(cpu.wz) | 0x8;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0xDD: RES 3,(IX+d),L
function xset3L(cpu: Z80Cpu) {
  cpu.l = cpu.readMemory(cpu.wz) | 0x8;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0xDE: RES 3,(IX+d)
function xset3(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz) | 0x8;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0xDF: RES 3,(IX+d),A
function xset3A(cpu: Z80Cpu) {
  cpu.a = cpu.readMemory(cpu.wz) | 0x8;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0xE0: RES 4,(IX+d),B
function xset4B(cpu: Z80Cpu) {
  cpu.b = cpu.readMemory(cpu.wz) | 0x10;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0xE1: RES 4,(IX+d),C
function xset4C(cpu: Z80Cpu) {
  cpu.c = cpu.readMemory(cpu.wz) | 0x10;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0xE2: RES 4,(IX+d),D
function xset4D(cpu: Z80Cpu) {
  cpu.d = cpu.readMemory(cpu.wz) | 0x10;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0xE3: RES 4,(IX+d),E
function xset4E(cpu: Z80Cpu) {
  cpu.e = cpu.readMemory(cpu.wz) | 0x10;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0xE4: RES 4,(IX+d),H
function xset4H(cpu: Z80Cpu) {
  cpu.h = cpu.readMemory(cpu.wz) | 0x10;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0xE5: RES 4,(IX+d),L
function xset4L(cpu: Z80Cpu) {
  cpu.l = cpu.readMemory(cpu.wz) | 0x10;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0xE6: RES 4,(IX+d)
function xset4(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz) | 0x10;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0xE7: RES 4,(IX+d),A
function xset4A(cpu: Z80Cpu) {
  cpu.a = cpu.readMemory(cpu.wz) | 0x10;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0xE8: RES 5,(IX+d),B
function xset5B(cpu: Z80Cpu) {
  cpu.b = cpu.readMemory(cpu.wz) | 0x20;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0xE9: RES 5,(IX+d),C
function xset5C(cpu: Z80Cpu) {
  cpu.c = cpu.readMemory(cpu.wz) | 0x20;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0xEA: RES 5,(IX+d),D
function xset5D(cpu: Z80Cpu) {
  cpu.d = cpu.readMemory(cpu.wz) | 0x20;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0xEB: RES 5,(IX+d),E
function xset5E(cpu: Z80Cpu) {
  cpu.e = cpu.readMemory(cpu.wz) | 0x20;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0xEC: RES 5,(IX+d),H
function xset5H(cpu: Z80Cpu) {
  cpu.h = cpu.readMemory(cpu.wz) | 0x20;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0xED: RES 5,(IX+d),L
function xset5L(cpu: Z80Cpu) {
  cpu.l = cpu.readMemory(cpu.wz) | 0x20;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0xEE: RES 5,(IX+d)
function xset5(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz) | 0x20;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0xEF: RES 5,(IX+d),A
function xset5A(cpu: Z80Cpu) {
  cpu.a = cpu.readMemory(cpu.wz) | 0x20;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0xF0: RES 6,(IX+d),B
function xset6B(cpu: Z80Cpu) {
  cpu.b = cpu.readMemory(cpu.wz) | 0x40;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0xF1: RES 6,(IX+d),C
function xset6C(cpu: Z80Cpu) {
  cpu.c = cpu.readMemory(cpu.wz) | 0x40;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0xF2: RES 6,(IX+d),D
function xset6D(cpu: Z80Cpu) {
  cpu.d = cpu.readMemory(cpu.wz) | 0x40;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0xF3: RES 6,(IX+d),E
function xset6E(cpu: Z80Cpu) {
  cpu.e = cpu.readMemory(cpu.wz) | 0x40;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0xF4: RES 6,(IX+d),H
function xset6H(cpu: Z80Cpu) {
  cpu.h = cpu.readMemory(cpu.wz) | 0x40;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0xF5: RES 6,(IX+d),L
function xset6L(cpu: Z80Cpu) {
  cpu.l = cpu.readMemory(cpu.wz) | 0x40;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0xF6: RES 6,(IX+d)
function xset6(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz) | 0x40;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0xF7: RES 6,(IX+d),A
function xset6A(cpu: Z80Cpu) {
  cpu.a = cpu.readMemory(cpu.wz) | 0x40;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0xF8: RES 7,(IX+d),B
function xset7B(cpu: Z80Cpu) {
  cpu.b = cpu.readMemory(cpu.wz) | 0x80;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0xF9: RES 7,(IX+d),C
function xset7C(cpu: Z80Cpu) {
  cpu.c = cpu.readMemory(cpu.wz) | 0x80;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0xFA: RES 7,(IX+d),D
function xset7D(cpu: Z80Cpu) {
  cpu.d = cpu.readMemory(cpu.wz) | 0x80;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0xFB: RES 7,(IX+d),E
function xset7E(cpu: Z80Cpu) {
  cpu.e = cpu.readMemory(cpu.wz) | 0x80;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0xFC: RES 7,(IX+d),H
function xset7H(cpu: Z80Cpu) {
  cpu.h = cpu.readMemory(cpu.wz) | 0x80;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0xFD: RES 7,(IX+d),L
function xset7L(cpu: Z80Cpu) {
  cpu.l = cpu.readMemory(cpu.wz) | 0x80;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0xFE: RES 7,(IX+d)
function xset7(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.wz) | 0x80;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, tmp);
}

// 0xFF: RES 7,(IX+d),A
function xset7A(cpu: Z80Cpu) {
  cpu.a = cpu.readMemory(cpu.wz) | 0x80;
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// --------------------------------------------------------------------------------------------------------------------
// Z80 indexed operations

// 0x09: ADD IX,BC
function addXBc(cpu: Z80Cpu) {
  cpu.tactPlus7WithAddress(cpu.ir);
  cpu.indexReg = cpu.add16(cpu.indexReg, cpu.bc);
}

// 0x19: ADD IX,DE
function addXDe(cpu: Z80Cpu) {
  cpu.tactPlus7WithAddress(cpu.ir);
  cpu.indexReg = cpu.add16(cpu.indexReg, cpu.de);
}

// 0x21: LD IX,nn
function ldXNN(cpu: Z80Cpu) {
  cpu.indexL = cpu.fetchCodeByte();
  cpu.indexH = cpu.fetchCodeByte();
}

// 0x22: LD (nn),IX
function ldNNiX(cpu: Z80Cpu) {
  cpu.store16(cpu.indexL, cpu.indexH);
}

// 0x23: INC IX
function incX(cpu: Z80Cpu) {
  cpu.indexReg++;
  cpu.tactPlus2WithAddress(cpu.ir);
}

// 0x24: INC XH
function incXh(cpu: Z80Cpu) {
  cpu.f = incFlags[cpu.indexH++] | cpu.flagCValue;
}

// 0x25: DEC XH
function decXh(cpu: Z80Cpu) {
  cpu.f = decFlags[cpu.indexH--] | cpu.flagCValue;
}

// 0x26: LD XH,n
function ldXhN(cpu: Z80Cpu) {
  cpu.indexH = cpu.fetchCodeByte();
}

// 0x29: ADD IX,IX
function addXX(cpu: Z80Cpu) {
  cpu.tactPlus7WithAddress(cpu.ir);
  cpu.indexReg = cpu.add16(cpu.indexReg, cpu.indexReg);
}

// 0x2A: LD IX,(nn)
function ldXNNi(cpu: Z80Cpu) {
  let addr = (cpu.fetchCodeByte() + (cpu.fetchCodeByte() << 8)) & 0xffff;
  cpu.indexL = cpu.readMemory(addr);
  cpu.wz = addr = (addr + 1) & 0xffff;
  cpu.indexH = cpu.readMemory(addr);
}

// 0x2B: DEC IX
function decX(cpu: Z80Cpu) {
  cpu.indexReg--;
  cpu.tactPlus2WithAddress(cpu.ir);
}

// 0x2C: INC XL
function incXl(cpu: Z80Cpu) {
  cpu.f = incFlags[cpu.indexL++] | cpu.flagCValue;
}

// 0x2d: DEC XL
function decXl(cpu: Z80Cpu) {
  cpu.f = decFlags[cpu.indexL--] | cpu.flagCValue;
}

// 0x2e: LD XL,n
function ldXlN(cpu: Z80Cpu) {
  cpu.indexL = cpu.fetchCodeByte();
}

// 0x34: INC (IX+d)
function incXi(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  let tmp = cpu.readMemory(cpu.wz);
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.f = incFlags[tmp++] | cpu.flagCValue;
  cpu.writeMemory(cpu.wz, tmp);
}

// 0x35: DEC (IX+d)
function decXi(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  let tmp = cpu.readMemory(cpu.wz);
  cpu.tactPlus1WithAddress(cpu.wz);
  cpu.f = decFlags[tmp--] | cpu.flagCValue;
  cpu.writeMemory(cpu.wz, tmp);
}

// 0x36: LD (IX+d),n
function ldXiN(cpu: Z80Cpu) {
  const dist = cpu.fetchCodeByte();
  cpu.wz = cpu.indexReg + sbyte(dist);
  const value = cpu.fetchCodeByte();
  cpu.tactPlus2WithAddress(cpu.pc);
  cpu.writeMemory(cpu.wz, value);
}

// 0x39: ADD IX,SP
function addXSp(cpu: Z80Cpu) {
  cpu.tactPlus7WithAddress(cpu.ir);
  cpu.indexReg = cpu.add16(cpu.indexReg, cpu.sp);
}

// 0x44: LD B,XH
function ldBXh(cpu: Z80Cpu) {
  cpu.b = cpu.indexH;
}

// 0x45: LD B,XL
function ldBXl(cpu: Z80Cpu) {
  cpu.b = cpu.indexL;
}

// 0x46: LD B,(IX+d)
function ldBXi(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.b = cpu.readMemory(cpu.wz);
}

// 0x4C: LD C,XH
function ldCXh(cpu: Z80Cpu) {
  cpu.c = cpu.indexH;
}

// 0x4D: LD C,XL
function ldCXl(cpu: Z80Cpu) {
  cpu.c = cpu.indexL;
}

// 0x4E: LD C,(IX+d)
function ldCXi(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.c = cpu.readMemory(cpu.wz);
}
// 0x54: LD D,XH
function ldDXh(cpu: Z80Cpu) {
  cpu.d = cpu.indexH;
}

// 0x55: LD D,XL
function ldDXl(cpu: Z80Cpu) {
  cpu.d = cpu.indexL;
}

// 0x56: LD D,(IX+d)
function ldDXi(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.d = cpu.readMemory(cpu.wz);
}

// 0x5C: LD E,XH
function ldEXh(cpu: Z80Cpu) {
  cpu.e = cpu.indexH;
}

// 0x5D: LD E,XL
function ldEXl(cpu: Z80Cpu) {
  cpu.e = cpu.indexL;
}

// 0x5E: LD E,(IX+d)
function ldEXi(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.e = cpu.readMemory(cpu.wz);
}

// 0x60: LD XH,B
function ldXhB(cpu: Z80Cpu) {
  cpu.indexH = cpu.b;
}

// 0x61: LD XH,C
function ldXhC(cpu: Z80Cpu) {
  cpu.indexH = cpu.c;
}

// 0x62: LD XH,D
function ldXhD(cpu: Z80Cpu) {
  cpu.indexH = cpu.d;
}

// 0x63: LD XH,E
function ldXhE(cpu: Z80Cpu) {
  cpu.indexH = cpu.e;
}

// 0x65: LD XH,XL
function ldXhXl(cpu: Z80Cpu) {
  cpu.indexH = cpu.indexL;
}

// 0x66: LD H,(IX+d)
function ldHXi(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.h = cpu.readMemory(cpu.wz);
}

// 0x67: LD XH,A
function ldXhA(cpu: Z80Cpu) {
  cpu.indexH = cpu.a;
}

// 0x68: LD XL,B
function ldXlB(cpu: Z80Cpu) {
  cpu.indexL = cpu.b;
}

// 0x69: LD XL,C
function ldXlC(cpu: Z80Cpu) {
  cpu.indexL = cpu.c;
}

// 0x6A: LD XL,D
function ldXlD(cpu: Z80Cpu) {
  cpu.indexL = cpu.d;
}

// 0x6B: LD XL,E
function ldXlE(cpu: Z80Cpu) {
  cpu.indexL = cpu.e;
}

// 0x6C: LD XL,XH
function ldXlXh(cpu: Z80Cpu) {
  cpu.indexL = cpu.indexH;
}

// 0x6E: LD L,(IX+d)
function ldLXi(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.l = cpu.readMemory(cpu.wz);
}

// 0x6F: LD XL,A
function ldXlA(cpu: Z80Cpu) {
  cpu.indexL = cpu.a;
}

// 0x70: LD (IX+d),B
function ldXiB(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.writeMemory(cpu.wz, cpu.b);
}

// 0x71: LD (IX+d),C
function ldXiC(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.writeMemory(cpu.wz, cpu.c);
}

// 0x72: LD (IX+d),D
function ldXiD(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.writeMemory(cpu.wz, cpu.d);
}

// 0x73: LD (IX+d),E
function ldXiE(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.writeMemory(cpu.wz, cpu.e);
}

// 0x74: LD (IX+d),H
function ldXiH(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.writeMemory(cpu.wz, cpu.h);
}

// 0x75: LD (IX+d),L
function ldXiL(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.writeMemory(cpu.wz, cpu.l);
}

// 0x77: LD (IX+d),A
function ldXiA(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.writeMemory(cpu.wz, cpu.a);
}

// 0x7C: LD A,XH
function ldAXh(cpu: Z80Cpu) {
  cpu.a = cpu.indexH;
}

// 0x7D: LD A,XL
function ldAXl(cpu: Z80Cpu) {
  cpu.a = cpu.indexL;
}

// 0x7E: LD A,(IX+d)
function ldAXi(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.a = cpu.readMemory(cpu.wz);
}

// 0x84: ADD A,XH
function addAXh(cpu: Z80Cpu) {
  cpu.add8(cpu.indexH);
}

// 0x85: ADD A,XL
function addAXl(cpu: Z80Cpu) {
  cpu.add8(cpu.indexL);
}

// 0x86: ADD A,(IX+d)
function addAXi(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.add8(cpu.readMemory(cpu.wz));
}

// 0x8C: ADC A,XH
function adcAXh(cpu: Z80Cpu) {
  cpu.adc8(cpu.indexH);
}

// 0x8D: ADC A,XL
function adcAXl(cpu: Z80Cpu) {
  cpu.adc8(cpu.indexL);
}

// 0x8E: ADC A,(IX+d)
function adcAXi(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.adc8(cpu.readMemory(cpu.wz));
}

// 0x94: SUB A,XH
function subAXh(cpu: Z80Cpu) {
  cpu.sub8(cpu.indexH);
}

// 0x95: ADC A,XL
function subAXl(cpu: Z80Cpu) {
  cpu.sub8(cpu.indexL);
}

// 0x96: SUB A,(IX+d)
function subAXi(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.sub8(cpu.readMemory(cpu.wz));
}

// 0x9C: SBC A,XH
function sbcAXh(cpu: Z80Cpu) {
  cpu.sbc8(cpu.indexH);
}

// 0x9D: SBC A,XL
function sbcAXl(cpu: Z80Cpu) {
  cpu.sbc8(cpu.indexL);
}

// 0x9E: SBC A,(IX+d)
function sbcAXi(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.sbc8(cpu.readMemory(cpu.wz));
}

// 0xA4: AND A,XH
function andAXh(cpu: Z80Cpu) {
  cpu.and8(cpu.indexH);
}

// 0xA5: AND A,XL
function andAXl(cpu: Z80Cpu) {
  cpu.and8(cpu.indexL);
}

// 0xA6: AND A,(IX+d)
function andAXi(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.and8(cpu.readMemory(cpu.wz));
}

// 0xAC: XOR A,XH
function xorAXh(cpu: Z80Cpu) {
  cpu.xor8(cpu.indexH);
}

// 0xAD: XOR A,XL
function xorAXl(cpu: Z80Cpu) {
  cpu.xor8(cpu.indexL);
}

// 0xAE: XOR A,(IX+d)
function xorAXi(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.xor8(cpu.readMemory(cpu.wz));
}

// 0xB4: OR A,XH
function orAXh(cpu: Z80Cpu) {
  cpu.or8(cpu.indexH);
}

// 0xB5: OR A,XL
function orAXl(cpu: Z80Cpu) {
  cpu.or8(cpu.indexL);
}

// 0xB6: OR A,(IX+d)
function orAXi(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.or8(cpu.readMemory(cpu.wz));
}

// 0xBC: CP XH
function cpAXh(cpu: Z80Cpu) {
  cpu.cp8(cpu.indexH);
}

// 0xBD: CP XL
function cpAXl(cpu: Z80Cpu) {
  cpu.cp8(cpu.indexL);
}

// 0xBE: CP (IX+d)
function cpAXi(cpu: Z80Cpu) {
  const dist = cpu.readMemory(cpu.pc);
  cpu.tactPlus5WithAddress(cpu.pc);
  cpu.pc++;
  cpu.wz = cpu.indexReg + sbyte(dist);
  cpu.cp8(cpu.readMemory(cpu.wz));
}

// 0xE1: POP IX
function popX(cpu: Z80Cpu) {
  cpu.indexL = cpu.readMemory(cpu.sp);
  cpu.sp++;
  cpu.indexH = cpu.readMemory(cpu.sp);
  cpu.sp++;
}

// 0xe3: EX (SP),IX
function exSpiX(cpu: Z80Cpu) {
  const sp1 = cpu.sp + 1;
  const tempL = cpu.readMemory(cpu.sp);
  const tempH = cpu.readMemory(sp1);
  cpu.tactPlus1WithAddress(sp1);
  cpu.writeMemory(sp1, cpu.indexH);
  cpu.writeMemory(cpu.sp, cpu.indexL);
  cpu.tactPlus2WithAddress(cpu.sp);
  cpu.wl = tempL;
  cpu.wh = tempH;
  cpu.indexReg = cpu.wz;
}

// 0xe5: PUSH IX
function pushX(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  cpu.sp--;
  cpu.writeMemory(cpu.sp, cpu.indexH);
  cpu.sp--;
  cpu.writeMemory(cpu.sp, cpu.indexL);
}

// 0xe9: JP (IX)
function jpX(cpu: Z80Cpu) {
  cpu.pc = cpu.indexReg;
}

// 0xf9: LD SP,IX
function ldSpX(cpu: Z80Cpu) {
  cpu.tactPlus2WithAddress(cpu.ir);
  cpu.sp = cpu.indexReg;
}

// --------------------------------------------------------------------------------------------------------------------
// Z80 extended operations

// 0x40: IN B,(C)
function inBC(cpu: Z80Cpu) {
  cpu.wz = cpu.bc + 1;
  cpu.b = cpu.readPort(cpu.bc);
  cpu.f = cpu.flagCValue | sz53Table[cpu.b];
}

// 0x41: OUT (C),B
function outCB(cpu: Z80Cpu) {
  cpu.writePort(cpu.bc, cpu.b);
  cpu.wz = cpu.bc + 1;
}

// 0x42: SBC HL,BC
function sbcHlBc(cpu: Z80Cpu) {
  cpu.tactPlus7WithAddress(cpu.ir);
  cpu.sbc16(cpu.bc);
}

// 0x43: LD (nn),BC
function ldNniBc(cpu: Z80Cpu) {
  cpu.store16(cpu.c, cpu.b);
}

// 0x44: NEG
function neg(cpu: Z80Cpu) {
  var tmp = cpu.a;
  cpu.a = 0;
  cpu.sub8(tmp);
}

// 0x45: RETN
function retn(cpu: Z80Cpu) {
  cpu.iff1 = cpu.iff2;
  ret(cpu);
}

// 0x46: IM 0
function im0(cpu: Z80Cpu) {
  cpu.interruptMode = 0;
}

// 0x47: LD I,A
function ldIA(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  cpu.i = cpu.a;
}

// 0x48: IN C,(C)
function inCC(cpu: Z80Cpu) {
  cpu.wz = cpu.bc + 1;
  cpu.c = cpu.readPort(cpu.bc);
  cpu.f = cpu.flagCValue | sz53Table[cpu.c];
}

// 0x49: OUT (C),C
function outCC(cpu: Z80Cpu) {
  cpu.writePort(cpu.bc, cpu.c);
  cpu.wz = cpu.bc + 1;
}

// 0x4A: ADC HL,BC
function adcHlBc(cpu: Z80Cpu) {
  cpu.tactPlus7WithAddress(cpu.ir);
  cpu.adc16(cpu.bc);
}

// 0x4B: LD BC,(nn)
function ldBcNni(cpu: Z80Cpu) {
  let tmp = cpu.fetchCodeByte();
  tmp += cpu.fetchCodeByte() << 8;
  cpu.c = cpu.readMemory(tmp);
  tmp += 1;
  cpu.wz = tmp;
  cpu.b = cpu.readMemory(tmp);
}

// 0x4F: LD R,A
function ldRA(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  cpu.r = cpu.a;
}

// 0x50: IN D,(C)
function inDC(cpu: Z80Cpu) {
  cpu.wz = cpu.bc + 1;
  cpu.d = cpu.readPort(cpu.bc);
  cpu.f = cpu.flagCValue | sz53Table[cpu.d];
}

// 0x51: OUT (C),D
function outCD(cpu: Z80Cpu) {
  cpu.writePort(cpu.bc, cpu.d);
  cpu.wz = cpu.bc + 1;
}

// 0x52: SBC HL,DE
function sbcHlDe(cpu: Z80Cpu) {
  cpu.tactPlus7WithAddress(cpu.ir);
  cpu.sbc16(cpu.de);
}

// 0x53: LD (nn),DE
function ldNniDe(cpu: Z80Cpu) {
  cpu.store16(cpu.e, cpu.d);
}

// 0x56: IM 1
function im1(cpu: Z80Cpu) {
  cpu.interruptMode = 1;
}

// 0x57: LD A,I
function ldAI(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  cpu.a = cpu.i;
  cpu.f = cpu.flagCValue | sz53Table[cpu.a] | (cpu.iff2 ? FlagsSetMask.PV : 0);
}

// 0x58: IN E,(C)
function inEC(cpu: Z80Cpu) {
  cpu.wz = cpu.bc + 1;
  cpu.e = cpu.readPort(cpu.bc);
  cpu.f = cpu.flagCValue | sz53Table[cpu.e];
}

// 0x59: OUT (C),E
function outCE(cpu: Z80Cpu) {
  cpu.writePort(cpu.bc, cpu.e);
  cpu.wz = cpu.bc + 1;
}

// 0x5A: ADC HL,DE
function adcHlDe(cpu: Z80Cpu) {
  cpu.tactPlus7WithAddress(cpu.ir);
  cpu.adc16(cpu.de);
}

// 0x5B: LD DE,(nn)
function ldDeNni(cpu: Z80Cpu) {
  let tmp = cpu.fetchCodeByte();
  tmp += cpu.fetchCodeByte() << 8;
  cpu.e = cpu.readMemory(tmp);
  tmp += 1;
  cpu.wz = tmp;
  cpu.d = cpu.readMemory(tmp);
}

// 0x5E: IM 2
function im2(cpu: Z80Cpu) {
  cpu.interruptMode = 2;
}

// 0x5F: LD A,R
function ldAR(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  cpu.a = cpu.r;
  cpu.f = cpu.flagCValue | sz53Table[cpu.a] | (cpu.iff2 ? FlagsSetMask.PV : 0);
}

// 0x60: IN H,(C)
function inHC(cpu: Z80Cpu) {
  cpu.wz = cpu.bc + 1;
  cpu.h = cpu.readPort(cpu.bc);
  cpu.f = cpu.flagCValue | sz53Table[cpu.h];
}

// 0x61: OUT (C),H
function outCH(cpu: Z80Cpu) {
  cpu.writePort(cpu.bc, cpu.h);
  cpu.wz = cpu.bc + 1;
}

// 0x62: SBC HL,HL
function sbcHlHl(cpu: Z80Cpu) {
  cpu.tactPlus7WithAddress(cpu.ir);
  cpu.sbc16(cpu.hl);
}

// 0x63: LD (nn),HL
function ldNniHl(cpu: Z80Cpu) {
  cpu.store16(cpu.l, cpu.h);
}

// 0x67: RRD
function rrd(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl);
  cpu.tactPlus4WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, (cpu.a << 4) | (tmp >>> 4));
  cpu.a = (cpu.a & 0xf0) | (tmp & 0x0f);
  cpu.f = cpu.flagCValue | sz53pvTable[cpu.a];
  cpu.wz = cpu.hl + 1;
}

// 0x68: IN L,(C)
function inLC(cpu: Z80Cpu) {
  cpu.wz = cpu.bc + 1;
  cpu.l = cpu.readPort(cpu.bc);
  cpu.f = cpu.flagCValue | sz53Table[cpu.l];
}

// 0x69: OUT (C),L
function outCL(cpu: Z80Cpu) {
  cpu.writePort(cpu.bc, cpu.l);
  cpu.wz = cpu.bc + 1;
}

// 0x6A: ADC HL,HL
function adcHlHl(cpu: Z80Cpu) {
  cpu.tactPlus7WithAddress(cpu.ir);
  cpu.adc16(cpu.hl);
}

// 0x6B: LD HL,(nn)
function ldHlNni(cpu: Z80Cpu) {
  let tmp = cpu.fetchCodeByte();
  tmp += cpu.fetchCodeByte() << 8;
  cpu.l = cpu.readMemory(tmp);
  tmp += 1;
  cpu.wz = tmp;
  cpu.h = cpu.readMemory(tmp);
}

// 0x6F: RLD
function rld(cpu: Z80Cpu) {
  const tmp = cpu.readMemory(cpu.hl);
  cpu.tactPlus4WithAddress(cpu.hl);
  cpu.writeMemory(cpu.hl, (tmp << 4) | (cpu.a & 0x0f));
  cpu.a = (cpu.a & 0xf0) | (tmp >>> 4);
  cpu.f = cpu.flagCValue | sz53pvTable[cpu.a];
  cpu.wz = cpu.hl + 1;
}

// 0x70: IN (C)
function in0C(cpu: Z80Cpu) {
  cpu.wz = cpu.bc + 1;
  const tmp = cpu.readPort(cpu.bc);
  cpu.f = cpu.flagCValue | sz53Table[tmp];
}

// 0x71: OUT (C),0
function outC0(cpu: Z80Cpu) {
  cpu.writePort(cpu.bc, 0);
  cpu.wz = cpu.bc + 1;
}

// 0x72: SBC HL,SP
function sbcHlSp(cpu: Z80Cpu) {
  cpu.tactPlus7WithAddress(cpu.ir);
  cpu.sbc16(cpu.sp);
}

// 0x73: LD (nn),SP
function ldNniSp(cpu: Z80Cpu) {
  cpu.store16(cpu.sp & 0xff, cpu.sp >>> 8);
}

// 0x78: IN A,(C)
function inAC(cpu: Z80Cpu) {
  cpu.wz = cpu.bc + 1;
  cpu.a = cpu.readPort(cpu.bc);
  cpu.f = cpu.flagCValue | sz53Table[cpu.a];
}

// 0x79: OUT (C),A
function outCA(cpu: Z80Cpu) {
  cpu.writePort(cpu.bc, cpu.a);
  cpu.wz = cpu.bc + 1;
}

// 0x7A: ADC HL,SP
function adcHlSp(cpu: Z80Cpu) {
  cpu.tactPlus7WithAddress(cpu.ir);
  cpu.adc16(cpu.sp);
}

// 0x7B: LD SP,(nn)
function ldSpNni(cpu: Z80Cpu) {
  let tmp = cpu.fetchCodeByte();
  tmp += cpu.fetchCodeByte() << 8;
  const val = cpu.readMemory(tmp);
  tmp += 1;
  cpu.wz = tmp;
  cpu.sp = val + (cpu.readMemory(tmp) << 8);
}

// 0xA0: LDI
function ldi(cpu: Z80Cpu) {
  let tmp = cpu.readMemory(cpu.hl);
  cpu.bc--;
  cpu.writeMemory(cpu.de, tmp);
  cpu.tactPlus2WithAddress(cpu.de);
  cpu.de++;
  cpu.hl++;
  tmp += cpu.a;
  cpu.f =
    (cpu.f & (FlagsSetMask.C | FlagsSetMask.Z | FlagsSetMask.S)) |
    (cpu.bc !== 0 ? FlagsSetMask.PV : 0) |
    (tmp & FlagsSetMask.R3) |
    ((tmp & 0x02) !== 0 ? FlagsSetMask.R5 : 0);
}

// 0xA1: CPI
function cpi(cpu: Z80Cpu) {
  const value = cpu.readMemory(cpu.hl);
  let tmp = (cpu.a - value) & 0xff;
  const lookup = ((cpu.a & 0x08) >>> 3) | ((value & 0x08) >>> 2) | ((tmp & 0x08) >>> 1);
  cpu.tactPlus5WithAddress(cpu.hl);
  cpu.hl++;
  cpu.bc--;
  cpu.f =
    cpu.flagCValue |
    (cpu.bc !== 0 ? FlagsSetMask.PV | FlagsSetMask.N : FlagsSetMask.N) |
    halfCarrySubFlags[lookup] |
    (tmp !== 0 ? 0 : FlagsSetMask.Z) |
    (tmp & FlagsSetMask.S);
  if (cpu.isHFlagSet()) {
    tmp -= 1;
  }
  cpu.f |= (tmp & FlagsSetMask.R3) | ((tmp & 0x02) !== 0 ? FlagsSetMask.R5 : 0);
  cpu.wz++;
}

// 0xA2: INI
function ini(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  const tmp = cpu.readPort(cpu.bc);
  cpu.writeMemory(cpu.hl, tmp);
  cpu.wz = cpu.bc + 1;
  cpu.b--;
  cpu.hl++;
  const tmp2 = (tmp + cpu.c + 1) & 0xff;
  cpu.f =
    ((tmp & 0x80) !== 0 ? FlagsSetMask.N : 0) |
    (tmp2 < tmp ? FlagsSetMask.H | FlagsSetMask.C : 0) |
    (parityTable[(tmp2 & 0x07) ^ cpu.b] !== 0 ? FlagsSetMask.PV : 0) |
    sz53Table[cpu.b];
}

// 0xA3: OUTI
function outi(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  const tmp = cpu.readMemory(cpu.hl);
  cpu.b--;
  cpu.wz = cpu.bc + 1;
  cpu.writePort(cpu.bc, tmp);
  cpu.hl++;
  const tmp2 = (tmp + cpu.l) & 0xff;
  cpu.f =
    ((tmp & 0x80) !== 0 ? FlagsSetMask.N : 0) |
    (tmp2 < tmp ? FlagsSetMask.H | FlagsSetMask.C : 0) |
    (parityTable[(tmp2 & 0x07) ^ cpu.b] !== 0 ? FlagsSetMask.PV : 0) |
    sz53Table[cpu.b];
}

// 0xA8: LDD
function ldd(cpu: Z80Cpu) {
  let tmp = cpu.readMemory(cpu.hl);
  cpu.bc--;
  cpu.writeMemory(cpu.de, tmp);
  cpu.tactPlus2WithAddress(cpu.de);
  cpu.de--;
  cpu.hl--;
  tmp += cpu.a;
  cpu.f =
    (cpu.f & (FlagsSetMask.C | FlagsSetMask.Z | FlagsSetMask.S)) |
    (cpu.bc !== 0 ? FlagsSetMask.PV : 0) |
    (tmp & FlagsSetMask.R3) |
    ((tmp & 0x02) !== 0 ? FlagsSetMask.R5 : 0);
}

// 0xA9: CPD
function cpd(cpu: Z80Cpu) {
  const value = cpu.readMemory(cpu.hl);
  let tmp = (cpu.a - value) & 0xff;
  const lookup = ((cpu.a & 0x08) >>> 3) | ((value & 0x08) >>> 2) | ((tmp & 0x08) >>> 1);
  cpu.tactPlus5WithAddress(cpu.hl);
  cpu.hl--;
  cpu.bc--;
  cpu.f =
    cpu.flagCValue |
    (cpu.bc !== 0 ? FlagsSetMask.PV | FlagsSetMask.N : FlagsSetMask.N) |
    halfCarrySubFlags[lookup] |
    (tmp !== 0 ? 0 : FlagsSetMask.Z) |
    (tmp & FlagsSetMask.S);
  if (cpu.isHFlagSet()) {
    tmp -= 1;
  }
  cpu.f |= (tmp & FlagsSetMask.R3) | ((tmp & 0x02) !== 0 ? FlagsSetMask.R5 : 0);
  cpu.wz--;
}

// 0xAA: IND
function ind(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  const tmp = cpu.readPort(cpu.bc);
  cpu.writeMemory(cpu.hl, tmp);
  cpu.wz = cpu.bc - 1;
  cpu.b--;
  cpu.hl--;
  const tmp2 = (tmp + cpu.c - 1) & 0xff;
  cpu.f =
    ((tmp & 0x80) !== 0 ? FlagsSetMask.N : 0) |
    (tmp2 < tmp ? FlagsSetMask.H | FlagsSetMask.C : 0) |
    (parityTable![(tmp2 & 0x07) ^ cpu.b] != 0 ? FlagsSetMask.PV : 0) |
    sz53Table[cpu.b];
}

// 0xAB: OUTD
function outd(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  const tmp = cpu.readMemory(cpu.hl);
  cpu.b--;
  cpu.wz = cpu.bc - 1;
  cpu.writePort(cpu.bc, tmp);
  cpu.hl--;
  const tmp2 = (tmp + cpu.l) & 0xff;
  cpu.f =
    ((tmp & 0x80) !== 0 ? FlagsSetMask.N : 0) |
    (tmp2 < tmp ? FlagsSetMask.H | FlagsSetMask.C : 0) |
    (parityTable[(tmp2 & 0x07) ^ cpu.b] !== 0 ? FlagsSetMask.PV : 0) |
    sz53Table[cpu.b];
}

// 0xB0: LDIR
function ldir(cpu: Z80Cpu) {
  let tmp = cpu.readMemory(cpu.hl);
  cpu.writeMemory(cpu.de, tmp);
  cpu.tactPlus2WithAddress(cpu.de);
  cpu.bc--;
  tmp += cpu.a;
  cpu.f =
    (cpu.f & (FlagsSetMask.C | FlagsSetMask.Z | FlagsSetMask.S)) |
    (cpu.bc !== 0 ? FlagsSetMask.PV : 0) |
    (tmp & FlagsSetMask.R3) |
    ((tmp & 0x02) != 0 ? FlagsSetMask.R5 : 0);
  if (cpu.bc !== 0) {
    cpu.tactPlus5WithAddress(cpu.de);
    cpu.pc -= 2;
    cpu.wz = cpu.pc + 1;
  }
  cpu.hl++;
  cpu.de++;
}

// 0xB1: CPIR
function cpir(cpu: Z80Cpu) {
  const value = cpu.readMemory(cpu.hl);
  let tmp = (cpu.a - value) & 0xff;
  var lookup = ((cpu.a & 0x08) >>> 3) | ((value & 0x08) >>> 2) | ((tmp & 0x08) >>> 1);
  cpu.tactPlus5WithAddress(cpu.hl);
  cpu.bc--;
  cpu.f =
    cpu.flagCValue |
    (cpu.bc != 0 ? FlagsSetMask.PV | FlagsSetMask.N : FlagsSetMask.N) |
    halfCarrySubFlags[lookup] |
    (tmp !== 0 ? 0 : FlagsSetMask.Z) |
    (tmp & FlagsSetMask.S);
  if (cpu.isHFlagSet()) {
    tmp -= 1;
  }
  cpu.f |= (tmp & FlagsSetMask.R3) | ((tmp & 0x02) !== 0 ? FlagsSetMask.R5 : 0);
  if ((cpu.f & (FlagsSetMask.PV | FlagsSetMask.Z)) === FlagsSetMask.PV) {
    cpu.tactPlus5WithAddress(cpu.hl);
    cpu.pc -= 2;
    cpu.wz = cpu.pc + 1;
  } else {
    cpu.wz++;
  }
  cpu.hl++;
}

// 0xB2: INIR
function inir(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  const tmp = cpu.readPort(cpu.bc);
  cpu.writeMemory(cpu.hl, tmp);
  cpu.wz = cpu.bc + 1;
  cpu.b--;
  const tmp2 = (tmp + cpu.c + 1) & 0xff;
  cpu.f =
    ((tmp & 0x80) !== 0 ? FlagsSetMask.N : 0) |
    (tmp2 < tmp ? FlagsSetMask.H | FlagsSetMask.C : 0) |
    (parityTable[(tmp2 & 0x07) ^ cpu.b] !== 0 ? FlagsSetMask.PV : 0) |
    sz53Table[cpu.b];
  if (cpu.b !== 0) {
    cpu.tactPlus5WithAddress(cpu.hl);
    cpu.pc -= 2;
  }
  cpu.hl++;
}

// 0xB3: OTIR
function otir(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  const tmp = cpu.readMemory(cpu.hl);
  cpu.b--;
  cpu.wz = cpu.bc + 1;
  cpu.writePort(cpu.bc, tmp);
  cpu.hl++;
  const tmp2 = (tmp + cpu.l) & 0xff;
  cpu.f =
    ((tmp & 0x80) !== 0 ? FlagsSetMask.N : 0) |
    (tmp2 < tmp ? FlagsSetMask.H | FlagsSetMask.C : 0) |
    (parityTable[(tmp2 & 0x07) ^ cpu.b] !== 0 ? FlagsSetMask.PV : 0) |
    sz53Table[cpu.b];
  if (cpu.b === 0) return;
  cpu.tactPlus5WithAddress(cpu.hl);
  cpu.pc -= 2;
}

// 0xB8: LDDR
function lddr(cpu: Z80Cpu) {
  let tmp = cpu.readMemory(cpu.hl);
  cpu.writeMemory(cpu.de, tmp);
  cpu.tactPlus2WithAddress(cpu.de);
  cpu.bc--;
  tmp += cpu.a;
  cpu.f =
    (cpu.f & (FlagsSetMask.C | FlagsSetMask.Z | FlagsSetMask.S)) |
    (cpu.bc !== 0 ? FlagsSetMask.PV : 0) |
    (tmp & FlagsSetMask.R3) |
    ((tmp & 0x02) !== 0 ? FlagsSetMask.R5 : 0);
  if (cpu.bc !== 0) {
    cpu.tactPlus5WithAddress(cpu.de);
    cpu.pc -= 2;
    cpu.wz = cpu.pc + 1;
  }
  cpu.hl--;
  cpu.de--;
}

// 0xB9: CPDR
function cpdr(cpu: Z80Cpu) {
  const value = cpu.readMemory(cpu.hl);
  let tmp = (cpu.a - value) & 0xff;
  var lookup = ((cpu.a & 0x08) >>> 3) | ((value & 0x08) >>> 2) | ((tmp & 0x08) >>> 1);
  cpu.tactPlus5WithAddress(cpu.hl);
  cpu.bc--;
  cpu.f =
    cpu.flagCValue |
    (cpu.bc !== 0 ? FlagsSetMask.PV | FlagsSetMask.N : FlagsSetMask.N) |
    halfCarrySubFlags[lookup] |
    (tmp != 0 ? 0 : FlagsSetMask.Z) |
    (tmp & FlagsSetMask.S);
  if (cpu.isHFlagSet()) {
    tmp -= 1;
  }
  cpu.f |= (tmp & FlagsSetMask.R3) | ((tmp & 0x02) !== 0 ? FlagsSetMask.R5 : 0);
  if ((cpu.f & (FlagsSetMask.PV | FlagsSetMask.Z)) === FlagsSetMask.PV) {
    cpu.tactPlus5WithAddress(cpu.hl);
    cpu.pc -= 2;
    cpu.wz = cpu.pc + 1;
  } else {
    cpu.wz--;
  }
  cpu.hl--;
}

// 0xBA: INDR
function indr(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  const tmp = cpu.readPort(cpu.bc);
  cpu.writeMemory(cpu.hl, tmp);
  cpu.wz = cpu.bc - 1;
  cpu.b--;
  const tmp2 = (tmp + cpu.c - 1) & 0xff;
  cpu.f =
    ((tmp & 0x80) !== 0 ? FlagsSetMask.N : 0) |
    (tmp2 < tmp ? FlagsSetMask.H | FlagsSetMask.C : 0) |
    (parityTable[(tmp2 & 0x07) ^ cpu.b] !== 0 ? FlagsSetMask.PV : 0) |
    sz53Table[cpu.b];

  if (cpu.b !== 0) {
    cpu.tactPlus5WithAddress(cpu.hl);
    cpu.pc -= 2;
  }
  cpu.hl--;
}

// 0xBB: OTDR
function otdr(cpu: Z80Cpu) {
  cpu.tactPlus1WithAddress(cpu.ir);
  const tmp = cpu.readMemory(cpu.hl);
  cpu.b--;
  cpu.wz = cpu.bc - 1;
  cpu.writePort(cpu.bc, tmp);
  cpu.hl--;
  const tmp2 = (tmp + cpu.l) & 0xff;
  cpu.f =
    ((tmp & 0x80) !== 0 ? FlagsSetMask.N : 0) |
    (tmp2 < tmp ? FlagsSetMask.H | FlagsSetMask.C : 0) |
    (parityTable[(tmp2 & 0x07) ^ cpu.b] !== 0 ? FlagsSetMask.PV : 0) |
    sz53Table[cpu.b];
  if (cpu.b === 0) return;
  cpu.tactPlus5WithAddress(cpu.hl);
  cpu.pc -= 2;
}
