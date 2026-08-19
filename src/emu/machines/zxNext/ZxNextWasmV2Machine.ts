import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { CpuState, UlaState } from "@common/messaging/EmuApi";
import type { MessengerBase } from "@common/messaging/MessengerBase";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import type { NextRegDescriptor, NextRegDeviceState, RegValueState } from "./NextRegDevice";
import type { ZxNextWasmV2LoaderOptions, ZxNextWasmV2Runtime } from "./wasm/ZxNextWasmV2Loader";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MemorySectionType } from "@abstractions/MemorySection";
import { loadZxNextWasmV2 } from "./wasm/ZxNextWasmV2Loader";
import { ZxNextMachine } from "./ZxNextMachine";

export type ZxNextWasmV2ScaffoldSurface =
  | "registers"
  | "memory"
  | "disassembly"
  | "ULA"
  | "screen"
  | "frame"
  | "debug";

export type ZxNextWasmV2ScaffoldStopReason =
  | "scaffoldReset"
  | "scaffoldFrameComplete"
  | "scaffoldDebugStep";

export const ZXNEXT_WASM_V2_SCAFFOLD_SURFACES: ZxNextWasmV2ScaffoldSurface[] = [
  "registers",
  "memory",
  "disassembly",
  "ULA",
  "screen",
  "frame",
  "debug"
];

export type ZxNextWasmV2Diagnostics = {
  backend: "wasm";
  engine: "v2";
  artifactName: string;
  implementationIncomplete: true;
  scaffoldSurfaces: ZxNextWasmV2ScaffoldSurface[];
  memoryBytes: number;
  flatMemoryBytes: number;
  screenWidth: number;
  screenHeight: number;
  frames: number;
  tacts: number;
  tactsInFrame: number;
  currentFrameTact: number;
  frameCompleted: boolean;
  normalFrames: number;
  debugSteps: number;
  lastScaffoldStopReason: ZxNextWasmV2ScaffoldStopReason;
  diagnosticFlags: number;
};

const ZXNEXT_WASM_PARTITIONS = [-1, -1, 10, 11, 4, 5, 0, 1];
const ZXNEXT_WASM_PARTITION_LABELS = ["R0", "R0", "0A", "0B", "04", "05", "00", "01"];

/**
 * Explicit ZX Spectrum Next WASM v2 adapter.
 *
 * This is a deterministic scaffold for IDE integration only. It intentionally
 * reports every exposed surface as incomplete until full Next subsystems move
 * into the C/WASM backend.
 */
export class ZxNextWasmV2Machine extends ZxNextMachine {
  public readonly implementation = "wasm" as const;
  public wasmV2Runtime?: ZxNextWasmV2Runtime;
  public readonly screenDevice: {
    readonly renderingTactTable: { phase: number }[];
    readonly borderColor: number;
  };
  public readonly tapeDevice: {
    readonly micBit: boolean;
  };
  public readonly floatingBusDevice: {
    readFloatingBus: () => number;
  };

  private wasmV2NormalFrames = 0;
  private wasmV2DebugSteps = 0;
  private wasmV2LastScaffoldStopReason: ZxNextWasmV2ScaffoldStopReason = "scaffoldReset";
  private readonly nextRegDescriptors = this.createNextRegDescriptors();

  constructor(
    public readonly requestedModelInfo?: MachineModel,
    public readonly requestedConfig?: MachineConfigSet,
    messenger?: MessengerBase,
    private readonly wasmV2LoaderOptions?: ZxNextWasmV2LoaderOptions
  ) {
    super(requestedModelInfo, messenger);
    const wasmSelf = this;
    this.screenDevice = {
      renderingTactTable: [{ phase: 0 }],
      get borderColor() {
        return wasmSelf.wasmV2Runtime?.exports.zxnextGetBorderColor() ?? 0;
      }
    };
    this.tapeDevice = {
      get micBit() {
        return wasmSelf.wasmV2Runtime?.exports.zxnextGetMicBit() !== 0;
      }
    };
    this.floatingBusDevice = {
      readFloatingBus: () => 0xff
    };
    this.installNextRegScaffold();
    this.installMemoryMappingScaffold();
  }

