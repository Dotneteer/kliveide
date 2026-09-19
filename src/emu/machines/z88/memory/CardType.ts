import type { IZ88MemoryCard } from "./IZ88MemoryCard";
import type { IZ88DeviceHost } from "../IZ88DeviceHost";

import { Z88RamMemoryCard } from "./Z88RamMemoryCard";
import { Z88RomMemoryCard } from "./Z88RomMemoryCard";
import { Z88UvEpromMemoryCard } from "./Z88UvEpromMemoryCard";
import { Z88IntelFlashMemoryCard } from "./Z88IntelFlashMemoryCard";
import { Z88AmdFlash29F040B } from "./Z88AmdFlash29F040B";
import { Z88AmdFlash29F080B } from "./Z88AmdFlash29F080B";
import { z88CardSpec } from "../z88CardCatalog";

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
  // --- The shared rules: size first, then the card type (both backends use them)
  const spec = z88CardSpec(type, size);

  // --- Instantiate the card
  let card: IZ88MemoryCard;
  switch (spec.kind) {
    case "RAM":
      card = new Z88RamMemoryCard(host, spec.sizeInBytes);
      break;
    case "ROM":
      card = new Z88RomMemoryCard(host, spec.sizeInBytes);
      break;
    case "UV_EPROM":
      card = new Z88UvEpromMemoryCard(host, spec.sizeInBytes);
      break;
    case "INTEL_FLASH":
      card = new Z88IntelFlashMemoryCard(host, spec.sizeInBytes);
      break;
    case "AMD_FLASH_29F040B":
      card = new Z88AmdFlash29F040B(host);
      break;
    case "AMD_FLASH_29F080B":
      card = new Z88AmdFlash29F080B(host);
      break;
  }
  return card;
}
