import * as React from "react";
import { CSSProperties, useRef, useState } from "react";
import { StateAwareObject } from "../../shared/state/StateAwareObject";
import { themeService } from "../themes/theme-service";
import { useDispatch, useSelector, useStore } from "react-redux";
import { ideLoadUiAction } from "../../shared/state/ide-loaded-reducer";
import { toStyleString } from "./utils/css-utils";
import { AppState } from "../../shared/state/AppState";
import { useLayoutEffect } from "react";
import "./ide-message-processor";
import VerticalSplitter from "../common/VerticalSplitter";

const WORKBENCH_ID = "ideWorkbench";
const STATUS_BAR_ID = "ideStatusBar";
const ACTIVITY_BAR_ID = "ideActivityBar";
const SIDEBAR_ID = "ideSidebar";
const MAIN_DESK_ID = "ideMainDesk";
const SPLITTER_SIZE = 8;

/**
 * Represents the size of a panel
 */
type PanelDims = {
  width: number | string;
  height: number | string;
};

/**
 * Represents the emulator app's root component
 */
export default function IdeApp() {
  const store = useStore();
  const dispatch = useDispatch();

  const mounted = useRef(false);
  const firstRender = useRef(true);

  const [themeStyle, setThemeStyle] = useState<CSSProperties>({});
  const [themeClass, setThemeClass] = useState("");
  const [workbenchDims, setWorkbenchDims] = useState<PanelDims>({
    width: 0,
    height: 0,
  });
  const [sidebarWidth, setSidebarWidth] = useState(0);
  const [mainDeskWidth, setMainDeskWidth] = useState(0);
  const [vertSplitterPos, setVertSplitterPos] = useState<number>();

  // --- Keep track of theme changes
  let themeAware: StateAwareObject<string>;
  let windowsAware: StateAwareObject<boolean>;

  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;

      // --- Mount
      dispatch(ideLoadUiAction());
      updateThemeState();

      // --- Watch for theme changes
      themeAware = new StateAwareObject(store, "theme");
      themeAware.stateChanged.on((theme) => {
        themeService.setTheme(theme);
        updateThemeState();
      });

      windowsAware = new StateAwareObject(store, "isWindows");
      windowsAware.stateChanged.on((isWindows) => {
        themeService.isWindows = isWindows;
        updateThemeState();
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
      console.log("offLayout");
    };
  }, []);

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

  const vertSpliterStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: vertSplitterPos,
    height: workbenchDims.height,
    width: 8,
    backgroundColor: "blue",
    opacity: 0.5,
  };

  return (
    <div id="klive_ide_app" style={ideAppStyle}>
      <div id={WORKBENCH_ID} style={workbenchStyle}>
        <div id={ACTIVITY_BAR_ID} style={activityBarStyle} />
        <div id={SIDEBAR_ID} style={sidebarStyle} />
        <VerticalSplitter
          size={SPLITTER_SIZE}
          position={vertSplitterPos}
          height={workbenchDims.height}
        />
        <div id={MAIN_DESK_ID} style={mainDeskStyle} />
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
    const newAppHeight = Math.floor(
      window.innerHeight - statusBarDiv.offsetHeight
    );
    setWorkbenchDims({
      width: window.innerWidth,
      height: newAppHeight,
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
    firstRender.current = false;
    setSidebarWidth(newSideBarWidth);
    console.log(sidebarWidth, newSideBarWidth);
    const newMainDeskWidth = Math.round(newDeskWidth - newSideBarWidth - 0.5);
    setMainDeskWidth(newMainDeskWidth);

    // --- Put the vertical splitter between the side bar and the main desk
    setVertSplitterPos(
      activityBarDiv.offsetWidth + newSideBarWidth - SPLITTER_SIZE / 2
    );
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
