/*
 * Decides whether, and as what, Klive can load a parsed `.z88` snapshot: OZvm's card type codes
 * become Klive cards, and the internal RAM size becomes an `MC_Z88_INTRAM` chip mask.
 *
 * `.plans/Z88_SNAPSHOT_PLAN.md` §4.2 holds the table and decisions D1, D5 and D8:
 *  - hybrid RAM+Flash cards (8, 9, 12) are rejected;
 *  - the AMD-compatible chips (AMD, AMIC, STM, SST, Macronix) become Klive AMD cards;
 *  - Intel SA (14) becomes the Klive Intel card;
 *  - type numbers follow the spec (9 = AMIC hybrid, 10 = STM).
 *
 * Every problem is collected, not just the first, so the viewer can list them all.
 */

import { CardIds } from "@emu/machines/z88/CardIds";
import { CT_ROM, z88CardSpec, type Z88CardSpec } from "@emu/machines/z88/z88CardCatalog";
import { Z88_OZVM_HYBRID_TYPES, type Z88Snapshot } from "./z88Snapshot";

/** A card a snapshot slot maps to */
export type Z88MappedCard = {
  /** The OZvm type code it came from */
  ozvmType: number;
  /** The Klive card type id, as a slot configuration stores it (`CardIds`, or "ROM") */
  cardType: string;
  /** The size in KB, as a slot configuration stores it */
  sizeK: number;
  /** What the core inserts */
  spec: Z88CardSpec;
  /** The card's contents */
  bytes: Uint8Array;
};

/** How a snapshot maps to a Klive Z88 */
export type Z88SnapshotMapping = {
  /** The `MC_Z88_INTRAM` chip mask of the internal RAM, if its size is one Klive supports */
  intRamMask?: number;
  /** Index 0..3. Slot 0 is the ROM area; null is an empty slot (or one that could not be mapped). */
  slots: [Z88MappedCard | null, Z88MappedCard | null, Z88MappedCard | null, Z88MappedCard | null];
  /**
   * The `MC_SCREEN_SIZE` matching the snapshot's LCD (SCW/SCH), or undefined when Klive has no such
   * LCD size; the machine then keeps its own, with a warning.
   */
  screenSize?: string;
  /** Why the snapshot cannot be loaded; empty when it can */
  errors: string[];
  /** What loads differently from how OZvm would run it, without stopping the load */
  warnings: string[];
};

/** The names of OZvm's slot type codes (spec, "SLOTNTYPE values") */
const OZVM_TYPE_NAMES: Record<number, string> = {
  0: "Empty",
  1: "ROM",
  2: "RAM",
  3: "UV EPROM (27C)",
  4: "Intel Flash S5 (28F)",
  5: "AMD Flash (29F)",
  6: "AMIC Flash",
  8: "AMD hybrid 512K Flash + 512K RAM",
  9: "AMIC hybrid 512K Flash + 512K RAM",
  10: "STM Flash",
  11: "SST 4K-sector Flash",
  12: "SST hybrid 512K Flash + 512K RAM",
  13: "Macronix Flash",
  14: "Intel Flash SA (28FSA)"
};

/**
 * Gets the display name of an OZvm slot type code.
 * @param ozvmType The `SLOTnTYPE` value
 */
export function ozvmCardTypeName(ozvmType: number): string {
  return OZVM_TYPE_NAMES[ozvmType] ?? `Unknown type ${ozvmType}`;
}

/** The AMD-compatible Flash chips; all of them load as Klive AMD cards (D5) */
const AMD_COMPATIBLE_TYPES = [5, 6, 10, 11, 13];

/** The Intel Flash chips; both load as the Klive Intel card (D8) */
const INTEL_TYPES = [4, 14];

/** The sizes slot 0 accepts (the insert-card dialog's `SLOT0_ACCEPTED_SIZES_KB`) */
const SLOT0_SIZES_K = [128, 256, 512];

/** Internal RAM sizes (KB) and their `MC_Z88_INTRAM` chip masks (`z88InternalRamSizeInBytes`) */
const INTERNAL_RAM_MASKS: Record<number, number> = {
  32: 0x01,
  64: 0x03,
  128: 0x07,
  256: 0x0f,
  512: 0x1f
};

/**
 * The LCD sizes Klive offers (`z88LcdSizeRegisters`): always 640 pixels wide, by height in pixels.
 * OZvm stores SCW/SCH as pixels / 8.
 */
const SCREEN_SIZES_BY_HEIGHT: Record<number, string> = {
  64: "640x64",
  256: "640x256",
  320: "640x320",
  480: "640x480"
};

/**
 * Maps a parsed snapshot to Klive cards, an internal RAM size and an LCD size.
 * @param snapshot The parsed snapshot
 */
