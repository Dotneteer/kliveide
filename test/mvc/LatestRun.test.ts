import { describe, expect, it } from "vitest";

import { LatestRun } from "@mvc/core/LatestRun";

describe("LatestRun", () => {
  it("treats a single run as current", () => {
    expect(new LatestRun().begin().isCurrent()).toBe(true);
  });

  it("marks an earlier run stale once a later one begins", () => {
    const runs = new LatestRun();
    const first = runs.begin();
    const second = runs.begin();

    // --- This is the out-of-order case: the first request is still in flight
    // --- and will resolve later, but its answer is no longer the newest one.
    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(true);
  });

  it("invalidates every outstanding run on cancelAll", () => {
    const runs = new LatestRun();
    const run = runs.begin();
    runs.cancelAll();

    expect(run.isCurrent()).toBe(false);
    // --- ...and does not start a run of its own
    expect(runs.begin().isCurrent()).toBe(true);
  });

  it("keeps separate LatestRun instances independent", () => {
    const validations = new LatestRun();
    const releases = new LatestRun();
    const validation = validations.begin();
    releases.begin();

    // --- A refreshed release list must not invalidate a running smoke test
    expect(validation.isCurrent()).toBe(true);
  });
});
