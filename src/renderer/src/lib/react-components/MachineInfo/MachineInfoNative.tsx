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
  const prevModelIdRef = useRef<string | undefined>(undefined);
  const currentMachineInfoRef = useRef<any>(null);
  const currentMachineIdRef = useRef<string | null>(null);
  const currentModelIdRef = useRef<string | null>(null);
  
  // Use refs to store stable references to prop functions
  const registerComponentApiRef = useRef(registerComponentApi);
  
  // Update refs when props change
  registerComponentApiRef.current = registerComponentApi;

  // Subscribe to store changes and update state when machineId or modelId changes
  useLayoutEffect(() => {
    // Helper function to update component state with current machine info
    const updateComponentState = () => {
      const currentState = store.getState();
      const machineId = currentState?.emulatorState?.machineId;
      const modelId = currentState?.emulatorState?.modelId;
      const machineInfo = machineService.getMachineInfo();
      
      // Store in refs for API access
      currentMachineInfoRef.current = machineInfo || null;
      currentMachineIdRef.current = machineId || null;
      currentModelIdRef.current = modelId || null;
      
      updateState({
        machine: machineInfo || null,
        machineId: machineId || null,
        modelId: modelId || null,
      });
    };

    // Register API methods
    if (registerComponentApiRef.current) {
      registerComponentApiRef.current({
        getMachine: () => currentMachineInfoRef.current,
        getMachineId: () => currentMachineIdRef.current,
        getModelId: () => currentModelIdRef.current,
      });
    }

    // Subscribe to store changes
    const unsubscribe = store.subscribe(() => {
      const newState = store.getState();
      const newMachineId = newState?.emulatorState?.machineId;
      const newModelId = newState?.emulatorState?.modelId;

      // Only update if machineId or modelId has changed
      if (newMachineId !== prevMachineIdRef.current || newModelId !== prevModelIdRef.current) {
        prevMachineIdRef.current = newMachineId;
        prevModelIdRef.current = newModelId;
        updateComponentState();
      }
    });

    // Initial state update
    const initialMachineId = store.getState()?.emulatorState?.machineId;
    const initialModelId = store.getState()?.emulatorState?.modelId;
    prevMachineIdRef.current = initialMachineId;
    prevModelIdRef.current = initialModelId;
    updateComponentState();

    return () => {
      unsubscribe();
    };
  }, [store, machineService]);

  // This is a non-visual component, so it renders nothing
  return null;
}
