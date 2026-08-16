import type { MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";
import type { ZxNextWasmV2LoaderOptions, ZxNextWasmV2Runtime } from "./wasm/ZxNextWasmV2Loader";

import { loadZxNextWasmV2 } from "./wasm/ZxNextWasmV2Loader";
import { OFFS_ALT_ROM_0, OFFS_DIVMMC_ROM, OFFS_MULTIFACE_MEM, OFFS_NEXT_ROM } from "./MemoryDevice";
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
  cpuPc: number;
  cpuSp: number;
  sramSize: number;
  romSize: number;
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
      cpuPc: runtime.exports.zxnextGetCpuPc(),
      cpuSp: runtime.exports.zxnextGetCpuSp(),
      sramSize: runtime.exports.zxnextGetSramSize(),
      romSize: runtime.exports.zxnextGetRomSize()
    };
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

  private requireWasmV2Runtime(): ZxNextWasmV2Runtime {
    if (this.wasmV2Runtime == null) {
      throw new Error("ZX Spectrum Next WASM v2 runtime has not been loaded.");
    }
    return this.wasmV2Runtime;
  }
}
