/**
 * Z88 AMD compatible Flash Chip Macronix 29F040C (512K) emulation.
 *
 * The emulation of the AMD and compatible Flash Memory solely implements the
 * chip command mode programming, since the Z88 Flash Cards only responds to
 * those command sequences (and not the hardware pin manipulation). Erase
 * Suspend and Erase Resume commands are also not implemented.
 */

import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { CardType } from "@emu/machines/z88/memory/CardType";
import { Z88AmdFlashMemoryCard } from "./Z88AmdFlashMemoryCard";

export class Z88MX29F040C extends Z88AmdFlashMemoryCard {

  /**
   * Initializes the AMD compatible Macronix 29F040C Flash chip (512K)
   */
  public constructor (
    public readonly host: IZ88Machine,
  ) {
    super(host, 512*1024);

    this.type = CardType.FlashMacronix29F040C;
  }

}
