import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { Sp48WasmV2LoaderOptions, Sp48WasmV2Runtime } from "../zxSpectrum48/wasm/Sp48WasmV2Loader";
import type { JoystickConnector } from "../zxNext/IZxNextHostInputMachine";
import type { SpectrumSnapshot } from "@common/spectrum/snapshot/spectrumSnapshot";
import type { ISpectrumPsgDevice } from "../zxSpectrum/ISpectrumPsgDevice";

import { MI_TIMEX } from "@common/machines/constants";
import { MEDIA_DOCK } from "@common/structs/project-const";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { dockBankOf, type DckImage } from "@common/timex/dckFile";
import { TC2068_ROM_FILE, TIMEX_ROM_FILE, TS2068_ROM_FILE } from "../machine-props";
import { sp48TapeLoadFlow } from "../tapeLoadFlows";
import { ZxSpectrum48WasmV2Machine } from "../zxSpectrum48/ZxSpectrum48WasmV2Machine";
import { WasmFloatingBusDevice, WasmSpectrumPsgDevice } from "../zxSpectrum/WasmSpectrumSupport";
import {
  SP48_ROM_TRAITS,
  TIMEX_KNOWN_ROMS,
  getTimexModel,
  romCrc32,
  type TimexModel,
  type TimexModelId,
  type TimexRomTraits
} from "./timexModels";
import {
  timexLoaderOptions,
  validateTimexOwnExports,
  type TimexWasmV2Exports
} from "./wasm/TimexWasmV2Loader";

/** The machine property naming each model's ROM file (set from the settings by `MachineService`) */
const ROM_PROPERTY: Record<TimexModelId, string> = {
  tc2048: TIMEX_ROM_FILE,
  tc2068: TC2068_ROM_FILE,
  ts2068: TS2068_ROM_FILE
};

/** Where an 8K chunk comes from (`timexGetChunkSource`) */
const CHUNK_HOME = 0;
const CHUNK_DOCK = 1;
const CHUNK_EXROM = 2;
const CHUNK_NONE = 3;

/*
 * The 8K partitions (`.plans/TIMEX_SCORPION_PLAN.md` Q5): HOME chunks H0-H7, DOCK chunks D0-D7,
 * EXROM-bank chunks X0-X7. ROMs are numbered downwards from -1, as on every machine: H0 -1, H1 -2,
 * X0-X7 -3 to -10; RAM upwards: H2-H7 2-7, D0-D7 8-15 (a DOCK chunk may be ROM; `getRomFlags` says).
 */
export function timexHomePartition(chunk: number): number {
  return chunk < 2 ? -(chunk + 1) : chunk;
}
export const timexDockPartition = (chunk: number): number => 8 + chunk;
export const timexExromPartition = (chunk: number): number => -(3 + chunk);

/**
 * The Timex machines (`.plans/TIMEX_SCORPION_PLAN.md` G9.4a, G9.4b) on the Timex core: the TC2048,
 * the TC2068 and the TS2068.
 *
 * The core is the 48K machine built with Timex's SCLD (`timex.c`), so this is the 48K's machine with
 * the Timex's own parts: the model's hard reset, the 704-wide picture shown at half width, the ROM
 * (the user's when the settings name one, the Sinclair 48K ROM otherwise - plan P5), the TC2048's
 * Kempston port, and the 2068s' EXROM, 8K chunk map, AY, joysticks and DOCK cartridge.
 */
export class TimexWasmV2Machine extends ZxSpectrum48WasmV2Machine {
  public override readonly machineId: string = MI_TIMEX;
  /** The model's facts (`timexModels.ts`) */
  readonly timexModel: TimexModel;
  /** Which ROM the machine booted: the model's own, or the Sinclair 48K ROM in its place */
  romInUse: TimexModelId | "sp48" = "sp48";
  /** What Klive knows of the booted ROM's code; undefined for a ROM it has not run */
  romTraits?: TimexRomTraits = SP48_ROM_TRAITS;
  /** Why the ROM named in the settings is not in use (undefined when none is named or it is) */
  timexRomProblem?: string;
  /** The AY of the 2068s, for the PSG panel */
  psgDevice: ISpectrumPsgDevice;
  /** The 8K EXROM of a 2068 ROM file */
  private exrom?: Uint8Array;
  /** The cartridge in the DOCK */
  private dockImage?: DckImage;

