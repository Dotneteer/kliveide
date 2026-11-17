import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

import { NEXT_ROM_SETS, type NextRomSetId } from "@common/zxnext/romSets";

import { REPO_ROOT } from "./machines";

/*
 * The ZX Spectrum Next's SD base cards for a test, by ROM set (`dev/plans/NEXT_SD_CARDS_PLAN.md`,
 * phase 3, D-6): the one place the tests find them. The cards are not in git: `npm run next-sd:fetch`
 * downloads and checks them into the git-ignored `.local/next-sd/` (`KLIVE_NEXT_SD_LOCAL` names
 * another folder).
 */

const LOCAL = process.env.KLIVE_NEXT_SD_LOCAL || join(REPO_ROOT, ".local/next-sd");

/** The absolute path of a set's raw SD base card; throws, naming the command, when it is not here */
export function nextSdBaseImage(setId: NextRomSetId): string {
  const card = NEXT_ROM_SETS[setId].sdBaseImage;
  const file = join(LOCAL, `${setId}-base.cim`);
  if (!existsSync(file) || statSync(file).size !== card.size) {
    throw new Error(`The ${setId} SD card is not here (${file}): run npm run next-sd:fetch`);
  }
  return file;
}
