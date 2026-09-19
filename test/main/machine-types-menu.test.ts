import { describe, expect, it, vi } from "vitest";
import type { MenuItemConstructorOptions } from "electron";

import type { MachineInfo } from "@common/machines/info-types";
import { machineRegistry } from "@common/machines/machine-registry";
import { createMachineTypesMenu } from "@main/machine-types-menu";

/*
 * The machine-type items of the Machine menu, and the `menuGroup` submenus the backend-comparison
 * twins of a migrating machine use (`.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`, Step 3).
 */

const registry: MachineInfo[] = [
  { machineId: "solo", displayName: "Solo Machine", charSet: {}, features: {} },
  {
    machineId: "multi",
    displayName: "Multi",
    charSet: {},
    features: {},
    models: [
      { modelId: "a", displayName: "Multi A", config: {} },
      { modelId: "a-alt", displayName: "Multi A (alt)", config: {}, menuGroup: "Multi (alt backend)" },
      { modelId: "b", displayName: "Multi B", config: {} },
      { modelId: "b-alt", displayName: "Multi B (alt)", config: {}, menuGroup: "Multi (alt backend)" },
      { modelId: "c-old", displayName: "Multi C (old)", config: {}, menuGroup: "Old ones" }
    ]
  }
];

describe("createMachineTypesMenu", () => {
  it("lists a machine without models as one item, and each model of the others, with separators", () => {
    const items = createMachineTypesMenu(registry, undefined, undefined, vi.fn());
    expect(items.map((i) => i.type === "separator" ? "---" : i.id)).toEqual([
      "machine_solo",
      "---",
      "machine_multi_a",
      "machine_multi_b",
      "machine_multi_group_multi_alt_backend",
      "machine_multi_group_old_ones",
      "---"
    ]);
  });

  it("lists grouped models in a submenu per group, in their registry order", () => {
    const items = createMachineTypesMenu(registry, undefined, undefined, vi.fn());
    const alt = items.find((i) => i.id === "machine_multi_group_multi_alt_backend")!;
    expect(alt.label).toBe("Multi (alt backend)");
    expect(alt.type).toBe("submenu");
    const submenu = alt.submenu as MenuItemConstructorOptions[];
    expect(submenu.map((i) => [i.id, i.label, i.type])).toEqual([
      ["machine_multi_a-alt", "Multi A (alt)", "checkbox"],
      ["machine_multi_b-alt", "Multi B (alt)", "checkbox"]
    ]);
  });

  it("checks the running model, inside a group too", () => {
    const flat = createMachineTypesMenu(registry, "multi", "b", vi.fn());
    expect(flat.find((i) => i.id === "machine_multi_b")!.checked).toBe(true);
    expect(flat.find((i) => i.id === "machine_multi_a")!.checked).toBe(false);

    const grouped = createMachineTypesMenu(registry, "multi", "b-alt", vi.fn());
    const submenu = grouped.find((i) => i.id === "machine_multi_group_multi_alt_backend")!
      .submenu as MenuItemConstructorOptions[];
    expect(submenu.map((i) => i.checked)).toEqual([false, true]);
    expect(grouped.find((i) => i.id === "machine_multi_b")!.checked).toBe(false);

    const solo = createMachineTypesMenu(registry, "solo", undefined, vi.fn());
    expect(solo[0].checked).toBe(true);
  });

  it("selects the machine and model that was clicked", async () => {
    const select = vi.fn(() => Promise.resolve());
    const items = createMachineTypesMenu(registry, undefined, undefined, select);
    await items[0].click!({} as any, undefined, {} as any);
    expect(select).toHaveBeenLastCalledWith("solo");
    const submenu = items.find((i) => i.id === "machine_multi_group_multi_alt_backend")!
      .submenu as MenuItemConstructorOptions[];
    await submenu[1].click!({} as any, undefined, {} as any);
    expect(select).toHaveBeenLastCalledWith("multi", "b-alt");
  });

  it("lists the Z88's WASM preview twins in one submenu; every other machine stays flat", () => {
    const items = createMachineTypesMenu(machineRegistry, undefined, undefined, vi.fn());
    const submenus = items.filter((i) => i.type === "submenu");
    expect(submenus.map((i) => [i.id, i.label])).toEqual([
      ["machine_z88_group_cambridge_z88_wasm_preview", "Cambridge Z88 (WASM preview)"]
    ]);

    const z88 = machineRegistry.find((m) => m.machineId === "z88")!;
    const originals = z88.models!.filter((m) => m.menuGroup === undefined);
    const preview = submenus[0].submenu as MenuItemConstructorOptions[];
    expect(preview.map((i) => i.id)).toEqual(originals.map((m) => `machine_z88_${m.modelId}-wasm`));
    expect(preview.map((i) => i.label)).toEqual(originals.map((m) => `${m.displayName} - WASM preview`));

    // --- The originals keep their flat items; every model has exactly one checkbox
    const flat = items.filter((i) => i.type === "checkbox");
    for (const model of originals) {
      expect(flat.some((i) => i.id === `machine_z88_${model.modelId}`), model.modelId).toBe(true);
    }
    const modelCount = machineRegistry.reduce((n, m) => n + (m.models?.length ?? 1), 0);
    expect(flat.length + preview.length).toBe(modelCount);
  });

  it("checks a running preview twin inside its submenu", () => {
    const items = createMachineTypesMenu(machineRegistry, "z88", "OZ40-wasm", vi.fn());
    const preview = items.find((i) => i.type === "submenu")!.submenu as MenuItemConstructorOptions[];
    expect(preview.filter((i) => i.checked).map((i) => i.id)).toEqual(["machine_z88_OZ40-wasm"]);
    expect(items.filter((i) => i.type === "checkbox" && i.checked)).toEqual([]);
  });
});
