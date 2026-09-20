import packageJson from "../../../package.json";

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
    const model = getZxNextModels().find(model => model.modelId === "standard")!;

    const machine = renderer!.factory(undefined as any, model, model.config);

    expect(machine).toBeInstanceOf(ZxNextWasmV2Machine);
  });

  it("offers one Next model, and maps the retired compatibility id onto it", () => {
    const models = getZxNextModels();

    expect(models.map(model => model.modelId)).toEqual(["standard"]);
    expect(models.map(model => model.displayName)).toEqual(["ZX Spectrum Next"]);
    // --- D4: a project or a last session saved with the TypeScript model opens on the WASM one
    // --- instead of naming a machine the registry cannot find.
    expect(resolveModelId(MI_ZXNEXT, "compatibility")).toBe("standard");
    expect(resolveModelId(MI_ZXNEXT, "standard")).toBe("standard");
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
    // --- The node project, not jsdom: these are `.test.ts` files, which the jsdom project does
    // --- not include - under `--project jsdom` the suite silently ran nothing.
    expect(packageJson.scripts["test:zxnext-wasm-acceptance"]).toContain("--project node");
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
  it("names the one remaining Next model", () => {
    expect(resolveModelId(MI_ZXNEXT, "compatibility")).toBe("standard");
    expect(getMachineName(MI_ZXNEXT, "compatibility")).toBe("ZX Spectrum Next");
  });

  it("leaves other ids and other machines alone", () => {
    expect(resolveModelId(MI_ZXNEXT, "standard")).toBe("standard");
    expect(resolveModelId(MI_ZXNEXT, undefined)).toBeUndefined();
    expect(resolveModelId("sp48", "compatibility")).toBe("compatibility");
  });

  it("a project saved with it opens on the standard model, keeping its configuration", async () => {
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
    expect(created[0]).toEqual(["standard", saved]);
  });
});

function getZxNextModels() {
  return machineRegistry.find(machine => machine.machineId === MI_ZXNEXT)!.models!;
}
