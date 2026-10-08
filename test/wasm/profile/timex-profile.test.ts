import { describe, expect, it } from "vitest";
import { profileLayoutOf } from "@common/profile/layouts";
import { profileOffsetOf } from "@common/profile/layouts/profileLayout";
import { PF_CODE, PF_EXECUTED, PF_READ, PF_WRITTEN } from "@common/profile/profileTypes";
import { createTimexSession } from "../../harness/timex";

/*
 * The access profile on the Timex core (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §2.2, T2): the
 * 48K core built with the SCLD, whose 8K chunks come from HOME, the DOCK or the EXROM. A read and a
 * write land on the chunk's own source - HOME $00000, EXROM $10000, DOCK $12000 - and a write to a
 * read-only chunk (the EXROM, the HOME ROM) lands nowhere.
 */

const layout = profileLayoutOf("timex")!;

/*
 * At $8000 (HOME chunk 4, never paged out here): chunks 6 and 7 external; DOCK selected; read $C000,
 * write $E000; EXROM selected; read $C000, write $C000; back to HOME
 */
const PROGRAM = [
  0xf3, // di
  0x3e, 0xc0, 0xd3, 0xf4, // ld a,$c0 / out ($f4),a
  0xaf, 0xd3, 0xff, // xor a / out ($ff),a
  0x3a, 0x00, 0xc0, // ld a,($c000)
  0x32, 0x00, 0xe0, // ld ($e000),a
  0x3e, 0x80, 0xd3, 0xff, // ld a,$80 / out ($ff),a
  0x3a, 0x00, 0xc0, // ld a,($c000)
  0x32, 0x00, 0xc0, // ld ($c000),a
  0xaf, 0xd3, 0xf4, // xor a / out ($f4),a
  0x32, 0x00, 0x10, // ld ($1000),a
  0x76 // halt
];

describe("the Timex's access profile", () => {
  it("credits each chunk's own source, and maps read-only writes nowhere (T2)", async () => {
    // --- A 24K 2068 ROM image: the HOME ROM and the 8K EXROM
    const s = await createTimexSession({ model: "ts2068", rom: { bytes: new Uint8Array(0x6000) } });
    s.exports.timexDockSetChunkType(6, 3);
    s.exports.timexDockSetChunkType(7, 3);
    s.poke(0x8000, PROGRAM);
    s.machine.resetProfile();
    s.machine.setProfiling(true, true);
    s.machine.pc = 0x8000;
    for (let i = 0; i < 40 && s.exports.sp48GetCpuHalted() === 0; i++) s.step(1);
    s.machine.setProfiling(false, true);
    expect(s.exports.sp48GetCpuHalted()).not.toBe(0);

    const flag = (offset: number) => s.machine.readProfileFlags(offset, 1)![0];
    // --- The code ran in HOME
    expect(flag(0x8000)).toBe(PF_EXECUTED | PF_CODE);
    // --- DOCK chunk 6 read, DOCK chunk 7 written
    expect(flag(0x12000 + 0xc000)).toBe(PF_READ);
    expect(flag(0x12000 + 0xe000)).toBe(PF_WRITTEN);
    // --- The EXROM read at its own 8K, its write nowhere
    expect(flag(0x10000)).toBe(PF_READ);
    // --- HOME's own $C000/$E000 were paged out the whole time; the HOME ROM ignored the write
    expect(flag(0xc000)).toBe(0);
    expect(flag(0xe000)).toBe(0);
    expect(flag(0x1000)).toBe(0);

    // --- The layout names the same offsets: DOCK D6 and EXROM X6 at $C000
    expect(profileOffsetOf(layout, 8 + 6, 0xc000)).toBe(0x12000 + 0xc000);
    expect(profileOffsetOf(layout, -(3 + 6), 0xc000)).toBe(0x10000);
    expect(profileOffsetOf(layout, undefined, 0x8000)).toBe(0x8000);
  });
});
