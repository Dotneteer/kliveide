import React from "react";
import ReactDOM from "react-dom/client";
import IdeApp from "./appIde/IdeApp";
import RendererProvider from "./core/RendererProvider";
// import "overlayscrollbars/overlayscrollbars.css";
import "@styles/overlayScrollbars-modified.css"
import "@styles/index.css";
import ThemeProvider from "./theming/ThemeProvider";
import { AppServicesProvider } from "./appIde/services/AppServicesProvider";
import EmuApp from "./appEmu/EmuApp";
import { EmuToMainMessenger } from "@messaging/EmuToMainMessenger";
import { IdeToMainMessenger } from "@messaging/IdeToMainMessenger";
import createAppStore from "@state/store";
import { MessageSource } from "@messaging/messages-core";

// --- Create the application messenger and the store according to the discriminator parameter
const isEmu = location.search.startsWith("?emu");

// --- Create the appropriate messenger
const messenger = isEmu ? new EmuToMainMessenger() : new IdeToMainMessenger();
const messageSource: MessageSource = isEmu ? "emu" : "ide";

// --- Create a store that forwards the actions to the main process with the messenger
const store = createAppStore(messageSource, async (action, source) => {
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

document.title = isEmu ? "Klive Retro-Computer Emulator" : "Klive IDE";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  // <React.StrictMode> -- Temporarily disabled to debug flickering issue
    <RendererProvider store={store} messenger={messenger} messageSource={messageSource}>
      <ThemeProvider>
        <AppServicesProvider>{isEmu ? <EmuApp /> : <IdeApp />}</AppServicesProvider>
      </ThemeProvider>
    </RendererProvider>
  // </React.StrictMode>
);
