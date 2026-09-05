import { LatestRun } from "@mvc/core/LatestRun";
import { UiController } from "@mvc/core/UiController";
import { messageOf } from "@mvc/core/errors";

import type { NewProjectIntent } from "./NewProjectIntents";
import {
  CREATE_ERROR_TITLE,
  NEW_PROJECT_FOLDER_SETTINGS_KEY,
  PROJECT_CREATION_TIMEOUT_MS,
  initialState,
  isComplete,
  openFolderErrorMessage,
  parseMachineOption,
  reduce,
  requestOf,
  withTimeout,
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
    super(initialState(env), reduce, selectViewModel);
    this.timeoutMs = options.timeoutMs ?? PROJECT_CREATION_TIMEOUT_MS;
  }

  protected async handle(intent: NewProjectIntent): Promise<void> {
    switch (intent.type) {
      case "opened":
        await this.loadTemplates();
        return;

      case "environmentChanged":
        this.emit({ type: "envReplaced", env: intent.env });
        return;

      case "machineSelected": {
        const { machineId, modelId } = parseMachineOption(intent.value);
        this.emit({ type: "machineChanged", machineId, modelId });
        await this.loadTemplates();
        return;
      }

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
        "Creating the Klive project"
      );
      if (!token.isCurrent()) return;

      const errorMessage = await this.step(
        this.ports.service.openFolder(path),
        "Opening the new Klive project"
      );
      if (!token.isCurrent()) return;
      // --- The main process reports this failure as a value, not a rejection.
      if (errorMessage) throw new Error(openFolderErrorMessage(errorMessage));

      await this.step(
        this.ports.service.ensureProjectLoaded(),
        "Loading the new Klive project"
      );
      if (!token.isCurrent()) return;

      await this.step(
        this.ports.service.ensureWorkspaceLoaded(),
        "Loading the new Klive workspace"
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

  private step<T>(work: Promise<T>, operation: string): Promise<T> {
    return withTimeout(work, this.timeoutMs, operation);
  }

  private async report(error: unknown): Promise<void> {
    console.error("New Klive project creation failed", error);
    try {
      await this.ports.service.notify("error", CREATE_ERROR_TITLE, messageOf(error));
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
