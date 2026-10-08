import type { ProfileLayout, ProfileRegion } from "./profileLayout";

/*
 * The ZX Spectrum Next (`zxnext.c`'s profile macros): the profile offset is the offset into the
 * core's physical memory, `zxnextMemory` (`nextMemoryLayout.ts`): the Next ROM at $000000, the DivMMC
 * ROM at $010000, the Multiface at $014000, the Alt ROMs at $018000/$01C000, the DivMMC RAM at
 * $020000, the 224 Next RAM pages at $040000, and the error page at $200000, which nothing maps.
 *
 * The partitions are `ZxNextWasmV2Machine`'s (`getMemoryPartition`, `zxnextPartitionOfPage`): RAM
 * page 0-223 is partition 0-223; the Next ROMs are -1..-4, Alt ROM 0 -5, Alt ROM 1 -6, the DivMMC ROM
 * -7 and the DivMMC RAM banks 0-15 -8..-23. The Multiface has no partition, so its offsets name none.
 *
 * Partitions are 8K pages, except the six ROM partitions (-1..-6), which are 16K: their regions
 * carry their own `size`, so an address in a ROM's upper half lands in that half.
 */

const regions: ProfileRegion[] = [];
// --- The Next ROMs, ROM 0-3
for (let rom = 0; rom < 4; rom++) regions.push({ partition: -(rom + 1), start: rom * 0x4000, size: 0x4000, rom: true });
regions.push({ partition: -5, start: 0x018000, size: 0x4000, rom: true });
regions.push({ partition: -6, start: 0x01c000, size: 0x4000, rom: true });
regions.push({ partition: -7, start: 0x010000, rom: true });
// --- DivMMC RAM banks 0-15
for (let bank = 0; bank < 16; bank++) regions.push({ partition: -(8 + bank), start: 0x020000 + bank * 0x2000 });
// --- Next RAM pages 0-223
for (let page = 0; page < 224; page++) regions.push({ partition: page, start: 0x040000 + page * 0x2000 });

export const zxnextProfileLayout: ProfileLayout = {
  id: "zxnext",
  // --- ZXNEXT_MEMORY_SIZE: 2 MB and the 8K error page
  flagBytes: 2048 * 1024 + 0x2000,
  partitionSize: 0x2000,
  regions
};
