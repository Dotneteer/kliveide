import { t } from "@common/i18n/i18n";

/*
 * "Export as source" started from the UI — a listing's header button, its tools menu, or
 * Debug › Export Disassembly as Source… — rather than typed as `export-asm`.
 *
 * Every entry point does the same three things: a save dialog, the `export-asm` command (which
 * always assembles the file and compares it with the bytes it came from), and a message box with
 * the command's verdict. The verdict is shown because the command's output goes to the Commands
 * pane, which is usually hidden when a button or a menu runs it. The renderer and the main process
 * share the texts and the command line here, so the two paths cannot drift apart.
 */

/** What is exported: a range of the 64K view under the current paging, or one bank. */
export type SourceExportScope =
  /** `name`: the suggested file name's stem, instead of `range-<from>-<to>` */
  | { kind: "range"; from: number; to: number; name?: string }
  | { kind: "bank"; bank: number; hostName?: string };

/** The live Disassembly view's export, which the Debug menu runs too: the RAM of the 64K view. */
export const LIVE_VIEW_EXPORT_SCOPE: SourceExportScope = { kind: "range", from: 0x4000, to: 0xffff };

/**
 * The setting with the folder exports are saved in: the project's in a Klive project, the user's
 * otherwise (a user's folder does not reach into projects). Unset, the
 * save dialog suggests `<project>/SourceExports` in a Klive project and `<home>/KliveExports/source`
 * otherwise, and the folder the user picks is written back (`src/main/source-export-folder.ts`).
 */
export const SOURCE_EXPORT_FOLDER_SETTING = "export.sourceFolder";

const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, "0");
const quote = (path: string) => `"${path.replace(/"/g, '\\"')}"`;

/** The save dialog's options: title, suggested file name (in the export folder), filter. */
export function sourceExportDialogOptions(scope: SourceExportScope): {
  title: string;
  defaultName: string;
  filters: { name: string; extensions: string[] }[];
} {
  const baseName =
    scope.kind === "range"
      ? (scope.name ?? `range-${hex4(scope.from)}-${hex4(scope.to)}`)
      : `${scope.hostName ?? "bank"}-bank${scope.bank}`;
  return {
    title: t("media.sourceExport.dialogTitle"),
    defaultName: `${baseName}.kz80.asm`,
    filters: [{ name: t("media.sourceExport.filter"), extensions: ["kz80.asm", "asm"] }]
  };
}

/** The `export-asm` command line for a file the dialog returned: exported, verified, opened. */
export function sourceExportCommandText(file: string, scope: SourceExportScope): string {
  const where = scope.kind === "range" ? `$${hex4(scope.from)} $${hex4(scope.to)}` : `-bank ${scope.bank}`;
  return `export-asm ${quote(file)} ${where} -open`;
}

/** The message box after the command: the file and the verdict, an error when it is not identical. */
export function sourceExportResultMessage(
  file: string,
  result: { success?: boolean; finalMessage?: string } | undefined
): { type: "info" | "error"; title: string; message: string } {
  const verdict = result?.finalMessage ?? t("media.sourceExport.noResult");
  return {
    type: result?.success ? "info" : "error",
    title: t("media.sourceExport.dialogTitle"),
    message: result?.success
      ? t("media.sourceExport.verified", { file, verdict })
      : t("media.sourceExport.notVerified", { file, verdict })
  };
}
