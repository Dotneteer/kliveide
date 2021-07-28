import * as React from "react";
import { CSSProperties, useRef, useState } from "react";
import { StateAwareObject } from "../../shared/state/StateAwareObject";
import { themeService } from "../themes/theme-service";
import { useDispatch, useSelector, useStore } from "react-redux";
import { ideLoadUiAction } from "../../shared/state/ide-loaded-reducer";
import { toStyleString } from "../ide-new/utils/css-utils";
import {
  AppState,
  EmuViewOptions,
  ToolFrameState,
} from "../../shared/state/AppState";
import { useLayoutEffect } from "react";
import "../ide-new/ide-message-processor";
import Splitter from "../common/Splitter";
import {
  ideToolFrameMaximizeAction,
  ideToolFrameShowAction,
} from "../../shared/state/tool-frame-reducer";
import { useEffect } from "react";
import { Activity } from "../../shared/activity/Activity";
import { ideStore } from "./ideStore";
import { setActivitiesAction } from "../../shared/state/activity-bar-reducer";
import { sideBarService } from "./side-bar/SideBarService";
import { OpenEditorsPanelDescriptor } from "./explorer-tools/OpenEditorsPanel";
import { ProjectFilesPanelDescriptor } from "./explorer-tools/ProjectFilesPanel";
import { Z80RegistersPanelDescriptor } from "./debug-tools/Z80RegistersPanel";
import { UlaInformationPanelDescriptor } from "../machines/spectrum/UlaInformationPanel";
import { BlinkInformationPanelDescriptor } from "../machines/cz88/BlinkInformationPanel";
import { OtherHardwareInfoPanelDescriptor } from "./debug-tools/OherHwPanel";
import { CallStackPanelDescriptor } from "./debug-tools/CallStackPanel";
import { Z80DisassemblyPanelDescriptor } from "./debug-tools/DisassemblyPanel";
import { IoLogsPanelDescription } from "./log-tools/IoLogsPanel";
import { TestRunnerPanelDescription } from "./test-tools/TestRunnerPanel";
import { documentService } from "./document-area/DocumentService";
import { EditorDocumentPanelDescriptor } from "./editor/EditorDocument";
import { SampleDocumentPanelDescriptor } from "./SampleDocument";
import { toolAreaService } from "./tool-area/ToolAreaService";
import { InteractiveToolPanelDescriptor } from "./tool-area/InteractiveToolPanel";
import { OutputToolPanelDescriptor } from "./tool-area/OutputToolPanel";
import { outputPaneService } from "./tool-area/OutputPaneService";
import { VmOutputPanelDescriptor } from "../machines/VmOutputPane";
import { CompilerOutputPanelDescriptor } from "./tool-area/CompilerOutputPane";
import { TreeNode } from "../common/TreeNode";
import { ProjectNode } from "./explorer-tools/ProjectNode";
import { projectServices } from "./explorer-tools/ProjectServices";
import { TreeView } from "../common/TreeView";

// --- App component literal constants
const WORKBENCH_ID = "ideWorkbench";
const STATUS_BAR_ID = "ideStatusBar";
const ACTIVITY_BAR_ID = "ideActivityBar";
const SIDEBAR_ID = "ideSidebar";
const MAIN_DESK_ID = "ideMainDesk";
const DOCUMENT_FRAME_ID = "ideDocumentFrame";
const TOOL_FRAME_ID = "ideToolFrame";
const SPLITTER_SIZE = 4;

// --- Panel sizes
const MIN_SIDEBAR_WIDTH = 200;
const MIN_DESK_WIDTH = 300;
const MIN_DESK_HEIGHT = 100;

/**
 * Represents the size of a panel
 */
