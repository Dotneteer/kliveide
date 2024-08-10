import type { IZ88MemoryCard } from "./IZ88MemoryCard";
import type { IZ88Machine } from "@renderer/abstractions/IZ88Machine";

import { Z88RamMemoryCard } from "./Z88RamMemoryCard";
import { Z88RomMemoryCard } from "./Z88RomMemoryCard";
import { Z88UvEpromMemoryCard } from "./Z88UvEpromMemoryCard";
import { Z88IntelFlashMemoryCard } from "./Z88IntelFlashMemoryCard";
import { Z88AmdFlash29F040B } from "./Z88AmdFlash29F040B";
import { Z88AmdFlash29F080B } from "./Z88AmdFlash29F080B";
import { CardIds } from "./CardIds";

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
 * Creates a new memory card for the Z88
 * @param host The host machine
 * @param size The size of the card
 * @param type The type of the card
 * @returns The new memory card
 */
export function createZ88MemoryCard (
  host: IZ88Machine,
  size: number,
  type: string
): IZ88MemoryCard {
  // --- Get the physical size of the card
  let cardSize = 0;
  switch (size) {
    case 32:
    case 64:
    case 128:
    case 256:
    case 512:
    case 1024:
      cardSize = size * 1024;
      break;
    default:
      throw new Error(`Invalid card size: ${size}`);
  }

  // --- Instantiate the card
  let card: IZ88MemoryCard | undefined;
  switch (type) {
    case CardIds.RAM32:
    case CardIds.RAM128:
    case CardIds.RAM256:
    case CardIds.RAM512:
    case CardIds.RAM1024:
      card = new Z88RamMemoryCard(host, cardSize);
      break;
    case CT_ROM:
      card = new Z88RomMemoryCard(host, cardSize);
      break;
    case CardIds.EPROMUV32:
    case CardIds.EPROMUV128:
      card = new Z88UvEpromMemoryCard(host, cardSize);
      break;
    case CardIds.IF28F004S5:
    case CardIds.IF28F008S5:
      card = new Z88IntelFlashMemoryCard(host, cardSize);
      break;
    case CardIds.AMDF29F040B:
      card = new Z88AmdFlash29F040B(host);
      break;
    case CardIds.AMDF29F080B:
      card = new Z88AmdFlash29F080B(host);
      break;
    default:
      throw new Error(`Unknown card type: ${type}`);
  }
  return card;
}

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
