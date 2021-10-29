import * as React from "react";
import { CSSProperties, useState, useLayoutEffect, useEffect } from "react";
import { useDispatch, useStore } from "react-redux";

import {
  getDocumentService,
  getModalDialogService,
  getOutputPaneService,
  getSideBarService,
  getState,
  getStore,
  getThemeService,
  getToolAreaService,
} from "@core/service-registry";
import { ideLoadUiAction } from "@state/ide-loaded-reducer";
import { EmuViewOptions, ToolFrameState } from "@state/AppState";
import Splitter from "@components/Splitter";
import {
  changeActivityAction,
  setActivitiesAction,
} from "@state/activity-bar-reducer";
import { OpenEditorsPanelDescriptor } from "./explorer-tools/OpenEditorsPanel";
import { ProjectFilesPanelDescriptor } from "./explorer-tools/ProjectFilesPanel";
import { BlinkInformationPanelDescriptor } from "@modules/vm-z88/BlinkInformationPanel";
import { TestRunnerPanelDescription } from "./test-tools/TestRunnerPanel";
import { InteractiveToolPanelDescriptor } from "./tool-area/InteractiveToolPanel";
import { OutputToolPanelDescriptor } from "./tool-area/OutputToolPanel";
import { CompilerOutputPanelDescriptor } from "./tool-area/CompilerOutputPane";
import { toStyleString } from "../ide/utils/css-utils";
import IdeContextMenu from "./context-menu/ContextMenu";
import ModalDialog from "@components/ModalDialog";
import ActivityBar from "./activity-bar/ActivityBar";
import IdeStatusbar from "./IdeStatusbar";
import SideBar from "./side-bar/SideBar";
import IdeDocumentFrame from "./document-area/IdeDocumentsFrame";
import ToolFrame from "./tool-area/ToolFrame";
import "./ide-message-processor";
import { registerKliveCommands } from "./commands/register-commands";
import {
  newProjectDialog,
  NEW_PROJECT_DIALOG_ID,
} from "./explorer-tools/NewProjectDialog";
import {
  newFolderDialog,
  NEW_FOLDER_DIALOG_ID,
} from "./explorer-tools/NewFolderDialog";
import {
  newFileDialog,
  NEW_FILE_DIALOG_ID,
} from "./explorer-tools/NewFileDialog";
import {
  renameFileDialog,
  RENAME_FILE_DIALOG_ID,
} from "./explorer-tools/RenameFileDialog";
import {
  renameFolderDialog,
  RENAME_FOLDER_DIALOG_ID,
} from "./explorer-tools/RenameFolderDialog";
import { asmkZ80LanguageProvider as asmkZ80LanguageProvider } from "./languages/asm-z80-provider";
import { mpmZ80LanguageProvider } from "./languages/mpm-z80-provider";
import {
  Activity,
  ACTIVITY_DEBUG_ID,
  ACTIVITY_FILE_ID,
  ACTIVITY_LOG_ID,
  ACTIVITY_SETTINGS_ID,
  ACTIVITY_TEST_ID,
} from "@core/abstractions/activity";
import { UlaInformationPanelDescriptor } from "@modules/vm-zx-spectrum/UlaInformationPanel";
import { ZxSpectrum48CustomDisassembler } from "@modules/vm-zx-spectrum/ZxSpectrum48CustomDisassembler";
import { CambridgeZ88CustomDisassembler } from "@modules/vm-z88/CambridgeZ88CustomDisassembler";
import { Z80RegistersPanelDescriptor } from "@modules/cpu-z80/Z80RegistersPanel";
import { Z80DisassemblyPanelDescriptor } from "../modules/cpu-z80/Z80DisassemblyPanel";
import { MemoryPanelDescriptor } from "../modules/cpu-z80/Z80MemoryPanel";
import { CallStackPanelDescriptor } from "./side-bar/CallStackPanel";
import { BreakpointsPanelDescriptor } from "./side-bar/BreakpointsPanel";
import { IoLogsPanelDescription } from "./side-bar/IoLogsPanel";
import { virtualMachineToolsService } from "@modules-core/virtual-machine-tool";
import { VmOutputPanelDescriptor } from "./side-bar/VmOutputPane";

