import { IZ80Cpu, OpCodePrefix } from "../abstractions/IZ80Cpu";

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
        this._a = (value & 0xff00) >> 8
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
        this._b = (value & 0xff00) >> 8
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
        this._d = (value & 0xff00) >> 8
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
        this._h = (value & 0xff00) >> 8
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
        this._xh = (value & 0xff00) >> 8
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
        this._yh = (value & 0xff00) >> 8
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
        this._i = (value & 0xff00) >> 8
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
        this._wh = (value & 0xff00) >> 8
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
                this.wz = this.indexReg + (this.opCode > 128 ? this.opCode - 256 : this.opCode);
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

    /// <summary>
    /// Push the current value of PC to the stack.
    /// </summary>
    pushPC(): void {
        this.sp--;
        this.tactPlus1();
        this.writeMemory(this.sp, this.pc >> 8);
        this.sp--;
        this.writeMemory(this.sp, this.pc & 0xff);
    }

    // ----------------------------------------------------------------------------------------------------------------
    // Z80 memory and I/O management

    /**
     * Calculate the new value of Register F.
     * 
     * Seven bits of this 8-bit register are automatically incremented after each instruction fetch. The eighth bit
     * remains as programmed, resulting from an LD R, A instruction.
     */
    private refreshMemory(): void {
        this.r = (this.r + 1) & 0x7f | (this.r & 0x80);
    }
 
    /**
      * Reads the specified memory address.
      * @param address Memory address to read
      * @returns The byte the CPU has read from the memory
      * If the emulated hardware uses any delay when reading the memory, increment the CPU tacts accordingly.
      */
    private readMemory(address: number): number {
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
        nop,      ldBcNN,   ldBciA,   incBc,    nop,      nop,      ldBN,     nop,     // 00-07 
        nop,      nop,      nop,      decBc,    nop,      nop,      ldCN,     nop,     // 08-0f 
        nop,      ldDeNN,   ldDeiA,   incDe,    nop,      nop,      ldDN,     nop,     // 10-07 
        nop,      nop,      nop,      decDe,    nop,      nop,      ldEN,     nop,     // 18-1f 
        nop,      ldHlNN,   nop,      incHl,    nop,      nop,      ldHN,     nop,     // 20-27 
        nop,      nop,      nop,      decHl,    nop,      nop,      ldLN,     nop,     // 28-0f 
        nop,      ldSpNN,   nop,      incSp,    nop,      nop,      nop,      nop,     // 30-37 
        nop,      nop,      nop,      decSp,    nop,      nop,      ldAN,     nop,     // 38-3f 

        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // 40-47 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // 48-4f 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // 50-57 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // 58-5f 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // 60-67 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // 68-6f 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // 70-77 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // 78-7f 

        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // 80-87 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // 88-8f 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // 90-97 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // 98-9f 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // a0-a7 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // a8-af 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // b0-b7 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // b8-bf 

        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // c0-c7 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // c8-cf 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // d0-d7 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // d8-df 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // e0-e7 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // e8-ef 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // f0-f7 
        nop,      nop,      nop,      nop,      nop,      nop,      nop,      nop,     // f8-ff 
    ]
}

/**
 * The function represents a Z80 operation
 */
type Z80Operation = (cpu: Z80Cpu) => void;

// --------------------------------------------------------------------------------------------------------------------
// Z80 standard operations

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

// 0x06: LD B,n
function ldBN(cpu: Z80Cpu) {
    cpu.b = cpu.fetchCodeByte();
}

// 0x0b: DEC BC
function decBc(cpu: Z80Cpu) {
    cpu.bc--;
    cpu.tactPlus2WithAddress(cpu.ir);
}

// 0x0E: LD C,n
function ldCN(cpu: Z80Cpu) {
    cpu.c = cpu.fetchCodeByte();
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

// 0x16: LD D,n
function ldDN(cpu: Z80Cpu) {
    cpu.d = cpu.fetchCodeByte();
}

// 0x1b: DEC DE
function decDe(cpu: Z80Cpu) {
    cpu.de--;
    cpu.tactPlus2WithAddress(cpu.ir);
}

// 0x1E: LD E,n
function ldEN(cpu: Z80Cpu) {
    cpu.e = cpu.fetchCodeByte();
}

// 0x21: LD HL,nn
function ldHlNN(cpu: Z80Cpu) {
    cpu.l = cpu.fetchCodeByte();
    cpu.h = cpu.fetchCodeByte();
}

// 0x23: INC HL
function incHl(cpu: Z80Cpu) {
    cpu.hl++;
    cpu.tactPlus2WithAddress(cpu.ir);
}

// 0x26: LD H,n
function ldHN(cpu: Z80Cpu) {
    cpu.h = cpu.fetchCodeByte();
}

// 0x2b: DEC HL
function decHl(cpu: Z80Cpu) {
    cpu.hl--;
    cpu.tactPlus2WithAddress(cpu.ir);
}

// 0x2E: LD L,n
function ldLN(cpu: Z80Cpu) {
    cpu.l = cpu.fetchCodeByte();
}

// 0x31: LD SP,nn
function ldSpNN(cpu: Z80Cpu) {
    const l = cpu.fetchCodeByte();
    const h = cpu.fetchCodeByte();
    cpu.sp = (h << 8) | l;
}

// 0x33: INC SP
function incSp(cpu: Z80Cpu) {
    cpu.sp++;
    cpu.tactPlus2WithAddress(cpu.ir);
}

// 0x3b: DEC SP
function decSp(cpu: Z80Cpu) {
    cpu.sp--;
    cpu.tactPlus2WithAddress(cpu.ir);
}

// 0x3e: LD A,n
function ldAN(cpu: Z80Cpu) {
    cpu.a = cpu.fetchCodeByte();
}
