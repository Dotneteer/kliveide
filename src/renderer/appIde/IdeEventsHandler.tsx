import { MachineControllerState } from "@abstractions/MachineControllerState";
import { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
import {
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import { useEffect } from "react";
import { getBreakpoints } from "./utils/breakpoint-utils";
import { isDebuggableCompilerOutput } from "@main/compiler-integration/compiler-registry";
import { reportMessagingError } from "@renderer/reportError";

/**
 * This component represents an event handler to manage the global IDE events
 */
export const IdeEventsHandler = () => {
  const { messenger } = useRendererContext();

  const breakpointsVersion = useSelector(
    s => s.emulatorState.breakpointsVersion
  );
  const compilation = useSelector(s => s.compilation);
  const execState = useSelector(s => s.emulatorState?.machineState);

  useEffect(() => {
    refreshSourceCodeBreakpoints();
  }, [breakpointsVersion, compilation]);

  useEffect(() => {
    if (execState === MachineControllerState.Paused) {
      refreshSourceCodeBreakpoints();
    }
  }, [execState]);

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

  // --- Do not render any visual elements
  return null;
};
