import { describe, expect, it, vi } from "vitest";

import type { MachineInfo } from "@common/machines/info-types";
import { machineRegistry } from "@common/machines/machine-registry";
import {
  DEFAULT_MACHINE_FAVORITES,
  normalizeMachineFavorites
} from "@common/machines/machine-favorites";
import { createMachineTypesMenu, SELECT_MACHINE_ITEM_ID } from "@main/machine-types-menu";

/*
 * The Machine › Machine type submenu: the favourites in order, separators where asked, the running
 * model when it is not a favourite, then "Select machine…" (.plans/MACHINE_SELECT_DIALOG_PLAN.md §3).
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
      { modelId: "b", displayName: "Multi B", config: {} },
      { modelId: "c", displayName: "Multi C", config: {} }
    ]
  }
];

const shape = (items: ReturnType<typeof createMachineTypesMenu>) =>
  items.map((i) => (i.type === "separator" ? "---" : `${i.checked ? "✓ " : ""}${i.label}`));

const menu = (favs: any[], machineId?: string, modelId?: string) =>
  createMachineTypesMenu(registry, favs, machineId, modelId, vi.fn(), vi.fn());

describe("createMachineTypesMenu", () => {
  it("lists the favourites in order, with separators after the ones that ask, then Select machine…", () => {
    const items = menu(
      [{ machineId: "multi", modelId: "b", separatorAfter: true }, { machineId: "solo" }, { machineId: "multi", modelId: "a" }],
      "solo"
    );
    expect(shape(items)).toEqual(["Multi B", "---", "✓ Solo Machine", "Multi A", "---", "Select machine…"]);
  });

  it("never doubles the separator before Select machine…", () => {
    const items = menu([{ machineId: "solo", separatorAfter: true }], "solo");
    expect(shape(items)).toEqual(["✓ Solo Machine", "---", "Select machine…"]);
  });

  it("appends the running model, ticked, when it is not a favourite", () => {
    const items = menu([{ machineId: "solo" }], "multi", "c");
    expect(shape(items)).toEqual(["Solo Machine", "---", "✓ Multi C", "---", "Select machine…"]);
  });

  it("shows only the running model and Select machine… without favourites", () => {
    expect(shape(menu([], "multi", "a"))).toEqual(["✓ Multi A", "---", "Select machine…"]);
    expect(shape(menu([]))).toEqual(["Select machine…"]);
  });

  it("skips favourites the registry does not know", () => {
    const items = menu([{ machineId: "gone" }, { machineId: "multi", modelId: "zz" }, { machineId: "solo" }]);
    expect(shape(items)).toEqual(["Solo Machine", "---", "Select machine…"]);
  });

  it("selects the machine and model that was clicked, and opens the selector", async () => {
    const select = vi.fn(() => Promise.resolve());
    const open = vi.fn(() => Promise.resolve());
    const items = createMachineTypesMenu(
      registry,
      [{ machineId: "solo" }, { machineId: "multi", modelId: "b" }],
      undefined,
      undefined,
      select,
      open
    );
    await items[0].click!({} as any, undefined, {} as any);
    expect(select).toHaveBeenLastCalledWith("solo", undefined);
    await items.find((i) => i.id === "machine_multi_b")!.click!({} as any, undefined, {} as any);
    expect(select).toHaveBeenLastCalledWith("multi", "b");
    const selector = items.find((i) => i.id === SELECT_MACHINE_ITEM_ID)!;
    expect(selector.accelerator).toBe("CmdOrCtrl+Shift+M");
    await selector.click!({} as any, undefined, {} as any);
    expect(open).toHaveBeenCalledOnce();
  });

  it("ticks a running model saved under an alias id", () => {
    const items = createMachineTypesMenu(
      machineRegistry,
      normalizeMachineFavorites(undefined, machineRegistry),
      "z88",
      "OZ50-wasm",
      vi.fn(),
      vi.fn()
    );
    expect(items.filter((i) => i.checked).map((i) => i.id)).toEqual(["machine_z88_OZ50"]);
  });

  it("the real default menu is short: the six defaults plus Select machine…", () => {
    const items = createMachineTypesMenu(
      machineRegistry,
      normalizeMachineFavorites(undefined, machineRegistry),
      "sp48",
      "pal",
      vi.fn(),
      vi.fn()
    );
    expect(items.filter((i) => i.type === "checkbox")).toHaveLength(DEFAULT_MACHINE_FAVORITES.length);
    expect(items.at(-1)!.id).toBe(SELECT_MACHINE_ITEM_ID);
  });
});
