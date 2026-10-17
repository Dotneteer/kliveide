import { LatestRun } from "@mvc/core/LatestRun";
import { UiController } from "@mvc/core/UiController";
import { messageOf } from "@mvc/core/errors";

import type { BorielSetupIntent } from "./BorielSetupIntents";
import {
  initialState,
  reduce,
  type BorielSetupEvent,
  type BorielSetupMode,
  type BorielSetupState
} from "./BorielSetupModel";
import {
  BORIEL_EXISTING_FOLDER_SETTINGS_KEY,
  BORIEL_INSTALL_FOLDER_SETTINGS_KEY,
  type BorielSetupPorts
} from "./BorielSetupPorts";
import { selectViewModel, type BorielSetupViewModel } from "./BorielSetupViewModel";

/**
 * Orchestrates the Boriel BASIC setup dialog: intents in, port calls out, events into the pure
 * reducer. No React, no DOM: a test drives it by dispatching intents against fake ports.
 */
export class BorielSetupController extends UiController<
  BorielSetupState,
  BorielSetupIntent,
  BorielSetupEvent,
  BorielSetupViewModel
> {
  private readonly statusRun = new LatestRun();

  constructor(
    private readonly ports: BorielSetupPorts,
    mode: BorielSetupMode
  ) {
    super(initialState(mode), reduce, selectViewModel);
  }

  protected async handle(intent: BorielSetupIntent): Promise<void> {
    switch (intent.type) {
      case "opened":
        await this.loadStatus();
        return;

      case "folderEdited":
        this.emit({ type: "folderChanged", folder: intent.folder, edited: true });
        return;

      case "browseFolderRequested": {
        if (this.state.busy) return;
        const folder = await this.ports.files.pickFolder(BORIEL_INSTALL_FOLDER_SETTINGS_KEY);
        if (folder) this.emit({ type: "folderChanged", folder, edited: true });
        return;
      }

      case "dontAskAgainToggled":
        this.emit({ type: "dontAskAgainChanged", value: intent.value });
        return;

      case "installRequested":
        await this.install();
        return;

      case "useExistingRequested":
        await this.useExisting();
        return;

      case "closeRequested":
        await this.requestClose();
        return;
    }
  }

  private async loadStatus(): Promise<void> {
    const run = this.statusRun.begin();
    this.emit({ type: "statusLoadStarted" });
    try {
      const status = await this.ports.service.getStatus();
      if (run.isCurrent()) this.emit({ type: "statusLoaded", status });
    } catch (error) {
      if (run.isCurrent()) this.emit({ type: "statusLoadFailed", error: messageOf(error) });
    }
  }

  private async install(): Promise<void> {
    const folder = this.state.folder.trim();
    if (!folder || this.state.busy || !this.viewModel.primary.enabled) return;
    this.emit({ type: "installStarted" });
    try {
      const result = await this.ports.service.install(folder);
      this.emit({ type: "actionSettled", action: "install", result });
    } catch (error) {
      this.emit({ type: "actionFailed", message: messageOf(error) });
      return;
    }
    // --- Whatever happened, the settings may have changed: show what Klive uses now
    await this.loadStatus();
  }

  private async useExisting(): Promise<void> {
    if (this.state.busy) return;
    const picked = await this.ports.files.pickFolder(BORIEL_EXISTING_FOLDER_SETTINGS_KEY);
    if (!picked) return;
    this.emit({ type: "existingStarted" });
    try {
      const result = await this.ports.service.useExisting(picked);
      this.emit({ type: "actionSettled", action: "existing", result });
    } catch (error) {
      this.emit({ type: "actionFailed", message: messageOf(error) });
      return;
    }
    await this.loadStatus();
  }

  /**
   * Every dismissal (Not now, Close, the X, Escape) comes here. The offer records its answer, so
   * "Not now" asks again at the next start and "Don't ask again" does not, unless Boriel BASIC got
   * installed meanwhile, which needs no answer.
   */
  private async requestClose(): Promise<void> {
    if (this.state.busy) return;
    if (this.state.mode === "offer" && this.state.status?.installation.kind !== "working") {
      this.emit({ type: "closingStarted" });
      try {
        await this.ports.service.recordDecision(this.state.dontAskAgain ? "declined" : "postponed");
      } catch (error) {
        this.emit({ type: "closingFailed", message: messageOf(error) });
        return;
      }
    }
    this.ports.close.close("close");
  }

  dispose(): void {
    this.statusRun.cancelAll();
    super.dispose();
  }
}
