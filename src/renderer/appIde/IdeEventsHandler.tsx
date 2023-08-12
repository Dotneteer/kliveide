import { MachineControllerState } from "@abstractions/MachineControllerState";
import { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
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

/**
 * This component represents an event handler to manage the global IDE events
 */
export const IdeEventsHandler = () => {
  const { messenger } = useRendererContext();
  const { ideCommandsService } = useAppServices();

  const breakpointsVersion = useSelector(
    s => s.emulatorState.breakpointsVersion
  );
  const compilation = useSelector(s => s.compilation);
  const execState = useSelector(s => s.emulatorState?.machineState);
  const project = useSelector(s => s.project);

  useEffect(() => {
    refreshSourceCodeBreakpoints();
  }, [breakpointsVersion, compilation]);

  useEffect(() => {
    (async () => {
      if (execState === MachineControllerState.Paused) {
        await refreshSourceCodeBreakpoints();
        await refreshCodeLocation();
      }
    })();
  }, [execState]);

  // --- Do not render any visual elements
  return null;

  // --- Sends all resolved source code breakpoints to the emulator
  async function refreshSourceCodeBreakpoints (): Promise<void> {
    const resolvedBp: ResolvedBreakpoint[] = [];
    if (
      compilation.result &&
      !compilation.failed &&
      compilation.result.errors.length === 0
    ) {
      if (!isDebuggableCompilerOutput(compilation.result)) {
        return;
      }

      // --- There can be source code breakpoints
      const bps = await getBreakpoints(messenger);
      for (const bp of bps) {
        if (!bp.resource) continue;
        const fileIndex = compilation.result.sourceFileList.findIndex(fi =>
          fi.filename.endsWith("/" + bp.resource)
        );
        if (fileIndex >= 0) {
          const lineInfo = compilation.result.listFileItems.find(
            li => li.fileIndex === fileIndex && li.lineNumber === bp.line
          );
          if (lineInfo) {
            resolvedBp.push({
              resource: bp.resource,
              line: bp.line,
              address: lineInfo.address
            });
          }
        }
      }
    }
    const response = await messenger.sendMessage({
      type: "EmuResolveBreakpoints",
      breakpoints: resolvedBp
    });
    if (response.type === "ErrorResponse") {
      reportMessagingError(
        `EmuResolveBreakpoint call failed: ${response.message}`
      );
    }
  }

  // --- Navigates to the current execution point location
  async function refreshCodeLocation (): Promise<void> {
    // --- No compilation, no code breakpoint to navigate to
    if (
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

      await ideCommandsService.executeCommand(`nav ${fullFile} ${fileLine.line}`);
    }
  }
};
