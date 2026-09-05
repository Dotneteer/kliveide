import { LatestRun } from "@mvc/core/LatestRun";
import { UiController } from "@mvc/core/UiController";
import { messageOf } from "@mvc/core/errors";

import type { SjasmplusIntent } from "./SjasmplusIntents";
import {
  configuredCheckSubject,
  initialState,
  reduce,
  selectedAssetOf,
  selectedReleaseOf,
  type SjasmplusEnvironment,
  type SjasmplusEvent,
  type SjasmplusState,
  type ValidationOrigin
} from "./SjasmplusModel";
import {
  SJASMPLUS_DOWNLOAD_FOLDER_SETTINGS_KEY,
  SJASMPLUS_EXECUTABLE_FILTERS,
  SJASMPLUS_EXECUTABLE_SETTINGS_KEY,
  type SjasmplusPorts
} from "./SjasmplusPorts";
import {
  discardConfirmRequest,
  selectHasPendingChanges,
  selectViewModel,
  type SjasmplusViewModel
} from "./SjasmplusViewModel";

/**
 * Orchestrates the SJASMPLUS dialog: user intents in, port calls out, events
 * into the pure reducer. It has no React and no DOM, so a test can drive the
 * whole dialog by dispatching intents against fake ports.
 */
export class SjasmplusController extends UiController<
  SjasmplusState,
  SjasmplusIntent,
  SjasmplusEvent,
  SjasmplusViewModel
