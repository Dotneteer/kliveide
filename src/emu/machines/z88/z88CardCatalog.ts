/*
 * The Cambridge Z88 memory-card vocabulary, independent of the core that emulates the cards: the
 * hardware card type codes, the card size rules and the chip (address line) mask a size implies.
 *
 * Neutral: the TypeScript `Z88Machine` and its card classes use it, and the WASM Z88 machine will.
 * It must not import any TypeScript card or device class (see
 * `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`, "Target Architecture").
 */

import { CardIds } from "./memory/CardIds";

export const CARD_SIZE_EMPTY = "-";
export const CARD_SIZE_32K = "32K";
export const CARD_SIZE_64K = "64K";
export const CARD_SIZE_128K = "128K";
export const CARD_SIZE_256K = "256K";
export const CARD_SIZE_512K = "512K";
export const CARD_SIZE_1M = "1M";
export const CT_ROM = "ROM";
export const CT_RAM = "RAM";
export const CT_EPROM = "EPROM";
export const CT_INTEL_FLASH = "INTFC";
export const CT_AMD_FLASH = "AMDFC";

/**
 * Hardware card (types), manufactured for the Cambridge Z88
 */
export enum CardType {
  None = 0x00,
  Rom = 0x01, // were used occasionally as 128K size for slot 0 in V2.2 and V3.0 "OZ" releases (1987-1988)
  Ram = 0x02, // exists as 32K, 128K, 512K and 1Mb cards, available for slot 0 as 128K and 512K SRAM chips

  // Define 32K UV Eprom Card the Blink and slot 3 hardware is capable of writing to
  EpromVpp32KB = 0x007e,
  // Define 128K and 256K UV Eprom Card (sizes) the Blink and slot 3 hardware is capable of writing to
  // (motherboards have been seen with NEC 128K Uv Eproms fitted in slot 0 for "OZ" ROM V2.2 release)
  EpromVpp128KB = 0x007c,

  // Manufacturer+Device Code for Intel Flash 512Kb memory (2nd gen. 5V), 8 x 64K erasable sectors, 32 x 16K banks
  FlashIntel28F004S5 = 0x89a7,
  // Manufacturer+Device Code for Intel Flash 1Mb memory (2nd gen. 5V), 16 x 64K erasable sectors, 64 x 16K banks
  FlashIntel28F008S5 = 0x89a6,

  // Manufacturer+Device code for AMD Flash 512Kb memory, 8 x 64K erasable sectors, 32 x 16K banks
  FlashAmd29F040B = 0x01a4,
  // Device code for AMD Flash 1Mb memory, 16 x 64K erasable sectors, 64 x 16K banks
  FlashAmd29F080B = 0x01d5,
  // Device code for AMIC Flash 512Kb memory (100% compatible with AMD 29F040B), 8 x 64K erasable sectors, 32 x 16K banks
  FlashAmic29F040B = 0x3786,
  // Manufacturer+Device code for Macronix Flash 512Kb memory (100% compatible with AMD 29F040B), 8 x 64K erasable sectors, 32 x 16K banks
  FlashMacronix29F040C = 0x0c2a4,
  // Manufacturer+Device code for STM Flash 512Kb memory (100% compatible with AMD 29F040B), 8 x 64K erasable sectors, 32 x 16K banks
  FlashSTM29F040B = 0x020e2,
  // Manufacturer+Device code for STM Flash 1Mb memory (100% compatible with AMD 29F080B), 16 x 64K erasable sectors, 64 x 16K banks
  FlashSTM29F080D = 0x020f1,
  // Manufacturer+Device code for Microchip SST39FS040 Flash 512K memory, 128 x 4K erasable sectors, 32 x 16K banks
  FlashSST39FS040 = 0xbfb7
}

/**
 * Converts a card size given in kilobytes (as a slot configuration stores it) into bytes.
 * @param sizeK Card size in KB: 32, 64, 128, 256, 512 or 1024
 * @throws For any other size
 */
export function z88CardSizeInBytes(sizeK: number): number {
  switch (sizeK) {
    case 32:
    case 64:
    case 128:
    case 256:
    case 512:
    case 1024:
      return sizeK * 1024;
    default:
      throw new Error(`Invalid card size: ${sizeK}`);
  }
}

/**
 * Gets the chip (address line) mask of a card of the specified size. The mask selects the bank
 * bits the card decodes; a smaller card is mirrored across its slot.
 * @param sizeInBytes Card size in bytes: 0, 32K, 64K, 128K, 256K, 512K or 1M
 * @throws For any other size
 */
