import { describe, expect, it } from "vitest";

import { machineRegistry } from "@common/machines/machine-registry";
import { DEFAULT_MACHINE_FAVORITES } from "@common/machines/machine-favorites";
import {
  FAVORITES_SECTION,
  MachineSelectEvent,
  createInitialState,
  reduce,
  saveResult,
  switchResult
} from "@renderer/appIde/dialogs/machineSelect/MachineSelectModel";
import {
  buildCatalogue,
  formatKb,
  formatMhz,
  selectViewModel
} from "@renderer/appIde/dialogs/machineSelect/MachineSelectViewModel";

/*
 * The Select Machine dialog, driven by its events without rendering
 * (.plans/MACHINE_SELECT_DIALOG_PLAN.md §4).
 */

const catalogue = buildCatalogue(machineRegistry);

function open(favorites: unknown = undefined, current = { machineId: "spp3e", modelId: "fdd1" }) {
  let state = createInitialState({ favorites: favorites as any, current }, machineRegistry);
  return {
    get state() {
      return state;
    },
    get vm() {
      return selectViewModel(state, catalogue);
    },
    do(...events: MachineSelectEvent[]) {
      for (const e of events) state = reduce(state, e);
      return this;
    }
  };
}

const favKeys = (h: ReturnType<typeof open>) => {
  const fav = h.vm.sections.find((s) => s.kind === "favorites");
  return fav && fav.kind === "favorites" ? fav.rows.map((r) => r.key + (r.separatorAfter ? " |" : "")) : [];
};

