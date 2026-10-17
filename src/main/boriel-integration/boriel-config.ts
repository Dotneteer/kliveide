/*
 * Settings keys of the Boriel BASIC 2.x integration (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` B3).
 * The executable comes from `zxbasic.executablePath` when set (`ZXBC_EXECUTABLE_PATH`), otherwise
 * from the install folder below. Both are user settings; a project may override them.
 */

/** The folder Boriel BASIC is installed in (`~/zxbasic2` by default). */
export const BORIEL_INSTALL_FOLDER = "zxbasic.root";

/** The version the setup installed or found there (metadata only: the probe is the truth). */
export const BORIEL_VERSION = "zxbasic.borielVersion";

/** The marker an installation by Klive leaves in its folder; an update may replace only such a folder. */
export const BORIEL_MARKER_FILE = ".klive-boriel.json";

/** The folder name a new installation gets under the user's home folder. */
export const BORIEL_DEFAULT_FOLDER_NAME = "zxbasic2";

/** The oldest major version Klive accepts: 2.x writes the `.dbg` debug file (plan B1). */
export const BORIEL_MIN_MAJOR_VERSION = 2;
