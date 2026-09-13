import { describe, expect, it } from "vitest";
import { machineRegistry } from "@common/machines/machine-registry";
import {
  MF_INJECT_SUPPORT,
  MI_C64,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_Z88,
  MI_ZXNEXT
} from "@common/machines/constants";

/**
 * Which machines can take injected code.
 *
 * The ZX Spectrum Next cannot: a Next build is delivered as a `.nex` file the machine loads for
 * itself, so "inject into the paused machine" has no meaning there. Before this feature existed
 * that was expressed as an `isZxNext` special case buried in `injectCode`, which neither the
 * document header nor the `inject` command could see.
 *
 * These are here mostly so the `false` cannot be lost in a registry edit: it is the one value in
 * the table that changes what the UI offers.
 */
describe("MF_INJECT_SUPPORT", () => {
  const featureOf = (machineId: string) =>
    machineRegistry.find((mi) => mi.machineId === machineId)?.features?.[MF_INJECT_SUPPORT];

  it("is declared false for the ZX Spectrum Next", () => {
    expect(featureOf(MI_ZXNEXT)).toBe(false);
  });

  it.each([
    ["ZX Spectrum 48K", MI_SPECTRUM_48],
    ["ZX Spectrum 128K", MI_SPECTRUM_128],
    ["ZX Spectrum +3E", MI_SPECTRUM_3E],
    ["Cambridge Z88", MI_Z88],
    ["Commodore 64", MI_C64]
  ])("is declared true for %s", (_name, machineId) => {
    expect(featureOf(machineId)).toBe(true);
  });

  it("is stated explicitly by every machine in the registry", () => {
    // --- The consumers read it with `?? true`, so an omission is silent: the machine simply keeps
    // --- offering a button that may not work. Requiring the declaration is what makes a new
    // --- machine answer the question.
    const undeclared = machineRegistry
      .filter((mi) => mi.features?.[MF_INJECT_SUPPORT] === undefined)
      .map((mi) => mi.machineId);
    expect(undeclared).toEqual([]);
  });

  it("is a boolean wherever it is declared", () => {
    for (const mi of machineRegistry) {
      expect(typeof mi.features?.[MF_INJECT_SUPPORT]).toBe("boolean");
    }
  });
});
