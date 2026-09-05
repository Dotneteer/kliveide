import type { ExportDialogSettings } from "@main/settings";
import { LatestRun } from "@mvc/core/LatestRun";
import { UiController } from "@mvc/core/UiController";

import type { ExportCodeIntent } from "./ExportCodeIntents";
import {
  EXPORT_CODE_FOLDER_SETTINGS_KEY,
  EXPORT_TITLE,
  SCREEN_FILE_FILTERS,
  canExport,
  commandOf,
  exportFailureMessage,
  exportSuccessMessage,
  initialState,
  reduce,
  savedSettingsOf,
  type ExportCodeEnvironment,
  type ExportCodeEvent,
  type ExportCodeState
} from "./ExportCodeModel";
import type { ExportCodePorts } from "./ExportCodePorts";
import { selectViewModel, type ExportCodeViewModel } from "./ExportCodeViewModel";

/**
 * Orchestrates the Export Code dialog.
 *
 * Two independent streams run here: the form persists itself into the project
 * settings after every edit, and Export builds a command and runs it. Keeping
 * them on separate generations is what stops a save that is still in flight
 * from interfering with an export — or with a later save.
 */
export class ExportCodeController extends UiController<
  ExportCodeState,
  ExportCodeIntent,
  ExportCodeEvent,
  ExportCodeViewModel
> {
  private readonly persistRun = new LatestRun();
  private readonly exportRun = new LatestRun();

  constructor(
    private readonly ports: ExportCodePorts,
    env: ExportCodeEnvironment,
    saved: ExportDialogSettings = {}
  ) {
    super(initialState(env, saved), reduce, selectViewModel);
  }

  protected async handle(intent: ExportCodeIntent): Promise<void> {
    switch (intent.type) {
      case "opened":
        // --- The old component's persisting effect ran on mount as well, which
        // --- normalises settings written by an older version of the dialog.
        await this.persist();
        return;

      case "environmentChanged":
        this.emit({ type: "envReplaced", env: intent.env });
        return;

      case "settingEdited": {
        const before = this.state;
        this.emit({ type: "settingsChanged", patch: intent.patch });
        // --- A patch that changed nothing is not worth a project save; the old
        // --- effect fired on every render of every control.
        if (this.state !== before) await this.persist();
        return;
      }

      case "selectExportFolderRequested": {
        const folder = await this.ports.files.pickFolder(EXPORT_CODE_FOLDER_SETTINGS_KEY);
        if (folder) await this.handle({ type: "settingEdited", patch: { exportFolder: folder } });
        return;
      }

      case "selectScreenFileRequested": {
        const file = await this.ports.files.pickFile(
          SCREEN_FILE_FILTERS,
          EXPORT_CODE_FOLDER_SETTINGS_KEY
        );
        if (file) {
          await this.handle({ type: "settingEdited", patch: { screenFilename: file } });
        }
        return;
      }

      case "exportRequested":
        await this.export();
        return;

      case "cancelRequested":
        this.ports.close.cancelled();
        return;
    }
  }

  private async persist(): Promise<void> {
    const token = this.persistRun.begin();
    const saved = savedSettingsOf(this.state.settings);
    try {
      await this.ports.service.persistSettings(saved);
    } catch (error) {
      // --- A settings write that fails must not take the dialog down with it:
      // --- the user's real business here is the export.
      if (token.isCurrent()) {
        console.error("Saving the export settings failed", error);
      }
    }
  }

  private async export(): Promise<void> {
    const state = this.state;
    // --- The footer disables Export, but Enter in a text field submits anyway.
    if (state.busy || !canExport(state)) return;

    const { command, fullFilename } = commandOf(state);
    const settings = state.settings;
    const token = this.exportRun.begin();
    this.emit({ type: "exportStarted" });

    try {
      const result = await this.ports.service.runExport(command);
      if (!token.isCurrent()) return;

      if (!result.success) {
        // --- The dialog stays open: the form is what the user needs to fix.
        await this.ports.service.notify(
          "error",
          EXPORT_TITLE,
          exportFailureMessage(result.finalMessage)
        );
        return;
      }

      await this.ports.service.notify(
        "info",
        EXPORT_TITLE,
        exportSuccessMessage(result.finalMessage)
      );
      if (!token.isCurrent()) return;

      await this.ports.close.exported({
        command,
        fullFilename,
        formatId: settings.formatId,
        exportName: settings.exportName,
        exportFolder: settings.exportFolder,
        programName: settings.programName,
        startAddress: settings.startAddress
      });
    } finally {
      this.emit({ type: "exportSettled" });
    }
  }

  dispose(): void {
    this.persistRun.cancelAll();
    this.exportRun.cancelAll();
    super.dispose();
  }
}
