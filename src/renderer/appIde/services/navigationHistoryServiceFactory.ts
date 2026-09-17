import type { AppState } from "@common/state/AppState";
import type { Store } from "@common/state/redux-light";
import type { IProjectService } from "@renderer/abstractions/IProjectService";
import type { MessengerBase } from "@common/messaging/MessengerBase";
import { createMainApi } from "@common/messaging/MainApi";
import { documentPanelRegistry } from "@renderer/registry";
import { NavigationHistoryService } from "./NavigationHistoryService";

/**
 * Creates the navigation history service, finding each document type's adapter on its
 * `documentPanelRegistry` entry.
 *
 * Kept apart from `NavigationHistoryService` because the registry imports every document panel (and
 * Monaco with them); the service itself stays importable in tests with a fake lookup. The registry is
 * read when an adapter is needed, never at construction: panels import the services provider, which
 * imports this module.
 */
export function createNavigationHistoryService(
  store: Store<AppState>,
  projectService: IProjectService,
  messenger?: MessengerBase
): NavigationHistoryService {
  return new NavigationHistoryService(
    store,
    projectService,
    (documentType) => documentPanelRegistry.find((r) => r.id === documentType)?.navigation,
    // --- Reopening a closed NEX bank reads the file back.
    messenger ? (path) => createMainApi(messenger).readBinaryFile(path) : undefined
  );
}