// --- App component literal constants
const WORKBENCH_ID = "ideWorkbench";
const STATUS_BAR_ID = "ideStatusBar";
const ACTIVITY_BAR_ID = "ideActivityBar";
const SIDEBAR_ID = "ideSidebar";
const MAIN_DESK_ID = "ideMainDesk";
const DOCUMENT_FRAME_ID = "ideDocumentFrame";
const TOOL_FRAME_ID = "ideToolFrame";
const VERTICAL_SPLITTER_ID = "ideVerticalSplitter";
const HORIZONTAL_SPLITTER_ID = "ideHorizontalSplitter";
const SPLITTER_SIZE = 4;

// --- Panel sizes
const MIN_SIDEBAR_WIDTH = 180;
const MIN_DESK_WIDTH = 380;
const MIN_DESK_HEIGHT = 100;
const MIN_TOOL_HEIGHT = 100;

// --- These variables keep the state of the IdeApp component outside
// --- of it (for performance reasins). It can be done, as IdeApp is a
// --- singleton component.
let mounted = false;
let firstRender = true;
let lastDocumentFrameHeight = 0;
let lastToolFrameHeight = 0;
let restoreLayout = false;
let workbenchWidth = 0;
let workbenchHeight = 0;
let splitterStartPosition = 0;
let activityBarWidth = 0;
let deskWidth = 0;
let sidebarWidth = 0;
let mainDeskLeft = 0;
let mainDeskWidth = 0;
let documentFrameHeight = 200;
let toolFrameHeight = 100;
let verticalSplitterPos = 0;
let horizontalSplitterPos = 0;
let showDocumentFrame = true;
let showToolFrame = true;

/**
 * Represents the emulator app's root component.
 *
 * Thic component has a single instance as is re-rendered infrequenctly.
 * Because of its singleton nature, a part of its state is kept in module-local
 * variables and not in React state. The component logic takes care of
 * updating the component state according to the module-local variables.
 *
 * Screen layout:
 *
 *             |--- Vertical splitter
 * ------------v---------------------------
 * | A |   S   || Document Frame          |
 * | c |   i   ||                         |
 * | t |   d   ||                         |
 * | i |   e   ||                         |
 * | v |   b   ||                         |
 * | i |   a   ||                         |
 * | t |   r   ||                         |
 * | i |       ||=========================|<--- Horizontal splitter
 * |   |       || Tool Frame              |
 * | B |       ||                         |
 * | a |       ||                         |
 * | r |       ||                         |
 * ----------------------------------------
 * | Status Bar                           |
 * ----------------------------------------
 *
 * Main desk: The panel with the Document Frame, Tool Frame, and the splitter
 * between them.
 * Workbench: The upper part of the screen without the Status Bar.
 *
 * For performance and UX reasons, this component implements its layout
 * management -- including resizing the panels -- with direct access to HTML
 * elements.
 */
