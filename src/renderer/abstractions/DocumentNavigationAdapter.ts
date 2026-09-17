import type { AppServices } from "./AppServices";
import type { IDocumentHubService } from "./IDocumentHubService";
import type { NavigationEntry, NavigationLocator } from "./NavigationLocation";
import type { ProjectDocumentState } from "./ProjectDocumentState";
import type { AppState } from "@common/state/AppState";
import type { Store } from "@common/state/redux-light";

/**
 * What an adapter may need beyond the app services to restore a location — reading a file back to
 * reopen a closed document, or the state the document's title depends on.
 */
export type NavigationAdapterEnvironment = {
  store: Store<AppState>;
  readBinaryFile: (path: string) => Promise<Uint8Array>;
};

/**
 * How a document type takes part in the navigation history.
 *
 * Declared on the document renderer registration (`DocumentRendererInfo.navigation`) rather than on a
 * mounted document, because a location must be restorable after its document was closed, when there
 * is no instance to ask. A document type without an adapter never becomes a history entry — that is
 * how a type opts out.
 *
 * See `.plans/NAVIGATION_HISTORY_PLAN.md` §3.2.
 */
export type DocumentNavigationAdapter = {
  /**
   * The current location of an open document whose view did not report one through
   * `DocumentApi.getNavigationLocator` (it is not mounted, or has no such API).
   */
  capture(document: ProjectDocumentState, hub: IDocumentHubService): NavigationLocator | undefined;

  /**
   * Whether two locators in the *same* document are close enough to be one history entry.
   */
  isNear(a: NavigationLocator, b: NavigationLocator): boolean;

  /**
   * Opens (or activates) the entry's document in `hub` and moves to its locator.
   * @returns false when the location cannot be restored (the file is gone, for example); the
   * history then drops the entry.
   */
  restore(
    entry: NavigationEntry,
    hub: IDocumentHubService,
    services: AppServices,
    env: NavigationAdapterEnvironment
  ): Promise<boolean>;

  /** A short description of the locator for the history list, such as "line 120". */
  describe(entry: NavigationEntry): string;

  /**
   * One line of context for the history list — the source line, the instruction at an address.
   * Undefined when there is nothing useful (the document is not loaded, for example).
   */
  preview?(entry: NavigationEntry, services: AppServices): string | undefined;

  /**
   * Keeps recorded positions current while their documents change — a text entry follows its line
   * as lines are inserted or deleted above it. Called with every entry of this document type
   * whenever the history or the set of open documents changes; entries no longer passed in are no
   * longer tracked.
   */
  track?(entries: readonly NavigationEntry[]): void;

  /** The entry's locator as it is now, after any edits `track` followed. The recorded one if none. */
  resolve?(entry: NavigationEntry): NavigationLocator;
};
