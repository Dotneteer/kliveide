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

  it("keeps the real machine menu flat today: no registered model has a menu group", () => {
    const items = createMachineTypesMenu(machineRegistry, undefined, undefined, vi.fn());
    expect(items.filter((i) => i.type === "submenu")).toEqual([]);
    const modelCount = machineRegistry.reduce((n, m) => n + (m.models?.length ?? 1), 0);
    expect(items.filter((i) => i.type === "checkbox")).toHaveLength(modelCount);
  });
});