  constructor(modelInfo?: MachineModel, config?: MachineConfigSet, loaderOptions?: Sp48WasmV2LoaderOptions) {
    super(modelInfo, config, timexLoaderOptions(loaderOptions));
    this.timexModel = getTimexModel(modelInfo?.config ?? config);
    this.baseClockFrequency = this.timexModel.clockHz;
    // --- Port $FF belongs to the SCLD here, so the floating bus is read through its own export
    this.floatingBusDevice = new WasmFloatingBusDevice(
      this,
      () => this.wasmV2Runtime?.exports.sp48ReadFloatingBus?.() ?? 0xff
    );
    this.psgDevice = new WasmSpectrumPsgDevice(this, (name, ...args) => {
      const fn = (this.wasmV2Runtime?.exports as Record<string, unknown> | undefined)?.[`timex${name}`];
      return typeof fn === "function" ? (fn as (...a: number[]) => number)(...args) : undefined;
    });
  }

  /** The Timex core's exports */
  get timexExports(): TimexWasmV2Exports {
    return this.requireWasmV2Runtime().exports as TimexWasmV2Exports;
  }

  /** The 48K ROM's resources serve the fallback; the model's ROM comes from the settings */
  override get romId(): string {
    return "sp48";
  }

  protected override async loadMachineRom(): Promise<Uint8Array> {
    const model = this.timexModel;
    this.romInUse = "sp48";
    this.romTraits = SP48_ROM_TRAITS;
    this.exrom = undefined;
    this.timexRomProblem = undefined;
    const path = this.getMachineProperty(ROM_PROPERTY[model.id]) as string | undefined;
    if (path) {
      try {
        const rom = await this.loadRomFromResource(path);
        if (rom.length === model.romSize) {
          this.romInUse = model.id;
          this.romTraits = TIMEX_KNOWN_ROMS[romCrc32(rom)];
          if (model.is2068) this.exrom = rom.slice(0x4000, 0x6000);
          return rom.slice(0, 0x4000);
        }
        this.timexRomProblem = `The ${model.displayName} ROM must be ${model.romSize} bytes; ${path} has ${rom.length}`;
      } catch (err) {
        this.timexRomProblem = `Cannot read the ${model.displayName} ROM ${path}: ${(err as Error)?.message ?? err}`;
      }
    }
    return await super.loadMachineRom();
  }

  protected override get stateCoreId(): string {
    return MI_TIMEX;
  }

  protected override hardResetCore(runtime: Sp48WasmV2Runtime): void {
    const exports = runtime.exports as TimexWasmV2Exports;
    validateTimexOwnExports(exports, runtime.artifactName);
    exports.timexHardReset(this.timexModel.coreModel);
    if (this.exrom) {
      for (let i = 0; i < this.exrom.length; i++) exports.timexUploadExromByte(i, this.exrom[i]);
    }
    // --- The tape device traps the booted ROM's routines; none for a ROM Klive has not run
    const tape = this.romTraits?.tape;
    if (tape) {
      exports.timexSetTapeTraps(tape.load, tape.invalidHeader, tape.resume, tape.save, tape.inExrom ? 1 : 0);
    } else {
      exports.timexSetTapeTraps(0, 0, 0, 0, 2);
    }
    this.uploadDock();
  }

  override setMachineProperty(key: string, value?: any): void {
    super.setMachineProperty(key, value);
    if (key === MEDIA_DOCK) {
      this.dockImage = value as DckImage | undefined;
      if (this.wasmV2Runtime) this.uploadDock();
    }
  }

