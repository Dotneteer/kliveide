import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { machineRegistry } from "@common/machines/machine-registry";
import { getHardwareSpec } from "@common/machines/hardware-specs";
import { ZxSpectrum48WasmV2Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine";
import { ZxSpectrum128WasmV2Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine";
import { buildSp48Wasm, productionOutput as sp48Wasm } from "../../scripts/build-sp48-wasm.cjs";
import { buildSp128Wasm, productionOutput as sp128Wasm } from "../../scripts/build-sp128-wasm.cjs";
import { TimexWasmV2Machine } from "@emu/machines/timex/TimexWasmV2Machine";
import { ScorpionWasmV2Machine } from "@emu/machines/zxSpectrum128/ScorpionWasmV2Machine";
import { buildTimexWasm, productionOutput as timexWasm } from "../../scripts/build-timex-wasm.cjs";
import { Ht1080zWasmV2Machine } from "@emu/machines/ht1080z/Ht1080zWasmV2Machine";
import { HT1080Z_MODELS } from "@emu/machines/ht1080z/ht1080zMachineInfo";
import { MI_HT1080Z } from "@common/machines/constants";
import { buildHt1080zWasm, productionOutput as ht1080zWasm } from "../../scripts/build-ht1080z-wasm.cjs";
import { TvcWasmV2Machine } from "@emu/machines/tvc/TvcWasmV2Machine";
import { TVC_MODELS } from "@emu/machines/tvc/tvcMachineInfo";
import { MI_TVC } from "@common/machines/constants";
import { buildTvcWasm, productionOutput as tvcWasm } from "../../scripts/build-tvc-wasm.cjs";

/*
 * The hardware sheet's figures against the running cores, for the machines that only report their
 * timing once their WASM core is loaded (plan §5.1b). E2E tier: `build/e2e-tests.ts`.
 */

class Sp48 extends ZxSpectrum48WasmV2Machine {
  protected override async loadRomFromResource(): Promise<Uint8Array> {
    return new Uint8Array(0x4000);
  }
}
class Sp128 extends ZxSpectrum128WasmV2Machine {
  protected override async loadRomFromResource(): Promise<Uint8Array> {
    return new Uint8Array(0x4000);
  }
}

class Scorpion extends ScorpionWasmV2Machine {
  protected override async loadRomFromResource(): Promise<Uint8Array> {
    return new Uint8Array(0x4000);
  }
}

class Timex extends TimexWasmV2Machine {
  protected override async loadRomFromResource(): Promise<Uint8Array> {
    return new Uint8Array(0x4000);
  }
}

class Ht1080z extends Ht1080zWasmV2Machine {
  protected override async loadRomFromResource(): Promise<Uint8Array> {
    return new Uint8Array(0x3000);
  }
}

/** @param pixelScale Buffer pixels per Spectrum pixel (the sheet gives the raster in Spectrum pixels) */
async function expectMatches(machine: any, machineId: string, modelId?: string, pixelScale = 1) {
  await machine.setup();
  const spec = getHardwareSpec(machineRegistry.find((m) => m.machineId === machineId)!, modelId)!;
  expect(spec.clockHz).toBe(machine.baseClockFrequency);
  expect(spec.timing.perFrame).toBe(machine.tactsInFrame);
  expect([spec.display.rasterWidth, spec.display.rasterHeight]).toEqual([
    machine.screenWidthInPixels / pixelScale,
    machine.screenHeightInPixels
  ]);
}

describe("hardware specs against the cores", () => {
  it.each(["pal", "ntsc", "pal-16k"])("ZX Spectrum 48K %s", async (modelId) => {
    buildSp48Wasm();
    const model = machineRegistry.find((m) => m.machineId === "sp48")!.models!.find((m) => m.modelId === modelId)!;
    const machine = new Sp48(model, model.config, {
      artifactName: "machine-v2.wasm",
      readArtifact: async () => readFileSync(sp48Wasm)
    });
    await expectMatches(machine, "sp48", modelId);
  });

  it("ZX Spectrum 128K (no model: a project from before the models)", async () => {
    buildSp128Wasm();
    const machine = new Sp128(undefined, undefined, {
      artifactName: "machine-128-v2.wasm",
      readArtifact: async () => readFileSync(sp128Wasm)
    });
    await expectMatches(machine, "sp128");
  });

  it.each(["sp128", "pentagon"])("ZX Spectrum 128K machine, model %s", async (modelId) => {
    buildSp128Wasm();
    const model = machineRegistry.find((m) => m.machineId === "sp128")!.models!.find((m) => m.modelId === modelId)!;
    const machine = new Sp128(model, model.config, {
      artifactName: "machine-128-v2.wasm",
      readArtifact: async () => readFileSync(sp128Wasm)
    });
    await expectMatches(machine, "sp128", modelId);
  });

  it.each(["tc2048", "tc2068", "ts2068"])("Timex %s (the 704-wide buffer is the 352-pixel raster at two pixels each)", async (modelId) => {
    buildTimexWasm();
    const model = machineRegistry.find((m) => m.machineId === "timex")!.models!.find((m) => m.modelId === modelId)!;
    const machine = new Timex(model, model.config, {
      artifactName: "machine-timex.wasm",
      readArtifact: async () => readFileSync(timexWasm)
    });
    await expectMatches(machine, "timex", modelId, 2);
  });

  it("Scorpion ZS-256", async () => {
    buildSp128Wasm();
    const model = machineRegistry.find((m) => m.machineId === "scorpion")!.models![0];
    const machine = new Scorpion(model, model.config, {
      artifactName: "machine-scorpion.wasm",
      readArtifact: async () => readFileSync(sp128Wasm)
    });
    await expectMatches(machine, "scorpion", model.modelId);
  });

  it.each(HT1080Z_MODELS.map((m) => m.modelId!))("HT-1080Z %s", async (modelId) => {
    buildHt1080zWasm();
    const model = HT1080Z_MODELS.find((m) => m.modelId === modelId)!;
    const machine = new Ht1080z(MI_HT1080Z, model, undefined, undefined, {
      readArtifact: async () => readFileSync(ht1080zWasm)
    });
    await expectMatches(machine, MI_HT1080Z, modelId);
  });

  it.each(TVC_MODELS.map((m) => m.modelId!))("Videoton TVC %s", async (modelId) => {
    buildTvcWasm();
    const model = TVC_MODELS.find((m) => m.modelId === modelId)!;
    // --- The ROMs from the shipped files, as the harness reads them
    const machine = new (class extends TvcWasmV2Machine {
      protected override async loadRomFromResource(romName: string): Promise<Uint8Array> {
        return new Uint8Array(readFileSync(`src/public/roms/${romName}.rom`));
      }
    })(MI_TVC, model, model.config, undefined, { readArtifact: async () => readFileSync(tvcWasm) });
    await expectMatches(machine, MI_TVC, modelId);
  });
});
