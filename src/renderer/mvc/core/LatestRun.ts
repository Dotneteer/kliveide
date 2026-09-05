export type RunToken = {
  // --- False once a newer run has begun, so a slow result can be dropped
  // --- instead of overwriting a newer verdict.
  isCurrent(): boolean;
};

/**
 * Generation guard for "latest wins" async work.
 *
 * Replaces the `let cancelled = false` closure flag that every effect otherwise
 * rolls by hand, and — unlike that flag — also covers out-of-order resolution:
 * a slow first request that settles after a fast second one is stale, not just
 * a request whose component went away.
 */
export class LatestRun {
  private generation = 0;

  begin(): RunToken {
    const mine = ++this.generation;
    return { isCurrent: () => mine === this.generation };
  }

  // --- Invalidates every outstanding run without starting a new one. Used on
  // --- dispose, so results arriving after teardown are ignored.
  cancelAll(): void {
    this.generation++;
  }
}
