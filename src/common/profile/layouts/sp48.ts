import type { ProfileLayout } from "./profileLayout";

/*
 * The ZX Spectrum 48K/16K (`sp48.c`'s profile macros): the profile offset is the address, since
 * `sp48Memory` is the whole machine, and the machine names no partition.
 */
export const sp48ProfileLayout: ProfileLayout = {
  id: "sp48",
  flagBytes: 0x10000,
  partitionSize: 0x4000,
  regions: [],
  fixedAddress: (address) => address & 0xffff,
  fixedRom: (offset) => offset < 0x4000
};
