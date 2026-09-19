import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildZxNextWasm,
  optimizationProfiles,
  productionOutput as zxnextProductionOutput
} from "../../../scripts/build-zxnext-wasm.cjs";

const ROOT = resolve(__dirname, "../../..");

const SHARED_CLASSIC_DEVICES = [
  "zx-spectrum-ula.c",
  "zx-spectrum-keyboard.c",
  "zx-spectrum-beeper.c",
  "zx-spectrum-tape.c",
  "zx-spectrum-psg.c",
  "zx-spectrum-ports.c"
];

const NEXT_SPECIFIC_DEVICE_AUDIT = [
  {
    device: "ULA",
    source: "zxnext-ula.c",
    tests: ["test/wasm/zxNext/wasm-next-keyboard-ula.test.ts", "test/wasm/zxNext/wasm-next-screen-ula.test.ts", "test/zxnext-hw/ula/ula-colours.test.ts"],
    reason: "Next ULA couples $FE, NextReg state, 720x288 composition, and Next timing."
  },
  {
    device: "keyboard",
    source: "zxnext-keyboard.c",
    tests: ["test/wasm/zxNext/wasm-next-keyboard-ula.test.ts", "test/zxnext-hw/keyboard/keyboard.test.ts"],
    reason: "The hot-path row cache mirrors the common Spectrum optimization, but the Next port layer owns the handoff."
  },
  {
    device: "beeper",
    source: "zxnext-beeper.c",
    tests: ["test/wasm/zxNext/wasm-next-beeper-audio.test.ts", "test/zxnext-hw/audio/beeper-mixer.test.ts"],
    reason: "Next $FE writes feed the ULA EAR/MIC latch and beeper without the classic tape-save side effect."
  },
  {
    device: "tape",
    source: "zxnext-tape.c",
    tests: ["test/wasm/zxNext/wasm-next-tape.test.ts"],
    reason: "Next keeps ULA MIC latch and tape MIC state separate, unlike the reusable classic $FE path."
  },
  {
    device: "PSG",
    source: "zxnext-psg.c",
    tests: ["test/wasm/zxNext/wasm-next-psg-audio.test.ts", "test/zxnext-hw/audio/ay-psg.test.ts"],
    reason: "Next uses TurboSound YM routing and mono/panning controls beyond the classic shared AY device."
  },
  {
    device: "ports",
    source: "zxnext-ports.c",
    tests: ["test/wasm/zxNext/wasm-next-ports.test.ts", "test/wasm/zxNext/wasm-next-storage-commands.test.ts", "test/zxnext-hw/ports/port-decode.test.ts"],
    reason: "Next port decoding combines classic ports with NextReg, DivMMC, SD/SPI, DMA, audio, and expansion devices."
  }
];

describe("ZX Spectrum Next WASM shared-source contract", () => {
  it("keeps the production build speed-oriented", () => {
    expect(optimizationProfiles.speed).toEqual(expect.arrayContaining(["-O3", "-Wl,--strip-all"]));
    expect(optimizationProfiles.size).toEqual(expect.arrayContaining(["-Oz"]));
  });

  it("uses the shared Z80N CPU core for the Next backend", () => {
    const source = read("src/emu/machines/zxNext/wasm/zxnext/zxnext-cpu.c");

    expect(source).toContain("#define Z80_EXTERNAL_BUS 1");
    expect(source).toContain("#include \"../../../../z80/wasm/z80.c\"");
    expect(source).toContain("z80SetZ80NMode(1)");
  });

  it("keeps the Next artifact larger than 48K after timing-depth hooks are linked", () => {
    buildZxNextWasm();

    const zxnextBytes = statSync(zxnextProductionOutput).size;

    expect(zxnextBytes).toBeGreaterThan(48 * 1024);
  });

  it("keeps classic Spectrum WASM models on common device sources", () => {
    const classicSources = [
      read("src/emu/machines/zxSpectrum48/wasm/sp48/sp48.c"),
      read("src/emu/machines/zxSpectrum128/wasm/sp128/sp128.c"),
      read("src/emu/machines/zxSpectrumP3e/wasm/spp3e/spp3e.c")
    ].join("\n");

    for (const deviceSource of SHARED_CLASSIC_DEVICES) {
      expect(classicSources).toContain(deviceSource);
    }
  });

  it("documents every Next-specific classic-device fork with its tests", () => {
    const zxnext = read("src/emu/machines/zxNext/wasm/zxnext/zxnext.c");

    for (const entry of NEXT_SPECIFIC_DEVICE_AUDIT) {
      expect(zxnext).toContain(`#include "${entry.source}"`);
      expect(entry.reason).toMatch(/Next|TurboSound|classic|hot-path/);
      for (const testFile of entry.tests) {
        expect(read(testFile).length).toBeGreaterThan(0);
      }
    }
  });
});

function read(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8");
}
