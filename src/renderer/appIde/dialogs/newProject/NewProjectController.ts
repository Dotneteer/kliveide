import { t } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";
import { LatestRun } from "@mvc/core/LatestRun";
import { UiController } from "@mvc/core/UiController";
import { messageOf } from "@mvc/core/errors";

import type { NewProjectIntent } from "./NewProjectIntents";
import {
  NEW_PROJECT_FOLDER_SETTINGS_KEY,
  MACHINE_TYPES,
  PROJECT_CREATION_TIMEOUT_MS,
  defaultModelOf,
  initialState,
  isComplete,
  reduce,
  requestOf,
  withTimeout,
  type NewProjectContext,
  type NewProjectEnvironment,
  type NewProjectEvent,
  type NewProjectState
} from "./NewProjectModel";
import type { NewProjectPorts } from "./NewProjectPorts";
import { selectViewModel, type NewProjectViewModel } from "./NewProjectViewModel";

export type NewProjectControllerOptions = {
  // --- Overridable so a test can drive the timeout path without waiting the
  // --- real thirty seconds for each of the four steps.
  timeoutMs?: number;
  // --- The running machine and the favourite models, for the opening machine
  // --- and the default model of a type.
  context?: NewProjectContext;
};

/**
 * Orchestrates the New Project dialog.
 *
 * Creating a project is four main-process round trips that each have to succeed
 * before the next is worth attempting, any of which can wedge. That sequence —
 * and what the dialog does when a step half-fails — is the whole reason this
 * dialog is worth an MVC split.
 */
export class NewProjectController extends UiController<
  NewProjectState,
  NewProjectIntent,
  NewProjectEvent,
  NewProjectViewModel
> {
  // --- Separate generations: switching machines twice quickly must not let the
  // --- first machine's templates land on the second machine's dropdown.
  private readonly templatesRun = new LatestRun();
  private readonly createRun = new LatestRun();
  private readonly timeoutMs: number;

  constructor(
    private readonly ports: NewProjectPorts,
    env: NewProjectEnvironment,
    options: NewProjectControllerOptions = {}
  ) {
    super(initialState(env, options.context), reduce, selectViewModel);
    this.timeoutMs = options.timeoutMs ?? PROJECT_CREATION_TIMEOUT_MS;
  }

  protected async handle(intent: NewProjectIntent): Promise<void> {
    switch (intent.type) {
      case "opened":
        await Promise.all([this.loadAvailableMachineTypes(), this.loadTemplates()]);
        return;

      case "environmentChanged":
        this.emit({ type: "envReplaced", env: intent.env });
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
        this.emit({ type: "templateChanged", templateId: intent.templateId });
        return;

      case "projectFolderEdited":
        this.emit({ type: "projectFolderChanged", folder: intent.folder });
        return;

      case "projectNameEdited":
        this.emit({ type: "projectNameChanged", name: intent.name });
        return;

      case "selectFolderRequested": {
        const folder = await this.ports.files.pickFolder(NEW_PROJECT_FOLDER_SETTINGS_KEY);
        if (folder) this.emit({ type: "projectFolderChanged", folder });
        return;
      }

      case "createRequested":
        await this.create();
        return;

      case "cancelRequested":
        this.ports.close.cancelled();
        return;
    }
  }

  /**
   * Asks for every machine type's templates, so the types without any (nothing can be created for
   * them) drop out of the list. A type whose lookup fails stays: the list is not the place to report
   * a broken install. If the dialog opened over a type without templates, the reducer moves to the
   * first one that has some, and that one's templates are loaded.
   */
  private async loadAvailableMachineTypes(): Promise<void> {
    const results = await Promise.all(
      MACHINE_TYPES.map(async (t) => {
        try {
          const templates = await this.ports.service.getTemplateDirectories(t.machineId);
          return (templates ?? []).length > 0;
        } catch {
          return true;
        }
      })
    );
    const before = this.state.machineId;
    this.emit({
      type: "machineTypesSettled",
      available: MACHINE_TYPES.filter((_, i) => results[i]).map((t) => t.machineId)
    });
    if (this.state.machineId !== before) await this.loadTemplates();
  }

  private async loadTemplates(): Promise<void> {
    const machineId = this.state.machineId;
    // --- No machine, no templates to ask about.
    if (!machineId) return;

    const token = this.templatesRun.begin();
    this.emit({ type: "templatesStarted" });
    try {
      const templates = await this.ports.service.getTemplateDirectories(machineId);
      if (!token.isCurrent()) return;
      this.emit({ type: "templatesSettled", templates: templates ?? [] });
    } catch {
      if (!token.isCurrent()) return;
      // --- Quietly: a machine whose templates cannot be read is a broken
      // --- install, not something the user did, and Create will fail loudly
      // --- enough on its own.
      this.emit({ type: "templatesFailed" });
    }
  }

  /**
   * Creates the project, opens it, and waits for the IDE to catch up.
   *
   * Every step is bounded, and every one of them is a place the sequence can
   * stop: the dialog stays open on any failure so the user still has what they
   * typed.
   */
  private async create(): Promise<void> {
    const state = this.state;
    // --- The footer disables Create, but Enter in a text field submits anyway.
    if (state.busy || !isComplete(state)) return;

    const request = requestOf(state);
    const token = this.createRun.begin();
    this.emit({ type: "createStarted" });

    try {
      const path = await this.step(
        this.ports.service.createProject(request),
        "dialog.newProject.timeout.create"
      );
      if (!token.isCurrent()) return;

      const errorMessage = await this.step(
        this.ports.service.openFolder(path),
        "dialog.newProject.timeout.open"
      );
      if (!token.isCurrent()) return;
      // --- The main process reports this failure as a value, not a rejection.
      if (errorMessage) {
        throw new Error(t("dialog.newProject.error.openFolder", { error: errorMessage }));
      }

      await this.step(
        this.ports.service.ensureProjectLoaded(),
        "dialog.newProject.timeout.loadProject"
      );
      if (!token.isCurrent()) return;

      await this.step(
        this.ports.service.ensureWorkspaceLoaded(),
        "dialog.newProject.timeout.loadWorkspace"
      );
      if (!token.isCurrent()) return;

      // --- Deliberately unbounded: the build roots are forwarded from the main
      // --- process asynchronously and this call already waits with its own
      // --- bounded retry. Without it the explorer never reveals the build root
      // --- — seen on Windows, where the forwarded action lags the IPC reply.
      const buildRoots = await this.ports.service.loadBuildRoots();
      if (!token.isCurrent()) return;
      if (buildRoots.length > 0) this.ports.service.navigateTo(buildRoots[0]);

      await this.ports.close.created(request);
    } catch (error) {
      if (!token.isCurrent()) return;
      await this.report(error);
    } finally {
      this.emit({ type: "createSettled" });
    }
  }

  // --- Each step names its own whole timeout sentence, formatted when the step starts.
  private step<T>(work: Promise<T>, timeoutKey: MessageKey): Promise<T> {
    return withTimeout(work, this.timeoutMs, t(timeoutKey, { seconds: this.timeoutMs / 1000 }));
  }

  private async report(error: unknown): Promise<void> {
    console.error("New Klive project creation failed", error);
    try {
      await this.ports.service.notify("error", t("dialog.newProject.error.title"), messageOf(error));
    } catch (messageBoxError) {
      // --- A message box that cannot be shown must not replace the failure it
      // --- was trying to report.
      console.error("Displaying the new project error failed", messageBoxError);
    }
  }

  dispose(): void {
    this.templatesRun.cancelAll();
    this.createRun.cancelAll();
    super.dispose();
  }
}
