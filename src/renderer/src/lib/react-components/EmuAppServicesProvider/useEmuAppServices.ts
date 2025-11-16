import { useContext } from "react";
import { EmuAppServicesContext } from "./EmuAppServicesProvider";
import type { EmuAppServices } from "../../services/EmuAppServices";

/**
 * Custom hook to access EmuAppServices from any component within the EmuAppServicesProvider tree.
 * 
 * @returns The EmuAppServices instance containing all emulator application services
 * @throws Error if used outside of EmuAppServicesProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { machineService } = useEmuAppServices();
 *   
 *   const handleSetMachine = async () => {
 *     await machineService.setMachineType("zxSpectrum48", "pal");
 *   };
 *   
 *   return <button onClick={handleSetMachine}>Set Machine</button>;
 * }
 * ```
 */
export function useEmuAppServices(): EmuAppServices {
  const context = useContext(EmuAppServicesContext);
  
  if (context === undefined) {
    throw new Error(
      "useEmuAppServices must be used within an EmuAppServicesProvider. " +
      "Make sure your component is wrapped with <EmuAppServicesProvider>."
    );
  }
  
  return context;
}
