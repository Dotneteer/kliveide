import packageJson from "../../../package.json";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_ZXNEXT_IMPLEMENTATION,
  ZXNEXT_IMPLEMENTATION
} from "@emu/machines/zxNext/ZxNextImplementation";
import { MI_ZXNEXT, MC_ZXNEXT_IMPLEMENTATION } from "@common/machines/constants";
import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import { createZxNextMachine } from "@emu/machines/zxNext/ZxNextMachineFactory";
import { machineRegistry } from "@common/machines/machine-registry";
import { machineRendererRegistry } from "@common/machines/machine-renderer-registry";
import {
  outputRelative,
  packagedArtifactRelative,
  packagedResourceDirectory,
  wasmDistDirectoryRelative
} from "../../../scripts/build-zxnext-wasm.cjs";

describe("ZX Spectrum Next WASM rollout", () => {
  it("keeps TypeScript as the default and fallback while allowing explicit WASM selection", () => {
    expect(DEFAULT_ZXNEXT_IMPLEMENTATION).toBe("typescript");

    expect(createZxNextMachine()).toBeInstanceOf(ZxNextMachine);
    expect(createZxNextMachine()).not.toBeInstanceOf(ZxNextWasmV2Machine);
    expect(createZxNextMachine(undefined, { [ZXNEXT_IMPLEMENTATION]: "typescript" })).not.toBeInstanceOf(
      ZxNextWasmV2Machine
    );
    expect(createZxNextMachine(undefined, { [ZXNEXT_IMPLEMENTATION]: "wasm" })).toBeInstanceOf(
      ZxNextWasmV2Machine
    );
    expect(createZxNextMachine(undefined, { [ZXNEXT_IMPLEMENTATION]: "native" } as any)).not.toBeInstanceOf(
      ZxNextWasmV2Machine
    );
  });

  it("routes renderer registry creation through the ZX Next factory and model configs", () => {
    const renderer = machineRendererRegistry.find(entry => entry.machineId === MI_ZXNEXT);
    const model = getZxNextModels().find(model => model.modelId === "preview")!;

    const machine = renderer!.factory(undefined as any, model, model.config);

    expect(machine).toBeInstanceOf(ZxNextWasmV2Machine);
  });

  it("exposes product-oriented model choices without making the preview the default", () => {
    const models = getZxNextModels();

    expect(models.map(model => model.modelId)).toEqual(["standard", "preview"]);
    expect(models.map(model => model.displayName)).toEqual([
      "ZX Spectrum Next",
      "ZX Spectrum Next Preview"
    ]);
    expect(models[0].config[MC_ZXNEXT_IMPLEMENTATION]).toBe("typescript");
    expect(models[1].config[MC_ZXNEXT_IMPLEMENTATION]).toBe("wasm");
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
    expect(packageJson.scripts["test:zxnext-wasm-acceptance"]).toContain("test/zxnext/ZxNextMachineFactory.test.ts");
    expect(packageJson.scripts["test:zxnext-wasm-acceptance"]).toContain("test/wasm/zxNext/wasm-next-rollout.test.ts");
    expect(packageJson.scripts["test:zxnext-wasm-acceptance"]).toContain("test/wasm/zxNext/wasm-next-public-adapter.test.ts");
    expect(packageJson.scripts["test:zxnext-wasm-acceptance"]).toContain("test/wasm/zxNext/wasm-next-debug-step.test.ts");
    expect(packageJson.scripts["test:zxnext-wasm-acceptance"]).toContain("test/wasm/zxNext/wasm-next-start-menu.test.ts");
    expect(packageJson.scripts["test:zxnext-wasm-acceptance"]).toContain("test/wasm/zxNext/wasm-next-frame-runner.test.ts");
    expect(packageJson.scripts["test:zxnext-wasm-acceptance"]).toContain("test/wasm/zxNext/wasm-next-performance-boundary.test.ts");
  });
});

function getZxNextModels() {
  return machineRegistry.find(machine => machine.machineId === MI_ZXNEXT)!.models!;
}
