import { describe, expect, it } from "vitest";

import { bootNextZxos, nextZxosMenuShown } from "../../harness/zxnext";
import { colours } from "../ula/_ula-helpers";

/*
 * SPI-009 - NextZXOS boots from the SD card, headless.
 *
 * The card is a clone of the 2.08 base card (`bootNextZxos`; `KLIVE_SD_CARD` names another CIM). A
 * base card shows NextZXOS's welcome pages first; the boot passes them with SPACE.
 *
 * What must hold: the machine asks the host for the card size once and reads the card through SPI
 * (CMD17/CMD18 via port $EB) until the NextZXOS menu is up - the title bar with its colour stripes and
 * the date line, which NextZXOS shows only when it finds the DS1307 (I2C-003).
 */

/** Buffer rows of the menu's date line (the RTC). */
const DATE_ROWS: [number, number] = [154, 168];

describe("SPI-009: NextZXOS boots from the SD card", () => {
  it("reads the card and shows the NextZXOS menu", async () => {
    const { s, close } = await bootNextZxos({ year: 26, month: 9, date: 18, day: 6, hours: 12, minutes: 34, seconds: 56 });
    try {
      expect(s.sdCalls.getSdCardInfo, "size asked once").toBe(1);
      expect(s.sdCalls.readSdCardSector, "sectors read").toBeGreaterThan(200);
      // --- the title bar's colour stripes: black, white and at least four stripe colours
      expect(nextZxosMenuShown(s), "the menu title bar").toBe(true);
      // --- NextZXOS shows the date only when it finds the RTC
      expect(colours(s, [0, 719], DATE_ROWS).split(",").length, "the date line").toBeGreaterThanOrEqual(2);
    } finally {
      close();
    }
  }, 300_000);
});
