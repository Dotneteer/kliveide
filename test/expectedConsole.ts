import { onTestFinished, vi } from "vitest";

/**
 * Silences console output that a test provokes on purpose and hands back the spy, so the
 * test can assert the message instead of printing it.
 *
 * A test that drives a failure path (a rejected port, a corrupt file, a crashed child
 * process) makes the code log that failure, which is correct behaviour - but printed, it
 * reads as a problem in an otherwise green run. Asserting it keeps the log line covered
 * and the run quiet. The spy is restored when the test finishes, pass or fail.
 */
export function expectConsole(method: "error" | "warn" | "log" = "error") {
  const spy = vi.spyOn(console, method).mockImplementation(() => {});
  onTestFinished(() => spy.mockRestore());
  return spy;
}

/**
 * Stops jsdom from printing an error that a test throws through React on purpose.
 *
 * React 18 re-throws a render error inside a synthetic event so the browser reports it;
 * jsdom does that by writing straight to stderr, past `console.error`, so a console spy
 * cannot catch it. Cancelling the window `error` event is how a page opts out of that
 * report. Removed when the test finishes.
 */
export function suppressUncaughtErrors(): void {
  const cancel = (event: Event) => event.preventDefault();
  window.addEventListener("error", cancel);
  onTestFinished(() => window.removeEventListener("error", cancel));
}