  /** Puts the cartridge's DOCK bank into the core (or empties the DOCK) */
  private uploadDock(): void {
    const runtime = this.wasmV2Runtime;
    if (!runtime || !this.timexModel.is2068) return;
    const exports = runtime.exports as TimexWasmV2Exports;
    exports.timexDockEject();
    const dock = this.dockImage ? dockBankOf(this.dockImage) : undefined;
    if (!dock) return;
    const memory = new Uint8Array(runtime.exports.memory.buffer, exports.timexDockPtr(), 0x10000);
    for (let chunk = 0; chunk < 8; chunk++) {
      // --- Only a chunk whose type says so carries an image; a RAM chunk without one starts cleared
      const image = dock.chunks[chunk];
      if (image && (dock.chunkTypes[chunk] & 0x02) !== 0) memory.set(image.subarray(0, 0x2000), chunk * 0x2000);
      exports.timexDockSetChunkType(chunk, dock.chunkTypes[chunk] & 0x03);
    }
  }

  /** Two buffer pixels per Spectrum pixel: a line's tacts are a quarter of the buffer width */
  override get tactsInDisplayLine(): number {
    return this.screenWidthInPixels / 4;
  }

  /** The 704-wide buffer shows at the 48K's proportions (as the Next's 720) */
  getAspectRatio = (): [number, number] => [0.5, 1];

  /** The SCLD reads the display from HOME, whatever the CPU has mapped */
  override readScreenMemory(offset: number): number {
    return this.timexExports.sp48ReadScreenMemoryOffset(offset & 0x3fff);
  }

  /** What the CPU sees: on a 2068 the chunk map decides, so the view is assembled from the chunks */
  override get64KFlatMemory(): Uint8Array {
    const runtime = this.requireWasmV2Runtime();
    if (!this.timexModel.is2068) return runtime.memory;
    const flat = new Uint8Array(0x10000);
    const exports = this.timexExports;
    this.getCurrentPartitions().forEach((partition, chunk) => {
      if (exports.timexGetChunkSource(chunk) === CHUNK_NONE) {
        flat.fill(0xff, chunk * 0x2000, (chunk + 1) * 0x2000);
      } else {
        flat.set(this.getMemoryPartition(partition), chunk * 0x2000);
      }
    });
    return flat;
  }

  /**
   * The joysticks, driven by the host's joystick bindings (`useEmulatorJoystick`): the TC2048's
   * built-in Kempston port takes joystick 1; the 2068s read both sticks through the AY. The pin order
   * (right, left, down, up, fire 1) is the Kempston port's bit order.
   */
  setJoystickState(side: JoystickConnector, bits: number): void {
    const exports = this.wasmV2Runtime?.exports as TimexWasmV2Exports | undefined;
    if (!exports) return;
    if (this.timexModel.is2068) {
      exports.timexSetJoystick(side === "left" ? 0 : 1, bits & 0x1f);
    } else if (side === "left") {
      exports.timexSetKempston(bits & 0x1f);
    }
  }

  /** The SCLD's control register (port $FF) */
  getScldPortFf(): number {
    return this.timexExports.timexGetPortFf();
  }

  // ==============================================================================================
  // The 8K partitions (Q5)

  /** The partition each chunk the CPU addresses comes from */
  override getCurrentPartitions(): number[] {
    const exports = this.timexExports;
    const exromBank = (exports.timexGetPortFf() & 0x80) !== 0;
    return Array.from({ length: 8 }, (_, chunk) => {
      switch (exports.timexGetChunkSource(chunk)) {
        case CHUNK_HOME:
          return timexHomePartition(chunk);
        case CHUNK_DOCK:
          return timexDockPartition(chunk);
        case CHUNK_EXROM:
          return timexExromPartition(chunk);
        default:
          return exromBank ? timexExromPartition(chunk) : timexDockPartition(chunk);
      }
    });
  }

  override getPartition(address: number): number | undefined {
    return this.getCurrentPartitions()[(address >>> 13) & 0x07];
  }

