import React from "react";
import ReactDOM from "react-dom/client";
import IdeApp from "./appIde/IdeApp";
import RendererProvider from "./core/StoreProvider";
import "@styles/index.css";
import ThemeProvider from "./theming/ThemeProvider";
import { AppServicesProvider } from "./ide/AppServicesProvider";
import EmuApp from "./appEmu/EmuApp";
import { EmuToMainMessenger } from "@messaging/EmuToMainMessenger";
import { IdeToMainMessenger } from "@messaging/IdeToMainMessenger";
import createAppStore from "@state/store";

// --- Create the application messenger and the store according to the discriminator parameter
const isEmu = location.search === "?emu";
console.log(isEmu);

// --- Create the appropriate messenger
const messenger = isEmu ? new EmuToMainMessenger() : new IdeToMainMessenger();

// --- Create a store that forwards the actions to the main process with the messenger
const store = createAppStore(async action => {
  await messenger.sendMessage({
    type: "ForwardAction",
    action
  });
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RendererProvider store={store} messenger={messenger}>
      <ThemeProvider>
        <AppServicesProvider>{isEmu ? <EmuApp /> : <IdeApp />}</AppServicesProvider>
      </ThemeProvider>
    </RendererProvider>
  </React.StrictMode>
);

postMessage({ payload: "removeLoading" }, "*");
