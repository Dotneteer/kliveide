import { describe, expect, it } from "vitest";

import { machineRegistry } from "@common/machines/machine-registry";
import { getHardwareSpec } from "@common/machines/hardware-specs";
import { ZxSpectrumP3eWasmV2Machine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine";
import { C64Machine } from "@emu/machines/c64/C64Machine";

/*
 * The Select Machine dialog's hardware sheet reads `hardware-specs.ts`. These tests keep that table
 * complete and in step with the machines (plan §5.1b). The ZX Spectrum 48K and 128K need their WASM
 * core loaded to report timings, so they are checked in the e2e tier:
 * `hardware-specs-cores.test.ts`.
 */

const allModels = machineRegistry.flatMap((machine) =>
  machine.models?.length
    ? machine.models.map((model) => ({ machine, modelId: model.modelId as string | undefined }))
    : [{ machine, modelId: undefined as string | undefined }]
);

describe("hardware specs", () => {
  it.each(allModels.map((m) => [`${m.machine.machineId}/${m.modelId ?? ""}`, m] as const))(
    "%s has a complete spec",
    (_, { machine, modelId }) => {
      const spec = getHardwareSpec(machine, modelId)!;
      expect(spec, "add the machine to HARDWARE_SPECS").toBeDefined();
      expect(spec.cpu).not.toBe("");
      expect(spec.clockHz).toBeGreaterThan(900_000);
      expect(spec.ramKb).toBeGreaterThan(0);
      expect(spec.display.width).toBeGreaterThan(0);
      expect(spec.display.rasterWidth).toBeGreaterThanOrEqual(spec.display.width);
      expect(spec.display.rasterHeight).toBeGreaterThanOrEqual(spec.display.height);
      expect(spec.input.length + spec.media.length).toBeGreaterThan(0);
    }
  );

  it("does not invent a model", () => {
    const sp48 = machineRegistry.find((m) => m.machineId === "sp48")!;
    expect(getHardwareSpec(sp48, "nope")).toBeUndefined();
    expect(getHardwareSpec({ ...sp48, machineId: "unknown" })).toBeUndefined();
  });

  it("resolves RAM, ROM, drives, keyboard and standard from the registry", () => {
    const get = (machineId: string, modelId?: string) =>
      getHardwareSpec(machineRegistry.find((m) => m.machineId === machineId)!, modelId)!;

    expect(get("sp48", "pal-16k").ramKb).toBe(16);
    expect(get("sp48", "ntsc").standard).toBe("NTSC");
    expect(get("sp48", "ntsc").timing.frameHz).toBeCloseTo(59.65, 2);
    expect(get("sp128").bankCount).toBe(8);
    expect(get("spp3e", "nofdd").media).toContain("No floppy drive");
    expect(get("spp3e", "fdd2").media).toContain("Floppy disk drives A and B (DSK)");
    expect(get("z88", "OZ50").ramKb).toBe(512);
    expect(get("z88", "OZ30").ramKb).toBe(32);
    expect(get("z88", "OZ40").rom).toEqual([{ id: "z88ukv40", kb: 128, role: "OZ" }]);
    expect(get("z88", "OZ40FI").input[0].value).toContain("Swedish/Finnish");
    expect(get("z88", "OZ50").timing.frameHz).toBe(200);
    expect(get("z88", "OZ50").timing.displayHz).toBe(25);
    expect(get("zx81", "zx81-1k").ramKb).toBe(1);
    expect(get("zx81", "zx81-16k-us").standard).toBe("NTSC");
    expect(get("zx81", "zx81-16k-us").timing.frameHz).toBeCloseTo(60, 1);
    expect(get("zx80", "zx80-8krom-16k").rom[0].id).toBe("zx81");
    expect(get("zx80", "zx80-16k").rom[0]).toEqual({ id: "zx80", kb: 4 });
    expect(get("zxnext", "standard").clockMultiplier).toBe(false);
    expect(get("zxnext", "standard").timing.frameHz).toBeUndefined();
    expect(get("sp48", "pal").clockMultiplier).toBe(true);
  });

  it.each(["nofdd", "fdd1", "fdd2"])("+2E/+3E %s matches the machine", (modelId) => {
    const info = machineRegistry.find((m) => m.machineId === "spp3e")!;
    const model = info.models!.find((m) => m.modelId === modelId)!;
    const machine = new ZxSpectrumP3eWasmV2Machine(model, model.config);
    const spec = getHardwareSpec(info, modelId)!;
    expect(spec.clockHz).toBe(machine.baseClockFrequency);
    expect(spec.timing.perFrame).toBe(machine.tactsInFrame);
    expect([spec.display.rasterWidth, spec.display.rasterHeight]).toEqual([
      machine.screenWidthInPixels,
      machine.screenHeightInPixels
    ]);
  });

  it.each(["pal", "ntsc"])("C64 %s matches the machine", (modelId) => {
    const info = machineRegistry.find((m) => m.machineId === "c64")!;
    const model = info.models!.find((m) => m.modelId === modelId)!;
    const machine = new C64Machine(model);
    const spec = getHardwareSpec(info, modelId)!;
    expect(spec.clockHz).toBe(machine.baseClockFrequency);
    expect(spec.timing.perFrame).toBe(machine.tactsInFrame);
    expect([spec.display.rasterWidth, spec.display.rasterHeight]).toEqual([
      machine.screenWidthInPixels,
      machine.screenHeightInPixels
    ]);
  });
});
