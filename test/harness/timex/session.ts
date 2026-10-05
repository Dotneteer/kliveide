import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { TimexWasmV2Machine } from "@emu/machines/timex/TimexWasmV2Machine";
import { TIMEX_MODELS, type TimexModelId } from "@emu/machines/timex/timexModels";
import type { TimexWasmV2Exports } from "@emu/machines/timex/wasm/TimexWasmV2Loader";
import { TC2068_ROM_FILE, TIMEX_ROM_FILE, TS2068_ROM_FILE } from "@emu/machines/machine-props";
import { MEDIA_DOCK } from "@common/structs/project-const";
import type { DckImage } from "@common/timex/dckFile";

import { Sp48TestSession } from "../sp48/session";
import { buildTimexWasm, productionOutput } from "../../../scripts/build-timex-wasm.cjs";

/** The Sinclair 48K ROM the app ships: the TC2048 boots it when no TC2048 ROM is named */
const SP48_ROM_PATH = join(__dirname, "../../../src/public/roms/sp48.rom");

/**
 * The Timex ROMs for the ROM-gated tests. Klive cannot ship them (`.plans/TIMEX_SCORPION_PLAN.md`
 * P5), so a developer who has them names them in `KLIVE_TC2048_ROM`, `KLIVE_TC2068_ROM` and
 * `KLIVE_TS2068_ROM` (the 2068s' as one 24K file, HOME then EXROM); without them those tests are
 * skipped.
 */
export const TIMEX_ROM_PATHS: Record<TimexModelId, string | undefined> = {
  tc2048: process.env.KLIVE_TC2048_ROM,
  tc2068: process.env.KLIVE_TC2068_ROM,
  ts2068: process.env.KLIVE_TS2068_ROM
};
export const TC2048_ROM_PATH = TIMEX_ROM_PATHS.tc2048;
export const hasTimexRom = (model: TimexModelId): boolean =>
  !!TIMEX_ROM_PATHS[model] && existsSync(TIMEX_ROM_PATHS[model]!);
export const hasTc2048Rom = (): boolean => hasTimexRom("tc2048");

const ROM_PROPERTY: Record<TimexModelId, string> = {
  tc2048: TIMEX_ROM_FILE,
  tc2068: TC2068_ROM_FILE,
  ts2068: TS2068_ROM_FILE
};

/**
 * The core's 16 colours (`sp48SpectrumColors` in zx-spectrum-ula.c), as the pixel buffer holds them
 * (0xAABBGGRR): 0-7 without BRIGHT, 8-15 with it.
 */
export const SPECTRUM_COLORS = [
  0xff000000, 0xffaa0000, 0xff0000aa, 0xffaa00aa, 0xff00aa00, 0xffaaaa00, 0xff00aaaa, 0xffaaaaaa,
  0xff000000, 0xffff0000, 0xff0000ff, 0xffff00ff, 0xff00ff00, 0xffffff00, 0xff00ffff, 0xffffffff
].map((c) => c >>> 0);

