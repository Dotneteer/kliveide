/*
 * The Z88's 64K address space as the Blink pages it, computed from saved state rather than a running
 * core: the `.z88` viewer's "what will execute" view (`.plans/Z88_SNAPSHOT_PLAN.md` §4.8).
 *
 * The paging follows the core (`z88SetMemoryPageInfo` / `z88BankOffset` in `z88-memory.c`):
 *  - $0000-$1FFF: the lower 8K of bank $20 (internal RAM) with COM.RAMS set, else of bank $00;
 *  - $2000-$3FFF: SR0's bank with bit 0 cleared, its lower 8K for an even SR0, its upper for an odd;
 *  - $4000-$7FFF, $8000-$BFFF, $C000-$FFFF: the whole bank in SR1, SR2, SR3.
 * A card smaller than its slot is mirrored across it, so a bank number wraps to the card's banks.
 */

import { Z88_BANK_SIZE, Z88_OZVM_HYBRID_TYPES, type Z88Snapshot } from "./z88Snapshot";

/** COM.RAMS: internal RAM at $0000-$1FFF */
const COM_RAMS = 0x04;

/** Reads a whole 16K bank, or undefined when no card answers there */
export type Z88BankReader = (bank: number) => Uint8Array | undefined;

/**
 * Builds the 64K the CPU sees. Addresses no card answers read as $FF here (the hardware reads
 * pseudo-random values; a fixed value keeps the view stable).
 * @param readBank Reads a 16K bank
 * @param sr SR0..SR3
 * @param com The COM register
 */
export function buildZ88AddressSpace(
  readBank: Z88BankReader,
  sr: readonly number[],
  com: number
): Uint8Array {
  const flat = new Uint8Array(0x1_0000).fill(0xff);
  const copy = (target: number, bank: number, offset: number, length: number) => {
    const data = readBank(bank & 0xff);
    if (data) flat.set(data.subarray(offset, offset + length), target);
  };
  copy(0x0000, com & COM_RAMS ? 0x20 : 0x00, 0x0000, 0x2000);
  copy(0x2000, sr[0] & 0xfe, (sr[0] & 0x01) * 0x2000, 0x2000);
  copy(0x4000, sr[1], 0, Z88_BANK_SIZE);
  copy(0x8000, sr[2], 0, Z88_BANK_SIZE);
  copy(0xc000, sr[3], 0, Z88_BANK_SIZE);
  return flat;
}

/**
 * A bank reader over a snapshot's images, mirroring each card across its slot.
 * @param snapshot The parsed snapshot
 */
export function z88SnapshotBankReader(snapshot: Z88Snapshot): Z88BankReader {
  return (bank: number) => {
    const slot = bank >> 6;
    if (slot === 0) {
      return bank < 0x20
        ? mirroredBank(snapshot.rom.bytes, bank)
        : mirroredBank(snapshot.ram, bank - 0x20);
    }
    const card = snapshot.slots[slot];
    if (!card) return undefined;
    const index = bank & 0x3f;
    if (Z88_OZVM_HYBRID_TYPES.includes(card.ozvmType)) {
      // --- The lower 512K is RAM, the upper 512K Flash
      return index < 0x20 ? mirroredBank(card.ram, index) : mirroredBank(card.flash, index - 0x20);
    }
    return mirroredBank(card.bytes, index);
  };
}

/** A 16K bank of an image, the bank number wrapping to the image's bank count */
function mirroredBank(image: Uint8Array | undefined, index: number): Uint8Array | undefined {
  if (!image || image.length < Z88_BANK_SIZE) return undefined;
  const banks = Math.floor(image.length / Z88_BANK_SIZE);
  const offset = (index % banks) * Z88_BANK_SIZE;
  return image.subarray(offset, offset + Z88_BANK_SIZE);
}
