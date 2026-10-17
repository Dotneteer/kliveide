import { t } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";
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
  /** Shown once Boriel BASIC works: whether BASIC programs build with it. */
  useBoriel: { visible: boolean; value: boolean; enabled: boolean; note?: string };
  /** The install/"use existing" outcome, or a hint while one runs. */
  message?: { kind: "progress" | BorielOutcome["kind"]; text: string };
  licenceNote: string;
};

export const LICENCE_NOTE: MessageKey = "dialog.boriel.licenceNote";

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
        ? t("dialog.boriel.intro", { version: kit.version })
        : undefined,
    status: statusOf(state),
    kit: {
      available: kitAvailable,
      text:
        kit?.kind === "available"
          ? t("dialog.boriel.kit.bundled", { version: kit.version })
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
    cancel: {
      label: state.mode === "offer" ? t("dialog.boriel.button.notNow") : t("common.button.close"),
      enabled: working
    },
    dontAskAgain: { visible: state.mode === "offer", value: state.dontAskAgain, enabled: working },
    useBoriel: {
      visible: installation?.kind === "working",
      value: state.status?.compiler === "boriel",
      enabled: ready,
      note: state.status?.compilerFromProject
        ? t("dialog.boriel.useBoriel.projectNote")
        : undefined
    },
    message: messageOf(state),
    licenceNote: t(LICENCE_NOTE)
  };
}

/** Install, Update, Repair or Reinstall: what pressing the main button will do. */
export function primaryLabel(installation: BorielInstallation | undefined): string {
  switch (installation?.kind) {
    case "broken":
      return t("dialog.boriel.button.repair");
    case "working":
      return installation.outdated ? t("dialog.boriel.button.update") : t("dialog.boriel.button.reinstall");
    default:
      return t("dialog.boriel.button.install");
  }
}

function statusOf(state: BorielSetupState): BorielSetupViewModel["status"] {
  if (state.loadError) {
    return { kind: "error", headline: t("dialog.boriel.status.cannotCheck"), detail: state.loadError };
  }
  const installation = state.status?.installation;
  if (state.loading || !installation) return { kind: "loading", headline: t("dialog.boriel.status.checking"), detail: "" };
  switch (installation.kind) {
    case "notConfigured":
      return {
        kind: "none",
        headline: t("dialog.boriel.status.notInstalled"),
        detail: t("dialog.boriel.status.notInstalledDetail")
      };
    case "broken":
      return { kind: "broken", headline: t("dialog.boriel.status.notWorking"), detail: installation.error };
    case "working": {
      const kit = state.status?.kit;
      return installation.outdated && kit?.kind === "available"
        ? {
            kind: "outdated",
            headline: `Boriel BASIC ${installation.version}`,
            detail: t("dialog.boriel.status.updateAvailable", {
              path: installation.executablePath,
              version: kit.version
            })
          }
        : { kind: "working", headline: `Boriel BASIC ${installation.version}`, detail: installation.executablePath };
    }
  }
}

function messageOf(state: BorielSetupState): BorielSetupViewModel["message"] {
  if (state.busy === "install") return { kind: "progress", text: t("dialog.boriel.progress.installing") };
  if (state.busy === "existing") return { kind: "progress", text: t("dialog.boriel.progress.checkingExisting") };
  const { outcome } = state;
  if (!outcome) return undefined;
  if (outcome.kind === "failed") return { kind: "failed", text: outcome.text };
  const args = { version: outcome.version, folder: outcome.folder };
  return {
    kind: "installed",
    text:
      outcome.action === "install"
        ? t("dialog.boriel.outcome.installed", args)
        : t("dialog.boriel.outcome.usingExisting", args)
  };
}
