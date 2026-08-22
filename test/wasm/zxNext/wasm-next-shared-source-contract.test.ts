import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildSp48Wasm, productionOutput as sp48ProductionOutput } from "../../../scripts/build-sp48-wasm.cjs";
import {
  buildZxNextWasm,
  optimizationProfiles,
  productionOutput as zxnextProductionOutput
} from "../../../scripts/build-zxnext-wasm.cjs";
import { ZXNEXT_WASM_V2_DEFAULT_BLOCKERS } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

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
    oracleTests: ["wasm-next-keyboard-ula.test.ts", "wasm-next-screen-ula.test.ts"],
    reason: "Next ULA couples $FE, NextReg state, 720x288 composition, and Next timing."
  },
  {
    device: "keyboard",
    source: "zxnext-keyboard.c",
    oracleTests: ["wasm-next-keyboard-ula.test.ts"],
    reason: "The hot-path row cache mirrors the common Spectrum optimization, but the Next port layer owns the handoff."
  },
  {
    device: "beeper",
    source: "zxnext-beeper.c",
    oracleTests: ["wasm-next-beeper-audio.test.ts"],
    reason: "Next $FE writes feed the ULA EAR/MIC latch and beeper without the classic tape-save side effect."
  },
  {
    device: "tape",
    source: "zxnext-tape.c",
    oracleTests: ["wasm-next-tape.test.ts"],
    reason: "Next keeps ULA MIC latch and tape MIC state separate, unlike the reusable classic $FE path."
  },
  {
    device: "PSG",
    source: "zxnext-psg.c",
    oracleTests: ["wasm-next-psg-audio.test.ts"],
    reason: "Next uses TurboSound YM routing and mono/panning controls beyond the classic shared AY device."
  },
  {
    device: "ports",
    source: "zxnext-ports.c",
    oracleTests: ["wasm-next-ports.test.ts", "wasm-next-storage-commands.test.ts"],
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
    buildSp48Wasm();
    buildZxNextWasm();

    const sp48Bytes = statSync(sp48ProductionOutput).size;
    const zxnextBytes = statSync(zxnextProductionOutput).size;

    expect(zxnextBytes).toBeGreaterThan(sp48Bytes);
    expect(ZXNEXT_WASM_V2_DEFAULT_BLOCKERS).not.toContain("binary-size-parity-audit");
    expect(ZXNEXT_WASM_V2_DEFAULT_BLOCKERS).not.toContain("timing-depth-parity");
    expect(ZXNEXT_WASM_V2_DEFAULT_BLOCKERS).toEqual([]);
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

  it("documents every Next-specific classic-device fork with oracle coverage", () => {
    const zxnext = read("src/emu/machines/zxNext/wasm/zxnext/zxnext.c");

    for (const entry of NEXT_SPECIFIC_DEVICE_AUDIT) {
      expect(zxnext).toContain(`#include "${entry.source}"`);
      expect(entry.reason).toMatch(/Next|TurboSound|classic|hot-path/);
      for (const testFile of entry.oracleTests) {
        expect(read(`test/wasm/zxNext/${testFile}`).length).toBeGreaterThan(0);
      }
    }
  });
});

function read(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8");
}
