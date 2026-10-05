import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { TimexWasmV2Machine } from "@emu/machines/timex/TimexWasmV2Machine";
import { TIMEX_MODELS } from "@emu/machines/timex/timexModels";
import type { TimexWasmV2Exports } from "@emu/machines/timex/wasm/TimexWasmV2Loader";
import { TIMEX_ROM_FILE } from "@emu/machines/machine-props";

import { Sp48TestSession } from "../sp48/session";
import { buildTimexWasm, productionOutput } from "../../../scripts/build-timex-wasm.cjs";

/** The Sinclair 48K ROM the app ships: the TC2048 boots it when no TC2048 ROM is named */
const SP48_ROM_PATH = join(__dirname, "../../../src/public/roms/sp48.rom");

/**
 * A TC2048 ROM for the ROM-gated tests. Klive cannot ship it (`.plans/TIMEX_SCORPION_PLAN.md` P5),
 * so a developer who has one names it in `KLIVE_TC2048_ROM`; without it those tests are skipped.
 */
export const TC2048_ROM_PATH = process.env.KLIVE_TC2048_ROM;
export const hasTc2048Rom = (): boolean => !!TC2048_ROM_PATH && existsSync(TC2048_ROM_PATH);

/**
 * The core's 16 colours (`sp48SpectrumColors` in zx-spectrum-ula.c), as the pixel buffer holds them
 * (0xAABBGGRR): 0-7 without BRIGHT, 8-15 with it.
 */
export const SPECTRUM_COLORS = [
  0xff000000, 0xffaa0000, 0xff0000aa, 0xffaa00aa, 0xff00aa00, 0xffaaaa00, 0xff00aaaa, 0xffaaaaaa,
  0xff000000, 0xffff0000, 0xff0000ff, 0xffff00ff, 0xff00ff00, 0xffffff00, 0xff00ffff, 0xffffffff
].map((c) => c >>> 0);

class HarnessTimexMachine extends TimexWasmV2Machine {
  constructor(private readonly rom: Uint8Array, romPath?: string) {
    super(TIMEX_MODELS[0], {}, {
      artifactName: "harness-timex.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    });
    if (romPath) this.setMachineProperty(TIMEX_ROM_FILE, romPath);
  }

  protected override async loadRomFromResource(): Promise<Uint8Array> {
    return this.rom;
  }
}

let wasmBuilt = false;

/**
 * Creates a Timex Computer 2048 on the Timex core, ready to boot. With `{ rom: "tc2048" }` it boots
 * the TC2048 ROM named in `KLIVE_TC2048_ROM` (check `hasTc2048Rom()` first); otherwise the Sinclair
 * 48K ROM, as the machine does without a TC2048 ROM.
 */
export async function createTimexSession(options: { rom?: "sp48" | "tc2048" } = {}): Promise<TimexTestSession> {
  if (!wasmBuilt) {
    buildTimexWasm();
    wasmBuilt = true;
  }
  const useTc2048 = options.rom === "tc2048";
  if (useTc2048 && !hasTc2048Rom()) throw new Error("KLIVE_TC2048_ROM does not name a readable TC2048 ROM.");
  const rom = new Uint8Array(readFileSync(useTc2048 ? TC2048_ROM_PATH! : SP48_ROM_PATH));
  const machine = new HarnessTimexMachine(rom, useTc2048 ? TC2048_ROM_PATH : undefined);
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

  /** Redraws the whole picture from memory and the current registers */
  renderNow(): this {
    this.exports.sp48RenderInstantScreen();
    return this;
  }
}
