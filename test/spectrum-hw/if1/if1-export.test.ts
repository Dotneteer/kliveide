import { describe, expect, it } from "vitest";

import { buildExportDisk } from "@common/diskfs/diskExport";
import { MicrodriveFileSystem } from "@common/diskfs/mdrfs";
import { sp128MicrodriveBootFlow, sp48MicrodriveBootFlow } from "@emu/machines/zxSpectrum/if1/microdriveBootFlows";
import { createSp128Session } from "../../harness/sp128";
import { sp48WithInterface1 } from "./if1TestSupport";

/*
 * `expc -f mdr` (`.plans/MICRODRIVE_PLAN.md` Phase 4.4): a compiled program as a bootable cartridge -
 * its code files and a loader named "run" - booted by the Microdrive Loader on both machines.
 */

/** LD A,42 / LD (40000),A / LD A,7 / LD (40001),A / RET */
const CODE = [0x3e, 0x2a, 0x32, 0x40, 0x9c, 0x3e, 0x07, 0x32, 0x41, 0x9c, 0xc9];
const DATA = Array.from({ length: 2000 }, (_, i) => (i * 7) & 0xff);
const PROGRAM = {
  name: "demo",
  entryAddress: 32768,
  clear: true,
  border: 2,
  segments: [
    { startAddress: 32768, emittedCode: CODE },
    { startAddress: 50000, emittedCode: DATA }
  ]
};

describe("Microdrive export", () => {
  it("lays down the code files and the loader run", () => {
    const fs = new MicrodriveFileSystem(buildExportDisk("mdr", PROGRAM));
    expect(fs.info().label).toBe("demo");
    expect(fs.list().map((f) => [f.name, f.kind, f.start])).toEqual([
      ["demo1", "code", 32768],
      ["demo2", "code", 50000],
      ["run", "basic", 10]
    ]);
  });

  it("the 48K's Loader boots it: the loader loads the code and starts it", async () => {
    const s = (await sp48WithInterface1()).insertCartridge(0, buildExportDisk("mdr", PROGRAM));
    s.typeFlowKeys(sp48MicrodriveBootFlow()).runFrames(1500);
    expect(s.peek(40000)).toBe(42);
    expect(s.peek(40001)).toBe(7);
    for (let i = 0; i < DATA.length; i += 97) expect(s.peek(50000 + i)).toBe(DATA[i]);
  }, 120_000);

  it("the 128K's Loader boots it from 128 BASIC", async () => {
    const s = await createSp128Session("sp128");
    s.connectInterface1().insertCartridge(0, buildExportDisk("mdr", PROGRAM));
    s.runFlow(sp128MicrodriveBootFlow());
    s.runFrames(1500);
    expect(s.peek(40000)).toBe(42);
    expect(s.peek(40001)).toBe(7);
  }, 120_000);
});
