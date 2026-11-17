import { t } from "@common/i18n/i18n";
import { formatMegabytes, type NextSdCardFailure } from "@common/zxnext/nextSdDownload";

import type { NextSdDownloadState } from "./NextSdDownloadModel";

/*
 * Everything the Next SD card download dialog renders, derived from state. Each display rule lives
 * here, so the tests assert it without React.
 */

export type NextSdDownloadViewModel = {
  title: string;
  intro: string;
  /**
   * The progress row keeps its place while idle, so starting a download never resizes the dialog
   * (`dev/ai/ui-theming-intent-and-lessons.md`, the download progress bar). `active`: a download runs.
   */
  progress: { active: boolean; percent: number; text: string };
  error?: { text: string; detail: string };
  url: { text: string; copyLabel: string };
  primary: { label: string; enabled: boolean };
  secondary: { label: string; enabled: boolean };
  cancel: { label: string; enabled: boolean };
};

/** Bytes as megabytes with one decimal, the way the dialog shows sizes */
export function megabytes(bytes: number): string {
  return formatMegabytes(bytes);
}

export function selectViewModel(state: NextSdDownloadState): NextSdDownloadViewModel {
  const { data, phase } = state;
  const idle = phase === "offer" || phase === "failed";
  const retry = phase === "failed" && state.error?.during === "download";
  const percent = data.gzSize > 0 ? Math.min(100, Math.floor((state.received * 100) / data.gzSize)) : 0;
  return {
    title: t("dialog.nextSdDownload.title"),
    intro: t("dialog.nextSdDownload.intro", {
      model: data.modelName,
      download: megabytes(data.gzSize),
      size: megabytes(data.size)
    }),
    progress: {
      active: phase === "downloading",
      percent: phase === "downloading" ? percent : 0,
      text:
        phase === "downloading"
          ? t("dialog.nextSdDownload.progress", { received: megabytes(state.received), total: megabytes(data.gzSize) })
          : phase === "importing"
            ? t("dialog.nextSdDownload.importing")
            : t("dialog.nextSdDownload.notDownloading")
    },
    error: phase === "failed" && state.error ? errorOf(state.error.during, state.error.failure, state) : undefined,
    url: {
      text: data.url,
      copyLabel: state.urlCopied ? t("dialog.nextSdDownload.copied") : t("dialog.nextSdDownload.copy")
    },
    primary: {
      label: retry ? t("dialog.nextSdDownload.retry") : t("dialog.nextSdDownload.download"),
      enabled: idle
    },
    secondary: { label: t("dialog.nextSdDownload.import"), enabled: idle },
    cancel: { label: t("common.button.cancel"), enabled: phase !== "importing" }
  };
}

function errorOf(
  during: "download" | "import",
  failure: NextSdCardFailure,
  state: NextSdDownloadState
): { text: string; detail: string } {
  return { text: errorText(during, failure, state), detail: failure.message };
}

function errorText(during: "download" | "import", failure: NextSdCardFailure, state: NextSdDownloadState): string {
  switch (failure.kind) {
    case "network":
      return t("dialog.nextSdDownload.error.network");
    case "http":
      return t("dialog.nextSdDownload.error.http", { status: String(failure.detail ?? "") });
    case "redirected":
      return t("dialog.nextSdDownload.error.redirected");
    case "noSpace":
      return t("dialog.nextSdDownload.error.noSpace", { size: megabytes(failure.detail ?? 0) });
    case "cancelled":
      return t("dialog.nextSdDownload.error.cancelled");
    case "unreadable":
      return t("dialog.nextSdDownload.error.unreadable");
    case "wrongCard":
      return during === "import"
        ? t("dialog.nextSdDownload.error.wrongImport", { model: state.data.modelName })
        : t("dialog.nextSdDownload.error.wrongDownload");
    case "encoded":
    case "tooLarge":
      return t("dialog.nextSdDownload.error.wrongDownload");
  }
}
