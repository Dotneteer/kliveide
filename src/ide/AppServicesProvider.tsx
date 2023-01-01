import { useMessenger, useStore } from "@/core/StoreProvider";
import React, { useContext, useRef } from "react";
import { AppServices } from "./abstractions";
import { createDocumentService } from "./DocumentService";
import { createInteractiveCommandsService } from "./InteractiveCommandService";
import { createMachineService } from "../appEmu/MachineService";
import { createOutputPaneService } from "./OuputPaneService";

// =====================================================================================================================
/**
 * This object provides the React context of IDE services, which we pass the root component, and thus all
 * nested apps and components may use it.
 */
const AppServicesContext = React.createContext<AppServices>(undefined);

// =====================================================================================================================
/**
 * This React hook makes the current IDE service instance available within any component logic using the hook.
 */
export function useAppServices(): AppServices {
    return useContext(AppServicesContext)!;
  }
  
type Props = {
    children?: React.ReactNode;
}
export function AppServicesProvider({
    children
}: Props) {
    const store = useStore();
    const messenger = useMessenger();
    const servicesRef = useRef<AppServices>({
        documentService: createDocumentService(store),
        machineService: createMachineService(store, messenger),
        outputPaneService: createOutputPaneService(),
        interactiveCommandsService: createInteractiveCommandsService(store)
    });
    return (
        <AppServicesContext.Provider value={servicesRef.current}>
            {children}
        </AppServicesContext.Provider>
    );
}
