import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";

import { FW_VIEWER } from "@common/state/common-ids";
import { IdeCommandBase } from "@renderer/appIde/services/ide-commands";
import { t } from "@common/i18n/i18n";
import { openNextSdCardFile } from "./nextSdCardFileDocument";

/*
 * `show-fw`: the firmware file on the ZX Spectrum Next's current SD card, in the FW viewer
 * (`dev/plans/TBBLUE_FW_VIEWER_PLAN.md`, Phase 3). Machine › SD Card › Show TBBLUE.FW runs it.
 */

/** The firmware file's name on the card's root folder */
export const FW_FILE_NAME = "TBBLUE.FW";

/** The document of one card's firmware file */
export const fwCardDocumentId = (card: string) => `fwCard:${card}`;

export class ShowFwCommand extends IdeCommandBase {
  readonly id = "show-fw";
  get description() {
    return t("commands.fw.showDescription");
  }
  readonly usage = "show-fw";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    return openNextSdCardFile(context, {
      fileName: FW_FILE_NAME,
      viewer: FW_VIEWER,
      documentId: fwCardDocumentId,
      texts: {
        nextOnly: "commands.fw.nextOnly",
        noCard: "commands.fw.noCard",
        notFound: "commands.fw.notFound",
        unreadable: "commands.fw.unreadable"
      }
    });
  }
}
