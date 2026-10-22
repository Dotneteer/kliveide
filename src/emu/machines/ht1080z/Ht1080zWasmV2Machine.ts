import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";
import type { CpuState } from "@common/messaging/EmuApi";
import type { Ht1080zWasmV2LoaderOptions, Ht1080zWasmV2Runtime } from "./wasm/Ht1080zWasmV2Loader";

import { conditionStoreOf, type ConditionStore } from "../conditionStore";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import {
  hasWasmAccessBreakpoint,
  runWasmDebugLoop,
  type WasmDebugLoopHost,
  shouldStopAtWasmBreakpoint,
  stepOutAddressFromCore
} from "../wasmDebugLoop";
import { importAccessLog } from "../wasmAccessLog";
import { fillCoreBytes, writeCoreBytes } from "@emu/machines/reverse/coreMemoryWrites";
import { loadHt1080zWasmV2 } from "./wasm/Ht1080zWasmV2Loader";
import { Ht1080zWasmHost } from "./Ht1080zWasmHost";
import { HT1080Z_ROM_SETS } from "./Ht1080zRoms";
import { HT1080Z_PIXEL_ASPECT } from "./ht1080zMachineInfo";
import { HT_VIDEO_CUT, HT_VIDEO_DASH, HT_VIDEO_PAGE } from "../machine-props";

/** The model numbers `ht1080zConfigure` takes */
const CORE_MODEL = { s1: 0, s2: 1, s64: 2 } as const;

/**
 * An HT-1080Z on the WASM core (`wasm/ht1080z/`, `.plans/HT1080Z_PLAN.md`): one core for every
 * model, configured by the model at setup.
 *
 * The registers are read live from the core and every write is pushed into it; the debugger runs
 * instruction by instruction, or - when the stop policy can only stop at known addresses - the core
 * runs on to the next candidate, exactly as on the ZX80/ZX81.
 *
 * Execution history, the access profile, reverse debugging and state files come with Phase 8 of the
 * plan; the core already carries the shared recorder and profile module.
 */
export class Ht1080zWasmV2Machine extends Ht1080zWasmHost {
  public readonly implementation = "wasm" as const;
  public wasmV2Runtime?: Ht1080zWasmV2Runtime;

  private screenPixels?: Uint32Array;
  private screenPixelBytes?: Uint8ClampedArray;
  private syncedTargetClockMultiplier = -1;

  constructor(
    machineId: string,
    modelInfo?: MachineModel,
    config?: MachineConfigSet,
    messenger?: MessengerBase,
    private readonly wasmV2LoaderOptions?: Ht1080zWasmV2LoaderOptions
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
    return this.w ? this.w.ht1080zGetCpuAf() : super.af;
  }
  override set af(value: number) {
    super.af = value;
    this.w?.ht1080zSetCpuAf(super.af);
  }
  override get bc(): number {
    return this.w ? this.w.ht1080zGetCpuBc() : super.bc;
  }
  override set bc(value: number) {
    super.bc = value;
    this.w?.ht1080zSetCpuBc(super.bc);
  }
  override get de(): number {
    return this.w ? this.w.ht1080zGetCpuDe() : super.de;
  }
  override set de(value: number) {
    super.de = value;
    this.w?.ht1080zSetCpuDe(super.de);
  }
  override get hl(): number {
    return this.w ? this.w.ht1080zGetCpuHl() : super.hl;
  }
  override set hl(value: number) {
    super.hl = value;
    this.w?.ht1080zSetCpuHl(super.hl);
  }
  override get af_(): number {
    return this.w ? this.w.ht1080zGetCpuAfAlt() : super.af_;
  }
  override set af_(value: number) {
    super.af_ = value;
    this.w?.ht1080zSetCpuAfAlt(super.af_);
  }
  override get bc_(): number {
    return this.w ? this.w.ht1080zGetCpuBcAlt() : super.bc_;
  }
  override set bc_(value: number) {
    super.bc_ = value;
    this.w?.ht1080zSetCpuBcAlt(super.bc_);
  }
  override get de_(): number {
    return this.w ? this.w.ht1080zGetCpuDeAlt() : super.de_;
  }
  override set de_(value: number) {
    super.de_ = value;
    this.w?.ht1080zSetCpuDeAlt(super.de_);
  }
  override get hl_(): number {
    return this.w ? this.w.ht1080zGetCpuHlAlt() : super.hl_;
  }
  override set hl_(value: number) {
    super.hl_ = value;
    this.w?.ht1080zSetCpuHlAlt(super.hl_);
  }
  override get ix(): number {
    return this.w ? this.w.ht1080zGetCpuIx() : super.ix;
  }
  override set ix(value: number) {
    super.ix = value;
    this.w?.ht1080zSetCpuIx(super.ix);
  }
  override get iy(): number {
    return this.w ? this.w.ht1080zGetCpuIy() : super.iy;
  }
  override set iy(value: number) {
    super.iy = value;
    this.w?.ht1080zSetCpuIy(super.iy);
  }
  override get ir(): number {
    return this.w ? this.w.ht1080zGetCpuIr() : super.ir;
  }
  override set ir(value: number) {
    super.ir = value;
    this.w?.ht1080zSetCpuIr(super.ir);
  }
  override get wz(): number {
    return this.w ? this.w.ht1080zGetCpuWz() : super.wz;
  }
  override set wz(value: number) {
    super.wz = value;
    this.w?.ht1080zSetCpuWz(super.wz);
  }
  override get pc(): number {
    return this.w ? this.w.ht1080zGetCpuPc() : super.pc;
  }
  override set pc(value: number) {
    super.pc = value;
    this.w?.ht1080zSetCpuPc(super.pc);
  }
  override get sp(): number {
    return this.w ? this.w.ht1080zGetCpuSp() : super.sp;
  }
  override set sp(value: number) {
    super.sp = value;
    this.w?.ht1080zSetCpuSp(super.sp);
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
    return this.w ? this.w.ht1080zGetCpuIff1() !== 0 : super.iff1;
  }
  override set iff1(value: boolean) {
    super.iff1 = value;
    this.w?.ht1080zSetCpuIff1(value ? 1 : 0);
  }
  override get iff2(): boolean {
    return this.w ? this.w.ht1080zGetCpuIff2() !== 0 : super.iff2;
  }
  override set iff2(value: boolean) {
    super.iff2 = value;
    this.w?.ht1080zSetCpuIff2(value ? 1 : 0);
  }
  override get interruptMode(): number {
    return this.w ? this.w.ht1080zGetCpuInterruptMode() : super.interruptMode;
  }
  override set interruptMode(value: number) {
    super.interruptMode = value;
    this.w?.ht1080zSetCpuInterruptMode(value);
  }