export function mapZ88SnapshotToKlive(snapshot: Z88Snapshot): Z88SnapshotMapping {
  const errors: string[] = [];
  const warnings: string[] = [];
  const slots: Z88SnapshotMapping["slots"] = [null, null, null, null];

  // --- LCD size: not a reason to refuse a snapshot; the machine keeps its own
  const width = snapshot.blink.scw * 8;
  const height = snapshot.blink.sch * 8;
  const screenSize = width === 640 ? SCREEN_SIZES_BY_HEIGHT[height] : undefined;
  if (!screenSize) {
    warnings.push(`The ${width}x${height} LCD is not supported; the current LCD size is kept`);
  }

  // --- Internal RAM
  const ramK = snapshot.ram.length / 1024;
  const intRamMask = INTERNAL_RAM_MASKS[ramK];
  if (intRamMask === undefined) {
    errors.push(`Internal RAM of ${ramK}K is not supported (32K, 64K, 128K, 256K or 512K)`);
  }

  // --- Slot 0: an old file without SLOT0TYPE holds a ROM
  const rom = snapshot.rom;
  slots[0] = mapCard(0, rom.ozvmType ?? 1, rom.bytes, errors);

  // --- Slots 1..3
  for (let slot = 1; slot <= 3; slot++) {
    const source = snapshot.slots[slot];
    if (!source) continue;
    if (Z88_OZVM_HYBRID_TYPES.includes(source.ozvmType)) {
      errors.push(
        `Slot ${slot} holds a ${ozvmCardTypeName(source.ozvmType)} card, which Klive does not support`
      );
      continue;
    }
    slots[slot] = mapCard(slot, source.ozvmType, source.bytes!, errors);
  }

  return { intRamMask, slots, screenSize, errors, warnings };
}

/**
 * Maps one card, or records why it cannot be mapped.
 * @returns The mapped card, or null after pushing an error
 */
function mapCard(
  slot: number,
  ozvmType: number,
  bytes: Uint8Array,
  errors: string[]
): Z88MappedCard | null {
  const sizeK = bytes.length / 1024;
  const cardType = kliveCardType(slot, ozvmType, sizeK);
  if (!cardType) {
    errors.push(
      `Slot ${slot}: a ${sizeK}K ${ozvmCardTypeName(ozvmType)} card is not supported` +
        (slot === 0 ? " in slot 0" : "")
    );
    return null;
  }
  return { ozvmType, cardType, sizeK, spec: z88CardSpec(cardType, sizeK), bytes };
}

/**
 * The Klive card type id for an OZvm type and size in a slot, or undefined when Klive has none.
 */
function kliveCardType(slot: number, ozvmType: number, sizeK: number): string | undefined {
  if (slot === 0) {
    // --- Slot 0 takes a ROM, an EPROM, or a 512K Flash chip, of 128K, 256K or 512K
    if (!SLOT0_SIZES_K.includes(sizeK)) return undefined;
    if (ozvmType === 1) return CT_ROM;
    if (ozvmType === 3) return eprom(sizeK);
    if (sizeK !== 512) return undefined;
    if (AMD_COMPATIBLE_TYPES.includes(ozvmType)) return CardIds.AMDF29F040B;
    if (INTEL_TYPES.includes(ozvmType)) return CardIds.IF28F004S5;
    return undefined;
  }

  // --- A ROM in an external slot is an EPROM that is never written
  if (ozvmType === 1 || ozvmType === 3) return eprom(sizeK);
  if (ozvmType === 2) return ram(sizeK);
  if (AMD_COMPATIBLE_TYPES.includes(ozvmType)) {
    return sizeK === 512 ? CardIds.AMDF29F040B : sizeK === 1024 ? CardIds.AMDF29F080B : undefined;
  }
  if (INTEL_TYPES.includes(ozvmType)) {
    return sizeK === 512 ? CardIds.IF28F004S5 : sizeK === 1024 ? CardIds.IF28F008S5 : undefined;
  }
  return undefined;
}

function eprom(sizeK: number): string | undefined {
  switch (sizeK) {
    case 32:
      return CardIds.EPROMUV32;
    case 128:
      return CardIds.EPROMUV128;
    case 256:
      return CardIds.EPROMUV256;
    default:
      return undefined;
  }
}

function ram(sizeK: number): string | undefined {
  switch (sizeK) {
    case 32:
      return CardIds.RAM32;
    case 128:
      return CardIds.RAM128;
    case 256:
      return CardIds.RAM256;
    case 512:
      return CardIds.RAM512;
    case 1024:
      return CardIds.RAM1024;
    default:
      return undefined;
  }
}
