import * as React from "react";

import {
  dispatch,
  getModalDialogService,
  getStore,
  getThemeService,
} from "@core/service-registry";

import { AppState } from "@state/AppState";
import { useSelector } from "react-redux";
import { Toolbar } from "./Toolbar";
import MainPanel from "./MainPanel";
import { EmuStatusbar } from "./EmuStatusbar";
import { emuLoadUiAction } from "@state/emu-loaded-reducer";
import { useRef, useState } from "react";
import { ModalDialog } from "@components/ModalDialog";
import { stopCommandStatusQuery } from "@abstractions/command-registry";

// --- We need to import these files to setup the app
import "./emu-message-processor";
import "./ide-message-processor";
import { Z88_CARDS_DIALOG_ID } from "@modules/vm-z88/CambridgeZ88Core";
import { cz88CardsDialog } from "@modules/vm-z88/Cz88CardsDialog";
import { toStyleString } from "@ide/utils/css-utils";

/**
 * Represents the emulator app's root component
 */
export const EmuApp: React.VFC = () => {
  const mounted = useRef(false);
  const [show, setShow] = useState(false);
  const [themeStyle, setThemeStyle] = useState({});
  const [themeClass, setThemeClass] = useState("");

  const showToolbar = useSelector(
    (s: AppState) => s.emuViewOptions.showToolbar
  );
  const showStatusBar = useSelector(
    (s: AppState) => s.emuViewOptions.showStatusBar
  );

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

      setTimeout(() => {
        if (mounted.current) {
          setShow(true);
        }
      }, 1200);
    }

    return () => {
      // --- Unsubscribe
      const store = getStore();
      store.isWindowsChanged.off(isWindowsChanged);
      store.themeChanged.off(themeChanged);
      stopCommandStatusQuery();
    };
  });

  // --- Apply styles to body so that dialogs, context menus can use it, too.
  document.body.setAttribute("style", toStyleString(themeStyle));
  document.body.setAttribute("class", themeClass);

  return (
    <>
      <div style={themeStyle} className={themeClass}>
        {showToolbar && <Toolbar />}
        <MainPanel />
        {showStatusBar && <EmuStatusbar></EmuStatusbar>}
        <ModalDialog targetId="#app" />
      </div>
      {!show && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "var(--shell-canvas-background-color)",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              display: "flex",
              flex: "1 1 column",
              height: "100%",
              width: "100%",
              flexShrink: 1,
              flexGrow: 1,
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "2em",
            }}
          >
            Klive is loading...
          </div>
        </div>
      )}
    </>
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
};
