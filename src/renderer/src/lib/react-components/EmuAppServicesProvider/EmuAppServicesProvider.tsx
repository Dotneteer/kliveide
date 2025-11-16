import { createContext, ReactNode, useMemo } from "react";
import type { EmuAppServices } from "../../services/EmuAppServices";
import type { MessageSource } from "@messaging/messages-core";
import { createMachineService } from "../../services/MachineService";
import { getRendererStore } from "../../store/rendererStore";
import { EmuToMainMessenger } from "@messaging/EmuToMainMessenger";

// =====================================================================================================================
// EmuAppServices Context

/**
 * React Context for providing EmuAppServices to the component tree
 */
export const EmuAppServicesContext = createContext<EmuAppServices | undefined>(undefined);

// =====================================================================================================================
// React EmuAppServicesProvider component implementation

type Props = {
  children?: ReactNode;
};

/**
 * EmuAppServicesProvider component that provides an EmuAppServices instance via React Context.
 * 
 * This component creates and manages emulator application services (like MachineService) and makes
 * them available to all child components through React Context.
 * 
 * @example
 * ```tsx
 * import { EmuAppServicesProvider } from './EmuAppServicesProvider';
 * 
 * function App() {
 *   return (
 *     <EmuAppServicesProvider>
 *       <YourComponents />
 *     </EmuAppServicesProvider>
 *   );
 * }
 * ```
 * 
 * Access services in child components using the `useEmuAppServices()` hook.
 */
export function EmuAppServicesProvider({ children }: Props) {
  // Get the store and messenger instances
  const store = getRendererStore();
  const messenger = useMemo(() => new EmuToMainMessenger(), []);
  
  // Determine the message source based on URL
  const messageSource = useMemo<MessageSource>(() => {
    const url = new URL((globalThis as any).location.href);
    return url.searchParams.has("emu") ? "emu" : "ide";
  }, []);

  // Create the EmuAppServices instance
  const emuAppServices = useMemo<EmuAppServices>(() => {
    return {
      machineService: createMachineService(store, messenger, messageSource),
    };
  }, [store, messenger, messageSource]);

  // Provide the services to children via Context
  return (
    <EmuAppServicesContext.Provider value={emuAppServices}>
      {children}
    </EmuAppServicesContext.Provider>
  );
}
