import { vi, type Mock } from "vitest";

import type { ExportDialogSettings } from "@main/settings";
import { ExportCodeController } from "@renderer/appIde/dialogs/exportCode/ExportCodeController";
import type { ExportCodeIntent } from "@renderer/appIde/dialogs/exportCode/ExportCodeIntents";
import {
  initialState,
  type ExportCodeEnvironment,
  type ExportCodeEvent,
  type ExportCodeState
} from "@renderer/appIde/dialogs/exportCode/ExportCodeModel";
import type {
  ExportCodePorts,
  ExportCodeServicePort,
  ExportCommandResult
} from "@renderer/appIde/dialogs/exportCode/ExportCodePorts";
import {
  selectViewModel,
  type ExportCodeViewModel
} from "@renderer/appIde/dialogs/exportCode/ExportCodeViewModel";
import type { IValidationService } from "@renderer/core/ValidationService";

import { harnessFor, type ControllerHarness } from "../../mvc/ControllerHarness";
import { deepMerge, type DeepPartial } from "../../mvc/fixtures";

export { deepMerge };
export type { DeepPartial };

/**
 * Fixture builders for the Export Code dialog tests.
 */

// ─── Environment ─────────────────────────────────────────────────────────────

export const PERMISSIVE_VALIDATION: IValidationService = {
  isValidFilename: () => true,
  isValidPath: () => true
};

export function rejectingValidation(over: Partial<IValidationService> = {}): IValidationService {
  return { ...PERMISSIVE_VALIDATION, ...over };
}

export const anEnv = (over?: Partial<ExportCodeEnvironment>): ExportCodeEnvironment => ({
  validation: PERMISSIVE_VALIDATION,
  ...over
});

// ─── State ───────────────────────────────────────────────────────────────────

export const aState = (
  over?: DeepPartial<ExportCodeState>,
  env: ExportCodeEnvironment = anEnv(),
  saved: ExportDialogSettings = {}
): ExportCodeState => deepMerge(initialState(env, saved), over);

// --- A form that would pass validation: only the export name is required.
export const aReadyState = (over?: DeepPartial<ExportCodeState>): ExportCodeState =>
  deepMerge(aState({ settings: { exportName: "game" } }), over);

export const aViewModel = (
  over?: DeepPartial<ExportCodeViewModel>,
  state: ExportCodeState = aState()
): ExportCodeViewModel => deepMerge(selectViewModel(state), over);

// ─── Ports ───────────────────────────────────────────────────────────────────

export type ExportCodeFakePorts = {
  files: { pickFile: Mock; pickFolder: Mock };
  close: { exported: Mock; cancelled: Mock };
  service: Record<keyof ExportCodeServicePort, Mock>;
};

export type ExportCodeHarnessOptions = {
  env?: Partial<ExportCodeEnvironment>;
  // --- What the project already had saved when the dialog opened.
  saved?: ExportDialogSettings;
  service?: Partial<ExportCodeServicePort>;
  pickFile?: string;
  pickFolder?: string;
  // --- What running the export command reports back.
  result?: ExportCommandResult;
};

export function fakeExportCodePorts(over: ExportCodeHarnessOptions = {}): ExportCodeFakePorts {
  const service = over.service ?? {};
  return {
    files: {
      pickFile: vi.fn(async () => over.pickFile),
      pickFolder: vi.fn(async () => over.pickFolder)
    },
    close: { exported: vi.fn(async () => undefined), cancelled: vi.fn() },
    // --- Defaults describe a healthy system: settings save, the export runs
    // --- and succeeds, and the message box is dismissed.
    service: {
      persistSettings: vi.fn(service.persistSettings ?? (async () => undefined)),
      runExport: vi.fn(
        service.runExport ?? (async () => over.result ?? { success: true, finalMessage: undefined })
      ),
      notify: vi.fn(service.notify ?? (async () => undefined))
    }
  };
}

export type ExportCodeHarness = ControllerHarness<
  ExportCodeState,
  ExportCodeIntent,
  ExportCodeEvent,
  ExportCodeViewModel
> & {
  ports: ExportCodeFakePorts;
  env: ExportCodeEnvironment;
};

/**
 * Builds a controller over fake ports without opening it. Use this when the
 * opening sequence — which persists the settings — is what the test is about.
 */
export function createExportCodeDialog(
  over: ExportCodeHarnessOptions = {}
): ExportCodeHarness {
  const ports = fakeExportCodePorts(over);
  const env = anEnv(over.env);
  const controller = new ExportCodeController(
    ports as unknown as ExportCodePorts,
    env,
    over.saved ?? {}
  );
  // --- Never spread the harness: `state`, `vm` and `events` are live getters.
  return harnessFor(controller, { ports, env });
}

export async function openExportCodeDialog(
  over: ExportCodeHarnessOptions = {}
): Promise<ExportCodeHarness> {
  const harness = createExportCodeDialog(over);
  await harness.dispatch({ type: "opened" });
  // --- Opening persists once; a test about later saves starts from a clean count.
  harness.ports.service.persistSettings.mockClear();
  return harness;
}

// --- The one field the form actually requires.
export async function fillForm(
  harness: ExportCodeHarness,
  exportName = "game"
): Promise<void> {
  await harness.dispatch({ type: "settingEdited", patch: { exportName } });
}
