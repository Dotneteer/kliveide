import type { Action } from "../../../../common/state/Action";
import type { ActionForwarder } from "../../../../common/state/redux-light";
import type { MessageSource } from "../../../../common/messaging/messages-core";

/**
 * Creates an action forwarder that sends actions to the main process via IPC.
 * The main process will then forward them to other renderer processes.
 */
export function createIpcActionForwarder(processId: string): ActionForwarder {
  return async (action: Action, source: MessageSource) => {
    console.log(`[ActionForwarder/${processId}] Called - action: ${action.type}, source: ${source}`);
    
    // Only forward actions that originated locally (source === "main")
    // Don't forward actions that came from other processes via IPC (avoid loops)
    if (source !== "main") {
      console.log(`[ActionForwarder/${processId}] NOT forwarding - source is not "main", it's "${source}"`);
      return;
    }

    console.log(`[ActionForwarder/${processId}] FORWARDING to main process`);
    try {
      // Send ForwardAction message to main process via IPC
      await window.electron.ipcRenderer.invoke("ForwardAction", {
        action,
        sourceProcess: processId
      });
      console.log(`[ActionForwarder/${processId}] Successfully forwarded to main`);
    } catch (error) {
      console.error(`[ActionForwarder/${processId}] Error forwarding action:`, error);
    }
  };
}
