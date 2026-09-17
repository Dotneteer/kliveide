import type { NavigationEntry } from "@renderer/abstractions/NavigationLocation";

/*
 * The navigation history as a plain list with a cursor — no services, no React, no documents.
 *
 * Every behavioural rule of Go Back / Go Forward lives here so it can be table-tested; the service
 * (`NavigationHistoryService`) only captures locations, restores them, and publishes state.
 *
 * The model mirrors a browser's: `entries[index]` is "where we are", a new jump drops everything
 * ahead of it. Two refinements make Back return to where the user *left* rather than where they
 * *landed*:
 *
 * - Locations reach the model as `from` (captured just before a jump) and `to` (just after). If the
 *   user moved within the current entry's document since arriving, `from` replaces that entry.
 * - If the user is somewhere the history never saw — another document reached without a recorded
 *   jump (a debugger pause, for example), or a document type that does not take part — Back first
 *   returns to the current entry itself.
 *
 * See `.plans/NAVIGATION_HISTORY_PLAN.md` §3.3.
 */

/** Decides whether two entries are the same place. Only called for entries of the same document. */
export type NavigationNearFn = (a: NavigationEntry, b: NavigationEntry) => boolean;

export const DEFAULT_NAVIGATION_HISTORY_LIMIT = 50;

export class NavigationHistory {
  private _entries: NavigationEntry[] = [];
  private _index = -1;

  constructor(
    private readonly isNearFn: NavigationNearFn,
    private readonly limit = DEFAULT_NAVIGATION_HISTORY_LIMIT
  ) {}

  /** The recorded entries, oldest first. */
  get entries(): readonly NavigationEntry[] {
    return this._entries;
  }

  /** The index of the current entry; -1 when the history is empty. */
  get index(): number {
    return this._index;
  }

  /** The current entry, if any. */
  get current(): NavigationEntry | undefined {
    return this._entries[this._index];
  }

  /**
   * Whether Go Back has somewhere to go, given where the user is now.
   * @param now The current location; undefined when the active document does not take part.
   */
  canGoBack(now: NavigationEntry | undefined): boolean {
    if (this._index < 0) return false;
    return this._index > 0 || this.hasWandered(now);
  }

  /** Whether Go Forward has somewhere to go. */
  canGoForward(): boolean {
    return this._index < this._entries.length - 1;
  }

  /**
   * Records a jump.
   * @param from The location being left; undefined when the document it was in does not take part.
   * @param to The location arrived at; undefined when the target document does not take part.
   */
  record(from: NavigationEntry | undefined, to: NavigationEntry | undefined): void {
    // --- A new jump forks the history, like a browser.
    this._entries = this._entries.slice(0, this._index + 1);

    if (from) {
      const current = this.current;
      if (!current) {
        this.push(from);
      } else if (this.sameDocument(from, current)) {
        if (!this.isNearFn(from, current)) {
          this._entries[this._index] = { ...from, reason: current.reason };
        }
      } else {
        this.push(from);
      }
    }

    if (to) {
      const current = this.current;
      if (current && this.sameDocument(to, current) && this.isNearFn(to, current)) {
        this._entries[this._index] = to;
      } else {
        this.push(to);
      }
    }

    this.trim();
  }

  /**
   * The index Go Back would restore, without changing anything; -1 if there is none.
   * @param now The current location.
   */
  peekBack(now: NavigationEntry | undefined): number {
    if (this._index < 0) return -1;
    return this.hasWandered(now) ? this._index : this._index - 1;
  }

  /**
   * Prepares a Go Back and returns the index of the entry to restore, or -1 if there is none.
   *
   * The cursor does not move: call `moveTo` once the entry was restored, or `removeAt` if it could
   * not be.
   * @param now The current location, captured just before going back.
   */
  prepareBack(now: NavigationEntry | undefined): number {
    if (this._index < 0) return -1;
    if (this.hasWandered(now)) return this._index;
    this.updateCurrent(now);
    return this._index - 1;
  }

  /**
   * Prepares a Go Forward and returns the index of the entry to restore, or -1 if there is none.
   * @param now The current location, captured just before going forward.
   */
  prepareForward(now: NavigationEntry | undefined): number {
    if (!this.canGoForward()) return -1;
    if (!this.hasWandered(now)) this.updateCurrent(now);
    return this._index + 1;
  }

  /** Makes the entry at `index` the current one. */
  moveTo(index: number): void {
    if (index < 0 || index >= this._entries.length) return;
    this._index = index;
  }

  /** Removes the entry at `index`, keeping the cursor on the same entry where possible. */
  removeAt(index: number): void {
    if (index < 0 || index >= this._entries.length) return;
    this._entries.splice(index, 1);
    if (index <= this._index) this._index--;
    if (this._index < 0 && this._entries.length > 0) this._index = 0;
  }

  /** Removes every entry matching `predicate`. */
  removeWhere(predicate: (entry: NavigationEntry) => boolean): void {
    for (let i = this._entries.length - 1; i >= 0; i--) {
      if (predicate(this._entries[i])) this.removeAt(i);
    }
    // --- Removals can leave two copies of one place side by side (A, B, A with B deleted).
    for (let i = this._entries.length - 1; i > 0; i--) {
      const a = this._entries[i - 1];
      const b = this._entries[i];
      if (this.sameDocument(a, b) && this.isNearFn(a, b)) this.removeAt(i);
    }
  }

  /** Re-points entries of a renamed document (or of documents under a renamed folder). */
  rekey(oldId: string, newId: string, newTitle?: (entry: NavigationEntry) => string): void {
    this._entries = this._entries.map((e) => {
      let documentId: string | undefined;
      if (e.documentId === oldId) documentId = newId;
      else if (e.documentId.startsWith(`${oldId}/`)) {
        documentId = newId + e.documentId.substring(oldId.length);
      }
      if (documentId === undefined) return e;
      const moved = { ...e, documentId };
      return newTitle ? { ...moved, title: newTitle(moved) } : moved;
    });
  }

  /** Forgets everything. */
  clear(): void {
    this._entries = [];
    this._index = -1;
  }

  // --- The user is not at the current entry's document: another document, or one that does not
  // --- take part (`now` is undefined).
  private hasWandered(now: NavigationEntry | undefined): boolean {
    const current = this.current;
    return !!current && (!now || !this.sameDocument(now, current));
  }

  // --- Moved within the current entry's document: Forward (or Back from further on) should return
  // --- here, not to where the user first arrived.
  private updateCurrent(now: NavigationEntry | undefined): void {
    const current = this.current;
    if (now && current && this.sameDocument(now, current) && !this.isNearFn(now, current)) {
      this._entries[this._index] = { ...now, reason: current.reason };
    }
  }

  private push(entry: NavigationEntry): void {
    this._entries.push(entry);
    this._index = this._entries.length - 1;
  }

  private trim(): void {
    const excess = this._entries.length - this.limit;
    if (excess > 0) {
      this._entries.splice(0, excess);
      this._index = Math.max(this._index - excess, 0);
    }
  }

  private sameDocument(a: NavigationEntry, b: NavigationEntry): boolean {
    return a.documentId === b.documentId;
  }
}
