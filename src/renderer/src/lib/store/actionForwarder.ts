import type { Action } from "@state/Action";
import type { ActionForwarder } from "@state/redux-light";
import type { MessageSource } from "@messaging/messages-core";

// Declare window for electron API access
declare const window: Window & {
  electron: {
    ipcRenderer: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, listener: (...args: any[]) => void) => void;
    };
  };
};

/**
 * Creates an action forwarder that sends actions to the main process via IPC.
 * The main process will then forward them to other renderer processes.
 */
export function createIpcActionForwarder(processId: string): ActionForwarder {
  return async (action: Action, source: MessageSource) => {
    // Only forward actions that originated locally (source === "main")
    // Don't forward actions that came from other processes via IPC (avoid loops)
    if (source !== "main") {
      return;
    }

    try {
      // Send ForwardAction message to main process via IPC
      await window.electron.ipcRenderer.invoke("ForwardAction", {
        action,
        sourceProcess: processId
      });
    } catch (error) {
      console.error(`[ActionForwarder/${processId}] Error forwarding action:`, error);
    }
  };
}
