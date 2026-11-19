/**
 * What an unimplemented file viewer says.
 *
 * A viewer that does not exist yet (`.VID`) shows this rather than a title bar over an empty
 * rectangle, which read as a file that failed to load. The screen formats that once said it
 * (`.SHC`, `.SHR`, `.SLR`, `.SL2`, `.NXI`) are viewers now (`ScreenFileViewerPanels.tsx`).
 *
 * The words live here rather than in each panel, so a new placeholder inherits them rather than
 * copying them.
 */
import { t } from "@common/i18n/i18n";

/** The message, in the display language (D7: read at display time). */
export function notImplementedMessage(): string {
  return t("panels.next.notImplemented");
}
