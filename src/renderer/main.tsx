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
import { OverlayProvider } from "./controls/overlay/OverlayProvider";
import { DialogProvider } from "./controls/overlay/DialogProvider";
import { registerMainToEmuIpc } from "./appEmu/MainToEmuIpc";
import { registerMainToIdeIpc } from "./appIde/MainToIdeIpc";
import { setCachedMessenger, setCachedStore } from "./CachedServices";

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

// --- Publish the store and the messenger to the out-of-React message processing path right away.
// --- The startup hooks publish these too, but only from a React effect - far too late for the
// --- state the main process broadcasts while this window is still booting. The app services are
// --- still published by those hooks, and requests that genuinely need them are answered with
// --- "NotReady" until they exist.
setCachedStore(store);
setCachedMessenger(messenger);

// --- Start listening for main-process requests immediately, at module load time - before React
// --- renders anything, and only once the store above can already receive forwarded state. The
// --- main process starts broadcasting state (theme, machine type, model, key mappings, global
// --- settings, ...) as soon as the *emulator* window reports ready, which is decoupled from this
// --- window's own readiness. Electron drops messages sent to a channel that has no listener yet
// --- and never redelivers them, so registering from a React effect - which runs only after the
// --- first commit, and after any heavier layout-effect work such as initializing Monaco - leaves
// --- a window in which that whole broadcast is silently and permanently lost.
if (isEmu) {
  registerMainToEmuIpc();
} else {
  registerMainToIdeIpc();
}

document.title = isEmu ? "Klive Retro-Computer Emulator" : "Klive IDE";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RendererProvider store={store} messenger={messenger} messageSource={messageSource}>
      <ThemeProvider>
        <OverlayProvider>
          <AppServicesProvider>
            <DialogProvider>{isEmu ? <EmuApp /> : <IdeApp />}</DialogProvider>
          </AppServicesProvider>
        </OverlayProvider>
      </ThemeProvider>
    </RendererProvider>
  </React.StrictMode>
);
