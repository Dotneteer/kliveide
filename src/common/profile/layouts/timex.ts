import type { ProfileLayout, ProfileRegion } from "./profileLayout";

/*
 * The Timex machines (`sp48.c`'s profile macros, built with `SP48_SCLD`): HOME at $00000-$0FFFF,
 * EXROM at $10000-$11FFF, DOCK at $12000-$21FFF.
 *
 * The partitions are `TimexWasmV2Machine`'s 8K chunks (`.plans/TIMEX_SCORPION_PLAN.md` Q5): HOME
 * H0 -1, H1 -2, H2-H7 2-7; DOCK D0-D7 8-15; EXROM X0-X7 -3 to -10. The 8K EXROM answers in every
 * chunk of its bank, so its eight partitions share one region (X0 names it).
 */

const regions: ProfileRegion[] = [];
for (let chunk = 0; chunk < 8; chunk++) {
  regions.push({ partition: chunk < 2 ? -(chunk + 1) : chunk, start: chunk * 0x2000, rom: chunk < 2 });
}
for (let chunk = 0; chunk < 8; chunk++) regions.push({ partition: -(3 + chunk), start: 0x10000, rom: true });
for (let chunk = 0; chunk < 8; chunk++) regions.push({ partition: 8 + chunk, start: 0x12000 + chunk * 0x2000 });

export const timexProfileLayout: ProfileLayout = {
  id: "timex",
  flagBytes: 0x22000,
  partitionSize: 0x2000,
  regions,
  // --- The TC2048 maps HOME only and names no partition at an address with nothing paged
  fixedAddress: (address) => address & 0xffff,
  fixedRom: (offset) => offset < 0x4000 || (offset >= 0x10000 && offset < 0x12000)
};
