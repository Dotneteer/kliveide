import React from "react";
import ReactDOM from "react-dom/client";
import IdeApp from "./appIde/IdeApp";
import RendererProvider from "./core/RendererProvider";
// import "overlayscrollbars/overlayscrollbars.css";
import "@styles/fonts.css";
import "@styles/overlayScrollbars-modified.css"
import "@styles/index.css";
import ThemeProvider from "./theming/ThemeProvider";
import { AppServicesProvider } from "./appIde/services/AppServicesProvider";
import EmuApp from "./appEmu/EmuApp";
import { EmuToMainMessenger } from "@messaging/EmuToMainMessenger";
import { IdeToMainMessenger } from "@messaging/IdeToMainMessenger";
import { FloatToMainMessenger } from "@messaging/FloatToMainMessenger";
import createAppStore from "@state/store";
import { MessageSource, floatSlotOf, floatSourceOf } from "@messaging/messages-core";
import { createMainApi } from "@messaging/MainApi";
import { floatHubIdBase } from "@messaging/floating-documents";
import FloatApp from "./appFloat/FloatApp";
import { OverlayProvider } from "./controls/overlay/OverlayProvider";
import { DialogProvider } from "./controls/overlay/DialogProvider";
import { registerMainToEmuIpc } from "./appEmu/MainToEmuIpc";
import { registerMainToIdeIpc } from "./appIde/MainToIdeIpc";
import { setCachedMessenger, setCachedStore } from "./CachedServices";
import { installMachineRebuildRejectionFilter } from "./machineRebuildRejections";
import { installUiLanguageSync } from "./core/uiLanguageSync";

// --- Create the application messenger and the store according to the discriminator parameter.
// --- `?float=<slot>` is a floating document window: an IDE renderer in "satellite" mode
// --- (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §3.1).
const floatSlot = floatSlotOf(`float${new URLSearchParams(location.search).get("float") ?? ""}`);
const isFloat = floatSlot !== undefined;
const isEmu = !isFloat && location.search.startsWith("?emu");

// --- Create the appropriate messenger
const messenger = isEmu
  ? new EmuToMainMessenger()
  : isFloat
    ? new FloatToMainMessenger(floatSourceOf(floatSlot))
    : new IdeToMainMessenger();
const messageSource: MessageSource = isEmu ? "emu" : isFloat ? floatSourceOf(floatSlot) : "ide";

// --- Create a store that forwards the actions to the main process with the messenger. The IDE's
// --- services dispatch their shared state with an explicit `"ide"` source; in a floating window that
// --- means "this IDE renderer", so it is forwarded too, under the window's own source. (Actions that
// --- arrive from main are replayed with the "main" source there, so they never echo back.)
const store = createAppStore(messageSource, async (action, source) => {
  if (source === messageSource || (isFloat && source === "ide")) {
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

// --- Follow the display language main publishes, before anything renders (`dev/ai/localization.md`, "The runtime").
// --- A floating window installs it once it has the full state below.
if (!isFloat) {
  installUiLanguageSync(store);
}

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
} else if (isFloat) {
  registerMainToIdeIpc(undefined, {
    requestChannel: "MainToFloat",
    responseChannel: "MainToFloatResponse",
    sourceId: messageSource,
    forwardedActionSource: "main"
  });
} else {
  registerMainToIdeIpc();
}

document.title = isEmu ? "Klive Retro-Computer Emulator" : "Klive IDE";

// --- "No machine" while the emulator rebuilds one is expected, not an error to report
installMachineRebuildRejectionFilter(window);

function render(): void {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <RendererProvider store={store} messenger={messenger} messageSource={messageSource}>
        <ThemeProvider>
          <OverlayProvider>
            <AppServicesProvider
              role={isFloat ? "satellite" : "ide"}
              hubIdBase={isFloat ? floatHubIdBase(floatSlot) : undefined}
            >
              <DialogProvider>
                {isEmu ? <EmuApp /> : isFloat ? <FloatApp slot={floatSlot} /> : <IdeApp />}
              </DialogProvider>
            </AppServicesProvider>
          </OverlayProvider>
        </ThemeProvider>
      </RendererProvider>
    </React.StrictMode>
  );
}

if (isFloat) {
  // --- A floating window opens long after the broadcasts the other windows received at startup:
  // --- it starts from main's whole current state (plan §3.2). Its IPC listener is already
  // --- registered, and main answers on the same ordered channel it forwards later actions on, so
  // --- nothing falls between the snapshot and the actions after it.
  createMainApi(messenger)
    .getFullState()
    .then((state) => {
      if (state) store.resetTo(state);
    })
    .catch((err) => console.error("Cannot read the state of the floating window:", err))
    .finally(() => {
      installUiLanguageSync(store);
      render();
    });
} else {
  render();
}
