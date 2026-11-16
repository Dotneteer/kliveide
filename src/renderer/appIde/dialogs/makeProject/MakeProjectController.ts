import { t } from "@common/i18n/i18n";
import { LatestRun } from "@mvc/core/LatestRun";
import { UiController } from "@mvc/core/UiController";
import { messageOf } from "@mvc/core/errors";

import { defaultModelOf, withTimeout, type NewProjectContext } from "../newProject/NewProjectModel";
import type { MakeProjectIntent } from "./MakeProjectIntents";
import { MACHINE_TYPES } from "../newProject/NewProjectModel";
import {
  MAKE_PROJECT_TIMEOUT_MS,
  NO_TEMPLATE,
  initialState,
  isReady,
  reduce,
  requestOf,
  type MakeProjectEvent,
  type MakeProjectState
} from "./MakeProjectModel";
import type { MakeProjectPorts } from "./MakeProjectPorts";
import { selectViewModel, type MakeProjectViewModel } from "./MakeProjectViewModel";

export type MakeProjectControllerOptions = {
  folder: string;
  /** Opened by the offer after Open Folder */
  offer?: boolean;
  context?: NewProjectContext;
  /** Overridable so a test can drive the timeout path quickly */
  timeoutMs?: number;
};

/**
 * Orchestrates the Make Klive Project dialog (`dev/plans/PLAIN_FOLDER_TO_PROJECT_PLAN.md` §3.3).
 *
 * Three lists arrive asynchronously and depend on each other (the template preselection needs the
 * folder's files, the conflicts need the template), and converting is a sequence of main-process
 * round trips (convert, reopen, wait for the tree and the workspace), any of which can fail.
 */
export class MakeProjectController extends UiController<
  MakeProjectState,
  MakeProjectIntent,
  MakeProjectEvent,
  MakeProjectViewModel
