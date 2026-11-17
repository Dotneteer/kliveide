import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/*
 * Every way to a ZX Spectrum Next goes through the SD card gate (`dev/plans/NEXT_SD_CARDS_PLAN.md`,
 * phase 5): the machine's setup runs before the emulator switches. The main process switches only
 * through `changeMachineType` (`registeredMachines.ts`), which runs the setup; the emulator's own
 * switches that may land on a Next (a machine state file, a debug recording) ask the main process to
 * run it first. These read the sources: the entry points pull in the whole app.
 */

const ROOT = path.join(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

describe("the entry points to a machine", () => {
  it("switch the emulator from the main process only in registeredMachines.ts", () => {
    const hits = execFileSync("git", ["grep", "-l", "-E", "getEmuApi\\(\\)\\s*\\.setMachineType\\(", "--", "src/main"], {
      cwd: ROOT,
      encoding: "utf8"
    })
      .trim()
      .split("\n");
    expect(hits).toEqual(["src/main/registeredMachines.ts"]);
  });

  it("run the machine's setup before the emulator applies a change", () => {
    const source = read("src/main/registeredMachines.ts");
    expect(source.indexOf("machineInfo?.setup?.(modelId)")).toBeGreaterThan(-1);
    expect(source.indexOf("machineInfo?.setup?.(modelId)")).toBeLessThan(source.indexOf("getEmuApi().setMachineType("));
  });

  it("gate a machine state file and a debug recording in the emulator", () => {
    const source = read("src/renderer/appEmu/MainToEmuProcessor.ts");
    const ports = source.slice(source.indexOf("private machineStatePorts()"));
    expect(ports.indexOf("prepareMachine(machineId, modelId)")).toBeGreaterThan(-1);
    expect(ports.indexOf("prepareMachine(machineId, modelId)")).toBeLessThan(ports.indexOf("this.machineService.setMachineType"));
  });

  it("gate the Next through its setup in the machine menu registry", () => {
    expect(read("src/main/machine-menus/machine-menu-registry.ts")).toMatch(/setup:\s*setupZxSpectrumNext/);
  });
});
