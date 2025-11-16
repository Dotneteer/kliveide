import { useLayoutEffect, useRef } from "react";
import { getRendererStore } from "../../store/rendererStore";
import { useEmuAppServices } from "../EmuAppServicesProvider/useEmuAppServices";

// =====================================================================================================================
// React MachineInfo component implementation

type Props = {
  registerComponentApi: any;
  updateState: any;
};

export function MachineInfoNative({
  registerComponentApi,
  updateState,
}: Props) {
  const store = getRendererStore();
  const { machineService } = useEmuAppServices();
  const prevMachineIdRef = useRef<string | undefined>(undefined);
  const currentMachineInfoRef = useRef<any>(null);
  const currentMachineIdRef = useRef<string | null>(null);
  
  // Use refs to store stable references to prop functions
  const updateStateRef = useRef(updateState);
  const registerComponentApiRef = useRef(registerComponentApi);
  
  // Update refs when props change
  updateStateRef.current = updateState;
  registerComponentApiRef.current = registerComponentApi;

  // Subscribe to store changes and update state when machineId changes
  useLayoutEffect(() => {
    // Helper function to update component state with current machine info
    const updateComponentState = () => {
      const currentState = store.getState();
      const machineId = currentState?.emulatorState?.machineId;
      const machineInfo = machineService.getMachineInfo();
      
      // Store in refs for API access
      currentMachineInfoRef.current = machineInfo || null;
      currentMachineIdRef.current = machineId || null;
      
      updateStateRef.current({
        machine: machineInfo || null,
        machineId: machineId || null,
      });
    };

    // Register API methods
    if (registerComponentApiRef.current) {
      registerComponentApiRef.current({
        getMachine: () => currentMachineInfoRef.current,
        getMachineId: () => currentMachineIdRef.current,
      });
    }

    // Subscribe to store changes
    const unsubscribe = store.subscribe(() => {
      const newState = store.getState();
      const newMachineId = newState?.emulatorState?.machineId;

      // Only update if machineId has changed
      if (newMachineId !== prevMachineIdRef.current) {
        prevMachineIdRef.current = newMachineId;
        updateComponentState();
      }
    });

    // Initial state update
    const initialMachineId = store.getState()?.emulatorState?.machineId;
    prevMachineIdRef.current = initialMachineId;
    updateComponentState();

    return () => {
      unsubscribe();
    };
  }, [store, machineService]);

  // This is a non-visual component, so it renders nothing
  return null;
}
