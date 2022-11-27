import { IZ80Cpu, OpCodePrefix } from "../abstractions/IZ80Cpu";

export class Z80Cpu implements IZ80Cpu {
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

    sigINT: boolean;
    sigNMI: boolean;
    sigRST: boolean;
    interruptMode: number;
    iff1: boolean;
    iff2: boolean;
    halted: boolean;
    baseClockFrequency: number;
    clockMultiplier: number;
    tacts: number;
    frames: number;
    currentFrameTact: number;
    tactsInFrame: number;
    tactsInDisplayLine: number;
    setTactsInFrame(tacts: number): void {
        throw new Error("Method not implemented.");
    }
    f53Updated: boolean;
    prevF53Updated: boolean;
    opCode: number;
    prefix: OpCodePrefix;
    eiBacklog: number;
    retExecuted: boolean;
    allowExtendedInstructions: boolean;
    totalContentionDelaySinceStart: number;
    contentionDelaySincePause: number;
    hardReset(): void {
        throw new Error("Method not implemented.");
    }
    reset(): void {
        throw new Error("Method not implemented.");
    }
    getCallInstructionLength(): number {
        throw new Error("Method not implemented.");
    }
    executeCpuCycle(): void {
        throw new Error("Method not implemented.");
    }
    doReadMemory(address: number): number {
        throw new Error("Method not implemented.");
    }
    delayMemoryRead(address: number): void {
        throw new Error("Method not implemented.");
    }
    doWriteMemory(address: number, value: number): void {
        throw new Error("Method not implemented.");
    }
    delayMemoryWrite(address: number): void {
        throw new Error("Method not implemented.");
    }
    delayAddressBusAccess(address: number): void {
        throw new Error("Method not implemented.");
    }
    doReadPort(address: number): number {
        throw new Error("Method not implemented.");
    }
    delayPortRead(address: number): void {
        throw new Error("Method not implemented.");
    }
    doWritePort(address: number, value: number): void {
        throw new Error("Method not implemented.");
    }
    delayPortWrite(address: number): void {
        throw new Error("Method not implemented.");
    }
    onTactIncremented(increment: number): void {
        throw new Error("Method not implemented.");
    }
    tactPlus1(): void {
        throw new Error("Method not implemented.");
    }
    tactPlus3(): void {
        throw new Error("Method not implemented.");
    }
    tactPlus4(): void {
        throw new Error("Method not implemented.");
    }
    tactPlusN(): void {
        throw new Error("Method not implemented.");
    }

}