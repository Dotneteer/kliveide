import { MachineControllerState } from "@abstractions/MachineControllerState";
import { getGlobalSetting, useGlobalSetting, useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { useEffect, useRef } from "react";
import { useAppServices } from "./services/AppServicesProvider";
import { saveProject } from "./utils/save-project";
import { BUILD_FILE } from "@common/structs/project-const";
import { incBuildFileVersionAction, workspaceLoadedAction } from "@common/state/actions";
import { useEmuApi } from "@renderer/core/EmuApi";
import { delay } from "@renderer/utils/timing";
import { useMainApi } from "@renderer/core/MainApi";
import {
  SETTING_IDE_MAXIMIZE_TOOLS,
  SETTING_IDE_SHOW_SIDEBAR,
  SETTING_IDE_SIDEBAR_WIDTH,
  SETTING_IDE_SYNC_BREAKPOINTS,
  SETTING_IDE_TOOLPANEL_HEIGHT
} from "@common/settings/setting-const";
import { IProjectService } from "@renderer/abstractions/IProjectService";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { isDebuggableCompilerOutput } from "./utils/compiler-utils";
import { restoreLastOpenDocuments } from "./restoreLastOpenDocuments";

export const TOOL_PANEL_HEIGHT = "toolPanelHeight";

/**
 * This component represents an event handler to manage the global IDE events
 */
export const IdeEventsHandler = () => {
  const { store, messenger } = useRendererContext();
  const { ideCommandsService, projectService } = useAppServices();
  const emuApi = useEmuApi();
  const mainApi = useMainApi();

  const project = useSelector((s) => s.project);
  const compilation = useSelector((s) => s.compilation);
  const execState = useSelector((s) => s.emulatorState?.machineState);
  const breakpointsVersion = useSelector((s) => s.emulatorState?.breakpointsVersion);
  const syncBps = useGlobalSetting(SETTING_IDE_SYNC_BREAKPOINTS);
  const buildFilePath = useRef<string>(null);

  // --- Refresh the code location whenever the machine is paused
  useEffect(() => {
    (async () => {
      if (execState === MachineControllerState.Paused) {
        await refreshCodeLocation();
      }
    })();
  }, [execState]);

  // --- Save any breakpoint changes to the project file
  useEffect(() => {
    (async () => {
      await saveProject(messenger, 0);
    })();
  }, [breakpointsVersion]);

  // --- Respond to project changes
  useEffect(() => {
    if (project.isKliveProject && project.hasBuildFile) {
      buildFilePath.current = `${project.folderPath}/${BUILD_FILE}`;
    } else {
      buildFilePath.current = null;
    }
  }, [project]);

  // --- Get notifications about saved files
  useEffect(() => {
    const onFileSaved = ({ file }) => {
      if (file === buildFilePath.current) {
        store.dispatch(incBuildFileVersionAction(), "ide");
      }
    };

    const onProjectLoaded = async () => {
      const state = store.getState();

      // --- Store current view options to set them later
      const maximizeToolPanels = getGlobalSetting(store, SETTING_IDE_MAXIMIZE_TOOLS);
      await mainApi.setGlobalSettingsValue(SETTING_IDE_SHOW_SIDEBAR, true);
      await mainApi.setGlobalSettingsValue(SETTING_IDE_MAXIMIZE_TOOLS, false);

      // --- Wait while the project is loaded
      await ensureProjectLoaded(projectService);

      // --- Restore document tabs and activate only the last active document
      await restoreLastOpenDocuments(projectService, store);
      const sideBarWidth = getGlobalSetting(store, SETTING_IDE_SIDEBAR_WIDTH);
      const toolPanelHeight = getGlobalSetting(store, SETTING_IDE_TOOLPANEL_HEIGHT);

      // --- Adjust the size of IDE splitters
      if (sideBarWidth) {
        await mainApi.setGlobalSettingsValue(SETTING_IDE_SIDEBAR_WIDTH, sideBarWidth);
      }
      if (toolPanelHeight) {
        await mainApi.setGlobalSettingsValue(SETTING_IDE_TOOLPANEL_HEIGHT, toolPanelHeight);
      }
      if (maximizeToolPanels) {
        await mainApi.setGlobalSettingsValue(SETTING_IDE_MAXIMIZE_TOOLS, true);
      }

      store.dispatch(workspaceLoadedAction(), "ide");
    };

    projectService.fileSaved.on(onFileSaved);
    projectService.projectOpened.on(onProjectLoaded);
    return () => {
      projectService.fileSaved.off(onFileSaved);
      projectService.projectOpened.off(onProjectLoaded);
    };
  }, [projectService]);

  // --- Do not render any visual elements
  return null;

  // --- Navigates to the current execution point location
  async function refreshCodeLocation(): Promise<void> {
    // --- No compilation, no code breakpoint to navigate to
    if (
      !syncBps ||
      execState !== MachineControllerState.Paused ||
      !compilation.result ||
      compilation.failed ||
      compilation.result.errors.length > 0 ||
      !isDebuggableCompilerOutput(compilation.result)
    ) {
      return;
    }

    // --- Get the available breakpoints
    const cpuResponse = await emuApi.getCpuState();
    // --- Check if there is a location for PC
    const fileLine = compilation.result.sourceMap[cpuResponse.pc];
    if (!fileLine) return;

    const fullFile = compilation.result.sourceFileList[fileLine.fileIndex]?.filename;
    if (!fullFile) return;

    await ideCommandsService.executeCommand(`nav "${fullFile}" ${fileLine.line}`);
  }
};

export async function ensureProjectLoaded(projectService: IProjectService) {
  // --- Wait up to 10 seconds for the project tree to be loaded
  let count = 0;

  while (count < 100) {
    const tree = projectService.getProjectTree();
    if (tree) break;
    count++;
    await delay(100);
  }
  if (count >= 100) {
    console.error("Timeout while loading the project tree");
    return;
  }
}

export async function ensureWorkspaceLoaded(store: Store<AppState>) {
  // --- Wait up to 10 seconds for the project tree to be loaded
  let count = 0;

  while (count < 100) {
    if (store.getState()?.project?.workspaceLoaded) break;
    count++;
    await delay(100);
  }
  if (count >= 100) {
    console.error("Timeout while loading the workspace");
    return;
  }
}
