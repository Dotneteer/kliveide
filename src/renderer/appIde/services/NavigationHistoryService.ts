import { get } from "lodash";

import type { AppServices } from "@renderer/abstractions/AppServices";
import type {
  DocumentNavigationAdapter,
  NavigationAdapterEnvironment
} from "@renderer/abstractions/DocumentNavigationAdapter";
import type { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import type { INavigationHistoryService } from "@renderer/abstractions/INavigationHistoryService";
import type { IProjectService } from "@renderer/abstractions/IProjectService";
import type {
  NavigationEntry,
  NavigationReason
} from "@renderer/abstractions/NavigationLocation";
import type { NavigationHistoryState } from "@common/state/AppState";
import type { AppState } from "@common/state/AppState";
import type { Store } from "@common/state/redux-light";
import { setNavHistoryStateAction } from "@common/state/actions";
import { SETTING_IDE_NAV_RECORD_TAB_SWITCH } from "@common/settings/setting-const";
import { KliveGlobalSettings } from "@common/settings/setting-definitions";
import { NavigationHistory } from "../navigation/NavigationHistory";

/** Finds the navigation adapter of a document type; undefined means the type does not take part. */
export type NavigationAdapterLookup = (documentType: string) => DocumentNavigationAdapter | undefined;

/** Reasons the "record tab switches" setting silences. */
const TAB_SWITCH_REASONS: ReadonlySet<NavigationReason> = new Set(["tabSwitch", "explorer"]);

/**
 * The IDE-wide navigation history.
 *
 * Captures the active document's location through its adapter (asking the mounted view first), keeps
 * the entries in a `NavigationHistory`, restores entries through their adapters, and publishes what
 * the UI needs into `ideView.navHistory`.
 *
 * See `.plans/NAVIGATION_HISTORY_PLAN.md` §3.4.
 */
export class NavigationHistoryService implements INavigationHistoryService {
  private readonly _history: NavigationHistory;
  private _services: AppServices | undefined;
  private _restoring = false;
  private _recording = false;
  private _lastPublished: NavigationHistoryState | undefined;
  private _lastDocumentHubState: unknown;
  private _trackingAdapters = new Set<DocumentNavigationAdapter>();

  constructor(
    private readonly store: Store<AppState>,
    private readonly projectService: IProjectService,
    private readonly getAdapter: NavigationAdapterLookup,
    private readonly readBinaryFile: NavigationAdapterEnvironment["readBinaryFile"] = async () => {
      throw new Error("No file access");
    }
  ) {
    this._history = new NavigationHistory((a, b) => this.isNear(a, b));
    // --- Whether Back has somewhere to go depends on where the user *is*: leaving the current
    // --- entry's document without a recorded jump (a debugger pause, a tab switch with recording
    // --- off) makes Back possible. Every document activation bumps `documentHubState`, so
    // --- republishing on that keeps the menu and the toolbar honest. `publish` only dispatches on
    // --- a real change, and that dispatch does not touch `documentHubState`, so this cannot loop.
    store.subscribe?.(() => {
      const hubState = store.getState()?.ideView?.documentHubState;
      if (hubState === this._lastDocumentHubState) return;
      this._lastDocumentHubState = hubState;
      if (!this._restoring && !this._recording) this.publish();
    });
    projectService.projectClosed?.on(() => this.clear());
    projectService.itemRenamed?.on((data) => {
      if (!data?.oldName || !data.node?.data?.fullPath) return;
      this._history.rekey(data.oldName, data.node.data.fullPath, (e) =>
        e.documentId === data.node.data.fullPath ? data.node.data.name : e.title
      );
      this.publish();
    });
    projectService.itemDeleted?.on((node) => {
      const path = node?.data?.fullPath;
      if (!path) return;
      this._history.removeWhere(
        (e) => e.documentId === path || e.documentId.startsWith(`${path}/`)
      );
      this.publish();
    });
  }

  /** The services adapters receive on restore; set once, after all services exist. */
  setAppServices(services: AppServices): void {
    this._services = services;
  }

  get isRestoring(): boolean {
    return this._restoring;
  }

  async recordJump<T>(reason: NavigationReason, jump: () => Promise<T> | T): Promise<T> {
    if (this._restoring || this._recording || !this.shouldRecord(reason)) {
      return await jump();
    }
    this._recording = true;
    try {
      const from = this.captureCurrent(reason);
      const result = await jump();
      const to = this.captureCurrent(reason);
      this._history.record(from, to);
      return result;
    } finally {
      this._recording = false;
      this.publish();
    }
  }

  captureCurrent(reason: NavigationReason = "command"): NavigationEntry | undefined {
    const hub = this.projectService.getActiveDocumentHubService();
    const document = hub?.getActiveDocument();
    if (!hub || !document) return undefined;
    const adapter = this.getAdapter(document.type);
    if (!adapter) return undefined;

    const locator =
      hub.getDocumentApi(document.id)?.getNavigationLocator?.() ?? adapter.capture(document, hub);
    if (!locator) return undefined;

    return {
      documentId: document.id,
      documentType: document.type,
      title: document.name,
      iconName: document.iconName,
      hubId: hub.hubId,
      locator,
      reason,
      time: Date.now()
    };
  }

  async goBack(): Promise<boolean> {
    if (this._restoring) return false;
    const index = this._history.prepareBack(this.captureCurrent());
    return await this.restoreFrom(index, -1);
  }

  async goForward(): Promise<boolean> {
    if (this._restoring) return false;
    const index = this._history.prepareForward(this.captureCurrent());
    return await this.restoreFrom(index, 1);
  }

  async goTo(index: number): Promise<boolean> {
    if (this._restoring) return false;
    if (index < 0 || index >= this._history.entries.length) return false;
    // --- Same bookkeeping as a step: moving away from a place the user moved within keeps it.
    if (index !== this._history.index) {
      if (index < this._history.index) this._history.prepareBack(this.captureCurrent());
      else this._history.prepareForward(this.captureCurrent());
    }
    return await this.restoreFrom(index, 0);
  }

  canGoBack(): boolean {
    return this._history.canGoBack(this.captureCurrent());
  }

  canGoForward(): boolean {
    return this._history.canGoForward();
  }

  peekBack(): NavigationEntry | undefined {
    const index = this._history.peekBack(this.captureCurrent());
    return index < 0 ? undefined : this._history.entries[index];
  }

  peekForward(): NavigationEntry | undefined {
    return this._history.entries[this._history.index + 1];
  }

  getEntries(): { entries: readonly NavigationEntry[]; index: number } {
    return { entries: this._history.entries, index: this._history.index };
  }

  describe(entry: NavigationEntry): string {
    return this.getAdapter(entry.documentType)?.describe(this.resolved(entry)) ?? "";
  }

  preview(entry: NavigationEntry): string | undefined {
    const services = this._services;
    if (!services) return undefined;
    try {
      return this.getAdapter(entry.documentType)?.preview?.(this.resolved(entry), services);
    } catch {
      return undefined;
    }
  }

  clear(): void {
    this._history.clear();
    this.publish();
  }

  /**
   * Restores the entry at `index`. An entry that cannot be restored is dropped, and a step (`direction`
   * ±1) carries on with the next entry that way, so one keypress never silently does nothing while
   * there is still somewhere to go.
   */
  private async restoreFrom(index: number, direction: -1 | 0 | 1): Promise<boolean> {
    this._restoring = true;
    try {
      while (index >= 0 && index < this._history.entries.length) {
        const entry = this._history.entries[index];
        if (await this.restoreEntry(entry)) {
          this._history.moveTo(index);
          return true;
        }
        this._history.removeAt(index);
        if (direction === 0) return false;
        // --- After removing, the next entry forward has slid into `index`.
        if (direction < 0) index--;
      }
      return false;
    } finally {
      this._restoring = false;
      this.publish();
    }
  }

  private async restoreEntry(entry: NavigationEntry): Promise<boolean> {
    const adapter = this.getAdapter(entry.documentType);
    const services = this._services;
    if (!adapter || !services) return false;
    const hub = this.selectHub(entry);
    if (!hub) return false;
    try {
      return await adapter.restore(this.resolved(entry), hub, services, {
        store: this.store,
        readBinaryFile: this.readBinaryFile
      });
    } catch {
      return false;
    }
  }

  // --- The area the location was seen in, else an area already showing the document, else the
  // --- active one.
  private selectHub(entry: NavigationEntry): IDocumentHubService | undefined {
    const hubs = this.projectService.getDocumentHubServiceInstances();
    return (
      hubs.find((h) => h.hubId === entry.hubId) ??
      hubs.find((h) => h.isOpen(entry.documentId)) ??
      this.projectService.getActiveDocumentHubService()
    );
  }

  private isNear(a: NavigationEntry, b: NavigationEntry): boolean {
    if (a.documentId !== b.documentId) return false;
    if (a.locator.kind !== b.locator.kind) return false;
    const adapter = this.getAdapter(a.documentType);
    return adapter
      ? adapter.isNear(this.resolved(a).locator, this.resolved(b).locator)
      : true;
  }

  /** The entry with its locator as its adapter tracks it now (see `DocumentNavigationAdapter.track`). */
  private resolved(entry: NavigationEntry): NavigationEntry {
    const resolve = this.getAdapter(entry.documentType)?.resolve;
    if (!resolve) return entry;
    try {
      const locator = resolve(entry);
      return locator === entry.locator ? entry : { ...entry, locator };
    } catch {
      return entry;
    }
  }

  /**
   * Hands each adapter that tracks positions the entries of its document type. Runs with every
   * publish: after each history change, and on each document activation — which is also when a
   * newly opened file's editor model appears and its entries can start being followed.
   */
  private syncTracking(): void {
    const byAdapter = new Map<DocumentNavigationAdapter, NavigationEntry[]>();
    for (const entry of this._history.entries) {
      const adapter = this.getAdapter(entry.documentType);
      if (!adapter?.track) continue;
      const list = byAdapter.get(adapter) ?? [];
      list.push(entry);
      byAdapter.set(adapter, list);
    }
    for (const adapter of this._trackingAdapters) {
      if (!byAdapter.has(adapter)) byAdapter.set(adapter, []);
    }
    this._trackingAdapters = new Set(byAdapter.keys());
    for (const [adapter, entries] of byAdapter) {
      try {
        adapter.track!(entries);
      } catch {
        // --- Tracking is a refinement; a failure leaves the recorded positions in place.
      }
    }
  }

  private shouldRecord(reason: NavigationReason): boolean {
    if (!TAB_SWITCH_REASONS.has(reason)) return true;
    const def = KliveGlobalSettings[SETTING_IDE_NAV_RECORD_TAB_SWITCH];
    return !!get(
      this.store.getState()?.globalSettings ?? {},
      SETTING_IDE_NAV_RECORD_TAB_SWITCH,
      def?.defaultValue ?? true
    );
  }

  private publish(): void {
    this.syncTracking();
    const state: NavigationHistoryState = {
      canGoBack: this._history.canGoBack(this.captureCurrent()),
      canGoForward: this._history.canGoForward(),
      count: this._history.entries.length,
      index: this._history.index
    };
    const last = this._lastPublished;
    if (
      last &&
      last.canGoBack === state.canGoBack &&
      last.canGoForward === state.canGoForward &&
      last.count === state.count &&
      last.index === state.index
    ) {
      return;
    }
    this._lastPublished = state;
    this.store.dispatch(setNavHistoryStateAction(state));
  }
}
