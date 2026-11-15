import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";

import { MF_AUDIO_MIXER } from "@common/machines/constants";
import { AUDIO_MIXER_PANEL_ID } from "@common/state/common-ids";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import { IdeCommandBase, commandError, commandSuccess } from "@renderer/appIde/services/ide-commands";
import { t } from "@common/i18n/i18n";

/*
 * The audio mixer's IDE command (`dev/plans/AUDIO_MIXER_PLAN.md` §3.4).
 */

/** `show-audio-mixer`: opens the Audio Mixer document (machines with sound only) */
export class ShowAudioMixerCommand extends IdeCommandBase {
  readonly id = "show-audio-mixer";
  get description() {
    return t("commands.audioMixer.showDescription");
  }
  readonly usage = "show-audio-mixer";
  readonly aliases = ["shmix"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const machine = context.service.machineService.getMachineInfo()?.machine;
    if (!machine?.features?.[MF_AUDIO_MIXER]) return commandError(t("commands.audioMixer.noSound"));
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(AUDIO_MIXER_PANEL_ID)) {
      await documentHubService.setActiveDocument(AUDIO_MIXER_PANEL_ID);
    } else {
      await documentHubService.openDocument(createSpecialDocument(AUDIO_MIXER_PANEL_ID), undefined, false);
    }
    return commandSuccess;
  }
}
