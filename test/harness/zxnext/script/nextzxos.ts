import { constants, copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CimHandler } from "@main/fat32/CimHandlers";

import { nextSdBaseImage } from "../core/sdCards";
import { createSession, type NextTestSession, type RtcTime } from "./session";

/*
 * Booting NextZXOS from an SD card in node, up to its main menu.
 *
 * The card is the default model's ROM set's base card (`nextSdBaseImage("nextzxos-2.08")`, fetched
 * by `npm run next-sd:fetch`), or the CIM that `KLIVE_SD_CARD` names. It is booted from a clone
 * (`cp -c`), never the card itself: NextZXOS writes to the card.
 *
 * A fresh card shows NextZXOS's "Welcome to NextZXOS" pages before the menu, until someone presses
 * D on them; a base card is always fresh. The boot presses SPACE ("Start NextZXOS") when the menu's
 * title bar is not up, so a card that skips the welcome boots the same way.
 */

/** Frames NextZXOS takes from reset to its first screen (welcome pages or the menu) */
const BOOT_FRAMES = 250;
/** Frames from SPACE on the welcome pages to the menu */
const WELCOME_FRAMES = 150;

export type NextZxosBoot = {
  /** The session, at the NextZXOS main menu */
  s: NextTestSession;
  /** The card clone the machine reads and writes: what NextZXOS saves lands here */
  cardPath: string;
  /** Closes the card clone and deletes it; call it in a `finally` */
  close: () => void;
};

/** Whether the NextZXOS main menu's title bar (black, white and its colour stripes) is on screen */
export function nextZxosMenuShown(s: NextTestSession): boolean {
  const seen = new Set<string>();
  for (let y = 88; y <= 100; y++) for (let x = 360; x <= 470; x++) seen.add(s.pixel(x, y));
  return seen.size >= 6;
}

/**
 * Boots NextZXOS on the implicit Next model from a clone of an SD card and runs until its main menu is
 * up, passing the welcome pages of a fresh card.
 * @param rtc The time the DS1307 starts at (the menu shows the date only when it finds the RTC)
 * @param card A CIM file to clone; by default `KLIVE_SD_CARD`, else the 2.08 base card
 */
export async function bootNextZxos(rtc: RtcTime, card?: string): Promise<NextZxosBoot> {
  const source = card ?? process.env.KLIVE_SD_CARD ?? nextSdBaseImage("nextzxos-2.08");
  const dir = mkdtempSync(join(tmpdir(), "klive-nextzxos-"));
  const path = join(dir, "card.cim");
  copyFileSync(source, path, constants.COPYFILE_FICLONE);
  const handler = new CimHandler(path);
  const close = () => {
    handler.close();
    rmSync(dir, { recursive: true, force: true });
  };
  try {
    const info = handler.cimInfo;
    const s = await createSession();
    s.setRtcTime(rtc);
    s.attachSdCard({
      totalSectors: (info.maxSize * 2048) / info.sectorSize,
      readSector: (i) => handler.readSector(i),
      writeSector: (i, d) => handler.writeSector(i, d)
    });
    await s.runFramesAsync(BOOT_FRAMES);
    if (!nextZxosMenuShown(s)) {
      // --- the welcome pages: SPACE is "Start NextZXOS"
      s.keyDown("SPACE");
      await s.runFramesAsync(4);
      s.keyUp("SPACE");
      await s.runFramesAsync(WELCOME_FRAMES);
    }
    return { s, cardPath: path, close };
  } catch (e) {
    close();
    throw e;
  }
}
