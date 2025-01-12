import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { useEffect, useRef } from "react";
import { isDebuggableCompilerOutput } from "@main/compiler-integration/compiler-registry";
import { useAppServices } from "./services/AppServicesProvider";
import { saveProject } from "./utils/save-project";
import { BUILD_FILE } from "@common/structs/project-const";
import { incBuildFileVersionAction } from "@common/state/actions";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useEmuApiAlt } from "@renderer/core/EmuApiAlt";

/**
 * This component represents an event handler to manage the global IDE events
 */
export const IdeEventsHandler = () => {
  const { store, messenger } = useRendererContext();
  const { ideCommandsService, projectService } = useAppServices();
  const emuApi = useEmuApi();
  const emuApiAlt = useEmuApiAlt();

  const project = useSelector((s) => s.project);
  const compilation = useSelector((s) => s.compilation);
  const execState = useSelector((s) => s.emulatorState?.machineState);
  const breakpointsVersion = useSelector((s) => s.emulatorState?.breakpointsVersion);
  const syncBps = useSelector((s) => s.ideViewOptions.syncSourceBreakpoints ?? true);
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
    projectService.fileSaved.on(onFileSaved);
    return () => {
      projectService.fileSaved.off(onFileSaved);
    };
  }, []);

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
    const cpuResponse = await emuApiAlt.getCpuState();
    // --- Check if there is a location for PC
    const fileLine = compilation.result.sourceMap[cpuResponse.pc];
    if (!fileLine) return;

    const fullFile = compilation.result.sourceFileList[fileLine.fileIndex]?.filename;
    if (!fullFile) return;

    await ideCommandsService.executeCommand(`nav "${fullFile}" ${fileLine.line}`);
  }
};
