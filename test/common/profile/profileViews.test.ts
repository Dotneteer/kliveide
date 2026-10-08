import { describe, expect, it } from "vitest";
import { profileLayoutOf } from "@common/profile/layouts";
import type { ProfileCounts, ProfileStatus } from "@common/profile/profileTypes";
import type { IAccessProfileSource } from "@emu/abstractions/IAccessProfileSource";
import { buildProfileView, resolveProfileOffsets, sampleProfile } from "@emu/machines/profile/profileViews";

/* The Emu API's profile views over a fake source (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §4.2) */

const sp128 = profileLayoutOf("sp128")!;

/** Flag byte = (offset >> 14) + 1: each 16K bank reads as its own number */
function fakeSource(currentOffset?: (address: number) => number | undefined): IAccessProfileSource {
  const flagAt = (o: number) => ((o >> 14) + 1) & 0xff;
  return {
    profileMachineId: "sp128",
    getProfileInfo: () => undefined,
    setProfiling: () => {},
    resetProfile: () => {},
    readProfileFlags: (start, length) => Uint8Array.from({ length }, (_, i) => flagAt(start + i)),
    readProfileCounts: (start, length): ProfileCounts => ({
      start,
      exec: Uint32Array.from({ length }, (_, i) => start + i),
      read: new Uint32Array(length),
      write: new Uint32Array(length),
      time: new Float64Array(length),
      counted: new Uint8Array(length).fill(1)
    }),
    readProfileTouched: () => [],
    mergeProfile: () => {},
    ...(currentOffset ? { currentProfileOffset: currentOffset } : {})
  };
}

const status = { counters: true } as ProfileStatus;

describe("the profile views", () => {
  it("assemble the 64K from the partition paged at each slot", () => {
    // --- ROM 0, bank 5, bank 2, bank 7
    const slots = [-1, -1, 5, 5, 2, 2, 7, 7];
    const view = buildProfileView(fakeSource(), sp128, status, (a) => slots[a >> 13], undefined, true);
    expect(view.flags[0x0000]).toBe((0x40000 >> 14) + 1);
    expect(view.flags[0x4000]).toBe(6);
    expect(view.flags[0x8000]).toBe(3);
    expect(view.flags[0xc000]).toBe(8);
    expect(view.counts!.exec[0xc001]).toBe(7 * 0x4000 + 1);
  });

  it("show one partition whole", () => {
    const view = buildProfileView(fakeSource(), sp128, status, () => undefined, 3, false);
    expect(view.flags).toHaveLength(0x4000);
    expect(view.flags[0]).toBe(4);
    expect(view.counts).toBeUndefined();
  });

  it("prefer the machine's own address map when it has one (the Z88)", () => {
    const source = fakeSource((a) => 0x4000 * 6 + (a & 0x3fff));
    const view = buildProfileView(source, sp128, status, () => 0, undefined, false);
    expect(view.flags[0x0000]).toBe(7);
    expect(resolveProfileOffsets(sp128, () => 0, [0x0010], [null], source.currentProfileOffset!.bind(source))).toEqual([0x18010]);
  });

  it("resolve a named partition, else what is paged, and sample the offsets", () => {
    const offsets = resolveProfileOffsets(sp128, () => 5, [0xc000, 0xc000, 0x8000], [3, null, null]);
    expect(offsets).toEqual([0x0c000, 0x14000, 0x14000]);
    const sample = sampleProfile(fakeSource(), status, [0x0c000, 0x14000, -1], true);
    expect(Array.from(sample.flags)).toEqual([4, 6, 0]);
    expect(Array.from(sample.exec!)).toEqual([0x0c000, 0x14000, 0]);
  });
});
