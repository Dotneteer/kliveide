// ====================================================================================================================
// Floating document windows: the main process side (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §3.6).
//
// A floating window is an IDE renderer in "satellite" mode holding exactly one document. This module
// owns the slots (1..8), creates and destroys the windows, keeps `floatingDocuments` in the shared
// store, and routes the operations the plan names: open (pop out), dock, close, focus, close all, and
// the save flush before a quit or a project switch.
//
// The manager takes its Electron and messaging dependencies as an argument so its rules (the limit,
// the slot allocation, the order of a dock) are tested with fake windows.
// ====================================================================================================================

import type { Action } from "@state/Action";
import type { AppState } from "@state/AppState";
import { setFloatingDocumentAction } from "@state/actions";
import type { IdeApi } from "@messaging/IdeApi";
import {
  MAX_FLOATING_WINDOWS,
  type FloatSlot
} from "@messaging/messages-core";
import {
  allocateFloatSlot,
  getFloatingDocuments,
  type FloatingDocumentEntry,
  type FloatingDocumentRequest,
  type FloatingDocumentResult,
  type FloatingDocumentReveal,
  type FloatingSavedDocument,
  type FloatingWindowBounds
} from "@messaging/floating-documents";
import { combineFanoutResults } from "@messaging/ide-api-routing";

/**
 * The default size of a new floating window
 */
export const FLOATING_WINDOW_DEFAULT_WIDTH = 720;
export const FLOATING_WINDOW_DEFAULT_HEIGHT = 540;
export const FLOATING_WINDOW_MIN_WIDTH = 320;
export const FLOATING_WINDOW_MIN_HEIGHT = 200;

/**
 * How long the bounds of a moved or resized window wait before they reach the store: a drag fires
 * dozens of events, and every store change ends in a workspace save
 */
const BOUNDS_SETTLE_MS = 500;

/**
 * The part of a `BrowserWindow` the manager uses (a fake one in tests)
 */
export type FloatingWindowLike = {
  isDestroyed(): boolean;
  destroy(): void;
  focus(): void;
  show(): void;
  restore(): void;
  isMinimized(): boolean;
  isFocused(): boolean;
  getBounds(): FloatingWindowBounds;
  on(event: string, listener: (...args: any[]) => void): unknown;
  webContents: {
    send(channel: string, message: unknown): void;
    focus?(): void;
  };
};

/**
 * What the manager needs from the rest of the main process
 */
export type FloatingWindowDeps = {
  /** Creates (and starts loading) the window of a slot */
  createWindow(slot: FloatSlot, bounds: FloatingWindowBounds | undefined): FloatingWindowLike;
  /** The default bounds of a new window: near the IDE window */
  defaultBounds(): FloatingWindowBounds | undefined;
  getState(): AppState;
  dispatch(action: Action): void;
  registerMessenger(slot: FloatSlot, window: FloatingWindowLike): void;
  unregisterMessenger(slot: FloatSlot): void;
  getFloatApi(slot: FloatSlot): IdeApi | undefined;
  getIdeApi(): IdeApi | undefined;
  /** Brings the IDE window forward */
  showIdeWindow(): void;
  /** A floating window got or lost the focus (the menus count it as the IDE, plan §3.6) */
  focusChanged(focused: boolean): void;
};

type OpenWindow = {
  slot: FloatSlot;
  window: FloatingWindowLike;
  boundsTimer?: ReturnType<typeof setTimeout>;
  /** The window is being destroyed by the manager: its close event must not ask the renderer */
  closing?: boolean;
};

/**
 * Owns the floating document windows
 */
export class FloatingWindowManager {
  private readonly _windows = new Map<FloatSlot, OpenWindow>();
  private _quitting = false;

  constructor(private readonly deps: FloatingWindowDeps) {}

  /**
   * The slots of the open windows
   */
  get openSlots(): FloatSlot[] {
    return [...this._windows.keys()].sort((a, b) => a - b);
  }

  /**
   * The number of open windows
   */
  get count(): number {
    return this._windows.size;
  }

  /**
   * The app is quitting: the windows' own close events stop asking their renderers
   */
  setQuitting(quitting: boolean): void {
    this._quitting = quitting;
  }

