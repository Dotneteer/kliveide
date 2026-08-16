import type { MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";
import type { ZxNextWasmV2LoaderOptions, ZxNextWasmV2Runtime } from "./wasm/ZxNextWasmV2Loader";

import { MC_MEM_SIZE } from "@common/machines/constants";
import { loadZxNextWasmV2 } from "./wasm/ZxNextWasmV2Loader";
import {
  OFFS_ALT_ROM_0,
  OFFS_ALT_ROM_1,
  OFFS_DIVMMC_RAM,
  OFFS_DIVMMC_ROM,
  OFFS_MULTIFACE_MEM,
  OFFS_NEXT_RAM,
  OFFS_NEXT_ROM
} from "./MemoryDevice";
import { ZxNextMachine } from "./ZxNextMachine";

const ZXNEXT_ROM_RESOURCES = [
  { kind: 0, filename: "roms/enNextZX.rom", offset: OFFS_NEXT_ROM },
  { kind: 1, filename: "roms/enNxtmmc.rom", offset: OFFS_DIVMMC_ROM },
  { kind: 2, filename: "roms/enNextMf.rom", offset: OFFS_MULTIFACE_MEM },
  { kind: 3, filename: "roms/enAltZX.rom", offset: OFFS_ALT_ROM_0 }
] as const;

export type ZxNextWasmV2Diagnostics = {
  backend: "wasm";
  engine: "v2";
  artifactName: string;
  frames: number;
  tacts: number;
  hardResets: number;
  resets: number;
  romUploads: number;
  uploadedRomMask: number;
  cpuInstructionsExecuted: number;
  z80nMode: boolean;
  cpuPc: number;
  cpuSp: number;
  sramSize: number;
  romSize: number;
  configuredMemorySizeKb: number;
  mainRamPages: number;
  activeMemorySize: number;
  sentinelOffset: number;
  port7ffd: number;
  portDffd: number;
  port1ffd: number;
  portEff7: number;
  selectedRomPage: number;
  selectedRamBank: number;
  allRamMode: boolean;
  specialConfig: number;
  useShadowScreen: boolean;
  pagingEnabled: boolean;
};

/**
 * Minimal full-machine WASM v2 adapter skeleton for the ZX Spectrum Next.
 */
export class ZxNextWasmV2Machine extends ZxNextMachine {
  public readonly implementation = "wasm" as const;
  public wasmV2Runtime?: ZxNextWasmV2Runtime;
  private readonly wasmV2RomBytes = new Map<number, Uint8Array>();

  constructor(
    public readonly requestedModelInfo?: MachineModel,
    messenger?: MessengerBase,
    private readonly wasmV2LoaderOptions?: ZxNextWasmV2LoaderOptions
  ) {
    super(requestedModelInfo, messenger);
  }

  override async setup(): Promise<void> {
    this.wasmV2Runtime = await loadZxNextWasmV2(this.wasmV2LoaderOptions);
    const runtime = this.requireWasmV2Runtime();

    for (const resource of ZXNEXT_ROM_RESOURCES) {
      const bytes = await this.loadRomFromFile(resource.filename);
      this.wasmV2RomBytes.set(resource.kind, bytes);
      this.memoryDevice.upload(bytes, resource.offset);
    }

    this.configureWasmV2MemorySize(runtime);
    runtime.exports.zxnextHardReset();
    this.replayRomBytesToWasmV2(runtime);
  }

  override hardReset(): void {
    super.hardReset();
    if (this.wasmV2Runtime != null) {
      this.wasmV2Runtime.exports.zxnextHardReset();
      this.replayRomBytesToWasmV2(this.wasmV2Runtime);
    }
  }

  override reset(): void {
    super.reset();
    if (this.wasmV2Runtime != null) {
      this.wasmV2Runtime.exports.zxnextReset();
      this.replayRomBytesToWasmV2(this.wasmV2Runtime);
    }
  }

  getWasmV2Diagnostics(): ZxNextWasmV2Diagnostics {
    const runtime = this.requireWasmV2Runtime();
    return {
      backend: "wasm",
      engine: "v2",
      artifactName: runtime.artifactName,
      frames: runtime.exports.zxnextGetFrames(),
      tacts: runtime.exports.zxnextGetTacts(),
      hardResets: runtime.exports.zxnextGetHardResetCount(),
      resets: runtime.exports.zxnextGetResetCount(),
      romUploads: runtime.exports.zxnextGetRomUploadCount(),
      uploadedRomMask: runtime.exports.zxnextGetUploadedRomMask(),
      cpuInstructionsExecuted: runtime.exports.zxnextGetCpuInstructionsExecuted(),
      z80nMode: runtime.exports.zxnextGetZ80NMode() !== 0,
      cpuPc: runtime.exports.zxnextGetCpuPc(),
      cpuSp: runtime.exports.zxnextGetCpuSp(),
      sramSize: runtime.exports.zxnextGetSramSize(),
      romSize: runtime.exports.zxnextGetRomSize(),
      configuredMemorySizeKb: runtime.exports.zxnextGetConfiguredMemorySizeKb(),
      mainRamPages: runtime.exports.zxnextGetMainRamPageCount(),
      activeMemorySize: runtime.exports.zxnextGetActiveMemorySize(),
      sentinelOffset: runtime.exports.zxnextGetSentinelOffset(),
      port7ffd: runtime.exports.zxnextGetPort7ffdValue(),
      portDffd: runtime.exports.zxnextGetPortDffdValue(),
      port1ffd: runtime.exports.zxnextGetPort1ffdValue(),
      portEff7: runtime.exports.zxnextGetPortEff7Value(),
      selectedRomPage: runtime.exports.zxnextGetSelectedRomPage(),
      selectedRamBank: runtime.exports.zxnextGetSelectedRamBank(),
      allRamMode: runtime.exports.zxnextGetAllRamMode() !== 0,
      specialConfig: runtime.exports.zxnextGetSpecialConfig(),
      useShadowScreen: runtime.exports.zxnextGetUseShadowScreen() !== 0,
      pagingEnabled: runtime.exports.zxnextGetPagingEnabled() !== 0
    };
  }

  override readScreenMemory(offset: number): number {
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return super.readScreenMemory(offset);
    return runtime.exports.zxnextReadMemory(0x4000 + (offset & 0x3fff));
  }

  override get64KFlatMemory(): Uint8Array {
    return this.wasmV2Runtime?.memory ?? super.get64KFlatMemory();
  }

  override getMemoryPartition(index: number): Uint8Array {
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return super.getMemoryPartition(index);
    const wasm = runtime.exports;
    if (index >= 0 && index < wasm.zxnextGetMainRamPageCount()) {
      return this.readWasmV2PhysicalSlice(runtime, OFFS_NEXT_RAM + index * 0x2000, 0x2000);
    }
    switch (index) {
      case -1:
      case -2:
      case -3:
      case -4:
        return this.readWasmV2PhysicalSlice(runtime, OFFS_NEXT_ROM + (-index - 1) * 0x4000, 0x4000);
      case -5:
        return this.readWasmV2PhysicalSlice(runtime, OFFS_ALT_ROM_0, 0x4000);
      case -6:
        return this.readWasmV2PhysicalSlice(runtime, OFFS_ALT_ROM_1, 0x4000);
      case -7:
        return this.readWasmV2PhysicalSlice(runtime, OFFS_DIVMMC_ROM, 0x2000);
      default:
        if (index >= -23 && index <= -8) {
          return this.readWasmV2PhysicalSlice(runtime, OFFS_DIVMMC_RAM + (-index - 8) * 0x2000, 0x2000);
        }
        return this.readWasmV2PhysicalSlice(runtime, wasm.zxnextGetSentinelOffset(), 0x2000);
    }
  }

  override getCurrentPartitions(): number[] {
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return super.getCurrentPartitions();
    const wasm = runtime.exports;
    return Array.from({ length: 8 }, (_, index) => wasm.zxnextGetCurrentPartition(index));
  }

  override getPartition(address: number): number | undefined {
    return this.getCurrentPartitions()[(address >>> 13) & 0x07];
  }

  override getSelectedRomPage(): number {
    return this.wasmV2Runtime?.exports.zxnextGetSelectedRomPage() ?? super.getSelectedRomPage();
  }

  override getSelectedRamBank(): number {
    return this.wasmV2Runtime?.exports.zxnextGetSelectedRamBank() ?? super.getSelectedRamBank();
  }

  override doReadMemory(address: number): number {
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return super.doReadMemory(address);
    const value = runtime.exports.zxnextReadMemory(address & 0xffff);
    this.importWasmV2BusAccess(runtime);
    return value;
  }

  override doWriteMemory(address: number, value: number): void {
    const runtime = this.wasmV2Runtime;
    if (runtime == null) {
      super.doWriteMemory(address, value);
      return;
    }
    runtime.exports.zxnextWriteMemory(address & 0xffff, value & 0xff);
    this.importWasmV2BusAccess(runtime);
  }

  override doWritePort(address: number, value: number): void {
    super.doWritePort(address, value);
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return;
    runtime.exports.zxnextWritePort(address & 0xffff, value & 0xff);
    this.importWasmV2BusAccess(runtime);
  }

  override tbblueOut(address: number, value: number): void {
    super.tbblueOut(address, value);
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return;
    runtime.exports.zxnextWriteNextReg(address & 0xff, value & 0xff);
  }

  override getCpuState(): any {
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      this.syncCpuFromWasmV2(runtime);
      this.importWasmV2BusAccess(runtime);
    }
    return super.getCpuState();
  }

  private replayRomBytesToWasmV2(runtime: ZxNextWasmV2Runtime): void {
    for (const [kind, bytes] of this.wasmV2RomBytes) {
      for (let offset = 0; offset < bytes.length; offset++) {
        if (runtime.exports.zxnextUploadRomByte(kind, offset, bytes[offset]) === 0) {
          throw new Error(`ZX Spectrum Next WASM v2 ROM upload failed for kind ${kind} at ${offset}.`);
        }
      }
    }
  }

  private configureWasmV2MemorySize(runtime: ZxNextWasmV2Runtime): void {
    const configured = this.requestedModelInfo?.config?.[MC_MEM_SIZE];
    if (typeof configured !== "number") return;
    runtime.exports.zxnextConfigureMemorySize(configured);
  }

  private readWasmV2PhysicalSlice(runtime: ZxNextWasmV2Runtime, offset: number, length: number): Uint8Array {
    const result = new Uint8Array(length);
    const wasm = runtime.exports;
    for (let i = 0; i < length; i++) {
      result[i] = wasm.zxnextReadPhysical(offset + i);
    }
    return result;
  }

  private requireWasmV2Runtime(): ZxNextWasmV2Runtime {
    if (this.wasmV2Runtime == null) {
      throw new Error("ZX Spectrum Next WASM v2 runtime has not been loaded.");
    }
    return this.wasmV2Runtime;
  }

  private syncCpuFromWasmV2(runtime: ZxNextWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.af = wasm.zxnextGetCpuAf();
    this.bc = wasm.zxnextGetCpuBc();
    this.de = wasm.zxnextGetCpuDe();
    this.hl = wasm.zxnextGetCpuHl();
    this.af_ = wasm.zxnextGetCpuAfAlt();
    this.bc_ = wasm.zxnextGetCpuBcAlt();
    this.de_ = wasm.zxnextGetCpuDeAlt();
    this.hl_ = wasm.zxnextGetCpuHlAlt();
    this.ix = wasm.zxnextGetCpuIx();
    this.iy = wasm.zxnextGetCpuIy();
    this.ir = wasm.zxnextGetCpuIr();
    this.wz = wasm.zxnextGetCpuWz();
    this.pc = wasm.zxnextGetCpuPc();
    this.sp = wasm.zxnextGetCpuSp();
    this.tacts = wasm.zxnextGetTacts();
    this.halted = wasm.zxnextGetCpuHalted() !== 0;
    this.iff1 = wasm.zxnextGetCpuIff1() !== 0;
    this.iff2 = wasm.zxnextGetCpuIff2() !== 0;
    this.interruptMode = wasm.zxnextGetCpuInterruptMode();
    this.opCode = wasm.zxnextGetCpuPrefix();
  }

  private importWasmV2BusAccess(runtime: ZxNextWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.lastMemoryReadsCount = 0;
    if (wasm.zxnextGetLastMemoryIsWrite() !== 0) {
      this.lastMemoryWrites[0] = wasm.zxnextGetLastMemoryAddress();
      this.lastMemoryWriteValue = wasm.zxnextGetLastMemoryValue();
    } else {
      this.lastMemoryReads[0] = wasm.zxnextGetLastMemoryAddress();
      this.lastMemoryReadValue = wasm.zxnextGetLastMemoryValue();
      this.lastMemoryReadsCount = wasm.zxnextGetLastMemoryAddress() !== 0 || wasm.zxnextGetLastMemoryValue() !== 0 ? 1 : 0;
    }
    if (wasm.zxnextGetLastPortIsWrite() !== 0) {
      this.lastIoWritePort = wasm.zxnextGetLastPortAddress();
      this.lastIoWriteValue = wasm.zxnextGetLastPortValue();
    } else {
      this.lastIoReadPort = wasm.zxnextGetLastPortAddress();
      this.lastIoReadValue = wasm.zxnextGetLastPortValue();
    }
  }
}
