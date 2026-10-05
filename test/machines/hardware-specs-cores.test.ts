import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { machineRegistry } from "@common/machines/machine-registry";
import { getHardwareSpec } from "@common/machines/hardware-specs";
import { ZxSpectrum48WasmV2Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine";
import { ZxSpectrum128WasmV2Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine";
import { buildSp48Wasm, productionOutput as sp48Wasm } from "../../scripts/build-sp48-wasm.cjs";
import { buildSp128Wasm, productionOutput as sp128Wasm } from "../../scripts/build-sp128-wasm.cjs";

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

async function expectMatches(machine: any, machineId: string, modelId?: string) {
  await machine.setup();
  const spec = getHardwareSpec(machineRegistry.find((m) => m.machineId === machineId)!, modelId)!;
  expect(spec.clockHz).toBe(machine.baseClockFrequency);
  expect(spec.timing.perFrame).toBe(machine.tactsInFrame);
  expect([spec.display.rasterWidth, spec.display.rasterHeight]).toEqual([
    machine.screenWidthInPixels,
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
});