  override get a(): number {
    return super.a;
  }

  override set a(value: number) {
    super.a = value;
    this.syncWasmV2AfFromFacade();
  }

  override get f(): number {
    return super.f;
  }

  override set f(value: number) {
    super.f = value;
    this.syncWasmV2AfFromFacade();
  }

  override get af(): number {
    return super.af;
  }

  override set af(value: number) {
    super.af = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuAf(super.af);
  }

  override get b(): number {
    return super.b;
  }

  override set b(value: number) {
    super.b = value;
    this.syncWasmV2BcFromFacade();
  }

  override get c(): number {
    return super.c;
  }

  override set c(value: number) {
    super.c = value;
    this.syncWasmV2BcFromFacade();
  }

  override get bc(): number {
    return super.bc;
  }

  override set bc(value: number) {
    super.bc = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuBc(super.bc);
  }

  override get d(): number {
    return super.d;
  }

  override set d(value: number) {
    super.d = value;
    this.syncWasmV2DeFromFacade();
  }

  override get e(): number {
    return super.e;
  }

  override set e(value: number) {
    super.e = value;
    this.syncWasmV2DeFromFacade();
  }

  override get de(): number {
    return super.de;
  }

  override set de(value: number) {
    super.de = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuDe(super.de);
  }

  override get h(): number {
    return super.h;
  }

  override set h(value: number) {
    super.h = value;
    this.syncWasmV2HlFromFacade();
  }

  override get l(): number {
    return super.l;
  }

  override set l(value: number) {
    super.l = value;
    this.syncWasmV2HlFromFacade();
  }

  override get hl(): number {
    return super.hl;
  }

  override set hl(value: number) {
    super.hl = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuHl(super.hl);
  }

  override get af_(): number {
    return super.af_;
  }

  override set af_(value: number) {
    super.af_ = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuAfAlt(super.af_);
  }

  override get bc_(): number {
    return super.bc_;
  }

  override set bc_(value: number) {
    super.bc_ = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuBcAlt(super.bc_);
  }

  override get de_(): number {
    return super.de_;
  }

  override set de_(value: number) {
    super.de_ = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuDeAlt(super.de_);
  }

  override get hl_(): number {
    return super.hl_;
  }

  override set hl_(value: number) {
    super.hl_ = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuHlAlt(super.hl_);
  }

  override get xh(): number {
    return super.xh;
  }

  override set xh(value: number) {
    super.xh = value;
    this.syncWasmV2IxFromFacade();
  }

  override get xl(): number {
    return super.xl;
  }

  override set xl(value: number) {
    super.xl = value;
    this.syncWasmV2IxFromFacade();
  }

  override get ix(): number {
    return super.ix;
  }

  override set ix(value: number) {
    super.ix = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuIx(super.ix);
  }

  override get yh(): number {
    return super.yh;
  }

  override set yh(value: number) {
    super.yh = value;
    this.syncWasmV2IyFromFacade();
  }

  override get yl(): number {
    return super.yl;
  }

  override set yl(value: number) {
    super.yl = value;
    this.syncWasmV2IyFromFacade();
  }

  override get iy(): number {
    return super.iy;
  }

  override set iy(value: number) {
    super.iy = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuIy(super.iy);
  }

  override get i(): number {
    return super.i;
  }

  override set i(value: number) {
    super.i = value;
    this.syncWasmV2IrFromFacade();
  }

  override get r(): number {
    return super.r;
  }

  override set r(value: number) {
    super.r = value;
    this.syncWasmV2IrFromFacade();
  }

  override get ir(): number {
    return super.ir;
  }

  override set ir(value: number) {
    super.ir = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuIr(super.ir);
  }

  override get wz(): number {
    return super.wz;
  }

  override set wz(value: number) {
    super.wz = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuWz(super.wz);
  }

  override get pc(): number {
    return super.pc;
  }

  override set pc(value: number) {
    super.pc = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuPc(super.pc);
  }

  override get sp(): number {
    return super.sp;
  }

  override set sp(value: number) {
    super.sp = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuSp(super.sp);
  }

