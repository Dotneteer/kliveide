import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { encodePng } from "@common/imaging/png";
import { DISK_A_CHANGES, DISK_A_WP } from "@emu/machines/machine-props";
import { tvcDiskGeometryOf } from "@emu/machines/tvc/TvcDiskImage";
import { createTvcSession, REPO_ROOT, type TvcTestSession } from "../harness/tvc";

/*
 * The HBF floppy interface and VT-DOS (`.plans/VIDEOTON_TVC_PLAN.md` §9.4, Phase 8), on both models:
 * VT-DOS's command line lists a directory, a BASIC program goes to disk and comes back - in the same
 * machine and, through the image the drive publishes, in a fresh one - and the cursor interrupt
 * VT-DOS moves still comes where the CRTC puts the cursor. The directory picture was checked by eye
 * (`TVC_HBF_PNG=<dir>` writes it).
 */

const SYSTEM_DISK = new Uint8Array(readFileSync(join(REPO_ROOT, "_input/videoton-tvc/rtvc/progs/VTDOS-SYSTEM.DSK")));

/** The directory listing's picture, checked by eye */
const DIR_PICTURE = "9a368531c2c1fb04db2aadbc69bde718c66e6515";

function save(s: TvcTestSession, name: string): void {
  const dir = process.env.TVC_HBF_PNG;
  if (dir) writeFileSync(join(dir, `${name}.png`), encodePng(s.screenPixels(), 608, 288));
}

function hashOf(s: TvcTestSession): string {
  const pixels = s.screenPixels();
  return createHash("sha1").update(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength)).digest("hex");
}

async function withDisk(model: string, disk: Uint8Array = SYSTEM_DISK): Promise<TvcTestSession> {
  const s = await createTvcSession({ model, hbf: true });
  s.insertDisk(0, disk);
  return s.bootToBasic({ maxFrames: 1500 });
}

/** The scan line (row x 4 + raster) at which the interrupt flip-flop sets, with interrupts off */
function interruptLine(s: TvcTestSession): number {
  s.machine.pc = 0x6000;
  s.poke(0x6000, [0xf3, 0x18, 0xfe]);
  s.step(1);
  s.wasm.tvcWritePort(0x07, 0);
  for (let i = 0; i < 200_000; i++) {
    s.step(1);
    if (s.wasm.tvcGetItPending() !== 0) {
      const c = s.crtc();
      return c.row * 4 + c.raster;
    }
  }
  throw new Error("No interrupt");
}

describe("TVC HBF card and VT-DOS", () => {
  it("reads the system disk's geometry: 80 cylinders, two sides", () => {
    expect(tvcDiskGeometryOf(SYSTEM_DISK)).toEqual({ cylinders: 80, sides: 2 });
    expect(tvcDiskGeometryOf(new Uint8Array(1024))).toEqual({ error: "notFat" });
  });

  it.each(["tvc64", "tvc64p"])("%s: VT-DOS's command line lists the system disk's directory", async (model) => {
    const s = await withDisk(model);
    const before = hashOf(s);
    s.typeKeys("EXT2\nDIR\n", { settle: 300 });
    save(s, `hbf-dir-${model}`);
    expect(hashOf(s)).not.toBe(before);
    // --- "VT-DOS CLI 1.2", the volume, 13 files and "528K free", checked by eye (the same on both)
    expect(hashOf(s)).toBe(DIR_PICTURE);
    // --- The controller read the directory on drive A, from cylinder 0 (the root's sectors)
    expect(s.wasm.tvcHbfGetDriveCylinder(0)).toBe(0);
    expect(s.wasm.tvcHbfGetFdcCommand() & 0xe0).toBe(0x80);
  });

  it.each(["tvc64", "tvc64p"])("%s: SAVE writes a program to disk, and LOAD brings it back", async (model) => {
    const s = await withDisk(model);
    for (const line of ["10 POKE 24576,42", 'SAVE"KLIVE"', "NEW", 'LOAD"KLIVE"', "RUN"]) s.typeKeys(`${line}\n`, { settle: 150 });
    expect(s.peek(0x6000)).toBe(42);
    // --- The drive published its new image; a fresh machine loads the program from it
    s.runFrames(1);
    const image = (s.machine.getMachineProperty(DISK_A_CHANGES) as Map<number, Uint8Array>).get(-1)!;
    expect(image.length).toBe(SYSTEM_DISK.length);
    const t = await withDisk(model, image);
    t.typeKeys('LOAD"KLIVE"\n', { settle: 150 });
    t.typeKeys("RUN\n", { settle: 30 });
    expect(t.peek(0x6000)).toBe(42);
  });

  it("refuses a disk write while the disk is write-protected", async () => {
    const s = await createTvcSession({ hbf: true });
    s.machine.setMachineProperty(DISK_A_WP, true);
    s.insertDisk(0, SYSTEM_DISK);
    s.bootToBasic({ maxFrames: 1500 });
    s.typeKeys("10 POKE 24576,1\n", { settle: 10 });
    s.typeKeys('SAVE"KLIVE"\n', { settle: 300 });
    s.runFrames(1);
    expect(s.machine.getMachineProperty(DISK_A_CHANGES)).toBeUndefined();
  });

  it("moves the cursor interrupt to line 175, where the CRTC's cursor is (BASIC alone: 239)", async () => {
    const plain = (await createTvcSession()).bootToBasic();
    expect(plain.crtc().registers.slice(14, 16)).toEqual([0x0e, 0xff]);
    expect(interruptLine(plain)).toBe(59 * 4 + 3);
    const s = await withDisk("tvc64");
    expect(s.crtc().registers.slice(14, 16)).toEqual([0x0a, 0xff]);
    expect(interruptLine(s)).toBe(43 * 4 + 3);
  });
});
