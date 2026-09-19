; PAR-005 - a demo-style raster screen: copper colour bars in the border, a Layer 2 picture split by
; a line interrupt (the top part scrolls, the bottom part stands still), and a sprite that the frame
; interrupt moves down one line per frame. Line interrupt, copper, sprites and Layer 2 scroll at once.
    .model Next
#include "../../copper/_include/copper-macros.z80asm"
    .savenex file "PAR-005.nex"
    .savenex ram 768
    .savenex stackaddr $BFF0
    .org $8000
Start:
    di
    ld b,0                  ; border 0: palette entry 16 (PAPER 0), which the copper rewrites
    ld c,$00
    call ClearScreen
    nextreg $07,$03         ; 28 MHz: the fills are quick, and the line interrupt handler writes $16
                            ; within the horizontal blanking, whatever the CPU's phase at the start
    ; --- Layer 2 palette (first): entry 16k = stripe colour k
    nextreg $43,$10
    ld hl,Stripes
    ld b,16
    ld e,0
PaletteLoop:
    ld a,e
    nextreg $40,a
    ld a,(hl)
    nextreg $41,a
    inc hl
    ld a,e
    add a,16
    ld e,a
    djnz PaletteLoop
    ; --- sprite palette (first): entry 1 white; ULA palette writes again
    nextreg $43,$20
    nextreg $40,1
    nextreg $41,$FF
    nextreg $43,$00
    nextreg $4B,$E3         ; sprite transparency index: the reset value, not left to NextZXOS
    ; --- Layer 2 256x192 in 16K bank 9 (8K pages 18-23): every pixel is x & $F0, 16-pixel stripes
    nextreg $12,9
    ld b,18
PageLoop:
    ld a,b
    nextreg $56,a
    ld hl,$C000
FillLoop:
    ld a,l
    and $F0
    ld (hl),a
    inc hl
    ld a,h
    cp $E0
    jr nz,FillLoop
    inc b
    ld a,b
    cp 24
    jr nz,PageLoop
    nextreg $56,0
    ; --- sprite pattern 0: 16x16 of index 1
    ld bc,$303B
    xor a
    out (c),a
    ld b,0
    ld a,1
PatternLoop:
    out ($5B),a
    djnz PatternLoop
    ; --- the copper: border bars, restarted every frame
    ld hl,List
    ld bc,ListEnd-List
    call UploadCopper
    nextreg $62,$C0
    ; --- IM2: 257 copies of $BA at $BD00, so the vector is $BABA - where Handler is assembled
    ld hl,$BD00
    ld de,$BD01
    ld bc,256
    ld (hl),$BA
    ldir
    ld a,$BD
    ld i,a
    im 2
    nextreg $23,96          ; line interrupt at line 96
    nextreg $22,%00000010   ; line interrupt on, ULA frame interrupt on
    ; --- Layer 2 visible; sprites visible, order SLU (sprites over Layer 2 over ULA)
    ld bc,$123B
    ld a,$02
    out (c),a
    nextreg $15,$01
    ei
    SignalReady()
Park:
    jr Park

Stripes:
    .defb $E0, $1C, $03, $FC, $1F, $E2, $92, $49, $6D, $B6, $24, $DB, $60, $0C, $81, $F0

List:
    CuPalette(16, $00)      ; at the restart: black
    CuWait(0, 0)
    CuPalette(16, $F3)
    CuWait(16, 0)
    CuPalette(16, $13)
    CuWait(32, 0)
    CuPalette(16, $F3)
    CuWait(48, 0)
    CuPalette(16, $13)
    CuWait(64, 0)
    CuPalette(16, $F3)
    CuWait(80, 0)
    CuPalette(16, $13)
    CuWait(96, 0)
    CuPalette(16, $F3)
    CuWait(112, 0)
    CuPalette(16, $13)
    CuWait(128, 0)
    CuPalette(16, $F3)
    CuWait(144, 0)
    CuPalette(16, $13)
    CuWait(160, 0)
    CuPalette(16, $F3)
    CuWait(176, 0)
    CuPalette(16, $13)
    CuWait(192, 0)
    CuPalette(16, $00)      ; the bottom border black
    CuHalt()
; `ListEnd .equ $`, not `ListEnd:` - a hanging label would bind to the .org below
ListEnd .equ $

Counter .defw 0

    .org $BABA
Handler:
    push af
    push bc
    push hl
    ; --- Which interrupt: the line interrupt comes on line 95, the frame interrupt in the border
    ; --- below the picture (line 192 or more, or $1E set)
    ld bc,$243B
    ld a,$1E
    out (c),a
    inc b
    in a,(c)
    or a
    jr nz,FrameInterrupt
    dec b
    ld a,$1F
    out (c),a
    inc b
    in a,(c)
    cp 192
    jr nc,FrameInterrupt
    nextreg $16,0           ; line interrupt: the bottom part is not scrolled
    jr HandlerDone
FrameInterrupt:
    ld hl,(Counter)
    inc hl
    ld (Counter),hl
    ld a,l
    nextreg $16,a           ; the top part scrolls one pixel per frame
    ; --- sprite 0: X = 132 (paper x 100), Y = 32 + (frame & 63), visible, pattern 0
    ld bc,$303B
    xor a
    out (c),a
    ld a,132
    out ($57),a
    ld a,l
    and $3F
    add a,32
    out ($57),a
    xor a
    out ($57),a
    ld a,$80
    out ($57),a
HandlerDone:
    pop hl
    pop bc
    pop af
    ei
    reti

#include "../../copper/_include/copper-routines.z80asm"
