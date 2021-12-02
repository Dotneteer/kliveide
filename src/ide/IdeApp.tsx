import * as React from "react";
import { CSSProperties, useState, useEffect, useRef } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import { getStore, getThemeService } from "@core/service-registry";
import { ideLoadUiAction } from "@state/ide-loaded-reducer";
import { AppState } from "@state/AppState";
import { toStyleString } from "../ide/utils/css-utils";
import ModalDialog from "@components/ModalDialog";
import ActivityBar from "./activity-bar/ActivityBar";
import IdeStatusbar from "./IdeStatusbar";
import SideBar from "./side-bar/SideBar";
import IdeDocumentFrame from "./document-area/IdeDocumentsFrame";
import ToolFrame from "./tool-area/ToolFrame";
import "./ide-message-processor";
import { Column, Fill, Row } from "@components/Panels";
import { SplitPanel } from "@components/SplitPanel";
import IdeContextMenu from "./context-menu/ContextMenu";

// --- Panel sizes
const MIN_SIDEBAR_WIDTH = 240;
const MIN_DESK_WIDTH = 380;
const MIN_DESK_HEIGHT = 200;
const MIN_TOOL_HEIGHT = 180;

/**
 * Represents the emulator app's root component.
 */
export default function IdeApp() {
  // --- Let's use the store for dispatching actions
  const store = useStore();
  const dispatch = useDispatch();

  // --- Component state (changes of them triggers re-rendering)
  const [themeStyle, setThemeStyle] = useState<CSSProperties>({});
  const [themeClass, setThemeClass] = useState("");
  const showStatusBar = useSelector((s: AppState) => s.emuViewOptions.showStatusBar);
  const showSidebar = useSelector((s: AppState) => s.emuViewOptions.showSidebar);
  const showToolFrame = useSelector((s: AppState) => s.toolFrame.visible);
  const showDocuments = useSelector((s: AppState) => !s.toolFrame.visible || !s.toolFrame.maximized);
  const mounted = useRef(false);

  useEffect(() => {
    const themeService = getThemeService();
    // --- State change event handlers
    const isWindowsChanged = (isWindows: boolean) => {
      themeService.isWindows = isWindows;
      updateThemeState();
    };
    const themeChanged = (theme: string) => {
      themeService.setTheme(theme);
      updateThemeState();
    };

    if (!mounted.current) {
      // --- Mount logic, executed only once during the app's life cycle
      mounted.current = true;

      dispatch(ideLoadUiAction());
      updateThemeState();

      getStore().themeChanged.on(themeChanged);
      getStore().isWindowsChanged.on(isWindowsChanged);

      // --- Set up activities
    }
    return () => {
      // --- Unsubscribe
      getStore().isWindowsChanged.off(isWindowsChanged);
      getStore().themeChanged.off(themeChanged);
      mounted.current = false;
    };
  }, [store]);

  // --- Apply styles to body so that dialogs, context menus can use it, too.
  document.body.setAttribute("style", toStyleString(themeStyle));
  document.body.setAttribute("class", themeClass);

  // --- Display the status bar when it's visible

  return (
    <Fill id="klive_ide_app">
      <Row>
        <Column width={48}>
          <ActivityBar />
        </Column>
        <SplitPanel
          splitterSize={4}
          horizontal={true}
          panel1MinSize={MIN_SIDEBAR_WIDTH}
          panel2MinSize={MIN_DESK_WIDTH}
          initialSize={"20%"}
          panel1={<SideBar />}
          showPanel1={showSidebar}
          panel2={
            <SplitPanel
              splitterSize={4}
              horizontal={false}
              reverse={true}
              panel1MinSize={MIN_TOOL_HEIGHT}
              showPanel1={showToolFrame}
              panel1={<ToolFrame />}
              panel2MinSize={MIN_DESK_HEIGHT}
              showPanel2={showDocuments}
              panel2={<IdeDocumentFrame />}
              initialSize="33%"
            />
          }
        />
      </Row>
      <Row
        height="fittoclient"
        style={{ display: showStatusBar ? undefined : "none" }}
      >
        <IdeStatusbar />
      </Row>
      <IdeContextMenu target="#klive_ide_app" />
      <ModalDialog targetId="#app" />
    </Fill>
  );

  /**
   * Updates the current theme to dislay the app
   * @returns
   */
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
