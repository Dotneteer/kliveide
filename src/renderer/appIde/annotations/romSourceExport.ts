import type { RomPageKind } from "@common/roms/romIdentity";
import type { AssembledText, MainApi } from "@common/messaging/MainApi";
import type { SourceLine } from "@common/reverse/sourceExport";
import type { ProgramAnnotations } from "./programAnnotations";

import { t } from "@common/i18n/i18n";
import { exportSource, kliveDialect } from "@common/reverse/sourceExport";
import { DEFAULT_REGION, getBankAnnotation } from "./programAnnotations";
import { prepareRomDisassembler } from "./romDecoder";
import type { RomPageMatch } from "./romSidecarMatch";

/*
 * Export a whole ROM annotation file as one Klive Z80 source file that reassembles to the ROM
 * (the ROM annotation editor's "Export as source").
 *
 * Every page the sidecar names is listed from offset 0 at `$0000` — where a ROM page is paged in —
 * by the same walk `export-asm` uses (`exportSource`), with the page's own decoding (report codes
 * after `RST $08`, calculator literals after `RST $28`). A ROM of more than one page (128K, +3)
 * would define its pages' names side by side at the same addresses, so each page of such a ROM is
 * its own `.module`, and its `.org $0000` starts its own output segment.
 *
 * The check assembles the text and compares the segments, in order, with the pages: the export is
 * good only when the assembled output is the ROM image byte for byte.
 */

export type RomExportPage = {
  page: number;
  bytes: Uint8Array;
  kind?: RomPageKind;
  name?: string;
  crc32?: string;
};

export type RomSourceExport = {
  text: string;
  /** What was changed to make it assemble: renamed labels, `.defb` stand-ins. */
  notes: string[];
  /** The pages exported, in file order: what the assembled output must be. */
  pages: RomExportPage[];
};

export type RomExportVerdict =
  | { kind: "identical"; bytes: number }
  | { kind: "notAssembled"; line: number; message: string }
  | { kind: "different"; differences: RomByteDifference[] };

export type RomByteDifference = {
  page: number;
  /** The offset in the page; `undefined` with `missingPage` when the page produced no output. */
  offset?: number;
  expected?: number;
  actual?: number;
  /** The output's segment for the page starts somewhere other than `$0000`. */
  startAddress?: number;
};

/** The module name a page of a multi-page ROM is exported in. */
export function romPageModuleName(page: number): string {
  return `RomPage${page}`;
}

export async function buildRomSourceExport(
  annotations: ProgramAnnotations,
  pages: readonly RomExportPage[],
  options: { header?: string[] } = {}
): Promise<RomSourceExport> {
  const ordered = [...pages].sort((a, b) => a.page - b.page);
  const multiPage = ordered.length > 1;
  const notes: string[] = [];
  const lines: SourceLine[] = (options.header ?? []).map((text) => ({ kind: "comment", text }));
  if (lines.length) lines.push({ kind: "blank" });

  for (const page of ordered) {
    const pageAnnotations = withPage(annotations, page.page, page.bytes.length);
    const result = await exportSource({
      annotations: pageAnnotations,
      bank: page.page,
      bytes: page.bytes,
      listingBase: 0,
      z80n: false,
      skip: "data",
      prepareDisassembler: page.kind ? (disassembler) => prepareRomDisassembler(disassembler, page.kind) : undefined
    });
    notes.push(...result.notes.map((note) => (multiPage ? `page ${page.page}: ${note}` : note)));

    lines.push({ kind: "comment", text: "=".repeat(72) });
    lines.push({
      kind: "comment",
      text: `ROM page ${page.page}${page.name ? `: ${page.name}` : ""}${page.crc32 ? ` (CRC ${page.crc32})` : ""}`
    });
    lines.push({ kind: "comment", text: "=".repeat(72) });
    lines.push({ kind: "blank" });
    if (multiPage) {
      lines.push({ kind: "row", label: romPageModuleName(page.page), text: ".module" });
    }
    lines.push(...result.lines);
    if (multiPage) lines.push({ kind: "directive", text: ".endmodule" });
    lines.push({ kind: "blank" });
  }
  return { text: kliveDialect.render(lines), notes: [...new Set(notes)], pages: ordered };
}

/**
 * Compare what the export assembled to with the ROM: segment `i` must be page `i`, starting at
 * `$0000`, byte for byte.
 */
