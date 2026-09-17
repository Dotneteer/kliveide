; T00 - pipeline sanity check. No copper.
; Red border, yellow paper (PAPER 6, INK 0) over the whole ULA display area.
    .model Next
    .savenex file "T00-static-ula.nex"
    .savenex ram 768
    .savenex border 2
    .savenex stackaddr $BFF0

    .org $8000
    .ent $
Start:
    di
    ld a,2
    out ($FE),a             ; border red
    ld hl,$4000             ; clear pixels
    ld de,$4001
    ld bc,$17FF
    ld (hl),0
    ldir
    ld hl,$5800             ; attributes: PAPER 6, INK 0
    ld de,$5801
    ld bc,$02FF
    ld (hl),$30
    ldir
    nextreg $7F,$A5         ; ready marker for the harness
Park:
    jr Park
