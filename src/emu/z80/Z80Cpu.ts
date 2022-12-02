import { FlagsSetMask, IZ80Cpu, OpCodePrefix } from "../abstractions/IZ80Cpu";

/**
 * This class implements the emulation of the Z80 CPU
 */
export class Z80Cpu implements IZ80Cpu {
    // --- Register variable
    private _a: number;
    private _f: number;
    private _b: number;
    private _c: number;
    private _d: number;
    private _e: number;
    private _h: number;
    private _l: number;
    private _af_: number;
    private _bc_: number;
    private _de_: number;
    private _hl_: number;
    private _xh: number;
    private _xl: number;
    private _yh: number;
    private _yl: number;
    private _i: number;
    private _r: number;
    private _pc: number;
    private _sp: number;
    private _wh: number;
    private _wl: number;

    // ----------------------------------------------------------------------------------------------------------------
    // Register access

    /**
     * The A register
     */
    get a(): number {
        return this._a;
    }
    set a(value: number) {
        this._a = value & 0xff;
    }
    
    /**
     * The F register
     */
    get f(): number {
        return this._f;
    }
    set f(value: number) {
        this._f = value & 0xff;
    }

    /**
     * The AF register pair
     */
    get af(): number {
        return (this._a << 8) | this._f;
    }
    set af(value: number) {
        this._a = (value & 0xff00) >>> 8
        this._f = value & 0xff;
    }

    /**
     * The B register
     */
    get b(): number {
        return this._b;
    }
    set b(value: number) {
        this._b = value & 0xff;
    }
    
    /**
     * The C register
     */
    get c(): number {
        return this._c;
    }
    set c(value: number) {
        this._c = value & 0xff;
    }

    /**
     * The BC register pair
     */
    get bc(): number {
        return (this._b << 8) | this._c;
    }
    set bc(value: number) {
        this._b = (value & 0xff00) >>> 8
        this._c = value & 0xff;
    }

    /**
     * The D register
     */
    get d(): number {
        return this._d;
    }
    set d(value: number) {
        this._d = value & 0xff;
    }
    
    /**
     * The E register
     */
    get e(): number {
        return this._e;
    }
    set e(value: number) {
        this._e = value & 0xff;
    }

    /**
     * The DE register pair
     */
    get de(): number {
        return (this._d << 8) | this._e;
    }
    set de(value: number) {
        this._d = (value & 0xff00) >>> 8
        this._e = value & 0xff;
    }

    /**
     * The H register
     */
    get h(): number {
        return this._h;
    }
    set h(value: number) {
        this._h = value & 0xff;
    }
    
    /**
     * The L register
     */
    get l(): number {
        return this._l;
    }
    set l(value: number) {
        this._l = value & 0xff;
    }

    /**
     * The HL register pair
     */
    get hl(): number {
        return (this._h << 8) | this._l;
    }
    set hl(value: number) {
        this._h = (value & 0xff00) >>> 8
        this._l = value & 0xff;
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
        return this._xh;
    }
    set xh(value: number) {
        this._xh = value & 0xff;
    }
    
    /**
     * The lower 8 bits of the IX register pair
     */
    get xl(): number {
        return this._xl;
    }
    set xl(value: number) {
        this._xl = value & 0xff;
    }

    /**
     * The IX register pair
     */
    get ix(): number {
        return (this._xh << 8) | this._xl;
    }
    set ix(value: number) {
        this._xh = (value & 0xff00) >>> 8
        this._xl = value & 0xff;
    }

    /**
     * The higher 8 bits of the IY register pair
     */
    get yh(): number {
        return this._yh;
    }
    set yh(value: number) {
        this._yh = value & 0xff;
    }
    
    /**
     * The lower 8 bits of the IY register pair
     */
    get yl(): number {
        return this._yl;
    }
    set yl(value: number) {
        this._yl = value & 0xff;
    }

    /**
     * The IY register pair
     */
    get iy(): number {
        return (this._yh << 8) | this._yl;
    }
    set iy(value: number) {
        this._yh = (value & 0xff00) >>> 8
        this._yl = value & 0xff;
    }

    /**
     * The I (interrupt vector) register
     */
    get i(): number {
        return this._i;
    }
    set i(value: number) {
        this._i = value & 0xff;
    }
    
    /**
     * The R (refresh) register
     */
    get r(): number {
        return this._r;
    }
    set r(value: number) {
        this._r = value & 0xff;
    }

