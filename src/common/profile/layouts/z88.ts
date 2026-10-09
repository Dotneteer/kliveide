import type { ProfileLayout, ProfileRegion } from "./profileLayout";

/*
 * The Cambridge Z88 (`z88.c`'s profile macros): the profile offset is the offset in the 4 MB physical
 * memory - slot 0 at $000000 (banks $00-$1F), the internal RAM at $080000 ($20-$3F), slots 1-3 at
 * $100000, $200000 and $300000 ($40-$7F, $80-$BF, $C0-$FF). Bank N's raw storage is N * 16K, so the
 * partitions are the 256 banks as `getPartitionLabels` numbers them, each a 16K region.
 *
 * What the core flags is the byte's *storage*: `z88PageOffset` already folds a card smaller than its
 * slot onto its real banks, so a mirror bank (bank $BF of a 32K card in slot 2) never owns a flagged
 * byte - its bytes are named after the bank that holds them ($81, `z88BankStorageOffset`). Segment 0's
 * upper 8K shows the lower or upper half of SR0's even bank (SR0 bit 0 picks the half), so a byte
 * fetched at $2000-$3FFF is named by that even bank and its offset inside it, not by $2000 + offset.
 * A static layout cannot know the card sizes or SR0, so `profileOffsetOf(layout, bank, address)` is
 * exact for a full-size card's bank paged into segments 1-3 (address modulo 16K); for anything else
 * the CPU address must be resolved through the core's page map (`z88GetPageOffset`) first.
 *
 * Slot 0 (banks $00-$1F) is the system ROM card; the views' "Exclude ROM" (T11) leaves it out.
 */

const regions: ProfileRegion[] = [];
for (let bank = 0; bank <= 0xff; bank++) {
  regions.push({ partition: bank, start: bank * 0x4000, rom: bank < 0x20 });
}

export const z88ProfileLayout: ProfileLayout = {
  id: "z88",
  flagBytes: 0x40_0000,
  partitionSize: 0x4000,
  regions
};
