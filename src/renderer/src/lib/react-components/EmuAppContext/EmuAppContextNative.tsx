import { ReactNode, useLayoutEffect, useRef } from "react";
import { EmuAppServicesProvider } from "../EmuAppServicesProvider/EmuAppServicesProvider";

// =====================================================================================================================
// React EmuAppContext component implementation

type Props = {
  children?: ReactNode;
  registerComponentApi: any;
  updateState: any;
};

/**
 * EmuAppContext wraps its children in an EmuAppServicesProvider.
 * This is an XMLUI wrapper component that provides emulator services to child components.
 */
export function EmuAppContextNative({
  children,
  registerComponentApi,
  updateState,
}: Props) {
  // Use refs to store stable references to prop functions
  const updateStateRef = useRef(updateState);
  const registerComponentApiRef = useRef(registerComponentApi);
  
  // Update refs when props change
  updateStateRef.current = updateState;
  registerComponentApiRef.current = registerComponentApi;

  // Register API methods using useLayoutEffect
  useLayoutEffect(() => {
    if (registerComponentApiRef.current) {
      registerComponentApiRef.current({});
    }
  }, []);

  // Wrap children in EmuAppServicesProvider
  return (
    <EmuAppServicesProvider>
      {children}
    </EmuAppServicesProvider>
  );
}
