import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";

import { t } from "@common/i18n/i18n";
import { FILE_MANAGER_PANEL_ID } from "@common/state/common-ids";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import { IdeCommandBase, commandSuccess } from "@renderer/appIde/services/ide-commands";

/** `show-file-manager` (`fm`): opens the two-pane File Manager (`.plans/FILE_MANAGER_PLAN.md`, D1) */
export class ShowFileManagerCommand extends IdeCommandBase {
  readonly id = "show-file-manager";
  get description() {
    return t("commands.fileManager.showDescription");
  }
  readonly usage = "show-file-manager";
  readonly aliases = ["fm"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(FILE_MANAGER_PANEL_ID)) {
      await documentHubService.setActiveDocument(FILE_MANAGER_PANEL_ID);
    } else {
      await documentHubService.openDocument(createSpecialDocument(FILE_MANAGER_PANEL_ID), undefined, false);
    }
    return commandSuccess;
  }
}
