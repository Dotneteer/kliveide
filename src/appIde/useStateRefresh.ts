import { useSelector } from "@/core/RendererProvider";
import { MachineControllerState } from "@state/MachineControllerState";
import { useEffect } from "react";

/**
 * This react hook executes refresh events whenever the machine's state changes or the specified
 * time period expires
 * @param refreshInterval Refresh interval in milliseconds
 * @param handler Refrehs event handler
 */
export function useStateRefresh (
  refreshInterval: number,
  handler: (state: MachineControllerState) => void | Promise<void>
): void {
  const machineState = useSelector(s => s.emulatorState?.machineState);

  // --- Respond to machine state change events
  useEffect(() => {
    let timerHandler: NodeJS.Timeout | undefined;
    const releaseTimer = () => {
      if (timerHandler) {
        clearInterval(timerHandler);
        timerHandler = undefined;
      }
    };

    // --- Refresh the status
    releaseTimer();
    switch (machineState) {
      case MachineControllerState.Running:
        // --- The machine is running, set up periodic status refresh
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

    // --- Release the timer when disposing this hook
    return () => releaseTimer();
  }, [machineState]);
}