  override setTacts(value: number): void {
    super.setTacts(value);
    this.w?.ht1080zSetTacts(value >>> 0);
  }

  // ==========================================================================================
  // Lifecycle

  /** Loads the core (once), configures the model, uploads its ROMs and powers the machine on */
  async setup(): Promise<void> {
    if (this.wasmV2Runtime == null) {
      this.wasmV2Runtime = await loadHt1080zWasmV2(this.wasmV2LoaderOptions);
    }
    const runtime = this.wasmV2Runtime;
    const hw = this.hardware;
    runtime.exports.ht1080zConfigure(CORE_MODEL[hw.romSet], hw.ramKb);
    const romSet = HT1080Z_ROM_SETS[hw.romSet];
    const basic = await this.loadRomFromResource(romSet.basic.name);
    const extension = await this.loadRomFromResource(romSet.extension.name);
    const chargen = await this.loadRomFromResource(romSet.chargen.name);
    fillCoreBytes(runtime, runtime.rom, 0xff);
    writeCoreBytes(runtime, runtime.rom, basic.subarray(0, romSet.basic.size));
    writeCoreBytes(runtime, runtime.rom, extension.subarray(0, romSet.extension.size), romSet.basic.size);
    fillCoreBytes(runtime, runtime.chargen, 0);
    writeCoreBytes(runtime, runtime.chargen, chargen.subarray(0, runtime.chargen.length));
    const words = runtime.exports.ht1080zGetScreenWidth() * runtime.exports.ht1080zGetScreenHeight();
    this.screenPixels = runtime.pixelBuffer.subarray(0, words);
    this.screenPixelBytes = runtime.pixelBufferBytes.subarray(0, words * 4);
    this.baseClockFrequency = runtime.exports.ht1080zGetBaseClockFrequency();
    this.setTactsInFrame(runtime.exports.ht1080zGetTactsInFrame());
    runtime.exports.ht1080zHardReset();
    this.syncVideoControls(runtime);
    this.syncCpuFromWasmV2(runtime);
  }

