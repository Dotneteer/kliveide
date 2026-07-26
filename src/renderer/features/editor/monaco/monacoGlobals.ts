import type { Store } from "@common/state/redux-light";
import type { AppState } from "@common/state/AppState";
import type { RenameEdit } from "@renderer/appIde/services/z80-providers";

type NavigateToFile = (filePath: string, line: number) => void;
type ApplyExternalEdits = (edits: RenameEdit[]) => void;

let navigateToFile: NavigateToFile | null = null;
let applyExternalEdits: ApplyExternalEdits | null = null;
let providerStore: Store<AppState> | null = null;

/**
 * Sets the active Monaco cross-file navigation target and returns a cleanup
 * that only clears the callback if it is still the active one.
 */
export function setMonacoNavigationHandler(handler: NavigateToFile): () => void {
  navigateToFile = handler;
  return () => {
    if (navigateToFile === handler) {
      navigateToFile = null;
    }
  };
}

/**
 * Sets the active Monaco external-edit handler and returns scoped cleanup.
 */
export function setMonacoExternalEditHandler(handler: ApplyExternalEdits): () => void {
  applyExternalEdits = handler;
  return () => {
    if (applyExternalEdits === handler) {
      applyExternalEdits = null;
    }
  };
}

/**
 * Sets the store used by Monaco providers and returns scoped cleanup.
 */
export function setMonacoProviderStore(store: Store<AppState>): () => void {
  providerStore = store;
  return () => {
    if (providerStore === store) {
      providerStore = null;
    }
  };
}

export function applyMonacoExternalEdits(edits: RenameEdit[]): void {
  applyExternalEdits?.(edits);
}

export function getMonacoProjectFolder(): string | undefined {
  return providerStore?.getState()?.project?.folderPath ?? undefined;
}

export function navigateMonacoToFile(filePath: string, line: number): boolean {
  if (!navigateToFile) return false;
  navigateToFile(filePath, line);
  return true;
}

export function resetMonacoGlobalsForTests(): void {
  navigateToFile = null;
  applyExternalEdits = null;
  providerStore = null;
}
