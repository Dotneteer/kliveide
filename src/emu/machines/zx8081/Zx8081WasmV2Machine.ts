import { WasmHistorySource } from "../history/WasmHistorySource";
import { WasmProfileSource } from "../profile/WasmProfileSource";
import type { IExecutionHistorySource } from "@emu/abstractions/IExecutionHistorySource";
import type { IAccessProfileSource } from "@emu/abstractions/IAccessProfileSource";
import type { ProfileCounts, ProfileEdge, ProfileInfo, ProfileTouchedByte } from "@common/profile/profileTypes";
import type { ExecutionHistoryInfo, ExecutionHistoryPage } from "@common/history/historyTypes";
import type { HistoryServiceSpan } from "@common/history/serviceSpans";
import { conditionStoreOf, type ConditionStore } from "../conditionStore";
import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";
import type { CpuState } from "@common/messaging/EmuApi";
import type { Zx8081WasmV2LoaderOptions, Zx8081WasmV2Runtime } from "./wasm/Zx8081WasmV2Loader";
import type { ZxProgramFile } from "./ZxPFile";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { FAST_LOAD, REWIND_REQUESTED } from "../machine-props";
import {
  hasWasmAccessBreakpoint,
  runWasmDebugLoop,
  type WasmDebugLoopHost,
  shouldStopAtWasmBreakpoint,
  stepOutAddressFromCore
} from "../wasmDebugLoop";
import { importAccessLog } from "../wasmAccessLog";
import { loadZx8081WasmV2 } from "./wasm/Zx8081WasmV2Loader";
import { Zx8081WasmHost } from "./Zx8081WasmHost";
import { ZX80_ROM, ZX81_ROM } from "./zx8081MachineInfo";
import { ZX8081_RUN_COMMAND } from "./Zx8081Typer";
import {
  captureWasmImage,
  restoreWasmImage,
  type MachineStateParts
} from "../state/wasmStateImage";
import { fillCoreBytes, writeCoreBytes } from "@emu/machines/reverse/coreMemoryWrites";

/** Frames between the end of a load and the typed RUN: the ROM is still printing its report */
const AUTO_RUN_DELAY_FRAMES = 25;

/** Whether a machine property holds a ZX80/ZX81 program file (a Spectrum tape is an array of blocks) */
function isProgramFile(value: unknown): value is ZxProgramFile {
  return (
    value != null && typeof value === "object" && !Array.isArray(value) && (value as ZxProgramFile).tapeBytes instanceof Uint8Array
  );
}

/**
 * A Sinclair ZX80 or ZX81 on the WASM core (`wasm/zx8081/`, `.plans/ZX8081_WASM_PLAN.md`): one core
 * for both machines, configured by the model at setup.
 *
 * The registers are read live from the core and every write is pushed into it; the debugger runs
 * instruction by instruction, or - when the stop policy can only stop at known addresses - the core
 * runs on to the next candidate, exactly as on the Cambridge Z88.
 *
 * While the display file executes, the CPU runs NOPs the ULA forced onto the bus at $C000+, so the
 * memory there (the disassembly) and the instruction executed differ: `getCpuState().opCode` is the
 * executed $00.
 */
export class Zx8081WasmV2Machine extends Zx8081WasmHost implements IExecutionHistorySource, IAccessProfileSource {
  // ==============================================================================================
  // Execution history (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md`): the shared recorder in the
  // core, read through the shared reader; the machine id names the context decoder

  get historyMachineId(): string {
    return this.machineId;
  }

  private readonly wasmV2History = new WasmHistorySource(
    () => this.wasmV2Runtime?.exports,
    () => this.historyMachineId
  );

  getHistoryInfo(): ExecutionHistoryInfo | undefined {
    return this.wasmV2History.info();
  }

  readHistory(fromSequence: number, count: number): ExecutionHistoryPage | undefined {
    return this.wasmV2History.read(fromSequence, count);
  }

