import { MachineController } from "@/emu/machines/controller/MachineController";
import { useAppServices } from "@/renderer/appIde/services/AppServicesProvider";
import { useEffect, useRef, useState } from "react";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { IMachineController } from "../abstractions/IMachineController";

export const useMachineController = (
  controllerChanged?: (controller: IMachineController) => void,
  machineStateChanged?: (states: {
    oldState: MachineControllerState;
    newState: MachineControllerState;
  }) => void,
  frameCompleted?: (completed: boolean) => void
) => {
  const { machineService, outputPaneService } = useAppServices();
  const [controller, setController] = useState<IMachineController>();
  const mounted = useRef(false);

  // --- Manage controller setup
  useEffect(() => {
    if (mounted.current) return;

    mounted.current = true;
    const unsubscribe = machineService.newMachineTypeInitialized(() => {
      // --- Obtain the new machine controller
      const newController = machineService.getMachineController();
      if (newController === controller) return;

      // --- Clean up the old controller
      controller?.dispose();

      // --- Done
      setController(newController);
      newController.output = outputPaneService.getOutputPaneBuffer("emu");
    });

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  });

  // --- Manage controller changes
  useEffect(() => {
    controllerChanged?.(controller);
  }, [controller]);

  // --- Manage controller event handlers
  useEffect(() => {
    // --- Bind event handler methods to the controller
    if (controller) {
      if (machineStateChanged) {
        controller.stateChanged.on(machineStateChanged);
      }
      if (frameCompleted) {
        controller.frameCompleted.on(frameCompleted);
      }
    }

    // --- Unbind event handler methods
    return () => {
      if (controller) {
        if (machineStateChanged) {
          controller.stateChanged.off(machineStateChanged);
        }
        if (frameCompleted) {
          controller.frameCompleted.off(frameCompleted);
        }
      }
    };
  }, [controller]);

  return controller;
};
