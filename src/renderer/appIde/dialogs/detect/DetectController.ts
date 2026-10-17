import { t } from "@common/i18n/i18n";
import { LatestRun } from "@mvc/core/LatestRun";
import { UiController } from "@mvc/core/UiController";
import { messageOf } from "@mvc/core/errors";

import type { DetectIntent } from "./DetectIntents";
import { initialState, reduce, requestOf, type DetectEnvironment, type DetectEvent, type DetectState } from "./DetectModel";
import { KCOV_FILTERS, type DetectPorts } from "./DetectPorts";
import { selectViewModel, type DetectViewModel } from "./DetectViewModel";

/**
 * Orchestrates the Detect dialog: it reads the profile, classifies several banks and publishes —
 * the async work that makes this an MVC dialog (`.ai/ui-mvc-guide.md`).
 */
export class DetectController extends UiController<DetectState, DetectIntent, DetectEvent, DetectViewModel> {
  private readonly detectRun = new LatestRun();

  constructor(
    private readonly ports: DetectPorts,
    env: DetectEnvironment
  ) {
    super(initialState(env), reduce, selectViewModel);
  }

  protected async handle(intent: DetectIntent): Promise<void> {
    switch (intent.type) {
      case "opened":
        if (!this.state.env.unavailable) await this.detect();
        return;
      case "environmentChanged":
        this.emit({ type: "envReplaced", env: intent.env });
        return;
      case "optionsChanged":
        this.emit({ type: "optionsChanged", patch: intent.patch });
        return;
      case "detectRequested":
        await this.detect();
        return;
      case "includeToggled":
        this.emit({ type: "includeToggled", index: intent.index });
        return;
      case "detailsToggled":
        this.emit({ type: "expandToggled", index: intent.index });
        return;
      case "goToRequested": {
        const row = this.state.rows[intent.index];
        if (row) this.ports.navigate.goTo(row.target, intent.offset);
        return;
      }
      case "applyRequested":
        await this.apply();
        return;
      case "undoRequested":
        await this.undo();
        return;
      case "coverageOnRequested":
        await this.coverage(() => this.ports.coverage.turnOn());
        return;
      case "loadKcovRequested": {
        const path = await this.ports.files.pickFile(KCOV_FILTERS, "kcovLoad");
        if (path) await this.coverage(() => this.ports.coverage.load(path));
        return;
      }
      case "closeRequested":
        this.ports.close.close("close");
        return;
    }
  }

  private async detect(): Promise<void> {
    const run = this.detectRun.begin();
    this.emit({ type: "busyStarted", busy: "detect" });
    try {
      const result = await this.ports.detection.run(requestOf(this.state.options));
      if (!run.isCurrent()) return;
      this.emit({ type: "detectionSettled", run: result });
    } catch (error) {
      if (!run.isCurrent()) return;
      this.emit({ type: "failed", message: messageOf(error) });
    }
  }

  private async apply(): Promise<void> {
    const targets = this.state.rows.filter((row) => row.include && row.target.proposal.changes.length > 0).map((row) => row.target);
    if (targets.length === 0) return;
    const userChanges = targets.reduce((n, t) => n + t.proposal.changes.filter((c) => c.user).length, 0);
    if (userChanges > 0) {
      const ok = await this.ports.confirm.confirm({
        title: t("dialog.detect.replace.title"),
        lines: [t("dialog.detect.replace.overwrites", { count: userChanges }), t("dialog.detect.replace.undoHint")],
        confirmLabel: t("dialog.detect.replace.confirm"),
        cancelLabel: t("common.button.cancel"),
        danger: true
      });
      if (!ok) return;
    }
    this.emit({ type: "busyStarted", busy: "apply" });
    try {
      const { written, problems } = await this.ports.detection.apply(targets);
      if (written.length === 0) {
        this.emit({ type: "failed", message: problems.join(" ") || t("dialog.detect.apply.nothingWritten") });
        return;
      }
      const names = written.map((path) => path.split(/[\\/]/).pop()).join(", ");
      // --- Worded when it is set: the problems come from elsewhere and pass through as they are
      this.emit({
        type: "applied",
        message: problems.length
          ? t("dialog.detect.apply.writtenWithProblems", { files: names, problems: problems.join(" ") })
          : t("dialog.detect.apply.written", { files: names })
      });
    } catch (error) {
      this.emit({ type: "failed", message: messageOf(error) });
    }
  }

  private async undo(): Promise<void> {
    this.emit({ type: "busyStarted", busy: "undo" });
    try {
      const paths = await this.ports.detection.undo();
      this.emit({
        type: "undone",
        message: paths.length ? t("dialog.detect.undo.restored") : t("dialog.detect.undo.nothing")
      });
    } catch (error) {
      this.emit({ type: "failed", message: messageOf(error) });
    }
  }

  private async coverage(action: () => Promise<string>): Promise<void> {
    this.emit({ type: "busyStarted", busy: "coverage" });
    try {
      this.emit({ type: "coverageChanged", message: await action() });
    } catch (error) {
      this.emit({ type: "failed", message: messageOf(error) });
    }
  }

  dispose(): void {
    this.detectRun.cancelAll();
    super.dispose();
  }
}