  getHistoryServiceSpans(): HistoryServiceSpan[] | undefined {
    return this.wasmV2History.serviceSpans();
  }

  clearHistory(): void {
    this.wasmV2History.clear();
  }

  setHistoryEnabled(enabled: boolean): void {
    this.wasmV2History.setEnabled(enabled);
  }

  // ==============================================================================================
  // The access profile (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md`): the shared module in the core,
  // read through the shared reader; the ZX80 and the ZX81 share one layout (`layouts/zx8081.ts`)

  get profileMachineId(): string {
    return this.machineId;
  }

  private readonly wasmV2Profile = new WasmProfileSource(
    () => this.wasmV2Runtime?.exports,
    () => this.profileMachineId
  );

  getProfileInfo(): ProfileInfo | undefined {
    return this.wasmV2Profile.info();
  }

  setProfiling(enabled: boolean, counters: boolean): void {
    this.wasmV2Profile.setEnabled(enabled, counters);
  }

  resetProfile(): void {
    this.wasmV2Profile.reset();
  }

  readProfileFlags(start: number, length: number): Uint8Array | undefined {
    return this.wasmV2Profile.flags(start, length);
  }

  readProfileCounts(start: number, length: number): ProfileCounts | undefined {
    return this.wasmV2Profile.counts(start, length);
  }

  readProfileTouched(mask?: number): ProfileTouchedByte[] | undefined {
    return this.wasmV2Profile.touched(mask);
  }

  mergeProfile(bytes: readonly ProfileTouchedByte[], totals: { instructions: number; timeTotal: number }): void {
    this.wasmV2Profile.merge(bytes, totals);
  }

  setProfileCalls(on: boolean): void {
    this.wasmV2Profile.setCalls(on);
  }

  armProfileWindow(start: number | undefined, stop: number | undefined): void {
    this.wasmV2Profile.arm(start, stop);
  }

  readProfileEdges(): ProfileEdge[] | undefined {
    return this.wasmV2Profile.edges();
  }

  public readonly implementation = "wasm" as const;
  public wasmV2Runtime?: Zx8081WasmV2Runtime;

  private screenPixels?: Uint32Array;
  private screenPixelBytes?: Uint8ClampedArray;
  private syncedTargetClockMultiplier = -1;

  constructor(
    machineId: string,
    modelInfo?: MachineModel,
    config?: MachineConfigSet,
    messenger?: MessengerBase,
    private readonly wasmV2LoaderOptions?: Zx8081WasmV2LoaderOptions
  ) {
    super(machineId, modelInfo, config, messenger);
    this.reset();
  }

  // ==========================================================================================
  // CPU registers: the core owns them

  private get w() {
    return this.wasmV2Runtime?.exports;
  }

