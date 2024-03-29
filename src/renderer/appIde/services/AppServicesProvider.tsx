import { AppServices } from "@renderer/abstractions/AppServices";
import { createMachineService } from "@renderer/appEmu/MachineService";
import { useRendererContext } from "@renderer/core/RendererProvider";
import { createUiService } from "@renderer/core/UiServices";
import { createValidationService } from "@renderer/core/ValidationService";
import { useContext, useRef, useEffect, createContext } from "react";
import { createInteractiveCommandsService } from "./IdeCommandService";
import { createOutputPaneService } from "./OuputPaneService";
import { createProjectService } from "./ProjectService";
import { createScriptService } from "./ScriptService";

// =====================================================================================================================
/**
 * This object provides the React context of IDE services, which we pass the root component, and thus all
 * nested apps and components may use it.
 */
const AppServicesContext = createContext<AppServices>(undefined);

// =====================================================================================================================
/**
 * This React hook makes the current IDE service instance available within any component logic using the hook.
 */
export function useAppServices (): AppServices {
  return useContext(AppServicesContext)!;
}

type Props = {
  children?: React.ReactNode;
};
export function AppServicesProvider ({ children }: Props) {
  const { store, messenger, messageSource } = useRendererContext();
  const ideCommandsService = createInteractiveCommandsService(
    store,
    messenger,
    messageSource
  );
  const projectService = createProjectService(store, messenger);
  const servicesRef = useRef<AppServices>({
    uiService: createUiService(),
    machineService: createMachineService(store, messenger, messageSource),
    outputPaneService: createOutputPaneService(),
    ideCommandsService,
    projectService,
    validationService: createValidationService(),
    scriptService: createScriptService(store, messenger)
  });

  // --- Set the app services instance whenever the provider's value changes
  useEffect(() => {
    ideCommandsService.setAppServices(servicesRef.current);
  }, [servicesRef.current]);

  return (
    <AppServicesContext.Provider value={servicesRef.current}>
      {children}
    </AppServicesContext.Provider>
  );
}
