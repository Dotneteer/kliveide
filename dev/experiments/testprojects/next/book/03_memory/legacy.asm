.module LegacyMemDemo

MMU6_REG    .equ $56

;==========================================================
; Toggle the shadow screen using $7FFD
;==========================================================
ShadowScreen
    Display.PrintTitle(@Title_ShadowScreen)
    Display.PrintText(@Instr_ShadowScreen)

    Display.Ink(Color.Blue)
    call @Get7ffdStatus         ; Read current $7ffd state via NextRegs
    ld (@Last7ffd),a            ; Save it
    Display.PrintABinary()      ; Display it

    ; --- Save current MMU6 so we can restore it later
    ld a,MMU6_reg
    GetNextReg(MMU6_REG)        ; A := current value of MMU6
    ld (@SavedMmu6),a

    ; --- Copy the current screen to the shadow screen bank
    nextreg MMU6_REG,$0e
    ld hl,$4000                 ; Start of visible screen (bank 5 low)
    ld de,$c000                 ; Shadow screen paged into slot 6
    ld bc,$1b00                 ; Screen size (pixels + attributes)
    ldir

    ; --- Create a green attribute stripe in the shadow screen
    ld hl,$d900
    ld de,$d901
    ld bc,$1f
    ld (hl),attr(Color.Green, Color.Green)
    ldir

    ; --- Restore original MMU6 content
    ld a,(@SavedMmu6)
    nextreg MMU6_REG,a

    ; --- Toggle shadow screen on and off each time we halt
    ld bc,$7ffd
    ei
`swap
    ld a,(@Last7ffd)
    xor $08                     ; Toggle shadow screen bit
    out (c),a
    ld (@Last7ffd),a
    halt                        ; Wait for interrupt
    ld a,$7F                    ; Check Space key
    in a,($FE)
    bit 0,a
    jr nz,`swap

    ; Turn off shadow screen and exit
    ld a,(@Last7ffd)
    res 3,a
    out (c),a
    ret

@Get7ffdStatus
    GetNextReg($8e)             ; Read NextReg $8E (Spectrum 128K Memory Mapping)
    and $75                     ; Mask out irrelevant bits
    ld d,0                      ; Start with bit 4 of $7ffd = 0
    bit 2,a                     ; AllRAM mode active?
    jr nz,`bit4Done             ; If so, bit 4 stays 0
    bit 0,a                     ; ROM selector bit set?
    jr z,`bit4Done              ; If not, bit 4 stays 0
    ld c,$10                    ; Set bit 4 = 1
`bit4Done
    sla a                       ; Shift $8E bits 6:4 → bits 2:0
    sla a
    sla a
    sla a
    or d                        ; Insert bit 4 of $7ffd
    ld d,a                      ; Save reconstructed $7ffd value
    GetNextReg($69)             ; Read NextReg $69 (Display Control 1)
    bit 6,a                     ; Shadow display enabled?
    ld a,d                      ; Restore $7ffd value
    ret z                       ; If shadow off, return
    set 3,a                     ; If shadow on, set bit 3
    ret

@Last7ffd
    .db 0

@SavedMmu6
    .defb 0

@Title_ShadowScreen
    .defn "Memory #2: Shadow screen"
@Instr_ShadowScreen
    .defm "Swaps normal and shadow screens\x0d"
    .defm "Press space to stop\x0d"
    .defn "Last $7ffd value: "

;==========================================================
; Demonstrate AllRAM configuration
;==========================================================
AllRam
    Display.PrintTitle(@Title_AllRam)
    Display.PrintText(@Instr_AllRam)
    
    Display.Ink(Color.Blue)
    call @Get1ffdStatus     ; Get $1ffd status
    ld (@Last1ffd),a        ; Save it
    Display.PrintABinary()  ; Display it
    Display.NewLine()
    Display.Ink(Color.Black)

    ; Display current bytes $0000-0003
    Display.PrintText(@Instr_AllRam2)
    Display.Ink(Color.Blue)
    ld hl,$0000
    call MmuDemo.PrintSignature
    Display.Ink(Color.Black)
    Display.NewLine()

    ; Set AllRAM using Bank 0/1/2/3
    di
    ld a,$01
    ld bc,$1ffd
    out (c),a

    ; Save AllRAM bytes $0000-$0003
    ld hl,$0000
    ld de,@AllRamBytes
    ld bc,4
    ldir

    ; Restore the original configuration
    ld a,(@Last1ffd)
    ld bc,$1ffd
    out (c),a

    ; Display current AllRAM bytes $0000-$0003
    Display.PrintText(@Instr_AllRam3)
    Display.Ink(Color.Blue)
    ld hl,@AllRamBytes
    call MmuDemo.PrintSignature
    ret

@Get1ffdStatus
    GetNextReg($8e)         ; Get $1ffd status
    and $07                 ; Drop non-$1ffd-relate bits
    bit 2,a                 ; Check for AllRAM mode
    jr z,`allRam            
    and $01                 ; Keep only Bit 1
    add a,a                 ; Shift bits to left
    ret
