; Counts to 10 in Counter, then stops at Done: the TVC flow boots BASIC, moves its program space above
; the code (LOMEM) and calls Start with C=USR(6704) (`common/tvc/codePlacement.ts`)
    .model TVC
    .org $1A30
Start:
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
