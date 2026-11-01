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

None yet: the first ROM worked with the pipeline (EXDOS 1.3, D8) raises the first ones.

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
