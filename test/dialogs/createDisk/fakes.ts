import { vi, type Mock } from "vitest";

import { CreateDiskController } from "@renderer/appEmu/dialogs/createDisk/CreateDiskController";
import type { CreateDiskIntent } from "@renderer/appEmu/dialogs/createDisk/CreateDiskIntents";
import {
  initialState,
  type CreateDiskEnvironment,
  type CreateDiskEvent,
  type CreateDiskState
} from "@renderer/appEmu/dialogs/createDisk/CreateDiskModel";
import type {
  CreateDiskPorts,
  CreateDiskServicePort
} from "@renderer/appEmu/dialogs/createDisk/CreateDiskPorts";
import {
  selectViewModel,
  type CreateDiskViewModel
} from "@renderer/appEmu/dialogs/createDisk/CreateDiskViewModel";
import type { IValidationService } from "@renderer/core/ValidationService";

import { harnessFor, type ControllerHarness } from "../../mvc/ControllerHarness";
import { deepMerge, type DeepPartial } from "../../mvc/fixtures";

export { deepMerge };
export type { DeepPartial };

/**
 * Fixture builders for the Create Disk dialog tests.
 *
 * Every builder deep-merges an override onto a sensible default, so a test
 * names only the field it is actually about.
 */

// ─── Environment ─────────────────────────────────────────────────────────────

/**
 * Validation rules that accept everything.
 *
 * The real `ValidationService` is already covered by its own suite; a dialog
 * test that wants a rejection says so with `rejectingValidation`, which keeps
 * "what the rule is" and "what the dialog does about it" in separate files.
 */
export const PERMISSIVE_VALIDATION: IValidationService = {
  isValidFilename: () => true,
  isValidPath: () => true
};

export function rejectingValidation(
  over: Partial<IValidationService> = {}
): IValidationService {
  return { ...PERMISSIVE_VALIDATION, ...over };
}

export const anEnv = (over?: Partial<CreateDiskEnvironment>): CreateDiskEnvironment => ({
  validation: PERMISSIVE_VALIDATION,
  ...over
});

// ─── State ───────────────────────────────────────────────────────────────────

export const aState = (
  over?: DeepPartial<CreateDiskState>,
  env: CreateDiskEnvironment = anEnv()
): CreateDiskState => deepMerge(initialState(env), over);

// --- A state that would pass validation, for tests about what happens next.
export const aCompleteState = (over?: DeepPartial<CreateDiskState>): CreateDiskState =>
  aState({ folder: "/tmp", filename: "disk.dsk", ...(over ?? {}) });

// --- Derived from a real state, so a field the model gains cannot be missed
// --- here; the override names only what the test is about.
export const aViewModel = (
  over?: DeepPartial<CreateDiskViewModel>,
  state: CreateDiskState = aState()
): CreateDiskViewModel => deepMerge(selectViewModel(state), over);

// ─── Ports ───────────────────────────────────────────────────────────────────

export type CreateDiskFakePorts = {
  files: { pickFile: Mock; pickFolder: Mock };
  close: { created: Mock; cancelled: Mock };
  service: Record<keyof CreateDiskServicePort, Mock>;
};

export type CreateDiskHarnessOptions = {
  env?: Partial<CreateDiskEnvironment>;
  // --- Per-method overrides; anything omitted keeps a working default.
  service?: Partial<CreateDiskServicePort>;
  // --- What the folder picker returns; undefined means the user dismissed it.
  pickFolder?: string;
};

export function fakeCreateDiskPorts(
  over: CreateDiskHarnessOptions = {}
): CreateDiskFakePorts {
  const service = over.service ?? {};
  return {
    files: {
      pickFile: vi.fn(async () => undefined),
      pickFolder: vi.fn(async () => over.pickFolder)
    },
    close: { created: vi.fn(), cancelled: vi.fn() },
    // --- Defaults describe a boring, healthy system: the write succeeds and
    // --- the message box is dismissed immediately.
    service: {
      createDiskFile: vi.fn(
        service.createDiskFile ??
          (async (folder: string, filename: string) => `${folder}/${filename}`)
      ),
      notify: vi.fn(service.notify ?? (async () => undefined))
    }
  };
}

export type CreateDiskHarness = ControllerHarness<
  CreateDiskState,
  CreateDiskIntent,
  CreateDiskEvent,
  CreateDiskViewModel
> & {
  ports: CreateDiskFakePorts;
  env: CreateDiskEnvironment;
};

/**
 * Builds a controller over fake ports. The Create Disk dialog has no opening
 * sequence — it starts on an empty form — so there is only one opener.
 */
export function openCreateDiskDialog(
  over: CreateDiskHarnessOptions = {}
): CreateDiskHarness {
  const ports = fakeCreateDiskPorts(over);
  const env = anEnv(over.env);
  const controller = new CreateDiskController(ports as unknown as CreateDiskPorts, env);
  // --- Never spread the harness: `state`, `vm` and `events` are live getters.
  return harnessFor(controller, { ports, env });
}

/**
 * Fills the form in, the way a user would, so a test about creating a disk does
 * not restate the three fields every time.
 */
export async function fillForm(
  harness: CreateDiskHarness,
  over: { folder?: string; filename?: string; diskType?: string } = {}
): Promise<void> {
  await harness.dispatch({ type: "folderEdited", folder: over.folder ?? "/tmp" });
  await harness.dispatch({ type: "filenameEdited", filename: over.filename ?? "disk.dsk" });
  if (over.diskType) {
    await harness.dispatch({ type: "diskTypeSelected", diskType: over.diskType });
  }
}
