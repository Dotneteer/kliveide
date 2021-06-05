import * as React from "react";
import { StateAwareObject } from "../../shared/state/StateAwareObject";
import { AppState } from "../../shared/state/AppState";
import { themeService } from "../themes/theme-service";
import { IThemeProperties } from "../themes/IThemeProperties";
import { useDispatch, useSelector, useStore } from "react-redux";
import Toolbar from "./Toolbar";
import MainPanel from "./MainPanel";
import EmuStatusbar from "./EmuStatusbar";
import { emuLoadUiAction } from "../../shared/state/emu-loaded-reducer";
import "./emu-message-processor";
import { AudioRenderer } from "../machines/AudioRenderer";
import { ZxSpectrumStateManager } from "../machines/spectrum/ZxSpectrumStateManager";
import { CambridgeZ88StateManager } from "../machines/cz88/CambridgeZ88BaseStateManager";
import { setEngineDependencies } from "../machines/vm-engine-dependencies";
import { useState } from "react";

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
  const [themeStyle, setThemeStyle] = useState({});
  const [themeClass, setThemeClass] = useState("");
  const store = useStore();
  const dispatch = useDispatch();

  // --- Keep track of theme changes
  let themeAware: StateAwareObject<string>;

  React.useEffect(() => {
    // --- Mount
    dispatch(emuLoadUiAction());
    updateThemeState();
    themeAware = new StateAwareObject(store, "theme");
    themeAware.stateChanged.on((theme) => {
      themeService.setTheme(theme);
      updateThemeState();
    });
    return () => {
      // --- Unmount
      dispatch(emuLoadUiAction());
    };
  }, [store]);

  const emuViewOptions = useSelector((s: AppState) => s.emuViewOptions);

  return (
    <div style={themeStyle} className={themeClass}>
      {emuViewOptions.showToolbar && <Toolbar></Toolbar>}
      <MainPanel />
      {emuViewOptions.showStatusBar && <EmuStatusbar></EmuStatusbar>}
    </div>
  );

  function updateThemeState(): void {
    const theme = themeService.getActiveTheme();
    if (!theme) {
      return;
    }
    let themeStyle: Record<string, string> = {};
    for (const key in theme.properties) {
      themeStyle[key] = theme.properties[key as keyof IThemeProperties];
    }
    setThemeStyle(themeStyle);
    setThemeClass(`app-container ${theme.name}-theme`);
  }
}
