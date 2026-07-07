# ZX Spectrum Next ROM RAM State Notes

This file collects inferred RAM state variables that are shared across ROMs or
used as persistent scratch/state outside the standard Spectrum system variable
tables. Treat every entry as evidence-based: keep code references with the
meaning, and update confidence when other ROMs confirm or contradict it.

## Display State Swap Record: DISP_MODE-DISP_CHARS_H

Finding:
`DISP_MODE-DISP_CHARS_H` is a display-state record used by ROM0 to apply a temporary
display context and save the previous context back into the same bytes.

Initial value:
ROM0 copies six bytes from `$035A` to `DISP_MODE`. The source overlaps the high byte
of `jp RUN_BOOT_CMDS`, so the copied bytes are:

```text
DISP_MODE = $11
DISP_GMODE = $00
DISP_L2SOFT = $00
DISP_CPUSPEED = $03
DISP_CHARS = $00
DISP_CHARS_H = $3C
```

Fields:

```text
DISP_MODE        display/mode marker
DISP_GMODE        GMODE swap byte
DISP_L2SOFT        L2SOFT / port $123B Layer 2 control swap byte
DISP_CPUSPEED        CPU speed swap byte, NextReg $07 bits 1:0
DISP_CHARS-DISP_CHARS_H  CHARS swap word
```

Evidence:

- ROM0 `$0309-$0312`: copies six bytes from `$035A` to `DISP_MODE`.
- ROM0 `$0358-$035F`: the source bytes are `$11,$00,$00,$03,$00,$3C`, with
  `$035A` also being the high byte of `jp RUN_BOOT_CMDS`.
- ROM0 `L0EE8`:
  - saves current `L2SOFT` (`$5B7B`) and current `GMODE` (`$5C7F`),
  - reads `DISP_GMODE`, calls the ROM1 graphics-mode setter, then stores the previous
    `GMODE` back to `DISP_GMODE`,
  - reads `DISP_L2SOFT`, writes it to `L2SOFT` and port `$123B`, then stores the
    previous `L2SOFT` back to `DISP_L2SOFT`,
  - reads `DISP_CPUSPEED`, writes it through the NextReg data port after reading current
    CPU speed bits, then stores the previous speed bits back to `DISP_CPUSPEED`,
  - swaps `DISP_CHARS-DISP_CHARS_H` with `CHARS` (`$5C36`).
- ROM1 `$0B15-$0B25`: if `DISP_MODE == $08`, ROM1 stores current `L2SOFT` into
  `DISP_L2SOFT` and current `GMODE` into `DISP_GMODE`.
- AltROM0 and ROM2 also reference `DISP_MODE`, so the marker is cross-ROM state.

Related known variables:

- `L2SOFT` at `$5B7B`: soft copy of I/O port `$123B`.
- `GMODE` at `$5C7F`: graphical layer/mode flags.
- `CHARS` at `$5C36`: Spectrum character set pointer.
- NextReg `$07`: CPU speed, bits 1:0.
- Port `$123B`: Layer 2 control.

Confidence:
High for `DISP_GMODE-DISP_CHARS_H` swap behavior. Medium for the exact semantic range of
`DISP_MODE`; it is clearly a mode/dispatch marker, but all marker values are not yet
decoded.

Follow-up:
Name `DISP_MODE` and the full record only after more mode-marker values are decoded
from ROM0, ROM1, ROM2, and AltROM0. Review all `DISP_MODE` uses together before
choosing permanent labels.
