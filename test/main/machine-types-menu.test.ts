import { describe, expect, it, vi } from "vitest";

import type { MachineInfo } from "@common/machines/info-types";
import { machineRegistry } from "@common/machines/machine-registry";
import { createMachineTypesMenu } from "@main/machine-types-menu";

/*
 * The machine-type items of the Machine menu: one checkbox per model (or per machine without models),
 * a separator after each machine.
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
      { modelId: "b", displayName: "Multi B", config: {} }
    ]
  }
];

describe("createMachineTypesMenu", () => {
  it("lists a machine without models as one item, and each model of the others, with separators", () => {
    const items = createMachineTypesMenu(registry, undefined, undefined, vi.fn());
    expect(items.map((i) => (i.type === "separator" ? "---" : [i.id, i.label, i.type]))).toEqual([
      ["machine_solo", "Solo Machine", "checkbox"],
      "---",
      ["machine_multi_a", "Multi A", "checkbox"],
      ["machine_multi_b", "Multi B", "checkbox"],
      "---"
    ]);
  });

  it("checks the running model", () => {
    const flat = createMachineTypesMenu(registry, "multi", "b", vi.fn());
    expect(flat.find((i) => i.id === "machine_multi_b")!.checked).toBe(true);
    expect(flat.find((i) => i.id === "machine_multi_a")!.checked).toBe(false);
    expect(flat.find((i) => i.id === "machine_solo")!.checked).toBe(false);

    const solo = createMachineTypesMenu(registry, "solo", undefined, vi.fn());
    expect(solo[0].checked).toBe(true);
  });

  it("selects the machine and model that was clicked", async () => {
    const select = vi.fn(() => Promise.resolve());
    const items = createMachineTypesMenu(registry, undefined, undefined, select);
    await items[0].click!({} as any, undefined, {} as any);
    expect(select).toHaveBeenLastCalledWith("solo");
    await items.find((i) => i.id === "machine_multi_b")!.click!({} as any, undefined, {} as any);
    expect(select).toHaveBeenLastCalledWith("multi", "b");
  });

  it("the real menu is flat: one checkbox per registered model, no submenus", () => {
    const items = createMachineTypesMenu(machineRegistry, undefined, undefined, vi.fn());
    expect(items.filter((i) => i.type === "submenu")).toEqual([]);
    const checkboxes = items.filter((i) => i.type === "checkbox");
    const modelCount = machineRegistry.reduce((n, m) => n + (m.models?.length ?? 1), 0);
    expect(checkboxes).toHaveLength(modelCount);
    const z88 = machineRegistry.find((m) => m.machineId === "z88")!;
    expect(checkboxes.filter((i) => i.id!.startsWith("machine_z88_")).map((i) => i.id)).toEqual(
      z88.models!.map((m) => `machine_z88_${m.modelId}`)
    );
  });
});
