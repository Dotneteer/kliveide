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
  sendToEmu: (action: Action) => void,
  sendToIde: (action: Action) => void
): Store<AppState, Action> {
  if (!mainStore) {
    // Create the main store with a forwarder that sends to both renderers
    mainStore = createAppStore("main", async (action: Action, source) => {
      console.log(`[MainStore] Forwarder called - action: ${action.type}, source: ${source}`);
      
      // Forward actions based on their source:
      // - If from emu, send to ide
      // - If from ide, send to emu
      // - If from main, send to both
      if (source === "emu") {
        console.log(`[MainStore] Forwarding action from emu to ide`);
        sendToIde(action);
      } else if (source === "ide") {
        console.log(`[MainStore] Forwarding action from ide to emu`);
        sendToEmu(action);
      } else if (source === "main") {
        console.log(`[MainStore] Forwarding action from main to both renderers`);
        sendToEmu(action);
        sendToIde(action);
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
