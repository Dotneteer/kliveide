; Counts to 10 in Counter, then stops at Done: the SAM Coupé flow stops at the copyright screen, writes
; the program to page 1 and pages it in at $8000 (`common/samcoupe/codePlacement.ts`)
    .model SAMCOUPE
Start:
    di
    ld sp,$BFFF
    ld b,10
    xor a
Count:
    inc a
    ld (Counter),a
    djnz Count
Done:
    jr Done
Counter:
    .defb 0
