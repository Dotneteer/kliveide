import {Flag, hi, inc16, lo, RegisterSet, word} from "z80-base";
import {decode} from "./Decode.js";
import {Hal} from "./Hal.js";
import {Z80State} from "./Z80State.js";

/**
 * Emulated Z80 processor.
 */
export class Z80 {
    /**
     * Full set of registers.
     */
    public regs: RegisterSet = new RegisterSet();
    /**
     * Hardware abstraction layer this Z80 is dealing with.
     */
    public hal: Hal;
    /**
     * Address of the last instruction executed.
     */
    public instructionAddress: number = 0;
    /**
     * Address of instruction that pushed the data on the stack at this address. If a word
     * is pushed, only the final stack address is recorded, not the intermediate byte address.
     */
    public readonly pushInstructionAddress = new Uint16Array(64*1024);
    /**
     * Tables for computing flags. Public so that the decoding function
     * can access them.
     */
    public readonly sz53Table: number[] = []; /* The S, Z, 5 and 3 bits of the index */
    public readonly parityTable: number[] = []; /* The parity of the lookup value */
    public readonly sz53pTable: number[] = []; /* OR the above two tables together */

    constructor(hal: Hal) {
        this.hal = hal;
        this.initTables();
    }

    /**
     * Complete state of the CPU, for use in {@link #restore()}.
     */
    public save(): Z80State {
        return new Z80State(this.regs.clone());
    }

    /**
     * Restore complete state of CPU, from result of {@link #save()}.
     * @param state
     */
    public restore(state: Z80State): void {
        this.regs = state.regs.clone();
    }

    /**
     * Reset the Z80 to a known state.
     */
    public reset(): void {
        this.regs = new RegisterSet();
    }

    /**
     * Execute one instruction.
     */
    public step(): void {
        this.instructionAddress = this.regs.pc;
        decode(this);
    }

    /**
     * Increment the clock count.
     */
    public incTStateCount(count: number): void {
        this.hal.tStateCount += count;
    }

    /**
     * Interrupt the CPU with a maskable interrupt
     */
    public maskableInterrupt(): void {
        if (this.regs.iff1 !== 0) {
            this.interrupt(true);
        }
    }

    /**
     * Interrupt the CPU with a non-maskable interrupt
     */
    public nonMaskableInterrupt(): void {
        this.interrupt(false);
    }

    /**
     * Read a byte from memory, taking as many clock cycles as necessary.
     */
    public readByte(address: number): number {
        this.incTStateCount(3);
        return this.readByteInternal(address);
    }

    /**
     * Reads a word at the specified address. Reads the low byte first.
     */
    public readWord(address: number): number {
        const lowByte = this.readByte(address);
        const highByte = this.readByte(address + 1);

        return word(highByte, lowByte);
    }

    /**
     * Read a byte from memory (not affecting clock).
     */
    public readByteInternal(address: number): number {
        return this.hal.readMemory(address);
    }

    /**
     * Write a byte to memory, taking as many clock cycles as necessary.
     */
    public writeByte(address: number, value: number): void {
        this.incTStateCount(3);
        this.writeByteInternal(address, value);
    }

    /**
     * Write a byte to memory (not affecting clock).
     */
    public writeByteInternal(address: number, value: number): void {
        this.hal.writeMemory(address, value);
    }

    /**
     * Write a byte to a port, taking as many clock cycles as necessary.
     */
    public writePort(address: number, value: number): void {
        this.incTStateCount(1);
        this.hal.writePort(address, value);
        this.incTStateCount(3);
    }

    /**
     * Read a byte from a port, taking as many clock cycles as necessary.
     */
    public readPort(address: number): number {
        this.incTStateCount(1);
        const value = this.hal.readPort(address);
        this.incTStateCount(3);
        return value;
    }

    /**
     * Push a word on the stack.
     */
    public pushWord(value: number): void {
        this.pushByte(hi(value));
        this.pushByte(lo(value));

        // Record that this instruction pushed this word.
        this.pushInstructionAddress[this.regs.sp] = this.instructionAddress;
    }

    /**
     * Push a byte on the stack.
     */
    public pushByte(value: number): void {
        this.regs.sp = (this.regs.sp - 1) & 0xFFFF;
        this.writeByte(this.regs.sp, value);
    }

    /**
     * Pop a word from the stack.
     */
    public popWord(): number {
        const lowByte = this.popByte();
        const highByte = this.popByte();
        return word(highByte, lowByte);
    }

    /**
     * Pop a byte from the stack.
     */
    public popByte(): number {
        const value = this.readByte(this.regs.sp);
        this.regs.sp = inc16(this.regs.sp);
        return value;
    }

    /**
     * Process either kind of interrupt. If maskable, assumes that
     * the mask has already been checked.
     */
    private interrupt(maskable: boolean): void {
        if (this.regs.halted) {
            // Skip past HALT instruction.
            this.regs.pc = (this.regs.pc + 1) & 0xFFFF;
            this.regs.halted = 0;
        }

        this.incTStateCount(7);
        this.regs.bumpR();
        this.regs.iff1 = 0;
        if (maskable) {
            // Officially an NMI will copy iff1 to iff2, but "Undocumented Z80 Documented" says
            // that iff2 is just not affected by NMI. (This is effectively the same in any
            // program that doesn't nest NMIs.)
            this.regs.iff2 = 0;
        }

        this.pushWord(this.regs.pc);

        if (maskable) {
            switch (this.regs.im) {
                case 0:
                    // Should take a one-byte instruction from the data bus (usually some RST).
                    // We don't have a data bus, so always pick RST 38h.
                    this.regs.pc = 0x0038;
                    break;

                case 1:
                    // Always RST 38h.
                    this.regs.pc = 0x0038;
                    break;

                case 2: {
                    // The LSB here is taken from the data bus, so it's
                    // unpredictable. We use 0xFF but any value would do.
                    const address = word(this.regs.i, 0xFF);
                    this.regs.pc = this.readWord(address);
                    break;
                }

                default:
                    throw new Error("Unknown im mode " + this.regs.im);
            }
        } else {
            this.regs.pc = 0x0066;
        }
    }

    private initTables(): void {
        for (let i = 0; i< 0x100; i++) {
            this.sz53Table.push(i & (Flag.X3 | Flag.X5 | Flag.S));
            let bits = i;
            let parity = 0;
            for (let bit = 0; bit < 8; bit++) {
                parity ^= bits & 1;
                bits >>= 1;
            }
            this.parityTable.push(parity ? 0 : Flag.P);
            this.sz53pTable.push(this.sz53Table[i] | this.parityTable[i]);
        }

        this.sz53Table[0] |= Flag.Z;
        this.sz53pTable[0] |= Flag.Z;

    }
}
