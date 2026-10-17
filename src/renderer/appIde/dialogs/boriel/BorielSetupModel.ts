import type {
  BorielInstallResult,
  BorielSetupStatus
} from "@common/messaging/BorielIntegration";
import type { UiReducer } from "@mvc/core/types";

/*
 * The Boriel BASIC setup dialog (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §3.3): state, events and
 * the pure reducer. It opens either as the first-run offer or from Settings › Integrations.
 */

// ─── Vocabulary ──────────────────────────────────────────────────────────────

/** "offer": shown at startup, with "Not now" and "Don't ask again". "settings": opened by the user. */
export type BorielSetupMode = "offer" | "settings";

export type BorielBusy = "install" | "existing" | "closing" | undefined;

/** What the last install or "use existing" did, for the message under the buttons. */
export type BorielOutcome = { kind: "installed" | "failed"; text: string };

export type BorielSetupState = {
  mode: BorielSetupMode;
  status?: BorielSetupStatus;
  loading: boolean;
  loadError: string;
  folder: string;
  // --- Once the user typed or picked a folder, a reloaded status must not overwrite it
  folderEdited: boolean;
  dontAskAgain: boolean;
  busy: BorielBusy;
  outcome?: BorielOutcome;
};

export const INSTALLED_MESSAGE = (version: string, folder: string) =>
  `Boriel BASIC ${version} is installed in ${folder}.`;
export const USING_EXISTING_MESSAGE = (version: string, folder: string) =>
  `Klive now uses Boriel BASIC ${version} in ${folder}.`;

// ─── Events ──────────────────────────────────────────────────────────────────

export type BorielSetupEvent =
  | { type: "statusLoadStarted" }
  | { type: "statusLoaded"; status: BorielSetupStatus }
  | { type: "statusLoadFailed"; error: string }
  | { type: "folderChanged"; folder: string; edited: boolean }
  | { type: "dontAskAgainChanged"; value: boolean }
  | { type: "installStarted" }
  | { type: "existingStarted" }
  | { type: "actionSettled"; action: "install" | "existing"; result: BorielInstallResult }
  | { type: "actionFailed"; message: string }
  | { type: "closingStarted" }
  | { type: "closingFailed"; message: string };

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function initialState(mode: BorielSetupMode): BorielSetupState {
  return {
    mode,
    loading: true,
    loadError: "",
    folder: "",
    folderEdited: false,
    dontAskAgain: false,
    busy: undefined
  };
}

/** The folder the dialog proposes: the configured installation's, else `~/zxbasic2`. */
export function proposedFolder(status: BorielSetupStatus): string {
  const { installation } = status;
  return installation.kind === "notConfigured" ? status.defaultFolder : installation.folder;
}

export const reduce: UiReducer<BorielSetupState, BorielSetupEvent> = (state, event) => {
  switch (event.type) {
    case "statusLoadStarted":
      return state.loading && !state.loadError ? state : { ...state, loading: true, loadError: "" };
    case "statusLoaded":
      return {
        ...state,
        status: event.status,
        loading: false,
        loadError: "",
        folder: state.folderEdited ? state.folder : proposedFolder(event.status)
      };
    case "statusLoadFailed":
      return { ...state, loading: false, loadError: event.error };
    case "folderChanged":
      if (state.folder === event.folder && (!event.edited || state.folderEdited)) return state;
      return { ...state, folder: event.folder, folderEdited: state.folderEdited || event.edited, outcome: undefined };
    case "dontAskAgainChanged":
      return state.dontAskAgain === event.value ? state : { ...state, dontAskAgain: event.value };
    case "installStarted":
      return { ...state, busy: "install", outcome: undefined };
    case "existingStarted":
      return { ...state, busy: "existing", outcome: undefined };
    case "actionSettled": {
      const { result } = event;
      if (result.kind === "failed") {
        return { ...state, busy: undefined, outcome: { kind: "failed", text: result.error } };
      }
      const text =
        event.action === "install"
          ? INSTALLED_MESSAGE(result.version, result.folder)
          : USING_EXISTING_MESSAGE(result.version, result.folder);
      return {
        ...state,
        busy: undefined,
        folder: result.folder,
        folderEdited: false,
        outcome: { kind: "installed", text }
      };
    }
    case "actionFailed":
      return { ...state, busy: undefined, outcome: { kind: "failed", text: event.message } };
    case "closingStarted":
      return { ...state, busy: "closing" };
    case "closingFailed":
      return { ...state, busy: undefined, outcome: { kind: "failed", text: event.message } };
  }
};