class HarnessTimexMachine extends TimexWasmV2Machine {
  constructor(private readonly rom: Uint8Array, model: TimexModelId, romPath?: string) {
    super(TIMEX_MODELS.find((m) => m.modelId === model), {}, {
      artifactName: "harness-timex.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
    if (romPath) this.setMachineProperty(ROM_PROPERTY[model], romPath);
  }

  protected override async loadRomFromResource(): Promise<Uint8Array> {
    return this.rom;
  }
}

let wasmBuilt = false;

export type TimexSessionOptions = {
  /** The model (the TC2048 when omitted) */
  model?: TimexModelId;
  /**
   * "own": the model's ROM from `KLIVE_<MODEL>_ROM` (check `hasTimexRom()` first); "tc2048" is the
   * TC2048's own ROM (G9.4a's spelling); otherwise the Sinclair 48K ROM, as the machine boots
   * without one. `bytes` boots a ROM image the test built (16K, or 24K for a 2068).
   */
  rom?: "sp48" | "own" | "tc2048" | { bytes: Uint8Array };
};

/**
 * Creates a Timex machine on the Timex core, ready to boot: a TC2048 unless a model is given, with
 * the Sinclair 48K ROM unless the options name the model's own ROM.
 */
export async function createTimexSession(options: TimexSessionOptions = {}): Promise<TimexTestSession> {
  if (!wasmBuilt) {
    buildTimexWasm();
    wasmBuilt = true;
  }
  const model = options.model ?? "tc2048";
  const romOption = options.rom === "tc2048" ? "own" : options.rom;
  let rom: Uint8Array;
  let romPath: string | undefined;
  if (romOption === "own") {
    if (!hasTimexRom(model)) throw new Error(`KLIVE_${model.toUpperCase()}_ROM does not name a readable ROM.`);
    romPath = TIMEX_ROM_PATHS[model]!;
    rom = new Uint8Array(readFileSync(romPath));
  } else if (typeof romOption === "object") {
    romPath = "test-rom";
    rom = romOption.bytes;
  } else {
    rom = new Uint8Array(readFileSync(SP48_ROM_PATH));
  }
  const machine = new HarnessTimexMachine(rom, model, romPath);
  await machine.setup();
  return new TimexTestSession(machine);
}

/**
 * The 48K harness's session (boot, load code, call, keys, tape, snapshots) on a TC2048, plus the
 * SCLD: port $FF, the Kempston port, and the picture probed in the 704-wide buffer.
 */
export class TimexTestSession extends Sp48TestSession {
  constructor(readonly timex: TimexWasmV2Machine) {
    super(timex);
  }

  get exports(): TimexWasmV2Exports {
    return this.timex.timexExports;
  }

  /** OUT to a port, as the CPU does (contention aside) */
  out(port: number, value: number): this {
    this.timex.doWritePort(port & 0xffff, value & 0xff);
    return this;
  }

  /** IN from a port, as the CPU does */
  in(port: number): number {
    return this.timex.doReadPort(port & 0xffff);
  }

  /** The SCLD control register */
  get portFf(): number {
    return this.exports.timexGetPortFf();
  }

  /** Buffer pixels per Spectrum pixel */
  get scale(): number {
    return this.exports.sp48GetScreenWidth() / this.exports.sp48GetTimingScreenWidth();
  }

  /**
   * The raw buffer index of the top-left paper pixel: the core's timing tables put the paper's first
   * line at `firstDisplayLine - firstVisibleLine` rows into the buffer, after a 24-tact (48-pixel)
   * left border.
   */
  get paperOrigin(): number {
    const e = this.exports;
    const row = e.sp48GetFirstDisplayLine() - e.sp48GetFirstVisibleLine();
    return (row * e.sp48GetTimingScreenWidth() + 48) * this.scale;
  }

  /**
   * The colour at a paper position, in the 512-wide grid (`x` 0-511, `y` 0-191): two grid pixels per
   * Spectrum pixel, so `x = 2 * spectrumX` reads a standard-mode pixel.
   */
  paperPixel(x: number, y: number): number {
    const width = this.exports.sp48GetScreenWidth();
    return this.timex.getPixelBuffer()[this.paperOrigin + y * width + x] >>> 0;
  }

  /** The colour of the border at the top-left corner of the picture */
  borderPixel(): number {
    return this.timex.getPixelBuffer()[this.exports.sp48GetScreenWidth() * 2 + 4] >>> 0;
  }

  /** Puts a cartridge into the DOCK (as the emulator does), or empties it */
  insertCartridge(image: DckImage | undefined): this {
    this.timex.setMachineProperty(MEDIA_DOCK, image);
    return this;
  }

  /** What the CPU reads at an address, through the 2068's chunk map */
  cpuPeek(address: number): number {
    return this.exports.sp48ReadMemory(address & 0xffff);
  }

  /** Redraws the whole picture from memory and the current registers */
  renderNow(): this {
    this.exports.sp48RenderInstantScreen();
    return this;
  }
}
