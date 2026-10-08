/*
 * The words of full reverse debugging's UI (`.plans/REVERSE_DEBUGGING_PLAN.md` §4.4), in one place so
 * the status bar, the commands and the docs say the same thing - and a test can pin them.
 */

import type { ReverseDebugState } from "@common/state/AppState";

/** What Take over here would leave behind (T4) */
export type ForkPreview = { sdWrites: number; hostFiles: string[] };

/**
 * Machine time as the status bar shows it: "42 µs", "3.5 ms", "35 ms", "1.24 s", "41 s", "12 min 3 s".
 * A few instructions back is microseconds, which "0.00 s" would hide.
 */
export function formatReverseSeconds(seconds: number): string {
  if (seconds < 0.001) return `${Math.round(seconds * 1_000_000)} µs`;
  if (seconds < 0.01) return `${(seconds * 1000).toFixed(1)} ms`;
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  if (seconds < 10) return `${seconds.toFixed(2)} s`;
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${Math.round(seconds - minutes * 60)} s`;
}

/** The status bar's label for a timeline, or undefined at the present with nothing to say */
export function reverseStatusText(state: ReverseDebugState | undefined, historyStep?: string): string | undefined {
  if (!state) return undefined;
  if (!state.active) return state.desync ? "⚠ Reverse debugging stopped" : undefined;
  if (state.searchedIntervals !== undefined) {
    return `⟲ Searching back… ${state.searchedIntervals} interval${state.searchedIntervals === 1 ? "" : "s"}`;
  }
  if (state.mode === "replaying") {
    return `▶ Replaying · ${formatReverseSeconds(state.behindSeconds ?? 0)} to present`;
  }
  // --- A timeline opened from a debug recording names its file (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` D10)
  const file = state.recording ? ` · ${state.recording}` : "";
  if (state.mode === "navigating") {
    const behind = `⟲ −${formatReverseSeconds(state.behindSeconds ?? 0)}`;
    if (state.deepLanding) return `${behind} · before the history window${file}`;
    return `${historyStep ? `${behind} · step ${historyStep}` : behind}${file}`;
  }
  return state.recording ? `Recording: ${state.recording}` : undefined;
}

/** The status bar's tooltip for a timeline */
export function reverseStatusTooltip(state: ReverseDebugState | undefined): string | undefined {
  if (!state) return undefined;
  if (!state.active) return state.desync ? `Reverse debugging stopped: ${state.desync}` : undefined;
  const lines: string[] = [];
  if (state.searchedIntervals !== undefined) {
    lines.push("Reverse Continue is replaying the past, keyframe interval by interval. Click to cancel.");
  } else if (state.mode === "replaying") {
    lines.push("The machine runs from the past toward the present; the recorded input plays.");
  } else if (state.mode === "navigating") {
    lines.push("The machine stands in the past: every panel shows that moment. Click to return to the present.");
    if (state.deepLanding) lines.push("The point is older than the history window: the history shows the run up to it.");
  }
  if (state.inputsIgnored) {
    lines.push(`Input ignored while in the past (${state.inputsIgnored}): use Take over here to continue from this point.`);
  }
  if (state.rangeSeconds !== undefined) lines.push(`Reverse range: ${formatReverseSeconds(state.rangeSeconds)}`);
  if (state.recording) lines.push(`Opened from the debug recording ${state.recording}: its past is the file's`);
  return lines.join("\n");
}

/**
 * The fork confirmation (D12, T4): what the recorded future takes with it and what it leaves
 * @param action What starts the fork: "Take over here", or an edit
 */
export function forkConfirmation(
  preview: ForkPreview | undefined,
  action = "Take over here"
): { title: string; message: string; detail: string; confirmLabel: string } {
  const lines = [
    "The recorded future after this point is discarded: its input, keyframes and history. The machine continues live from here."
  ];
  if (preview?.sdWrites) {
    lines.push(
      `The SD card's ${preview.sdWrites} sector write${preview.sdWrites === 1 ? "" : "s"} in that future will be undone.`
    );
  }
  if (preview?.hostFiles.length) {
    lines.push(`Files saved to tape in that future stay on disk: ${preview.hostFiles.join(", ")}.`);
  }
  return {
    title: "Take Over Here",
    message: action === "Take over here" ? "Continue from this point in the past?" : `${action} in the past?`,
    detail: lines.join("\n\n"),
    confirmLabel: "Take Over"
  };
}
