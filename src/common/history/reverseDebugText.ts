/*
 * The words of full reverse debugging's UI (`.plans/REVERSE_DEBUGGING_PLAN.md` §4.4), in one place so
 * the status bar, the commands and the docs say the same thing - and a test can pin them.
 */

import type { ReverseDebugState } from "@common/state/AppState";
import { t } from "@common/i18n/i18n";

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
  if (!state.active) return state.desync ? t("statusbar.reverse.stopped") : undefined;
  if (state.searchedIntervals !== undefined) {
    return t("statusbar.reverse.searching", { count: state.searchedIntervals });
  }
  if (state.mode === "replaying") {
    return t("statusbar.reverse.replaying", { time: formatReverseSeconds(state.behindSeconds ?? 0) });
  }
  if (state.mode === "navigating") {
    const time = formatReverseSeconds(state.behindSeconds ?? 0);
    const status = state.deepLanding
      ? t("statusbar.reverse.deep", { time })
      : historyStep
        ? t("statusbar.reverse.step", { time, step: historyStep })
        : t("statusbar.reverse.behind", { time });
    // --- A timeline opened from a debug recording names its file (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` D10)
    return state.recording ? t("statusbar.reverse.withFile", { status, file: state.recording }) : status;
  }
  return state.recording ? t("statusbar.reverse.recording", { file: state.recording }) : undefined;
}

/** The status bar's tooltip for a timeline */
export function reverseStatusTooltip(state: ReverseDebugState | undefined): string | undefined {
  if (!state) return undefined;
  if (!state.active) return state.desync ? t("statusbar.reverse.tip.stopped", { reason: state.desync }) : undefined;
  const lines: string[] = [];
  if (state.searchedIntervals !== undefined) {
    lines.push(t("statusbar.reverse.tip.searching"));
  } else if (state.mode === "replaying") {
    lines.push(t("statusbar.reverse.tip.replaying"));
  } else if (state.mode === "navigating") {
    lines.push(t("statusbar.reverse.tip.navigating"));
    if (state.deepLanding) lines.push(t("statusbar.reverse.tip.deep"));
  }
  if (state.inputsIgnored) lines.push(t("statusbar.reverse.tip.inputIgnored", { count: state.inputsIgnored }));
  if (state.rangeSeconds !== undefined) {
    lines.push(t("statusbar.reverse.tip.range", { time: formatReverseSeconds(state.rangeSeconds) }));
  }
  if (state.recording) lines.push(t("statusbar.reverse.tip.recording", { file: state.recording }));
  return lines.join("\n");
}

/**
 * What starts a fork (D12): Take over here, or an edit made while the machine stands in the past.
 * An id, not text: each one has its own whole question in the catalog.
 */
export type ForkAction =
  | { kind: "takeOver" }
  | { kind: "editMemory" }
  | { kind: "editRegister"; register: string }
  | { kind: "editVariable"; name: string };

/** The question the fork confirmation asks for an action */
function forkQuestion(action: ForkAction): string {
  switch (action.kind) {
    case "editMemory":
      return t("commands.fork.confirm.editMemory");
    case "editRegister":
      return t("commands.fork.confirm.editRegister", { register: action.register });
    case "editVariable":
      return t("commands.fork.confirm.editVariable", { name: action.name });
    default:
      return t("commands.fork.confirm.takeOver");
  }
}

/**
 * The fork confirmation (D12, T4): what the recorded future takes with it and what it leaves
 * @param action What starts the fork: Take over here, or an edit
 */
export function forkConfirmation(
  preview: ForkPreview | undefined,
  action: ForkAction = { kind: "takeOver" }
): { title: string; message: string; detail: string; confirmLabel: string } {
  const lines = [t("commands.fork.detail.discard")];
  if (preview?.sdWrites) {
    lines.push(t("commands.fork.detail.sdWrites", { count: preview.sdWrites }));
  }
  if (preview?.hostFiles.length) {
    lines.push(t("commands.fork.detail.hostFiles", { files: preview.hostFiles.join(", ") }));
  }
  return {
    title: t("commands.fork.title"),
    message: forkQuestion(action),
    detail: lines.join("\n\n"),
    confirmLabel: t("commands.fork.confirmLabel")
  };
}
