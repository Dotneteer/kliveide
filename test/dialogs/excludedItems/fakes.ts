import { vi, type Mock } from "vitest";

import { ExcludedItemsController } from "@renderer/appIde/dialogs/excludedItems/ExcludedItemsController";
import type { ExcludedItemsIntent } from "@renderer/appIde/dialogs/excludedItems/ExcludedItemsIntents";
import {
  initialState,
  type ExcludedItemInfo,
  type ExcludedItemsEnvironment,
  type ExcludedItemsEvent,
  type ExcludedItemsState
} from "@renderer/appIde/dialogs/excludedItems/ExcludedItemsModel";
import type {
  ExcludedItemsPorts,
  ExcludedItemsServicePort
} from "@renderer/appIde/dialogs/excludedItems/ExcludedItemsPorts";
import {
  selectViewModel,
  type ExcludedItemsViewModel
} from "@renderer/appIde/dialogs/excludedItems/ExcludedItemsViewModel";

import { harnessFor, type ControllerHarness } from "../../mvc/ControllerHarness";
import { deepMerge, type DeepPartial } from "../../mvc/fixtures";

export { deepMerge };
export type { DeepPartial };

/**
 * Fixture builders for the Excluded Items dialog tests.
 */

// --- The list holds a path twice: the id it was stored under, and the same
// --- path in the platform's separators, which is what the row shows.
export const anItem = (id: string): ExcludedItemInfo => ({ id, value: id });

export const anEnv = (
  over?: Partial<ExcludedItemsEnvironment>
): ExcludedItemsEnvironment => ({ projectName: "MyProject", ...over });

export const aState = (
  over?: DeepPartial<ExcludedItemsState>,
  env: ExcludedItemsEnvironment = anEnv(),
  projectItems: ExcludedItemInfo[] = []
): ExcludedItemsState => deepMerge(initialState(env, projectItems), over);

export const aViewModel = (
  over?: DeepPartial<ExcludedItemsViewModel>,
  state: ExcludedItemsState = aState()
): ExcludedItemsViewModel => deepMerge(selectViewModel(state), over);

export type ExcludedItemsFakePorts = {
  close: { applied: Mock; dismissed: Mock };
  service: Record<keyof ExcludedItemsServicePort, Mock>;
};

export type ExcludedItemsHarnessOptions = {
  env?: Partial<ExcludedItemsEnvironment>;
  projectItems?: ExcludedItemInfo[];
  service?: Partial<ExcludedItemsServicePort>;
};

export type ExcludedItemsHarness = ControllerHarness<
  ExcludedItemsState,
  ExcludedItemsIntent,
  ExcludedItemsEvent,
  ExcludedItemsViewModel
> & {
  ports: ExcludedItemsFakePorts;
  env: ExcludedItemsEnvironment;
};

export function createExcludedItemsDialog(
  over: ExcludedItemsHarnessOptions = {}
): ExcludedItemsHarness {
  const service = over.service ?? {};
  const ports: ExcludedItemsFakePorts = {
    close: { applied: vi.fn(), dismissed: vi.fn() },
    service: {
      getGlobalExcludes: vi.fn(
        service.getGlobalExcludes ?? (async () => [anItem("node_modules")])
      ),
      saveExcludedItems: vi.fn(service.saveExcludedItems ?? (async () => undefined))
    }
  };
  const env = anEnv(over.env);
  const controller = new ExcludedItemsController(
    ports as unknown as ExcludedItemsPorts,
    env,
    over.projectItems ?? [anItem("build"), anItem("temp")]
  );
  // --- Never spread the harness: `state`, `vm` and `events` are live getters.
  return harnessFor(controller, { ports, env });
}

export async function openExcludedItemsDialog(
  over: ExcludedItemsHarnessOptions = {}
): Promise<ExcludedItemsHarness> {
  const harness = createExcludedItemsDialog(over);
  await harness.dispatch({ type: "opened" });
  return harness;
}
