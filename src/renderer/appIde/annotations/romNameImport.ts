import type { RawRomSidecar } from "@common/roms/romAnnotationTools";

import { ANNOTATION_LABEL_MAX_LENGTH, isValidLabelName } from "./programAnnotations";
import { romSidecarText } from "./romSidecarWriter";

/*
 * Importing a list of conventional routine names into a ROM's working copy
 * (`.ai/rom-annotations/README.md`, "Routine names (Q1)"; `rom-ann-import-names`).
 *
 * A name list is an interface vocabulary: the names, and the addresses they name — never the
 * comments, region boundaries or descriptions that come with them. So the input is nothing but
 * `NAME ADDRESS` lines, and every name imported is a page label recorded `manual`.
 *
 * Names are written as identifiers (A10): `CL-ALL` becomes `CL_ALL`, `STK-STO-$` becomes
 * `STK_STO_STR`. A name that cannot be one — too long for a label, or with nothing usable left — is
 * reported, never shortened or guessed at: choosing a shorter name is the author's call.
 */

export type RomNameEntry = { name: string; address: number; line: number };

export type RomNameListParse = {
  entries: RomNameEntry[];
  /** Lines that are neither blank, a comment, nor `NAME ADDRESS`. */
  problems: string[];
};

/**
 * Read a name list: one `NAME ADDRESS` per line. The address is `$0A2A`, `0x0A2A`, `0A2Ah` or decimal;
 * `#` or `;` starts a comment; blank lines are ignored.
 */
export function parseRomNameList(text: string): RomNameListParse {
  const entries: RomNameEntry[] = [];
  const problems: string[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.replace(/[#;].*$/, "").trim();
    if (!line) return;
    const match = /^(\S+)\s+(\S+)$/.exec(line);
    const address = match ? parseAddress(match[2]) : undefined;
    if (!match || address === undefined) {
      problems.push(`Line ${index + 1}: expected NAME ADDRESS, found "${raw.trim()}".`);
      return;
    }
    entries.push({ name: match[1], address, line: index + 1 });
  });
  return { entries, problems };
}

function parseAddress(text: string): number | undefined {
  let value: number;
  if (/^\$[0-9a-f]+$/i.test(text)) value = parseInt(text.slice(1), 16);
  else if (/^0x[0-9a-f]+$/i.test(text)) value = parseInt(text.slice(2), 16);
  else if (/^[0-9a-f]+h$/i.test(text)) value = parseInt(text.slice(0, -1), 16);
  else if (/^\d+$/.test(text)) value = parseInt(text, 10);
  else return undefined;
  return value >= 0 && value <= 0xffff ? value : undefined;
}

/**
 * A conventional name as a Klive identifier: `$` reads `STR` (the BASIC string suffix), anything else
 * that cannot be in a label becomes `_`, runs of `_` collapse, and none is left at either end. Case is
 * kept. Returns the text even when it is too long; the caller checks it.
 */
export function romIdentifierOf(name: string): string {
  return name
    .replace(/\$/g, "STR")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export type RomNameImport = {
  /** The working copy's new text, or `undefined` when nothing was added. */
  text?: string;
  added: { name: string; address: number; from?: string }[];
  skipped: { name: string; address: number; reason: string }[];
};

/**
 * Add a name list to one page of a ROM sidecar, as `manual` labels.
 *
 * Existing labels always win: an offset that already has a label, or a name already in use on the
 * page, is skipped and reported, so importing never overwrites the author's own work and can be run
 * again after the list is corrected.
 *
 * @param raw The working copy as it is on disk
 * @param page The page the names describe
 * @param pageSize The page's size: an address at or past it is not in the page
 * @param pageStart The address offset 0 of the page is at (`$0000` for every ROM page)
 */
export function importRomNames(
  raw: RawRomSidecar,
  page: number,
  pageSize: number,
  entries: readonly RomNameEntry[],
  pageStart = 0
): RomNameImport {
  const key = String(page);
  const bank = raw.banks?.[key];
  const added: RomNameImport["added"] = [];
  const skipped: RomNameImport["skipped"] = [];
  if (!bank) {
    return {
      added,
      skipped: entries.map((entry) => ({ ...entry, reason: `the sidecar has no page ${page}` }))
    };
  }

  const labels: { name: string; value: number }[] = [...(bank.localLabels ?? [])];
  const byOffset = new Map(labels.map((label) => [label.value, label.name]));
  const names = new Set(labels.map((label) => label.name));
  for (const entry of entries) {
    const offset = entry.address - pageStart;
    const name = romIdentifierOf(entry.name);
    const skip = (reason: string) => skipped.push({ name: entry.name, address: entry.address, reason });
    if (offset < 0 || offset >= pageSize) {
      skip("the address is not in this ROM page");
    } else if (!name) {
      skip("nothing of the name is usable in a label");
    } else if (name.length > ANNOTATION_LABEL_MAX_LENGTH) {
      skip(`${name} is longer than ${ANNOTATION_LABEL_MAX_LENGTH} characters: choose a shorter name`);
    } else if (!isValidLabelName(name)) {
      skip(`${name} is not a valid label name`);
    } else if (byOffset.has(offset)) {
      skip(
        byOffset.get(offset) === name
          ? "already there"
          : `the address already has the label ${byOffset.get(offset)}`
      );
    } else if (names.has(name)) {
      skip(`${name} is already used at another address`);
    } else {
      labels.push({ name, value: offset });
      byOffset.set(offset, name);
      names.add(name);
      added.push({ name, address: entry.address, ...(name !== entry.name ? { from: entry.name } : {}) });
    }
  }
  if (added.length === 0) return { added, skipped };

  const banks = { ...raw.banks, [key]: { ...bank, localLabels: labels } };
  return { text: romSidecarText(raw, banks, "manual"), added, skipped };
}
