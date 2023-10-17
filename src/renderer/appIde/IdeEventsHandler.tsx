import { MachineControllerState } from "@abstractions/MachineControllerState";
import {
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import { useEffect } from "react";
import { getBreakpoints } from "./utils/breakpoint-utils";
import { isDebuggableCompilerOutput } from "@main/compiler-integration/compiler-registry";
import {
  reportMessagingError,
  reportUnexpectedMessageType
} from "@renderer/reportError";
import { useAppServices } from "./services/AppServicesProvider";
import { saveProject } from "./utils/save-project";

/**
 * This component represents an event handler to manage the global IDE events
 */
export const IdeEventsHandler = () => {
  const { messenger } = useRendererContext();
  const { ideCommandsService } = useAppServices();

  const compilation = useSelector(s => s.compilation);
  const execState = useSelector(s => s.emulatorState?.machineState);
  const breakpointsVersion = useSelector(s => s.emulatorState?.breakpointsVersion);
  const syncBps = useSelector(
    s => s.ideViewOptions.syncSourceBreakpoints ?? true
  );

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

  // --- Do not render any visual elements
  return null;

  // --- Navigates to the current execution point location
  async function refreshCodeLocation (): Promise<void> {
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
    const bps = await getBreakpoints(messenger);
    const cpuResponse = await messenger.sendMessage({
      type: "EmuGetCpuState"
    });
    if (cpuResponse.type === "ErrorResponse") {
      reportMessagingError(
        `EmuGetCpuState call failed: ${cpuResponse.message}`
      );
    } else if (cpuResponse.type !== "EmuGetCpuStateResponse") {
      reportUnexpectedMessageType(cpuResponse.type);
    } else {
      // --- Check if there is a location for PC
      const fileLine = compilation.result.sourceMap[cpuResponse.pc];
      if (!fileLine) return;

      const fullFile =
        compilation.result.sourceFileList[fileLine.fileIndex]?.filename;
      if (!fullFile) return;

      await ideCommandsService.executeCommand(
        `nav "${fullFile}" ${fileLine.line}`
      );
    }
  }
};
