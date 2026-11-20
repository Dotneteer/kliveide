; A SAM Coupé machine-code program. Run (or Debug) boots the machine, leaves the copyright screen and
; presses F9: the ROM boots a disk Klive built, whose boot loader loads the program into page 1 and starts
; it with SAM BASIC's paging: ROM0 and page 0 at $0000-$7FFF, page 1 at $8000 and page 2 at $C000.
; Export writes the same bootable disk as an .mgt file (or the raw bytes as a .bin).
    .model SAMCOUPE

Start:
    di
    ld sp,$BFFF         ; a stack of the program's own, at the top of page 1
    xor a
NextColour:
    out ($FE),a         ; the border: bits 0-2 pick one of the first eight CLUT entries
    ld bc,$1000
Delay:
    dec bc
    ld e,a
    ld a,b
    or c
    ld a,e
    jr nz,Delay
    inc a
    and $07
    jr NextColour
