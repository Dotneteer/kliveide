import { AppServices } from "@renderer/abstractions/AppServices";
import { createMachineService } from "@renderer/appEmu/MachineService";
import { useRendererContext } from "@renderer/core/RendererProvider";
import { createUiService } from "@renderer/core/UiServices";
import { createValidationService } from "@renderer/core/ValidationService";
import { useContext, useRef, createContext } from "react";
import { createInteractiveCommandsService } from "./IdeCommandService";
import { createOutputPaneService } from "./OuputPaneService";
import { createProjectService } from "./ProjectService";
import { createScriptService } from "./ScriptService";
import { createNavigationHistoryService } from "./navigationHistoryServiceFactory";

// =====================================================================================================================
/**
 * This object provides the React context of IDE services, which we pass the root component, and thus all
 * nested apps and components may use it.
 */
const AppServicesContext = createContext<AppServices | undefined>(undefined);

// =====================================================================================================================
/**
 * This React hook makes the current IDE service instance available within any component logic using the hook.
 */
export function useAppServices (): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) {
    throw new Error("useAppServices must be used within an AppServicesProvider.");
  }
  return services;
}

/**
 * Which IDE renderer the services run in: the IDE window, or a floating document window in
 * "satellite" mode (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §3.1). A satellite runs the same
 * services, so every document panel works unchanged; its document hubs take IDs from their own range.
 */
export type AppServicesRole = "ide" | "satellite";

type Props = {
  role?: AppServicesRole;
  /** The first document hub ID of a satellite is one above this */
  hubIdBase?: number;
  children?: React.ReactNode;
};
export function AppServicesProvider ({ role = "ide", hubIdBase, children }: Props) {
  const { store, messenger, messageSource } = useRendererContext();

  const servicesRef = useRef<AppServices | undefined>(undefined);
  if (!servicesRef.current) {
    const ideCommandsService = createInteractiveCommandsService(
      store,
      messenger,
      messageSource
    );
    const projectService = createProjectService(store, messenger, {
      hubIdBase: role === "satellite" ? hubIdBase : undefined
    });
    const navigationHistoryService = createNavigationHistoryService(store, projectService, messenger);
    servicesRef.current = {
      uiService: createUiService(),
      machineService: createMachineService(store, messenger, messageSource),
      outputPaneService: createOutputPaneService(),
      ideCommandsService,
      projectService,
      validationService: createValidationService(),
      scriptService: createScriptService(store, messenger),
      navigationHistoryService
    };
    ideCommandsService.setAppServices(servicesRef.current);
    navigationHistoryService.setAppServices(servicesRef.current);
  }

  return (
    <AppServicesContext.Provider value={servicesRef.current}>
      {children}
    </AppServicesContext.Provider>
  );
}
