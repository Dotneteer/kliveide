import { describe, expect, it } from "vitest";
import { profileLayoutOf } from "@common/profile/layouts";
import { isProfileRom, profileLocationOf, profileOffsetOf } from "@common/profile/layouts/profileLayout";

/* The per-core profile layouts (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §2.2, D11) */

describe("the profile layouts", () => {
  it("cover every profiling machine id", () => {
    for (const id of ["sp48", "timex", "sp128", "scorpion", "spp3e", "zxnext", "z88", "zx80", "zx81"]) {
      expect(profileLayoutOf(id), id).toBeDefined();
    }
    expect(profileLayoutOf("c64")).toBeUndefined();
    expect(profileLayoutOf(undefined)).toBeUndefined();
  });

  it("round-trip every region's first and last byte", () => {
    for (const id of ["sp48", "timex", "sp128", "scorpion", "spp3e", "zxnext", "z88", "zx81"]) {
      const layout = profileLayoutOf(id)!;
      for (const region of layout.regions) {
        const size = region.size ?? layout.partitionSize;
        for (const at of [0, size - 1]) {
          const location = profileLocationOf(layout, region.start + at)!;
          expect(location, `${id} ${region.partition}`).toBeDefined();
          // --- Regions that share their bytes (the Timex EXROM) name the first one listed
          const owner = layout.regions.find((r) => r.start === region.start)!;
          expect(location.partition).toBe(owner.partition);
          expect(location.address).toBe(at);
          expect(profileOffsetOf(layout, region.partition, at)).toBe(region.start + at);
        }
      }
      // --- Regions never overlap but by design (shared starts)
      const starts = new Map<number, number>();
      for (const r of layout.regions) starts.set(r.start, r.size ?? layout.partitionSize);
      const sorted = [...starts].sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i][0], id).toBeGreaterThanOrEqual(sorted[i - 1][0] + sorted[i - 1][1]);
      expect(sorted[sorted.length - 1]?.[0] ?? 0).toBeLessThan(layout.flagBytes);
    }
  });

  it("maps the 48K by address and knows its ROM", () => {
    const layout = profileLayoutOf("sp48")!;
    expect(profileOffsetOf(layout, undefined, 0x8000)).toBe(0x8000);
    expect(isProfileRom(layout, 0x3fff)).toBe(true);
    expect(isProfileRom(layout, 0x4000)).toBe(false);
  });

  it("gives 128K banks their own offsets wherever they are paged", () => {
    const layout = profileLayoutOf("sp128")!;
    expect(profileOffsetOf(layout, 5, 0x4000)).toBe(profileOffsetOf(layout, 5, 0xc000));
    expect(profileOffsetOf(layout, 7, 0xc000)).not.toBe(profileOffsetOf(layout, 5, 0xc000));
  });

  it("keeps the Next's 16K ROMs whole among its 8K pages", () => {
    const layout = profileLayoutOf("zxnext")!;
    const rom0 = layout.regions.find((r) => r.partition === -1)!;
    expect(profileOffsetOf(layout, -1, 0x2100)).toBe(rom0.start + 0x2100);
    expect(profileLocationOf(layout, rom0.start + 0x2100)).toEqual({ partition: -1, address: 0x2100, rom: true });
    expect(profileOffsetOf(layout, 10, 0x2100)).toBe(layout.regions.find((r) => r.partition === 10)!.start + 0x100);
  });
});
