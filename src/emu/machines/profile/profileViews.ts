import { profileOffsetOf, type ProfileLayout } from "@common/profile/layouts/profileLayout";
import type { ProfileSample, ProfileStatus, ProfileView } from "@common/profile/profileTypes";
import type { IAccessProfileSource } from "@emu/abstractions/IAccessProfileSource";

/*
 * The views the Emu API hands the IDE (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §4.2), assembled
 * from a machine's profile source and its core's layout. Pure apart from the source, so they are
 * tested with a fake one.
 */

/** 8K: the finest slot any machine pages (the Next's MMU, the Timex chunks) */
const SLOT = 0x2000;

/**
 * The flags (and counts) of the 64K the CPU sees now - assembled per 8K slot through the read
 * mapping (D11), so the memory view's heat map shows the bank that is paged in - or of one partition
 * @param partitionOf The partition at a CPU address now (`getPartition`); undefined on a fixed map
 * @param partition A partition to show instead of the 64K
 * @param withCounts Read the counters too
 */
export function buildProfileView(
  source: IAccessProfileSource,
  layout: ProfileLayout,
  status: ProfileStatus,
  partitionOf: (address: number) => number | undefined,
  partition: number | undefined,
  withCounts: boolean
): ProfileView {
  const counting = withCounts && status.counters;
  if (partition !== undefined) {
    const start = profileOffsetOf(layout, partition, 0);
    const size = layout.partitionSize;
    if (start === undefined) return { partition, baseAddress: 0, flags: new Uint8Array(size), info: status };
    const counts = counting ? source.readProfileCounts(start, size) : undefined;
    return {
      partition,
      baseAddress: 0,
      flags: source.readProfileFlags(start, size) ?? new Uint8Array(size),
      counts: counts && { exec: counts.exec, read: counts.read, write: counts.write, time: counts.time, counted: counts.counted },
      info: status
    };
  }
  const flags = new Uint8Array(0x10000);
  const counts = counting
    ? {
        exec: new Uint32Array(0x10000),
        read: new Uint32Array(0x10000),
        write: new Uint32Array(0x10000),
        time: new Float64Array(0x10000),
        counted: new Uint8Array(0x10000)
      }
    : undefined;
  for (let address = 0; address < 0x10000; address += SLOT) {
    const start = source.currentProfileOffset
      ? source.currentProfileOffset(address)
      : profileOffsetOf(layout, partitionOf(address), address);
    if (start === undefined) continue;
    const slotFlags = source.readProfileFlags(start, SLOT);
    if (slotFlags) flags.set(slotFlags, address);
    if (counts) {
      const c = source.readProfileCounts(start, SLOT);
      if (c) {
        counts.exec.set(c.exec, address);
        counts.read.set(c.read, address);
        counts.write.set(c.write, address);
        counts.time.set(c.time, address);
        counts.counted.set(c.counted, address);
      }
    }
  }
  return { baseAddress: 0, flags, counts, info: status };
}

/**
 * The profile offsets of CPU addresses: each in its own partition when the source names one (a banked
 * line, D11), else in whatever the machine has paged at the address now - an unbanked line runs in
 * whatever is paged, as an unbanked breakpoint fires there
 * @returns -1 for an address nothing backs
 */
export function resolveProfileOffsets(
  layout: ProfileLayout,
  partitionOf: (address: number) => number | undefined,
  addresses: readonly number[],
  partitions?: readonly (number | null | undefined)[],
  currentOffsetOf?: (address: number) => number | undefined
): number[] {
  return addresses.map((address, i) => {
    const named = partitions?.[i];
    if ((named === null || named === undefined) && currentOffsetOf) return currentOffsetOf(address) ?? -1;
    const partition = named === null || named === undefined ? partitionOf(address) : named;
    return profileOffsetOf(layout, partition, address) ?? profileOffsetOf(layout, undefined, address) ?? -1;
  });
}

/**
 * The flags at a list of profile offsets, and their execution counts when asked for: the editor's
 * coverage strip asks for the instruction starts of its lines (D12)
 */
export function sampleProfile(
  source: IAccessProfileSource,
  status: ProfileStatus,
  offsets: readonly number[],
  withCounts: boolean
): ProfileSample {
  const flags = new Uint8Array(offsets.length);
  const exec = withCounts && status.counters ? new Uint32Array(offsets.length) : undefined;
  const time = exec ? new Float64Array(offsets.length) : undefined;
  if (offsets.length === 0) return { info: status, flags, exec, time };
  // --- One read over the span the offsets cover, when it is compact; per offset otherwise
  let min = Infinity;
  let max = -Infinity;
  for (const o of offsets) {
    if (o < min) min = o;
    if (o > max) max = o;
  }
  const span = max - min + 1;
  if (span <= 0x20000) {
    const all = source.readProfileFlags(min, span);
    const counts = exec ? source.readProfileCounts(min, span) : undefined;
    offsets.forEach((o, i) => {
      if (o < 0) return;
      flags[i] = all?.[o - min] ?? 0;
      if (exec && counts) exec[i] = counts.exec[o - min];
      if (time && counts) time[i] = counts.time[o - min];
    });
  } else {
    offsets.forEach((o, i) => {
      if (o < 0) return;
      flags[i] = source.readProfileFlags(o, 1)?.[0] ?? 0;
      if (exec) {
        const counts = source.readProfileCounts(o, 1);
        exec[i] = counts?.exec[0] ?? 0;
        if (time) time[i] = counts?.time[0] ?? 0;
      }
    });
  }
  return { info: status, flags, exec, time };
}
