# ROM annotation tools

Helper scripts for authoring the shipped ROM sidecars (`../README.md`, "The tools"). Run them from the
repository root. The formatter, the index, `level`, `skeleton`, `bind` and `coverage` are
`npm run rom:annotations`; moving a sidecar to a newer ROM is `npm run rom:annotations:carry`.

| Script | What it does |
|---|---|
| `sp48-dis.cjs`, `zx81-dis.cjs`, `zx80-dis.cjs`, `ht1080z-dis.cjs`, `tvc-dis.cjs`, `ep-dis.cjs`, `sam-dis.cjs`, `z88-dis.cjs` | A page's listing through Klive's disassembler with its ROM kind's decoding, shaped by the sidecar's regions. `z88-dis.cjs` decodes each run at the address of its segment (the page's `segments`). |
| `z88-synopsis-pack.cjs`, `z88-synopsis-split.cjs`, `z88-synopsis-merge.cjs`, `z88-synopsis-notes.cjs` | The Z88 OZ synopsis pass: a context pack of the labels level 2 still needs (source text, callers), split into slices for helpers (`helper-briefs/z88-draft-synopses.md`), their drafts checked, re-wrapped and merged into `z88-oz47-authored.json`, and their notes collected for `z88-oz47-review.md`. |
| `z88-working-copy-diff.cjs` | What differs between two Z88 sidecars (a working copy and a new import) in labels, lines, settings and pages, regions left out: proves an install overwrites nothing but the new batch. |
| `listing-range.py` | Prints address ranges of a listing. |
| `annotated-view.py` | A range with the sidecar's labels, synopsis heads and comments. |
| `merge-drafts.py`, `apply-draft.py`, `apply-comments.py`, `apply-annotations.cjs` | Merge helpers' JSON drafts or comment lists into a sidecar, through the formatter. |
| `check-annotations.cjs` | The IDE's readiness check on a sidecar. |
| `map-rom.py`, `build-mapped.py` | Map a sidecar onto another version of its ROM by aligning the listings instruction by instruction, then build the mapped sidecar (provenance `derived`). |
| `error-bytes.py` | Gives every byte after a call to the error routines a one-byte data region (the +3's syntax ROM). |
| `pdf-text.py` | Extracts the text of an interface document's PDF (the NextZXOS/esxDOS API) without poppler. |
| `probe-template.ts.txt`, `sp48-probe-template.ts.txt`, `ep-probe-template.ts.txt`, `sam-coverage-run.ts.txt`, `reassemble-test.ts.txt` | Templates for a harness probe and a reassembly test; copy, fill in, run, delete. |
