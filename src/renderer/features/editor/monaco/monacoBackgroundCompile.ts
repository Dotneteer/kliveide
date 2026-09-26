/**
 * Schedules the editor's background (as-you-type) compiles so that every edit is eventually
 * compiled, and at most one compile runs at a time.
 *
 * - An edit asks for a compile after a debounce; a new edit restarts it.
 * - When the debounce fires while a compile is running, or the main process refuses to start one,
 *   the request is kept and runs as soon as the running compile finishes, whatever its result.
 * - "Running" is read when the request fires, never from a value captured earlier.
 */
export type BackgroundCompilePorts = {
  /** Whether a background compile is running now. */
  isRunning: () => boolean;
  /**
   * Starts a compile. Resolves to false when it did not start because another one is running (the
   * request then waits for that one); resolves to true otherwise, including when nothing needed
   * compiling.
   */
  start: () => Promise<boolean>;
};

export const EDIT_DEBOUNCE_MS = 1200;

export class BackgroundCompileScheduler {
  private pending = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;

  constructor(
    private readonly ports: BackgroundCompilePorts,
    private readonly debounceMs = EDIT_DEBOUNCE_MS
  ) {}

  /** Whether a request is waiting for the running compile to finish. */
  get hasPending(): boolean {
    return this.pending;
  }

  /** An edit: compile once the typing pauses. */
  requestAfterEdit(): void {
    if (this.disposed) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.requestNow();
    }, this.debounceMs);
  }

  /** Compile now, or as soon as the running compile finishes. */
  async requestNow(): Promise<void> {
    if (this.disposed) return;
    if (this.ports.isRunning()) {
      this.pending = true;
      return;
    }
    this.pending = false;
    const started = await this.ports.start();
    if (!started) this.pending = true;
  }

  /** The running compile finished (with any result): run the request that waited for it. */
  compileFinished(): void {
    if (this.disposed || !this.pending) return;
    this.pending = false;
    void this.requestNow();
  }

  dispose(): void {
    this.disposed = true;
    this.pending = false;
    clearTimeout(this.timer);
  }
}
