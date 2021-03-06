import * as React from "react";
import { StateAwareObject } from "../../shared/state/StateAwareObject";
import { AppState } from "../../shared/state/AppState";
import { themeService } from "../themes/theme-service";
import { useDispatch, useSelector, useStore } from "react-redux";
import IdeWorkbench from "./IdeWorkbench";
import IdeStatusbar from "./IdeStatusbar";
import "./ide-message-processor";
import { ideLoadUiAction } from "../../shared/state/ide-loaded-reducer";
import { CSSProperties, useState } from "react";
import { sideBarService } from "./side-bar/SideBarService";
import { documentService } from "./document-area/DocumentService";
import { SampleDocumentPanelDescriptor } from "./SampleDocument";
import ContextMenu from "./command/ContextMenu";
import { toolAreaService } from "./tool-area/ToolAreaService";
import { SampleToolPanelDescriptor } from "./SampleTool";
import { Activity } from "../../shared/activity/Activity";
import { ideStore } from "./ideStore";
import {
  changeActivityAction,
  setActivitiesAction,
} from "../../shared/state/activity-bar-reducer";
import { toStyleString } from "./utils/css-utils";
import ModalDialog from "../modals/ModalDialog";
import { Z80RegistersPanelDescriptor } from "./debug-tools/Z80RegistersPanel";
import { UlaInformationPanelDescriptor } from "../machines/spectrum/UlaInformationPanel";
import { OtherHardwareInfoPanelDescriptor } from "./debug-tools/OherHwPanel";
import { CallStackPanelDescriptor } from "./debug-tools/CallStackPanel";
import { Z80DisassemblyPanelDescriptor } from "./debug-tools/DisassemblyPanel";
import { OpenEditorsPanelDescriptor } from "./explorer-tools/OpenEditorsPanel";
import { ProjectFilesPanelDescriptor } from "./explorer-tools/ProjectFilesPanel";
import { IoLogsPanelDescription } from "./log-tools/IoLogsPanel";
import { TestRunnerPanelDescription } from "./test-tools/TestRunnerPanel";
import { BlinkInformationPanelDescriptor } from "../machines/cz88/BlinkInformationPanel";
import { OutputToolPanelDescriptor } from "./tool-area/OutputToolPanel";
import { InteractiveToolPanelDescriptor } from "./tool-area/InteractiveToolPanel";
import { outputPaneService } from "./tool-area/OutputPaneService";
import { VmOutputPanelDescriptor } from "../machines/VmOutputPane";
import { CompilerOutputPanelDescriptor } from "./tool-area/CompilerOutputPane";

/**
 * Represents the emulator app's root component
 */
export default function IdeApp() {
  const [themeStyle, setThemeStyle] = useState<CSSProperties>({});
  const [themeClass, setThemeClass] = useState("");
  const store = useStore();
  const dispatch = useDispatch();

  // --- Keep track of theme changes
  let themeAware: StateAwareObject<string>;
  let windowsAware: StateAwareObject<boolean>;

  React.useEffect(() => {
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
    toolAreaService.registerTool(new InteractiveToolPanelDescriptor());
    toolAreaService.registerTool(new OutputToolPanelDescriptor());
    outputPaneService.registerOutputPane(new VmOutputPanelDescriptor());
    outputPaneService.registerOutputPane(new CompilerOutputPanelDescriptor());

    ideStore.dispatch(changeActivityAction(0));

    return () => {
      // --- Unmount
      dispatch(ideLoadUiAction());
    };
  }, [store]);

  const ideViewOptions = useSelector((s: AppState) => s.emuViewOptions);

  // --- Apply styles to body so that dialogs, context menus can use it, too.
  document.body.setAttribute("style", toStyleString(themeStyle));
  document.body.setAttribute("class", themeClass);

  return (
    <div id="klive_ide_app" style={themeStyle} className={themeClass}>
      <IdeWorkbench />
      {ideViewOptions.showStatusBar && <IdeStatusbar></IdeStatusbar>}
      <ContextMenu target="#klive_ide_app" />
      <ModalDialog targetId="#app" />
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
}