describe("Select Machine dialog", () => {
  it("opens on the running model, with its section and the favourites open", () => {
    const h = open();
    expect(h.state.selectedKey).toBe("spp3e/fdd1");
    expect(h.vm.sheet?.name).toBe("ZX Spectrum +3E (1 FDD)");
    expect(h.vm.sheet?.running).toBe(true);
    const spp3e = h.vm.sections.find((s) => s.id === "spp3e")!;
    expect(spp3e.kind === "machine" && spp3e.open).toBe(true);
    expect(h.vm.sections[0]).toMatchObject({ kind: "favorites", open: true });
    expect(h.vm.switchEnabled).toBe(false);
    expect(h.vm.saveEnabled).toBe(false);
  });

  it("lists every machine type in registry order; single-model ones are leaves", () => {
    const h = open();
    const sections = h.vm.sections.filter((s) => s.kind !== "favorites");
    expect(sections.map((s) => s.id)).toEqual(machineRegistry.map((m) => m.machineId));
    expect(sections.filter((s) => s.kind === "leaf").map((s) => s.id)).toEqual(["zxnext", "scorpion"]);
    const z88 = sections.find((s) => s.id === "z88")!;
    expect(z88.kind === "machine" && z88.rows).toHaveLength(10);
  });

  it("toggles sections independently; several can be open", () => {
    const h = open().do(
      { type: "sectionToggled", sectionId: "z88" },
      { type: "sectionToggled", sectionId: "zx81" }
    );
    const isOpen = (id: string) => {
      const s = h.vm.sections.find((x) => x.id === id)!;
      return s.kind !== "leaf" && s.open;
    };
    expect([isOpen("spp3e"), isOpen("z88"), isOpen("zx81"), isOpen(FAVORITES_SECTION)]).toEqual([true, true, true, true]);
    h.do({ type: "sectionToggled", sectionId: "z88" }, { type: "sectionToggled", sectionId: FAVORITES_SECTION, open: false });
    expect([isOpen("z88"), isOpen(FAVORITES_SECTION)]).toEqual([false, false]);
  });

  it("marks a closed section that holds the running model", () => {
    const h = open().do({ type: "sectionToggled", sectionId: "spp3e" });
    const s = h.vm.sections.find((x) => x.id === "spp3e")!;
    expect(s.kind === "machine" && !s.open && s.containsRunning).toBe(true);
  });

  it("filters on name, RAM, standard, media and ROM; hides the favourites while filtering", () => {
    const h = open().do({ type: "filterChanged", text: "ntsc" });
    expect(h.vm.sections.some((s) => s.kind === "favorites")).toBe(false);
    const keys = h.vm.sections.flatMap((s) => (s.kind === "leaf" ? [s.row.key] : s.kind === "machine" ? s.rows.map((r) => r.key) : []));
    expect(keys).toEqual(["sp48/ntsc", "zxnext/standard", "timex/ts2068", "zx81/zx81-16k-us", "zx81/zx81-1k-us", "c64/ntsc"]);
    expect(h.vm.sections.every((s) => s.kind === "leaf" || s.open)).toBe(true);

    h.do({ type: "filterChanged", text: "z88 128k" });
    const z88 = h.vm.sections.find((s) => s.id === "z88")!;
    expect(z88.kind === "machine" && z88.rows.map((r) => r.key)).toEqual(["z88/OZ40", "z88/OZ40FI"]);

    // --- The +2A/+3/+3E's drives, and the Pentagon's Beta 128
    h.do({ type: "filterChanged", text: "disk" });
    expect(h.vm.sections.map((s) => s.id)).toEqual(["sp128", "spp3e", "scorpion"]);

    h.do({ type: "filterChanged", text: "nothing-like-this" });
    expect(h.vm.noMatch).toBe(true);
  });

  it("stars and unstars a model; the star shows in both places", () => {
    const h = open().do({ type: "favoriteToggled", key: "c64/pal" });
    expect(favKeys(h).at(-1)).toBe("c64/pal");
    const c64 = h.vm.sections.find((s) => s.id === "c64")!;
    expect(c64.kind === "machine" && c64.rows[0].favorite).toBe(true);
    expect(h.vm.dirty).toBe(true);
    h.do({ type: "favoriteToggled", key: "c64/pal" });
    expect(favKeys(h)).not.toContain("c64/pal");
    expect(h.vm.dirty).toBe(false);
  });

  it("reorders favourites with the buttons and by dropping, keeping separators with their item", () => {
    const h = open();
    expect(favKeys(h)).toEqual(["sp48/pal", "sp128/sp128", "spp3e/fdd1 |", "zxnext/standard |", "z88/OZ50", "zx81/zx81-16k"]);
    h.do({ type: "favoriteMoved", key: "sp48/pal", delta: -1 });
    expect(favKeys(h)[0]).toBe("sp48/pal");
    h.do({ type: "favoriteMoved", key: "spp3e/fdd1", delta: -1 });
    expect(favKeys(h).slice(0, 3)).toEqual(["sp48/pal", "spp3e/fdd1 |", "sp128/sp128"]);
    h.do({ type: "favoriteDropped", key: "zx81/zx81-16k", beforeKey: "sp48/pal" });
    expect(favKeys(h)[0]).toBe("zx81/zx81-16k");
  });

  it("drops the separator of whatever ends up last, and cannot add one there", () => {
    const h = open().do({ type: "favoriteMoved", key: "zxnext/standard", delta: 2 });
    expect(favKeys(h).at(-1)).toBe("zxnext/standard");
    const before = favKeys(h);
    h.do({ type: "separatorToggled", key: "zxnext/standard" });
    expect(favKeys(h)).toEqual(before);
    const fav = h.vm.sections[0];
    expect(fav.kind === "favorites" && fav.rows.at(-1)!.canToggleSeparator).toBe(false);
  });

  it("toggles a separator, removes a favourite, restores the defaults", () => {
    const h = open()
      .do({ type: "separatorToggled", key: "sp48/pal" })
      .do({ type: "separatorToggled", key: "spp3e/fdd1" })
      .do({ type: "favoriteRemoved", key: "sp128/sp128" });
    expect(favKeys(h).slice(0, 2)).toEqual(["sp48/pal |", "spp3e/fdd1"]);
    h.do({ type: "defaultsRestored" });
    expect(h.state.favorites).toEqual(DEFAULT_MACHINE_FAVORITES.map((f) => ({ ...f })));
    expect(h.vm.dirty).toBe(false);
  });

  it("Save returns the favourites; Switch returns the model and only changed favourites", () => {
    const h = open().do({ type: "modelSelected", key: "zx80/zx80-1k" });
    expect(h.vm.switchEnabled).toBe(true);
    expect(h.vm.switchLabel).toBe("Switch to Sinclair ZX80 (1K)");
    expect(switchResult(h.state)).toEqual({ switchTo: { machineId: "zx80", modelId: "zx80-1k" } });

    h.do({ type: "favoriteToggled", key: "zx80/zx80-1k" });
    const result = switchResult(h.state)!;
    expect(result.favorites!.at(-1)).toEqual({ machineId: "zx80", modelId: "zx80-1k" });
    expect(saveResult(h.state).favorites).toEqual(result.favorites);

    h.do({ type: "modelSelected", key: "sp128/pentagon" });
    expect(switchResult(h.state)!.switchTo).toEqual({ machineId: "sp128", modelId: "pentagon" });
    h.do({ type: "modelSelected", key: "spp3e/fdd1" });
    expect(switchResult(h.state)).toBeUndefined();
  });

  it("keeps an emptied favourites list empty", () => {
    const h = open([]);
    const fav = h.vm.sections[0];
    expect(fav.kind === "favorites" && fav.rows).toEqual([]);
    expect(saveResult(h.do({ type: "favoriteToggled", key: "sp128/pentagon" }).state).favorites).toEqual([
      { machineId: "sp128", modelId: "pentagon" }
    ]);
  });

  it("opens a 128K running without a model ID (a session from before its models) on the 128K model", () => {
    const h = open(undefined, { machineId: "sp128" });
    expect(h.state.runningKey).toBe("sp128/sp128");
    expect(h.vm.sheet?.name).toBe("ZX Spectrum 128K");
  });

  it("lists the Pentagon 128 as a model of the 128K, with its own hardware sheet", () => {
    const h = open(undefined, { machineId: "sp128", modelId: "pentagon" });
    expect(h.state.runningKey).toBe("sp128/pentagon");
    const sp128 = h.vm.sections.find((s) => s.id === "sp128")!;
    expect(sp128.kind === "machine" && sp128.rows.map((r) => r.key)).toEqual(["sp128/sp128", "sp128/pentagon"]);
    expect(h.vm.sheet?.name).toBe("Pentagon 128");
  });

  it("formats the hardware sheet", () => {
    const h = open().do({ type: "modelSelected", key: "sp48/ntsc" });
    const sheet = h.vm.sheet!;
    expect(sheet.idLabel).toBe("sp48 / ntsc");
    expect(sheet.chips).toEqual(["Zilog Z80", "48K RAM", "NTSC", "Tape"]);
    const group = (id: string) => Object.fromEntries(sheet.groups.find((g) => g.id === id)!.rows.map((r) => [r.label, r.value]));
    expect(group("processor").Clock).toBe("3,527,500 Hz");
    expect(group("timing")["T-states / frame"]).toBe("59,136");
    expect(group("timing")["Frame rate"]).toBe("59.65 Hz");
    expect(sheet.screen).toMatchObject({ rasterWidth: 352, rasterHeight: 240, caption: "352 × 240 with border" });

    h.do({ type: "modelSelected", key: "zxnext/standard" });
    const next = h.vm.sheet!;
    const timing = Object.fromEntries(next.groups.find((g) => g.id === "timing")!.rows.map((r) => [r.label, r.value]));
    expect(timing["Frame rate"]).toBe("50 or 60 Hz");
    expect(timing["T-states / frame"]).toBe("—");
    const memory = next.groups.find((g) => g.id === "memory")!.rows;
    expect(memory.find((r) => r.label === "Banks")!.value).toBe("224 × 8K");
    expect(memory.find((r) => r.label === "RAM")!.value).toBe("1,792K");

    expect([formatKb(16), formatKb(2048), formatMhz(985_248)]).toEqual(["16K", "2 MB", "0.985248"]);
  });
});
