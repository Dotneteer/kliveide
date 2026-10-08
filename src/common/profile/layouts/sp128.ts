import type { ProfileLayout, ProfileRegion } from "./profileLayout";

/*
 * The 128K core (`sp128.c`'s profile macros), shared by the ZX Spectrum 128K, the Pentagon 128 and the
 * Scorpion ZS-256: one linear offset space over the core's physical arrays - RAM banks 0-15 at
 * $00000-$3FFFF (bank n at n * $4000), ROMs 0-2 at $40000-$4BFFF and the TR-DOS ROM at $4C000-$4FFFF.
 *
 * The two machines number their partitions differently (`getPartitionLabels`), so each has a layout
 * over the same offsets.
 */

const FLAG_BYTES = 0x50000;
const ROM_BASE = 0x40000;
const TRDOS_BASE = 0x4c000;

function ramRegions(banks: number): ProfileRegion[] {
  const regions: ProfileRegion[] = [];
  for (let bank = 0; bank < banks; bank++) regions.push({ partition: bank, start: bank * 0x4000 });
  return regions;
}

/*
 * The 128K and the Pentagon 128 (`ZxSpectrum128WasmHost`): RAM banks 0-7, ROM 0 -1, ROM 1 -2 and
 * the Beta 128's TR-DOS ROM -3 ("R2"). Banks 8-15 and the Scorpion's service ROM are never mapped.
 */
export const sp128ProfileLayout: ProfileLayout = {
  id: "sp128",
  flagBytes: FLAG_BYTES,
  partitionSize: 0x4000,
  regions: [
    { partition: -1, start: ROM_BASE, rom: true },
    { partition: -2, start: ROM_BASE + 0x4000, rom: true },
    { partition: -3, start: TRDOS_BASE, rom: true },
    ...ramRegions(8)
  ]
};

/*
 * The Scorpion ZS-256 (`ScorpionWasmV2Machine`): RAM banks 0-15, ROM 0 -1, ROM 1 -2, the service
 * ROM -3 ("R2") and TR-DOS -4 ("R3").
 */
export const scorpionProfileLayout: ProfileLayout = {
  id: "scorpion",
  flagBytes: FLAG_BYTES,
  partitionSize: 0x4000,
  regions: [
    { partition: -1, start: ROM_BASE, rom: true },
    { partition: -2, start: ROM_BASE + 0x4000, rom: true },
    { partition: -3, start: ROM_BASE + 0x8000, rom: true },
    { partition: -4, start: TRDOS_BASE, rom: true },
    ...ramRegions(16)
  ]
};