  override get af(): number {
    return this.w ? this.w.zx8081GetCpuAf() : super.af;
  }
  override set af(value: number) {
    super.af = value;
    this.w?.zx8081SetCpuAf(super.af);
  }
  override get bc(): number {
    return this.w ? this.w.zx8081GetCpuBc() : super.bc;
  }
  override set bc(value: number) {
    super.bc = value;
    this.w?.zx8081SetCpuBc(super.bc);
  }
  override get de(): number {
    return this.w ? this.w.zx8081GetCpuDe() : super.de;
  }
  override set de(value: number) {
    super.de = value;
    this.w?.zx8081SetCpuDe(super.de);
  }
  override get hl(): number {
    return this.w ? this.w.zx8081GetCpuHl() : super.hl;
  }
  override set hl(value: number) {
    super.hl = value;
    this.w?.zx8081SetCpuHl(super.hl);
  }
  override get af_(): number {
    return this.w ? this.w.zx8081GetCpuAfAlt() : super.af_;
  }
  override set af_(value: number) {
    super.af_ = value;
    this.w?.zx8081SetCpuAfAlt(super.af_);
  }
  override get bc_(): number {
    return this.w ? this.w.zx8081GetCpuBcAlt() : super.bc_;
  }
  override set bc_(value: number) {
    super.bc_ = value;
    this.w?.zx8081SetCpuBcAlt(super.bc_);
  }
  override get de_(): number {
    return this.w ? this.w.zx8081GetCpuDeAlt() : super.de_;
  }
  override set de_(value: number) {
    super.de_ = value;
    this.w?.zx8081SetCpuDeAlt(super.de_);
  }
  override get hl_(): number {
    return this.w ? this.w.zx8081GetCpuHlAlt() : super.hl_;
  }
  override set hl_(value: number) {
    super.hl_ = value;
    this.w?.zx8081SetCpuHlAlt(super.hl_);
  }
  override get ix(): number {
    return this.w ? this.w.zx8081GetCpuIx() : super.ix;
  }
  override set ix(value: number) {
    super.ix = value;
    this.w?.zx8081SetCpuIx(super.ix);
  }
  override get iy(): number {
    return this.w ? this.w.zx8081GetCpuIy() : super.iy;
  }
  override set iy(value: number) {
    super.iy = value;
    this.w?.zx8081SetCpuIy(super.iy);
  }
  override get ir(): number {
    return this.w ? this.w.zx8081GetCpuIr() : super.ir;
  }
  override set ir(value: number) {
    super.ir = value;
    this.w?.zx8081SetCpuIr(super.ir);
  }
  override get wz(): number {
    return this.w ? this.w.zx8081GetCpuWz() : super.wz;
  }
  override set wz(value: number) {
    super.wz = value;
    this.w?.zx8081SetCpuWz(super.wz);
  }
  override get pc(): number {
    return this.w ? this.w.zx8081GetCpuPc() : super.pc;
  }
  override set pc(value: number) {
    super.pc = value;
    this.w?.zx8081SetCpuPc(super.pc);
  }
  override get sp(): number {
    return this.w ? this.w.zx8081GetCpuSp() : super.sp;
  }
  override set sp(value: number) {
    super.sp = value;
    this.w?.zx8081SetCpuSp(super.sp);
  }

  // --- The 8-bit halves go through the pairs: `Z80Cpu` keeps them in views the core never sees
  override get a(): number {
    return this.af >> 8;
  }
  override set a(value: number) {
    this.af = ((value & 0xff) << 8) | (this.af & 0xff);
  }
  override get f(): number {
    return this.af & 0xff;
  }
  override set f(value: number) {
    this.af = (this.af & 0xff00) | (value & 0xff);
  }
  override get b(): number {
    return this.bc >> 8;
  }
  override set b(value: number) {
    this.bc = ((value & 0xff) << 8) | (this.bc & 0xff);
  }
  override get c(): number {
    return this.bc & 0xff;
  }
  override set c(value: number) {
    this.bc = (this.bc & 0xff00) | (value & 0xff);
  }
  override get d(): number {
    return this.de >> 8;
  }
  override set d(value: number) {
    this.de = ((value & 0xff) << 8) | (this.de & 0xff);
  }
  override get e(): number {
    return this.de & 0xff;
  }
  override set e(value: number) {
    this.de = (this.de & 0xff00) | (value & 0xff);
  }
  override get h(): number {
    return this.hl >> 8;
  }
  override set h(value: number) {
    this.hl = ((value & 0xff) << 8) | (this.hl & 0xff);
  }
  override get l(): number {
    return this.hl & 0xff;
  }
  override set l(value: number) {
    this.hl = (this.hl & 0xff00) | (value & 0xff);
  }
  override get xh(): number {
    return this.ix >> 8;
  }
  override set xh(value: number) {
    this.ix = ((value & 0xff) << 8) | (this.ix & 0xff);
  }
  override get xl(): number {
    return this.ix & 0xff;
  }
  override set xl(value: number) {
    this.ix = (this.ix & 0xff00) | (value & 0xff);
  }
  override get yh(): number {
    return this.iy >> 8;
  }
  override set yh(value: number) {
    this.iy = ((value & 0xff) << 8) | (this.iy & 0xff);
  }
  override get yl(): number {
    return this.iy & 0xff;
  }
  override set yl(value: number) {
    this.iy = (this.iy & 0xff00) | (value & 0xff);
  }
  override get i(): number {
    return this.ir >> 8;
  }
  override set i(value: number) {
    this.ir = ((value & 0xff) << 8) | (this.ir & 0xff);
  }
  override get r(): number {
    return this.ir & 0xff;
  }
  override set r(value: number) {
    this.ir = (this.ir & 0xff00) | (value & 0xff);
  }
  override get iff1(): boolean {
    return this.w ? this.w.zx8081GetCpuIff1() !== 0 : super.iff1;
  }
  override set iff1(value: boolean) {
    super.iff1 = value;
    this.w?.zx8081SetCpuIff1(value ? 1 : 0);
  }
  override get iff2(): boolean {
    return this.w ? this.w.zx8081GetCpuIff2() !== 0 : super.iff2;
  }
  override set iff2(value: boolean) {
    super.iff2 = value;
    this.w?.zx8081SetCpuIff2(value ? 1 : 0);
  }
  override get interruptMode(): number {
    return this.w ? this.w.zx8081GetCpuInterruptMode() : super.interruptMode;
  }
  override set interruptMode(value: number) {
    super.interruptMode = value;
    this.w?.zx8081SetCpuInterruptMode(value);
  }