  override async setup(): Promise<void> {
    this.wasmV2Runtime = await loadZxNextWasmV2(this.wasmV2LoaderOptions);
    this.hardResetWasmV2(this.wasmV2Runtime);
    this.syncCpuFromWasmV2(this.wasmV2Runtime);
  }

  override hardReset(): void {
    super.hardReset();
    if (this.wasmV2Runtime != null) {
      this.hardResetWasmV2(this.wasmV2Runtime);
      this.syncCpuFromWasmV2(this.wasmV2Runtime);
    }
  }

  override reset(): void {
    super.reset();
    if (this.wasmV2Runtime != null) {
      this.wasmV2Runtime.exports.zxnextReset();
      this.wasmV2NormalFrames = 0;
      this.wasmV2DebugSteps = 0;
      this.wasmV2LastScaffoldStopReason = "scaffoldReset";
      this.syncCpuFromWasmV2(this.wasmV2Runtime);
    }
  }

  override executeMachineFrame(): FrameTerminationMode {
    const runtime = this.wasmV2Runtime;
    if (runtime == null) {
      return super.executeMachineFrame();
    }

    if (
      this.executionContext.debugStepMode !== DebugStepMode.NoDebug ||
      this.executionContext.frameTerminationMode !== FrameTerminationMode.Normal
    ) {
      return this.executeWasmV2DebugStep();
    }

    this.emulateKeystroke();
    runtime.exports.zxnextExecuteFrame();
    this.wasmV2NormalFrames++;
    this.syncCpuFromWasmV2(runtime);
    this.frameCompleted = runtime.exports.zxnextGetFrameCompleted() !== 0;
    this.wasmV2LastScaffoldStopReason = "scaffoldFrameComplete";
    this.executionContext.lastTerminationReason = FrameTerminationMode.Normal;
    return FrameTerminationMode.Normal;
  }

  executeWasmV2DebugStep(): FrameTerminationMode {
    const runtime = this.requireWasmV2Runtime();
    runtime.exports.zxnextExecuteInstruction();
    this.wasmV2DebugSteps++;
    this.syncCpuFromWasmV2(runtime);
    this.frameCompleted = runtime.exports.zxnextGetFrameCompleted() !== 0;
    this.wasmV2LastScaffoldStopReason = "scaffoldDebugStep";
    this.executionContext.lastTerminationReason = FrameTerminationMode.DebugEvent;
    return FrameTerminationMode.DebugEvent;
  }

  override readScreenMemory(offset: number): number {
    return this.requireWasmV2Runtime().exports.zxnextReadScreenMemoryOffset(offset & 0x3fff);
  }

  override get64KFlatMemory(): Uint8Array {
    return this.requireWasmV2Runtime().flatMemory;
  }

  override getMemoryPartition(index: number): Uint8Array {
    const runtime = this.requireWasmV2Runtime();
    if (index < 0) {
      return runtime.memory.subarray(0, 0x4000);
    }
    const offset = 0x040000 + ((index & 0xdf) << 14);
    return runtime.memory.subarray(offset, offset + 0x4000);
  }

  override getCurrentPartitions(): number[] {
    return ZXNEXT_WASM_PARTITIONS.slice();
  }

  override getSelectedRomPage(): number {
    return 0;
  }

  override getSelectedRamBank(): number {
    return 0;
  }

  override getCurrentPartitionLabels(): string[] {
    return ZXNEXT_WASM_PARTITION_LABELS.slice();
  }

  override getPartition(address: number): number | undefined {
    return ZXNEXT_WASM_PARTITIONS[(address >>> 13) & 0x07];
  }

  override getRomFlags(): boolean[] {
    return [true, true, false, false, false, false, false, false];
  }

  override get isOsInitialized(): boolean {
    return false;
  }

  override doReadMemory(address: number): number {
    const runtime = this.requireWasmV2Runtime();
    const value = runtime.exports.zxnextReadMemory(address & 0xffff);
    this.importWasmV2BusAccess(runtime);
    return value;
  }

  override doWriteMemory(address: number, value: number): void {
    const runtime = this.requireWasmV2Runtime();
    runtime.exports.zxnextWriteMemory(address & 0xffff, value & 0xff);
    this.importWasmV2BusAccess(runtime);
  }

