import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useGlobalSetting, useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { useEffect, useRef } from "react";
import { isDebuggableCompilerOutput } from "@main/compiler-integration/compiler-registry";
import { useAppServices } from "./services/AppServicesProvider";
import { saveProject } from "./utils/save-project";
import { BUILD_FILE } from "@common/structs/project-const";
import { incBuildFileVersionAction } from "@common/state/actions";
import { useEmuApi } from "@renderer/core/EmuApi";
import { delay } from "@renderer/utils/timing";
import { DOCS_WORKSPACE } from "./DocumentArea/DocumentsHeader";
import { CODE_EDITOR } from "@common/state/common-ids";
import { useMainApi } from "@renderer/core/MainApi";
import {
  SETTING_IDE_MAXIMIZE_TOOLS,
  SETTING_IDE_SHOW_SIDEBAR,
  SETTING_IDE_SIDEBAR_WIDHT,
  SETTING_IDE_SYNC_BREAKPOINTS,
  SETTING_IDE_TOOLPANEL_HEIGHT
} from "@common/settings/setting-const";
import { get } from "lodash";

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
      const projectPath = state.project?.folderPath;

      // --- Store current view options to set them later
      const maximizeToolPanels = get(state?.globalSettings, SETTING_IDE_MAXIMIZE_TOOLS, false);
      await mainApi.setGlobalSettingsValue(SETTING_IDE_SHOW_SIDEBAR, true);
      await mainApi.setGlobalSettingsValue(SETTING_IDE_MAXIMIZE_TOOLS, false);

      // --- Wait up to 10 seconds for the project to be opened
      console.log("Waiting for the end of project loading");
      let count = 0;
      while (count < 100) {
        if (store.getState().project?.folderPath === projectPath) break;
        count++;
        await delay(100);
      }
      if (count >= 100) {
        console.error("Timeout while opening the last project");
        return;
      }

      // --- Wait up to 10 seconds for the project tree to be loaded
      console.log("Waiting for the end of project tree loading");
      count = 0;

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

      // --- Open the last documents
      console.log("Time to open project workspace");
      await projectService.getActiveDocumentHubService().closeAllDocuments();
      const lastOpenDocs = (state.workspaceSettings?.[DOCS_WORKSPACE]?.documents ?? []).filter(
        (d: { type: string }) => d.type === CODE_EDITOR
      );
      const activeDocId = state.workspaceSettings?.[DOCS_WORKSPACE]?.activeDocumentId;
      let activeDocCommand = "";
      for (const doc of lastOpenDocs) {
        console.log("Document:", JSON.stringify(doc));
        if (doc.id.startsWith(projectPath)) {
          const navigateToId = doc.id.substring(projectPath.length + 1);
          const line = doc.position?.line ?? 0;
          const column = (doc.position?.column ?? 0) + 1;
          const command = `nav "${navigateToId}" ${line} ${column}`;
          console.log(command);
          await ideCommandsService.executeCommand(command);
          if (doc.id === activeDocId) {
            activeDocCommand = command;
          }
        }
      }

      // --- Navigate to the active document
      console.log("Navigate to the active document");
      if (activeDocCommand) {
        await ideCommandsService.executeCommand(activeDocCommand);
      }
      console.log("Project workspace opened");
      const sideBarWidth = get(state, SETTING_IDE_SIDEBAR_WIDHT);
      const toolPanelHeight = get(state, SETTING_IDE_TOOLPANEL_HEIGHT);

      // --- Adjust the size of IDE splitters
      if (sideBarWidth) {
        await mainApi.setGlobalSettingsValue(SETTING_IDE_SIDEBAR_WIDHT, sideBarWidth);
      }
      if (toolPanelHeight) {
        await mainApi.setGlobalSettingsValue(SETTING_IDE_TOOLPANEL_HEIGHT, toolPanelHeight);
      }
      if (maximizeToolPanels) {
        await mainApi.setGlobalSettingsValue(SETTING_IDE_MAXIMIZE_TOOLS, true);
      }
    };

    projectService.fileSaved.on(onFileSaved);
    projectService.projectOpened.on(onProjectLoaded);
    return () => {
      projectService.fileSaved.off(onFileSaved);
      projectService.projectOpened.off(onProjectLoaded);
    };
  }, [projectService]);

  // useInterval(async () => {
  //   const newState = await emuApi.getCpuStateChunk();
  //   const oldState = lastStateChunk.current;
  //   const changed =
  //     !oldState ||
  //     oldState.state !== newState.state ||
  //     oldState.pcValue !== newState.pcValue ||
  //     oldState.tacts !== newState.tacts;
  //   if (changed) {
  //     console.log("CPU state changed");
  //   } else if (new Date().valueOf() - latestRefresh.current > 500) {
  //     latestRefresh.current = new Date().valueOf();
  //     console.log("CPU state changed");
  //   }
  //   lastStateChunk.current = newState;
  // }, 100);

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