export default function IdeApp() {
  // --- Let's use the store for dispatching actions
  const store = useStore();
  const dispatch = useDispatch();

  // --- Component state (changes of them triggers re-rendering)
  const [themeStyle, setThemeStyle] = useState<CSSProperties>({});
  const [themeClass, setThemeClass] = useState("");
  const [documentFrameVisible, setDocumentFrameVisible] = useState(true);
  const [toolFrameVisible, setToolFrameVisible] = useState(true);
  const [showStatusBar, setShowStatusBar] = useState(
    getState()?.emuViewOptions?.showStatusBar ?? false
  );

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
    const viewOptionsChanged = (viewOptions: EmuViewOptions) => {
      setShowStatusBar(viewOptions.showStatusBar);
      onResize();
    };
    const toolFrameChanged = (toolFrame: ToolFrameState) => {
      showToolFrame = toolFrame.visible;
      setToolFrameVisible(showToolFrame);
      showDocumentFrame = !toolFrame.maximized;
      setDocumentFrameVisible(showDocumentFrame);
    };

    if (!mounted) {
      // --- Mount logic, executed only once during the app's life cycle
      mounted = true;

      dispatch(ideLoadUiAction());
      updateThemeState();

      getStore().themeChanged.on(themeChanged);
      getStore().isWindowsChanged.on(isWindowsChanged);
      getStore().emuViewOptionsChanged.on(viewOptionsChanged);
      getStore().toolFrameChanged.on(toolFrameChanged);

      // --- Set up activities
      const activities: Activity[] = [
        {
          id: ACTIVITY_FILE_ID,
          title: "Explorer",
          iconName: "files",
        },
        {
          id: ACTIVITY_DEBUG_ID,
          title: "Debug",
          iconName: "debug-alt",
          commands: [
            {
              commandId: "klive.debugVm",
            },
            {
              commandId: "klive.pauseVm",
            },
            {
              commandId: "klive.stopVm",
            },
            {
              commandId: "klive.stepIntoVm",
            },
            {
              commandId: "klive.stepOverVm",
            },
            {
              commandId: "klive.stepOutVm",
            },
          ],
        },
        {
          id: ACTIVITY_LOG_ID,
          title: "Machine logs",
          iconName: "output",
        },
        {
          id: ACTIVITY_TEST_ID,
          title: "Testing",
          iconName: "beaker",
        },
        {
          id: ACTIVITY_SETTINGS_ID,
          title: "Manage",
          iconName: "settings-gear",
          isSystemActivity: true,
        },
      ];
      store.dispatch(setActivitiesAction(activities));

      // --- Register side bar panels
      const sideBarService = getSideBarService();

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
        new Z80DisassemblyPanelDescriptor()
      );
      sideBarService.registerSideBarPanel(
        "debug-view",
        new MemoryPanelDescriptor()
      );
      sideBarService.registerSideBarPanel(
        "debug-view",
        new CallStackPanelDescriptor()
      );
      sideBarService.registerSideBarPanel(
        "debug-view",
        new BreakpointsPanelDescriptor()
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

      // --- Register tool panels
      const toolAreaService = getToolAreaService();
      toolAreaService.registerTool(new OutputToolPanelDescriptor(), false);
      const outputPaneService = getOutputPaneService();
      outputPaneService.registerOutputPane(new VmOutputPanelDescriptor());
      outputPaneService.registerOutputPane(new CompilerOutputPanelDescriptor());
      toolAreaService.registerTool(new InteractiveToolPanelDescriptor(), true);

      // --- Register custom languages
      const documentService = getDocumentService();
      documentService.registerCustomLanguage(asmkZ80LanguageProvider);
      documentService.registerCustomLanguage(mpmZ80LanguageProvider);

      // --- Register document panels and editors
      documentService.registerCodeEditor(".project", {
        language: "json",
      });
      documentService.registerCodeEditor(".asm.kz80", {
        language: "asm-kz80",
        allowBuildRoot: true,
      });
      documentService.registerCodeEditor(".mpm.z80", {
        language: "mpm-z80",
      });

      // --- Register virtual machine tools
      virtualMachineToolsService.registerTools(
        "sp48",
        new ZxSpectrum48CustomDisassembler()
      );
      virtualMachineToolsService.registerTools(
        "cz88",
        new CambridgeZ88CustomDisassembler()
      );

      // --- Register modal dialogs
      const modalDialogService = getModalDialogService();
      modalDialogService.registerModalDescriptor(
        NEW_PROJECT_DIALOG_ID,
        newProjectDialog
      );
      modalDialogService.registerModalDescriptor(
        NEW_FOLDER_DIALOG_ID,
        newFolderDialog
      );
      modalDialogService.registerModalDescriptor(
        NEW_FILE_DIALOG_ID,
        newFileDialog
      );
      modalDialogService.registerModalDescriptor(
        RENAME_FILE_DIALOG_ID,
        renameFileDialog
      );
      modalDialogService.registerModalDescriptor(
        RENAME_FOLDER_DIALOG_ID,
        renameFolderDialog
      );

      // --- Register available commands
      registerKliveCommands();

      // --- Select the file-view activity
      dispatch(changeActivityAction(0));
    }
    return () => {
      // --- Unsubscribe
      getStore().toolFrameChanged.off(toolFrameChanged);
      getStore().emuViewOptionsChanged.off(viewOptionsChanged);
      getStore().isWindowsChanged.off(isWindowsChanged);
      getStore().themeChanged.off(themeChanged);
    };
  }, [store]);

  // --- Apply styles to body so that dialogs, context menus can use it, too.
  document.body.setAttribute("style", toStyleString(themeStyle));
  document.body.setAttribute("class", themeClass);

  // --- Take care of resizing IdeApp whenever the window size changes
  useLayoutEffect(() => {
    const _onResize = async () => onResize();
    window.addEventListener("resize", _onResize);

    // --- Recognize when both Frames are visible so that their dimensions
    // --- can be restored
    if (!firstRender && showToolFrame && showDocumentFrame) {
      restoreLayout = true;
    }
    onResize();
    return () => {
      window.removeEventListener("resize", _onResize);
    };
  }, [documentFrameVisible, toolFrameVisible]);

  // --- Display the status bar when it's visible
  //const ideViewOptions = useSelector((s: AppState) => s.emuViewOptions);
  const statusBarStyle: CSSProperties = {
    height: showStatusBar ? 28 : 0,
    width: "100%",
    backgroundColor: "blue",
  };

  return (
    <div id="klive_ide_app" style={ideAppStyle}>
      <div id={WORKBENCH_ID} style={workbenchStyle}>
        <div id={ACTIVITY_BAR_ID} style={activityBarStyle}>
          <ActivityBar />
        </div>
        <div id={SIDEBAR_ID} style={sidebarStyle}>
          <SideBar />
        </div>
        <Splitter
          id={VERTICAL_SPLITTER_ID}
          direction="vertical"
          size={SPLITTER_SIZE}
          position={verticalSplitterPos}
          length={workbenchHeight}
          onStartMove={() => startVerticalSplitter()}
          onMove={(delta) => moveVerticalSplitter(delta)}
        />
        <div id={MAIN_DESK_ID} style={mainDeskStyle}>
          {showDocumentFrame && (
            <div id={DOCUMENT_FRAME_ID} style={documentFrameStyle}>
              <IdeDocumentFrame />
            </div>
          )}
          {showDocumentFrame && showToolFrame && (
            <Splitter
              id={HORIZONTAL_SPLITTER_ID}
              direction="horizontal"
              size={SPLITTER_SIZE}
              position={horizontalSplitterPos}
              length={mainDeskWidth}
              shift={mainDeskLeft}
              onStartMove={() => startHorizontalSplitter()}
              onMove={(delta) => moveHorizontalSplitter(delta)}
            />
          )}
          {showToolFrame && (
            <div id={TOOL_FRAME_ID} style={toolFrameStyle}>
              <ToolFrame />
            </div>
          )}
        </div>
      </div>
      <div id={STATUS_BAR_ID} style={statusBarStyle}>
        <IdeStatusbar />
      </div>
      <IdeContextMenu target="#klive_ide_app" />
      <ModalDialog targetId="#app" />
    </div>
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

  /**
   * Recalculate the IdeApp layout
   */
  function onResize(): void {
    // --- Calculate workbench dimensions
    const statusBarDiv = document.getElementById(STATUS_BAR_ID);
    workbenchWidth = window.innerWidth;
    workbenchHeight = Math.floor(
      window.innerHeight - (statusBarDiv?.offsetHeight ?? 0)
    );
    const workBenchDiv = document.getElementById(WORKBENCH_ID);
    workBenchDiv.style.width = `${workbenchWidth}px`;
    workBenchDiv.style.height = `${workbenchHeight}px`;

    // --- Calculate sidebar and main desk dimensions
    const activityBarDiv = document.getElementById(ACTIVITY_BAR_ID);
    const sidebarDiv = document.getElementById(SIDEBAR_ID);
    activityBarWidth = activityBarDiv.offsetWidth;
    const newDeskWidth = window.innerWidth - activityBarDiv.offsetWidth;
    deskWidth = newDeskWidth;
    let newSideBarWidth = firstRender
      ? newDeskWidth * 0.25
      : sidebarDiv.offsetWidth;
    if (newSideBarWidth < MIN_SIDEBAR_WIDTH) {
      newSideBarWidth = MIN_SIDEBAR_WIDTH;
    }
    if (newDeskWidth - newSideBarWidth < MIN_DESK_WIDTH) {
      newSideBarWidth = newDeskWidth - MIN_DESK_WIDTH;
    }
    setSidebarAndDesk(newSideBarWidth);

    // --- Calculate document and tool panel sizes
    const docFrameDiv = document.getElementById(DOCUMENT_FRAME_ID);
    const docFrameHeight = docFrameDiv?.offsetHeight ?? 0;
    if (restoreLayout) {
      // --- We need to restore the state of both panels
      documentFrameHeight =
        (lastDocumentFrameHeight * workbenchHeight) /
        (lastDocumentFrameHeight + lastToolFrameHeight);
    } else {
      // --- Calculate the height of the panel the normal way
      documentFrameHeight = showDocumentFrame
        ? showToolFrame
          ? firstRender
            ? workbenchHeight * 0.75
            : docFrameHeight
          : workbenchHeight
        : 0;
      if (
        showToolFrame &&
        workbenchHeight - documentFrameHeight < MIN_DESK_HEIGHT
      ) {
        documentFrameHeight = workbenchHeight - MIN_DESK_HEIGHT;
      }
    }

    // --- Set the Document Frame height
    const documentFrameDiv = document.getElementById(DOCUMENT_FRAME_ID);
    if (documentFrameDiv) {
      documentFrameDiv.style.height = `${documentFrameHeight}px`;
      documentFrameDiv.style.width = `${mainDeskWidth}px`;
    }

    // --- Set the Tool Frame height
    const toolFrameDiv = document.getElementById(TOOL_FRAME_ID);
    toolFrameHeight = Math.round(workbenchHeight - documentFrameHeight);
    toolFrameHeight = toolFrameHeight;
    if (toolFrameDiv) {
      toolFrameDiv.style.height = `${toolFrameHeight}px`;
    }

    // --- Put the horizontal splitter between the document frame and the tool frame
    const horizontalSplitterDiv = document.getElementById(
      HORIZONTAL_SPLITTER_ID
    );
    if (horizontalSplitterDiv) {
      horizontalSplitterPos = documentFrameHeight - SPLITTER_SIZE / 2;
      horizontalSplitterDiv.style.top = `${horizontalSplitterPos}px`;
    }

    // --- Save the layout temporarily
    if (showDocumentFrame && showToolFrame) {
      lastDocumentFrameHeight = documentFrameHeight;
      lastToolFrameHeight = toolFrameHeight;
    }

    // --- Now, we're over the first render and the restore
    firstRender = false;
    restoreLayout = false;
  }

  /**
   * Recalculate the dimensions of the workbench whenever the size of
   * the Sidebar changes
   * @param newSidebarWidth Width of the side bar
   */
  function setSidebarAndDesk(newSidebarWidth: number): void {
    // --- Get element to calculate from
    const activityBarDiv = document.getElementById(ACTIVITY_BAR_ID);
    const sidebarDiv = document.getElementById(SIDEBAR_ID);
    const documentFrameDiv = document.getElementById(DOCUMENT_FRAME_ID);
    const toolFrameDiv = document.getElementById(TOOL_FRAME_ID);
    const verticalSplitterDiv = document.getElementById(VERTICAL_SPLITTER_ID);
    const horizontalSplitterDiv = document.getElementById(
      HORIZONTAL_SPLITTER_ID
    );

    // --- Set sidebar dimesions
    sidebarWidth = newSidebarWidth;
    sidebarDiv.style.width = `${newSidebarWidth}px`;

    // --- Set main desk dimensions
    const mainDeskDiv = document.getElementById(MAIN_DESK_ID);
    mainDeskLeft = activityBarDiv.offsetWidth + newSidebarWidth;
    mainDeskDiv.style.left = `${mainDeskLeft}px`;
    const newMainDeskWidth = Math.round(deskWidth - newSidebarWidth);
    mainDeskWidth = newMainDeskWidth;
    mainDeskDiv.style.width = `${newMainDeskWidth}px`;

    // --- Calculate document and tool panel width
    if (documentFrameDiv) {
      documentFrameDiv.style.width = `${newMainDeskWidth}px`;
    }
    if (toolFrameDiv) {
      toolFrameDiv.style.width = `${newMainDeskWidth}px`;
    }

    // --- Put the vertical splitter between the side bar and the main desk
    verticalSplitterPos =
      activityBarDiv.offsetWidth + newSidebarWidth - SPLITTER_SIZE / 2;
    verticalSplitterDiv.style.left = `${verticalSplitterPos}px`;
    verticalSplitterDiv.style.height = `${workbenchHeight}px`;

    // --- Update the horizontal splitter's position
    if (horizontalSplitterDiv) {
      horizontalSplitterDiv.style.left = `${
        activityBarDiv.offsetWidth + newSidebarWidth
      }px`;
      horizontalSplitterDiv.style.width = `${newMainDeskWidth}px`;
    }
  }

  /**
   * Make a note of the vertical splitter position when start moving it
   */
  function startVerticalSplitter(): void {
    splitterStartPosition = sidebarWidth;
  }

  /**
   * Resize the workbench when moving the vertical splitter
   * @param delta Movement delta value
   */
  function moveVerticalSplitter(delta: number): void {
    let newSideBarWidth = Math.min(
      Math.max(Math.round(splitterStartPosition + delta), MIN_SIDEBAR_WIDTH),
      Math.round(workbenchWidth - activityBarWidth - MIN_DESK_WIDTH)
    );
    setSidebarAndDesk(newSideBarWidth);
  }

  /**
   * Make a note of the horizontal splitter position when start moving it
   */
  function startHorizontalSplitter(): void {
    splitterStartPosition = documentFrameHeight;
  }

  /**
   * Resize the workbench when moving the horizontal splitter
   * @param delta Movement delta value
   */
  function moveHorizontalSplitter(delta: number): void {
    documentFrameHeight = Math.min(
      Math.max(Math.round(splitterStartPosition + delta), MIN_DESK_HEIGHT),
      Math.round(workbenchHeight - MIN_DESK_HEIGHT)
    );

    // --- New Document Frame height
    const documentFrameDiv = document.getElementById(DOCUMENT_FRAME_ID);
    if (documentFrameDiv) {
      documentFrameDiv.style.height = `${documentFrameHeight}px`;
    }
    lastDocumentFrameHeight = documentFrameHeight;

    // --- New Tool Frame height
    const toolFrameDiv = document.getElementById(TOOL_FRAME_ID);
    toolFrameHeight = Math.round(workbenchHeight - documentFrameHeight);
    if (toolFrameDiv) {
      toolFrameDiv.style.height = `${toolFrameHeight}px`;
    }
    lastToolFrameHeight = toolFrameHeight;

    // --- Put the horizontal splitter between the document frame and the tool frame
    const horizontalSplitterDiv = document.getElementById(
      HORIZONTAL_SPLITTER_ID
    );
    if (horizontalSplitterDiv) {
      horizontalSplitterPos = documentFrameHeight - SPLITTER_SIZE / 2;
      horizontalSplitterDiv.style.top = `${horizontalSplitterPos}px`;
    }

    // --- Save the heights
    lastDocumentFrameHeight = documentFrameHeight;
    lastToolFrameHeight = toolFrameHeight;
  }
}

// ============================================================================
// Style constants
const ideAppStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  overflow: "hidden",
};

const activityBarStyle: CSSProperties = {
  display: "inline-block",
  height: "100%",
  width: 48,
  verticalAlign: "top",
  overflow: "hidden",
};

const workbenchStyle: CSSProperties = {
  width: workbenchWidth,
  height: workbenchHeight,
};

const sidebarStyle: CSSProperties = {
  display: "inline-block",
  height: "100%",
  width: sidebarWidth,
  verticalAlign: "top",
  overflow: "hidden",
};

const mainDeskStyle: CSSProperties = {
  display: "inline-block",
  height: "100%",
  width: mainDeskWidth,
};

const documentFrameStyle: CSSProperties = {
  display: "flex",
  flexGrow: 0,
  flexShrink: 0,
  height: documentFrameHeight,
  width: mainDeskWidth,
};

const toolFrameStyle: CSSProperties = {
  display: "flex",
  flexGrow: 0,
  flexShrink: 0,
  height: toolFrameHeight,
  width: mainDeskWidth,
};