  override doReadPort(address: number): number {
    const runtime = this.requireWasmV2Runtime();
    const value = runtime.exports.zxnextReadPort(address & 0xffff);
    this.importWasmV2BusAccess(runtime);
    return value;
  }

  override doWritePort(address: number, value: number): void {
    const runtime = this.requireWasmV2Runtime();
    runtime.exports.zxnextWritePort(address & 0xffff, value & 0xff);
    this.importWasmV2BusAccess(runtime);
  }

  override tbblueOut(address: number, value: number): void {
    const runtime = this.requireWasmV2Runtime();
    runtime.exports.zxnextSetNextRegisterIndex(address & 0xff);
    runtime.exports.zxnextSetNextRegisterValue(value & 0xff);
  }

  override setKeyStatus(key: number, isDown: boolean): void {
    super.setKeyStatus(key, isDown);
    this.wasmV2Runtime?.exports.zxnextSetKeyStatus(key & 0xff, isDown ? 1 : 0);
  }

  override setTacts(value: number): void {
    super.setTacts(value);
    if (this.wasmV2Runtime != null) {
      this.wasmV2Runtime.exports.zxnextSetTacts(value >>> 0);
      this.syncCpuFromWasmV2(this.wasmV2Runtime);
    }
  }

  override get screenWidthInPixels(): number {
    return this.requireWasmV2Runtime().exports.zxnextGetScreenWidth();
  }

  override get screenHeightInPixels(): number {
    return this.requireWasmV2Runtime().exports.zxnextGetScreenHeight();
  }

  override getAspectRatio(): [number, number] {
    return [5, 4];
  }

  override getPixelBuffer(): Uint32Array {
    return this.requireWasmV2Runtime().pixelBuffer;
  }

  getPixelBufferBytes(): Uint8ClampedArray {
    return this.requireWasmV2Runtime().pixelBufferBytes;
  }

  override renderInstantScreen(savedPixelBuffer?: Uint32Array): Uint32Array {
    const runtime = this.requireWasmV2Runtime();
    const snapshot = new Uint32Array(runtime.pixelBuffer);
    if (savedPixelBuffer != null) {
      runtime.pixelBuffer.set(savedPixelBuffer.subarray(0, runtime.pixelBuffer.length));
    } else {
      runtime.exports.zxnextRenderInstantScreen();
    }
    return snapshot;
  }

  override getBufferStartOffset(): number {
    return this.requireWasmV2Runtime().exports.zxnextGetPixelBufferStartOffset();
  }

  override getAudioSamples(): AudioSample[] {
    return [];
  }

