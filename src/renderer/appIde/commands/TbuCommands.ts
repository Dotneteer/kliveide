import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";

import { MI_ZXNEXT } from "@common/machines/constants";
import { TBU_VIEWER } from "@common/state/common-ids";
import { IdeCommandBase, commandError, commandSuccess } from "@renderer/appIde/services/ide-commands";
import { t } from "@common/i18n/i18n";

/*
 * `show-tbu`: the core update file on the ZX Spectrum Next's current SD card, in the TBU viewer
 * (`dev/plans/TBBLUE_TBU_VIEWER_PLAN.md`, Phase 5). Machine › SD Card › Show TBBLUE.TBU runs it.
 */

/** The update file's name on the card's root folder */
export const TBU_FILE_NAME = "TBBLUE.TBU";

/** The document of one card's update file: one per card, so two cards can be compared side by side */
export const tbuCardDocumentId = (card: string) => `tbuCard:${card}`;

/** `TBBLUE.TBU · ks2-30303.cim` */
export const tbuCardDocumentName = (card: string) => `${TBU_FILE_NAME} · ${card.replace(/^.*[\\/]/, "")}`;

export class ShowTbuCommand extends IdeCommandBase {
  readonly id = "show-tbu";
  get description() {
    return t("commands.tbu.showDescription");
  }
  readonly usage = "show-tbu";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
    if (machineId !== MI_ZXNEXT) return commandError(t("commands.tbu.nextOnly"));

    const result = await context.mainApi.readNextSdCardFile(TBU_FILE_NAME);
    const cardName = result.card.replace(/^.*[\\/]/, "");
    if (result.error === "noCard") return commandError(t("commands.tbu.noCard", { card: result.card }));
    if (result.error === "notFound") return commandError(t("commands.tbu.notFound", { card: cardName }));
    if (result.error || !result.contents) {
      return commandError(t("commands.tbu.unreadable", { card: cardName, reason: result.message ?? "" }));
    }

    // --- Always the card's bytes as they are now: an open document of the same card is replaced, so
    // --- a card the machine has updated since is not shown as it was
    const hub = context.service.projectService.getActiveDocumentHubService();
    const id = tbuCardDocumentId(result.card);
    if (hub.isOpen(id)) await hub.closeDocument(id);
    await hub.openDocument(
      {
        id,
        name: tbuCardDocumentName(result.card),
        type: TBU_VIEWER,
        iconName: "cpu",
        contents: result.contents,
        isReadOnly: true
      },
      undefined,
      false
    );
    return commandSuccess;
  }
}