    /**
     * The IR register pair
     */
    get ir(): number {
        return (this._i << 8) | this._r;
    }
    set ir(value: number) {
        this._i = (value & 0xff00) >>> 8
        this._r = value & 0xff;
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
        return this._wh;
    }
    set wh(value: number) {
        this._wh = value & 0xff;
    }
    
    /**
     * The lower 8 bits of the WZ register pair
     */
    get wl(): number {
        return this._wl;
    }
    set wl(value: number) {
        this._wl = value & 0xff;
    }

    /**
     * The WZ (MEMPTR) register pair
     */
    get wz(): number {
        return (this._wh << 8) | this._wl;
    }
    set wz(value: number) {
        this._wh = (value & 0xff00) >>> 8
        this._wl = value & 0xff;
    }

    /**
     * Get or set the value of the current index register
     */
    get indexReg(): number {
        return this.prefix == OpCodePrefix.DD || this.prefix == OpCodePrefix.DDCB ? this.ix : this.iy;
    }
    set (value: number) {
        if (this.prefix == OpCodePrefix.DD || this.prefix == OpCodePrefix.DDCB) {
            this.ix = value;
        } else {
            this.iy = value;
        }
    }

    /**
     * Get or set the LSB value of the current index register
     */
    get indexL(): number
    {
        return this.prefix == OpCodePrefix.DD || this.prefix == OpCodePrefix.DDCB ? this.xl : this.yl;
    }
    set indexL(value: number)
    {
        if (this.prefix == OpCodePrefix.DD || this.prefix == OpCodePrefix.DDCB) {
            this.xl = value;
        } else {
            this.yl = value;
        }
    }    

    /**
     * Get or set the MSB value of the current index register
     */
    get indexH(): number
    {
        return this.prefix == OpCodePrefix.DD || this.prefix == OpCodePrefix.DDCB ? this.xh : this.yh;
    }
    set indexH(value: number)
    {
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
        return this.f & FlagsSetMask.SZPV
    }
        
    /**
     * Set the R5 and R3 flags of F after SCF or CCF.
     */
    setR5R3ForScfAndCcf(): void {
        if (this.prevF53Updated) {
            this.f = (this.f & ~FlagsSetMask.R3R5) | (this.a & FlagsSetMask.R3R5);
        } else {
            this.a |= this.a & FlagsSetMask.R3R5;
        }
        this.f53Updated = true;
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
     * Get the number of T-states in a machine frame.
     */
    tactsInFrame: number;

    /**
     * Get the number of T-states in a display line (use -1, if this info is not available)
     */
    tactsInDisplayLine: number;

    /**
     * This flag indicates if bit 3 or 5 of Register F has been updated. We need to keep this value, as we utilize
     * it within the `SCF` and `CCF` instructions to calculate the new values of bit 3 and 5 of F.
     */
    f53Updated: boolean;

    /**
     * When calculating the value of bit 3 and 5 of Register F within the `SCF` and `CCF` instructions, we must know
     * whether the last executed instruction has updated these flags. This field stores this information.
     */
    prevF53Updated: boolean;

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
        this.interruptMode = 0;
        this.iff1 = false;
        this.iff2 = false;
        this.clockMultiplier = 1;
        this.f53Updated = false;
        this.prevF53Updated = false;

        this.opCode = 0;
        this.prefix = OpCodePrefix.None;
        this.eiBacklog = 0;
        this.retExecuted = false;
        this.totalContentionDelaySinceStart = 0;
        this.contentionDelaySincePause = 0;

        this.tacts = 0;
        this.frames = 0;
        this.frameTacts = 0;
        this.currentFrameTact = 0;
        this.tactsInFrame = 1_000_000;
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
        this.interruptMode = 0;
        this.iff1 = false;
        this.iff2 = false;
        this.clockMultiplier = 1;
        this.f53Updated = false;
        this.prevF53Updated = false;

        this.opCode = 0;
        this.prefix = OpCodePrefix.None;
        this.eiBacklog = 0;
        this.retExecuted = false;
        this.totalContentionDelaySinceStart = 0;
        this.contentionDelaySincePause = 0;

        this.tacts = 0;
        this.frames = 0;
        this.frameTacts = 0;
        this.currentFrameTact = 0;
        this.tactsInFrame = 1_000_000;
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
        if (opCode == 0xCD) return 3;

        // --- Call instruction with condition
        if ((opCode & 0xC7) == 0xC4) return 3;

        // --- Check for RST instructions
        if ((opCode & 0xC7) == 0xC7) return 1;

        // --- Check for HALT instruction
        if (opCode  == 0x76) return 1;

        // --- Check for extended instruction prefix
        if (opCode != 0xED) return 0;

        // --- Check for I/O and block transfer instructions
        opCode = this.doReadMemory(this.pc + 1);
        return ((opCode & 0xB4) == 0xB0) ? 2 : 0;
    }

