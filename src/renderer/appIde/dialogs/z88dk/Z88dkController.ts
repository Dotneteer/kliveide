import { LatestRun } from "@mvc/core/LatestRun";
import { UiController } from "@mvc/core/UiController";
import { messageOf } from "@mvc/core/errors";

import type { Z88dkIntent } from "./Z88dkIntents";
import {
  configuredCheckSubject,
  initialState,
  isUnsupportedCandidate,
  onlineAvailable,
  reduce,
  selectedAssetOf,
  selectedReleaseOf,
  type ValidationOrigin,
  type Z88dkEnvironment,
  type Z88dkEvent,
  type Z88dkState
} from "./Z88dkModel";
import {
  DOWNLOAD_POLL_MS,
  Z88DK_DOWNLOAD_FOLDER_SETTINGS_KEY,
  Z88DK_FOLDER_SETTINGS_KEY,
  type Z88dkPorts
} from "./Z88dkPorts";
import {
  discardConfirmRequest,
  selectHasPendingChanges,
  selectViewModel,
  unsupportedConfirmRequest,
  type Z88dkViewModel
} from "./Z88dkViewModel";

/**
 * Orchestrates the Z88DK integration dialog: intents in, port calls out, events into the pure
 * reducer. No React and no DOM, so a test drives the whole dialog against fake ports.
 */
export class Z88dkController extends UiController<Z88dkState, Z88dkIntent, Z88dkEvent, Z88dkViewModel> {
  private readonly validateRun = new LatestRun();
  private readonly releaseRun = new LatestRun();
  private stopPolling: (() => void) | undefined;
  /** The release list is fetched once per dialog session; Refresh asks again (§12, rate limit). */
  private releasesLoaded = false;

  constructor(
    private readonly ports: Z88dkPorts,
    env: Z88dkEnvironment
  ) {
    super(initialState(env), reduce, selectViewModel);
  }

  protected async handle(intent: Z88dkIntent): Promise<void> {
    switch (intent.type) {
      case "opened":
        await Promise.all([this.loadSuggestions(), this.checkConfigured(), this.loadDefaultFolder()]);
        return;

      case "environmentChanged": {
        const before = configuredCheckSubject(this.state.env);
        this.emit({ type: "envReplaced", env: intent.env });
        if (configuredCheckSubject(this.state.env) !== before) await this.checkConfigured();
        return;
      }

      case "setupModeSelected":
        this.emit({ type: "setupModeChanged", mode: intent.mode });
        if (intent.mode === "online" && !this.releasesLoaded) await this.loadReleases(false);
        return;

      case "scopeSelected":
        this.emit({ type: "scopeChanged", scope: intent.scope });
        return;

      case "chooseFolderRequested": {
        const folder = await this.ports.files.pickFolder(Z88DK_FOLDER_SETTINGS_KEY);
        if (folder) await this.probeAndValidate(folder);
        return;
      }

      case "suggestionPicked": {
        const suggestion = this.state.pathSuggestions.find((s) => s.root === intent.root);
        if (!suggestion) return;
        this.emit({ type: "suggestionPicked", suggestion });
        await this.validate(suggestion.root, "candidate");
        return;
      }

      case "showOlderToggled":
        this.emit({ type: "showOlderChanged", value: intent.value });
        return;

      case "releaseSelected":
        this.emit({ type: "releaseSelected", tagName: intent.tagName });
        return;

      case "assetSelected":
        this.emit({ type: "assetSelected", name: intent.name });
        return;

      case "refreshReleasesRequested":
        await this.loadReleases(true);
        return;

      case "selectDownloadFolderRequested": {
        const folder = await this.ports.files.pickFolder(Z88DK_DOWNLOAD_FOLDER_SETTINGS_KEY);
        if (folder) this.emit({ type: "downloadFolderChanged", folder });
        return;
      }

      case "downloadRequested":
        await this.download();
        return;

      case "cancelDownloadRequested":
        if (this.state.busy !== "download") return;
        try {
          await this.ports.service.cancelDownload();
        } catch {
          // --- The download settles either way; a failed cancel leaves it running to its end
        }
        return;

      case "testAgainRequested":
        await this.validate(this.state.candidate?.root, "candidate");
        return;

      case "applyRequested":
        await this.apply();
        return;

      case "closeRequested":
        await this.requestClose();
        return;
    }
  }

  // ─── Opening ───────────────────────────────────────────────────────────────

  private async loadSuggestions(): Promise<void> {
    try {
      this.emit({ type: "suggestionsLoaded", suggestions: await this.ports.service.getPathSuggestions() });
    } catch {
      // --- Detected installs are a convenience; failing to list them is not worth reporting
      this.emit({ type: "suggestionsLoaded", suggestions: [] });
    }
  }

  private async loadDefaultFolder(): Promise<void> {
    try {
      const folder = await this.ports.service.getDefaultDownloadFolder();
      if (folder) this.emit({ type: "defaultDownloadFolderLoaded", folder });
    } catch {
      // --- The user can still pick a folder
    }
  }

