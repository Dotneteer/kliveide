import { describe, expect, it } from "vitest";

import { machineRegistry } from "@common/machines/machine-registry";
import {
  DEFAULT_MACHINE_FAVORITES,
  favoriteKey,
  normalizeMachineFavorites,
  resolveMachineModel
} from "@common/machines/machine-favorites";

describe("normalizeMachineFavorites", () => {
  it("gives the defaults when the setting was never written", () => {
    expect(normalizeMachineFavorites(undefined, machineRegistry)).toEqual(
      DEFAULT_MACHINE_FAVORITES.map((f) => ({ ...f }))
    );
    expect(normalizeMachineFavorites(null, machineRegistry)).toHaveLength(DEFAULT_MACHINE_FAVORITES.length);
  });

  it("every default names a registered model", () => {
    for (const f of DEFAULT_MACHINE_FAVORITES) {
      expect(resolveMachineModel(machineRegistry, f.machineId, f.modelId), favoriteKey(f)).toBeDefined();
    }
  });

  it("keeps an empty list empty (the user removed every favourite)", () => {
    expect(normalizeMachineFavorites([], machineRegistry)).toEqual([]);
  });

  it("falls back to the defaults for a value that is not a list", () => {
    expect(normalizeMachineFavorites({ x: 1 }, machineRegistry)).toHaveLength(DEFAULT_MACHINE_FAVORITES.length);
    expect(normalizeMachineFavorites("sp48", machineRegistry)).toHaveLength(DEFAULT_MACHINE_FAVORITES.length);
  });

  it("drops unknown machines and models, garbage entries, and a model on a model-less machine", () => {
    const result = normalizeMachineFavorites(
      [
        { machineId: "nope" },
        { machineId: "sp48", modelId: "nope" },
        { machineId: "sp48" },
        { machineId: "sp128", modelId: "pal" },
        42,
        null,
        { machineId: 7 },
        { machineId: "zx81", modelId: "zx81-1k" }
      ],
      machineRegistry
    );
    expect(result).toEqual([{ machineId: "zx81", modelId: "zx81-1k" }]);
  });

  it("resolves model aliases and keeps the first of duplicates", () => {
    const result = normalizeMachineFavorites(
      [
        { machineId: "z88", modelId: "OZ47-wasm", separatorAfter: true },
        { machineId: "z88", modelId: "OZ47" },
        { machineId: "sp128" }
      ],
      machineRegistry
    );
    // --- A model-less 128K entry, saved before the 128K had models, means its "sp128" model
    expect(result).toEqual([
      { machineId: "z88", modelId: "OZ47", separatorAfter: true },
      { machineId: "sp128", modelId: "sp128" }
    ]);
  });

  it("removes the separator from the last entry, and ignores non-true separator values", () => {
    const result = normalizeMachineFavorites(
      [
        { machineId: "sp48", modelId: "pal", separatorAfter: "yes" },
        { machineId: "sp128", separatorAfter: true }
      ],
      machineRegistry
    );
    expect(result).toEqual([{ machineId: "sp48", modelId: "pal" }, { machineId: "sp128", modelId: "sp128" }]);
  });
});
