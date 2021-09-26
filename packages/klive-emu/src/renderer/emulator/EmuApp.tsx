import * as React from "react";
import { AppState } from "../../shared/state/AppState";
import { getThemeService } from "../../shared/services/store-helpers";
import { useDispatch, useSelector, useStore } from "react-redux";
import Toolbar from "./Toolbar";
import MainPanel from "./MainPanel";
import EmuStatusbar from "./EmuStatusbar";
import { emuLoadUiAction } from "../../shared/state/emu-loaded-reducer";
import { AudioRenderer } from "../machines/audio/AudioRenderer";
import { ZxSpectrumStateManager } from "../machines/zx-spectrum/ZxSpectrumStateManager";
import { CambridgeZ88StateManager } from "../machines/cambridge-z88/CambridgeZ88BaseStateManager";
import { setEngineDependencies } from "../machines/core/vm-engine-dependencies";
import { useRef, useState } from "react";
import ModalDialog from "../common-ui/ModalDialog";
import { toStyleString } from "../ide/utils/css-utils";
import { modalDialogService } from "../common-ui/modal-service";
import { Z88_CARDS_DIALOG_ID } from "../machines/cambridge-z88/CambridgeZ88Core";
import { cz88CardsDialog } from "../machines/cambridge-z88/Cz88CardsDialog";

// --- We need to import these files to setup the app
import "./emu-message-processor";
import "./ide-message-processor";
import { getStore } from "../../shared/services/store-helpers";

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
      modalDialogService.registerModalDescriptor(
        Z88_CARDS_DIALOG_ID,
        cz88CardsDialog
      );
    }

    return () => {
      // --- Unsubscribe
      const store = getStore();
      store.isWindowsChanged.off(isWindowsChanged);
      store.themeChanged.off(themeChanged);
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
