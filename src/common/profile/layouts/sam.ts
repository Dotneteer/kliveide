import type { ProfileLayout, ProfileRegion } from "./profileLayout";

/*
 * The SAM Coupé (`sam.c`'s profile macros), both models: a byte's profile offset is its offset in the
 * core's physical memory (`samMemory`, `samMachineInfo.ts`'s `SAM_PHYS_*`): ROM0 and ROM1 from 0, the
 * 32 internal pages from 8000h, the external pack's 64 pages from 88000h, and the block a missing page
 * reads (188000h), which takes no writes and names no partition. The partitions are the machine's:
 * internal pages 0-31 by their number, ROM0 40h, ROM1 41h, external pages from 80h.
 */

const PAGE = 0x4000;

function regions(): ProfileRegion[] {
  const result: ProfileRegion[] = [
    { partition: 0x40, start: 0x000000, rom: true },
    { partition: 0x41, start: 0x004000, rom: true }
  ];
  for (let page = 0; page < 32; page++) result.push({ partition: page, start: 0x008000 + page * PAGE });
  for (let page = 0; page < 64; page++) result.push({ partition: 0x80 + page, start: 0x088000 + page * PAGE });
  return result;
}

export const samProfileLayout: ProfileLayout = {
  id: "sam",
  flagBytes: 0x18c000,
  partitionSize: PAGE,
  regions: regions()
};
