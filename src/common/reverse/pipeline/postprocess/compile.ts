import { formatRomSidecar, provenanceKeysOf, type Provenance, type RawRomSidecar } from "@common/roms/romAnnotationTools";
import {
  hex,
  parseAnn,
  type AnnDocument,
  type AnnFeedback,
  type AnnQuestion,
  type AnnRegion
} from "../annFormat";
import type { Cpu } from "../image/cpu";
import { sidecarRegionOf, type SidecarRegion } from "./regionKinds";
import { dropKeptMarks, nameNumbers, wrapSynopsis } from "./textPass";

/*
 * The postprocessor's core (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §6.1, P1): `.ann` files laid over
 * one page of a base sidecar. Pure: text in, the new sidecar, its canonical text and a problem list
 * out; the CLI reads and writes the files and measures the level.
 *
 * - An entry in a `.ann` file replaces the base's entry at the same place: a label, a synopsis, a
 *   comment, the bytes a region covers (the base's regions are cut around it). Every replaced base
 *   entry is listed in `changes`, so a carried sidecar's text is never overwritten unseen.
 * - Two `.ann` files that disagree (one offset, two names; overlapping regions; one name at two
 *   offsets) are errors, not a silent "last one wins".
 * - Provenance: an entry a file sets takes that file's mark for it, else its default; a base entry
 *   keeps its own; a region piece cut from a base region keeps that region's. Keys that name nothing
 *   any more are dropped, and an entry left without one is an error.
 */

export type CompileProblem = {
  severity: "error" | "warning";
  message: string;
  file?: string;
  line?: number;
};

/** A base entry a `.ann` file replaced or removed. */
export type CompileChange = {
  offset: number;
  what: "label" | "synopsis" | "comment" | "region";
  before?: string;
  after?: string;
  file: string;
  line: number;
};

export type CompileInput = {
  /** The sidecar the files are laid over; it is not modified. */
  base: RawRomSidecar;
  /** The page the files must name, and the ROM file and CPU their headers must match. */
  page: number;
  rom: string;
  cpu: Cpu;
  /** The page's size in bytes: offsets past it are errors, and the regions must cover it. */
  pageSize: number;
  ann: readonly { fileName: string; text: string }[];
  /**
   * The text pass (`textPass.ts`): wrapping a changed synopsis's long lines (default on) and naming
   * labelled offsets (default off). Kept-number marks (`$0B40!`) are always dropped.
   */
  text?: { wrap?: boolean; nameNumbers?: boolean };
};

export type CompileResult = {
  sidecar: RawRomSidecar;
  /** The sidecar in its canonical form (`formatRomSidecar`). */
  text: string;
  problems: CompileProblem[];
  changes: CompileChange[];
  questions: (AnnQuestion & { file: string })[];
  feedback: (AnnFeedback & { file: string })[];
  /** Numbers the naming pass swapped for labels, by offset. */
  swaps: { offset: number; swaps: string[] }[];
  /** The offsets whose label or line a file set: what the lint looks at. */
  touched: { labels: Set<number>; lines: Set<number>; regions: AnnRegion[] };
};

type Bank = {
  regions: SidecarRegion[];
  localLabels: { name: string; value: number }[];
  lineAnnotations: Record<string, { synopsis?: string; comment?: string }>;
  [key: string]: unknown;
};