  /** Power on: the RAM cleared and every register reset */
  override hardReset(): void {
    super.hardReset();
    this.reset();
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      runtime.exports.ht1080zHardReset();
      this.syncCpuFromWasmV2(runtime);
    }
  }

  override reset(): void {
    super.reset();
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      this.syncTargetClockMultiplier(runtime);
      runtime.exports.ht1080zReset();
      this.syncCpuFromWasmV2(runtime);
    }
  }

  /**
   * The RESET key on the back panel: an NMI to $0066, which returns to READY with the memory kept
   * (HARDWARE.md §2, §10). Not the IDE's reset, which is a power-on.
   */
  pressResetKey(): void {
    this.requireWasmV2Runtime().exports.ht1080zPressResetKey();
  }

  override setMachineProperty(key: string, value?: any): void {
    super.setMachineProperty(key, value);
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return;
    switch (key) {
      case HT_VIDEO_CUT:
      case HT_VIDEO_PAGE:
      case HT_VIDEO_DASH:
        this.syncVideoControls(runtime);
        break;
    }
  }

  /**
   * The video switches, from the machine properties (D7: the dash is on unless turned off). They are
   * switches on the machine, not ports, so a reset keeps them.
   */
  private syncVideoControls(runtime: Ht1080zWasmV2Runtime): void {
    const w = runtime.exports;
    w.ht1080zSetVideoCut(this.getMachineProperty(HT_VIDEO_CUT) ? 1 : 0);
    w.ht1080zSetVideoPage(this.getMachineProperty(HT_VIDEO_PAGE) ? 1 : 0);
    w.ht1080zSetVideoDash(this.getMachineProperty(HT_VIDEO_DASH) === false ? 0 : 1);
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
    runtime.exports.ht1080zExecuteFrame();
    this.syncFrameCounters(runtime);
    this.frameCompleted = runtime.exports.ht1080zGetFrameCompleted() !== 0;
    this.executionContext.lastTerminationReason = FrameTerminationMode.Normal;
    return FrameTerminationMode.Normal;
  }

  /** The debug path, as the Z88's: one instruction at a time, or on to the next candidate stop */
  private debugLoopHost?: { runtime: Ht1080zWasmV2Runtime; host: WasmDebugLoopHost };

  private executeDebugLoop(runtime: Ht1080zWasmV2Runtime): FrameTerminationMode {
    if (this.debugLoopHost?.runtime !== runtime) {
      this.debugLoopHost = { runtime, host: this.createDebugLoopHost(runtime) };
    }
    return runWasmDebugLoop(this.debugLoopHost.host);
  }

  private createDebugLoopHost(runtime: Ht1080zWasmV2Runtime): WasmDebugLoopHost {
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
      executeInstruction: () => wasm.ht1080zExecuteInstruction() !== 0,
      // --- The core's own loop runs to the next place the stop policy may stop at (z80-debug-loop.c)
      executeUntilStop: (extraStop, mask, accessMask) => wasm.ht1080zExecuteUntilStop(extraStop, mask, accessMask),
      lastOpStart: () => wasm.ht1080zGetDebugOpStart(),
      pushBreakpointFlags: (flags) => runtime.breakpointFlags.set(flags),
      conditionPlan: () => runtime.condPlan,
      coreFrameCompleted: () => wasm.ht1080zGetFrameCompleted() !== 0,
      // --- Past this class's `pc` setter, which would push the value just read from the core back into it
      mirrorPc: () => {
        const pc = wasm.ht1080zGetCpuPc();
        this.setPcMirror(pc);
        return pc;
      },
      historyStopReached: () => wasm.z80HistoryCheckStop() !== 0,
      importBusAccess: () => this.importBusAccess(runtime),
      hasAccessBreakpoint: () => this.hasAccessBreakpoint(),
      shouldStopAtBreakpoint: (instructionsExecuted) => this.shouldStopAtBreakpoint(instructionsExecuted),
      onFrameEnd: () => {},
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
    return this.w ? this.w.ht1080zGetInterruptDepth() : super.getInterruptDepth();
  }

  override markStepOutAddress(): void {
    this.stepOutAddress = stepOutAddressFromCore(this.requireWasmV2Runtime().exports.ht1080zGetStepOutAddress());
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
  private importBusAccess(runtime: Ht1080zWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.lastIoReadPort = undefined;
    this.lastIoWritePort = undefined;
    importAccessLog(this, runtime.accessLog, wasm.ht1080zGetAccessLogCount());
    const portAddress = wasm.ht1080zGetLastPortAddress();
    const portValue = wasm.ht1080zGetLastPortValue();
    if (wasm.ht1080zGetLastPortIsWrite() !== 0) {
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
    return this.requireWasmV2Runtime().exports.ht1080zReadMemory(address & 0xffff);
  }

  override doWriteMemory(address: number, value: number): void {
    this.requireWasmV2Runtime().exports.ht1080zWriteMemory(address & 0xffff, value & 0xff);
  }

  /** The ROMs as one page at `-1`: the BASIC and the extension, $0000-$37FF */
  protected override getRomPartitionImages(): Map<number, Uint8Array> {
    return new Map([[-1, this.get64KFlatMemory().slice(0, 0x3800)]]);
  }

  /** The 64K the CPU sees, through the memory map (the keyboard reads as the CPU would read it) */
  get64KFlatMemory(): Uint8Array {
    const wasm = this.requireWasmV2Runtime().exports;
    const flat = new Uint8Array(0x1_0000);
    for (let address = 0; address < 0x1_0000; address++) flat[address] = wasm.ht1080zReadMemory(address);
    return flat;
  }

  override doReadPort(address: number): number {
    return this.requireWasmV2Runtime().exports.ht1080zReadPort(address & 0xffff);
  }

  override doWritePort(address: number, value: number): void {
    this.requireWasmV2Runtime().exports.ht1080zWritePort(address & 0xffff, value & 0xff);
  }

  // ==========================================================================================
  // Keyboard and screen

  setKeyStatus(key: number, isDown: boolean): void {
    this.requireWasmV2Runtime().exports.ht1080zSetKeyStatus(key, isDown ? 1 : 0);
  }

  get screenWidthInPixels(): number {
    return this.requireWasmV2Runtime().exports.ht1080zGetScreenWidth();
  }

  get screenHeightInPixels(): number {
    return this.requireWasmV2Runtime().exports.ht1080zGetScreenHeight();
  }

  /** HT dots are narrower than they are tall (D6) */
  getAspectRatio = (): [number, number] => [HT1080Z_PIXEL_ASPECT, 1];

  /**
   * The picture. The core draws straight into it as the beam goes, so between frames it holds the
   * last complete frame, and on a machine paused mid-frame the new frame down to the beam
   * (`renderInstantScreen` draws up to it) over the rest of the previous one.
   */
  getPixelBuffer(): Uint32Array {
    this.requireWasmV2Runtime();
    return this.screenPixels!;
  }

  getPixelBufferBytes(): Uint8ClampedArray {
    this.requireWasmV2Runtime();
    return this.screenPixelBytes!;
  }

  renderInstantScreen(_savedPixelBuffer?: Uint32Array): Uint32Array {
    // --- Drawing is output only: the catch-up renderer would draw the same slots the same way later
    this.requireWasmV2Runtime().exports.ht1080zRenderToBeam();
    return this.getPixelBuffer();
  }

  getConditionStore(): ConditionStore | undefined {
    return this.wasmV2Runtime ? conditionStoreOf(this.wasmV2Runtime) : undefined;
  }

  // ==========================================================================================
  // Helpers

  /** Forgets what was last pushed into the core, so the next frame pushes the live state */
  invalidateHostSync(): void {
    this.syncedTargetClockMultiplier = -1;
  }

  private syncTargetClockMultiplier(runtime: Ht1080zWasmV2Runtime): void {
    if (this.targetClockMultiplier !== this.syncedTargetClockMultiplier) {
      runtime.exports.ht1080zSetTargetClockMultiplier(this.targetClockMultiplier);
      this.syncedTargetClockMultiplier = this.targetClockMultiplier;
    }
  }

  private syncCpuFromWasmV2(runtime: Ht1080zWasmV2Runtime): void {
    const w = runtime.exports;
    super.af = w.ht1080zGetCpuAf();
    super.bc = w.ht1080zGetCpuBc();
    super.de = w.ht1080zGetCpuDe();
    super.hl = w.ht1080zGetCpuHl();
    super.af_ = w.ht1080zGetCpuAfAlt();
    super.bc_ = w.ht1080zGetCpuBcAlt();
    super.de_ = w.ht1080zGetCpuDeAlt();
    super.hl_ = w.ht1080zGetCpuHlAlt();
    super.ix = w.ht1080zGetCpuIx();
    super.iy = w.ht1080zGetCpuIy();
    super.ir = w.ht1080zGetCpuIr();
    super.wz = w.ht1080zGetCpuWz();
    super.pc = w.ht1080zGetCpuPc();
    super.sp = w.ht1080zGetCpuSp();
    super.iff1 = w.ht1080zGetCpuIff1() !== 0;
    super.iff2 = w.ht1080zGetCpuIff2() !== 0;
    super.interruptMode = w.ht1080zGetCpuInterruptMode();
    this.halted = w.ht1080zGetCpuHalted() !== 0;
    this.opCode = w.ht1080zGetCpuOpCode();
    this.syncFrameCounters(runtime);
  }

  private syncFrameCounters(runtime: Ht1080zWasmV2Runtime): void {
    const w = runtime.exports;
    super.pc = w.ht1080zGetCpuPc();
    this.tacts = w.ht1080zGetTacts();
    this.frames = w.ht1080zGetFrames();
    this.clockMultiplier = w.ht1080zGetClockMultiplier();
    this.tactsInCurrentFrame = w.ht1080zGetTactsInCurrentFrame();
    this.frameTacts = w.ht1080zGetFrameTacts();
    this.currentFrameTact = Math.floor(this.frameTacts / this.clockMultiplier);
    this.opStartAddress = w.ht1080zGetOpStartAddress();
    this.sigINT = false;
  }

  private requireWasmV2Runtime(): Ht1080zWasmV2Runtime {
    if (this.wasmV2Runtime == null) {
      throw new Error("The HT-1080Z WASM core is not loaded; call setup() first.");
    }
    return this.wasmV2Runtime;
  }
}
