import {
  formatRomSidecar,
  missingProvenance,
  provenanceKeysOf,
  strayProvenance,
  type Provenance,
  type RawRomSidecar
} from "@common/roms/romAnnotationTools";

/*
 * Writing a ROM sidecar's working copy so it stays shippable (`.plans/ROM_ANNOTATION_EDITING_PLAN.md`
 * R5, §4.5).
 *
 * A working copy is copied into `src/public/roms/` unchanged once its author is happy with it, and
 * from then on `npm run rom:annotations -- --check` and `shippedRomSidecars.test.ts` judge it. So the
 * IDE never writes it any other way than the CLI would:
 *
 * - **only `banks` comes from the model.** `source`, `authoring`, `level`, `pages`, `inherits` and any
 *   key this build does not know are kept exactly as they are on disk. A ROM sidecar has no
 *   `globalLabels` and no `debug` (§5.1 of the reverse-engineering plan), so neither is ever written;
 * - **provenance is edited with the entries** (`provenanceDelta`): a created entry gets the mode
 *   chosen in the editor, a changed one keeps the provenance it had, a removed one loses its key;
 * - **the text is `formatRomSidecar`'s**, the CLI's own formatter, so a copied file is already in the
 *   canonical form;
 * - **a write that would leave an entry without provenance is refused** rather than written and
 *   caught later, once the file has been copied (trap T3).
 */

/** The bank keys that record how a bank document was last *shown*: not facts about the ROM. */
const VIEW_KEYS = ["lastView", "decimalView"] as const;

// ------------------------------------------------------------------------------------------------
// The provenance mode: what a newly created entry is recorded as

type Listener = () => void;
let mode: Exclude<Provenance, "derived"> = "observed";
const listeners = new Set<Listener>();

/** The provenance a created entry is given: `observed` (from the bytes or a run) unless chosen. */
export function getRomProvenanceMode(): Exclude<Provenance, "derived"> {
  return mode;
}

export function setRomProvenanceMode(next: Exclude<Provenance, "derived">): void {
  if (next === mode) return;
  mode = next;
  listeners.forEach((listener) => listener());
}

export function subscribeRomProvenanceMode(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ------------------------------------------------------------------------------------------------
// Provenance

/** What each provenance key names, as comparable text: a label's name, a comment, a region. */
function entriesOf(sidecar: RawRomSidecar): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [page, bank] of Object.entries<Record<string, any>>(sidecar.banks ?? {})) {
    for (const label of bank.localLabels ?? []) entries.set(`${page}:${label.value}:label`, String(label.name));
    for (const [offset, line] of Object.entries(bank.lineAnnotations ?? {})) {
      entries.set(`${page}:${offset}:line`, JSON.stringify(line));
    }
    for (const region of bank.regions ?? []) {
      entries.set(`${page}:${region.start}:region`, JSON.stringify(region));
    }
  }
  return entries;
}

/**
 * The provenance map after an edit, from the sidecar before and after it.
 *
 * - An entry that did not exist before gets `created`.
 * - An entry that changed keeps the provenance it had. Fixing a typo in a `manual` name must not
 *   turn it into an `observed` one; a `derived` entry that is edited stops being derived, and one
 *   that somehow had none gets `created`.
 * - An entry that is gone loses its key, so the file never carries stray provenance.
 *
 * Pure, so every case is tested without a file.
 */
export function provenanceDelta(
  before: RawRomSidecar,
  after: RawRomSidecar,
  created: Exclude<Provenance, "derived">
): Record<string, Provenance> {
  const previous: Record<string, Provenance> = before.provenance ?? {};
  const was = entriesOf(before);
  const is = entriesOf(after);
  const result: Record<string, Provenance> = {};
  for (const key of provenanceKeysOf(after)) {
    const old = previous[key];
    if (!was.has(key)) {
      result[key] = created;
    } else if (was.get(key) !== is.get(key)) {
      result[key] = old && old !== "derived" ? old : created;
    } else {
      result[key] = old ?? created;
    }
  }
  return result;
}

/** Set one entry's provenance, for `rom-ann-provenance`; `undefined` when there is no such entry. */
export function withProvenance(
  sidecar: RawRomSidecar,
  key: string,
  value: Exclude<Provenance, "derived">
): RawRomSidecar | undefined {
  if (!provenanceKeysOf(sidecar).includes(key)) return undefined;
  return { ...sidecar, provenance: { ...(sidecar.provenance ?? {}), [key]: value } };
}

// ------------------------------------------------------------------------------------------------
// The text

/**
 * The working copy's new text: the file on disk with its `banks` replaced by the edited ones and its
 * provenance moved with them, in the CLI's canonical format.
 *
 * @param raw The file as it is on disk
 * @param banks The edited banks, in their stored form (`toSidecarAnnotations(...).banks`)
 * @throws When the result would leave an entry without provenance
 */
export function romSidecarText(
  raw: RawRomSidecar,
  banks: Record<string, Record<string, unknown>>,
  created: Exclude<Provenance, "derived"> = getRomProvenanceMode()
): string {
  const storedBanks: Record<string, Record<string, unknown>> = {};
  for (const [page, bank] of Object.entries(banks)) {
    const next: Record<string, unknown> = { ...bank };
    const previous = raw.banks?.[page] ?? {};
    for (const key of VIEW_KEYS) {
      if (previous[key] === undefined) delete next[key];
      else next[key] = previous[key];
    }
    storedBanks[page] = next;
  }

  const after: RawRomSidecar = { ...raw, banks: storedBanks };
  delete after.globalLabels;
  delete after.debug;
  const provenance = provenanceDelta(raw, after, created);
  if (Object.keys(provenance).length > 0) after.provenance = provenance;
  else delete after.provenance;

  const missing = missingProvenance(after);
  if (missing.length > 0) {
    throw new Error(`These entries would have no provenance: ${missing.join(", ")}.`);
  }
  // --- `provenanceDelta` only names what is there; checked anyway, as the shipped test will
  if (strayProvenance(after).length > 0) {
    throw new Error(`Provenance names entries that are not there: ${strayProvenance(after).join(", ")}.`);
  }
  return formatRomSidecar(after);
}