/** Lays the `.ann` files over the base's page. */
export function compileAnnotations(input: CompileInput): CompileResult {
  const problems: CompileProblem[] = [];
  const changes: CompileChange[] = [];
  const error = (message: string, file?: string, line?: number) => problems.push({ severity: "error", message, file, line });
  const warning = (message: string, file?: string, line?: number) =>
    problems.push({ severity: "warning", message, file, line });

  const sidecar: RawRomSidecar = structuredClone(input.base);
  const pageKey = String(input.page);
  const bank = sidecar.banks?.[pageKey] as Bank | undefined;
  if (!bank) {
    error(`The base sidecar has no bank for page ${input.page}`);
    return {
      sidecar,
      text: formatRomSidecar(sidecar),
      problems,
      changes,
      questions: [],
      feedback: [],
      swaps: [],
      touched: { labels: new Set(), lines: new Set(), regions: [] }
    };
  }
  bank.regions ??= [];
  bank.localLabels ??= [];
  bank.lineAnnotations ??= {};
  const last = input.pageSize - 1;

  // --- Parse every file and check its header
  const files: { name: string; document: AnnDocument }[] = [];
  for (const { fileName, text } of input.ann) {
    const parsed = parseAnn(text, fileName);
    for (const p of parsed.problems) error(p.message, p.file, p.line);
    const header = parsed.document.header;
    if (header) {
      if (baseName(header.rom) !== baseName(input.rom)) error(`The file is for ${header.rom}, not ${input.rom}`, fileName, 1);
      if (header.page !== input.page) error(`The file is for page ${header.page}, not page ${input.page}`, fileName, 1);
      if (header.cpu !== input.cpu) error(`The file says cpu ${header.cpu}; the image is ${input.cpu} (D2)`, fileName, 1);
    }
    files.push({ name: fileName, document: parsed.document });
  }

  checkRanges();
  checkConflicts();

  // --- Provenance the files give, by sidecar key (without the page)
  const setBy = new Map<string, Provenance>();
  const swaps: { offset: number; swaps: string[] }[] = [];
  const marked = new Map<string, Provenance>();
  for (const { document } of files) {
    for (const mark of document.provenance) marked.set(`${mark.offset}:${mark.kind}`, mark.provenance);
  }

  applyDeletes();
  const inherited = applyRegions();
  applyLabels();
  applyTexts();
  const duplicates = duplicateNames(bank.localLabels);
  for (const [name, offsets] of duplicates) {
    error(`Label ${name} is on ${offsets.map((o) => `$${hex(o)}`).join(" and ")}`);
  }
  checkCoverage();
  settleProvenance(inherited);

  const questions = files.flatMap(({ name, document }) => document.questions.map((q) => ({ ...q, file: name })));
  const feedback = files.flatMap(({ name, document }) => document.feedback.map((f) => ({ ...f, file: name })));
  const touched = {
    labels: new Set(files.flatMap(({ document }) => document.labels.map((l) => l.offset))),
    lines: new Set(files.flatMap(({ document }) => [...document.synopses, ...document.comments].map((t) => t.offset))),
    regions: files.flatMap(({ document }) => document.regions)
  };
  return { sidecar, text: formatRomSidecar(sidecar), problems, changes, questions, feedback, swaps, touched };

  // ----------------------------------------------------------------------------------------------

  function checkRanges() {
    for (const { name, document } of files) {
      const outside = (offset: number) => offset < 0 || offset > last;
      for (const r of document.regions) {
        if (outside(r.start) || outside(r.end)) error(`Region ${hex(r.start)}-${hex(r.end)} is outside the page`, name, r.line);
      }
      for (const e of [...document.labels, ...document.synopses, ...document.comments]) {
        if (outside(e.offset)) error(`Offset ${hex(e.offset)} is outside the page`, name, e.line);
      }
    }
  }

  /** Disagreements between (and within) the files. */
  function checkConflicts() {
    const labelAt = new Map<number, { name: string; file: string }>();
    const offsetOf = new Map<string, { offset: number; file: string }>();
    const textAt = new Map<string, { text: string; file: string }>();
    const regions: { region: AnnRegion; file: string }[] = [];
    for (const { name: file, document } of files) {
      for (const label of document.labels) {
        const other = labelAt.get(label.offset);
        if (other && other.name !== label.name) {
          error(`$${hex(label.offset)} is ${label.name} here and ${other.name} in ${other.file}`, file, label.line);
        }
        labelAt.set(label.offset, { name: label.name, file });
        const elsewhere = offsetOf.get(label.name);
        if (elsewhere && elsewhere.offset !== label.offset) {
          error(`${label.name} is $${hex(label.offset)} here and $${hex(elsewhere.offset)} in ${elsewhere.file}`, file, label.line);
        }
        offsetOf.set(label.name, { offset: label.offset, file });
      }
      const seenComments = new Set<number>();
      for (const comment of document.comments) {
        if (seenComments.has(comment.offset)) error(`Two comments for $${hex(comment.offset)}`, file, comment.line);
        seenComments.add(comment.offset);
      }
      for (const [what, entries] of [["synopsis", document.synopses], ["comment", document.comments]] as const) {
        for (const entry of entries) {
          const key = `${entry.offset}:${what}`;
          const other = textAt.get(key);
          if (other && other.file !== file && other.text !== entry.text) {
            error(`The ${what} of $${hex(entry.offset)} differs from the one in ${other.file}`, file, entry.line);
          }
          textAt.set(key, { text: entry.text, file });
        }
      }
      for (const region of document.regions) {
        for (const other of regions) {
          if (region.start <= other.region.end && other.region.start <= region.end) {
            const where = other.file === file ? `line ${other.region.line}` : other.file;
            error(`Region ${hex(region.start)}-${hex(region.end)} overlaps ${hex(other.region.start)}-${hex(other.region.end)} (${where})`, file, region.line);
          }
        }
        regions.push({ region, file });
      }
    }
  }

  function applyDeletes() {
    for (const { name: file, document } of files) {
      for (const del of document.deletes) {
        const key = String(del.offset);
        if (del.kind === "label") {
          const index = bank!.localLabels.findIndex((l) => l.value === del.offset);
          if (index < 0) {
            warning(`No label at $${hex(del.offset)} to delete`, file, del.line);
            continue;
          }
          changes.push({ offset: del.offset, what: "label", before: bank!.localLabels[index].name, file, line: del.line });
          bank!.localLabels.splice(index, 1);
          continue;
        }
        const entry = bank!.lineAnnotations[key];
        const fields = del.kind === "line" ? (["synopsis", "comment"] as const) : ([del.kind] as const);
        let removed = false;
        for (const field of fields) {
          if (entry?.[field] === undefined) continue;
          changes.push({ offset: del.offset, what: field, before: entry[field], file, line: del.line });
          delete entry[field];
          removed = true;
        }
        if (!removed) warning(`Nothing (${del.kind}) at $${hex(del.offset)} to delete`, file, del.line);
        if (entry && entry.synopsis === undefined && entry.comment === undefined) delete bank!.lineAnnotations[key];
      }
    }
  }

  /** Cuts the base's regions around each file region; returns the provenance of cut-off pieces. */
  function applyRegions(): Map<number, Provenance> {
    const inherited = new Map<number, Provenance>();
    const provenanceOf = (start: number) => inherited.get(start) ?? input.base.provenance?.[`${pageKey}:${start}:region`];
    let regions = [...bank!.regions].sort((a, b) => a.start - b.start);
    for (const { name: file, document } of files) {
      for (const annRegion of document.regions) {
        const region = sidecarRegionOf(annRegion);
        const next: SidecarRegion[] = [];
        for (const r of regions) {
          if (r.end < region.start || r.start > region.end) {
            next.push(r);
            continue;
          }
          if (!sameRegion(r, region)) {
            changes.push({ offset: r.start, what: "region", before: describe(r), after: describe(region), file, line: annRegion.line });
          }
          if (r.start < region.start) next.push({ ...r, end: region.start - 1 });
          if (r.end > region.end) {
            const piece = { ...r, start: region.end + 1 };
            const provenance = provenanceOf(r.start);
            if (provenance) inherited.set(piece.start, provenance);
            next.push(piece);
          }
        }
        next.push(region);
        setBy.set(`${region.start}:region`, provenanceFor(document, `${region.start}:region`));
        regions = next.sort((a, b) => a.start - b.start);
      }
    }
    bank!.regions = regions;
    return inherited;
  }

  function applyLabels() {
    for (const { name: file, document } of files) {
      for (const label of document.labels) {
        const existing = bank!.localLabels.find((l) => l.value === label.offset);
        if (existing) {
          if (existing.name !== label.name) {
            changes.push({ offset: label.offset, what: "label", before: existing.name, after: label.name, file, line: label.line });
            existing.name = label.name;
          }
        } else {
          bank!.localLabels.push({ name: label.name, value: label.offset });
        }
        setBy.set(`${label.offset}:label`, provenanceFor(document, `${label.offset}:label`));
      }
    }
  }

  function applyTexts() {
    const labelsAt = new Map(bank!.localLabels.map((l) => [l.value, l.name]));
    for (const { name: file, document } of files) {
      for (const [what, entries] of [["synopsis", document.synopses], ["comment", document.comments]] as const) {
        for (const entry of entries) {
          const key = String(entry.offset);
          const line = (bank!.lineAnnotations[key] ??= {});
          let text = entry.text;
          if (text !== line[what]) {
            // --- The text pass runs on text the file changes, never on text already in the sidecar
            if (input.text?.nameNumbers) {
              const named = nameNumbers(text, labelsAt, input.pageSize);
              if (named.swaps.length) swaps.push({ offset: entry.offset, swaps: named.swaps });
              text = named.text;
            }
            text = dropKeptMarks(text);
            if (what === "synopsis" && input.text?.wrap !== false) text = wrapSynopsis(text);
          }
          if (line[what] !== undefined && line[what] !== text) {
            changes.push({ offset: entry.offset, what, before: line[what], after: text, file, line: entry.line });
          }
          line[what] = text;
          setBy.set(`${entry.offset}:line`, provenanceFor(document, `${entry.offset}:line`));
        }
      }
    }
  }

  /** The page's regions must cover it from 0 to its last byte, without gaps. */
  function checkCoverage() {
    let expected = 0;
    for (const r of bank!.regions) {
      if (r.start > expected) error(`Bytes ${hex(expected)}-${hex(r.start - 1)} are in no region`);
      expected = Math.max(expected, r.end + 1);
    }
    if (expected <= last) error(`Bytes ${hex(expected)}-${hex(last)} are in no region`);
  }

  function settleProvenance(inherited: Map<number, Provenance>) {
    const provenance: Record<string, Provenance> = { ...(sidecar.provenance ?? {}) };
    const prefix = `${pageKey}:`;
    for (const key of Object.keys(provenance)) if (key.startsWith(prefix)) delete provenance[key];
    const needed = new Set(provenanceKeysOf({ banks: { [pageKey]: bank } }));
    for (const key of needed) {
      const local = key.slice(prefix.length);
      const value =
        marked.get(local) ??
        setBy.get(local) ??
        input.base.provenance?.[key] ??
        (local.endsWith(":region") ? inherited.get(Number(local.split(":")[0])) : undefined);
      if (value) provenance[key] = value;
      else error(`No provenance for ${key}`);
    }
    for (const local of marked.keys()) {
      if (!needed.has(`${prefix}${local}`)) warning(`Provenance for ${local} names no entry`);
    }
    sidecar.provenance = provenance;
  }

  function provenanceFor(document: AnnDocument, local: string): Provenance {
    const [offset, kind] = local.split(":");
    return document.provenance.find((m) => m.offset === Number(offset) && m.kind === kind)?.provenance ?? document.defaultProvenance;
  }
}

function sameRegion(a: SidecarRegion, b: SidecarRegion): boolean {
  return (
    a.start === b.start &&
    a.end === b.end &&
    a.type === b.type &&
    a.decode === b.decode &&
    a.rowBytes === b.rowBytes &&
    a.radix === b.radix
  );
}

function describe(region: SidecarRegion): string {
  return `${region.decode ?? region.type} ${hex(region.start)}-${hex(region.end)}`;
}

function duplicateNames(labels: { name: string; value: number }[]): Map<string, number[]> {
  const byName = new Map<string, number[]>();
  for (const label of labels) byName.set(label.name, [...(byName.get(label.name) ?? []), label.value]);
  return new Map([...byName].filter(([, offsets]) => offsets.length > 1));
}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
