import * as React from "react";
import { StateAwareObject } from "../../shared/state/StateAwareObject";
import { AppState } from "../../shared/state/AppState";
import { themeService } from "../themes/theme-service";
import { IThemeProperties } from "../themes/IThemeProperties";
import { useDispatch, useSelector, useStore } from "react-redux";
import IdeWorkbench from "./IdeWorkbench";
import IdeStatusbar from "./IdeStatusbar";
import "./ide-message-processor";
import { ideLoadUiAction } from "../../shared/state/ide-loaded-reducer";
import { useState } from "react";
import { sideBarService } from "./side-bar/SideBarService";
import { SampleSideBarPanelDescriptor } from "./SampleSideBarPanel";
import { documentService } from "./document-area/DocumentService";
import SampleDocument, {
  SampleDocumentPanelDescriptor,
} from "./SampleDocument";

/**
 * Represents the emulator app's root component
 */
export default function IdeApp() {
  const [themeStyle, setThemeStyle] = useState({});
  const [themeClass, setThemeClass] = useState("");
  const store = useStore();
  const dispatch = useDispatch();

  // --- Keep track of theme changes
  let themeAware: StateAwareObject<string>;

  React.useEffect(() => {
    // --- Mount
    dispatch(ideLoadUiAction());
    updateThemeState();
    themeAware = new StateAwareObject(store, "theme");
    themeAware.stateChanged.on((theme) => {
      themeService.setTheme(theme);
      updateThemeState();
    });

    // --- Register side bar panels
    sideBarService.registerSideBarPanel(
      "debug-view",
      new SampleSideBarPanelDescriptor("GREEN", "green")
    );
    sideBarService.registerSideBarPanel(
      "debug-view",
      new SampleSideBarPanelDescriptor("RED", "red")
    );
    sideBarService.registerSideBarPanel(
      "debug-view",
      new SampleSideBarPanelDescriptor("BLUE", "blue")
    );

    // --- Register sample documents
    documentService.registerDocument(
      new SampleDocumentPanelDescriptor("Doc 1", "red")
    );
    documentService.registerDocument(
      new SampleDocumentPanelDescriptor("Memory", "green")
    );
    documentService.registerDocument(
      new SampleDocumentPanelDescriptor("Disassembly", "blue")
    );

    return () => {
      // --- Unmount
      dispatch(ideLoadUiAction());
    };
  }, [store]);

  const ideViewOptions = useSelector((s: AppState) => s.emuViewOptions);

  return (
    <div style={themeStyle} className={themeClass}>
      <IdeWorkbench />
      {ideViewOptions.showStatusBar && <IdeStatusbar></IdeStatusbar>}
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
