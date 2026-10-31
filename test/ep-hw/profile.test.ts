import { describe, expect, it } from "vitest";

import { PF_CODE, PF_EXECUTED, PF_READ, PF_WRITTEN } from "@common/profile/profileTypes";
import { profileLocationOf, profileOffsetOf } from "@common/profile/layouts/profileLayout";
import { epProfileLayout } from "@common/profile/layouts/ep";
import { historyContextDecoder } from "@common/history/contexts";
import { createEpSession, type EpTestSession } from "../harness/enterprise";
import { bareMachine } from "./bare";

/*
 * The Enterprise's access profile and history partitions (`.plans/ENTERPRISE_PLAN.md` §11): a byte's
 * profile offset is its offset in the core's physical memory, so a byte reached through a page lands in
 * the segment the page register showed, and the layout names it back as that segment.
 */

const E = PF_EXECUTED;
const C = PF_CODE;
const R = PF_READ;
const W = PF_WRITTEN;

/** The bare machine's `JR $` at 0001h (pages: F8h, F9h, FAh, FFh); the test programs return there */
const RETURN = 0x0001;
const STACK = 0x3f00;
const MAIN = 0x4100;
/** Physical offsets of RAM segments in the core (`ep.c`): F8h at 18000h, 16K each */
const phys = (segment: number, offset: number) => 0x18000 + (segment - 0xf8) * 0x4000 + offset;

/*
 *   4100  ld hl,8040h   ; segment FAh
 *   4103  ld a,(hl)
 *   4104  ld (0C000h),a ; segment FFh, or EXOS's ROM when B3h selects segment 00h
 *   4107  ret
 */
const PROGRAM = [0x21, 0x40, 0x80, 0x7e, 0x32, 0x00, 0xc0, 0xc9];

async function bare(model: "ep128" | "ep64" = "ep128"): Promise<EpTestSession> {
  const s = await createEpSession({ model });
  bareMachine(s, { halt: false });
  return s;
}

function call(s: EpTestSession, address: number): void {
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

function flags(s: EpTestSession, offset: number, length = 1): number[] {
  return Array.from(s.machine.readProfileFlags(offset, length)!);
}

describe("the Enterprise's access profile", () => {
  it("reports its layout", async () => {
    const s = await bare();
    const info = s.machine.getProfileInfo()!;
    expect(info.enabled).toBe(false);
    expect(info.flagBytes).toBe(epProfileLayout.flagBytes);
    expect(info.timeUnit).toBe("T-states");
    expect(s.machine.profileMachineId).toBe("ep");
  });

  it("flags bytes at their physical offsets, in the segment each page shows", async () => {
    const s = await bare();
    s.poke(MAIN, PROGRAM).poke(0x8040, 0x5a);
    call(s, MAIN);
    expect(flags(s, phys(0xf9, 0x100), 4)).toEqual([E | C, C, C, E | C]);
    expect(flags(s, phys(0xfa, 0x40))).toEqual([R]);
    expect(flags(s, phys(0xff, 0))).toEqual([W]);
    expect(s.peek(0xc000)).toBe(0x5a);
    expect(profileOffsetOf(epProfileLayout, 0xfa, 0x8040)).toBe(phys(0xfa, 0x40));
    expect(profileLocationOf(epProfileLayout, phys(0xff, 0x10))).toEqual({ partition: 0xff, address: 0x10, rom: false });
  });

  it("does not flag a write to a ROM segment, and names ROM offsets back as their segments", async () => {
    const s = await bare();
    s.wasm.epWritePort(0xb3, 0x00);
    const before = s.peek(0xc000);
    s.poke(MAIN, PROGRAM).poke(0x8040, (before ^ 0xff) & 0xff);
    call(s, MAIN);
    expect(flags(s, 0x00000)).toEqual([0]);
    expect(s.peek(0xc000)).toBe(before);
    expect(profileLocationOf(epProfileLayout, 0x04123)).toEqual({ partition: 0x01, address: 0x123, rom: true });
    expect(profileLocationOf(epProfileLayout, 0x08010)).toEqual({ partition: 0x04, address: 0x10, rom: true });
  });
});

describe("the Enterprise's history partitions", () => {
  it("decode every page as the machine reports it", async () => {
    const s = await bare();
    const decoder = historyContextDecoder("ep")!;
    for (const segment of [0x00, 0x01, 0x04, 0x10, 0x20, 0x7f, 0xf8, 0xfc, 0xff]) {
      s.wasm.epWritePort(0xb2, segment);
      s.wasm.epWritePort(0xb3, segment);
      const context = new Uint8Array(16);
      for (let page = 0; page < 4; page++) context[page] = s.wasm.epGetPageRegister(page);
      for (const address of [0x0000, 0x4000, 0x8000, 0xc000, 0xffff]) {
        expect(decoder.partitionFor(context, address), `segment ${segment} at ${address}`).toBe(s.machine.getPartition(address));
      }
    }
  });
});
