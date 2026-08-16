import type { MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";
import type { ZxNextWasmV2LoaderOptions, ZxNextWasmV2Runtime } from "./wasm/ZxNextWasmV2Loader";
import type { NextRegDeviceState } from "./NextRegDevice";

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
  keyboardRowWrites: number;
  ulaBorderColor: number;
  ulaEarBit: boolean;
  ulaMicBit: boolean;
  ulaBeeperEar: boolean;
  ulaBeeperMic: boolean;
  screenRenderingTacts: number;
  screenIntStartTact: number;
  screenIntEndTact: number;
  screenIs60Hz: boolean;
  screenRenderCount: number;
  screenBank: number;
};

/**
 * Minimal full-machine WASM v2 adapter skeleton for the ZX Spectrum Next.
 */
export class ZxNextWasmV2Machine extends ZxNextMachine {
  public readonly implementation = "wasm" as const;
  public wasmV2Runtime?: ZxNextWasmV2Runtime;
  private readonly wasmV2RomBytes = new Map<number, Uint8Array>();
  private readonly wasmV2KeyboardRows = new Uint8Array(8);
  private readonly wasmV2ExtendedKeyRegs = new Uint8Array(3);
  private wasmV2KeyboardRowsValid = false;
  private wasmV2ExtendedKeyRegsValid = false;
  private wasmV2NextRegBridgeAttached = false;

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
    this.invalidateWasmV2InputSync();
    this.replayRomBytesToWasmV2(runtime);
    this.attachWasmV2NextRegBridge(runtime);
  }

  override hardReset(): void {
    super.hardReset();
    if (this.wasmV2Runtime != null) {
      this.wasmV2Runtime.exports.zxnextHardReset();
      this.invalidateWasmV2InputSync();
      this.replayRomBytesToWasmV2(this.wasmV2Runtime);
    }
  }

  override reset(): void {
    super.reset();
    if (this.wasmV2Runtime != null) {
      this.wasmV2Runtime.exports.zxnextReset();
      this.invalidateWasmV2InputSync();
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
      pagingEnabled: runtime.exports.zxnextGetPagingEnabled() !== 0,
      keyboardRowWrites: runtime.exports.zxnextGetKeyboardRowWrites(),
      ulaBorderColor: runtime.exports.zxnextGetUlaBorderColor(),
      ulaEarBit: runtime.exports.zxnextGetUlaEarBit() !== 0,
      ulaMicBit: runtime.exports.zxnextGetUlaMicBit() !== 0,
      ulaBeeperEar: runtime.exports.zxnextGetUlaBeeperEar() !== 0,
      ulaBeeperMic: runtime.exports.zxnextGetUlaBeeperMic() !== 0,
      screenRenderingTacts: runtime.exports.zxnextGetScreenRenderingTacts(),
      screenIntStartTact: runtime.exports.zxnextGetScreenIntStartTact(),
      screenIntEndTact: runtime.exports.zxnextGetScreenIntEndTact(),
      screenIs60Hz: runtime.exports.zxnextGetScreenIs60Hz() !== 0,
      screenRenderCount: runtime.exports.zxnextGetScreenRenderCount(),
      screenBank: runtime.exports.zxnextGetScreenBank()
    };
  }

  override readScreenMemory(offset: number): number {
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return super.readScreenMemory(offset);
    return runtime.exports.zxnextReadScreenMemoryOffset(offset & 0x3fff);
  }

  override get screenWidthInPixels(): number {
    return this.wasmV2Runtime?.exports.zxnextGetScreenWidth() ?? super.screenWidthInPixels;
  }

  override get screenHeightInPixels(): number {
    return this.wasmV2Runtime?.exports.zxnextGetScreenHeight() ?? super.screenHeightInPixels;
  }

  override getPixelBuffer(): Uint32Array {
    return this.wasmV2Runtime?.pixelBuffer ?? super.getPixelBuffer();
  }

  override getPixelBufferBytes(): Uint8ClampedArray {
    const runtime = this.requireWasmV2Runtime();
    return runtime.pixelBufferBytes;
  }

  override renderInstantScreen(savedPixelBuffer?: Uint32Array): Uint32Array {
    const runtime = this.requireWasmV2Runtime();
    const pixels = runtime.pixelBuffer;
    const snapshot = new Uint32Array(pixels);
    if (savedPixelBuffer != null) {
      pixels.set(savedPixelBuffer.subarray(0, pixels.length));
    } else {
      runtime.exports.zxnextRenderInstantScreen();
    }
    return snapshot;
  }

  override getBufferStartOffset(): number {
    return this.wasmV2Runtime == null ? super.getBufferStartOffset() : 0;
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

  override doReadPort(address: number): number {
    const runtime = this.wasmV2Runtime;
    if (runtime == null || !isWasmV2OwnedPort(address)) return super.doReadPort(address);
    if (isWasmV2UlaPort(address)) this.syncKeyboardToWasmV2(runtime);
    if (isWasmV2NextRegPort(address)) this.syncExtendedKeyboardToWasmV2(runtime);
    const value = runtime.exports.zxnextReadPort(address & 0xffff);
    this.importWasmV2BusAccess(runtime);
    return value;
  }

  override tbblueOut(address: number, value: number): void {
    super.tbblueOut(address, value);
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

  private attachWasmV2NextRegBridge(runtime: ZxNextWasmV2Runtime): void {
    if (this.wasmV2NextRegBridgeAttached) return;
    this.wasmV2NextRegBridgeAttached = true;
    const device = this.nextRegDevice;
    const originalSetIndex = device.setNextRegisterIndex.bind(device);
    const originalGetIndex = device.getNextRegisterIndex.bind(device);
    const originalSetValue = device.setNextRegisterValue.bind(device);
    const originalGetValue = device.getNextRegisterValue.bind(device);
    const originalDirectGet = device.directGetRegValue.bind(device);
    const originalDirectSet = device.directSetRegValue.bind(device);
    const originalHardReset = device.hardReset.bind(device);
    const originalReset = device.reset.bind(device);
    const originalGetState = device.getNextRegDeviceState.bind(device);

    device.setNextRegisterIndex = (reg: number): void => {
      originalSetIndex(reg);
      runtime.exports.zxnextSetNextRegIndex(reg & 0xff);
    };
    device.getNextRegisterIndex = (): number => {
      return runtime.exports.zxnextGetNextRegIndex();
    };
    device.setNextRegisterValue = (value: number): void => {
      originalSetValue(value);
      runtime.exports.zxnextWriteNextRegData(value & 0xff);
    };
    device.getNextRegisterValue = (): number => {
      const index = runtime.exports.zxnextGetNextRegIndex();
      originalGetIndex();
      originalGetValue();
      if (isWasmV2ExtendedKeyboardReg(index)) this.syncExtendedKeyboardToWasmV2(runtime);
      return runtime.exports.zxnextReadNextRegData();
    };
    device.directGetRegValue = (reg: number): number => {
      originalDirectGet(reg);
      if (isWasmV2ExtendedKeyboardReg(reg)) this.syncExtendedKeyboardToWasmV2(runtime);
      return runtime.exports.zxnextReadNextReg(reg & 0xff);
    };
    device.directSetRegValue = (reg: number, value: number): void => {
      originalDirectSet(reg, value);
      runtime.exports.zxnextWriteNextReg(reg & 0xff, value & 0xff);
    };
    device.hardReset = (): void => {
      originalHardReset();
      runtime.exports.zxnextNextRegHardReset();
    };
    device.reset = (): void => {
      originalReset();
      runtime.exports.zxnextNextRegReset();
    };
    device.isPortGroupEnabled = (regIndex: number, bit: number): boolean => {
      return runtime.exports.zxnextIsPortGroupEnabled(regIndex & 0x03, bit & 0x07) !== 0;
    };
    device.getNextRegDeviceState = (): NextRegDeviceState => {
      this.syncExtendedKeyboardToWasmV2(runtime);
      const state = originalGetState();
      return {
        lastRegisterIndex: runtime.exports.zxnextGetNextRegIndex(),
        regs: state.regs.map((reg) => ({
          id: reg.id,
          lastWrite: runtime.exports.zxnextGetNextRegHasLastWrite(reg.id) !== 0
            ? runtime.exports.zxnextGetNextRegLastWrite(reg.id)
            : undefined,
          value: reg.value == null ? undefined : runtime.exports.zxnextReadNextReg(reg.id)
        }))
      };
    };
  }

  private readWasmV2PhysicalSlice(runtime: ZxNextWasmV2Runtime, offset: number, length: number): Uint8Array {
    const result = new Uint8Array(length);
    const wasm = runtime.exports;
    for (let i = 0; i < length; i++) {
      result[i] = wasm.zxnextReadPhysical(offset + i);
    }
    return result;
  }

  private invalidateWasmV2InputSync(): void {
    this.wasmV2KeyboardRowsValid = false;
    this.wasmV2ExtendedKeyRegsValid = false;
    this.wasmV2KeyboardRows.fill(0);
    this.wasmV2ExtendedKeyRegs.fill(0);
  }

  private syncKeyboardToWasmV2(runtime: ZxNextWasmV2Runtime): void {
    const wasm = runtime.exports;
    for (let line = 0; line < this.wasmV2KeyboardRows.length; line++) {
      const rowValue = this.keyboardDevice.getKeyLineValue(line) & 0x1f;
      if (this.wasmV2KeyboardRowsValid && this.wasmV2KeyboardRows[line] === rowValue) continue;
      this.wasmV2KeyboardRows[line] = rowValue;
      wasm.zxnextSetKeyboardRow(line, rowValue);
    }
    this.wasmV2KeyboardRowsValid = true;
  }

  private syncExtendedKeyboardToWasmV2(runtime: ZxNextWasmV2Runtime): void {
    const wasm = runtime.exports;
    const keyboard = this.keyboardDevice;
    const values = [
      keyboard.nextRegB0Value & 0xff,
      keyboard.nextRegB1Value & 0xff,
      keyboard.nextRegB2Value & 0xff
    ];
    for (let index = 0; index < values.length; index++) {
      if (this.wasmV2ExtendedKeyRegsValid && this.wasmV2ExtendedKeyRegs[index] === values[index]) continue;
      this.wasmV2ExtendedKeyRegs[index] = values[index];
      wasm.zxnextSetExtendedKeyReg(index, values[index]);
    }
    this.wasmV2ExtendedKeyRegsValid = true;
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

function isWasmV2NextRegPort(address: number): boolean {
  const port = address & 0xffff;
  return port === 0x243b || port === 0x253b;
}

function isWasmV2ExtendedKeyboardReg(reg: number): boolean {
  const maskedReg = reg & 0xff;
  return maskedReg >= 0xb0 && maskedReg <= 0xb2;
}

function isWasmV2UlaPort(address: number): boolean {
  return (address & 0x0001) === 0x0000;
}

function isWasmV2OwnedPort(address: number): boolean {
  return isWasmV2UlaPort(address) || isWasmV2NextRegPort(address);
}