  override getCurrentPartitionLabels(): string[] {
    const labels = this.getPartitionLabels();
    return this.getCurrentPartitions().map((p) => labels[p] ?? "");
  }

  override getPartitionLabels(): Record<number, string> {
    const labels: Record<number, string> = {};
    for (let chunk = 0; chunk < 8; chunk++) labels[timexHomePartition(chunk)] = `H${chunk}`;
    if (this.timexModel.is2068) {
      for (let chunk = 0; chunk < 8; chunk++) {
        labels[timexExromPartition(chunk)] = `X${chunk}`;
        labels[timexDockPartition(chunk)] = `D${chunk}`;
      }
    }
    return labels;
  }

  getPartitionDescriptions(): Record<number, string> {
    const descriptions: Record<number, string> = {};
    for (let chunk = 0; chunk < 8; chunk++) {
      const at = `$${toHexa4(chunk * 0x2000)}`;
      descriptions[timexHomePartition(chunk)] = chunk < 2 ? `HOME ROM at ${at}` : `HOME RAM at ${at}`;
      if (this.timexModel.is2068) {
        descriptions[timexExromPartition(chunk)] = `EXROM at ${at}`;
        descriptions[timexDockPartition(chunk)] = `DOCK (cartridge) at ${at}`;
      }
    }
    return descriptions;
  }

  getPartitionGroups(): Record<number, string> {
    const groups: Record<number, string> = {};
    for (let chunk = 0; chunk < 8; chunk++) {
      groups[timexHomePartition(chunk)] = "HOME";
      if (this.timexModel.is2068) {
        groups[timexExromPartition(chunk)] = "EXROM";
        groups[timexDockPartition(chunk)] = "DOCK";
      }
    }
    return groups;
  }

  override parsePartitionLabel(label: string): number | undefined {
    const wanted = label.trim().toUpperCase();
    const found = Object.entries(this.getPartitionLabels()).find(([, l]) => l === wanted);
    return found ? Number(found[0]) : undefined;
  }

  /** An 8K partition's bytes, as a view into the core's memory */
  override getMemoryPartition(index: number): Uint8Array {
    const runtime = this.requireWasmV2Runtime();
    const exports = this.timexExports;
    const buffer = runtime.exports.memory.buffer;
    if (index <= -3 && index >= -10) {
      return new Uint8Array(buffer, exports.timexExromPtr(), 0x2000);
    }
    if (index >= 8 && index <= 15) {
      return new Uint8Array(buffer, exports.timexDockPtr() + (index - 8) * 0x2000, 0x2000);
    }
    const chunk = (index < 0 ? -index - 1 : index) & 0x07;
    return runtime.memory.subarray(chunk * 0x2000, (chunk + 1) * 0x2000);
  }

  /** One flag per 8K chunk the CPU addresses: ROM (HOME ROM, EXROM, a ROM or empty DOCK chunk) */
  override getRomFlags(): boolean[] {
    const exports = this.timexExports;
    return Array.from({ length: 8 }, (_, chunk) => {
      switch (exports.timexGetChunkSource(chunk)) {
        case CHUNK_HOME:
          return chunk < 2;
        case CHUNK_DOCK:
          return (exports.timexDockGetChunkType(chunk) & 0x01) === 0;
        default:
          return true;
      }
    });
  }

  // ==============================================================================================
  // Snapshots and flows

