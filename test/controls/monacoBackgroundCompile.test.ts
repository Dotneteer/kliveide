import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BackgroundCompileScheduler,
  EDIT_DEBOUNCE_MS
} from "@renderer/features/editor/monaco/monacoBackgroundCompile";

/**
 * A fake of the IDE's side: one compile at a time, a flag that says whether one runs, and a main
 * process that may refuse a start. `finish()` ends the running compile, as the END action does.
 */
function fakeIde() {
  const ide = {
    running: false,
    refuse: false,
    starts: 0,
    isRunning: () => ide.running,
    start: vi.fn(async () => {
      if (ide.refuse) return false;
      ide.starts++;
      ide.running = true;
      return true;
    }),
    finish(scheduler: BackgroundCompileScheduler) {
      ide.running = false;
      scheduler.compileFinished();
    }
  };
  return ide;
}

describe("BackgroundCompileScheduler", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("compiles once the typing pauses, not on every keystroke", async () => {
    const ide = fakeIde();
    const scheduler = new BackgroundCompileScheduler(ide);
    for (let i = 0; i < 5; i++) {
      scheduler.requestAfterEdit();
      await vi.advanceTimersByTimeAsync(EDIT_DEBOUNCE_MS / 2);
    }
    expect(ide.starts).toBe(0);
    await vi.advanceTimersByTimeAsync(EDIT_DEBOUNCE_MS);
    expect(ide.starts).toBe(1);
  });

  it("runs an edit made during a compile after that compile, even when its result is clean", async () => {
    const ide = fakeIde();
    const scheduler = new BackgroundCompileScheduler(ide);
    await scheduler.requestNow();
    expect(ide.starts).toBe(1);

    scheduler.requestAfterEdit();
    await vi.advanceTimersByTimeAsync(EDIT_DEBOUNCE_MS);
    expect(ide.starts, "no second compile while the first runs").toBe(1);
    expect(scheduler.hasPending).toBe(true);

    // --- The first compile ends; nothing about its result matters
    ide.finish(scheduler);
    await vi.advanceTimersByTimeAsync(0);
    expect(ide.starts).toBe(2);
    expect(scheduler.hasPending).toBe(false);
  });

  it("reads whether a compile runs when the debounce fires, not when the edit was made", async () => {
    const ide = fakeIde();
    const scheduler = new BackgroundCompileScheduler(ide);
    ide.running = true;
    scheduler.requestAfterEdit();
    // --- The compile that ran during the edit finishes before the debounce fires
    ide.running = false;
    await vi.advanceTimersByTimeAsync(EDIT_DEBOUNCE_MS);
    expect(ide.starts).toBe(1);
    expect(scheduler.hasPending).toBe(false);
  });

  it("keeps a request the main process refused and runs it when the running compile finishes", async () => {
    const ide = fakeIde();
    const scheduler = new BackgroundCompileScheduler(ide);
    ide.refuse = true;
    await scheduler.requestNow();
    expect(ide.start).toHaveBeenCalledTimes(1);
    expect(scheduler.hasPending).toBe(true);

    ide.refuse = false;
    ide.finish(scheduler);
    await vi.advanceTimersByTimeAsync(0);
    expect(ide.starts).toBe(1);
  });

  it("collapses many waiting requests into one compile", async () => {
    const ide = fakeIde();
    const scheduler = new BackgroundCompileScheduler(ide);
    await scheduler.requestNow();
    for (let i = 0; i < 3; i++) await scheduler.requestNow();
    ide.finish(scheduler);
    await vi.advanceTimersByTimeAsync(0);
    expect(ide.starts).toBe(2);
  });

  it("does nothing when a compile finishes with no request waiting", async () => {
    const ide = fakeIde();
    const scheduler = new BackgroundCompileScheduler(ide);
    scheduler.compileFinished();
    await vi.advanceTimersByTimeAsync(EDIT_DEBOUNCE_MS);
    expect(ide.start).not.toHaveBeenCalled();
  });

  it("stops after dispose", async () => {
    const ide = fakeIde();
    const scheduler = new BackgroundCompileScheduler(ide);
    scheduler.requestAfterEdit();
    scheduler.dispose();
    await vi.advanceTimersByTimeAsync(EDIT_DEBOUNCE_MS * 2);
    expect(ide.start).not.toHaveBeenCalled();
  });
});
