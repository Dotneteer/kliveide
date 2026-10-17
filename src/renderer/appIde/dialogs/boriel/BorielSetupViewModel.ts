import type { BorielInstallation } from "@common/messaging/BorielIntegration";

import type { BorielOutcome, BorielSetupState } from "./BorielSetupModel";

/*
 * Everything the Boriel BASIC setup dialog renders, derived from state. Each display rule lives
 * here, so the tests assert it without React.
 */

export type BorielStatusKind = "loading" | "error" | "none" | "working" | "outdated" | "broken";

export type BorielSetupViewModel = {
  mode: BorielSetupState["mode"];
  /** The offer's opening sentence; absent when opened from Settings. */
  intro?: string;
  status: { kind: BorielStatusKind; headline: string; detail: string };
  kit: { available: boolean; text: string };
  folder: { value: string; enabled: boolean };
  primary: { label: string; enabled: boolean };
  useExisting: { enabled: boolean };
  cancel: { label: string; enabled: boolean };
  dontAskAgain: { visible: boolean; value: boolean; enabled: boolean };
  /** The install/"use existing" outcome, or a hint while one runs. */
  message?: { kind: "progress" | BorielOutcome["kind"]; text: string };
  licenceNote: string;
};

export const LICENCE_NOTE = "Boriel BASIC 2.0 beta, redistributed with the author's permission.";

export function selectViewModel(state: BorielSetupState): BorielSetupViewModel {
  const kit = state.status?.kit;
  const kitAvailable = kit?.kind === "available";
  const working = !state.busy;
  const ready = !state.loading && !state.loadError && working;
  const installation = state.status?.installation;
  return {
    mode: state.mode,
    intro:
      state.mode === "offer" && kit?.kind === "available"
        ? `Klive comes with Boriel BASIC ${kit.version}, a ZX BASIC compiler you can use instead of ` +
          "Klive BASIC. Install it now? You can also do it later from Settings › Integrations."
        : undefined,
    status: statusOf(state),
    kit: {
      available: kitAvailable,
      text:
        kit?.kind === "available"
          ? `Boriel BASIC ${kit.version} (bundled with Klive)`
          : kit?.kind === "unavailable"
            ? kit.reason
            : ""
    },
    folder: { value: state.folder, enabled: ready && kitAvailable },
    primary: {
      label: primaryLabel(installation),
      enabled: ready && kitAvailable && !!state.folder.trim()
    },
    useExisting: { enabled: ready },
    cancel: { label: state.mode === "offer" ? "Not now" : "Close", enabled: working },
    dontAskAgain: { visible: state.mode === "offer", value: state.dontAskAgain, enabled: working },
    message: messageOf(state),
    licenceNote: LICENCE_NOTE
  };
}

/** Install, Update, Repair or Reinstall: what pressing the main button will do. */
export function primaryLabel(installation: BorielInstallation | undefined): string {
  switch (installation?.kind) {
    case "broken":
      return "Repair";
    case "working":
      return installation.outdated ? "Update" : "Reinstall";
    default:
      return "Install";
  }
}

function statusOf(state: BorielSetupState): BorielSetupViewModel["status"] {
  if (state.loadError) return { kind: "error", headline: "Cannot check Boriel BASIC", detail: state.loadError };
  const installation = state.status?.installation;
  if (state.loading || !installation) return { kind: "loading", headline: "Checking...", detail: "" };
  switch (installation.kind) {
    case "notConfigured":
      return { kind: "none", headline: "Not installed", detail: "Klive BASIC builds your BASIC programs." };
    case "broken":
      return { kind: "broken", headline: "Not working", detail: installation.error };
    case "working": {
      const kit = state.status?.kit;
      return installation.outdated && kit?.kind === "available"
        ? {
            kind: "outdated",
            headline: `Boriel BASIC ${installation.version}`,
            detail: `${installation.executablePath} · version ${kit.version} is available`
          }
        : { kind: "working", headline: `Boriel BASIC ${installation.version}`, detail: installation.executablePath };
    }
  }
}

function messageOf(state: BorielSetupState): BorielSetupViewModel["message"] {
  if (state.busy === "install") return { kind: "progress", text: "Installing Boriel BASIC..." };
  if (state.busy === "existing") return { kind: "progress", text: "Checking the selected installation..." };
  return state.outcome;
}
