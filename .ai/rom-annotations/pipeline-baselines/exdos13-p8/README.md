# Baseline: EXDOS 1.3 with the pipeline as built in P0-P8

The first ROM annotated with the ROM annotation pipeline (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §9.9), kept as
the baseline the cost-cutting part (§12) is measured against. The sidecar it produced is
`src/public/roms/ep-exdos13.rom.dis` (level 2 on both pages, reassembling byte for byte).

## The measurements

| Measure | Value |
|---|---|
| Total time | 48 min 16 s (2026-11-01, 17:28:15 to 18:16:31 UTC) |
| Preprocessor, postprocessor and other tools | 49.8 s (1.7 %): `prepare` 7 runs 23.8 s, `compile` 35 runs 23.1 s, `listing` 203 runs 2.9 s |
| AI | 47 min 26 s (98.3 %); the 13 helpers' own times add up to 159 min 49 s, six at a time |
| AI tokens (the harness's count) | 3,263,968: the regions helper 220,806; twelve range helpers 2,926,028 (143,889-285,713 each); the session 117,174 (its context's growth) |
| Tool calls of the helpers | 698: 391 grep/sed/awk searches, 132 listings, 41 compiles |
| Cached input re-read across the calls | 89,692,062 |
| Output tokens | 910,702, of which the `.ann` text is ~96k |
| Work done | page 0: 1,055 labels (285 subroutines, 770 jump targets), 5,086 comments; page 1: two message tables |
| Feedback | 79 `feedback` lines (29 missing, 20 wrong, 15 pattern, 15 listing); 135 data regions no detector proposed; 96 routines whose unknown register facts the AI settled |

## The files

- `timings.jsonl`, `timings-report.txt`: the run's timing log and `npm run rom:pipeline -- timings report p8-exdos`.
- `token-breakdown.txt`: `tools/helper-token-breakdown.py` over the helpers' transcripts (where their tokens went).
- `ann/`: what the helpers wrote (`range-01..12.ann`), the session's merge fixes (`range-13-merge.ann`) and the
  regions (`regions-page-0.ann`, `regions-page-1.ann`). `.ann` files are work files (D6); these are kept only as
  the baseline's evidence of what the AI had to write.
- `feedback-page-0.md`: the merge's feedback report (D11).

## Comparing a later run

Run the same ROM (or one range of it, §12.5) with `timings start <label>` ... `timings end <label>`, record each
helper's tokens with `timings ai`, run `tools/helper-token-breakdown.py` over its helpers' transcripts, and set
the figures beside this table. One range's helper here: range 06, 195,227 tokens in 30 tool calls, 9 min 4 s.