> {
  // --- Separate generations: a refreshed release list must not invalidate a
  // --- smoke test running beside it.
  private readonly validateRun = new LatestRun();
  private readonly releaseRun = new LatestRun();

  constructor(
    private readonly ports: SjasmplusPorts,
    env: SjasmplusEnvironment
  ) {
    super(initialState(env), reduce, selectViewModel);
  }

  protected async handle(intent: SjasmplusIntent): Promise<void> {
    switch (intent.type) {
      case "opened":
        // --- Both are independent: neither answer changes what the other asks.
        await Promise.all([this.loadSuggestions(), this.checkConfigured()]);
        return;

      case "environmentChanged": {
        const before = configuredCheckSubject(this.state.env);
        this.emit({ type: "envReplaced", env: intent.env });
        // --- Only a different configured executable is worth re-testing; an
        // --- unrelated settings write must not restart the smoke test.
        if (configuredCheckSubject(this.state.env) !== before) {
          await this.checkConfigured();
        }
        return;
      }

      case "setupModeSelected":
        this.emit({ type: "setupModeChanged", mode: intent.mode });
        if (intent.mode === "online") await this.loadReleases();
        return;

      case "scopeSelected":
        this.emit({ type: "scopeChanged", scope: intent.scope });
        return;

      case "selectExecutableRequested": {
        const path = await this.ports.files.pickFile(
          SJASMPLUS_EXECUTABLE_FILTERS,
          SJASMPLUS_EXECUTABLE_SETTINGS_KEY
        );
        if (path) await this.probeAndValidate(path);
        return;
      }

      case "suggestionPicked": {
        const suggestion = this.state.pathSuggestions.find(
          (candidate) => candidate.executablePath === intent.executablePath
        );
        if (!suggestion) return;
        this.emit({ type: "suggestionPicked", suggestion });
        await this.validate(suggestion.executablePath, "candidate");
        return;
      }

      case "prereleasesToggled":
        this.emit({ type: "prereleasesChanged", value: intent.value });
        if (this.state.setupMode === "online") await this.loadReleases();
        return;

      case "releaseSelected":
        this.emit({ type: "releaseSelected", tagName: intent.tagName });
        return;

      case "assetSelected":
        this.emit({ type: "assetSelected", name: intent.name });
        return;

      case "refreshReleasesRequested":
        await this.loadReleases();
        return;

      case "selectDownloadFolderRequested": {
        const folder = await this.ports.files.pickFolder(
          SJASMPLUS_DOWNLOAD_FOLDER_SETTINGS_KEY
        );
        if (folder) this.emit({ type: "downloadFolderChanged", folder });
        return;
      }

      case "downloadRequested":
        await this.download();
        return;

      case "testAgainRequested":
        await this.validate(this.state.candidate?.executablePath, "candidate");
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
      const suggestions = await this.ports.service.getPathSuggestions();
      this.emit({ type: "suggestionsLoaded", suggestions });
    } catch {
      // --- Shortcuts for binaries on PATH are a convenience. Failing to build
      // --- the list is not something to report at the user.
      this.emit({ type: "suggestionsLoaded", suggestions: [] });
    }
  }

  /**
   * The settings survive whatever happens to the disk: the install folder may
   * have been renamed, moved or removed since it was set up. Run the same smoke
   * test "Test again" would, so the dialog only reports a working integration
   * when the executable actually works.
   */
  private async checkConfigured(): Promise<void> {
    const configuredPath = configuredCheckSubject(this.state.env);
    if (!configuredPath) {
      this.emit({ type: "configuredCheckSkipped" });
      return;
    }
    await this.validate(configuredPath, "configuredCheck");
  }

  // ─── Local executable ──────────────────────────────────────────────────────

  private async probeAndValidate(path: string): Promise<void> {
    this.emit({ type: "probeStarted" });
    let probed;
    try {
      probed = await this.ports.service.probePath(path);
    } catch (error) {
      // --- The probe never reached a verdict, so none is recorded.
      this.emit({ type: "operationFailed", message: messageOf(error) });
      return;
    }
    this.emit({ type: "probeSettled", result: probed });
    if (!probed.ok) return;
    await this.validate(probed.executablePath, "candidate");
  }

  private async validate(
    executablePath: string | undefined,
    origin: ValidationOrigin
  ): Promise<void> {
    if (!executablePath) return;

    const run = this.validateRun.begin();
    this.emit({ type: "validationStarted", origin });
    try {
      const result = await this.ports.service.validateExecutable(executablePath);
      if (!run.isCurrent()) return;
      this.emit({ type: "validationSettled", origin, requestedPath: executablePath, result });
    } catch (error) {
      if (!run.isCurrent()) return;
      if (origin === "configuredCheck") {
        // --- An unreachable executable is exactly what a broken integration
        // --- looks like, so the rejection *is* the verdict here.
        this.emit({
          type: "validationSettled",
          origin,
          requestedPath: executablePath,
          result: { ok: false, error: messageOf(error) }
        });
      } else {
        this.emit({ type: "operationFailed", message: messageOf(error) });
      }
    }
  }

  // ─── Online release ────────────────────────────────────────────────────────

  private async loadReleases(): Promise<void> {
    // --- Upstream ships Windows binaries only, so there is nothing to list
    // --- anywhere else and no reason to call GitHub.
    if (!this.state.env.isWindows) return;

    const run = this.releaseRun.begin();
    this.emit({ type: "releaseListStarted" });
    try {
      const result = await this.ports.service.listReleases({
        includePrereleases: this.state.releases.includePrereleases
      });
      if (!run.isCurrent()) return;
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
    if (!release || !asset || !destinationFolder) return;

    this.emit({ type: "downloadStarted" });
    let result;
    try {
      result = await this.ports.service.downloadRelease({
        releaseTag: release.tagName,
        asset,
        destinationFolder
      });
    } catch (error) {
      this.emit({ type: "operationFailed", message: messageOf(error) });
      return;
    }
    this.emit({ type: "downloadSettled", result });
    if (!result.ok) return;
    await this.validate(result.executablePath, "candidate");
  }

  // ─── Applying and closing ──────────────────────────────────────────────────

  private async apply(): Promise<void> {
    const { validation, candidate, scope } = this.state;
    if (!validation?.ok || !candidate?.installFolder || !candidate?.executablePath) return;

    this.emit({ type: "applyStarted" });
    try {
      await this.ports.service.apply({
        scope,
        installFolder: candidate.installFolder,
        executablePath: candidate.executablePath,
        version: validation.version
      });
      this.emit({ type: "applySettled", ok: true });
      this.ports.close.close("close");
    } catch (error) {
      // --- Nothing was saved, so the dialog stays open with the reason on show.
      this.emit({ type: "applySettled", ok: false, error: messageOf(error) });
    }
  }

  // --- Every dismissal route (Close, the X, Escape) funnels through here, so an
  // --- unsaved selection is never dropped silently.
  private async requestClose(): Promise<void> {
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
    super.dispose();
  }
}
