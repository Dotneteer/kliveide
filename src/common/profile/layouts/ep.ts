import type { ProfileLayout, ProfileRegion } from "./profileLayout";

/*
 * The Enterprise 64/128 (`ep.c`'s profile macros), both models: a byte's profile offset is its offset in
 * the core's physical memory (`epMemory`, `epMachineInfo.ts`'s `EP_PHYS_*`). The partitions are the
 * segments DAVE numbers: EXOS in 00h-01h, the cartridge in 04h, Klive's FILE: ROM in 10h, EXDOS in
 * 20h-21h, and the RAM segments F8h-FFh (the 64 has only FCh-FFh; F8h-FBh are never mapped there).
 * Every other segment is empty and never profiled.
 */

const rom = (partition: number, start: number): ProfileRegion => ({ partition, start, rom: true });

function ramRegions(): ProfileRegion[] {
  const regions: ProfileRegion[] = [];
  for (let segment = 0xf8; segment <= 0xff; segment++) regions.push({ partition: segment, start: 0x18000 + (segment - 0xf8) * 0x4000 });
  return regions;
}

export const epProfileLayout: ProfileLayout = {
  id: "ep",
  flagBytes: 0x3c000,
  partitionSize: 0x4000,
  regions: [rom(0x00, 0x00000), rom(0x01, 0x04000), rom(0x04, 0x08000), rom(0x10, 0x0c000), rom(0x20, 0x10000), rom(0x21, 0x14000), ...ramRegions()]
};
