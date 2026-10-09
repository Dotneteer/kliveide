import { expect } from "vitest";
import { PF_READ, PF_WRITTEN } from "@common/profile/profileTypes";
import { profileOffsetOf, type ProfileLayout } from "@common/profile/layouts/profileLayout";
import type { Sp128TestSession } from "../../harness/sp128";

/*
 * What the paged Spectrum cores' profile tests share (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md`
 * Phase 2): the 128K/Pentagon/Scorpion core and the +2A/+3/+2E/+3E core.
 *
 * The mapping check (traps T2, T3): with the machine in one paging state, a program reads one byte and
 * writes another in each 16K slot. The profile must flag exactly the bytes the TS layout names for
 * `machine.getPartition(address)` - so the core's `PHYS_READ`/`PHYS_WRITE`, its slot map and the IDE's
 * partitions all agree, and a write to a ROM slot lands nowhere.
 */

type Exports = Record<string, (...args: number[]) => number>;

export function exportsOf(s: Sp128TestSession): Exports {
  return s.machine.wasmV2Runtime!.exports as unknown as Exports;
}

/** The core's export prefix */
export function prefixOf(s: Sp128TestSession): "sp128" | "spp3e" {
  return s.machine.machineId === "spp3e" ? "spp3e" : "sp128";
}

/** Writes a port as an OUT would */
export function out(s: Sp128TestSession, port: number, value: number): void {
  exportsOf(s)[`${prefixOf(s)}WritePort`](port, value);
}

/**
 * Moves the CPU to `address`, out of the HALT the ROM waits in, with interrupts disabled: near a
 * frame's start the INT line is still active, and the ROM's handler would run first
 */
export function jump(s: Sp128TestSession, address: number): void {
  const x = exportsOf(s);
  const p = prefixOf(s);
  // --- A frame can end between a prefix and its opcode: finish that instruction first, or the jump
  // --- target's first byte would be fetched as the prefixed opcode (no M1, no E flag)
  for (let i = 0; i < 3 && x[`${p}GetCpuPrefix`]() !== 0; i++) s.step(1);
  x[`${p}SetCpuHalted`](0);
  x[`${p}SetCpuIff1`](0);
  x[`${p}SetCpuIff2`](0);
  s.machine.pc = address;
}

/** Runs `body` with a fresh profile, counters on */
export function profiled(s: Sp128TestSession, body: () => void): void {
  s.machine.resetProfile();
  s.machine.setProfiling(true, true);
  try {
    body();
  } finally {
    s.machine.setProfiling(false, true);
  }
}

const SLOTS = [0x0000, 0x4000, 0x8000, 0xc000];
const READ_AT = 0x3000;
const WRITE_AT = 0x3100;

/** A program at $8000 reading $x000+READ_AT and writing $x000+WRITE_AT of every slot, then `JR $` */
function mappingProgram(): { code: number[]; end: number } {
  const code = [0xf3]; // DI
  for (const base of SLOTS) {
    const r = base + READ_AT;
    const w = base + WRITE_AT;
    code.push(0x3a, r & 0xff, r >> 8); // LD A,(r)
    code.push(0x32, w & 0xff, w >> 8); // LD (w),A
  }
  const end = 0x8000 + code.length;
  code.push(0x18, 0xfe); // JR $
  return { code, end };
}

function isRomPartition(layout: ProfileLayout, partition: number): boolean {
  return !!layout.regions.find((r) => r.partition === partition)?.rom;
}

/**
 * Runs the mapping program in the machine's current paging state and checks every slot's read and
 * write landed on the layout's offset for `getPartition`; returns the offsets read, by slot
 */
export function checkMapping(s: Sp128TestSession, layout: ProfileLayout, state: string): number[] {
  const { code, end } = mappingProgram();
  // --- The program lives in whatever is at $8000 now; poking it does not count (T1)
  s.poke(0x8000, code);
  const partitions = SLOTS.map((base) => s.machine.getPartition(base)!);
  profiled(s, () => {
    jump(s, 0x8000);
    s.runTo(end, { maxFrames: 2 });
  });

  const reads = SLOTS.map((base, slot) => profileOffsetOf(layout, partitions[slot], base + READ_AT)!);
  const writes = SLOTS.flatMap((base, slot) =>
    isRomPartition(layout, partitions[slot]) ? [] : [profileOffsetOf(layout, partitions[slot], base + WRITE_AT)!]
  );
  const touchedRead = s.machine.readProfileTouched(PF_READ)!.map((b) => b.offset);
  const touchedWritten = s.machine.readProfileTouched(PF_WRITTEN)!.map((b) => b.offset);
  const sorted = (a: number[]) => [...new Set(a)].sort((x, y) => x - y);
  expect(sorted(touchedRead), `reads in ${state} (partitions ${partitions.join(",")})`).toEqual(sorted(reads));
  expect(sorted(touchedWritten), `writes in ${state} (partitions ${partitions.join(",")})`).toEqual(sorted(writes));
  return reads;
}

/** Checks D7: every T-state of a few frames is charged to an address or to a header bucket */
export function checkTimeSums(s: Sp128TestSession, frames = 5): void {
  // --- Interrupts on (the tests before left them off), so the acknowledges have a bucket to fill
  const x = exportsOf(s);
  x[`${prefixOf(s)}SetCpuIff1`](1);
  x[`${prefixOf(s)}SetCpuIff2`](1);
  profiled(s, () => s.runFrames(frames));
  const info = s.machine.getProfileInfo()!;
  const touched = s.machine.readProfileTouched()!;
  const charged = touched.reduce((sum, b) => sum + (b.time ?? 0), 0);
  expect(info.timeIntAck).toBeGreaterThan(0);
  expect(info.timeTotal).toBeGreaterThan((frames - 1) * 69000);
  expect(charged).toBe(info.timeTotal - info.timeIntAck - info.timeNmiAck - info.timeDma - info.timeSnooze);
  expect(info.instructions).toBe(touched.reduce((sum, b) => sum + (b.exec ?? 0), 0));
  expect(info.pagesDropped).toBe(0);
}

/*
 * The call tracker's smoke test (`.plans/PROFILER_PLAN.md` Phase 3): `call Sub / jr $ / Sub: nop /
 * ret` at $8000 gives one edge from the root to Sub, whose inclusive time is Sub's own instructions'
 */
export const CALL_SMOKE_PROGRAM = [0xcd, 0x05, 0x80, 0x18, 0xfe, 0x00, 0xc9];

/** Runs the smoke program with the call tracker on and checks its one edge */
export function checkCallEdge(s: Sp128TestSession, layout: ProfileLayout): void {
  s.poke(0x8000, CALL_SMOKE_PROGRAM);
  const sub = profileOffsetOf(layout, s.machine.getPartition(0x8005), 0x8005)!;
  profiled(s, () => {
    s.machine.setProfileCalls(true);
    jump(s, 0x8000);
    s.machine.sp = 0xbff0;
    s.step(3);
  });
  s.machine.setProfileCalls(false);
  const edges = s.machine.readProfileEdges()!;
  const own = Array.from(s.machine.readProfileCounts(sub, 2)!.time).reduce((a, b) => a + b, 0);
  expect(edges).toHaveLength(1);
  expect(edges[0]).toMatchObject({ callee: sub, calleeAddress: 0x8005, calls: 1, kind: "call", inclusive: own, exclusive: own });
  // --- nop (4) and ret (10); bank 2 at $8000 is uncontended on every model
  expect(own).toBe(14);
}