type PanelDims = {
  width: number;
  height: number;
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
  const splitterStartPosition = useRef(0);
  const activityBarWidth = useRef(0);
  const deskWidth = useRef(0);

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
        setToolFrameVisible(toolFrame.visible);
        setDocumentFrameVisible(!toolFrame.maximized);
        if (toolFrame.visible && !toolFrame.maximized) {
          // --- Both frame's are displayed, let's restore their previous heights
          restoreLayout.current = true;
        }
      });

      // --- Set up activities
      const activities: Activity[] = [
        {
          id: "file-view",
          title: "Explorer",
          iconName: "files",
          commands: [
            {
              id: "explorer-cmds",
              text: "",
              items: [
                {
                  id: "cmd-1",
                  text: "Command #1",
                },
                {
                  id: "cmd-2",
                  text: "Command #2",
                },
              ],
            },
          ],
        },
        {
          id: "debug-view",
          title: "Run and debug",
          iconName: "debug-alt",
          commands: [
            {
              id: "cmd-1",
              iconName: "play",
              text: "Command #1",
            },
            {
              id: "cmd-2",
              text: "Command #2",
            },
          ],
        },
        {
          id: "log-view",
          title: "Machine logs",
          iconName: "output",
        },
        {
          id: "test-view",
          title: "Testing",
          iconName: "beaker",
        },
        {
          id: "settings",
          title: "Manage",
          iconName: "settings-gear",
          isSystemActivity: true,
        },
      ];
      ideStore.dispatch(setActivitiesAction(activities));

      // --- Register side bar panels
      // (Explorer)
      sideBarService.registerSideBarPanel(
        "file-view",
        new OpenEditorsPanelDescriptor()
      );
      sideBarService.registerSideBarPanel(
        "file-view",
        new ProjectFilesPanelDescriptor()
      );

      // (Run and Debug)
      sideBarService.registerSideBarPanel(
        "debug-view",
        new Z80RegistersPanelDescriptor()
      );
      sideBarService.registerSideBarPanel(
        "debug-view",
        new UlaInformationPanelDescriptor(),
        ["sp48", "sp128"]
      );
      sideBarService.registerSideBarPanel(
        "debug-view",
        new BlinkInformationPanelDescriptor(),
        ["cz88"]
      );
      sideBarService.registerSideBarPanel(
        "debug-view",
        new OtherHardwareInfoPanelDescriptor()
      );
      sideBarService.registerSideBarPanel(
        "debug-view",
        new CallStackPanelDescriptor()
      );
      sideBarService.registerSideBarPanel(
        "debug-view",
        new Z80DisassemblyPanelDescriptor()
      );

      // (Machine logs)
      sideBarService.registerSideBarPanel(
        "log-view",
        new IoLogsPanelDescription()
      );

      // (Testing)
      sideBarService.registerSideBarPanel(
        "test-view",
        new TestRunnerPanelDescription()
      );

      // --- Register sample documents
      documentService.registerDocument(
        new EditorDocumentPanelDescriptor("1", "Doc 1")
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

      // --- Register tools
      toolAreaService.registerTool(new InteractiveToolPanelDescriptor());
      toolAreaService.registerTool(new OutputToolPanelDescriptor());
      outputPaneService.registerOutputPane(new VmOutputPanelDescriptor());
      outputPaneService.registerOutputPane(new CompilerOutputPanelDescriptor());

      // --- Register a simple project tree
      const root = new TreeNode<ProjectNode>({
        name: "SpectrumProject",
        isFolder: true,
      });
      const configFolder = new TreeNode<ProjectNode>({
        name: "config",
        isFolder: true,
      });
      root.appendChild(configFolder);

      const viewConfig = new TreeNode<ProjectNode>({
        name: "view.cfg",
        isFolder: false,
      });
      configFolder.appendChild(viewConfig);
      const memoryConfig = new TreeNode<ProjectNode>({
        name: "memory.cfg",
        isFolder: false,
      });
      configFolder.appendChild(memoryConfig);

      const codeFolder = new TreeNode<ProjectNode>({
        name: "code",
        isFolder: true,
      });
      root.appendChild(codeFolder);
      const z80File = new TreeNode<ProjectNode>({
        name: "code.z80.asm",
        isFolder: false,
      });
      codeFolder.appendChild(z80File);
      const zxbFile = new TreeNode<ProjectNode>({
        name: "code.zx.bas",
        isFolder: false,
      });
      codeFolder.appendChild(zxbFile);
      const projectTree = new TreeView(root);
      projectServices.setProjectTree(projectTree);
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
          onStartMove={() => startVerticalSplitter()}
          onMove={(delta) => moveVerticalSplitter(delta)}
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
              onStartMove={() => startHorizontalSplitter()}
              onMove={(delta) => moveHorizontalSplitter(delta)}
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
    activityBarWidth.current = activityBarDiv.offsetWidth;
    const newDeskWidth = window.innerWidth - activityBarDiv.offsetWidth;
    deskWidth.current = newDeskWidth;
    const sidebarDiv = document.getElementById(SIDEBAR_ID);
    const sidebarWidth = sidebarDiv.offsetWidth;
    let newSideBarWidth = firstRender.current
      ? newDeskWidth * 0.25
      : sidebarWidth;
    if (newDeskWidth - newSideBarWidth < MIN_DESK_WIDTH) {
      newSideBarWidth = newDeskWidth - MIN_DESK_WIDTH;
    }
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
      newDocFrameHeight =
        (lastDocumentFrameHeight.current * workbenchHeight) /
        (lastDocumentFrameHeight.current + lastToolFrameHeight.current);
    } else {
      // --- Calculate the height of the panel the normal way
      newDocFrameHeight = toolFrameVisible
        ? firstRender.current
          ? workbenchHeight * 0.75
          : docFrameHeight
        : workbenchHeight;
      if (
        toolFrameVisible &&
        workbenchHeight - newDocFrameHeight < MIN_DESK_HEIGHT
      ) {
        newDocFrameHeight = workbenchHeight - MIN_DESK_HEIGHT;
      }
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
    }

    // --- Now, we're over the first render and the restore
    firstRender.current = false;
    restoreLayout.current = false;
  }

  function startVerticalSplitter(): void {
    splitterStartPosition.current = sidebarWidth;
  }

  function moveVerticalSplitter(delta: number): void {
    let newSideBarWidth = Math.min(
      Math.max(
        Math.round(splitterStartPosition.current + delta - 0.5),
        MIN_SIDEBAR_WIDTH
      ),
      Math.round(workbenchDims.width - activityBarWidth.current - MIN_DESK_WIDTH)
    );

    setSidebarWidth(newSideBarWidth);
    setMainDeskLeft(activityBarWidth.current + newSideBarWidth);
    setMainDeskWidth(Math.round(deskWidth.current - newSideBarWidth - 0.5));
    setVerticalSplitterPos(
      activityBarWidth.current + newSideBarWidth - SPLITTER_SIZE / 2
    );
  }

  function startHorizontalSplitter(): void {
    splitterStartPosition.current = documentFrameHeight;
  }

  function moveHorizontalSplitter(delta: number): void {
    let newDocFrameHeight = Math.min(
      Math.max(
        Math.round(splitterStartPosition.current + delta - 0.5),
        MIN_DESK_HEIGHT
      ),
      Math.round(workbenchDims.height - MIN_DESK_HEIGHT)
    );

    setDocumentFrameHeight(newDocFrameHeight);
    lastDocumentFrameHeight.current = newDocFrameHeight;
    const newToolFrameHeight = Math.round(workbenchDims.height - newDocFrameHeight - 0.5);
    setToolFrameHeight(newToolFrameHeight);
    lastToolFrameHeight.current = newToolFrameHeight;
    setHorizontalSplitterPos(
      newDocFrameHeight - SPLITTER_SIZE / 2
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
