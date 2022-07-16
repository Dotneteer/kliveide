import * as React from "react";
import { CSSProperties, useState, useEffect, useRef } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import { getState, getStore, getThemeService } from "@core/service-registry";
import { AppState } from "@state/AppState";
import { toStyleString } from "../ide/utils/css-utils";
import { ModalDialog } from "@components/ModalDialog";
import { ActivityBar } from "./activity-bar/ActivityBar";
import { IdeStatusbar } from "./IdeStatusbar";
import { SideBar } from "./side-bar/SideBar";
import { IdeDocumentFrame } from "./document-area/IdeDocumentsFrame";
import { ToolFrame } from "./tool-area/ToolFrame";
import { Column, Fill, Row } from "@components/Panels";
import { SplitPanel } from "@components/SplitPanel";
import { IdeContextMenu } from "./context-menu/ContextMenu";
import "./ide-message-processor";
import { isDebuggableCompilerOutput } from "@abstractions/compiler-registry";
import { getEngineProxyService } from "@services/engine-proxy";
import { SourceCodeBreakpoint } from "@abstractions/code-runner-service";
import { navigateToDocumentPosition } from "./document-area/document-utils";

// --- Panel sizes
const MIN_SIDEBAR_WIDTH = 240;
const MIN_DESK_WIDTH = 380;
const MIN_DESK_HEIGHT = 200;
const MIN_TOOL_HEIGHT = 180;

/**
 * Represents the emulator app's root component.
 */
export const IdeApp: React.VFC = () => {
  // --- Let's use the store for dispatching actions
  const store = useStore();
  const dispatch = useDispatch();

  // --- Component state (changes of them triggers re-rendering)
  const [themeStyle, setThemeStyle] = useState<CSSProperties>({});
  const [themeClass, setThemeClass] = useState("");
  const ideLoaded = useSelector((s: AppState) => s.ideUiLoaded);
  const showStatusBar = useSelector(
    (s: AppState) => s.emuViewOptions.showStatusBar
  );
  const showSidebar = useSelector(
    (s: AppState) => s.emuViewOptions.showSidebar
  );
  const showToolFrame = useSelector((s: AppState) => s.toolFrame.visible);
  const showDocuments = useSelector(
    (s: AppState) => !s.toolFrame.visible || !s.toolFrame.maximized
  );
  const mounted = useRef(false);

  useEffect(() => {
    const themeService = getThemeService();
    // --- State change event handlers
    const isWindowsChanged = (isWindows: boolean) => {
      // --- Store the flag indication Windows OS
      themeService.isWindows = isWindows;
      updateThemeState();
    };
    const themeChanged = (theme: string) => {
      // --- Respond to theme changes
      themeService.setTheme(theme);
      updateThemeState();
    };
    const execStateChanged = async () => {
      // --- Respond to breaakpoint reached events
      const state = getState();

      // --- Do we have any breakpoints declared?
      const breakpoints = state?.debugger?.breakpoints ?? [];
      if (breakpoints.length == 0) {
        // --- No breakpoints to stop at        
        return;
      }

      // --- Obtain breakpoint information
      const compilationResult = state?.compilation?.result;
      const execState = state.emulatorPanel?.executionState ?? 0;
      if (
        execState !== 3 ||
        !compilationResult ||
        compilationResult.errors.length > 0
      ) {
        // --- Machine state changed without breakpoint information
        return;
      }
  
      if (!isDebuggableCompilerOutput(compilationResult)) {
        // --- We have a valid compiled code but no debug information is support
        return;
      }

      // --- Get the PC information
      const cpuState = await getEngineProxyService().getMachineState()
      const pc = (cpuState as any)._pc;

      // --- Dis we stop at a breakpoint?
      const brInfo = breakpoints.find(br => br.type === "source" && br.location == pc) as SourceCodeBreakpoint;
      if (brInfo) {
        // --- Yes, it is a breakpoint
        const projectRoot = getState().project.path;
        const resource = (projectRoot + brInfo.resource).replace(/\\/g, "/");
        navigateToDocumentPosition(resource, brInfo.line, 0);
        return;
      }

      // --- Do we have source code information?
      const sourceInfo = compilationResult.sourceMap[pc];
      if (!sourceInfo) {
        // --- No source information for PC
        return;
      }

      // --- Do we have file information?
      const fileInfo = compilationResult.sourceFileList[sourceInfo.fileIndex];
      if (fileInfo) {
        // --- Yes, navigate there
        navigateToDocumentPosition(fileInfo.filename, sourceInfo.line, 0);
      }
    }

    if (!mounted.current) {
      // --- Mount logic, executed only once during the app's life cycle
      mounted.current = true;
      updateThemeState();

      getStore().themeChanged.on(themeChanged);
      getStore().isWindowsChanged.on(isWindowsChanged);
      getStore().executionStateChanged.on(execStateChanged);

      // --- Set up activities
    }
    return () => {
      // --- Unsubscribe
      getStore().isWindowsChanged.off(isWindowsChanged);
      getStore().themeChanged.off(themeChanged);
      getStore().executionStateChanged.off(execStateChanged);
      mounted.current = false;
    };
  }, [store]);

  // --- Apply styles to body so that dialogs, context menus can use it, too.
  document.body.setAttribute("style", toStyleString(themeStyle));
  document.body.setAttribute("class", themeClass);

  return (
    <>
      {ideLoaded && (
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
      )}
    </>
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
};
