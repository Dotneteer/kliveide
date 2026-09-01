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
      const projectTreeLoaded = await ensureProjectLoaded(projectService);

      // --- Restore document tabs and activate only the last active document. Skip this if the
      // --- project tree never became available - every document lookup would fail against it
      // --- anyway, silently dropping every tab instead of actually restoring any of them.
      if (projectTreeLoaded) {
        await restoreLastOpenDocuments(projectService, store);
      } else {
        console.error("Skipping document restoration because the project tree failed to load");
      }
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

/**
 * Waits for the project tree to be built and set on the project service.
 *
 * The tree is populated by a completely separate component (the explorer sidebar), which issues
 * its own IPC round trip to main to recursively scan the project folder from disk. That scan can
 * take noticeably longer on Windows (e.g. under real-time antivirus scanning) than the fixed
 * budget this function used to enforce, so the wait window here is generous. Returns whether the
 * tree became available in time - callers MUST check this before relying on the tree, since
 * proceeding against a not-yet-loaded (or never loaded) tree causes every subsequent lookup
 * (e.g. resolving a saved document's file to a tree node) to silently fail.
 */
export async function ensureProjectLoaded(projectService: IProjectService): Promise<boolean> {
  // --- Wait up to 30 seconds for the project tree to be loaded
  let count = 0;

  while (count < 300) {
    const tree = projectService.getProjectTree();
    if (tree) return true;
    count++;
    await delay(100);
  }
  console.error("Timeout while loading the project tree");
  return false;
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

/**
 * Waits for the project's build root(s) to be populated in the store.
 *
 * The main process dispatches SET_BUILD_ROOT to its own store and then forwards it to this
 * window's store asynchronously over IPC ("fire and forget" - the forwarding promise is never
 * awaited by the dispatcher). A caller that reads `store.getState().project.buildRoots`
 * immediately after the "open folder" IPC call resolves can race ahead of that forwarded action,
 * especially when cross-process IPC/scheduling is slower (this has been observed on Windows).
 * This helper gives the forwarded action a bounded window to arrive before the caller gives up.
 *
 * Not every project has a configured build root, so a timeout here is not treated as an error.
 */
export async function ensureBuildRootsLoaded(store: Store<AppState>): Promise<void> {
  // --- Wait up to 5 seconds for the build root(s) to be forwarded from the main process
  let count = 0;

  while (count < 50) {
    if ((store.getState()?.project?.buildRoots ?? []).length > 0) break;
    count++;
    await delay(100);
  }
}