  override getCpuState(): CpuState {
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      this.syncCpuFromWasmV2(runtime);
      this.importWasmV2BusAccess(runtime);
    }
    return super.getCpuState();
  }

  override getDisassemblySections(options: Record<string, any>) {
    const sections = super.getDisassemblySections(options);
    if (sections.length > 0) return sections;
    return [{
      startAddress: 0x0000,
      endAddress: 0xffff,
      sectionType: MemorySectionType.Disassemble
    }];
  }

  getWasmV2UlaState(): UlaState {
    const runtime = this.requireWasmV2Runtime();
    return {
      fcl: runtime.exports.zxnextGetFrameCompleted() !== 0,
      frm: runtime.exports.zxnextGetFrames(),
      ras: 0,
      pos: runtime.exports.zxnextGetCurrentFrameTact(),
      pix: 0,
      bor: runtime.exports.zxnextGetBorderColor(),
      flo: 0xff,
      con: 0,
      lco: 0,
      ear: runtime.exports.zxnextGetEarBit() !== 0,
      mic: runtime.exports.zxnextGetMicBit() !== 0,
      keyLines: Array.from(runtime.keyboardLines),
      romP: this.getSelectedRomPage(),
      ramB: this.getSelectedRamBank()
    };
  }

  getWasmV2Diagnostics(): ZxNextWasmV2Diagnostics {
    const runtime = this.requireWasmV2Runtime();
    return {
      backend: "wasm",
      engine: "v2",
      artifactName: runtime.artifactName,
      implementationIncomplete: true,
      scaffoldSurfaces: ZXNEXT_WASM_V2_SCAFFOLD_SURFACES.slice(),
      memoryBytes: runtime.exports.zxnextGetMemorySize(),
      flatMemoryBytes: runtime.exports.zxnextGetFlatMemorySize(),
      screenWidth: runtime.exports.zxnextGetScreenWidth(),
      screenHeight: runtime.exports.zxnextGetScreenHeight(),
      frames: runtime.exports.zxnextGetFrames(),
      tacts: runtime.exports.zxnextGetTacts(),
      tactsInFrame: runtime.exports.zxnextGetTactsInFrame(),
      currentFrameTact: runtime.exports.zxnextGetCurrentFrameTact(),
      frameCompleted: runtime.exports.zxnextGetFrameCompleted() !== 0,
      normalFrames: this.wasmV2NormalFrames,
      debugSteps: this.wasmV2DebugSteps,
      lastScaffoldStopReason: this.wasmV2LastScaffoldStopReason,
      diagnosticFlags: runtime.exports.zxnextGetDiagnosticFlags()
    };
  }

  private hardResetWasmV2(runtime: ZxNextWasmV2Runtime): void {
    runtime.exports.zxnextHardReset();
    this.wasmV2NormalFrames = 0;
    this.wasmV2DebugSteps = 0;
    this.wasmV2LastScaffoldStopReason = "scaffoldReset";
  }

  private installNextRegScaffold(): void {
    this.nextRegDevice.setNextRegisterIndex = (reg: number) => {
      this.requireWasmV2Runtime().exports.zxnextSetNextRegisterIndex(reg & 0xff);
    };
    this.nextRegDevice.getNextRegisterIndex = () => (
      this.requireWasmV2Runtime().exports.zxnextGetNextRegisterIndex()
    );
    this.nextRegDevice.setNextRegisterValue = (value: number) => {
      this.requireWasmV2Runtime().exports.zxnextSetNextRegisterValue(value & 0xff);
    };
    this.nextRegDevice.getNextRegisterValue = () => (
      this.requireWasmV2Runtime().exports.zxnextGetNextRegisterValue()
    );
    this.nextRegDevice.getDescriptors = () => this.nextRegDescriptors;
    this.nextRegDevice.getNextRegDeviceState = () => this.getWasmNextRegDeviceState();
  }

  private installMemoryMappingScaffold(): void {
    this.memoryDevice.getMemoryMappings = () => ({
      allRamBanks: undefined,
      selectedRom: 0,
      selectedBank: 0,
      port7ffd: 0,
      port1ffd: 0,
      portDffd: 0,
      portEff7: 0,
      portLayer2: 0,
      portTimex: 0,
      divMmc: 0,
      divMmcIn: false,
      pageInfo: ZXNEXT_WASM_PARTITIONS.map((partition, pageIndex) => ({
        readOffset: pageIndex * 0x2000,
        writeOffset: partition < 0 ? null : pageIndex * 0x2000,
        bank16k: partition < 0 ? 0xff : partition,
        bank8k: partition < 0 ? 0xff : partition
      }))
    });
  }

  private createNextRegDescriptors(): NextRegDescriptor[] {
    const descriptors: NextRegDescriptor[] = [];
    for (let id = 0; id < 0x100; id++) {
      descriptors.push({
        id,
        description: `WASM scaffold NextReg $${id.toString(16).padStart(2, "0").toUpperCase()}`
      });
    }
    return descriptors;
  }

  private getWasmNextRegDeviceState(): NextRegDeviceState {
    const runtime = this.requireWasmV2Runtime();
    const regs: RegValueState[] = [];
    for (let id = 0; id < runtime.nextRegs.length; id++) {
      regs.push({
        id,
        lastWrite: runtime.nextRegs[id],
        value: runtime.nextRegs[id]
      });
    }
    return {
      lastRegisterIndex: runtime.exports.zxnextGetNextRegisterIndex(),
      regs
    };
  }

  private syncCpuFromWasmV2(runtime: ZxNextWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.af = wasm.zxnextGetCpuAf();
    this.af_ = wasm.zxnextGetCpuAfAlt();
    this.bc = wasm.zxnextGetCpuBc();
    this.bc_ = wasm.zxnextGetCpuBcAlt();
    this.de = wasm.zxnextGetCpuDe();
    this.de_ = wasm.zxnextGetCpuDeAlt();
    this.hl = wasm.zxnextGetCpuHl();
    this.hl_ = wasm.zxnextGetCpuHlAlt();
    this.ix = wasm.zxnextGetCpuIx();
    this.iy = wasm.zxnextGetCpuIy();
    this.ir = wasm.zxnextGetCpuIr();
    this.wz = wasm.zxnextGetCpuWz();
    this.pc = wasm.zxnextGetCpuPc();
    this.sp = wasm.zxnextGetCpuSp();
    this.tacts = wasm.zxnextGetTacts();
    this.frames = wasm.zxnextGetFrames();
    this.frameTacts = wasm.zxnextGetCurrentFrameTact();
    this.currentFrameTact = this.frameTacts;
    this.tactsInCurrentFrame = wasm.zxnextGetTactsInFrame();
    this.frameCompleted = wasm.zxnextGetFrameCompleted() !== 0;
    this.halted = wasm.zxnextGetCpuHalted() !== 0;
    this.opCode = wasm.zxnextGetCpuPrefix();
    this.iff1 = wasm.zxnextGetCpuIff1() !== 0;
    this.iff2 = wasm.zxnextGetCpuIff2() !== 0;
    this.interruptMode = wasm.zxnextGetCpuInterruptMode();
  }

  private importWasmV2BusAccess(runtime: ZxNextWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.lastMemoryReadsCount = 0;
    this.lastMemoryWritesCount = 0;
    this.lastIoReadPort = undefined;
    this.lastIoWritePort = undefined;

    const memoryAddress = wasm.zxnextGetLastMemoryAddress();
    const memoryValue = wasm.zxnextGetLastMemoryValue();
    if (wasm.zxnextGetLastMemoryIsWrite() !== 0) {
      this.lastMemoryWrites[this.lastMemoryWritesCount++] = memoryAddress;
      this.lastMemoryWriteValue = memoryValue;
    } else if (memoryAddress !== 0 || memoryValue !== 0) {
      this.lastMemoryReads[this.lastMemoryReadsCount++] = memoryAddress;
      this.lastMemoryReadValue = memoryValue;
    }

    const portAddress = wasm.zxnextGetLastPortAddress();
    const portValue = wasm.zxnextGetLastPortValue();
    if (wasm.zxnextGetLastPortIsWrite() !== 0) {
      this.lastIoWritePort = portAddress;
      this.lastIoWriteValue = portValue;
    } else if (portAddress !== 0 || portValue !== 0) {
      this.lastIoReadPort = portAddress;
      this.lastIoReadValue = portValue;
    }
  }

  private syncWasmV2AfFromFacade(): void {
    this.wasmV2Runtime?.exports.zxnextSetCpuAf(super.af);
  }

  private syncWasmV2BcFromFacade(): void {
    this.wasmV2Runtime?.exports.zxnextSetCpuBc(super.bc);
  }

  private syncWasmV2DeFromFacade(): void {
    this.wasmV2Runtime?.exports.zxnextSetCpuDe(super.de);
  }

  private syncWasmV2HlFromFacade(): void {
    this.wasmV2Runtime?.exports.zxnextSetCpuHl(super.hl);
  }

  private syncWasmV2IxFromFacade(): void {
    this.wasmV2Runtime?.exports.zxnextSetCpuIx(super.ix);
  }

  private syncWasmV2IyFromFacade(): void {
    this.wasmV2Runtime?.exports.zxnextSetCpuIy(super.iy);
  }

  private syncWasmV2IrFromFacade(): void {
    this.wasmV2Runtime?.exports.zxnextSetCpuIr(super.ir);
  }

  private requireWasmV2Runtime(): ZxNextWasmV2Runtime {
    if (this.wasmV2Runtime == null) {
      throw new Error("ZX Spectrum Next WASM v2 runtime is not loaded.");
    }
    return this.wasmV2Runtime;
  }
}