  /**
   * Whether any floating window has the focus
   */
  hasFocus(): boolean {
    return [...this._windows.values()].some(
      ({ window }) => !window.isDestroyed() && window.isFocused()
    );
  }

  /**
   * Opens a document in a new floating window (pop out, plan §3.4 step 1). The entry is in the store
   * before this returns, so the caller (the IDE) closes its tab only once the window exists.
   */
  open(request: FloatingDocumentRequest): FloatingDocumentResult {
    const documentId = request?.document?.id;
    if (!documentId) {
      return { error: "failed", message: "No document to float." };
    }
    const existing = this.findSlotOf(documentId);
    if (existing) {
      this.focusSlot(existing);
      return { error: "alreadyFloating" };
    }
    if (this._windows.size >= MAX_FLOATING_WINDOWS) {
      return { error: "limit" };
    }
    const used = new Set<number>([
      ...this._windows.keys(),
      ...getFloatingDocuments(this.deps.getState()).map((entry) => entry.slot)
    ]);
    const slot = allocateFloatSlot(used);
    if (!slot) {
      return { error: "limit" };
    }

    const bounds = request.bounds ?? this.deps.defaultBounds();
    const entry: FloatingDocumentEntry = {
      slot,
      document: request.document,
      sourceAreaId: request.sourceAreaId,
      bounds
    };
    // --- The entry goes first: the window reads it as soon as it starts (plan §3.4 step 2)
    this.deps.dispatch(setFloatingDocumentAction(slot, entry));

    let window: FloatingWindowLike;
    try {
      window = this.deps.createWindow(slot, bounds);
    } catch (err) {
      this.deps.dispatch(setFloatingDocumentAction(slot, undefined));
      return { error: "failed", message: String(err) };
    }
    const openWindow: OpenWindow = { slot, window };
    this._windows.set(slot, openWindow);
    this.deps.registerMessenger(slot, window);
    this.attachWindowEvents(openWindow);
    return { slot };
  }

  /**
   * Docks the document of a floating window back into the IDE (plan §3.4 step 3): the IDE opens it
   * first, and only then is the window destroyed, so a failure leaves the document where it was.
   */
  async dock(slot: FloatSlot, document?: FloatingSavedDocument): Promise<boolean> {
    const entry = this.entryOf(slot);
    if (!entry) return false;
    const docked = document ?? entry.document;
    const ideApi = this.deps.getIdeApi();
    if (!ideApi) return false;
    const opened = await ideApi.openDockedDocument({
      document: docked,
      sourceAreaId: entry.sourceAreaId
    });
    if (opened === false) return false;
    this.destroy(slot);
    this.deps.showIdeWindow();
    return true;
  }

  /**
   * Destroys the window of a slot and clears its entry (Close, after the renderer ran the close
   * path; or the document's file was deleted)
   */
  destroy(slot: FloatSlot): void {
    const openWindow = this._windows.get(slot);
    this._windows.delete(slot);
    if (openWindow) {
      openWindow.closing = true;
      if (openWindow.boundsTimer) clearTimeout(openWindow.boundsTimer);
      this.deps.unregisterMessenger(slot);
      if (!openWindow.window.isDestroyed()) {
        openWindow.window.destroy();
      }
    }
    // --- While quitting, the entries stay: the IDE must not save a workspace without the floating
    // --- documents just because their windows went down with the app (plan Q3)
    if (this.entryOf(slot) && !this._quitting) {
      this.deps.dispatch(setFloatingDocumentAction(slot, undefined));
    }
  }

  /**
   * Destroys every floating window (the project closed, the app quits). Saving is the caller's job:
   * `saveAllBeforeQuit` runs first.
   */
  destroyAll(): void {
    for (const slot of this.openSlots) {
      this.destroy(slot);
    }
    // --- Entries left behind by a window that never opened
    if (this._quitting) return;
    for (const entry of getFloatingDocuments(this.deps.getState())) {
      this.deps.dispatch(setFloatingDocumentAction(entry.slot, undefined));
    }
  }