    /**
     * Call this method to execute a CPU instruction cycle.
     */
    executeCpuCycle(): void {
        // --- Modify the EI interrupt backlog value
        if (this.eiBacklog > 0)
        {
            this.eiBacklog--;
        }

        // --- The CPU senses the RESET signal in any phase of the instruction execution
        if (this.sigRST)
        {
            // --- RESET is active. Process it and then inactivate the signal
            this.reset();
            this.sigRST = false;
        }
        // --- The CPU does not test the NMI signal while an instruction is being executed
        else if (this.sigNMI && this.prefix == OpCodePrefix.None)
        {
            // --- NMI is active. Process the non-maskable interrupt
            this.processNmi();
        }
        // --- The CPU does not test the INT signal while an instruction is being executed
        else if (this.sigINT && this.prefix == OpCodePrefix.None)
        {
            // --- NMI is active. Check, if the interrupt is enabled
            if (this.iff1 && this.eiBacklog == 0)
            {
                // --- Yes, INT is enabled, and the CPU has already executed the first instruction after EI.
                this.processInt();
            }
        }

        // --- Let's handle the halted state.
        if (this.halted)
        {
            // --- While in halted state, the CPU does not execute any instructions. It just refreshes the memory
            // --- page pointed by R and waits for four T-states.
            this.refreshMemory();
            this.tactPlus4();
            return;
        }

        // --- The CPU is about to execute the subsequent instruction. First, let's store the previous value of
        // --- F53Updated, as we will use this value in the SCF and CCF instructions.
        this.prevF53Updated = this.f53Updated;

        // --- Second, let's execute the M1 machine cycle that reads the next opcode from the memory.
        this.opCode = this.readMemory(this.pc);
        this.pc++;

        // --- Third, let's refresh the memory by updating the value of Register R. It takes one T-state.
        if (this.prefix != OpCodePrefix.DDCB && this.prefix != OpCodePrefix.FDCB)
        {
            // --- Indexed bit operation consider the third byte as an address offset, so no memory refresh occurs.
            this.refreshMemory();
            this.tactPlus1();
        }

        // --- It's time to execute the fetched instruction
        switch (this.prefix)
        {
            // --- Standard Z80 instructions
            case OpCodePrefix.None:
                switch (this.opCode)
                {
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
                // TODO:
                // _bitInstrs![OpCode].Invoke();
                this.prefix = OpCodePrefix.None;
                break;

            // --- Extended instructions
            case OpCodePrefix.ED:
                // TODO:
                // _extendedInstrs![OpCode].Invoke();
                this.prefix = OpCodePrefix.None;
                break;

            // --- IX- or IY-indexed instructions
            case OpCodePrefix.DD:
            case OpCodePrefix.FD:
                if (this.opCode == 0xdd)
                {
                    this.prefix = OpCodePrefix.DD;
                }
                else if (this.opCode == 0xfd)
                {
                    this.prefix = OpCodePrefix.FD;
                }
                else if (this.opCode == 0xcb)
                {
                    this.prefix = this.prefix == OpCodePrefix.DD
                        ? OpCodePrefix.DDCB
                        : OpCodePrefix.FDCB;
                }
                else
                {
                    // TODO:
                    // _indexedInstrs![OpCode].Invoke();
                    this.prefix = OpCodePrefix.None;
                }
                break;

            // --- IX- or IY-indexed bit instructions
            case OpCodePrefix.DDCB:
            case OpCodePrefix.FDCB:
                // --- OpCode is the distance
                this.wz = this.indexReg + (this.opCode >= 128 ? this.opCode - 256 : this.opCode);
                this.opCode = this.readMemory(this.pc);
                this.tactPlus2WithAddress(this.pc);
                this.pc++;
                // TODO:
                // _indexedBitInstrs![OpCode].Invoke();
                this.prefix = OpCodePrefix.None;
                break;
        }
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

        if (this.interruptMode == 2)
        {
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
        }
        else
        {
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
        this.pc = this.wz = this.pc + (e >= 128 ? e - 256 : e);
    }

    /**
     * The core of the CALL instruction 
     */
    callCore(): void {
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
        this.tactPlus1WithAddress(this.pc);
        this.sp--;
        this.writeMemory(this.sp, this.pc >>> 8);
        this.sp--;
        this.writeMemory(this.sp, this.pc);
        this.pc = this.wz = addr;
    }

    /**
     * Adds the `regHl` value and `regOther` value according to the rule of ADD HL,QQ operation
     * @param regHl HL (IX, IY) value
     * @param regOther Other value
     * @returns Result value
     */
    add16(regHl: number, regOther: number): number
    {
        const tmpVal = regHl + regOther;
        const lookup =
          ((regHl & 0x0800) >>> 11) |
          ((regOther & 0x0800) >>> 10) |
          ((tmpVal & 0x0800) >>> 9);
        this.wz = regHl + 1;
        this.f =(this.flagsSZPVValue) |
          ((tmpVal & 0x10000) !== 0 ? FlagsSetMask.C : 0x00) |
          ((tmpVal >>> 8) & (FlagsSetMask.R3R5)) |
          halfCarryAddFlags[lookup];
        this.f53Updated = true;
        return tmpVal & 0xffff;
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
        const lookup =
          ((this.a & 0x88) >>> 3) |
          ((value & 0x88) >>> 2) |
          ((tmp & 0x88) >>> 1);
        this.a = tmp;
        this.f =
          ((tmp & 0x100) !== 0 ? FlagsSetMask.C : 0) |
          FlagsSetMask.N |
          halfCarrySubFlags[lookup & 0x07] |
          overflowSubFlags[lookup >>> 4] |
          sz53Table[this.a];
        this.f53Updated = true;
    }

    /**
     * The core of the 8-bit SBC operation
     * @param value Value to subtract from A
     */
    sbc8(value: number): void {
        const tmp = this.a - value - this.flagCValue;
        const lookup =
          ((this.a & 0x88) >>> 3) |
          ((value & 0x88) >>> 2) |
          ((tmp & 0x88) >>> 1);
        this.a = tmp;
        this.f =
          ((tmp & 0x100) !== 0 ? FlagsSetMask.C : 0) |
          FlagsSetMask.N |
          halfCarrySubFlags[lookup & 0x07] |
          overflowSubFlags[lookup >>> 4] |
          sz53Table[this.a];
        this.f53Updated = true;
    }

    /**
     * The core of the 8-bit ADD operation 
     * @param value Value to add to A
     */
    add8(value: number): void {
        const tmp = this.a + value;
        var lookup =
            ((this.a & 0x88) >>> 3) |
            ((value & 0x88) >>> 2) |
            ((tmp & 0x88) >>> 1);
        this.a = tmp;
        this.f = 
          ((tmp & 0x100) != 0 ? FlagsSetMask.C : 0) |
          halfCarryAddFlags[lookup & 0x07] |
          overflowAddFlags[lookup >> 4] |
          sz53Table[this.a];
        this.f53Updated = true;
    }

    /**
     * The core of the 8-bit ADD operation 
     * @param value Value to add to A
     */
    adc8(value: number): void {
        const tmp = this.a + value + this.flagCValue;
        var lookup =
            ((this.a & 0x88) >>> 3) |
            ((value & 0x88) >>> 2) |
            ((tmp & 0x88) >>> 1);
        this.a = tmp;
        this.f = 
          ((tmp & 0x100) != 0 ? FlagsSetMask.C : 0) |
          halfCarryAddFlags[lookup & 0x07] |
          overflowAddFlags[lookup >>> 4] |
          sz53Table[this.a];
        this.f53Updated = true;
    }

    /**
     * The core of the 8-bit AND operation 
     * @param value Value to AND with A
     */
    and8(value: number): void {
        this.a &= value;
        this.f = FlagsSetMask.H | sz53pvTable[this.a];
        this.f53Updated = true;
    }

    /**
     * The core of the 8-bit XOR operation 
     * @param value Value to XOR with A
     */
    xor8(value: number): void {
        this.a ^= value;
        this.f = sz53pvTable[this.a];
        this.f53Updated = true;
    }

    /**
     * The core of the 8-bit OR operation 
     * @param value Value to OR with A
     */
     or8(value: number): void {
        this.a |= value;
        this.f = sz53pvTable[this.a];
        this.f53Updated = true;
    }

    /**
     * The core of the 8-bit CP operation 
     * @param value Value to compare with A
     */
    cp8(value: number): void {
        const tmp = this.a - value;
        const lookup =
          ((this.a & 0x88) >>> 3) |
          ((value & 0x88) >>> 2) |
          ((tmp & 0x88) >>> 1);
        this.f = ((tmp & 0x100) != 0 ? FlagsSetMask.C : 0) |
          (tmp != 0 ? 0 : FlagsSetMask.Z) |
          FlagsSetMask.N |
          halfCarrySubFlags[lookup & 0x07] |
          overflowSubFlags[lookup >>> 4] |
          (value & FlagsSetMask.R3R5) |
          (tmp & FlagsSetMask.S);
        this.f53Updated = true;
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
        this.r = (this.r + 1) & 0x7f | (this.r & 0x80);
    }
 
    /**
      * Reads the specified memory address.
      * @param address Memory address to read
      * @returns The byte the CPU has read from the memory
      * If the emulated hardware uses any delay when reading the memory, increment the CPU tacts accordingly.
      */
    readMemory(address: number): number {
        this.delayMemoryRead(address);
        return this.doReadMemory(address);
    }

    /**
     * Writes a byte to the specfied memory address.
     * @param address Memory address
     * @param data Data byte to write
     * If the emulated hardware uses any delay when writing the memory, increment the CPU tacts accordingly.
     */
    writeMemory(address: number, data: number): void {
        this.delayMemoryWrite(address);
        this.doWriteMemory(address, data);
    }

    /**
     * Read the byte at the specified memory address.
     * @param address 16-bit memory address
     * @return The byte read from the memory
     * Note: the default implementation always returns 0xff
     */
    doReadMemory(address: number): number {
        return 0xff;
    }

    /**
     * This function implements the memory read delay of the CPU.
     * @param address Memory address to read
     * Normally, it is exactly 3 T-states; however, it may be higher in particular hardware. If you do not set your
     * action, the Z80 CPU will use its default 3-T-state delay. If you use custom delay, take care that you increment
     * the CPU tacts at least with 3 T-states!
     */
    delayMemoryRead(address: number): void {
        this.tactPlus3();
    }

    /**
     * Write the given byte to the specified memory address.
     * @param address 16-bit memory address
     * @param value Byte to write into the memory
     * Note: the default implementation does not write the memory
     */
    doWriteMemory(address: number, value: number): void {
        // --- Override this method in derived classes
    }

    /**
     * This function implements the memory write delay of the CPU.
     * @param address Memory address to write
     * Normally, it is exactly 3 T-states; however, it may be higher in particular hardware. If you do not set your
     * action, the Z80 CPU will use its default 3-T-state delay. If you use custom delay, take care that you increment
     * the CPU tacts at least with 3 T-states!
     */
    delayMemoryWrite(address: number): void {
        this.tactPlus3();
    }

    /**
     * This function handles address-based memory read contention.
     * @param address Address to use for contention delay calculation
     */
    delayAddressBusAccess(address: number): void {
        // --- Override this method in derived classes
    }

    /**
     * Reads the code byte from the current Program Counter address and then increments the Program Counter.
     * @returns The byte read
     */
    fetchCodeByte(): number {
        this.delayMemoryRead(this.pc);
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
        return this.doReadPort(address);
    }

    /**
     * Writes a byte to the specfied I/O port.
     * @param address I/O port address
     * @param data Data byte to write
     * If the emulated hardware uses any delay when writing the port, increment the CPU tacts accordingly.
     */
    writePort(address: number, data: number): void {
        this.delayPortWrite(address);
        this.doWritePort(address, data);
    }

    /**
     * This function reads a byte (8-bit) from an I/O port using the provided 16-bit address.
     * @param address 16-bit port address to read
     * When placing the CPU into an emulated environment, you must provide a concrete function that emulates the
     * I/O port read operation.
     */
    doReadPort(address: number): number {
        // --- Override this method in derived classes
        return 0xff;
    }

    /**
     * This function implements the I/O port read delay of the CPU.
     * @param address 16-bit port address
     * Normally, it is exactly 4 T-states; however, it may be higher in particular hardware. If you do not set your
     * action, the Z80 CPU will use its default 4-T-state delay. If you use custom delay, take care that you increment
     * the CPU tacts at least with 4 T-states!
     */
    delayPortRead(address: number): void {
        this.tactPlus4();
    }

    /**
     * This function writes a byte (8-bit) to the 16-bit I/O port address provided in the first argument.
     * @param address 16-bit port address to write
     * @param value The value to write to the specified port
     * When placing the CPU into an emulated environment, you must provide a concrete function that emulates the
     * I/O port write operation.
     */
    doWritePort(address: number, value: number): void {
        // --- Override this method in derived classes
    }

    /**
     * This function implements the I/O port write delay of the CPU.
     * @param address 16-bit port address
     * Normally, it is exactly 4 T-states; however, it may be higher in particular hardware. If you do not set your
     * action, the Z80 CPU will use its default 4-T-state delay. If you use custom delay, take care that you increment
     * the CPU tacts at least with 4 T-states!
     */
    delayPortWrite(address: number): void {
        this.tactPlus4();
    }

    /**
     * Every time the CPU clock is incremented with a single T-state, this function is executed.
     * @param increment The tact increment value
     * With this function, you can emulate hardware activities running simultaneously with the CPU. For example,
     * rendering the screen or sound,  handling peripheral devices, and so on.
     */
    onTactIncremented(increment: number): void {
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
        this.tacts += 1;
        this.frameTacts += 1;
        var totalTacts = this.tactsInFrame * this.clockMultiplier;
        if (this.frameTacts >= totalTacts)
        {
            this.frames++;
            this.frameTacts -= totalTacts;
        }
        this.onTactIncremented(1);
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
        this.tacts += 3;
        this.frameTacts += 3;
        var totalTacts = this.tactsInFrame * this.clockMultiplier;
        if (this.frameTacts >= totalTacts)
        {
            this.frames++;
            this.frameTacts -= totalTacts;
        }
        this.onTactIncremented(3);
    }

    /**
     * This method increments the current CPU tacts by four.
     */
    tactPlus4(): void {
        this.tacts += 4;
        this.frameTacts += 4;
        var totalTacts = this.tactsInFrame * this.clockMultiplier;
        if (this.frameTacts >= totalTacts)
        {
            this.frames++;
            this.frameTacts -= totalTacts;
        }
        this.onTactIncremented(4);
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
        var totalTacts = this.tactsInFrame * this.clockMultiplier;
        if (this.frameTacts >= totalTacts)
        {
            this.frames++;
            this.frameTacts -= totalTacts;
        }
        this.onTactIncremented(n);
    }

    // ----------------------------------------------------------------------------------------------------------------
    // Z80 operation tables

    readonly standardOps: Z80Operation[] = [
        nop,      ldBcNN,   ldBciA,   incBc,    incB,     decB,     ldBN,     rlca,    // 00-07 
        exAf,     addHlBc,  ldABci,   decBc,    incC,     decC,     ldCN,     rrca,    // 08-0f 
        djnz,     ldDeNN,   ldDeiA,   incDe,    incD,     decD,     ldDN,     rla,     // 10-17 
        jr,       addHlDe,  ldADei,   decDe,    incE,     decE,     ldEN,     rra,     // 18-1f 
        jrnz,     ldHlNN,   ldNNiHl,  incHl,    incH,     decH,     ldHN,     daa,     // 20-27 
        jrz,      addHlHl,  ldHlNNi,  decHl,    incL,     decL,     ldLN,     cpl,     // 28-2f 
        jrnc,     ldSpNN,   ldNNiA,   incSp,    incHli,   decHli,   ldHliN,   scf,     // 30-37 
        jrc,      addHlSp,  ldANNi,   decSp,    incA,     decA,     ldAN,     ccf,     // 38-3f 

        nop,      ldBC,     ldBD,     ldBE,     ldBH,     ldBL,     ldBHli,   ldBA,    // 40-47 
        ldCB,     nop,      ldCD,     ldCE,     ldCH,     ldCL,     ldCHli,   ldCA,    // 48-4f 
        ldDB,     ldDC,     nop,      ldDE,     ldDH,     ldDL,     ldDHli,   ldDA,    // 50-57 
        ldEB,     ldEC,     ldED,     nop,      ldEH,     ldEL,     ldEHli,   ldEA,    // 58-5f 
        ldHB,     ldHC,     ldHD,     ldHE,     nop,      ldHL,     ldHHli,   ldHA,    // 60-67 
        ldLB,     ldLC,     ldLD,     ldLE,     ldLH,     nop,      ldLHli,   ldLA,    // 68-6f 
        ldHliB,   ldHliC,   ldHliD,   ldHliE,   ldHliH,   ldHliL,   halt,     ldHliA,  // 70-77 
        ldAB,     ldAC,     ldAD,     ldAE,     ldAH,     ldAL,     ldAHli,   nop,     // 78-7f 

        addAB,    addAC,    addAD,    addAE,    addAH,    addAL,    addAHli,  addAA,   // 80-87 
        adcAB,    adcAC,    adcAD,    adcAE,    adcAH,    adcAL,    adcAHli,  adcAA,   // 88-8f 
        subAB,    subAC,    subAD,    subAE,    subAH,    subAL,    subAHli,  subAA,   // 90-97 
        sbcAB,    sbcAC,    sbcAD,    sbcAE,    sbcAH,    sbcAL,    sbcAHli,  sbcAA,   // 98-9f 
        andAB,    andAC,    andAD,    andAE,    andAH,    andAL,    andAHli,  andAA,   // a0-a7 
        xorAB,    xorAC,    xorAD,    xorAE,    xorAH,    xorAL,    xorAHli,  xorAA,   // a8-af 
        orAB,     orAC,     orAD,     orAE,     orAH,     orAL,     orAHli,   orAA,    // b0-b7 
        cpB,      cpC,      cpD,      cpE,      cpH,      cpL,      cpHli,    cpA,     // b8-bf 

        retNz,    popBc,    jpNz,     jp,       callNz,   pushBc,   addAN,    rst00,   // c0-c7 
        retZ,     ret,      jpZ,      nop,      callZ,    call,     adcAN,    rst08,   // c8-cf 
        retNc,    popDe,    jpNc,     outNA,    callNc,   pushDe,   subAN,    rst10,   // d0-d7 
        retC,     exx,      jpC,      inAN,     callC,    nop,      sbcAN,    rst18,   // d8-df 
        retPo,    popHl,    jpPo,     exSpiHl,  callPo,   pushHl,   andAN,    rst20,   // e0-e7 
        retPe,    jpHl,     jpPe,     exDeHl,   callPe,   nop,      xorAN,    rst28,   // e8-ef 
        retP,     popAf,    jpP,      di,       callP,    pushAf,   orAN,     rst30,   // f0-f7 
        retM,     nop,      jpM,      ei,       callM,    nop,      cpAN,     rst38,   // f8-ff 
    ]
}

// --------------------------------------------------------------------------------------------------------------------
// ALU helpers
const incFlags: number[] = [];
const decFlags: number[] = [];
const halfCarryAddFlags: number[] = [0x00, 0x10, 0x10, 0x10, 0x00, 0x00, 0x00, 0x10];
const halfCarrySubFlags: number[] = [0x00, 0x00, 0x10, 0x00, 0x10, 0x00, 0x10, 0x10];
const overflowAddFlags: number[] = [0x00, 0x00, 0x00, 0x04, 0x04, 0x00, 0x00, 0x00];
const overflowSubFlags: number[] = [0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00];
const parityTable: number[] = [];
const sz53Table: number[] = [];
const sz53pvTable: number[] = [];

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
            ((oldVal & 0x0F) === 0x0F ? FlagsSetMask.H : 0) |
            (oldVal === 0x7F ? FlagsSetMask.PV : 0);
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
            ((oldVal & 0x0F) === 0x00 ? FlagsSetMask.H : 0) |
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
            parity ^= (b & 0x01);
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
// Z80 operations

/**
 * The function represents a Z80 operation
 */
 type Z80Operation = (cpu: Z80Cpu) => void;

 // 0x00: NOP
function nop(cpu: Z80Cpu) {
}

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
    cpu.f53Updated = true;
}

// 0x05: DEC B
function decB(cpu: Z80Cpu) {
    cpu.f = decFlags[cpu.b--] | cpu.flagCValue;
    cpu.f53Updated = true;
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
        rlcaVal = (rlcaVal | 0x01) & 0xFF;
    }
    cpu.a = rlcaVal;
    cpu.f = cf | cpu.flagsSZPVValue | (cpu.a & FlagsSetMask.R3R5);
    cpu.f53Updated = true;
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
    cpu.f53Updated = true;
}

