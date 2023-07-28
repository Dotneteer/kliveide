import React from "react";
import ReactDOM from "react-dom/client";
import IdeApp from "./renderer/appIde/IdeApp";
import RendererProvider from "./renderer/core/RendererProvider";
import "@styles/index.css";
import ThemeProvider from "./renderer/theming/ThemeProvider";
import { AppServicesProvider } from "./renderer/appIde/services/AppServicesProvider";
import EmuApp from "./renderer/appEmu/EmuApp";
import { EmuToMainMessenger } from "@/common/messaging/EmuToMainMessenger";
import { IdeToMainMessenger } from "@/common/messaging/IdeToMainMessenger";
import createAppStore from "@/common/state/store";
import { MessageSource } from "@/common/messaging/messages-core";

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

document.title = isEmu
  ? "Klive ZX Spectrum Emulator"
  : "Klive IDE"

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
