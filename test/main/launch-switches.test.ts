import { describe, expect, it } from "vitest";
import { parseLaunchSwitches, resolveLaunchMachine, skipsLastProjectReopen } from "@main/launch-switches";
import { MI_SPECTRUM_128, MI_SPECTRUM_48, MI_ZXNEXT } from "@common/machines/constants";

describe("parseLaunchSwitches", () => {
  it("finds nothing on a plain command line", () => {
    expect(parseLaunchSwitches(["/app/klive", "--noide"])).toEqual({ start: false, errors: [] });
  });

  it("reads --machine with a separate value", () => {
    expect(parseLaunchSwitches(["app", "--machine", "sp128"]).machine).toEqual({
      machineId: "sp128",
      modelId: undefined
    });
  });

  it("reads --machine=<id>:<model>", () => {
    expect(parseLaunchSwitches(["app", "--machine=sp48:ntsc"]).machine).toEqual({
      machineId: "sp48",
      modelId: "ntsc"
    });
  });

  it("reads --start anywhere on the line", () => {
    const result = parseLaunchSwitches(["app", "--start", "--machine", "zxnext"]);
    expect(result.start).toBe(true);
    expect(result.machine?.machineId).toBe("zxnext");
  });

  it("does not take the next switch as the machine", () => {
    const result = parseLaunchSwitches(["app", "--machine", "--start"]);
    expect(result.machine).toBeUndefined();
    expect(result.start).toBe(true);
    expect(result.errors).toHaveLength(1);
  });

  it("reports --machine without a value", () => {
    expect(parseLaunchSwitches(["app", "--machine="]).errors).toHaveLength(1);
    expect(parseLaunchSwitches(["app", "--machine"]).errors).toHaveLength(1);
  });

  it("lets the last --machine win", () => {
    expect(parseLaunchSwitches(["app", "--machine", "sp48", "--machine", "sp128"]).machine?.machineId).toBe("sp128");
  });
});

describe("resolveLaunchMachine", () => {
  it("rejects an unknown machine and lists the known ones", () => {
    const { machine, error } = resolveLaunchMachine({ machineId: "amiga" }, {});
    expect(machine).toBeUndefined();
    expect(error).toContain("amiga");
    expect(error).toContain(MI_SPECTRUM_48);
  });

  it("matches IDs without regard to case and returns the registry's spelling", () => {
    expect(resolveLaunchMachine({ machineId: "ZXNEXT" }, {}).machine).toMatchObject({
      machineId: MI_ZXNEXT,
      modelId: "ks2-30201"
    });
  });

  it("takes a named model", () => {
    expect(resolveLaunchMachine({ machineId: "sp48", modelId: "NTSC" }, {}).machine).toMatchObject({
      machineId: MI_SPECTRUM_48,
      modelId: "ntsc"
    });
  });

  it("rejects an unknown model and lists the machine's models", () => {
    const { error } = resolveLaunchMachine({ machineId: "sp48", modelId: "secam" }, {});
    expect(error).toContain("secam");
    expect(error).toContain("pal-16k");
  });

  it("resolves a retired model id to its replacement", () => {
    expect(resolveLaunchMachine({ machineId: "zxnext", modelId: "compatibility" }, {}).machine?.modelId).toBe(
      "ks2-30201"
    );
    expect(resolveLaunchMachine({ machineId: "zxnext", modelId: "standard" }, {}).machine?.modelId).toBe("ks2-30201");
  });

  it("uses the model a model-less reference means when none is given", () => {
    expect(resolveLaunchMachine({ machineId: "sp128" }, {}).machine?.modelId).toBe("sp128");
  });

  it("keeps the saved model of the same machine when none is given", () => {
    const saved = { machineId: MI_SPECTRUM_48, modelId: "ntsc", config: { rom: "custom" } };
    expect(resolveLaunchMachine({ machineId: "sp48" }, saved).machine).toEqual({
      machineId: MI_SPECTRUM_48,
      modelId: "ntsc",
      config: { rom: "custom" }
    });
  });

  it("keeps the saved configuration only for the saved machine and model", () => {
    const saved = { machineId: MI_SPECTRUM_48, modelId: "pal", config: { rom: "custom" } };
    expect(resolveLaunchMachine({ machineId: "sp48", modelId: "ntsc" }, saved).machine?.config).toBeUndefined();
    expect(resolveLaunchMachine({ machineId: MI_SPECTRUM_128 }, saved).machine?.config).toBeUndefined();
    expect(resolveLaunchMachine({ machineId: "sp48", modelId: "pal" }, saved).machine?.config).toEqual({
      rom: "custom"
    });
  });

  it("rejects a model for a machine without models", () => {
    const registry = [{ machineId: "bare", displayName: "Bare", charSet: {} }];
    expect(resolveLaunchMachine({ machineId: "bare", modelId: "x" }, {}, registry).error).toContain("no models");
    expect(resolveLaunchMachine({ machineId: "bare" }, {}, registry).machine).toEqual({
      machineId: "bare",
      modelId: undefined,
      config: undefined
    });
  });
});

describe("skipsLastProjectReopen", () => {
  it("keeps the reopen without the switches and skips it with either", () => {
    expect(skipsLastProjectReopen(parseLaunchSwitches(["app", "--noide"]))).toBe(false);
    expect(skipsLastProjectReopen(parseLaunchSwitches(["app", "--start"]))).toBe(true);
    expect(skipsLastProjectReopen(parseLaunchSwitches(["app", "--machine", "sp48"]))).toBe(true);
  });
});
