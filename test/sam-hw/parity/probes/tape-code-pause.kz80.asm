; Parity probe "tape-code-pause" (Phase 6): ROM 3.0's LOAD of a CODE file from the tape "code-pause":
; turbo blocks at the standard timing with a pure tone (12h) and a 3 s pause (20h) between header and data (test/sam-hw/parity/tapes.ts).
; @tape code-pause
; @typed LOAD "" CODE 81920: BOOT
; @use taperom
