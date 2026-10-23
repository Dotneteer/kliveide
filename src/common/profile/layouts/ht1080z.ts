import type { ProfileLayout } from "./profileLayout";

/*
 * The HT-1080Z (`ht1080z.c`'s profile macros), every model: a byte's profile offset is its address.
 * The ROMs (0000h-37FFh), the video RAM and the RAM (3C00h up to the model's RAM end) are backed; the
 * keyboard (3800h-3BFFh) and a 16K machine's empty space above 7FFFh never are. Nothing is paged.
 */
export const ht1080zProfileLayout: ProfileLayout = {
  id: "ht1080z",
  flagBytes: 0x10000,
  partitionSize: 0x2000,
  regions: [],
  // --- The keyboard is never backed; the RAM end is the model's, which a layout cannot know
  fixedAddress: (address) => {
    const a = address & 0xffff;
    return a >= 0x3800 && a < 0x3c00 ? undefined : a;
  },
  fixedRom: (offset) => offset < 0x3800
};
