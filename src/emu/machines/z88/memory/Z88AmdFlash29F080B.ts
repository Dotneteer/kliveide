/**
 * Z88 AMD Flash Chip 29F080B (1Mb) emulation.
 *
 * The emulation of the AMD and compatible Flash Memory solely implements the
 * chip command mode programming, since the Z88 Flash Cards only responds to
 * those command sequences (and not the hardware pin manipulation). Erase
 * Suspend and Erase Resume commands are also not implemented.
 */

import type { IZ88Machine } from "../../../abstractions/IZ88Machine";

import { CardType } from "../../../machines/z88/memory/CardType";
import { Z88AmdFlashMemoryCard } from "./Z88AmdFlashMemoryCard";

export class Z88AmdFlash29F080B extends Z88AmdFlashMemoryCard {

  /**
   * Initializes the AMD Flash 29F080B chip (1Mb)
   */
  public constructor (
    public readonly host: IZ88Machine,
  ) {
    super(host, 1024*1024);

    this.type = CardType.FlashAmd29F080B;
  }

}
