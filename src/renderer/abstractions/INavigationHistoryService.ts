import type { NavigationEntry, NavigationReason } from "./NavigationLocation";

/**
 * The IDE-wide Go Back / Go Forward history.
 *
 * One history for the whole IDE (not per document area); it lives in memory and is cleared when the
 * project closes. See `.plans/NAVIGATION_HISTORY_PLAN.md` §3.4.
 */
export interface INavigationHistoryService {
  /**
   * Runs a jump and records it: captures the current location, awaits `jump`, captures the location
   * arrived at. While a restore (Go Back/Forward) is in progress, or inside another recorded jump,
   * it only runs `jump`.
   *
   * `tabSwitch` and `explorer` jumps are recorded only while the "record tab switches" setting is on.
   */
  recordJump<T>(reason: NavigationReason, jump: () => Promise<T> | T): Promise<T>;

  /** The current location, or undefined when the active document does not take part. */
  captureCurrent(reason?: NavigationReason): NavigationEntry | undefined;

  /** Goes back one location. Resolves false when there was nowhere to go. */
  goBack(): Promise<boolean>;

  /** Goes forward one location. Resolves false when there was nowhere to go. */
  goForward(): Promise<boolean>;

  /** Goes to the entry at `index` (as returned by `getEntries`). */
  goTo(index: number): Promise<boolean>;

  /** Whether Go Back has somewhere to go from where the user is now. */
  canGoBack(): boolean;

  /** Whether Go Forward has somewhere to go. */
  canGoForward(): boolean;

  /** The entry Go Back would restore, if any (for tooltips). */
  peekBack(): NavigationEntry | undefined;

  /** The entry Go Forward would restore, if any (for tooltips). */
  peekForward(): NavigationEntry | undefined;

  /** The recorded entries (oldest first) and the index of the current one. */
  getEntries(): { entries: readonly NavigationEntry[]; index: number };

  /** A short description of an entry's position, such as "line 42". */
  describe(entry: NavigationEntry): string;

  /** One line of context for an entry, if its adapter can give one. */
  preview(entry: NavigationEntry): string | undefined;

  /** Forgets the history. */
  clear(): void;

  /** True while Go Back/Forward is restoring a location. */
  readonly isRestoring: boolean;
}
