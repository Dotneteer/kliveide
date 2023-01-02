import React from "react";
import ReactDOM from "react-dom/client";
import IdeApp from "./appIde/IdeApp";
import RendererProvider from "./core/RendererProvider";
import "@styles/index.css";
import ThemeProvider from "./theming/ThemeProvider";
import { AppServicesProvider } from "./ide/AppServicesProvider";
import EmuApp from "./appEmu/EmuApp";
import { EmuToMainMessenger } from "@messaging/EmuToMainMessenger";
import { IdeToMainMessenger } from "@messaging/IdeToMainMessenger";
import createAppStore from "@state/store";
import { MessageSource } from "@messaging/messages-core";

// --- Create the application messenger and the store according to the discriminator parameter
const isEmu = location.search === "?emu";

// --- Create the appropriate messenger
const messenger = isEmu ? new EmuToMainMessenger() : new IdeToMainMessenger();
const messageSource: MessageSource = isEmu ? "emu" : "ide";

// --- Create a store that forwards the actions to the main process with the messenger
const store = createAppStore(async (action, source) => {
  if (source === messageSource) {
    // --- Forward only the messages dispatched from this renderer so that the main process
    // --- can receive them.
    await messenger.sendMessage({
      type: "ForwardAction",
      action,
      sourceId: messageSource
    });
  }
});

// --- Render the app's UI
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RendererProvider
      store={store}
      messenger={messenger}
      messageSource={messageSource}
    >
      <ThemeProvider>
        <AppServicesProvider>
          {isEmu ? <EmuApp /> : <IdeApp />}
        </AppServicesProvider>
      </ThemeProvider>
    </RendererProvider>
  </React.StrictMode>
);

// --- Notify the preloader to remove the "loading" indicator
postMessage({ payload: "removeLoading" }, "*");
