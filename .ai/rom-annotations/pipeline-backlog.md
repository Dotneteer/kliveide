# ROM annotation pipeline: backlog

The improvements to the pipeline (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md`, D11) that a ROM's feedback review
accepted. `compile` writes `.rom-annotations/work/<rom>/feedback-page-<n>.md`; at the end of a ROM the session
reviews it with the project author, and each accepted proposal is added here with the ROM and the evidence that
raised it. Items are fixed between ROMs.

An item is **done** when a test reproduces the case from the ROM's bytes and the preprocessor now gives the
fact; running `prepare` on that ROM again should make its feedback disappear. A proposal that needs knowledge
from outside the ROM's bytes, Klive's runs and the manuals is refused under D4; one that would put a guess on a
card, under D7.

Format of an entry:

```
### <short title>
- Stage: cards | register facts | detectors | conventions | alignment | postprocessor
- Raised by: <rom> page <n>, <date>, <the feedback or the measured signal>
- Evidence: <addresses, counts>
- Proposal: <the change>
- Status: accepted | done (<commit>, <test>)
```

## Accepted

None reviewed yet. Found and fixed while EXDOS 1.3 was being worked (P8), for the review to confirm:

### Counted texts and fills
- Stage: detectors
- Raised by: ep-exdos13.rom page 1, 2026-11-01, the session reading the page: no proposal for its message tables
- Evidence: page 1 is two tables of counted messages ($0004-$097F) and 13,952 bytes of $FF; the detectors knew only
  texts with an end mark
- Proposal: detect runs of counted texts (a length byte, then that many printable bytes) and fills (16 or more of one
  byte), scanning whole stretches of non-code runs, and accepting bytes a run only read (the length bytes are read)
- Status: done (`proposals.ts`, `test/rom-pipeline/proposals.test.ts`)

### Unknown register facts weighed per instruction
- Stage: cards
- Raised by: ep-exdos13.rom page 1, 2026-11-01: a work weight of 6,130,257 in 219 ranges
- Evidence: text decoded as code has an unknown fact at nearly every row, and each added 2 to the weight
- Proposal: count at most three per routine
- Status: done (`analyse.ts`)

### A stale bundle after the tools change
- Stage: cards
- Raised by: ep-exdos13.rom, 2026-11-01: `prepare` said "up to date" after the detectors changed
- Evidence: `inputs.json` hashes the ROM, the sidecar, the profile and the alignment, and `PIPELINE_VERSION` by hand
- Proposal: hash the pipeline's own source files into `inputs.json`
- Status: done (`scripts/rom-pipeline.cjs`, `prepare`)

### A reader that is not one
- Stage: detectors
- Raised by: ep-exdos13.rom page 0, 2026-11-01: "loaded by $3C7F: set 5,(ix+$13)" on a proposal
- Evidence: a row's last two bytes are taken as a 16-bit operand whatever the instruction
- Proposal: take a reader only from instructions with a 16-bit immediate or address (the effects model knows them)
- Status: accepted

### The walk stops at a call's inline byte
- Stage: cards, register facts
- Raised by: ep-exdos13.rom page 0, 2026-11-01: `feedback` lines from five of the twelve range helpers
- Evidence: every one of the 28 `CALL $00F2` (IY_WORD_INLINE) is followed by one inline byte, declared data; the
  decode stops there, so the code after it ($0364, $0384, $03B8, $0A01, $0F0B, $0F33 ...) is carded as unreached,
  and $00F2's own return (it takes the return address, steps past the byte and returns) makes its callers'
  register facts unknown
- Proposal: let the flow step over a short data region right after a `CALL`/`RST` when code resumes after it
  (an inline-data call); and a contract for such a callee from its code (it returns past its inline bytes)
- Status: accepted

## Proposed by EXDOS 1.3 (for the review)

From the run's feedback (79 lines from 13 helpers) and its measured signals:

1. **Calls that return past inline data** (accepted above): the top unknown (28 x `CALL $00F2`).
2. **Computed returns** (22 x "returns with 2 bytes still pushed"): a dispatcher that pushes a handler's address
   and returns into it; the pass could follow a pushed constant as a jump.
3. **Never-taken jumps that hide entries** (`JP Z` right after a test that cleared Z, `JP NZ` after `XOR A`, `CP n`,
   `LD H,$B7`, `OR $37`): the known flags already say the jump is never taken; a card could say "never taken:
   its operand hides an entry at $xxxx" instead of "jumps out of the page".
4. **Workspace layouts**: IY/IX-relative variables recurring on 30-40 cards (the driver's IY-$1F..IY-$13, the
   transfer state at IY+$48..$5A); a page-level "variables" card grouping every `(IY+d)`/`(IX+d)` use.
5. **Register sets switched by `EXX`** across calls: the facts should say which set a register is in.
6. **Pointer-table detector precision**: 13 false "four words" proposals; require a reader for a table nothing
   loads, or a fifth word.
7. **Duplicate code**: a "same bytes as $xxxx" fact ($3E3A-$3E7F repeats $3DBA-$3DFF).
8. **Range ownership**: helpers commented their neighbours' routines (29 merge conflicts); `compile` could warn
   when a `.ann` writes inside a routine of another range, and the brief could say so.
9. **The listing** (203 requests): mostly routines split across ranges and callees in other ranges; ranges that
   keep a routine's fragments together, and callee synopses carried into later ranges.

## Known gaps (not reviewed yet)

What the building of the pipeline itself left open, listed so a review can accept or refuse them; they are not
accepted items.

- **conventions:** the EXOS functions whose register contract differs from §4.1's general one (its chapter 11).
- **conventions:** IS-BASIC's restarts (`RST 08h/10h/18h/20h`) have notes but no register contracts.
- **conventions:** the WP's packed help texts are not located (only its phrase table is decoded).
- **detectors:** fixed-size records and BCD numbers.
- **cards:** RAM named by the machine's system variables, ports by function (stage 11 names only the page's
  labels).
- **profile recipes:** EXDOS 1.3 page 1 is never reached by `ep128-exdos`; no recipes yet for the ZX80/81,
  HT-1080Z, TVC, Spectrum 128/+3 or Next.
- **postprocessor:** the byte-for-byte reassembly check is still `tools/reassemble-test.ts.txt`, not part of
  `compile`.
