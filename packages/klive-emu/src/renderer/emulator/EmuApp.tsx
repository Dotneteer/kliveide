import * as React from "react";

import {
  getModalDialogService,
  getStore,
  getThemeService,
} from "@core/service-registry";

import { AppState } from "@state/AppState";
import { useDispatch, useSelector, useStore } from "react-redux";
import Toolbar from "./Toolbar";
import MainPanel from "./MainPanel";
import EmuStatusbar from "./EmuStatusbar";
import { emuLoadUiAction } from "@state/emu-loaded-reducer";
import { AudioRenderer } from "../machines/audio/AudioRenderer";
import { setEngineDependencies } from "../../extensions/core/vm-engine-dependencies";
import { useRef, useState } from "react";
import ModalDialog from "../../emu-ide/components/ModalDialog";
import { toStyleString } from "../ide/utils/css-utils";
import { stopCommandStatusQuery } from "@abstractions/command-registry";

// --- We need to import these files to setup the app
import "./emu-message-processor";
import "./ide-message-processor";
import { ZxSpectrumStateManager } from "@ext/vm-zx-spectrum/ZxSpectrumStateManager";
import { CambridgeZ88StateManager } from "@ext/vm-z88/CambridgeZ88BaseStateManager";
import { Z88_CARDS_DIALOG_ID } from "@ext/vm-z88/CambridgeZ88Core";
import { cz88CardsDialog } from "@ext/vm-z88/Cz88CardsDialog";

// --- Set up the virual machine engine service with the
setEngineDependencies({
  waModuleLoader: async (moduleFile: string) => {
    const response = await fetch("./wasm/" + moduleFile);
    return await response.arrayBuffer();
  },
  sampleRateGetter: () => new AudioContext().sampleRate,
  audioRendererFactory: (s: number) => new AudioRenderer(s),
  spectrumStateManager: new ZxSpectrumStateManager(),
  cz88StateManager: new CambridgeZ88StateManager(),
});

/**
 * Represents the emulator app's root component
 */
export default function EmuApp() {
  const mounted = useRef(false);
  const [themeStyle, setThemeStyle] = useState({});
  const [themeClass, setThemeClass] = useState("");
  const store = useStore();
  const dispatch = useDispatch();

  const emuViewOptions = useSelector((s: AppState) => s.emuViewOptions);

  React.useEffect(() => {
    // --- State change event handlers
    const themeService = getThemeService();
    const isWindowsChanged = (isWindows: boolean) => {
      themeService.isWindows = isWindows;
      updateThemeState();
    };
    const themeChanged = (theme: string) => {
      themeService.setTheme(theme);
      updateThemeState();
    };

    if (!mounted.current) {
      mounted.current = true;
      // --- Mount
      dispatch(emuLoadUiAction());
      updateThemeState();

      const store = getStore();
      store.themeChanged.on(themeChanged);
      store.isWindowsChanged.on(isWindowsChanged);

      // --- Register modal dialogs
      getModalDialogService().registerModalDescriptor(
        Z88_CARDS_DIALOG_ID,
        cz88CardsDialog
      );
    }

    return () => {
      // --- Unsubscribe
      const store = getStore();
      store.isWindowsChanged.off(isWindowsChanged);
      store.themeChanged.off(themeChanged);
      stopCommandStatusQuery();
    };
  }, [store]);

  // --- Apply styles to body so that dialogs, context menus can use it, too.
  document.body.setAttribute("style", toStyleString(themeStyle));
  document.body.setAttribute("class", themeClass);

  return (
    <div style={themeStyle} className={themeClass}>
      {emuViewOptions.showToolbar && <Toolbar></Toolbar>}
      <MainPanel />
      {emuViewOptions.showStatusBar && <EmuStatusbar></EmuStatusbar>}
      <ModalDialog targetId="#app" />
    </div>
  );

  function updateThemeState(): void {
    const themeService = getThemeService();
    const theme = themeService.getActiveTheme();
    if (!theme) {
      return;
    }
    setThemeStyle(themeService.getThemeStyle());
    setThemeClass(`app-container ${theme.name}-theme`);
  }
}
