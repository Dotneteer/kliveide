import packageJson from "../../../package.json";

import { NEXT_PROFILE_IDS } from "@emu/machines/zxNext/nextProfiles";
import { describe, expect, it } from "vitest";

import { MI_ZXNEXT } from "@common/machines/constants";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import { createZxNextMachine } from "@emu/machines/zxNext/ZxNextMachineFactory";
import { getMachineName, machineRegistry, resolveModelId } from "@common/machines/machine-registry";
import { machineRendererRegistry } from "@common/machines/machine-renderer-registry";
import createAppStore from "@state/store";
import { createMachineService } from "@renderer/appEmu/MachineService";
import { ResolvingMessenger } from "../../harness/z88";
import {
  outputRelative,
  packagedArtifactRelative,
  packagedResourceDirectory,
  wasmDistDirectoryRelative
} from "../../../scripts/build-zxnext-wasm.cjs";

describe("ZX Spectrum Next WASM rollout", () => {
  it("creates the WASM machine whatever the configuration says", () => {
    // --- There is no backend switch any more: a stale `zxnextImplementation` key in a saved
    // --- project's config must not change - or break - what the factory builds.
    expect(createZxNextMachine()).toBeInstanceOf(ZxNextWasmV2Machine);
    expect(createZxNextMachine(undefined, { zxnextImplementation: "typescript" } as any)).toBeInstanceOf(
      ZxNextWasmV2Machine
    );
  });

  it("routes renderer registry creation through the ZX Next factory and model configs", () => {
    const renderer = machineRendererRegistry.find(entry => entry.machineId === MI_ZXNEXT);
    const model = getZxNextModels().find(model => model.modelId === "ks2-30201")!;

    const machine = renderer!.factory(undefined as any, model, model.config);

    expect(machine).toBeInstanceOf(ZxNextWasmV2Machine);
  });

  it("offers one model per Next profile, and maps the retired ids onto KS2 / core 3.02.01", () => {
    const models = getZxNextModels();

    expect(models.map(model => model.modelId)).toEqual(NEXT_PROFILE_IDS);
    expect(models[0].displayName).toBe("ZX Spectrum Next (KS2, core 3.02.01)");
    // --- D4: a project or a last session saved with the TypeScript model opens on the WASM one
    // --- instead of naming a machine the registry cannot find; `standard` was the one model before
    // --- profiles (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D1)
    expect(resolveModelId(MI_ZXNEXT, "compatibility")).toBe("ks2-30201");
    expect(resolveModelId(MI_ZXNEXT, "standard")).toBe("ks2-30201");
    for (const model of models) {
      expect(model.displayName).not.toMatch(/typescript/i);
      expect(model.displayName).not.toMatch(/wasm/i);
    }
  });

  it("packages the production ZX Next WASM artifact as an Electron resource", () => {
    expect(outputRelative).toBe("src/emu/machines/zxNext/wasm/dist/zx-spectrum-next.wasm");
    expect(packagedArtifactRelative).toBe("wasm/zxNext/zx-spectrum-next.wasm");
    expect(packageJson.build.extraResources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        from: wasmDistDirectoryRelative,
        to: packagedResourceDirectory,
        filter: ["**/*.wasm"]
      })
    ]));
  });

  it("declares the ZX Next WASM acceptance suite", () => {
    // --- The e2e-cores project, which runs the WASM core tests (`build/e2e-tests.ts`). Neither
    // --- unit project includes them: under `--project jsdom` (or `node`) the suite silently ran
    // --- nothing.
    expect(packageJson.scripts["test:zxnext-wasm-acceptance"]).toContain("--project e2e-cores");
    expect(packageJson.scripts["test:zxnext-wasm-acceptance"]).toContain("test/wasm/zxNext/wasm-next-factory-setup.test.ts");
    expect(packageJson.scripts["test:zxnext-wasm-acceptance"]).toContain("test/wasm/zxNext/wasm-next-rollout.test.ts");
    expect(packageJson.scripts["test:zxnext-wasm-acceptance"]).toContain("test/wasm/zxNext/wasm-next-public-adapter.test.ts");
    expect(packageJson.scripts["test:zxnext-wasm-acceptance"]).toContain("test/wasm/zxNext/wasm-next-debug-step.test.ts");
    expect(packageJson.scripts["test:zxnext-wasm-acceptance"]).toContain("test/wasm/zxNext/wasm-next-start-menu.test.ts");
    expect(packageJson.scripts["test:zxnext-wasm-acceptance"]).toContain("test/wasm/zxNext/wasm-next-frame-runner.test.ts");
    expect(packageJson.scripts["test:zxnext-wasm-acceptance"]).toContain("test/wasm/zxNext/wasm-next-performance-boundary.test.ts");
  });
});

describe("ZX Spectrum Next: the retired \"compatibility\" model id", () => {
  /*
   * D4 of `.plans/ZX_SPECTRUM_NEXT_TYPESCRIPT_REMOVAL_PLAN.md`: the model that selected the
   * TypeScript emulator is gone, but settings files and `klive.project` files on disk still name
   * it. Opening one must land on the remaining Next model, never throw at startup.
   */
  it("names the model it was made with", () => {
    expect(resolveModelId(MI_ZXNEXT, "compatibility")).toBe("ks2-30201");
    expect(getMachineName(MI_ZXNEXT, "compatibility")).toMatch(/^ZX Spectrum Next/);
  });

  it("leaves other ids and other machines alone", () => {
    expect(resolveModelId(MI_ZXNEXT, "standard")).toBe("ks2-30201");
    // --- A model-less Next reference means the model every earlier Klive emulated
    expect(resolveModelId(MI_ZXNEXT, undefined)).toBe("ks2-30201");
    expect(resolveModelId("sp48", "compatibility")).toBe("compatibility");
  });

  it("a project saved with it opens on KS2 / core 3.02.01, keeping its configuration", async () => {
    const store = createAppStore("emu");
    const service = createMachineService(store, new ResolvingMessenger(), "emu");
    // --- A config as a project saved before the removal would carry it
    const saved = { zxnextImplementation: "typescript" } as any;
    const entry = machineRendererRegistry.find((r) => r.machineId === MI_ZXNEXT)!;
    const originalFactory = entry.factory;
    const created: unknown[] = [];
    entry.factory = (_s, model, config) => {
      created.push([model?.modelId, config]);
      return {
        setMachineProperty() {},
        setup: async () => {},
        hardReset: async () => {},
        dispose() {}
      } as any;
    };
    try {
      await service.setMachineType(MI_ZXNEXT, "compatibility", saved);
    } catch {
      /* --- the stub machine cannot run a controller; the resolution happened before */
    } finally {
      entry.factory = originalFactory;
    }
    expect(created[0]).toEqual(["ks2-30201", saved]);
  });
});

function getZxNextModels() {
  return machineRegistry.find(machine => machine.machineId === MI_ZXNEXT)!.models!;
}
