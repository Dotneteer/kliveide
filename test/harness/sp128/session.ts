import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import { MC_DISK_SUPPORT, MI_SPECTRUM_3E, MI_SPECTRUM_48 } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { ZxSpectrum48WasmV2Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine";
import { ZxSpectrum128WasmV2Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine";
import { ZxSpectrumP3eWasmV2Machine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine";
import { parseSpectrumSnapshot } from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import { writeSpectrumSnapshot } from "@common/spectrum/snapshot/writeSpectrumSnapshot";
import type { SnapshotWriteResult } from "@common/spectrum/snapshot/snapshotBytes";
import type { SpectrumSnapshot, SpectrumSnapshotFormat } from "@common/spectrum/snapshot/spectrumSnapshot";

import { buildSp48Wasm, productionOutput as sp48Output } from "../../../scripts/build-sp48-wasm.cjs";
import { buildSp128Wasm, productionOutput as sp128Output } from "../../../scripts/build-sp128-wasm.cjs";
import { buildSpP3eWasm, productionOutput as spp3eOutput } from "../../../scripts/build-spp3e-wasm.cjs";

/** The real ROMs the app ships (`src/public/roms/`) */
const ROM_DIR = join(__dirname, "../../../src/public/roms");

export type Sp128SessionModel = "sp128" | "nofdd" | "fdd1" | "fdd2";

class HarnessSp128Machine extends ZxSpectrum128WasmV2Machine {
  constructor() {
    super(undefined, {}, {
      artifactName: "harness-sp128-machine-v2.wasm",
      readArtifact: async () => readFileSync(sp128Output)
    });
  }

  protected override async loadRomFromResource(_romName: string, page = 0): Promise<Uint8Array> {
    return new Uint8Array(readFileSync(join(ROM_DIR, `sp128-${page}.rom`)));
  }
}

class HarnessSpp3eMachine extends ZxSpectrumP3eWasmV2Machine {
  constructor(model: MachineModel) {
    super(model, { ...model.config }, {
      artifactName: "harness-spp3e-machine-v2.wasm",
      readArtifact: async () => readFileSync(spp3eOutput)
    });
  }

  protected override async loadRomFromResource(_romName: string, page = 0): Promise<Uint8Array> {
    return new Uint8Array(readFileSync(join(ROM_DIR, `spp3e-${page}.rom`)));
  }
}

const built: Record<string, boolean> = {};

class HarnessSp48Machine extends ZxSpectrum48WasmV2Machine {
  constructor(model: MachineModel | undefined, config: MachineConfigSet) {
    super(model, config, {
      artifactName: "harness-sp48-flow-machine-v2.wasm",
      readArtifact: async () => readFileSync(sp48Output)
    });
  }

  protected override async loadRomFromResource(): Promise<Uint8Array> {
    return new Uint8Array(readFileSync(join(ROM_DIR, "sp48.rom")));
  }
}

/**
 * Creates (and sets up) a ZX Spectrum machine of any of the three types with the real ROMs, for
 * tests that drive a `MachineController` the way `MachineService` does.
 * @param machineId "sp48", "sp128" or "spp3e"
 * @param modelId The registry model ("pal", "ntsc", "pal-16k"; "nofdd", "fdd1", "fdd2")
 */
export async function createHarnessSpectrumMachine(
  machineId: string,
  modelId: string | undefined,
  config: MachineConfigSet = {}
): Promise<ZxSpectrum48WasmV2Machine | ZxSpectrum128WasmV2Machine | ZxSpectrumP3eWasmV2Machine> {
  const info = machineRegistry.find((m) => m.machineId === machineId)?.models?.find((m) => m.modelId === modelId);
  let machine: ZxSpectrum48WasmV2Machine | ZxSpectrum128WasmV2Machine | ZxSpectrumP3eWasmV2Machine;
  if (machineId === MI_SPECTRUM_48) {
    if (!built.sp48) {
      buildSp48Wasm();
      built.sp48 = true;
    }
    machine = new HarnessSp48Machine(info, { ...(info?.config ?? {}), ...config });
  } else if (machineId === MI_SPECTRUM_3E) {
    if (!built.spp3e) {
      buildSpP3eWasm();
      built.spp3e = true;
    }
    machine = new HarnessSpp3eMachine({ ...info!, config: { ...(info?.config ?? {}), ...config } });
  } else {
    if (!built.sp128) {
      buildSp128Wasm();
      built.sp128 = true;
    }
    machine = new HarnessSp128Machine();
  }
  await machine.setup();
  machine.hardReset();
  return machine;
}

/**
 * Creates a ZX Spectrum 128K, or a +2E/+3E of the given model, with the real ROMs. Builds the WASM
 * core first, once per test process.
 */
export async function createSp128Session(model: Sp128SessionModel = "sp128"): Promise<Sp128TestSession> {
  let machine: ZxSpectrum128WasmV2Machine | ZxSpectrumP3eWasmV2Machine;
  if (model === "sp128") {
    if (!built.sp128) {
      buildSp128Wasm();
      built.sp128 = true;
    }
    machine = new HarnessSp128Machine();
  } else {
    if (!built.spp3e) {
      buildSpP3eWasm();
      built.spp3e = true;
    }
    const info = machineRegistry
      .find((m) => m.machineId === MI_SPECTRUM_3E)!
      .models!.find((m) => m.modelId === model)!;
    machine = new HarnessSpp3eMachine({ ...info, config: { ...info.config, [MC_DISK_SUPPORT]: info.config?.[MC_DISK_SUPPORT] } });
  }
  await machine.setup();
  return new Sp128TestSession(machine, model);
}

/**
 * Scripts one real ZX Spectrum 128K or +2E/+3E (the WASM core) from a vitest test: load snapshots,
 * run frames and instructions, read memory, banks, paging, the AY and the screen (see README.md).
 */
export class Sp128TestSession {
  /** Frames completed since the session started */
  frames = 0;

  constructor(
    readonly machine: ZxSpectrum128WasmV2Machine | ZxSpectrumP3eWasmV2Machine,
    readonly model: Sp128SessionModel
  ) {}

  private get exports(): Record<string, (...args: number[]) => number> {
    return this.machine.wasmV2Runtime!.exports as unknown as Record<string, (...args: number[]) => number>;
  }

  private get prefix(): "sp128" | "spp3e" {
    return this.model === "sp128" ? "sp128" : "spp3e";
  }

  private call(name: string, ...args: number[]): number {
    return this.exports[this.prefix + name](...args);
  }

  // ==========================================================================================
  // Loading and running

  /** Parses and loads a snapshot (its extension picks the format); returns the frame tact */
  loadSnapshot(name: string, bytes: Uint8Array): number {
    return this.machine.loadSnapshotState(parseSpectrumSnapshot(name, bytes));
  }

  /** Captures the machine's state as a snapshot model, as saving does (the machine is unchanged) */
  captureSnapshot(): SpectrumSnapshot {
    return this.machine.captureSnapshotState();
  }

  /**
   * Saves the machine as a `.sna` / `.z80` / `.szx` file, as the emulator does (minus the
   * controller): capture, then write. Throws when the format refuses the state.
   */
  saveSnapshot(format: SpectrumSnapshotFormat): SnapshotWriteResult {
    return writeSpectrumSnapshot(this.machine.captureSnapshotState(), format);
  }

  /** Runs whole frames */
  runFrames(count = 1): this {
    for (let i = 0; i < count; i++) {
      const start = this.frames;
      while (this.frames === start) this.execute();
    }
    return this;
  }

  /** Executes single instructions */
  step(count = 1): this {
    const ctx = this.machine.executionContext;
    ctx.debugStepMode = DebugStepMode.StepInto;
    try {
      for (let i = 0; i < count; i++) this.execute();
    } finally {
      ctx.debugStepMode = DebugStepMode.NoDebug;
    }
    return this;
  }

  private execute(): FrameTerminationMode {
    const termination = this.machine.executeMachineFrame();
    if (this.machine.frameJustCompleted) this.frames++;
    return termination;
  }

  // ==========================================================================================
  // State

  /** A byte of the 64K the CPU sees */
  peek(address: number): number {
    return this.machine.doReadMemory(address & 0xffff);
  }

  /** A RAM bank (0-7), as stored */
  bank(index: number): Uint8Array {
    return this.machine.getMemoryPartition(index & 0x07);
  }

  /** The paging state */
  paging(): {
    bank: number;
    rom: number;
    shadowScreen: boolean;
    locked: boolean;
    specialPaging?: boolean;
    diskMotor?: boolean;
  } {
    const result = {
      bank: this.call("GetSelectedBank"),
      rom: this.call("GetSelectedRom"),
      shadowScreen: this.call("GetUseShadowScreen") !== 0,
      locked: this.call("GetPagingEnabled") === 0
    };
    if (this.prefix === "spp3e") {
      return {
        ...result,
        specialPaging: this.call("GetInSpecialPagingMode") !== 0,
        diskMotor: this.call("GetDiskMotorOn") !== 0
      };
    }
    return result;
  }

  /** An AY register, and the selected register */
  psgRegister(index: number): number {
    const selected = this.call("GetPsgRegisterIndex");
    this.call("SetPsgRegisterIndex", index);
    const value = this.call("ReadPsgRegisterValue");
    this.call("SetPsgRegisterIndex", selected);
    return value;
  }

  psgSelected(): number {
    return this.call("GetPsgRegisterIndex");
  }

  /** T-states since the start of the current frame */
  frameTact(): number {
    return this.call("GetCurrentFrameTact");
  }

  /** The border colour */
  border(): number {
    return this.call("GetBorderColor");
  }

  /** The CPU's state, read from the core */
  cpu() {
    const c = (n: string) => this.call(n);
    return {
      af: c("GetCpuAf"),
      bc: c("GetCpuBc"),
      de: c("GetCpuDe"),
      hl: c("GetCpuHl"),
      af_: c("GetCpuAfAlt"),
      bc_: c("GetCpuBcAlt"),
      de_: c("GetCpuDeAlt"),
      hl_: c("GetCpuHlAlt"),
      ix: c("GetCpuIx"),
      iy: c("GetCpuIy"),
      ir: c("GetCpuIr"),
      wz: c("GetCpuWz"),
      sp: c("GetCpuSp"),
      pc: c("GetCpuPc"),
      iff1: c("GetCpuIff1") !== 0,
      iff2: c("GetCpuIff2") !== 0,
      im: c("GetCpuInterruptMode"),
      halted: c("GetCpuHalted") !== 0,
      eiBacklog: c("GetCpuEiBacklog")
    };
  }
}
