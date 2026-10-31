; Counts to 10 in Counter, then stops at Done: the Enterprise flow boots IS-BASIC and types
; LOAD "FILE:KLIVE.COM"; EXOS loads the program at $0100 and starts it (`common/enterprise/codePlacement.ts`)
    .model ENTERPRISE
Start:
    di
    ld sp,$3FFF
    ei
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
