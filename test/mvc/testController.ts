import { LatestRun } from "@mvc/core/LatestRun";
import { UiController } from "@mvc/core/UiController";
import { messageOf } from "@mvc/core/errors";
import type { UiReducer } from "@mvc/core/types";

/**
 * A minimal controller used as the subject of the infrastructure tests. It has
 * the same shape a real feature controller has — one async port, one LatestRun,
 * a pure reducer and a derived view model — and nothing else.
 */

export type TestState = { busy: boolean; value: string; error: string };
export type TestIntent =
  | { type: "loadRequested"; key: string }
  | { type: "cleared" }
  | { type: "throwsSync" }
  | { type: "throwsAsync" };
export type TestEvent =
  | { type: "loadStarted" }
  | { type: "loadSettled"; value: string }
  | { type: "loadFailed"; error: string }
  | { type: "cleared" };
export type TestViewModel = { label: string; busy: boolean };

export const initialTestState: TestState = { busy: false, value: "", error: "" };

export const reduceTest: UiReducer<TestState, TestEvent> = (state, event) => {
  switch (event.type) {
    case "loadStarted":
      return { ...state, busy: true, error: "" };
    case "loadSettled":
      return { busy: false, value: event.value, error: "" };
    case "loadFailed":
      return { ...state, busy: false, error: event.error };
    case "cleared":
      // --- Already clear: same reference, so no subscriber is woken
      return state.value === "" && state.error === "" ? state : initialTestState;
    default:
      return state;
  }
};

export const selectTestViewModel = (state: TestState): TestViewModel => ({
  busy: state.busy,
  label: state.busy ? "Loading..." : state.error || state.value || "Idle"
});

export type TestPorts = { load(key: string): Promise<string> };

// --- Module-level: the selector closure is built before `this` exists.
export const selectorCalls = { count: 0 };

export class TestController extends UiController<
  TestState,
  TestIntent,
  TestEvent,
  TestViewModel
> {
  private readonly loadRun = new LatestRun();
  readonly unhandled: unknown[] = [];

  constructor(private readonly ports: TestPorts) {
    // --- The counter proves the view model is memoized rather than merely
    // --- deep-equal on every read.
    super(initialTestState, reduceTest, (state) => {
      selectorCalls.count++;
      return selectTestViewModel(state);
    });
  }

  protected async handle(intent: TestIntent): Promise<void> {
    switch (intent.type) {
      case "loadRequested": {
        const run = this.loadRun.begin();
        this.emit({ type: "loadStarted" });
        try {
          const value = await this.ports.load(intent.key);
          // --- A newer load already answered; this result is stale
          if (!run.isCurrent()) return;
          this.emit({ type: "loadSettled", value });
        } catch (error) {
          if (!run.isCurrent()) return;
          this.emit({ type: "loadFailed", error: messageOf(error) });
        }
        return;
      }
      case "cleared":
        this.emit({ type: "cleared" });
        return;
      case "throwsSync":
        throw new Error("sync boom");
      case "throwsAsync":
        await Promise.resolve();
        throw new Error("async boom");
    }
  }

  protected onUnhandled(error: unknown): void {
    this.unhandled.push(error);
  }

  dispose(): void {
    this.loadRun.cancelAll();
    super.dispose();
  }
}
