import { describe, expect, it } from "vitest";

import { buildExportDisk } from "@common/diskfs/diskExport";
import { Plus3DosFileSystem } from "@common/diskfs/plus3dos";
import { TrdosFileSystem } from "@common/diskfs/trdos";
import { trdosDiskBootFlow } from "@emu/machines/zxSpectrum128/trdosFlows";
import { createSp128Session, trdosRomFromEnvironment } from "../../harness/sp128";
import { memory, ORACLE_MODEL } from "./plus3Disk";

/*
 * Klive's disk export (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, B6), booted by the machines
 * themselves: the +3's Loader runs `DISK`, which loads the code and starts it; with the developer's
 * own TR-DOS ROM (KLIVE_TRDOS_ROM), TR-DOS boots `boot` the same way.
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

describe("disk export", () => {
  it("lays down the code files and a loader", () => {
    const fs3 = new Plus3DosFileSystem(buildExportDisk("dsk", PROGRAM));
    expect(fs3.list().map((f) => [f.name, f.kind, f.start])).toEqual([
      ["DEMO1.BIN", "code", 32768],
      ["DEMO2.BIN", "code", 50000],
      ["DISK", "basic", 10]
    ]);
    const trd = new TrdosFileSystem(buildExportDisk("trd", PROGRAM));
    expect(trd.list().map((f) => f.name)).toEqual(["demo1.C", "demo2.C", "boot.B"]);
  });

  it("the +3's Loader boots the exported disk and runs the program", async () => {
    const s = await createSp128Session(ORACLE_MODEL);
    s.insertDisk(0, buildExportDisk("dsk", PROGRAM));
    s.runFlow(s.machine.getTapeLoadFlow!(), { checkRom: false });
    for (let frame = 0; frame < 3000 && s.peek(40001) !== 7; frame += 25) s.runFrames(25);
    expect(s.peek(40000)).toBe(42);
    expect(memory(s, 50000, DATA.length)).toEqual(DATA);
    expect(s.border()).toBe(2);
  }, 180_000);

  const rom = trdosRomFromEnvironment();
  it.skipIf(!rom)("TR-DOS boots the exported .trd and runs the program (KLIVE_TRDOS_ROM)", async () => {
    const s = await createSp128Session("pentagon", { trdosRom: rom });
    s.insertDisk(0, buildExportDisk("trd", PROGRAM));
    s.runFlow(trdosDiskBootFlow(), { checkRom: true, maxFrames: 1500 });
    for (let frame = 0; frame < 3000 && s.peek(40001) !== 7; frame += 10) s.runFrames(10);
    expect(s.peek(40000)).toBe(42);
  }, 600_000);

  it("refuses banked code", () => {
    expect(() => buildExportDisk("dsk", { ...PROGRAM, segments: [{ startAddress: 0xc000, emittedCode: [1], bank: 3 }] })).toThrow(
      expect.objectContaining({ code: "unsupported" })
    );
  });
});