  /**
   * A snapshot's Timex parts, after the 48K's restore (which reset the SCLD): the cartridge pages,
   * port $F4, port $FF, the 2068s' AY; then the picture redrawn in the restored mode
   */
  protected override restoreSnapshotExtras(snapshot: SpectrumSnapshot): void {
    const runtime = this.requireWasmV2Runtime();
    const exports = this.timexExports;
    const timex = snapshot.timex;
    if (this.timexModel.is2068) {
      const dockPages = (timex?.dock ?? []).filter((p) => p.dock);
      if (dockPages.length) {
        exports.timexDockEject();
        const memory = new Uint8Array(runtime.exports.memory.buffer, exports.timexDockPtr(), 0x10000);
        for (const page of dockPages) {
          memory.set(page.data.subarray(0, 0x2000), (page.page & 0x07) * 0x2000);
          exports.timexDockSetChunkType(page.page & 0x07, 0x02 | (page.ram ? 0x01 : 0));
        }
      }
      exports.timexSetPortF4((timex?.portF4 ?? 0) & 0xff);
      if (snapshot.ay) {
        for (let reg = 0; reg < 16; reg++) {
          exports.sp48WritePort(0x00f5, reg);
          exports.sp48WritePort(0x00f6, snapshot.ay.regs[reg] ?? 0);
        }
        exports.sp48WritePort(0x00f5, snapshot.ay.selected & 0x0f);
      }
    }
    exports.timexSetPortFf((timex?.portFf ?? 0) & 0xff);
    exports.sp48RenderInstantScreen();
  }

  /** The 48K's capture, named after the model, with the SCLD, the AY and the cartridge */
  protected override captureSnapshotExtras(snapshot: SpectrumSnapshot): SpectrumSnapshot {
    const runtime = this.requireWasmV2Runtime();
    const exports = this.timexExports;
    if (!this.timexModel.is2068) {
      return { ...snapshot, machine: "tc2048", timex: { portF4: 0, portFf: exports.timexGetPortFf() } };
    }
    const dockMemory = new Uint8Array(runtime.exports.memory.buffer, exports.timexDockPtr(), 0x10000);
    const dock = [];
    for (let chunk = 0; chunk < 8; chunk++) {
      const type = exports.timexDockGetChunkType(chunk);
      if ((type & 0x03) === 0) continue;
      dock.push({
        page: chunk,
        dock: true,
        ram: (type & 0x01) !== 0,
        data: dockMemory.slice(chunk * 0x2000, (chunk + 1) * 0x2000)
      });
    }
    const regs = new Uint8Array(16);
    for (let reg = 0; reg < 16; reg++) regs[reg] = exports.timexGetPsgRegisterValue(reg) & 0xff;
    return {
      ...snapshot,
      machine: this.timexModel.id as "tc2068" | "ts2068",
      timex: {
        portF4: exports.timexGetPortF4(),
        portFf: exports.timexGetPortFf(),
        ...(dock.length ? { dock } : {})
      },
      ay: { selected: exports.timexGetPsgRegisterIndex() & 0x0f, regs }
    };
  }

  /** The main loop the flows wait at: the booted ROM's (the 48K's $12AC, the TS2068's $0E32) */
  private requireMainEntry(): number {
    if (!this.romTraits) {
      throw new Error(
        `Klive does not know this ${this.timexModel.displayName} ROM's main loop, so it cannot start a program or a tape in it.`
      );
    }
    return this.romTraits.mainEntry;
  }

  /**
   * Code built for the 48K runs on every Timex model; the flow waits at the booted ROM's main loop
   * (the TC2048 ROM keeps the 48K's: it changes only the CALL at $1299)
   */
  override async getCodeInjectionFlow(model: string): Promise<CodeInjectionFlow> {
    if (model === "sp48" || model === MI_TIMEX || model === this.timexModel.id) {
      const entry = this.requireMainEntry();
      return [
        {
          type: "ReachExecPoint",
          rom: 0,
          execPoint: entry,
          message: `Main execution cycle point reached (ROM0/$${toHexa4(entry)})`
        },
        { type: "Inject" },
        { type: "SetReturn", returnPoint: entry }
      ];
    }
    throw new Error(`Code for machine model '${model}' cannot run on this virtual machine.`);
  }

  /** Resets to the editor and types `LOAD ""`, waiting at the booted ROM's main loop */
  override getTapeLoadFlow(): CodeInjectionFlow {
    return sp48TapeLoadFlow(this.requireMainEntry());
  }
}
