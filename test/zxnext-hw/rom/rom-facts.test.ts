import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { NEXT_ROM_FILES, NEXT_ROM_SETS, type NextRomSetId } from "@common/zxnext/romSets";
import { nextRomFile } from "../../harness/zxnext/core/roms";

/*
 * The ROM facts Klive's code depends on (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D6), proved against
 * the bytes of every ROM set it ships, so a new ROM set cannot silently break code injection or tape
 * loading.
 *
 * - The key-wait loop (`nextMachineInfo.ts`'s code-injection flow): a HALT at `mainWaitingLoop`,
 *   inside the loop's bounds, and a `JR` back to the loop's start before its end.
 * - The tape trap (`zxnext-tape.c`): ROM 3 holds the 48K ROM's LD-BYTES ($0556-$0604) byte for byte,
 *   and SA-BYTES up to its exit ($04C2-$054F; NextZXOS 2.08 changes four bytes at $0550-$0553, in
 *   SA/LD-RET, which the trap never runs), and the trapped addresses are the 48K ROM's own.
 */

const PAGE = 0x4000;
const SP48 = new Uint8Array(readFileSync(join(__dirname, "../../../src/public/roms/sp48.rom")));
/* The 48K ROM's tape routines the trap depends on, and the points it uses */
const SP48_TAPE_RANGES: Array<[from: number, to: number]> = [
  [0x04c2, 0x054f], // SA-BYTES, up to SA/LD-RET
  [0x0556, 0x0604] // LD-BYTES
];
const SP48_TAPE = { loadBytes: 0x056c, loadBytesInvalidHeader: 0x05b6, loadBytesResume: 0x05e2, saveBytes: 0x04c2 };

const page = (bytes: Uint8Array, index: number) => bytes.subarray(index * PAGE, (index + 1) * PAGE);

describe.each(Object.keys(NEXT_ROM_SETS) as NextRomSetId[])("ROM facts of %s", (setId) => {
  const { facts } = NEXT_ROM_SETS[setId];
  const nextRom = new Uint8Array(readFileSync(nextRomFile(NEXT_ROM_FILES.nextRom, setId)));
  const rom0 = page(nextRom, 0);
  const rom3 = page(nextRom, 3);

  it("ROM 0: the key-wait loop's HALT is inside the loop, which jumps back to its start", () => {
    const [from, to] = facts.keyWaitLoop;
    expect(from).toBeLessThan(to);
    expect(facts.mainWaitingLoop).toBeGreaterThanOrEqual(from);
    expect(facts.mainWaitingLoop).toBeLessThanOrEqual(to);
    expect(rom0[facts.mainWaitingLoop], "HALT").toBe(0x76);
    const jumpsBack = Array.from({ length: to - from }, (_, i) => from + i).some(
      (address) => rom0[address] === 0x18 && address + 2 + ((rom0[address + 1] << 24) >> 24) === from
    );
    expect(jumpsBack, `a JR to $${from.toString(16)} inside the loop`).toBe(true);
  });

  it("ROM 3: the 48K ROM's tape routines, byte for byte, at the addresses the trap uses", () => {
    for (const [from, to] of SP48_TAPE_RANGES) {
      expect(Array.from(rom3.subarray(from, to + 1)), `$${from.toString(16)}-$${to.toString(16)}`).toEqual(
        Array.from(SP48.subarray(from, to + 1))
      );
    }
    expect(facts.ldBytes).toEqual({
      loadBytes: SP48_TAPE.loadBytes,
      loadBytesInvalidHeader: SP48_TAPE.loadBytesInvalidHeader,
      loadBytesResume: SP48_TAPE.loadBytesResume,
      saveBytes: SP48_TAPE.saveBytes
    });
  });
});
