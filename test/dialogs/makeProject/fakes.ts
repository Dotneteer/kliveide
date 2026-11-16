import { vi, type Mock } from "vitest";

import { MakeProjectController } from "@renderer/appIde/dialogs/makeProject/MakeProjectController";
import type { MakeProjectIntent } from "@renderer/appIde/dialogs/makeProject/MakeProjectIntents";
import {
  initialState,
  type MakeProjectEvent,
  type MakeProjectState
} from "@renderer/appIde/dialogs/makeProject/MakeProjectModel";
import type {
  MakeProjectPorts,
  MakeProjectServicePort
} from "@renderer/appIde/dialogs/makeProject/MakeProjectPorts";
import {
  selectViewModel,
  type MakeProjectViewModel
} from "@renderer/appIde/dialogs/makeProject/MakeProjectViewModel";
import type { NewProjectContext } from "@renderer/appIde/dialogs/newProject/NewProjectModel";

import { harnessFor, type ControllerHarness } from "../../mvc/ControllerHarness";
import { deepMerge, type DeepPartial } from "../../mvc/fixtures";

export { deepMerge };
export type { DeepPartial };

/**
 * Fixture builders for the Make Klive Project dialog tests
 * (`dev/plans/PLAIN_FOLDER_TO_PROJECT_PLAN.md` §3.3).
 */

export const FOLDER = "/work/boriel-game";

// ─── State ───────────────────────────────────────────────────────────────────

export const aState = (over?: DeepPartial<MakeProjectState>): MakeProjectState =>
  deepMerge(initialState(FOLDER, true, { running: { machineId: "sp48", modelId: "pal" }, favorites: [] }), over);

export const aViewModel = (
  over?: DeepPartial<MakeProjectViewModel>,
  state: MakeProjectState = aState({ candidates: [] })
): MakeProjectViewModel => deepMerge(selectViewModel(state), over);

// ─── Ports ───────────────────────────────────────────────────────────────────

export type MakeProjectFakePorts = {
  close: { done: Mock; cancelled: Mock };
  service: Record<keyof MakeProjectServicePort, Mock>;
};

export type MakeProjectHarnessOptions = {
  service?: Partial<MakeProjectServicePort>;
  offer?: boolean;
  context?: NewProjectContext;
  timeoutMs?: number;
};

export function fakeMakeProjectPorts(over: MakeProjectHarnessOptions = {}): MakeProjectFakePorts {
  const service = over.service ?? {};
  return {
    close: { done: vi.fn(async () => undefined), cancelled: vi.fn() },
    // --- Defaults describe the reporter's case: a Boriel BASIC folder, a machine with a zx-basic
    // --- template, nothing in the template's way, and a conversion that works
    service: {
      getBuildRootCandidates: vi.fn(
        service.getBuildRootCandidates ?? (async () => ["src/lib.bas", "main.bas"])
      ),
      getTemplateDirectories: vi.fn(
        service.getTemplateDirectories ?? (async () => ["default", "zx-basic"])
      ),
      getConflicts: vi.fn(service.getConflicts ?? (async () => [])),
      convert: vi.fn(service.convert ?? (async () => ({ written: ["build.ksx"], skipped: [] }))),
      rememberPlainFolder: vi.fn(service.rememberPlainFolder ?? (async () => undefined)),
      openFolder: vi.fn(service.openFolder ?? (async () => undefined)),
      ensureProjectLoaded: vi.fn(service.ensureProjectLoaded ?? (async () => undefined)),
      ensureWorkspaceLoaded: vi.fn(service.ensureWorkspaceLoaded ?? (async () => undefined)),
      loadBuildRoots: vi.fn(service.loadBuildRoots ?? (async () => ["main.bas"])),
      navigateTo: vi.fn(service.navigateTo ?? (() => undefined)),
      notify: vi.fn(service.notify ?? (async () => undefined))
    }
  };
}

export type MakeProjectHarness = ControllerHarness<
  MakeProjectState,
  MakeProjectIntent,
  MakeProjectEvent,
  MakeProjectViewModel
> & { ports: MakeProjectFakePorts };

export function createMakeProjectDialog(over: MakeProjectHarnessOptions = {}): MakeProjectHarness {
  const ports = fakeMakeProjectPorts(over);
  const controller = new MakeProjectController(ports as unknown as MakeProjectPorts, {
    folder: FOLDER,
    offer: over.offer ?? true,
    context: over.context ?? { running: { machineId: "sp48", modelId: "pal" }, favorites: [] },
    timeoutMs: over.timeoutMs ?? 50
  });
  // --- Never spread the harness: `state`, `vm` and `events` are live getters
  return harnessFor(controller, { ports });
}

export async function openMakeProjectDialog(
  over: MakeProjectHarnessOptions = {}
): Promise<MakeProjectHarness> {
  const harness = createMakeProjectDialog(over);
  await harness.dispatch({ type: "opened" });
  return harness;
}
