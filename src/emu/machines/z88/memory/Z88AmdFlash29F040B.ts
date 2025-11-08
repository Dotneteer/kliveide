/**
 * Z88 AMD Flash Chip 29F040B (512K) emulation.
 *
 * The emulation of the AMD and compatible Flash Memory solely implements the
 * chip command mode programming, since the Z88 Flash Cards only responds to
 * those command sequences (and not the hardware pin manipulation). Erase
 * Suspend and Erase Resume commands are also not implemented.
 */

import type { IZ88Machine } from "@emuabstr/IZ88Machine";

import { CardType } from "./CardType";
import { Z88AmdFlashMemoryCard } from "./Z88AmdFlashMemoryCard";

export class Z88AmdFlash29F040B extends Z88AmdFlashMemoryCard {

  /**
   * Initializes the AMD Flash 29F040B chip (512K)
   */
  public constructor (
    public readonly host: IZ88Machine,
  ) {
    super(host, 512*1024);

    this.type = CardType.FlashAmd29F040B;
  }

}