export function z88ChipMaskForSize(sizeInBytes: number): number {
  switch (sizeInBytes) {
    case 0x00_0000:
      return 0x00;
    case 0x00_8000:
      return 0x01;
    case 0x01_0000:
      return 0x03;
    case 0x02_0000:
      return 0x07;
    case 0x04_0000:
      return 0x0f;
    case 0x08_0000:
      return 0x1f;
    case 0x10_0000:
      return 0x3f;
    default:
      throw new Error("Invalid memory card size");
  }
}

/**
 * Gets the internal RAM size selected by the `MC_Z88_INTRAM` chip mask of a machine configuration.
 * @param intRamMask 0x00 (none), 0x01 (32K), 0x03 (64K), 0x07 (128K), 0x0F (256K); anything else,
 * including a missing value, selects 512K.
 * @returns The internal RAM size in bytes
 */
export function z88InternalRamSizeInBytes(intRamMask: unknown): number {
  switch (intRamMask) {
    case 0x00:
      return 0x00_0000;
    case 0x01:
      return 0x00_8000;
    case 0x03:
      return 0x01_0000;
    case 0x07:
      return 0x02_0000;
    case 0x0f:
      return 0x04_0000;
    default:
      return 0x08_0000;
  }
}

/** How a card behaves: the kinds the card-type ids of a slot configuration map to */
export type Z88CardKind =
  | "RAM"
  | "ROM"
  | "UV_EPROM"
  | "INTEL_FLASH"
  | "AMD_FLASH_29F040B"
  | "AMD_FLASH_29F080B";

/** A card to insert: its kind and its size in bytes */
export type Z88CardSpec = { readonly kind: Z88CardKind; readonly sizeInBytes: number };

/**
 * Resolves the card a slot configuration describes, with the rules `createZ88MemoryCard` has always
 * applied: the size is validated first (even for AMD chips, whose size is fixed by the chip), then
 * the card-type id. Both backends use it, so they accept and reject the same configurations.
 * @param cardTypeId A `CardIds` value (`"ROM"` for a ROM card)
 * @param sizeK The configured size in KB
 * @throws "Invalid card size: ..." or "Unknown card type: ..." (e.g. `EPROMUV256`, follow-up F2)
 */
export function z88CardSpec(cardTypeId: string, sizeK: number): Z88CardSpec {
  const sizeInBytes = z88CardSizeInBytes(sizeK);
  switch (cardTypeId) {
    case CardIds.RAM32:
    case CardIds.RAM128:
    case CardIds.RAM256:
    case CardIds.RAM512:
    case CardIds.RAM1024:
      return { kind: "RAM", sizeInBytes };
    case CT_ROM:
      return { kind: "ROM", sizeInBytes };
    // --- 32K (EPR $48), 128K and 256K (EPR $69) UV EPROMs; the 256K one was offered by the card
    // --- dialog but could not be built (follow-up F2 of the Z88 WASM migration plan)
    case CardIds.EPROMUV32:
    case CardIds.EPROMUV128:
    case CardIds.EPROMUV256:
      return { kind: "UV_EPROM", sizeInBytes };
    case CardIds.IF28F004S5:
    case CardIds.IF28F008S5:
      return { kind: "INTEL_FLASH", sizeInBytes };
    // --- An AMD chip's size is the chip's, whatever the configuration says
    case CardIds.AMDF29F040B:
      return { kind: "AMD_FLASH_29F040B", sizeInBytes: 0x08_0000 };
    case CardIds.AMDF29F080B:
      return { kind: "AMD_FLASH_29F080B", sizeInBytes: 0x10_0000 };
    default:
      throw new Error(`Unknown card type: ${cardTypeId}`);
  }
}

/**
 * The card of a ROM image loaded without a slot-0 configuration: a ROM card as large as the image.
 * @param sizeInBytes The image length, which must be a card size
 * @throws "Invalid memory card size" for any other length
 */
export function z88RomImageCardSpec(sizeInBytes: number): Z88CardSpec {
  z88ChipMaskForSize(sizeInBytes);
  return { kind: "ROM", sizeInBytes };
}

/**
 * Tells whether a slot configuration (`MC_Z88_SLOT0`..`MC_Z88_SLOT3`) holds a card: it must exist,
 * have a size, and not be the "-" (empty) card type.
 */
export function z88SlotHasCard(
  slot: { size?: number; cardType?: string } | undefined | null
): boolean {
  return !!slot && slot.size !== undefined && slot.cardType !== CARD_SIZE_EMPTY;
}
