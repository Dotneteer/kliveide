import type { IZ88MemoryCard } from "./IZ88MemoryCard";
import type { IZ88DeviceHost } from "../IZ88DeviceHost";

import { Z88RamMemoryCard } from "./Z88RamMemoryCard";
import { Z88RomMemoryCard } from "./Z88RomMemoryCard";
import { Z88UvEpromMemoryCard } from "./Z88UvEpromMemoryCard";
import { Z88IntelFlashMemoryCard } from "./Z88IntelFlashMemoryCard";
import { Z88AmdFlash29F040B } from "./Z88AmdFlash29F040B";
import { Z88AmdFlash29F080B } from "./Z88AmdFlash29F080B";
import { CardIds } from "./CardIds";
import { CT_ROM, z88CardSizeInBytes } from "../z88CardCatalog";

/**
 * Creates a new memory card for the Z88
 * @param host The host machine
 * @param size The size of the card
 * @param type The type of the card
 * @returns The new memory card
 */
export function createZ88MemoryCard (
  host: IZ88DeviceHost,
  size: number,
  type: string
): IZ88MemoryCard {
  // --- Get the physical size of the card
  const cardSize = z88CardSizeInBytes(size);

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
