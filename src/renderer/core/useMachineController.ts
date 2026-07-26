import { useAppServices } from "@appIde/services/AppServicesProvider";
import { useEffect, useRef, useState } from "react";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { FrameCompletedArgs, IMachineController } from "../abstractions/IMachineController";
import { PANE_ID_EMU } from "@common/integration/constants";

export const useMachineController = (
  controllerChanged?: (controller: IMachineController) => Promise<void>,
  machineStateChanged?: (states: {
    oldState: MachineControllerState;
    newState: MachineControllerState;
  }) => void,
  frameCompleted?: (args: FrameCompletedArgs) => void
) => {
  const { machineService, outputPaneService } = useAppServices();
  const [controller, setController] = useState<IMachineController>();
  const mounted = useRef(false);
  const controllerRef = useRef<IMachineController>();
  const controllerChangedRef = useRef(controllerChanged);
  const machineStateChangedRef = useRef(machineStateChanged);
  const frameCompletedRef = useRef(frameCompleted);

  controllerChangedRef.current = controllerChanged;
  machineStateChangedRef.current = machineStateChanged;
  frameCompletedRef.current = frameCompleted;

  useEffect(() => {
    controllerRef.current = controller;
  }, [controller]);

  // --- Manage controller setup
  useEffect(() => {
    if (mounted.current) return undefined;

    mounted.current = true;
    const unsubscribe = machineService.newMachineTypeInitialized(() => {
      // --- Obtain the new machine controller
      const newController = machineService.getMachineController();
      if (newController === controllerRef.current) return;

      // --- Clean up the old controller
      controllerRef.current?.dispose();

      // --- Done
      controllerRef.current = newController;
      setController(newController);
      newController.output = outputPaneService.getOutputPaneBuffer(PANE_ID_EMU);
    });

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [machineService, outputPaneService]);

  // --- Manage controller changes
  useEffect(() => {
    controllerChangedRef.current?.(controller);
  }, [controller]);

  // --- Manage controller event handlers
  useEffect(() => {
    // --- Bind event handler methods to the controller
    if (controller) {
      const stateChangedHandler = (states: {
        oldState: MachineControllerState;
        newState: MachineControllerState;
      }) => machineStateChangedRef.current?.(states);
      const frameCompletedHandler = (args: FrameCompletedArgs) => frameCompletedRef.current?.(args);
      controller.stateChanged.on(stateChangedHandler);
      controller.frameCompleted.on(frameCompletedHandler);

      // --- Unbind event handler methods
      return () => {
        controller.stateChanged.off(stateChangedHandler);
        controller.frameCompleted.off(frameCompletedHandler);
      };
    }
    return undefined;
  }, [controller]);

  return controller;
};
