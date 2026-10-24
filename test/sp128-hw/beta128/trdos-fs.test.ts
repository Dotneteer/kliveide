import { describe, expect, it } from "vitest";

import { TrdosFileSystem } from "@common/diskfs/trdos";
import { createBlankTrd } from "@emu/machines/disk/trd/trdImage";
import { trdosDiskBootFlow } from "@emu/machines/zxSpectrum128/trdosFlows";
import { createSp128Session, trdosRomFromEnvironment } from "../../harness/sp128";

/*
 * The Disk Explorer's TR-DOS edits judged by TR-DOS itself (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md,
 * B3). Like `trdos.test.ts`, only with the developer's own ROM:
 *
 *   KLIVE_TRDOS_ROM=/path/to/trdos.rom npm test -- test/sp128-hw/beta128/trdos-fs.test.ts
 *
 * A file deleted and the disk compacted, the file after it moves down; TR-DOS must still find it.
 */

const rom = trdosRomFromEnvironment();

const T = { CODE: 0xaf, USR: 0xc0, REM: 0xea, LOAD: 0xef, POKE: 0xf4, RANDOMIZE: 0xf9 };
const num = (value: number) => [...Array.from(String(value), (c) => c.charCodeAt(0)), 0x0e, 0, 0, value & 0xff, value >> 8, 0];
const str = (text: string) => [0x22, ...Array.from(text, (c) => c.charCodeAt(0)), 0x22];
const line = (number: number, body: number[]) => {
  const content = [...body, 0x0d];
  return [number >> 8, number & 0xff, content.length & 0xff, content.length >> 8, ...content];
};
/**
 * A TR-DOS command line: `RANDOMIZE USR 15619: REM : <command>`. The ROM checks a line's syntax only
 * up to REM, so the command's numbers are digits alone, without the hidden 5-byte form `num` adds;
 * TR-DOS reads the text itself and reports "Nonsense in BASIC" at a $0E
 */
const digits = (value: number) => Array.from(String(value), (c) => c.charCodeAt(0));
const trdos = (command: number[]) => [T.RANDOMIZE, T.USR, ...num(15619), 0x3a, T.REM, 0x3a, ...command];

const KEPT = Uint8Array.from({ length: 900 }, (_, i) => (i * 13 + 1) & 0xff);

describe.skipIf(!rom)("TR-DOS reads a disk the Disk Explorer compacted (KLIVE_TRDOS_ROM)", () => {
  it("loads a file that compaction moved", async () => {
    const trd = new TrdosFileSystem(createBlankTrd({ cylinders: 80, sides: 2 }, "KLIVE"));
    trd.write({ name: "gone", kind: "code", data: new Uint8Array(4000), start: 30000 });
    trd.write({ name: "kept", kind: "code", data: KEPT, start: 50000 });
    trd.write({
      name: "boot",
      kind: "basic",
      start: 10,
      data: new Uint8Array([
        ...line(10, trdos([T.LOAD, ...str("kept"), T.CODE, ...digits(50000)])),
        ...line(20, [T.POKE, ...num(40000), 0x2c, ...num(42)])
      ])
    });
    trd.delete("gone.C");
    trd.compact();
    expect(trd.list().map((f) => f.name)).toEqual(["kept.C", "boot.B"]);

    const s = await createSp128Session("pentagon", { trdosRom: rom });
    s.insertDisk(0, trd.image());
    s.runFlow(trdosDiskBootFlow(), { checkRom: true, maxFrames: 1500 });
    for (let frame = 0; frame < 3000 && s.peek(40000) !== 42; frame += 10) s.runFrames(10);
    expect(s.peek(40000)).toBe(42);
    expect(Array.from({ length: KEPT.length }, (_, i) => s.peek(50000 + i))).toEqual(Array.from(KEPT));
  }, 600_000);
});
