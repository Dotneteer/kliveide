import { useStore } from "@/emu/StoreProvider";
import React, { useContext, useRef } from "react";
import { IdeServices } from "./abstractions";
import { createDocumentService } from "./DocumentService";
import { createmachineService } from "./MachineService";
import { createOutputPaneService } from "./OuputPaneService";

// =====================================================================================================================
/**
 * This object provides the React context of IDE services, which we pass the root component, and thus all
 * nested apps and components may use it.
 */
const IdeServicesContext = React.createContext<IdeServices>(undefined);

// =====================================================================================================================
/**
 * This React hook makes the current IDE service instance available within any component logic using the hook.
 */
export function useIdeServices(): IdeServices {
    return useContext(IdeServicesContext)!;
  }
  
type Props = {
    children?: React.ReactNode;
}
export function IdeProvider({
    children
}: Props) {
    const store = useStore();
    const ideServicesRef = useRef<IdeServices>({
        documentService: createDocumentService(store),
        machineService: createmachineService(store),
        outputPaneService: createOutputPaneService()
    });
    return (
        <IdeServicesContext.Provider value={ideServicesRef.current}>
            {children}
        </IdeServicesContext.Provider>
    );
}