> {
  // --- Separate generations: a quick second machine or template must not get the first one's list
  private readonly templatesRun = new LatestRun();
  private readonly conflictsRun = new LatestRun();
  private readonly submitRun = new LatestRun();
  private readonly timeoutMs: number;

  constructor(
    private readonly ports: MakeProjectPorts,
    options: MakeProjectControllerOptions
  ) {
    super(initialState(options.folder, !!options.offer, options.context), reduce, selectViewModel);
    this.timeoutMs = options.timeoutMs ?? MAKE_PROJECT_TIMEOUT_MS;
  }

  protected async handle(intent: MakeProjectIntent): Promise<void> {
    switch (intent.type) {
      case "opened":
        await Promise.all([
          this.loadCandidates(),
          this.loadTemplates(),
          this.loadAvailableMachineTypes()
        ]);
        return;

      case "choiceSelected":
        this.emit({ type: "choiceChanged", choice: intent.choice });
        return;

      case "machineTypeSelected": {
        if (intent.machineId === this.state.machineId) return;
        const modelId = defaultModelOf(intent.machineId, this.state.context);
        this.emit({ type: "machineChanged", machineId: intent.machineId, modelId });
        await this.loadTemplates();
        return;
      }

      case "modelSelected":
        this.emit({
          type: "machineChanged",
          machineId: this.state.machineId,
          modelId: intent.modelId || undefined
        });
        return;

      case "templateSelected":
        await this.changingTemplate(() =>
          this.emit({ type: "templateChanged", templateId: intent.templateId })
        );
        return;

      case "buildRootSelected":
        this.emit({ type: "buildRootChanged", buildRoot: intent.buildRoot });
        return;

      case "overwriteToggled":
        this.emit({ type: "overwriteChanged", path: intent.path, overwrite: intent.overwrite });
        return;

      case "submitRequested":
        await this.submit();
        return;

      case "cancelRequested":
        this.ports.close.cancelled();
        return;
    }
  }

  /** Runs a state change and reloads the conflicts when it moved the template */
  private async changingTemplate(change: () => void): Promise<void> {
    const before = this.state.templateId;
    change();
    if (this.state.templateId !== before) await this.loadConflicts();
  }

  /**
   * Asks for every machine type's templates, so the types without any drop out of the list: a
   * folder becomes a project only with a template (Q7). A type whose lookup fails stays. If the
   * dialog opened over a type without templates, the reducer moves to the first one that has some,
   * and that one's templates are loaded. The same rule as New Project's.
   */
  private async loadAvailableMachineTypes(): Promise<void> {
    const results = await Promise.all(
      MACHINE_TYPES.map(async (type) => {
        try {
          return ((await this.ports.service.getTemplateDirectories(type.machineId)) ?? []).length > 0;
        } catch {
          return true;
        }
      })
    );
    const before = this.state.machineId;
    this.emit({
      type: "machineTypesSettled",
      available: MACHINE_TYPES.filter((_, i) => results[i]).map((type) => type.machineId)
    });
    if (this.state.machineId !== before) await this.loadTemplates();
  }

  private async loadCandidates(): Promise<void> {
    let candidates: string[] = [];
    try {
      candidates = await this.ports.service.getBuildRootCandidates(this.state.folder);
    } catch (error) {
      // --- No list is not fatal: the folder can become a project without a build root
      console.error("Reading the folder's build-root candidates failed", error);
    }
    await this.changingTemplate(() => this.emit({ type: "candidatesSettled", candidates }));
  }

  private async loadTemplates(): Promise<void> {
    const machineId = this.state.machineId;
    const token = this.templatesRun.begin();
    this.emit({ type: "templatesStarted" });
    let templates: string[] | undefined;
    try {
      templates = (await this.ports.service.getTemplateDirectories(machineId)) ?? [];
    } catch {
      templates = undefined;
    }
    if (!token.isCurrent()) return;
    this.emit(templates ? { type: "templatesSettled", templates } : { type: "templatesFailed" });
    // --- Always: the same template name on another machine may write other files
    await this.loadConflicts();
  }

  private async loadConflicts(): Promise<void> {
    const { folder, machineId, templateId } = this.state;
    const token = this.conflictsRun.begin();
    if (templateId === NO_TEMPLATE) {
      this.emit({ type: "conflictsSettled", conflicts: [] });
      return;
    }
    this.emit({ type: "conflictsStarted" });
    try {
      const conflicts = await this.ports.service.getConflicts(folder, machineId, templateId);
      if (!token.isCurrent()) return;
      this.emit({ type: "conflictsSettled", conflicts: conflicts ?? [] });
    } catch (error) {
      if (!token.isCurrent()) return;
      console.error("Checking the template's files failed", error);
      this.emit({ type: "conflictsFailed" });
    }
  }

  /**
   * Keeps the folder (remembered, so the offer is not repeated), or converts it, reopens it as a
   * project and waits for the IDE to catch up. The dialog stays open on any failure.
   */
  private async submit(): Promise<void> {
    const state = this.state;
    // --- The footer disables OK, but Enter submits anyway
    if (!isReady(state)) return;

    const token = this.submitRun.begin();
    this.emit({ type: "submitStarted" });
    try {
      if (state.choice === "keep") {
        await this.step(this.ports.service.rememberPlainFolder(state.folder));
        if (!token.isCurrent()) return;
        await this.ports.close.done({ choice: "keep", folder: state.folder });
        return;
      }

      const result = await this.step(this.ports.service.convert(requestOf(state)));
      if (!token.isCurrent()) return;
      if (result?.errorMessage) throw new Error(result.errorMessage);

      // --- Reopened so every part of loading a project runs (machine, build file, watchers)
      const openError = await this.step(this.ports.service.openFolder(state.folder));
      if (!token.isCurrent()) return;
      if (openError) {
        throw new Error(t("dialog.makeProject.error.reopen", { error: openError }));
      }
      await this.step(this.ports.service.ensureProjectLoaded(state.folder));
      if (!token.isCurrent()) return;
      await this.step(this.ports.service.ensureWorkspaceLoaded(state.folder));
      if (!token.isCurrent()) return;

      // --- Unbounded on purpose, as in New Project: it has its own bounded wait
      const buildRoots = await this.ports.service.loadBuildRoots();
      if (!token.isCurrent()) return;
      if (buildRoots.length > 0) this.ports.service.navigateTo(buildRoots[0]);

      await this.ports.close.done({ choice: "make", folder: state.folder });
    } catch (error) {
      if (!token.isCurrent()) return;
      await this.report(error);
    } finally {
      this.emit({ type: "submitSettled" });
    }
  }

  private step<T>(work: Promise<T>): Promise<T> {
    return withTimeout(
      work,
      this.timeoutMs,
      t("dialog.makeProject.error.timeout", { seconds: this.timeoutMs / 1000 })
    );
  }

  private async report(error: unknown): Promise<void> {
    console.error("Making the folder a Klive project failed", error);
    try {
      await this.ports.service.notify("error", t("dialog.makeProject.error.title"), messageOf(error));
    } catch (messageBoxError) {
      console.error("Displaying the Make Klive Project error failed", messageBoxError);
    }
  }

  dispose(): void {
    this.templatesRun.cancelAll();
    this.conflictsRun.cancelAll();
    this.submitRun.cancelAll();
    super.dispose();
  }
}
