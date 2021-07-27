import * as React from "react";
import { CSSProperties, useRef, useState } from "react";
import { StateAwareObject } from "../../shared/state/StateAwareObject";
import { themeService } from "../themes/theme-service";
import { useDispatch, useSelector, useStore } from "react-redux";
import { ideLoadUiAction } from "../../shared/state/ide-loaded-reducer";
import { toStyleString } from "./utils/css-utils";
import {
  AppState,
  EmuViewOptions,
  ToolFrameState,
} from "../../shared/state/AppState";
import { useLayoutEffect } from "react";
import "./ide-message-processor";
import Splitter from "../common/Splitter";
import {
  ideToolFrameMaximizeAction,
  ideToolFrameShowAction,
} from "../../shared/state/tool-frame-reducer";
import { useEffect } from "react";

// --- App component literal constants
const WORKBENCH_ID = "ideWorkbench";
const STATUS_BAR_ID = "ideStatusBar";
const ACTIVITY_BAR_ID = "ideActivityBar";
const SIDEBAR_ID = "ideSidebar";
const MAIN_DESK_ID = "ideMainDesk";
const DOCUMENT_FRAME_ID = "ideDocumentFrame";
const TOOL_FRAME_ID = "ideToolFrame";
const SPLITTER_SIZE = 8;

/**
 * Represents the size of a panel
 */
type PanelDims = {
  width: number | string;
  height: number | string;
};

/**
 * Represents the emulator app's root component.
 */