// 0x0d: DEC C
function decC(cpu: Z80Cpu) {
    cpu.f = decFlags[cpu.c--] | cpu.flagCValue;
    cpu.f53Updated = true;
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
    cpu.f53Updated = true;
}

// 0x10: DJNZ d
function djnz(cpu: Z80Cpu) {
    cpu.tactPlus1WithAddress(cpu.ir);
    const e = cpu.fetchCodeByte();
    if (--cpu.b !== 0)
    {
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
    cpu.f53Updated = true;
}

// 0x15: DEC D
function decD(cpu: Z80Cpu) {
    cpu.f = decFlags[cpu.d--] | cpu.flagCValue;
    cpu.f53Updated = true;
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
    cpu.f53Updated = true;
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
    cpu.f53Updated = true;
}

// 0x1d: DEC E
function decE(cpu: Z80Cpu) {
    cpu.f = decFlags[cpu.e--] | cpu.flagCValue;
    cpu.f53Updated = true;
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
    cpu.f53Updated = true;
}

// 0x20: JR NZ,e
function jrnz(cpu: Z80Cpu) {
    const e = cpu.fetchCodeByte();
    if (!cpu.isZFlagSet())
    {
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
    cpu.f53Updated = true;
}

// 0x25: DEC H
function decH(cpu: Z80Cpu) {
    cpu.f = decFlags[cpu.h--] | cpu.flagCValue;
    cpu.f53Updated = true;
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
    if (carry !== 0 || (cpu.a > 0x99)) {
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
    cpu.f53Updated = true;
}

// 0x28: JR Z,e
function jrz(cpu: Z80Cpu) {
    const e = cpu.fetchCodeByte();
    if (cpu.isZFlagSet())
    {
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
    cpu.f53Updated = true;
}

// 0x2d: DEC L
function decL(cpu: Z80Cpu) {
    cpu.f = decFlags[cpu.l--] | cpu.flagCValue;
    cpu.f53Updated = true;
}

// 0x2e: LD L,n
function ldLN(cpu: Z80Cpu) {
    cpu.l = cpu.fetchCodeByte();
}

// 0x2f: CPL
function cpl(cpu: Z80Cpu) {
    cpu.a ^= 0xFF;
    cpu.f = (cpu.f & (FlagsSetMask.C | FlagsSetMask.PV | FlagsSetMask.Z | FlagsSetMask.S)) |
        (cpu.a & FlagsSetMask.R3R5) | FlagsSetMask.N | FlagsSetMask.H;
    cpu.f53Updated = true;
}

// 0x30: JR NC,e
function jrnc(cpu: Z80Cpu) {
    const e = cpu.fetchCodeByte();
    if (!cpu.isCFlagSet())
    {
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
    cpu.f53Updated = true;
    cpu.writeMemory(cpu.hl, memValue);
}

// 0x35: DEC (HL)
function decHli(cpu: Z80Cpu) {
    let memValue = cpu.readMemory(cpu.hl);
    cpu.tactPlus1WithAddress(cpu.hl);
    cpu.f = decFlags[memValue--] | cpu.flagCValue;
    cpu.f53Updated = true;
    cpu.writeMemory(cpu.hl, memValue);
}

// 0x36: LD (HL),n
function ldHliN(cpu: Z80Cpu) {
    cpu.writeMemory(cpu.hl, cpu.fetchCodeByte());
}

// 0x37: SCF
function scf(cpu: Z80Cpu) {
    cpu.f = cpu.flagsSZPVValue | FlagsSetMask.C;
    cpu.setR5R3ForScfAndCcf();
}

// 0x38: JR C,e
function jrc(cpu: Z80Cpu) {
    const e = cpu.fetchCodeByte();
    if (cpu.isCFlagSet())
    {
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
    cpu.f53Updated = true;
}

// 0x3d: DEC A
function decA(cpu: Z80Cpu) {
    cpu.f = decFlags[cpu.a--] | cpu.flagCValue;
    cpu.f53Updated = true;
}

// 0x3e: LD A,n
function ldAN(cpu: Z80Cpu) {
    cpu.a = cpu.fetchCodeByte();
}

// 0x3f: CCF
function ccf(cpu: Z80Cpu) {
    cpu.f = cpu.flagsSZPVValue | (cpu.isCFlagSet() ? FlagsSetMask.H : FlagsSetMask.C);
    cpu.setR5R3ForScfAndCcf();
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
    cpu.tactPlus1WithAddress(cpu.sp);
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

// 0xf5: PUSH HL
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

