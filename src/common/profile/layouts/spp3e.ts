import type { ProfileLayout, ProfileRegion } from "./profileLayout";

/*
 * The +2A/+3/+2E/+3E core (`spp3e.c`'s profile macros): RAM banks 0-7 at $00000-$1FFFF (bank n at
 * n * $4000), ROMs 0-3 at $20000-$2FFFF. The partitions are `ZxSpectrumP3eWasmHost`'s: banks 0-7 and
 * ROMs -1 ("R0") to -4 ("R3"). The special (all-RAM) paging modes only rearrange banks, so they need
 * nothing here.
 */

const regions: ProfileRegion[] = [];
for (let rom = 0; rom < 4; rom++) regions.push({ partition: -(rom + 1), start: 0x20000 + rom * 0x4000, rom: true });
for (let bank = 0; bank < 8; bank++) regions.push({ partition: bank, start: bank * 0x4000 });

export const spp3eProfileLayout: ProfileLayout = {
  id: "spp3e",
  flagBytes: 0x30000,
  partitionSize: 0x4000,
  regions
};
