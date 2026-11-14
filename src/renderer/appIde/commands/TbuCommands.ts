import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";

import { TBU_VIEWER } from "@common/state/common-ids";
import { IdeCommandBase } from "@renderer/appIde/services/ide-commands";
import { t } from "@common/i18n/i18n";
import { nextSdCardDocumentName, openNextSdCardFile } from "./nextSdCardFileDocument";

/*
 * `show-tbu`: the core update file on the ZX Spectrum Next's current SD card, in the TBU viewer
 * (`dev/plans/TBBLUE_TBU_VIEWER_PLAN.md`, Phase 5). Machine › SD Card › Show TBBLUE.TBU runs it.
 */

/** The update file's name on the card's root folder */
export const TBU_FILE_NAME = "TBBLUE.TBU";

/** The document of one card's update file: one per card, so two cards can be compared side by side */
export const tbuCardDocumentId = (card: string) => `tbuCard:${card}`;

/** `TBBLUE.TBU · ks2-30303.cim` */
export const tbuCardDocumentName = (card: string) => nextSdCardDocumentName(TBU_FILE_NAME, card);

export class ShowTbuCommand extends IdeCommandBase {
  readonly id = "show-tbu";
  get description() {
    return t("commands.tbu.showDescription");
  }
  readonly usage = "show-tbu";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    return openNextSdCardFile(context, {
      fileName: TBU_FILE_NAME,
      viewer: TBU_VIEWER,
      documentId: tbuCardDocumentId,
      texts: {
        nextOnly: "commands.tbu.nextOnly",
        noCard: "commands.tbu.noCard",
        notFound: "commands.tbu.notFound",
        unreadable: "commands.tbu.unreadable"
      }
    });
  }
}