  override setTacts(value: number): void {
    super.setTacts(value);
    this.w?.zx8081SetTacts(value >>> 0);
  }

  // ==========================================================================================
  // Lifecycle

  /** Loads the core (once), configures the model, uploads the ROM and powers the machine on */
  async setup(): Promise<void> {
    if (this.wasmV2Runtime == null) {
      this.wasmV2Runtime = await loadZx8081WasmV2(this.wasmV2LoaderOptions);
    }
    const runtime = this.wasmV2Runtime;
    const hw = this.hardware;
    runtime.exports.zx8081Configure(hw.hardwareZx81 ? 1 : 0, hw.romZx81 ? 1 : 0, hw.ramKb, hw.ntsc ? 1 : 0);
    const rom = await this.loadRomFromResource(hw.romZx81 ? ZX81_ROM : ZX80_ROM);
    fillCoreBytes(runtime, runtime.rom, 0);
    writeCoreBytes(runtime, runtime.rom, rom.subarray(0, runtime.rom.length));
    const words = runtime.exports.zx8081GetScreenWidth() * runtime.exports.zx8081GetScreenHeight();
    this.screenPixels = runtime.pixelBuffer.subarray(0, words);
    this.screenPixelBytes = runtime.pixelBufferBytes.subarray(0, words * 4);
    this.setTactsInFrame(runtime.exports.zx8081GetTactsInFrame());
    runtime.exports.zx8081HardReset();
    this.syncTapeFromProperties(runtime);
    this.syncCpuFromWasmV2(runtime);
  }

