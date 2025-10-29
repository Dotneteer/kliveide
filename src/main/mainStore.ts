import { Action } from "../common/state/Action";
import createAppStore from "../common/state/store";
import type { Store } from "../common/state/redux-light";
import type { AppState } from "../common/state/AppState";

/**
 * The main process Redux store - the source of truth for application state.
 * This store forwards actions to both renderer processes.
 */
let mainStore: Store<AppState, Action> | null = null;

/**
 * Gets the main process Redux store.
 * Creates it on first access with a forwarder that broadcasts to both renderers.
 */
export function getMainStore(
  sendToEmu: (action: Action, source: string) => void,
  sendToIde: (action: Action, source: string) => void
): Store<AppState, Action> {
  if (!mainStore) {
    // Create the main store with a forwarder that sends to both renderers
    mainStore = createAppStore("main", async (action: Action, source) => {
      // Forward actions based on their source:
      // - If from emu, send to ide (with source='emu' so IDE knows where it came from)
      // - If from ide, send to emu (with source='ide' so EMU knows where it came from)
      // - If from main, send to both (with source='main')
      if (source === "emu") {
        sendToIde(action, source);
      } else if (source === "ide") {
        sendToEmu(action, source);
      } else if (source === "main") {
        sendToEmu(action, source);
        sendToIde(action, source);
      }
    });
  }
  return mainStore;
}

/**
 * Resets the main store (useful for testing)
 */
export function resetMainStore(): void {
  mainStore = null;
}
