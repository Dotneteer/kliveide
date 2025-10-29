import type { Action } from "../../../../common/state/Action";
import type { ActionForwarder } from "../../../../common/state/redux-light";
import type { MessageSource } from "../../../../common/messaging/messages-core";

/**
 * Creates an action forwarder that sends actions to the main process via IPC.
 * The main process will then forward them to other renderer processes.
 */
export function createIpcActionForwarder(processId: string): ActionForwarder {
  return async (action: Action, source: MessageSource) => {
    console.log(`[ActionForwarder/${processId}] Called with action:`, action.type, 'source:', source);
    
    // Don't forward actions that came from other processes (avoid loops)
    if (source !== "main") {
      console.log(`[ActionForwarder/${processId}] Skipping forward - source is not main, it's:`, source);
      return;
    }

    console.log(`[ActionForwarder/${processId}] Forwarding action ${action.type} to main process via IPC`);
    try {
      // Send ForwardAction message to main process via IPC
      await window.electron.ipcRenderer.invoke("ForwardAction", {
        action,
        sourceProcess: processId
      });
      console.log(`[ActionForwarder/${processId}] Action ${action.type} forwarded successfully`);
    } catch (error) {
      console.error(`[ActionForwarder/${processId}] Error forwarding action:`, error);
    }
  };
}
