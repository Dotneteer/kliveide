import type { ProfileLayout } from "./profileLayout";

/*
 * The ZX80 and ZX81 (`zx8081.c`'s profile macros), every model: the profile offset of a byte is its
 * canonical address - the lowest CPU address a data access reaches it at - because the RAM size and
 * the ROM are run-time configuration of one core, not machine ids, so the layout cannot depend on them.
 *
 *   $00000-$01FFF  the ROM, through its mirrors (the ZX80's 4K ROM fills $0000-$0FFF)
 *   $02000-$0FFFF  the RAM: 1K and 16K at $4000 up, whichever mirror was used; 64K at its address
 *   $10000-$11FFF  the 64K model's lowest 8K of RAM, which only an opcode fetch above 32K reaches
 *                  (through the lower-32K redirect); it has no CPU address of its own
 *
 * The machine names no partition (`getPartition`), so this is a fixed map. A CPU address in a mirror
 * (the 16K's $C000 echo, the ROM at $2000) names the canonical offset only when it is the canonical
 * address itself: the identity map below cannot know the model.
 */
export const zx8081ProfileLayout: ProfileLayout = {
  id: "zx8081",
  flagBytes: 0x12000,
  partitionSize: 0x2000,
  regions: [],
  fixedAddress: (address) => address & 0xffff,
  fixedRom: (offset) => offset < 0x2000
};
