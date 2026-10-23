; Counts to 10 in Counter, then stops at Done: the HT-1080Z flow answers the power-on question and
; starts the code at Start (HT1080Z_CODE_INJECTION_PLAN.md D4)
    .model HT1080Z
    .org $7000
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
