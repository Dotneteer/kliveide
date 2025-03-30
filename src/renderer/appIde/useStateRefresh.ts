import { useSelector } from "@renderer/core/RendererProvider";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useEffect, useRef } from "react";

/**
 * This react hook executes refresh events whenever the machine's state changes or the specified
 * time period expires
 * @param refreshInterval Refresh interval in milliseconds
 * @param handler Refrehs event handler
 */
export function useStateRefresh(
  refreshInterval: number,
  handler: (state: MachineControllerState) => void | Promise<void>
): void {
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const pcValue = useSelector(s => s.emulatorState?.pcValue);
  const lastMachineState = useRef<MachineControllerState>(machineState);

  // --- Initial refresh
  const initialized = useRef(false);

  let timerHandler: NodeJS.Timeout | undefined;
  const releaseTimer = () => {
    if (timerHandler) {
      clearInterval(timerHandler);
      timerHandler = undefined;
    }
  };

  useEffect(() => {
    if (initialized.current) return null;
    initialized.current = true;
    handler(machineState);

    return () => {
      initialized.current = false;
    };
  }, [initialized.current]);

  // --- Respond to machine state change events
  useEffect(() => {
    // --- Refresh the status
    releaseTimer();
    switch (machineState) {
      case MachineControllerState.Running:
        // --- The machine is running, set up periodic status refresh
        if (lastMachineState.current === MachineControllerState.Running)  {
          // --- No change, no new timer
          break;
        }
        timerHandler = setInterval(() => {
          handler(machineState);
        }, refreshInterval);
        break;

      case MachineControllerState.None:
      case MachineControllerState.Paused:
      case MachineControllerState.Stopped:
        handler(machineState);
        break;
    }
    lastMachineState.current = machineState;

    // --- Release the timer when disposing this hook
    return () => releaseTimer();
  }, [machineState, pcValue]);
}
