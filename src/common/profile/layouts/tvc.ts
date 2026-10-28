import type { ProfileLayout, ProfileRegion } from "./profileLayout";

/*
 * The Videoton TVC (`tvc.c`'s profile macros), both models: a byte's profile offset is its offset in
 * the core's physical memory - U0-U3 at $00000-$0FFFF, the video banks VID0-VID3 at $10000-$1FFFF
 * (partition n at n * $4000), then SYS (-1), the cartridge (-2) and EXT (-3: the card window and
 * EXTH). The 64K's VID1-VID3 are never mapped.
 */

function ramRegions(): ProfileRegion[] {
  const regions: ProfileRegion[] = [];
  for (let bank = 0; bank < 8; bank++) regions.push({ partition: bank, start: bank * 0x4000 });
  return regions;
}

export const tvcProfileLayout: ProfileLayout = {
  id: "tvc",
  flagBytes: 0x2c000,
  partitionSize: 0x4000,
  regions: [
    ...ramRegions(),
    { partition: -1, start: 0x20000, rom: true },
    { partition: -2, start: 0x24000, rom: true },
    { partition: -3, start: 0x28000, rom: true }
  ]
};
