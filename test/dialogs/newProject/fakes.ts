import { vi, type Mock } from "vitest";

import { NewProjectController } from "@renderer/appIde/dialogs/newProject/NewProjectController";
import type { NewProjectIntent } from "@renderer/appIde/dialogs/newProject/NewProjectIntents";
import {
  initialState,
  type NewProjectEnvironment,
  type NewProjectEvent,
  type NewProjectState
} from "@renderer/appIde/dialogs/newProject/NewProjectModel";
import type {
  NewProjectPorts,
  NewProjectServicePort
} from "@renderer/appIde/dialogs/newProject/NewProjectPorts";
import {
  selectViewModel,
  type NewProjectViewModel
} from "@renderer/appIde/dialogs/newProject/NewProjectViewModel";
import type { IValidationService } from "@renderer/core/ValidationService";

import { harnessFor, type ControllerHarness } from "../../mvc/ControllerHarness";
import { deepMerge, type DeepPartial } from "../../mvc/fixtures";

export { deepMerge };
export type { DeepPartial };

/**
 * Fixture builders for the New Project dialog tests.
 */

// ─── Environment ─────────────────────────────────────────────────────────────

// --- Rules that accept everything: the real ValidationService has its own
// --- suite, so a dialog test only says when it wants a rejection.
export const PERMISSIVE_VALIDATION: IValidationService = {
  isValidFilename: () => true,
  isValidPath: () => true
};

export function rejectingValidation(over: Partial<IValidationService> = {}): IValidationService {
  return { ...PERMISSIVE_VALIDATION, ...over };
}

export const anEnv = (over?: Partial<NewProjectEnvironment>): NewProjectEnvironment => ({
  validation: PERMISSIVE_VALIDATION,
  ...over
});

// ─── State ───────────────────────────────────────────────────────────────────

export const aState = (
  over?: DeepPartial<NewProjectState>,
  env: NewProjectEnvironment = anEnv()
): NewProjectState => deepMerge(initialState(env), over);

// --- A form that would pass validation, for tests about what happens next.
export const aCompleteState = (over?: DeepPartial<NewProjectState>): NewProjectState =>
  aState({ projectName: "MyProject", ...(over ?? {}) });

export const aViewModel = (
  over?: DeepPartial<NewProjectViewModel>,
  state: NewProjectState = aState()
): NewProjectViewModel => deepMerge(selectViewModel(state), over);

// ─── Ports ───────────────────────────────────────────────────────────────────

export type NewProjectFakePorts = {
  files: { pickFile: Mock; pickFolder: Mock };
  close: { created: Mock; cancelled: Mock };
  service: Record<keyof NewProjectServicePort, Mock>;
};

export type NewProjectHarnessOptions = {
  env?: Partial<NewProjectEnvironment>;
  service?: Partial<NewProjectServicePort>;
  pickFolder?: string;
  // --- Short by default so a timeout test does not wait thirty seconds.
  timeoutMs?: number;
};

export function fakeNewProjectPorts(
  over: NewProjectHarnessOptions = {}
): NewProjectFakePorts {
  const service = over.service ?? {};
  return {
    files: {
      pickFile: vi.fn(async () => undefined),
      pickFolder: vi.fn(async () => over.pickFolder)
    },
    close: { created: vi.fn(async () => undefined), cancelled: vi.fn() },
    // --- Defaults describe a healthy system: two templates, a project that is
    // --- created and opens cleanly, and one build root to navigate to.
    service: {
      getTemplateDirectories: vi.fn(
        service.getTemplateDirectories ?? (async () => ["default", "advanced"])
      ),
      createProject: vi.fn(service.createProject ?? (async () => "/projects/MyProject")),
      openFolder: vi.fn(service.openFolder ?? (async () => undefined)),
      ensureProjectLoaded: vi.fn(service.ensureProjectLoaded ?? (async () => undefined)),
      ensureWorkspaceLoaded: vi.fn(service.ensureWorkspaceLoaded ?? (async () => undefined)),
      loadBuildRoots: vi.fn(service.loadBuildRoots ?? (async () => ["code/main.kz80.asm"])),
      navigateTo: vi.fn(service.navigateTo ?? (() => undefined)),
      notify: vi.fn(service.notify ?? (async () => undefined))
    }
  };
}

export type NewProjectHarness = ControllerHarness<
  NewProjectState,
  NewProjectIntent,
  NewProjectEvent,
  NewProjectViewModel
> & {
  ports: NewProjectFakePorts;
  env: NewProjectEnvironment;
};

/**
 * Builds a controller over fake ports without opening it. Use this when the
 * opening sequence itself is what the test is about.
 */
export function createNewProjectDialog(
  over: NewProjectHarnessOptions = {}
): NewProjectHarness {
  const ports = fakeNewProjectPorts(over);
  const env = anEnv(over.env);
  const controller = new NewProjectController(ports as unknown as NewProjectPorts, env, {
    timeoutMs: over.timeoutMs
  });
  // --- Never spread the harness: `state`, `vm` and `events` are live getters.
  return harnessFor(controller, { ports, env });
}

/**
 * Builds a controller and runs the opening sequence — where every test about
 * later interactions should start, because that is what the user sees.
 */
export async function openNewProjectDialog(
  over: NewProjectHarnessOptions = {}
): Promise<NewProjectHarness> {
  const harness = createNewProjectDialog(over);
  await harness.dispatch({ type: "opened" });
  return harness;
}

// --- The one field the form actually requires.
export async function fillForm(
  harness: NewProjectHarness,
  over: { name?: string; folder?: string } = {}
): Promise<void> {
  await harness.dispatch({ type: "projectNameEdited", name: over.name ?? "MyProject" });
  if (over.folder !== undefined) {
    await harness.dispatch({ type: "projectFolderEdited", folder: over.folder });
  }
}
