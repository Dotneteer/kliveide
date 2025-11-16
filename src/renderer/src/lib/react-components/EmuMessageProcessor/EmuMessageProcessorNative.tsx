import { useLayoutEffect, useRef } from "react";
import type { ApiMethodRequest, ResponseMessage } from "@messaging/messages-core";
import { processEmuMessage } from "./process-emu-messages";
import { getRendererStore } from "../../store/rendererStore";
import { EmuToMainMessenger } from "@messaging/EmuToMainMessenger";
import { useEmuAppServices } from "../EmuAppServicesProvider/useEmuAppServices";

// Declare window for electron API access
declare const window: Window & {
  electron: {
    ipcRenderer: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, listener: (...args: any[]) => void) => void;
      send: (channel: string, ...args: any[]) => void;
      removeListener: (channel: string, listener: (...args: any[]) => void) => void;
    };
  };
};

// =====================================================================================================================
// React EmuMessageProcessor component implementation

type Props = {
  registerComponentApi: any;
  updateState: any;
};

export function EmuMessageProcessorNative({ registerComponentApi, updateState }: Props) {
  // Get services from context
  const { machineService } = useEmuAppServices();

  // Get store and messenger
  const store = getRendererStore();
  const messengerRef = useRef(new EmuToMainMessenger());

  // Use refs to store stable references to prop functions
  const updateStateRef = useRef(updateState);
  const registerComponentApiRef = useRef(registerComponentApi);

  // Update refs when props change
  updateStateRef.current = updateState;
  registerComponentApiRef.current = registerComponentApi;

  // Set up message listener using useLayoutEffect
  // This ensures the listener is ready BEFORE onReady fires
  useLayoutEffect(() => {
    // Register API methods (none for now)
    if (registerComponentApiRef.current) {
      registerComponentApiRef.current({});
    }

    // Get access to the electron IPC renderer
    const ipcRenderer = window.electron?.ipcRenderer;

    if (!ipcRenderer) {
      console.error("[EmuMessageProcessor] electron.ipcRenderer not available");
      return () => {}; // Return empty cleanup function
    }

    // Set up listener for MainToEmu channel to receive API method requests
    const handleMessage = (_event: any, message: ApiMethodRequest) => {
      console.log("[EmuMessageProcessor] Received message:", message);

      // Process the message and get the result
      let response: ResponseMessage = { type: "Ack" };
      if (message.type === "ApiMethodRequest") {
        const result = processEmuMessage(message, store, messengerRef.current, machineService);
        response = {
          type: "ApiMethodResponse",
          correlationId: message.correlationId,
          result
        };
      }

      ipcRenderer.send("MainToEmuResponse", response);
    };

    // Register the listener
    ipcRenderer.on("MainToEmu", handleMessage);

    console.log("[EmuMessageProcessor] Initialized and listening for messages");

    // Cleanup function
    return () => {
      if (ipcRenderer.removeListener) {
        ipcRenderer.removeListener("MainToEmu", handleMessage);
      }
      console.log("[EmuMessageProcessor] Cleaned up message listener");
    };
  }, [store, machineService]);

  // This is a non-visual component, render nothing
  return null;
}
