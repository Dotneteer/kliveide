import { RegisterSet } from "z80-base";

/**
 * Complete state of the CPU.
 */
export class Z80State {
    public readonly regs: RegisterSet;

    constructor(regs: RegisterSet) {
        this.regs = regs;
    }
}
