import { describe, expect, it } from "vitest";

import { PF_CODE, PF_EXECUTED, PF_READ, PF_WRITTEN } from "@common/profile/profileTypes";
import { profileLocationOf, profileOffsetOf } from "@common/profile/layouts/profileLayout";
import { tvcProfileLayout } from "@common/profile/layouts/tvc";
import { historyContextDecoder } from "@common/history/contexts";
import { createTvcSession, type TvcTestSession } from "../harness/tvc";
import { bareMachine } from "./bare";

/*
 * The TVC's access profile, history partitions and IDE partitions (`.plans/VIDEOTON_TVC_PLAN.md` §13):
 * a byte's profile offset is its offset in the core's physical memory, so a byte reached through a
 * page lands in the bank the mapper showed, and the layout names it back as that partition.
 */

const E = PF_EXECUTED;
const C = PF_CODE;
const R = PF_READ;
const W = PF_WRITTEN;

/** The bare machine's `JR $` (`bare.ts`): the test programs return there */
const RETURN = 0x0001;
const STACK = 0x3f00;
const MAIN = 0x0100;

/*
 *   0100  ld hl,4040h   ; U1
 *   0103  ld a,(hl)
 *   0104  ld (8000h),a  ; the video bank page 2 shows
 *   0107  ld (0C000h),a ; the cartridge: ROM, the write reaches nothing
 *   010A  ret
 */
const PROGRAM = [0x21, 0x40, 0x40, 0x7e, 0x32, 0x00, 0x80, 0x32, 0x00, 0xc0, 0xc9];

async function bare(model: string): Promise<TvcTestSession> {
  const s = await createTvcSession({ model });
  bareMachine(s, { halt: false });
  return s;
}

function call(s: TvcTestSession, address: number): void {
  const m = s.machine;
  s.poke(STACK - 2, [RETURN & 0xff, RETURN >> 8]);
  m.sp = STACK - 2;
  m.pc = address;
  m.resetProfile();
  m.setProfiling(true, true);
  try {
    for (let i = 0; i < 10_000 && m.pc !== RETURN; i++) s.step(1);
  } finally {
    m.setProfiling(false, true);
  }
  expect(m.pc).toBe(RETURN);
}

function flags(s: TvcTestSession, offset: number, length = 1): number[] {
  return Array.from(s.machine.readProfileFlags(offset, length)!);
}

describe("the TVC's access profile", () => {
  it("reports its layout", async () => {
    const s = await bare("tvc64");
    const info = s.machine.getProfileInfo()!;
    expect(info.enabled).toBe(false);
    expect(info.flagBytes).toBe(tvcProfileLayout.flagBytes);
    expect(info.timeUnit).toBe("T-states");
    expect(s.machine.profileMachineId).toBe("tvc");
  });

  it("flags bytes at their physical offsets: U0, U1, the video bank; a ROM write reaches nothing", async () => {
    const s = await bare("tvc64");
    s.poke(MAIN, PROGRAM).poke(0x4040, 0x5a);
    call(s, MAIN);
    expect(flags(s, MAIN, 4)).toEqual([E | C, C, C, E | C]);
    expect(flags(s, 0x4040)).toEqual([R]);
    expect(flags(s, 0x10000)).toEqual([W]);
    expect(flags(s, 0x24000)).toEqual([0]);
    expect(s.peek(0x8000)).toBe(0x5a);
  });

  it("follows the 64K+'s video paging, and the layout names the bank back", async () => {
    const s = await bare("tvc64p");
    // --- Port 0Ch bits 3-2: page 2 shows VID2
    s.wasm.tvcWritePort(0x0c, 0x08);
    s.poke(MAIN, PROGRAM).poke(0x4040, 0xa5);
    call(s, MAIN);
    expect(flags(s, 0x18000)).toEqual([W]);
    expect(flags(s, 0x10000)).toEqual([0]);
    expect(s.machine.getPartition(0x8000)).toBe(6);
    expect(profileOffsetOf(tvcProfileLayout, 6, 0x8000)).toBe(0x18000);
    expect(profileLocationOf(tvcProfileLayout, 0x18000)).toEqual({ partition: 6, address: 0, rom: false });
    expect(profileLocationOf(tvcProfileLayout, 0x2a000)).toEqual({ partition: -3, address: 0x2000, rom: true });
    expect(profileLocationOf(tvcProfileLayout, 0x2e123)).toEqual({ partition: -6, address: 0x123, rom: true });
    expect(profileLocationOf(tvcProfileLayout, 0x30010)).toEqual({ partition: -8, address: 0x10, rom: false });
  });
});

describe("the TVC's history partitions", () => {
  it("decode every page as the machine reports it", async () => {
    const s = await bare("tvc64p");
    const decoder = historyContextDecoder("tvc")!;
    // --- Each paging the mapper knows, for every page
    for (const port02 of [0x00, 0x08, 0x10, 0x18, 0x20, 0x24, 0x40, 0x80, 0xc0, 0xfc]) {
      for (const port0c of [0x00, 0x05, 0x0a, 0x0f]) {
        s.wasm.tvcWritePort(0x0c, port0c);
        s.wasm.tvcWritePort(0x02, port02);
        const context = new Uint8Array(16);
        context[0] = 1;
        context[1] = port02;
        context[2] = port0c;
        for (const address of [0x0000, 0x4000, 0x8000, 0xc000, 0xd000, 0xe000]) {
          expect(decoder.partitionFor(context, address), `P02 ${port02} P0C ${port0c} at ${address}`).toBe(
            s.machine.getPartition(address)
          );
        }
      }
    }
    s.wasm.tvcWritePort(0x02, 0x10);
  });

  it("decode the HBF card's ROM page and RAM in the EXT page", async () => {
    const s = await createTvcSession({ model: "tvc64", hbf: true });
    bareMachine(s, { halt: false });
    const decoder = historyContextDecoder("tvc")!;
    s.wasm.tvcWritePort(0x02, 0xd0);
    for (const page of [0, 1, 2, 3]) {
      for (const port03 of [0x00, 0x40]) {
        s.wasm.tvcWritePort(0x03, port03);
        s.wasm.tvcWritePort(0x18, page << 4);
        const context = new Uint8Array(16);
        context[1] = 0xd0;
        context[3] = port03;
        context[4] = 0x80 | page;
        for (const address of [0xc000, 0xcfff, 0xd000, 0xe000]) {
          expect(decoder.partitionFor(context, address), `page ${page} card ${port03 >> 6} at ${address}`).toBe(
            s.machine.getPartition(address)
          );
        }
      }
    }
    expect(s.machine.getPartition(0xc000)).toBe(-3);
    s.wasm.tvcWritePort(0x03, 0x00);
    expect(s.machine.getPartition(0xc000)).toBe(-7);
    expect(s.machine.getPartitionLabels()[-7]).toBe("HBF3");
  });

  it("describe the context", () => {
    const decoder = historyContextDecoder("tvc")!;
    const context = new Uint8Array(16);
    context[0] = 1;
    context[1] = 0x70;
    context[2] = 0x00;
    expect(decoder.describe(context, { 0: "U0", 1: "U1", 2: "U2", 3: "U3", 4: "V0", [-1]: "SYS", [-2]: "CART", [-3]: "EXT" })).toBe(
      "TVC 64K+ P02 70h P0C 00h [U0 U1 U2 SYS]"
    );
  });
});
