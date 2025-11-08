import { Action } from "@state/Action";
import createAppStore from "@state/store";
import type { Store } from "@state/redux-light";
import type { AppState } from "@state/AppState";

/**
 * The main process Redux store - the source of truth for application state.
 * This store forwards actions to both renderer processes.
 */
let _mainStore: Store<AppState, Action> | null = null;

/**
 * Gets the main store (assumes it has been initialized)
 */
export const mainStore = {
  get dispatch() {
    return _mainStore!.dispatch;
  },
  get getState() {
    return _mainStore!.getState;
  },
  get subscribe() {
    return _mainStore!.subscribe;
  },
  get id() {
    return _mainStore!.id;
  },
  get resetTo() {
    return _mainStore!.resetTo;
  }
};

/**
 * Initializes the main process Redux store.
 * Creates the store with a forwarder that broadcasts to both renderers.
 */
export function initializeMainStore(
  sendToEmu: (action: Action, source: string) => void,
  sendToIde: (action: Action, source: string) => void
): Store<AppState, Action> {
  if (!_mainStore) {
    // Create the main store with a forwarder that sends to both renderers
    _mainStore = createAppStore("main", async (action: Action, source) => {
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
  return _mainStore;
}

/**
 * Resets the main store (useful for testing)
 */
export function resetMainStore(): void {
  _mainStore = null;
}