`allRam                     
    scf
    add a,a                 ; Shift bits to left and set bit 0
    ret

@Last1ffd
    .db 0
@AllRamBytes
    .defs 4

@Title_AllRam
    .defn "Memory #3: AllRAM mode"
@Instr_AllRam
    .defn "Last $1ffd value: "
@Instr_AllRam2
    .defn "Current bytes: "
@Instr_AllRam3
    .defn "AllRAM bytes:  "

;==========================================================
; Use $DFFD to access RAM banks above bank 7
;==========================================================
DffdBanks
    Display.PrintTitle(@Title_DffdBanks)
    Display.PrintText(@Instr_DffdBanks)

    ; --- Save $7FFD/$DFFD state via NextReg $8E
    GetNextReg($8e)
    ld (@Saved8e),a

    ; --- Save MMU6/MMU7 — legacy port writes will overwrite them
    GetNextReg($56)
    ld (@SavedMmu6),a
    GetNextReg($57)
    ld (@SavedMmu7),a

    ; --- Write a marker into banks 8..15 at offset 0 of slot 6
    ld e,$08
`writeLoop
    ld a,e
    call @SelectBank          ; Map 7-bit bank A via $7FFD + $DFFD
    ld a,e
    ld ($c000),a              ; Marker = bank number
    inc e
    ld a,e
    cp $10
    jr nz,`writeLoop

    ; --- Restore MMU6/7 so the ROM's $C000+ workspace is back
    ld a,(@SavedMmu6)
    nextreg $56,a
    ld a,(@SavedMmu7)
    nextreg $57,a
    
    ; --- Read each bank's marker, restore Bank 0, then print it
    Display.Ink(Color.Blue)
    ld e,$08
`readLoop
    push de
    ld a,e
    call @SelectBank
    ld a,($c000)              ; A := marker
    ld d,a                    ; Stash before re-mapping
    ld a,(@SavedMmu6)
    nextreg $56,a
    ld a,(@SavedMmu7)
    nextreg $57,a
    ld a,d
    Display.PrintAHexadecimal()
    ld a,' '
    rst $10
    pop de
    inc e
    ld a,e
    cp $10
    jr nz,`readLoop
    
    ; --- Commit the saved $7FFD/$DFFD state back through $8E.
    ;     bit 3 = 1 tells the FPGA to apply the bank fields.
    ld a,(@Saved8e)
    or $08
    nextreg $8e,a
    ret

;----------------------------------------------------------
; Map 7-bit bank A into slots 6/7 via $7FFD + $DFFD.
;   bits 2:0 of A  → $7FFD  (low bank bits)
;   bits 6:3 of A  → $DFFD  (high bank bits)
;----------------------------------------------------------
@SelectBank
    and $07
    ld h,a
    call @Get7ffdStatus
    and $f8
    or h
    ld bc,$7ffd
    out (c),a
    rrca
    rrca
    rrca
    and $0f
    ld bc,$dffd
    out (c),a
    ret

@Saved8e
    .db 0
@SavedMmu7
    .db 0

@Title_DffdBanks
    .defn "Memory #4: $DFFD bank extension"
@Instr_DffdBanks
    .defm "Markers in banks 8..F\x0d"
    .defn "Read back:\x0d"

.endmodule