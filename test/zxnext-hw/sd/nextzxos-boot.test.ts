import { constants, copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CimHandler } from "@main/fat32/CimHandlers";

import { createSession, type NextTestSession, type SdCardBacking } from "../../harness/zxnext";
import { colours } from "../ula/_ula-helpers";

/*
 * SPI-009 - NextZXOS boots from the SD card, headless, on both cores.
 *
 * The card is a clone of the developer's `~/Klive/ks2.cim` (the one the app creates; `KLIVE_SD_CARD`
 * overrides the path), so the test is skipped where there is none. vitest points HOME at a sandbox, so
 * the real home comes from the user database. Each core gets its own clone: NextZXOS writes to the card.
 *
 * What must hold: the machine asks the host for the card size once and reads the card through SPI
 * (CMD17/CMD18 via port $EB) until the NextZXOS menu is up - the title bar with its colour stripes - and
 * both cores show the same picture - the menu's date line included: both get the same DS1307 time
 * (I2C-003).
 */

const CARD = process.env.KLIVE_SD_CARD ?? join(userInfo().homedir, "Klive", "ks2.cim");
const BOOT_FRAMES = 250;
/** Buffer rows of the menu's date line (the RTC). */
const DATE_ROWS: [number, number] = [154, 168];

function cloneCard(dir: string, name: string): { card: SdCardBacking; close: () => void } {
  const path = join(dir, name);
  copyFileSync(CARD, path, constants.COPYFILE_FICLONE);
  const handler = new CimHandler(path);
  const info = handler.cimInfo;
  return {
    card: {
      totalSectors: (info.maxSize * 2048) / info.sectorSize,
      readSector: (i) => handler.readSector(i),
      writeSector: (i, d) => handler.writeSector(i, d)
    },
    close: () => handler.close()
  };
}

async function boot(core: "ts" | "wasm", dir: string): Promise<NextTestSession> {
  const { card, close } = cloneCard(dir, `ks2-${core}.cim`);
  try {
    const s = await createSession(core);
    s.setRtcTime({ year: 26, month: 9, date: 18, day: 6, hours: 12, minutes: 34, seconds: 56 });
    s.attachSdCard(card);
    await s.runFramesAsync(BOOT_FRAMES);
    return s;
  } finally {
    close();
  }
}

describe.skipIf(!existsSync(CARD))("SPI-009: NextZXOS boots from the SD card", () => {
  it("both cores read the card and show the same NextZXOS menu", async () => {
    const dir = mkdtempSync(join(tmpdir(), "klive-spi009-"));
    try {
      const ts = await boot("ts", dir);
      const wasm = await boot("wasm", dir);
      for (const s of [ts, wasm]) {
        expect(s.sdCalls.getSdCardInfo, `${s.core}: size asked once`).toBe(1);
        expect(s.sdCalls.readSdCardSector, `${s.core}: sectors read`).toBeGreaterThan(200);
        // --- the title bar's colour stripes: black, white and at least four stripe colours
        expect(colours(s, [360, 470], [88, 100]).split(",").length, `${s.core}: the menu title bar`).toBeGreaterThanOrEqual(6);
        // --- NextZXOS shows the date only when it finds the RTC
        expect(colours(s, [0, 719], DATE_ROWS).split(",").length, `${s.core}: the date line`).toBeGreaterThanOrEqual(2);
      }
      const differing: string[] = [];
      for (let y = 0; y < 288; y++) {
        for (let x = 0; x < 720; x++) if (ts.pixel(x, y) !== wasm.pixel(x, y)) differing.push(`(${x},${y})`);
      }
      expect(differing.slice(0, 10), `${differing.length} pixels differ`).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 300_000);
});
