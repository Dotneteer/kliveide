# ROM annotation tools

Most of the scripts that lived here were replaced by the ROM annotation pipeline
(`npm run rom:pipeline`, `.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` P7). The authoring guides and the older
helper briefs still name them; this is what replaced each one.

| Retired script | Its job | Now |
|---|---|---|
| `sp48-dis.cjs`, `zx81-dis.cjs`, `zx80-dis.cjs`, `ht1080z-dis.cjs`, `tvc-dis.cjs`, `ep-dis.cjs` | a page's listing through Klive's disassembler with its ROM kind's decoding, shaped by the sidecar's regions | `rom:pipeline -- listing <rom> <from>-<to> [--page n] [--why "..."]` (recorded for the feedback report) |
| `listing-range.py` | a range of such a listing | the same `listing` command |
| `annotated-view.py` | a range with the sidecar's labels, synopsis heads and comments | `rom:pipeline -- prepare`: the routine cards show them, with the facts |
| `merge-drafts.py`, `apply-draft.py`, `apply-comments.py`, `apply-annotations.cjs` | merging helpers' JSON drafts or comment lists into a sidecar, through the formatter | `.ann` files and `rom:pipeline -- compile` (conflicts are errors, every replaced entry is listed, provenance is kept) |
| `check-annotations.cjs` | the IDE's readiness check | `compile`'s problem list ("Ready to ship?"), with the level and the lint |

Still here, because the pipeline does not do their job yet:

- `map-rom.py`, `build-mapped.py`: mapping a sidecar onto another version by listing alignment, with the
  Spectrum's inline words after `CALL $3E80` translated. `rom:pipeline -- carry` does the rest of it.
- `error-bytes.py`: the +3 syntax ROM's inline error bytes after calls to its error routines (with a profile,
  `prepare`'s region proposals find such bytes as "inline data the callee takes").
- `reassemble-test.ts.txt`: the byte-for-byte reassembly check, as a throwaway test.
- `pdf-text.py`: text out of a manual's PDF.
- `probe-template.ts.txt`, `sp48-probe-template.ts.txt`, `ep-probe-template.ts.txt`: throwaway probes on the
  harnesses, for what a run must settle.