  /**
   * Flushes every floating window's saves (plan §3.3, the fan-out class). `false` when any of them
   * refused (the user cancelled an unsaved-document prompt).
   */
  async saveAllBeforeQuit(): Promise<boolean> {
    const results = await Promise.allSettled(
      this.openSlots.map(async (slot) => {
        const api = this.deps.getFloatApi(slot);
        return api ? await api.saveAllBeforeQuit() : true;
      })
    );
    return combineFanoutResults(results);
  }

  /**
   * Focuses the window holding a document and moves its view (plan §2.3); false when the document
   * does not float
   */
  async focusDocument(reveal: FloatingDocumentReveal): Promise<boolean> {
    const slot = this.findSlotOf(reveal?.documentId);
    if (!slot) return false;
    this.focusSlot(slot);
    if (reveal.line !== undefined) {
      try {
        await this.deps.getFloatApi(slot)?.revealFloatingDocument(reveal);
      } catch (err) {
        console.warn(`Cannot reveal ${reveal.documentId} in floating window ${slot}:`, err);
      }
    }
    return true;
  }

  /**
   * The file of a floating document was renamed: the entry and the window follow
   */
  async renameDocument(oldId: string, newId: string): Promise<void> {
    const slot = this.findSlotOf(oldId);
    if (!slot) return;
    const entry = this.entryOf(slot)!;
    this.deps.dispatch(
      setFloatingDocumentAction(slot, { ...entry, document: { ...entry.document, id: newId } })
    );
    try {
      await this.deps.getFloatApi(slot)?.floatingDocumentRenamed(oldId, newId);
    } catch (err) {
      console.warn(`Cannot rename ${oldId} in floating window ${slot}:`, err);
    }
  }

  /**
   * Records the current state of a window's document (its position and view state), so the
   * workspace saves what the window shows (plan Q3)
   */
  updateDocument(slot: FloatSlot, document: FloatingSavedDocument): void {
    const entry = this.entryOf(slot);
    if (!entry || entry.document?.id !== document?.id) return;
    this.deps.dispatch(setFloatingDocumentAction(slot, { ...entry, document }));
  }

  /**
   * The slot of the window holding a document
   */
  findSlotOf(documentId: string | undefined): FloatSlot | undefined {
    if (!documentId) return undefined;
    return getFloatingDocuments(this.deps.getState()).find(
      (entry) => entry.document?.id === documentId && this._windows.has(entry.slot)
    )?.slot;
  }

  // --- Helpers

  private entryOf(slot: FloatSlot): FloatingDocumentEntry | undefined {
    return this.deps.getState()?.floatingDocuments?.[slot];
  }

  private focusSlot(slot: FloatSlot): void {
    const window = this._windows.get(slot)?.window;
    if (!window || window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
    window.webContents.focus?.();
  }

  private attachWindowEvents(openWindow: OpenWindow): void {
    const { slot, window } = openWindow;

    window.on("focus", () => this.deps.focusChanged(true));
    window.on("blur", () => this.deps.focusChanged(false));

    const boundsChanged = () => {
      if (openWindow.boundsTimer) clearTimeout(openWindow.boundsTimer);
      openWindow.boundsTimer = setTimeout(() => {
        openWindow.boundsTimer = undefined;
        if (window.isDestroyed() || openWindow.closing) return;
        const entry = this.entryOf(slot);
        if (!entry) return;
        this.deps.dispatch(setFloatingDocumentAction(slot, { ...entry, bounds: window.getBounds() }));
      }, BOUNDS_SETTLE_MS);
    };
    window.on("move", boundsChanged);
    window.on("resize", boundsChanged);

    // --- The OS close (Alt+F4, Cmd+W) is the Close button (plan Q4): the renderer runs the close
    // --- path, with its prompts, and destroys the window through `closeFloatingDocument`
    window.on("close", (e: { preventDefault(): void }) => {
      if (openWindow.closing || this._quitting) return;
      e.preventDefault();
      const api = this.deps.getFloatApi(slot);
      if (!api) {
        this.destroy(slot);
        return;
      }
      api.requestFloatingClose().catch(() => {
        // --- A renderer that cannot answer has nothing it could save
        this.destroy(slot);
      });
    });

    window.on("closed", () => {
      if (this._windows.get(slot)?.window === window) {
        this.destroy(slot);
      }
    });
  }
}