  /** The folder may have moved since setup: re-run the smoke test on every opening (§4.3). */
  private async checkConfigured(): Promise<void> {
    const root = configuredCheckSubject(this.state.env);
    if (!root) {
      this.emit({ type: "configuredCheckSkipped" });
      return;
    }
    await this.validate(root, "configuredCheck");
  }

  // ─── Local installation ────────────────────────────────────────────────────

  private async probeAndValidate(folder: string): Promise<void> {
    this.emit({ type: "probeStarted" });
    let probed;
    try {
      probed = await this.ports.service.probePath(folder);
    } catch (error) {
      this.emit({ type: "operationFailed", message: messageOf(error) });
      return;
    }
    this.emit({ type: "probeSettled", result: probed });
    if (probed.ok) await this.validate(probed.root, "candidate");
  }

  private async validate(root: string | undefined, origin: ValidationOrigin): Promise<void> {
    if (!root) return;
    const run = this.validateRun.begin();
    this.emit({ type: "validationStarted", origin });
    try {
      const result = await this.ports.service.validateInstall(root);
      if (!run.isCurrent()) return;
      this.emit({ type: "validationSettled", origin, requestedRoot: root, result });
    } catch (error) {
      if (!run.isCurrent()) return;
      if (origin === "configuredCheck") {
        this.emit({ type: "validationSettled", origin, requestedRoot: root, result: { ok: false, error: messageOf(error) } });
      } else {
        this.emit({ type: "operationFailed", message: messageOf(error) });
      }
    }
  }

  // ─── Online release ────────────────────────────────────────────────────────

  private async loadReleases(refresh: boolean): Promise<void> {
    // --- No binaries are published for Linux: nothing to ask GitHub for
    if (!onlineAvailable(this.state.env)) return;
    const run = this.releaseRun.begin();
    this.emit({ type: "releaseListStarted" });
    try {
      const result = await this.ports.service.listReleases({ refresh });
      if (!run.isCurrent()) return;
      this.releasesLoaded = true;
      this.emit({ type: "releaseListSettled", result });
    } catch (error) {
      if (!run.isCurrent()) return;
      this.emit({ type: "releaseListFailed", error: messageOf(error) });
    }
  }

  private async download(): Promise<void> {
    const release = selectedReleaseOf(this.state);
    const asset = selectedAssetOf(this.state);
    const destinationFolder = this.state.downloadFolder;
    if (!release || !asset || !destinationFolder || this.state.busy) return;

    this.emit({ type: "downloadStarted" });
    this.startPolling();
    let result;
    try {
      result = await this.ports.service.downloadRelease({ releaseTag: release.tagName, asset, destinationFolder });
    } catch (error) {
      this.stopPollingNow();
      this.emit({ type: "operationFailed", message: messageOf(error) });
      return;
    }
    this.stopPollingNow();
    this.emit({ type: "downloadSettled", result });
    if (result.ok) await this.loadSuggestions();
  }

  private startPolling(): void {
    this.stopPollingNow();
    this.stopPolling = this.ports.ticker.start(DOWNLOAD_POLL_MS, () => {
      void this.ports.service
        .getDownloadProgress()
        .then((progress) => {
          if (!this.isDisposed && this.stopPolling) this.emit({ type: "downloadProgressed", progress });
        })
        .catch(() => undefined);
    });
  }

  private stopPollingNow(): void {
    this.stopPolling?.();
    this.stopPolling = undefined;
  }

  // ─── Applying and closing ──────────────────────────────────────────────────

  private async apply(): Promise<void> {
    const { validation, candidate, scope } = this.state;
    if (!validation?.ok || !candidate?.root || this.state.busy) return;

    this.emit({ type: "applyStarted" });
    // --- C3: an unsupported version is accepted, but only after the user says so
    if (isUnsupportedCandidate(this.state) && !(await this.ports.confirm.confirm(unsupportedConfirmRequest(this.state)))) {
      this.emit({ type: "applyDeclined" });
      return;
    }
    try {
      await this.ports.service.apply({ scope, root: candidate.root, version: validation.version });
      this.emit({ type: "applySettled", ok: true });
      this.ports.close.close("close");
    } catch (error) {
      this.emit({ type: "applySettled", ok: false, error: messageOf(error) });
    }
  }

  private async requestClose(): Promise<void> {
    // --- Closing mid-download stops it: nothing half-installed is left behind
    if (this.state.busy === "download") {
      try {
        await this.ports.service.cancelDownload();
      } catch {
        // --- Closing proceeds regardless
      }
    }
    if (!selectHasPendingChanges(this.state)) {
      this.ports.close.close("close");
      return;
    }
    if (await this.ports.confirm.confirm(discardConfirmRequest(this.state))) {
      this.ports.close.close("close");
    }
  }

  dispose(): void {
    this.validateRun.cancelAll();
    this.releaseRun.cancelAll();
    this.stopPollingNow();
    super.dispose();
  }
}
