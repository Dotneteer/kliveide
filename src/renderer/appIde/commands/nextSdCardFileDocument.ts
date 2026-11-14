import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { MessageKey } from "@common/i18n/keys.generated";

import { MI_ZXNEXT } from "@common/machines/constants";
import { commandError, commandSuccess } from "@renderer/appIde/services/ide-commands";
import { t } from "@common/i18n/i18n";

/*
 * A file on the ZX Spectrum Next's current SD card, opened read-only in its viewer: what `show-tbu`
 * and `show-fw` share (`dev/plans/TBBLUE_TBU_VIEWER_PLAN.md` Phase 5,
 * `dev/plans/TBBLUE_FW_VIEWER_PLAN.md` Phase 3). Each command words its own errors.
 */

export type NextSdCardFileTexts = {
  nextOnly: MessageKey;
  noCard: MessageKey;
  notFound: MessageKey;
  unreadable: MessageKey;
};

export type NextSdCardFileSpec = {
  /** The file's name in the card's root folder */
  fileName: string;
  /** The viewer's editor id */
  viewer: string;
  /** The document id: one document per card, so two cards can be compared side by side */
  documentId: (card: string) => string;
  texts: NextSdCardFileTexts;
};

/** `TBBLUE.TBU · ks2-30303.cim` */
export const nextSdCardDocumentName = (fileName: string, card: string) => `${fileName} · ${card.replace(/^.*[\\/]/, "")}`;

export async function openNextSdCardFile(context: IdeCommandContext, spec: NextSdCardFileSpec): Promise<IdeCommandResult> {
  const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
  if (machineId !== MI_ZXNEXT) return commandError(t(spec.texts.nextOnly));

  const result = await context.mainApi.readNextSdCardFile(spec.fileName);
  const cardName = result.card.replace(/^.*[\\/]/, "");
  if (result.error === "noCard") return commandError(t(spec.texts.noCard, { card: result.card }));
  if (result.error === "notFound") return commandError(t(spec.texts.notFound, { card: cardName }));
  if (result.error || !result.contents) {
    return commandError(t(spec.texts.unreadable, { card: cardName, reason: result.message ?? "" }));
  }

  // --- Always the card's bytes as they are now: an open document of the same card is replaced, so
  // --- a card the machine has updated since is not shown as it was
  const hub = context.service.projectService.getActiveDocumentHubService();
  const id = spec.documentId(result.card);
  if (hub.isOpen(id)) await hub.closeDocument(id);
  await hub.openDocument(
    {
      id,
      name: nextSdCardDocumentName(spec.fileName, result.card),
      type: spec.viewer,
      iconName: "cpu",
      contents: result.contents,
      isReadOnly: true
    },
    undefined,
    false
  );
  return commandSuccess;
}