export default function IdeApp() {
  // --- Let's use the store for dispatching actions
  const store = useStore();
  const dispatch = useDispatch();

  // --- Keep these references for later use
  const mounted = useRef(false);
  const firstRender = useRef(true);
  const lastDocumentFrameHeight = useRef(0);
  const lastToolFrameHeight = useRef(0);
  const restoreLayout = useRef(false);

  // --- Component state
  const [themeStyle, setThemeStyle] = useState<CSSProperties>({});
  const [themeClass, setThemeClass] = useState("");
  const [workbenchDims, setWorkbenchDims] = useState<PanelDims>({
    width: 0,
    height: 0,
  });
  const [sidebarWidth, setSidebarWidth] = useState(0);
  const [mainDeskLeft, setMainDeskLeft] = useState(0);
  const [mainDeskWidth, setMainDeskWidth] = useState(0);
  const [verticalSplitterPos, setVerticalSplitterPos] = useState(0);
  const [documentFrameHeight, setDocumentFrameHeight] = useState(200);
  const [toolFrameHeight, setToolFrameHeight] = useState(100);
  const [horizontalSplitterPos, setHorizontalSplitterPos] = useState(0);
  const [documentFrameVisible, setDocumentFrameVisible] = useState(true);
  const [toolFrameVisible, setToolFrameVisible] = useState(true);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;

      // --- Mount
      dispatch(ideLoadUiAction());
      updateThemeState();

      // --- Watch for theme changes
      const themeAware = new StateAwareObject<string>(store, "theme");
      themeAware.stateChanged.on((theme) => {
        themeService.setTheme(theme);
        updateThemeState();
      });

      const windowsAware = new StateAwareObject<boolean>(store, "isWindows");
      windowsAware.stateChanged.on((isWindows) => {
        themeService.isWindows = isWindows;
        updateThemeState();
      });

      const viewAware = new StateAwareObject<EmuViewOptions>(
        store,
        "emuViewOptions"
      );
      viewAware.stateChanged.on(() => {
        onResize();
      });

      const deskStatusAware = new StateAwareObject<ToolFrameState>(
        store,
        "toolFrame"
      );
      deskStatusAware.stateChanged.on((toolFrame) => {
        console.log("Visibility changed");
        setToolFrameVisible(toolFrame.visible);
        setDocumentFrameVisible(!toolFrame.maximized);
        if (toolFrame.visible && !toolFrame.maximized) {
          // --- Both frame's are displayed, let's restore their previous heights
          console.log("Restore");
          restoreLayout.current = true;
        }
      });

      // TODO: Other component registrations
    }

    return () => {
      // --- Unmount
      dispatch(ideLoadUiAction());
      mounted.current = false;
    };
  }, [store]);

  const ideViewOptions = useSelector((s: AppState) => s.emuViewOptions);

  // --- Apply styles to body so that dialogs, context menus can use it, too.
  document.body.setAttribute("style", toStyleString(themeStyle));
  document.body.setAttribute("class", themeClass);

  useLayoutEffect(() => {
    console.log("onLayout");
    const _onResize = () => onResize();
    window.addEventListener("resize", _onResize);
    onResize();
    return () => {
      window.removeEventListener("resize", _onResize);
    };
  }, [toolFrameVisible, documentFrameVisible]);

  // --- Set panel style and dimensions
  const workbenchStyle: CSSProperties = {
    width: workbenchDims.width,
    height: workbenchDims.height,
    backgroundColor: "green",
  };

  const sidebarStyle: CSSProperties = {
    display: "inline-block",
    height: "100%",
    width: sidebarWidth,
    backgroundColor: "gray",
  };

  const mainDeskStyle: CSSProperties = {
    display: "inline-block",
    height: "100%",
    width: mainDeskWidth,
    backgroundColor: "lightgray",
  };

  const documentFrameStyle: CSSProperties = {
    height: documentFrameHeight,
    width: mainDeskWidth,
    backgroundColor: "lightgreen",
  };

  const toolFrameStyle: CSSProperties = {
    height: toolFrameHeight,
    width: mainDeskWidth,
    backgroundColor: "yellow",
  };

  return (
    <div id="klive_ide_app" style={ideAppStyle}>
      <div id={WORKBENCH_ID} style={workbenchStyle}>
        <div id={ACTIVITY_BAR_ID} style={activityBarStyle} />
        <div id={SIDEBAR_ID} style={sidebarStyle} />
        <Splitter
          direction="vertical"
          size={SPLITTER_SIZE}
          position={verticalSplitterPos}
          length={workbenchDims.height}
        />
        <div id={MAIN_DESK_ID} style={mainDeskStyle}>
          {documentFrameVisible && (
            <div
              id={DOCUMENT_FRAME_ID}
              style={documentFrameStyle}
              onClick={() => {
                dispatch(ideToolFrameShowAction(!toolFrameVisible));
              }}
            />
          )}
          {documentFrameVisible && toolFrameVisible && (
            <Splitter
              direction="horizontal"
              size={SPLITTER_SIZE}
              position={horizontalSplitterPos}
              length={mainDeskWidth}
              shift={mainDeskLeft}
            />
          )}
          {toolFrameVisible && (
            <div
              id={TOOL_FRAME_ID}
              style={toolFrameStyle}
              onClick={() => {
                dispatch(ideToolFrameMaximizeAction(documentFrameVisible));
              }}
            />
          )}
        </div>
      </div>
      {ideViewOptions.showStatusBar && (
        <div id={STATUS_BAR_ID} style={statusBarStyle}></div>
      )}
    </div>
  );

  function updateThemeState(): void {
    const theme = themeService.getActiveTheme();
    if (!theme) {
      return;
    }
    setThemeStyle(themeService.getThemeStyle());
    setThemeClass(`app-container ${theme.name}-theme`);
  }

  function onResize(): void {
    // --- Calculate workbench dimensions
    const statusBarDiv = document.getElementById(STATUS_BAR_ID);
    const workbenchHeight = Math.floor(
      window.innerHeight - (statusBarDiv?.offsetHeight ?? 0)
    );
    setWorkbenchDims({
      width: window.innerWidth,
      height: workbenchHeight,
    });

    // --- Calculate sidebar and main desk dimensions
    const activityBarDiv = document.getElementById(ACTIVITY_BAR_ID);
    const newDeskWidth = window.innerWidth - activityBarDiv.offsetWidth;
    const sidebarDiv = document.getElementById(SIDEBAR_ID);
    const sidebarWidth = sidebarDiv.offsetWidth;
    let newSideBarWidth = firstRender.current
      ? newDeskWidth * 0.25
      : sidebarWidth > newDeskWidth
      ? 0.5 * sidebarWidth
      : sidebarWidth;
    setSidebarWidth(newSideBarWidth);
    setMainDeskLeft(activityBarDiv.offsetWidth + newSideBarWidth);
    const newMainDeskWidth = Math.round(newDeskWidth - newSideBarWidth - 0.5);
    setMainDeskWidth(newMainDeskWidth);

    // --- Put the vertical splitter between the side bar and the main desk
    setVerticalSplitterPos(
      activityBarDiv.offsetWidth + newSideBarWidth - SPLITTER_SIZE / 2
    );

    // --- Calculate document and tool panel sizes
    const docFrameDiv = document.getElementById(DOCUMENT_FRAME_ID);
    const docFrameHeight = docFrameDiv?.offsetHeight ?? 0;
    let newDocFrameHeight: number;
    if (restoreLayout.current) {
      // --- We need to restore the state of both panels
      console.log(
        lastDocumentFrameHeight.current,
        lastToolFrameHeight.current,
        workbenchHeight
      );
      newDocFrameHeight =
        (lastDocumentFrameHeight.current * workbenchHeight) /
        (lastDocumentFrameHeight.current + lastToolFrameHeight.current);
      console.log(`Restored doc height: ${newDocFrameHeight}`);
    } else {
      // --- Calculate the height of the panel the normal way
      newDocFrameHeight = toolFrameVisible
        ? firstRender.current
          ? workbenchHeight * 0.75
          : docFrameHeight > workbenchHeight
          ? 0.5 * workbenchHeight
          : docFrameHeight
        : workbenchHeight;
    }
    setDocumentFrameHeight(newDocFrameHeight);
    const newToolFrameHeight = Math.round(
      workbenchHeight - newDocFrameHeight - 0.5
    );
    setToolFrameHeight(newToolFrameHeight);

    // --- Put the horizontal splitter between the document frame and the tool frame
    setHorizontalSplitterPos(newDocFrameHeight - SPLITTER_SIZE / 2);

    // --- Save the layout temporarily
    if (documentFrameVisible && toolFrameVisible) {
      lastDocumentFrameHeight.current = newDocFrameHeight;
      lastToolFrameHeight.current = newToolFrameHeight;
      console.log(`Save: ${newDocFrameHeight}, ${newToolFrameHeight}`);
    }

    // --- Now, we're over the first render and the restore
    firstRender.current = false;
    restoreLayout.current = false;
  }
}

const ideAppStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  backgroundColor: "yellow",
  overflow: "hidden",
};

const statusBarStyle: CSSProperties = {
  height: 20,
  width: "100%",
  backgroundColor: "blue",
};

const activityBarStyle: CSSProperties = {
  display: "inline-block",
  height: "100%",
  width: 48,
  backgroundColor: "red",
};
