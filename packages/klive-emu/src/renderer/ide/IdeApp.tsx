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
import { SampleDocumentPanelDescriptor } from "./SampleDocument";
import ContextMenu from "./command/ContextMenu";
import { toolAreaService } from "./tool-area/ToolAreaService";
import { SampleToolPanelDescriptor } from "./SampleTool";

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
      new SampleDocumentPanelDescriptor("1", "Doc 1", "red")
    );
    documentService.registerDocument(
      new SampleDocumentPanelDescriptor("2", "Memory", "green")
    );
    documentService.registerDocument(
      new SampleDocumentPanelDescriptor("3", "Disassembly", "blue")
    );
    documentService.registerDocument(
      new SampleDocumentPanelDescriptor("4", "Long Document #1", "blue")
    );
    documentService.registerDocument(
      new SampleDocumentPanelDescriptor("5", "Long Document #2", "blue")
    );
    documentService.registerDocument(
      new SampleDocumentPanelDescriptor("6", "Long Document #3", "blue")
    );
    documentService.registerDocument(
      new SampleDocumentPanelDescriptor("7", "Long Document #4", "blue")
    );

    // --- Register sample tools
    toolAreaService.registerTool(
      new SampleToolPanelDescriptor("1", "Interactive", "red")
    );
    toolAreaService.registerTool(
      new SampleToolPanelDescriptor("2", "Output", "green")
    );

    return () => {
      // --- Unmount
      dispatch(ideLoadUiAction());
    };
  }, [store]);

  const ideViewOptions = useSelector((s: AppState) => s.emuViewOptions);
  const themeStyleJson = JSON.stringify(themeStyle)
    .replace(/\"/g, "")
    .replace(/,/g, ";");
  const themeStyleStr = themeStyleJson.substr(1, themeStyleJson.length - 2);
  document.body.setAttribute("style", themeStyleStr);
  document.body.setAttribute("class", themeClass);

  return (
    <div id="klive_ide_app" className={themeClass}>
      <IdeWorkbench />
      {ideViewOptions.showStatusBar && <IdeStatusbar></IdeStatusbar>}
      <ContextMenu target="#klive_ide_app" />
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