export function compareRomAssembly(
  pages: readonly RomExportPage[],
  assembled: AssembledText,
  limit = 5
): RomExportVerdict {
  const error = assembled.errors.find((e) => !e.isWarning);
  if (error) return { kind: "notAssembled", line: error.line, message: error.message };
  const segments = assembled.segments.filter((s) => s.emittedCode.length > 0);
  const differences: RomByteDifference[] = [];
  let total = 0;
  for (let i = 0; i < Math.max(pages.length, segments.length) && differences.length < limit; i++) {
    const page = pages[i];
    const segment = segments[i];
    if (!page) {
      differences.push({ page: pages.length, offset: 0, actual: segment.emittedCode[0] });
      break;
    }
    if (!segment) {
      differences.push({ page: page.page, offset: 0, expected: page.bytes[0] });
      break;
    }
    if (segment.startAddress !== 0) {
      differences.push({ page: page.page, startAddress: segment.startAddress });
      continue;
    }
    const length = Math.max(page.bytes.length, segment.emittedCode.length);
    for (let offset = 0; offset < length && differences.length < limit; offset++) {
      const expected = offset < page.bytes.length ? page.bytes[offset] : undefined;
      const actual = segment.emittedCode[offset];
      if (expected !== actual) {
        differences.push({
          page: page.page,
          offset,
          ...(expected !== undefined ? { expected } : {}),
          ...(actual !== undefined ? { actual } : {})
        });
      }
    }
    total += page.bytes.length;
  }
  return differences.length ? { kind: "different", differences } : { kind: "identical", bytes: total };
}

/** The annotations with the page present: a page the sidecar names but has not annotated is code. */
function withPage(annotations: ProgramAnnotations, page: number, size: number): ProgramAnnotations {
  if (getBankAnnotation(annotations, page)) return annotations;
  return {
    ...annotations,
    banks: {
      ...annotations.banks,
      [String(page)]: { offsetIndex: 0, regions: [{ ...DEFAULT_REGION, end: Math.min(DEFAULT_REGION.end, size - 1) }] }
    }
  };
}

// ------------------------------------------------------------------------------------------------

export type RomExportRun = {
  verdict: RomExportVerdict;
  notes: string[];
  /** Pages the sidecar names whose bytes were found nowhere: left out of the export. */
  missingPages: number[];
};

/**
 * Export a ROM sidecar's annotations to `file`, then assemble the file and compare the output with
 * the ROM — always: an export is reported only together with its check. What the ROM annotation
 * editor and `rom-ann-export` run.
 */
export async function runRomSourceExport(
  mainApi: Pick<MainApi, "saveTextFile" | "assembleText">,
  sidecar: { path: string; annotations: ProgramAnnotations; matches: readonly RomPageMatch[] },
  file: string
): Promise<RomExportRun> {
  const pages: RomExportPage[] = sidecar.matches
    .filter((match) => match.bytes)
    .map((match) => ({
      page: match.page,
      bytes: match.bytes!,
      ...(match.kind ? { kind: match.kind } : {}),
      ...(match.name ? { name: match.name } : {}),
      crc32: match.crc32
    }));
  const missingPages = sidecar.matches.filter((match) => !match.bytes).map((match) => match.page);
  if (pages.length === 0) throw new Error(t("media.romExport.noPages"));
  // --- The header is part of the exported file, which stays English
  const header = [
    `Exported by Klive IDE from ${sidecar.path.split(/[\\/]/).pop()}`,
    "Assemble with the Klive Z80 assembler; the output is the ROM, byte for byte.",
    ...(missingPages.length ? [`Left out (no ROM bytes found): page ${missingPages.join(", ")}`] : [])
  ];
  const exported = await buildRomSourceExport(sidecar.annotations, pages, { header });
  await mainApi.saveTextFile(file, exported.text);
  let verdict: RomExportVerdict;
  try {
    verdict = compareRomAssembly(exported.pages, await mainApi.assembleText(exported.text));
  } catch (err) {
    verdict = { kind: "notAssembled", line: 0, message: err instanceof Error ? err.message : String(err) };
  }
  return { verdict, notes: exported.notes, missingPages };
}

/** The verdict, worded for the editor and the command output. */
export function romExportVerdictText(verdict: RomExportVerdict): string {
  const hex = (n: number | undefined, width: number) =>
    n === undefined ? "--" : `$${n.toString(16).toUpperCase().padStart(width, "0")}`;
  switch (verdict.kind) {
    case "identical":
      return t("media.romExport.identical", { bytes: verdict.bytes });
    case "notAssembled":
      return verdict.line > 0
        ? t("media.romExport.notAssembled", { line: String(verdict.line), message: verdict.message })
        : t("media.romExport.notChecked", { message: verdict.message });
    case "different":
      return t("media.romExport.different", {
        differences: verdict.differences
          .map((d) =>
            d.startAddress !== undefined
              ? t("media.romExport.pageMoved", { page: d.page, address: hex(d.startAddress, 4) })
              : t("media.romExport.byteDiffers", {
                  page: d.page,
                  offset: hex(d.offset, 4),
                  expected: hex(d.expected, 2),
                  actual: hex(d.actual, 2)
                })
          )
          .join(", ")
      });
  }
}