  /** Power on: the RAM cleared and every register reset */
  override hardReset(): void {
    super.hardReset();
    this.reset();
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      runtime.exports.zx8081HardReset();
      this.syncTapeFromProperties(runtime);
      this.syncCpuFromWasmV2(runtime);
    }
  }

  override reset(): void {
    super.reset();
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      this.syncTargetClockMultiplier(runtime);
      runtime.exports.zx8081Reset();
      this.syncTapeFromProperties(runtime);
      this.syncCpuFromWasmV2(runtime);
    }
  }

  override setMachineProperty(key: string, value?: any): void {
    super.setMachineProperty(key, value);
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return;
    switch (key) {
      case MEDIA_TAPE:
        this.uploadTape(runtime, value);
        break;
      case FAST_LOAD:
        runtime.exports.zx8081TapeSetFastLoad(value ? 1 : 0);
        break;
      case REWIND_REQUESTED:
        if (value === true || value === undefined) runtime.exports.zx8081TapeRewind();
        break;
    }
  }

  override getCpuState(): CpuState {
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      this.syncCpuFromWasmV2(runtime);
      this.importBusAccess(runtime);
    }
    return super.getCpuState();
  }

  // ==========================================================================================
  // Tape

  /**
   * Puts a program file in the deck: its tape bytes go to the core, which plays them when the ROM's
   * LOAD runs (automatic motor control) or reads them through the fast-load traps. Anything that is
   * not a ZX80/ZX81 program file (a Spectrum tape) empties the deck.
   */
  private uploadTape(runtime: Zx8081WasmV2Runtime, value: unknown): void {
    if (!isProgramFile(value)) {
      runtime.exports.zx8081TapeSetLength(0);
      runtime.exports.zx8081TapeSetPlaying(0);
      return;
    }
    const bytes = value.tapeBytes;
    if (bytes.length > runtime.tapeData.length) {
      throw new Error(`The program is too large for the tape: ${bytes.length} bytes.`);
    }
    writeCoreBytes(runtime, runtime.tapeData, bytes);
    runtime.exports.zx8081TapeSetLength(bytes.length);
    runtime.exports.zx8081TapeSetPlaying(1);
  }

  private syncTapeFromProperties(runtime: Zx8081WasmV2Runtime): void {
    const fast = this.getMachineProperty(FAST_LOAD);
    runtime.exports.zx8081TapeSetFastLoad(fast === undefined || fast ? 1 : 0);
    this.uploadTape(runtime, this.getMachineProperty(MEDIA_TAPE));
  }

  protected armAutoRun(): void {
    this.wasmV2Runtime?.exports.zx8081ArmAutoRun(1);
  }

  /** Types RUN once the ROM has finished a load the tape-load flow started */
  private checkAutoRun(runtime: Zx8081WasmV2Runtime): void {
    // --- Taken in a reverse-debugging replay too, but not typed: the live run typed it already, and
    // --- the journal replays those keys (REVERSE_DEBUGGING_PLAN D13)
    if (runtime.exports.zx8081TakeAutoRunHit() !== 0 && !this.executionContext.isReplayingHistory?.()) {
      this.typeText(ZX8081_RUN_COMMAND, AUTO_RUN_DELAY_FRAMES);
    }
  }

  // ==========================================================================================
  // Running

  override executeMachineFrame(): FrameTerminationMode {
    const runtime = this.requireWasmV2Runtime();
    if (
      this.executionContext.debugStepMode !== DebugStepMode.NoDebug ||
      this.executionContext.frameTerminationMode !== FrameTerminationMode.Normal
    ) {
      return this.executeDebugLoop(runtime);
    }
    this.emulateKeystroke();
    this.syncTargetClockMultiplier(runtime);
    runtime.exports.zx8081ExecuteFrame();
    this.syncFrameCounters(runtime);
    this.checkAutoRun(runtime);
    // --- A reverse-debugging stop target can end the call mid-frame (REVERSE_DEBUGGING_PLAN D4)
    this.frameCompleted = runtime.exports.zx8081GetFrameCompleted() !== 0;
    this.executionContext.lastTerminationReason = FrameTerminationMode.Normal;
    return FrameTerminationMode.Normal;
  }

  /** The debug path, as the Z88's: one instruction at a time, or on to the next candidate stop */
  private debugLoopHost?: { runtime: Zx8081WasmV2Runtime; host: WasmDebugLoopHost };

  private executeDebugLoop(runtime: Zx8081WasmV2Runtime): FrameTerminationMode {
    if (this.debugLoopHost?.runtime !== runtime) {
      this.debugLoopHost = { runtime, host: this.createDebugLoopHost(runtime) };
    }
    return runWasmDebugLoop(this.debugLoopHost.host);
  }

  private createDebugLoopHost(runtime: Zx8081WasmV2Runtime): WasmDebugLoopHost {
    const wasm = runtime.exports;
    const self = this;
    return {
      get executionContext() {
        return self.executionContext;
      },
      get frameCompleted() {
        return self.frameCompleted;
      },
      set frameCompleted(value: boolean) {
        self.frameCompleted = value;
      },
      get pc() {
        return self.pc;
      },
      get stepOutAddress() {
        return self.stepOutAddress;
      },
      getFrameCommand: () => this.getFrameCommand(),
      enter: () => {
        if (this.frameCompleted) {
          this.frameCompleted = false;
        }
        this.syncCpuFromWasmV2(runtime);
        this.emulateKeystroke();
        this.syncTargetClockMultiplier(runtime);
        return undefined;
      },
      // --- The instruction export returns whether the frame completed
      executeInstruction: () => wasm.zx8081ExecuteInstruction() !== 0,
      // --- The core's own loop runs to the next place the stop policy may stop at (z80-debug-loop.c)
      executeUntilStop: (extraStop, mask) => wasm.zx8081ExecuteUntilStop(extraStop, mask),
      pushBreakpointFlags: (flags) => runtime.breakpointFlags.set(flags),
      coreFrameCompleted: () => wasm.zx8081GetFrameCompleted() !== 0,
      // --- Past this class's `pc` setter, which would push the value just read from the core back into it
      mirrorPc: () => {
        const pc = wasm.zx8081GetCpuPc();
        this.setPcMirror(pc);
        return pc;
      },
      historyStopReached: () => wasm.z80HistoryCheckStop() !== 0,
      importBusAccess: () => this.importBusAccess(runtime),
      hasAccessBreakpoint: () => this.hasAccessBreakpoint(),
      shouldStopAtBreakpoint: (instructionsExecuted) => this.shouldStopAtBreakpoint(instructionsExecuted),
      onFrameEnd: () => this.checkAutoRun(runtime),
      finish: (termination) => this.finishDebugLoop(termination)
    };
  }

  private finishDebugLoop(termination: FrameTerminationMode): FrameTerminationMode {
    const runtime = this.requireWasmV2Runtime();
    this.syncCpuFromWasmV2(runtime);
    this.importBusAccess(runtime);
    this.executionContext.lastTerminationReason = termination;
    return termination;
  }

  override getInterruptDepth(): number {
    return this.w ? this.w.zx8081GetInterruptDepth() : super.getInterruptDepth();
  }

  override markStepOutAddress(): void {
    this.stepOutAddress = stepOutAddressFromCore(this.requireWasmV2Runtime().exports.zx8081GetStepOutAddress());
  }

  private shouldStopAtBreakpoint(instructionsExecuted: number): boolean {
    return shouldStopAtWasmBreakpoint(
      this,
      instructionsExecuted,
      () => this.sp,
      () => ({ af: this.af, bc: this.bc, de: this.de, hl: this.hl })
    );
  }

  private hasAccessBreakpoint(): boolean {
    return hasWasmAccessBreakpoint(
      this.executionContext.debugSupport,
      this,
      (address) => this.getPartition(address),
      this.lastMemoryReadValues,
      this.lastMemoryWriteValues
    );
  }

  /** The shared core's data-access log and last port event, into the fields `Z80Cpu` keeps */
  private importBusAccess(runtime: Zx8081WasmV2Runtime): void {
    const wasm = runtime.exports;
    this.lastIoReadPort = undefined;
    this.lastIoWritePort = undefined;
    importAccessLog(this, runtime.accessLog, wasm.zx8081GetAccessLogCount());
    const portAddress = wasm.zx8081GetLastPortAddress();
    const portValue = wasm.zx8081GetLastPortValue();
    if (wasm.zx8081GetLastPortIsWrite() !== 0) {
      this.lastIoWritePort = portAddress;
      this.lastIoWriteValue = portValue;
    } else if (portAddress !== 0 || portValue !== 0) {
      this.lastIoReadPort = portAddress;
      this.lastIoReadValue = portValue;
    }
  }

  // ==========================================================================================
  // Memory and ports

  override doReadMemory(address: number): number {
    return this.requireWasmV2Runtime().exports.zx8081ReadMemory(address & 0xffff);
  }

  override doWriteMemory(address: number, value: number): void {
    this.requireWasmV2Runtime().exports.zx8081WriteMemory(address & 0xffff, value & 0xff);
  }

  /** The 64K the CPU sees, through the memory map (mirrors included) */
  get64KFlatMemory(): Uint8Array {
    const wasm = this.requireWasmV2Runtime().exports;
    const flat = new Uint8Array(0x1_0000);
    for (let address = 0; address < 0x1_0000; address++) flat[address] = wasm.zx8081ReadMemory(address);
    return flat;
  }

  override doReadPort(address: number): number {
    return this.requireWasmV2Runtime().exports.zx8081ReadPort(address & 0xffff);
  }

  override doWritePort(address: number, value: number): void {
    this.requireWasmV2Runtime().exports.zx8081WritePort(address & 0xffff, value & 0xff);
  }

  // ==========================================================================================
  // Keyboard and screen

  setKeyStatus(key: number, isDown: boolean): void {
    this.requireWasmV2Runtime().exports.zx8081SetKeyStatus(key, isDown ? 1 : 0);
  }

  get screenWidthInPixels(): number {
    return this.requireWasmV2Runtime().exports.zx8081GetScreenWidth();
  }

  get screenHeightInPixels(): number {
    return this.requireWasmV2Runtime().exports.zx8081GetScreenHeight();
  }

  /** The last complete TV frame (the core publishes one at each frame sync) */
  getPixelBuffer(): Uint32Array {
    this.requireWasmV2Runtime();
    return this.screenPixels!;
  }

  getPixelBufferBytes(): Uint8ClampedArray {
    this.requireWasmV2Runtime();
    return this.screenPixelBytes!;
  }

  renderInstantScreen(_savedPixelBuffer?: Uint32Array): Uint32Array {
    return this.getPixelBuffer();
  }

  /** The TV around the picture: the frame's own white border reaches the edge */
  getScreenSurroundColor(): number {
    return 0xffffffff;
  }

  /**
   * Captures the machine's whole state: the core's memory image plus this wrapper's own fields
   * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.5). The machine must be paused.
   */
  saveMachineState(): MachineStateParts {
    const runtime = this.requireWasmV2Runtime();
    return {
      ...captureWasmImage("zx8081", runtime.module, runtime.exports.memory.buffer),
      host: this.captureHostState()
    };
  }

  // ------------------------------------------------------------------------------------------------
  // Reverse debugging (`.plans/REVERSE_DEBUGGING_PLAN.md` §4.2, `reverse/Timeline.ts`)

  /** The core, as the export contract names it */
  get reverseCoreId(): string {
    return "zx8081";
  }

  get reverseRuntime(): Zx8081WasmV2Runtime | undefined {
    return this.wasmV2Runtime;
  }

  readonly reverseFrameExport = "zx8081ExecuteFrame";

  isAtFrameBoundary(): boolean {
    return this.wasmV2Runtime?.exports.zx8081GetFrameCompleted() !== 0;
  }

  /** The wrapper keeps no state of its own a keyframe needs: the core holds it all */
  captureHostState(): Record<string, unknown> {
    return {};
  }

  /**
   * After the core changed under the wrapper (a replay, a return to the present, T7): the mirrors
   * re-read from the core, nothing pushed, queued keystrokes of the replaced run dropped
   */
  restoreHostState(_state: unknown): void {
    const runtime = this.requireWasmV2Runtime();
    this.emulatedKeyStrokes.length = 0;
    this.frameCompleted = runtime.exports.zx8081GetFrameCompleted() !== 0;
    this.syncFrameCounters(runtime);
    this.syncCpuFromWasmV2(runtime);
  }

  /**
   * Puts the machine back into a saved state; the host-side caches are invalidated so the next
   * frame pushes the live host's settings. Queued work of the run being replaced is dropped.
   * @throws MachineStateMismatchError when the state was saved by another core or layout
   */
  loadMachineState(parts: MachineStateParts): void {
    const runtime = this.requireWasmV2Runtime();
    restoreWasmImage(parts, "zx8081", runtime.module, runtime.exports.memory.buffer);
    this.syncedTargetClockMultiplier = -1;
    this.syncCpuFromWasmV2(runtime);
  }


  getConditionStore(): ConditionStore | undefined {
    return this.wasmV2Runtime ? conditionStoreOf(this.wasmV2Runtime) : undefined;
  }

  // ==========================================================================================
  // Helpers

  /** Forgets what was last pushed into the core, so the next frame pushes the live state (D8) */
  invalidateHostSync(): void {
    this.syncedTargetClockMultiplier = -1;
  }

  private syncTargetClockMultiplier(runtime: Zx8081WasmV2Runtime): void {
    if (this.targetClockMultiplier !== this.syncedTargetClockMultiplier) {
      runtime.exports.zx8081SetTargetClockMultiplier(this.targetClockMultiplier);
      this.syncedTargetClockMultiplier = this.targetClockMultiplier;
    }
  }

  private syncCpuFromWasmV2(runtime: Zx8081WasmV2Runtime): void {
    const w = runtime.exports;
    super.af = w.zx8081GetCpuAf();
    super.bc = w.zx8081GetCpuBc();
    super.de = w.zx8081GetCpuDe();
    super.hl = w.zx8081GetCpuHl();
    super.af_ = w.zx8081GetCpuAfAlt();
    super.bc_ = w.zx8081GetCpuBcAlt();
    super.de_ = w.zx8081GetCpuDeAlt();
    super.hl_ = w.zx8081GetCpuHlAlt();
    super.ix = w.zx8081GetCpuIx();
    super.iy = w.zx8081GetCpuIy();
    super.ir = w.zx8081GetCpuIr();
    super.wz = w.zx8081GetCpuWz();
    super.pc = w.zx8081GetCpuPc();
    super.sp = w.zx8081GetCpuSp();
    super.iff1 = w.zx8081GetCpuIff1() !== 0;
    super.iff2 = w.zx8081GetCpuIff2() !== 0;
    super.interruptMode = w.zx8081GetCpuInterruptMode();
    this.halted = w.zx8081GetCpuHalted() !== 0;
    this.opCode = w.zx8081GetCpuOpCode();
    this.syncFrameCounters(runtime);
  }

  private syncFrameCounters(runtime: Zx8081WasmV2Runtime): void {
    const w = runtime.exports;
    super.pc = w.zx8081GetCpuPc();
    this.tacts = w.zx8081GetTacts();
    this.frames = w.zx8081GetFrames();
    this.clockMultiplier = w.zx8081GetClockMultiplier();
    this.tactsInCurrentFrame = w.zx8081GetTactsInCurrentFrame();
    this.frameTacts = w.zx8081GetFrameTacts();
    this.currentFrameTact = Math.floor(this.frameTacts / this.clockMultiplier);
    this.opStartAddress = w.zx8081GetOpStartAddress();
    this.sigINT = w.zx8081GetCpuSigInt() !== 0;
  }

  private requireWasmV2Runtime(): Zx8081WasmV2Runtime {
    if (this.wasmV2Runtime == null) {
      throw new Error("The ZX80/ZX81 WASM core is not loaded; call setup() first.");
    }
    return this.wasmV2Runtime;
  }
}
