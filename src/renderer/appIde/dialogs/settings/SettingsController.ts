/*
 * The Settings dialog's controller (`.plans/MENU_REDESIGN_PLAN.md` §4.2): it turns the user's
 * changes into writes, through ports the tests fake. Changes apply at once, as the menu checkboxes
 * did, so there is no draft to keep or discard.
 */
import { UiController } from "@renderer/mvc";
import type { UiActionId } from "@common/settings/ui-action-ids";
import {
  SETTINGS_ROWS,
  type SettingsPageId,
  type SettingsRow,
  isSettingsRowLocked,
  readSettingsRowValue,
  settingIdOf,
  settingsRowDefault,
  settingsRowOptions
} from "@common/settings/settings-pages";
import {
  createInitialState,
  reduce,
  type SettingsEnvironment,
  type SettingsEvent,
  type SettingsState
} from "./SettingsModel";
import { applicableRows, optionKey, selectViewModel, type SettingsVm } from "./SettingsViewModel";

export type SettingsPorts = {
  /** Writes a registered setting */
  setSetting: (settingId: string, value: unknown) => Promise<void>;
  /** Runs a UI action in the main process; resolves to an error message */
  runAction: (actionId: UiActionId, value?: unknown) => Promise<string | undefined>;
  /** Closes the dialog */
  close: () => void;
};

export type SettingsIntent =
  | { type: "pageSelected"; page: SettingsPageId }
  | { type: "queryChanged"; query: string }
  | { type: "environmentChanged"; env: SettingsEnvironment }
  /** A switch flipped, or a select picked an option (by its key) */
  | { type: "valueChanged"; rowId: string; value: string | boolean }
  | { type: "buttonClicked"; rowId: string; index: number }
  | { type: "resetPageRequested" };

export class SettingsController extends UiController<SettingsState, SettingsIntent, SettingsEvent, SettingsVm> {
  constructor(
    private readonly ports: SettingsPorts,
    page: unknown,
    env: SettingsEnvironment
  ) {
    super(createInitialState(page, env), reduce, selectViewModel);
  }

  protected async handle(intent: SettingsIntent): Promise<void> {
    switch (intent.type) {
      case "pageSelected":
        this.emit({ type: "pageSelected", page: intent.page });
        return;
      case "queryChanged":
        this.emit({ type: "queryChanged", query: intent.query });
        return;
      case "environmentChanged":
        this.emit({ type: "environmentChanged", env: intent.env });
        return;
      case "valueChanged": {
        const row = SETTINGS_ROWS.find((r) => r.id === intent.rowId);
        if (!row || isSettingsRowLocked(row, this.state.env.appState)) return;
        const value = this.valueOf(row, intent.value);
        if (value === undefined) return;
        await this.write(row, value);
        return;
      }
      case "buttonClicked": {
        const row = SETTINGS_ROWS.find((r) => r.id === intent.rowId);
        const button = row?.buttons?.[intent.index];
        if (!row || !button) return;
        if (button.closesDialog) {
          // --- The action opens a dialog of its own; one dialog is shown at a time
          this.ports.close();
          await this.ports.runAction(button.action);
          return;
        }
        await this.run(row.id, () => this.ports.runAction(button.action));
        return;
      }
      case "resetPageRequested": {
        const appState = this.state.env.appState;
        for (const row of applicableRows(this.state.page, this.state)) {
          if (!row.source || row.editor === "file" || isSettingsRowLocked(row, appState)) continue;
          const value = settingsRowDefault(row, appState);
          if (value === undefined || value === readSettingsRowValue(row, appState)) continue;
          await this.write(row, value);
        }
        return;
      }
    }
  }

  /** A view value turned back into the row's own type: a select's option key into its value */
  private valueOf(row: SettingsRow, value: string | boolean): unknown {
    if (row.editor === "switch") return !!value;
    const option = settingsRowOptions(row, this.state.env.platform).find(
      (o) => optionKey(o.value) === optionKey(value)
    );
    return option?.value;
  }

  private async write(row: SettingsRow, value: unknown): Promise<void> {
    const source = row.source;
    if (!source) return;
    if (source.kind === "setting") {
      const settingId = settingIdOf(row, this.state.env.appState);
      await this.run(row.id, async () => {
        await this.ports.setSetting(settingId, value);
        return undefined;
      });
    } else {
      await this.run(row.id, () => this.ports.runAction(`set:${source.key}` as UiActionId, value));
    }
  }

  private async run(rowId: string, work: () => Promise<string | undefined>): Promise<void> {
    this.emit({ type: "writeStarted", rowId });
    let error: string | undefined;
    try {
      error = await work();
    } catch (err) {
      error = (err as Error)?.message ?? String(err);
    }
    this.emit({ type: "writeSettled", rowId, error });
  }
}
