import createAppStore from "../../../../common/state/store";
import type { Store } from "../../../../common/state/redux-light";
import type { AppState } from "../../../../common/state/AppState";
import type { Action } from "../../../../common/state/Action";
import { createIpcActionForwarder } from "./actionForwarder";

let rendererStore: Store<AppState, Action> | null = null;

/**
 * Gets the renderer process Redux store.
 * Creates it on first access.
 */
export function getRendererStore(): Store<AppState, Action> {
  if (!rendererStore) {
    // Determine store ID based on URL query parameter
    const url = new URL(window.location.href);
    const storeId = url.searchParams.has("emu") ? "emu" : "ide";
    
    // Create action forwarder that sends actions via IPC
    const forwarder = createIpcActionForwarder(storeId);
    
    rendererStore = createAppStore(storeId, forwarder);
    
    // Set up IPC listener to receive forwarded actions from main process
    window.electron.ipcRenderer.on("ForwardActionToRenderer", (_event, data) => {
      const { action, sourceProcess } = data;
      
      // Dispatch with source set to the originating process to avoid re-forwarding
      rendererStore!.dispatch(action, sourceProcess);
    });
  }
  return rendererStore;
}

/**
 * Resets the store (useful for testing or hot reload)
 */
export function resetRendererStore(): void {
  rendererStore = null;
}
