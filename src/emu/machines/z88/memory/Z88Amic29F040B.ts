/**
 * Z88 AMD compatible Flash Chip AMIC A29F040B (512K) emulation.
 *
 * The emulation of the AMD and compatible Flash Memory solely implements the
 * chip command mode programming, since the Z88 Flash Cards only responds to
 * those command sequences (and not the hardware pin manipulation). Erase
 * Suspend and Erase Resume commands are also not implemented.
 */

import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { CardType } from "@emu/machines/z88/memory/CardType";
import { Z88AmdFlashMemoryCard } from "./Z88AmdFlashMemoryCard";

export class Z88Amic29F040B extends Z88AmdFlashMemoryCard {

  /**
   * Initializes the AMD compatible AMIC A29F040B Flash chip (512K)
   */
  public constructor (
    public readonly host: IZ88Machine,
  ) {
    super(host, 512*1024);

    this.type = CardType.FlashAmic29F040B;
  }

}
