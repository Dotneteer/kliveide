import { MachineControllerState } from "@abstractions/MachineControllerState";
import { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
import {
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import { useEffect } from "react";
import { getBreakpoints } from "./utils/breakpoint-utils";

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
    console.log("Refreshing source code breakpoints", compilation);
    const sourceBps: ResolvedBreakpoint[] = [];
    if (
      compilation.result &&
      !compilation.failed &&
      compilation.result.errors.length === 0
    ) {
      // --- There can be source code breakpoints
      const bps = await getBreakpoints(messenger);
      console.log("bps", bps);
    }
  }

  // --- Do not render any visual elements
  return null;
};
