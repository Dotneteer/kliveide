' Klive BASIC standard library - zx0.bas: the ZX0 decompressors.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json) and the published
' ZX0 and RCS formats by Einar Saukas (https://github.com/einar-saukas/ZX0), whose author asks that
' programs using ZX0 mention it in their documentation. Data in ZX0's current format (version 2).
'
' Every name decodes the same stream; Standard and SmartRCS are the smallest decoders, Turbo, Mega and
' AgileRCS faster ones.
' "Back" names read the data from its last byte down (src and dst are the last addresses); "RCS"
' names write bytes that land in the screen bitmap to their RCS places.
#pragma once
#pragma push(case_insensitive)
#pragma case_insensitive = true

' The register decoders, one per name. In: HL the data (its
' last byte backwards), DE the destination (its last byte backwards). A holds the bits (a marker bit
' shows when a new byte is due), IX the last offset (negated forwards), BC the counts. Backwards data
' is read downwards, with its flag bits flipped and the offset's parts as the compressor's backwards
' mode writes them.

' Forwards, compact: the gamma codes and the copies are subroutines.
SUB FASTCALL __kbZx0Std()
    ASM
        push ix
        ld ix,-1                  ; the first offset: 1
        ld a,$80
__kbzs_lits:
        call __kbzs_gammaplain
        ldir                        ; the literals
        add a,a
        jr nz,__kbzs_b1
        ld a,(hl)
        inc hl
        rla
__kbzs_b1:
        jr c,__kbzs_new
        call __kbzs_gammaplain
                                    ; a copy from the last offset
        call __kbzs_copy
        add a,a
        jr nz,__kbzs_b2
        ld a,(hl)
        inc hl
        rla
__kbzs_b2:
        jr nc,__kbzs_lits
__kbzs_new:
        call __kbzs_gammainv
        dec b                       ; a high part of 256 ends the data
        jr z,__kbzs_done
        push af
        xor a
        sub c
        ld b,a                      ; B = -high
        pop af
        ld c,(hl)
        inc hl
        sra b
        rr c                        ; BC = -(high * 128 - low / 2); carry: the length's first bit
        push bc
        pop ix
        call __kbzs_gammacarry
        inc bc
        call __kbzs_copy
        add a,a
        jr nz,__kbzs_b3
        ld a,(hl)
        inc hl
        rla
__kbzs_b3:
        jr c,__kbzs_new
        jr __kbzs_lits
__kbzs_done:
        pop ix
        ret
__kbzs_copy:
        push hl
        push ix
        pop hl
        add hl,de
        ldir
        pop hl
        ret
__kbzs_gammaplain:
        ld bc,1
__kbzs_g4:
        add a,a
        jr nz,__kbzs_b7
        ld a,(hl)
        inc hl
        rla
__kbzs_b7:
        jr c,__kbzs_e6
__kbzs_d5:
        add a,a
        jr nz,__kbzs_b8
        ld a,(hl)
        inc hl
        rla
__kbzs_b8:
        rl c
        rl b
        jr __kbzs_g4
__kbzs_e6:
        ret
__kbzs_gammainv:
        ld bc,1
__kbzs_g9:
        add a,a
        jr nz,__kbzs_b12
        ld a,(hl)
        inc hl
        rla
__kbzs_b12:
        jr c,__kbzs_e11
__kbzs_d10:
        add a,a
        jr nz,__kbzs_b13
        ld a,(hl)
        inc hl
        rla
__kbzs_b13:
        ccf
        rl c
        rl b
        jr __kbzs_g9
__kbzs_e11:
        ret
__kbzs_gammacarry:
        ld bc,1
        jr c,__kbzs_e16
        jr __kbzs_d15
__kbzs_g14:
        add a,a
        jr nz,__kbzs_b17
        ld a,(hl)
        inc hl
        rla
__kbzs_b17:
        jr c,__kbzs_e16
__kbzs_d15:
        add a,a
        jr nz,__kbzs_b18
        ld a,(hl)
        inc hl
        rla
__kbzs_b18:
        rl c
        rl b
        jr __kbzs_g14
__kbzs_e16:
        ret
    END ASM
END SUB

' Backwards, compact.
SUB FASTCALL __kbZx0StdBack()
    ASM
        push ix
        ld ix,1                  ; the first offset: 1
        ld a,$80
__kbzsb_lits:
        call __kbzsb_gammaplain
        lddr                        ; the literals
        add a,a
        jr nz,__kbzsb_b1
        ld a,(hl)
        dec hl
        rla
__kbzsb_b1:
        jr c,__kbzsb_new
        call __kbzsb_gammaplain
                                    ; a copy from the last offset
        call __kbzsb_copy
        add a,a
        jr nz,__kbzsb_b2
        ld a,(hl)
        dec hl
        rla
__kbzsb_b2:
        jr nc,__kbzsb_lits
__kbzsb_new:
        call __kbzsb_gammaplain
        dec b                       ; a high part of 256 ends the data
        jr z,__kbzsb_done
        ld b,c
        dec b                       ; B = high - 1
        ld c,(hl)
        dec hl
        srl b
        rr c
        inc bc                      ; BC = (high - 1) * 128 + low / 2 + 1; carry: the length's first bit
        push bc
        pop ix
        call __kbzsb_gammacarry
        inc bc
        call __kbzsb_copy
        add a,a
        jr nz,__kbzsb_b3
        ld a,(hl)
        dec hl
        rla
__kbzsb_b3:
        jr c,__kbzsb_new
        jr __kbzsb_lits
__kbzsb_done:
        pop ix
        ret
__kbzsb_copy:
        push hl
        push ix
        pop hl
        add hl,de
        lddr
        pop hl
        ret
__kbzsb_gammaplain:
        ld bc,1
__kbzsb_g4:
        add a,a
        jr nz,__kbzsb_b7
        ld a,(hl)
        dec hl
        rla
__kbzsb_b7:
        jr nc,__kbzsb_e6
__kbzsb_d5:
        add a,a
        jr nz,__kbzsb_b8
        ld a,(hl)
        dec hl
        rla
__kbzsb_b8:
        rl c
        rl b
        jr __kbzsb_g4
__kbzsb_e6:
        ret
__kbzsb_gammacarry:
        ld bc,1
        jr nc,__kbzsb_e11
        jr __kbzsb_d10
__kbzsb_g9:
        add a,a
        jr nz,__kbzsb_b12
        ld a,(hl)
        dec hl
        rla
__kbzsb_b12:
        jr nc,__kbzsb_e11
__kbzsb_d10:
        add a,a
        jr nz,__kbzsb_b13
        ld a,(hl)
        dec hl
        rla
__kbzsb_b13:
        rl c
        rl b
        jr __kbzsb_g9
__kbzsb_e11:
        ret
    END ASM
END SUB

' Forwards, faster: the gamma codes and the copies inline.
SUB FASTCALL __kbZx0Turbo()
    ASM
        push ix
        ld ix,-1                  ; the first offset: 1
        ld a,$80
__kbzt_lits:
        ld bc,1
__kbzt_g1:
        add a,a
        jr nz,__kbzt_b4
        ld a,(hl)
        inc hl
        rla
__kbzt_b4:
        jr c,__kbzt_e3
__kbzt_d2:
        add a,a
        jr nz,__kbzt_b5
        ld a,(hl)
        inc hl
        rla
__kbzt_b5:
        rl c
        rl b
        jr __kbzt_g1
__kbzt_e3:
        ldir                        ; the literals
        add a,a
        jr nz,__kbzt_b6
        ld a,(hl)
        inc hl
        rla
__kbzt_b6:
        jp c,__kbzt_new
        ld bc,1
__kbzt_g7:
        add a,a
        jr nz,__kbzt_b10
        ld a,(hl)
        inc hl
        rla
__kbzt_b10:
        jr c,__kbzt_e9
__kbzt_d8:
        add a,a
        jr nz,__kbzt_b11
        ld a,(hl)
        inc hl
        rla
__kbzt_b11:
        rl c
        rl b
        jr __kbzt_g7
__kbzt_e9:
                                    ; a copy from the last offset
        push hl
        push ix
        pop hl
        add hl,de
        ldir
        pop hl
        add a,a
        jr nz,__kbzt_b12
        ld a,(hl)
        inc hl
        rla
__kbzt_b12:
        jp nc,__kbzt_lits
__kbzt_new:
        ld bc,1
__kbzt_g13:
        add a,a
        jr nz,__kbzt_b16
        ld a,(hl)
        inc hl
        rla
__kbzt_b16:
        jr c,__kbzt_e15
__kbzt_d14:
        add a,a
        jr nz,__kbzt_b17
        ld a,(hl)
        inc hl
        rla
__kbzt_b17:
        ccf
        rl c
        rl b
        jr __kbzt_g13
__kbzt_e15:
        dec b                       ; a high part of 256 ends the data
        jp z,__kbzt_done
        push af
        xor a
        sub c
        ld b,a                      ; B = -high
        pop af
        ld c,(hl)
        inc hl
        sra b
        rr c                        ; BC = -(high * 128 - low / 2); carry: the length's first bit
        push bc
        pop ix
        ld bc,1
        jr c,__kbzt_e20
        jr __kbzt_d19
__kbzt_g18:
        add a,a
        jr nz,__kbzt_b21
        ld a,(hl)
        inc hl
        rla
__kbzt_b21:
        jr c,__kbzt_e20
__kbzt_d19:
        add a,a
        jr nz,__kbzt_b22
        ld a,(hl)
        inc hl
        rla
__kbzt_b22:
        rl c
        rl b
        jr __kbzt_g18
__kbzt_e20:
        inc bc
        push hl
        push ix
        pop hl
        add hl,de
        ldir
        pop hl
        add a,a
        jr nz,__kbzt_b23
        ld a,(hl)
        inc hl
        rla
__kbzt_b23:
        jp c,__kbzt_new
        jp __kbzt_lits
__kbzt_done:
        pop ix
        ret
    END ASM
END SUB

' Backwards, faster.
SUB FASTCALL __kbZx0TurboBack()
    ASM
        push ix
        ld ix,1                  ; the first offset: 1
        ld a,$80
__kbztb_lits:
        ld bc,1
__kbztb_g1:
        add a,a
        jr nz,__kbztb_b4
        ld a,(hl)
        dec hl
        rla
__kbztb_b4:
        jr nc,__kbztb_e3
__kbztb_d2:
        add a,a
        jr nz,__kbztb_b5
        ld a,(hl)
        dec hl
        rla
__kbztb_b5:
        rl c
        rl b
        jr __kbztb_g1
__kbztb_e3:
        lddr                        ; the literals
        add a,a
        jr nz,__kbztb_b6
        ld a,(hl)
        dec hl
        rla
__kbztb_b6:
        jp c,__kbztb_new
        ld bc,1
__kbztb_g7:
        add a,a
        jr nz,__kbztb_b10
        ld a,(hl)
        dec hl
        rla
__kbztb_b10:
        jr nc,__kbztb_e9
__kbztb_d8:
        add a,a
        jr nz,__kbztb_b11
        ld a,(hl)
        dec hl
        rla
__kbztb_b11:
        rl c
        rl b
        jr __kbztb_g7
__kbztb_e9:
                                    ; a copy from the last offset
        push hl
        push ix
        pop hl
        add hl,de
        lddr
        pop hl
        add a,a
        jr nz,__kbztb_b12
        ld a,(hl)
        dec hl
        rla
__kbztb_b12:
        jp nc,__kbztb_lits
__kbztb_new:
        ld bc,1
__kbztb_g13:
        add a,a
        jr nz,__kbztb_b16
        ld a,(hl)
        dec hl
        rla
__kbztb_b16:
        jr nc,__kbztb_e15
__kbztb_d14:
        add a,a
        jr nz,__kbztb_b17
        ld a,(hl)
        dec hl
        rla
__kbztb_b17:
        rl c
        rl b
        jr __kbztb_g13
__kbztb_e15:
        dec b                       ; a high part of 256 ends the data
        jp z,__kbztb_done
        ld b,c
        dec b                       ; B = high - 1
        ld c,(hl)
        dec hl
        srl b
        rr c
        inc bc                      ; BC = (high - 1) * 128 + low / 2 + 1; carry: the length's first bit
        push bc
        pop ix
        ld bc,1
        jr nc,__kbztb_e20
        jr __kbztb_d19
__kbztb_g18:
        add a,a
        jr nz,__kbztb_b21
        ld a,(hl)
        dec hl
        rla
__kbztb_b21:
        jr nc,__kbztb_e20
__kbztb_d19:
        add a,a
        jr nz,__kbztb_b22
        ld a,(hl)
        dec hl
        rla
__kbztb_b22:
        rl c
        rl b
        jr __kbztb_g18
__kbztb_e20:
        inc bc
        push hl
        push ix
        pop hl
        add hl,de
        lddr
        pop hl
        add a,a
        jr nz,__kbztb_b23
        ld a,(hl)
        dec hl
        rla
__kbztb_b23:
        jp c,__kbztb_new
        jp __kbztb_lits
__kbztb_done:
        pop ix
        ret
    END ASM
END SUB

' Forwards, fastest: as Turbo, with JP for the bit reads (a taken JP is 2 T-states cheaper than JR).
SUB FASTCALL __kbZx0Mega()
    ASM
        push ix
        ld ix,-1                  ; the first offset: 1
        ld a,$80
__kbzm_lits:
        ld bc,1
__kbzm_g1:
        add a,a
        jp nz,__kbzm_b4
        ld a,(hl)
        inc hl
        rla
__kbzm_b4:
        jp c,__kbzm_e3
__kbzm_d2:
        add a,a
        jp nz,__kbzm_b5
        ld a,(hl)
        inc hl
        rla
__kbzm_b5:
        rl c
        rl b
        jp __kbzm_g1
__kbzm_e3:
        ldir                        ; the literals
        add a,a
        jp nz,__kbzm_b6
        ld a,(hl)
        inc hl
        rla
__kbzm_b6:
        jp c,__kbzm_new
        ld bc,1
__kbzm_g7:
        add a,a
        jp nz,__kbzm_b10
        ld a,(hl)
        inc hl
        rla
__kbzm_b10:
        jp c,__kbzm_e9
__kbzm_d8:
        add a,a
        jp nz,__kbzm_b11
        ld a,(hl)
        inc hl
        rla
__kbzm_b11:
        rl c
        rl b
        jp __kbzm_g7
__kbzm_e9:
                                    ; a copy from the last offset
        push hl
        push ix
        pop hl
        add hl,de
        ldir
        pop hl
        add a,a
        jp nz,__kbzm_b12
        ld a,(hl)
        inc hl
        rla
__kbzm_b12:
        jp nc,__kbzm_lits
__kbzm_new:
        ld bc,1
__kbzm_g13:
        add a,a
        jp nz,__kbzm_b16
        ld a,(hl)
        inc hl
        rla
__kbzm_b16:
        jp c,__kbzm_e15
__kbzm_d14:
        add a,a
        jp nz,__kbzm_b17
        ld a,(hl)
        inc hl
        rla
__kbzm_b17:
        ccf
        rl c
        rl b
        jp __kbzm_g13
__kbzm_e15:
        dec b                       ; a high part of 256 ends the data
        jp z,__kbzm_done
        push af
        xor a
        sub c
        ld b,a                      ; B = -high
        pop af
        ld c,(hl)
        inc hl
        sra b
        rr c                        ; BC = -(high * 128 - low / 2); carry: the length's first bit
        push bc
        pop ix
        ld bc,1
        jp c,__kbzm_e20
        jp __kbzm_d19
__kbzm_g18:
        add a,a
        jp nz,__kbzm_b21
        ld a,(hl)
        inc hl
        rla
__kbzm_b21:
        jp c,__kbzm_e20
__kbzm_d19:
        add a,a
        jp nz,__kbzm_b22
        ld a,(hl)
        inc hl
        rla
__kbzm_b22:
        rl c
        rl b
        jp __kbzm_g18
__kbzm_e20:
        inc bc
        push hl
        push ix
        pop hl
        add hl,de
        ldir
        pop hl
        add a,a
        jp nz,__kbzm_b23
        ld a,(hl)
        inc hl
        rla
__kbzm_b23:
        jp c,__kbzm_new
        jp __kbzm_lits
__kbzm_done:
        pop ix
        ret
    END ASM
END SUB

' Backwards, fastest.
SUB FASTCALL __kbZx0MegaBack()
    ASM
        push ix
        ld ix,1                  ; the first offset: 1
        ld a,$80
__kbzmb_lits:
        ld bc,1
__kbzmb_g1:
        add a,a
        jp nz,__kbzmb_b4
        ld a,(hl)
        dec hl
        rla
__kbzmb_b4:
        jp nc,__kbzmb_e3
__kbzmb_d2:
        add a,a
        jp nz,__kbzmb_b5
        ld a,(hl)
        dec hl
        rla
__kbzmb_b5:
        rl c
        rl b
        jp __kbzmb_g1
__kbzmb_e3:
        lddr                        ; the literals
        add a,a
        jp nz,__kbzmb_b6
        ld a,(hl)
        dec hl
        rla
__kbzmb_b6:
        jp c,__kbzmb_new
        ld bc,1
__kbzmb_g7:
        add a,a
        jp nz,__kbzmb_b10
        ld a,(hl)
        dec hl
        rla
__kbzmb_b10:
        jp nc,__kbzmb_e9
__kbzmb_d8:
        add a,a
        jp nz,__kbzmb_b11
        ld a,(hl)
        dec hl
        rla
__kbzmb_b11:
        rl c
        rl b
        jp __kbzmb_g7
__kbzmb_e9:
                                    ; a copy from the last offset
        push hl
        push ix
        pop hl
        add hl,de
        lddr
        pop hl
        add a,a
        jp nz,__kbzmb_b12
        ld a,(hl)
        dec hl
        rla
__kbzmb_b12:
        jp nc,__kbzmb_lits
__kbzmb_new:
        ld bc,1
__kbzmb_g13:
        add a,a
        jp nz,__kbzmb_b16
        ld a,(hl)
        dec hl
        rla
__kbzmb_b16:
        jp nc,__kbzmb_e15
__kbzmb_d14:
        add a,a
        jp nz,__kbzmb_b17
        ld a,(hl)
        dec hl
        rla
__kbzmb_b17:
        rl c
        rl b
        jp __kbzmb_g13
__kbzmb_e15:
        dec b                       ; a high part of 256 ends the data
        jp z,__kbzmb_done
        ld b,c
        dec b                       ; B = high - 1
        ld c,(hl)
        dec hl
        srl b
        rr c
        inc bc                      ; BC = (high - 1) * 128 + low / 2 + 1; carry: the length's first bit
        push bc
        pop ix
        ld bc,1
        jp nc,__kbzmb_e20
        jp __kbzmb_d19
__kbzmb_g18:
        add a,a
        jp nz,__kbzmb_b21
        ld a,(hl)
        dec hl
        rla
__kbzmb_b21:
        jp nc,__kbzmb_e20
__kbzmb_d19:
        add a,a
        jp nz,__kbzmb_b22
        ld a,(hl)
        dec hl
        rla
__kbzmb_b22:
        rl c
        rl b
        jp __kbzmb_g18
__kbzmb_e20:
        inc bc
        push hl
        push ix
        pop hl
        add hl,de
        lddr
        pop hl
        add a,a
        jp nz,__kbzmb_b23
        ld a,(hl)
        dec hl
        rla
__kbzmb_b23:
        jp c,__kbzmb_new
        jp __kbzmb_lits
__kbzmb_done:
        pop ix
        ret
    END ASM
END SUB

' The RCS decoders. The stream's byte i of the screen bitmap (16384-22527) is the screen byte of
' third i / 2048, column (i / 64) mod 32, character row (i / 8) mod 8 and pixel line i mod 8; every
' other byte is where it says. DE counts the stream's positions; DE' holds where the next byte goes
' and HL' where a copy's source is. A run of literals or a copy goes in segments that stay on one side
' of the bitmap's edges ($4000, $5800): outside it one LDIR (LDDR) moves the segment, inside it each
' byte's place follows the last one's (mostly the next pixel line, one INC). The bits wait in AF'
' while bytes are copied. BASIC's HL' is kept.

' Forwards, compact: the bitmap moves are subroutines.
SUB FASTCALL __kbZx0SmartRcs()
    ASM
        push ix
        exx
        push hl                     ; BASIC's HL'
        exx
        push de
        ex de,hl
        call __kbzr_map
        push hl
        exx
        pop de                      ; DE': where the destination is
        exx
        ex de,hl
        pop de                      ; DE: the destination's stream position
        ld ix,-1
        ld a,$80
__kbzr_lits:
        call __kbzr_gammaplain
        ex af,af'                   ; the bits wait in AF'
        ld (__kbzr_rem),bc
        ld a,d
        sub $40
        cp $18
        jp nc,__kbzr_ls1
        push hl
        ld h,d
        ld l,e
        add hl,bc
        dec hl
        ld a,h
        pop hl
        jp c,__kbzr_ls1
        cp $58
        jp nc,__kbzr_ls1
        push hl
        ld hl,0
        ld (__kbzr_rem),hl
        pop hl
        jp __kbzr_li2
__kbzr_ls1:
        push hl
        ld h,d
        ld l,e
        call __kbzr_left          ; A: $FF in the bitmap
        ld bc,(__kbzr_rem)
        call __kbzr_min
        call __kbzr_take
        pop hl
        or a
        jp nz,__kbzr_li2
        ldir                        ; outside the bitmap: where it says
        push de
        exx
        pop de
        exx
        jp __kbzr_ln4
__kbzr_li2:
        push hl
        ld h,d
        ld l,e
        add hl,bc
        ld d,h
        ld e,l
        pop hl
        push hl
        push bc
        exx
        pop bc
        pop hl                      ; HL': the data, BC': the count
        ld a,b
        ld b,c
        ld c,a
        ld a,b
        or a
        jr z,__kbzr_k5
        inc c
__kbzr_k5:
__kbzr_ll3:
        ld a,(hl)
        inc hl
        ld (de),a
        call __kbzr_fastde
        djnz __kbzr_ll3
        dec c
        jp nz,__kbzr_ll3
        push hl
        exx
        pop hl
__kbzr_ln4:
        ld bc,(__kbzr_rem)
        ld a,b
        or c
        jp nz,__kbzr_ls1
        ex af,af'
        add a,a
        jr nz,__kbzr_b6
        ld a,(hl)
        inc hl
        rla
__kbzr_b6:
        jp c,__kbzr_new
        call __kbzr_gammaplain
        ex af,af'
        ld (__kbzr_rem),bc
        push hl                     ; the data pointer
        push ix
        pop hl
        add hl,de                   ; the copy's stream position
        ld a,h
        sub $40
        cp $18
        jp nc,__kbzr_cs7
        ld a,d
        sub $40
        cp $18
        jp nc,__kbzr_cs7
        push hl
        ld h,d
        ld l,e
        add hl,bc
        dec hl
        ld a,h
        pop hl
        jp c,__kbzr_cs7
        cp $58
        jp nc,__kbzr_cs7
        push hl
        ld hl,0
        ld (__kbzr_rem),hl
        pop hl
        call __kbzr_map
        push hl
        exx
        pop hl                      ; HL': the source's place
        exx
        jp __kbzr_cb8
__kbzr_cs7:
        push ix
        pop hl
        add hl,de                   ; the copy's stream position
        push hl
        call __kbzr_left
        ld (__kbzr_sin),a
        ld bc,(__kbzr_rem)
        call __kbzr_min
        ld h,d
        ld l,e
        call __kbzr_left
        call __kbzr_min
        call __kbzr_take          ; BC: the bytes of this segment
        pop hl
        ld (__kbzr_din),a
        ld a,(__kbzr_sin)
        or a
        jp nz,__kbzr_cm9
        ld a,(__kbzr_din)
        or a
        jp nz,__kbzr_cm9
        push ix
        pop hl
        add hl,de
        ldir
        push de
        exx
        pop de
        exx
        jp __kbzr_cn12
__kbzr_cm9:
        push ix
        pop hl
        add hl,de
        call __kbzr_map
        push hl
        exx
        pop hl                      ; HL': the source's place
        exx
        ld a,(__kbzr_sin)
        ld hl,__kbzr_din
        and (hl)
        jp z,__kbzr_cx11
__kbzr_cb8:
        push hl
        ld h,d
        ld l,e
        add hl,bc
        ld d,h
        ld e,l
        pop hl
        push bc
        exx
        pop bc
        ld a,b
        ld b,c
        ld c,a
        ld a,b
        or a
        jr z,__kbzr_k13
        inc c
__kbzr_k13:
__kbzr_cl10:
        ld a,(hl)
        ld (de),a
        call __kbzr_fasthl
        call __kbzr_fastde
        djnz __kbzr_cl10
        dec c
        jp nz,__kbzr_cl10
        exx
        jp __kbzr_cn12
__kbzr_cx11:
        exx
        ld a,(hl)
        ld (de),a
        call __kbzr_anyhl
        call __kbzr_anyde
        exx
        inc de
        dec bc
        ld a,b
        or c
        jp nz,__kbzr_cx11
__kbzr_cn12:
        ld bc,(__kbzr_rem)
        ld a,b
        or c
        jp nz,__kbzr_cs7
        pop hl
        ex af,af'
        add a,a
        jr nz,__kbzr_b14
        ld a,(hl)
        inc hl
        rla
__kbzr_b14:
        jp nc,__kbzr_lits
__kbzr_new:
        call __kbzr_gammainv
        dec b                       ; a high part of 256 ends the data
        jp z,__kbzr_done
        push af
        xor a
        sub c
        ld b,a
        pop af
        ld c,(hl)
        inc hl
        sra b
        rr c                        ; BC = -the offset; carry: the length's first bit
        push bc
        pop ix
        call __kbzr_gammacarry
        inc bc
        ex af,af'
        ld (__kbzr_rem),bc
        push hl                     ; the data pointer
        push ix
        pop hl
        add hl,de                   ; the copy's stream position
        ld a,h
        sub $40
        cp $18
        jp nc,__kbzr_cs15
        ld a,d
        sub $40
        cp $18
        jp nc,__kbzr_cs15
        push hl
        ld h,d
        ld l,e
        add hl,bc
        dec hl
        ld a,h
        pop hl
        jp c,__kbzr_cs15
        cp $58
        jp nc,__kbzr_cs15
        push hl
        ld hl,0
        ld (__kbzr_rem),hl
        pop hl
        call __kbzr_map
        push hl
        exx
        pop hl                      ; HL': the source's place
        exx
        jp __kbzr_cb16
__kbzr_cs15:
        push ix
        pop hl
        add hl,de                   ; the copy's stream position
        push hl
        call __kbzr_left
        ld (__kbzr_sin),a
        ld bc,(__kbzr_rem)
        call __kbzr_min
        ld h,d
        ld l,e
        call __kbzr_left
        call __kbzr_min
        call __kbzr_take          ; BC: the bytes of this segment
        pop hl
        ld (__kbzr_din),a
        ld a,(__kbzr_sin)
        or a
        jp nz,__kbzr_cm17
        ld a,(__kbzr_din)
        or a
        jp nz,__kbzr_cm17
        push ix
        pop hl
        add hl,de
        ldir
        push de
        exx
        pop de
        exx
        jp __kbzr_cn20
__kbzr_cm17:
        push ix
        pop hl
        add hl,de
        call __kbzr_map
        push hl
        exx
        pop hl                      ; HL': the source's place
        exx
        ld a,(__kbzr_sin)
        ld hl,__kbzr_din
        and (hl)
        jp z,__kbzr_cx19
__kbzr_cb16:
        push hl
        ld h,d
        ld l,e
        add hl,bc
        ld d,h
        ld e,l
        pop hl
        push bc
        exx
        pop bc
        ld a,b
        ld b,c
        ld c,a
        ld a,b
        or a
        jr z,__kbzr_k21
        inc c
__kbzr_k21:
__kbzr_cl18:
        ld a,(hl)
        ld (de),a
        call __kbzr_fasthl
        call __kbzr_fastde
        djnz __kbzr_cl18
        dec c
        jp nz,__kbzr_cl18
        exx
        jp __kbzr_cn20
__kbzr_cx19:
        exx
        ld a,(hl)
        ld (de),a
        call __kbzr_anyhl
        call __kbzr_anyde
        exx
        inc de
        dec bc
        ld a,b
        or c
        jp nz,__kbzr_cx19
__kbzr_cn20:
        ld bc,(__kbzr_rem)
        ld a,b
        or c
        jp nz,__kbzr_cs15
        pop hl
        ex af,af'
        add a,a
        jr nz,__kbzr_b22
        ld a,(hl)
        inc hl
        rla
__kbzr_b22:
        jp c,__kbzr_new
        jp __kbzr_lits
__kbzr_done:
        exx
        pop hl
        exx
        pop ix
        ret
__kbzr_gammaplain:
        ld bc,1
__kbzr_g23:
        add a,a
        jr nz,__kbzr_b26
        ld a,(hl)
        inc hl
        rla
__kbzr_b26:
        jr c,__kbzr_e25
__kbzr_d24:
        add a,a
        jr nz,__kbzr_b27
        ld a,(hl)
        inc hl
        rla
__kbzr_b27:
        rl c
        rl b
        jr __kbzr_g23
__kbzr_e25:
        ret
__kbzr_gammainv:
        ld bc,1
__kbzr_g28:
        add a,a
        jr nz,__kbzr_b31
        ld a,(hl)
        inc hl
        rla
__kbzr_b31:
        jr c,__kbzr_e30
__kbzr_d29:
        add a,a
        jr nz,__kbzr_b32
        ld a,(hl)
        inc hl
        rla
__kbzr_b32:
        ccf
        rl c
        rl b
        jr __kbzr_g28
__kbzr_e30:
        ret
__kbzr_gammacarry:
        ld bc,1
        jr c,__kbzr_e35
        jr __kbzr_d34
__kbzr_g33:
        add a,a
        jr nz,__kbzr_b36
        ld a,(hl)
        inc hl
        rla
__kbzr_b36:
        jr c,__kbzr_e35
__kbzr_d34:
        add a,a
        jr nz,__kbzr_b37
        ld a,(hl)
        inc hl
        rla
__kbzr_b37:
        rl c
        rl b
        jr __kbzr_g33
__kbzr_e35:
        ret
__kbzr_fastde:
        inc d                      ; the next pixel line
        ld a,d
        and 7
        jr nz,__kbzr_m38
        ld a,d
        sub 8
        ld d,a                    ; line 0 of
        ld a,e
        add a,32
        ld e,a                    ; the next character row
        jr nc,__kbzr_m38
        inc e                      ; row 0 of the next column
        ld a,e
        cp 32
        jr c,__kbzr_m38
        ld e,0                    ; column 0 of the next third ($5800 after the last)
        ld a,d
        add a,8
        ld d,a
__kbzr_m38:
        ret
__kbzr_anyde:
        ld a,d
        sub $40
        cp $18
        jr nc,__kbzr_p39
        inc d                      ; the next pixel line
        ld a,d
        and 7
        jr nz,__kbzr_m40
        ld a,d
        sub 8
        ld d,a                    ; line 0 of
        ld a,e
        add a,32
        ld e,a                    ; the next character row
        jr nc,__kbzr_m40
        inc e                      ; row 0 of the next column
        ld a,e
        cp 32
        jr c,__kbzr_m40
        ld e,0                    ; column 0 of the next third ($5800 after the last)
        ld a,d
        add a,8
        ld d,a
__kbzr_m40:
        ret
__kbzr_p39:
        inc de
        ret
__kbzr_fasthl:
        inc h                      ; the next pixel line
        ld a,h
        and 7
        jr nz,__kbzr_m41
        ld a,h
        sub 8
        ld h,a                    ; line 0 of
        ld a,l
        add a,32
        ld l,a                    ; the next character row
        jr nc,__kbzr_m41
        inc l                      ; row 0 of the next column
        ld a,l
        cp 32
        jr c,__kbzr_m41
        ld l,0                    ; column 0 of the next third ($5800 after the last)
        ld a,h
        add a,8
        ld h,a
__kbzr_m41:
        ret
__kbzr_anyhl:
        ld a,h
        sub $40
        cp $18
        jr nc,__kbzr_p42
        inc h                      ; the next pixel line
        ld a,h
        and 7
        jr nz,__kbzr_m43
        ld a,h
        sub 8
        ld h,a                    ; line 0 of
        ld a,l
        add a,32
        ld l,a                    ; the next character row
        jr nc,__kbzr_m43
        inc l                      ; row 0 of the next column
        ld a,l
        cp 32
        jr c,__kbzr_m43
        ld l,0                    ; column 0 of the next third ($5800 after the last)
        ld a,h
        add a,8
        ld h,a
__kbzr_m43:
        ret
__kbzr_p42:
        inc hl
        ret
__kbzr_left:
        push de
        ex de,hl
        ld a,d
        cp $40
        jr c,__kbzr_below
        cp $58
        jr c,__kbzr_inside
        ld hl,0                     ; above the bitmap: to the end of memory
        jr __kbzr_out
__kbzr_below:
        ld hl,$4000
__kbzr_out:
        or a
        sbc hl,de
        pop de
        xor a
        ret
__kbzr_inside:
        ld hl,$5800
        or a
        sbc hl,de
        pop de
        ld a,$ff
        ret
__kbzr_min:
        push hl
        or a
        sbc hl,bc
        pop hl
        ret nc
        ld b,h
        ld c,l
        ret
__kbzr_take:
        push hl
        ld hl,(__kbzr_rem)
        or a
        sbc hl,bc
        ld (__kbzr_rem),hl
        pop hl
        ret
__kbzr_map:
        ld a,h
        sub $40
        ret c
        cp $18
        ret nc
        push de
        ld d,a                      ; 0 0 0 s1 s0 c4 c3 c2
        ld a,l
        and 7
        ld e,a
        ld a,d
        and $18
        or e
        or $40
        ld e,a                      ; the high byte: $40 + third * 8 + line
        ld a,d
        and 7
        add a,a
        add a,a
        ld d,a
        ld a,l
        rlca
        rlca
        and 3
        or d
        ld d,a
        ld a,l
        and $38
        add a,a
        add a,a
        or d
        ld l,a                      ; the low byte: row * 32 + column
        ld h,e
        pop de
        ret
__kbzr_rem: dw 0
__kbzr_sin: db 0
__kbzr_din: db 0
__kbzr_cnt: dw 0
    END ASM
END SUB

' Backwards, compact.
SUB FASTCALL __kbZx0SmartRcsBack()
    ASM
        push ix
        exx
        push hl                     ; BASIC's HL'
        exx
        push de
        ex de,hl
        call __kbzrb_map
        push hl
        exx
        pop de                      ; DE': where the destination is
        exx
        ex de,hl
        pop de                      ; DE: the destination's stream position
        ld ix,1
        ld a,$80
__kbzrb_lits:
        call __kbzrb_gammaplain
        ex af,af'                   ; the bits wait in AF'
        ld (__kbzrb_rem),bc
        ld a,d
        sub $40
        cp $18
        jp nc,__kbzrb_ls1
        push hl
        ld h,d
        ld l,e
        or a
        sbc hl,bc
        inc hl
        ld a,h
        pop hl
        jp c,__kbzrb_ls1
        cp $40
        jp c,__kbzrb_ls1
        push hl
        ld hl,0
        ld (__kbzrb_rem),hl
        pop hl
        jp __kbzrb_li2
__kbzrb_ls1:
        push hl
        ld h,d
        ld l,e
        call __kbzrb_left          ; A: $FF in the bitmap
        ld bc,(__kbzrb_rem)
        call __kbzrb_min
        call __kbzrb_take
        pop hl
        or a
        jp nz,__kbzrb_li2
        lddr                        ; outside the bitmap: where it says
        push de
        exx
        pop de
        exx
        jp __kbzrb_ln4
__kbzrb_li2:
        push hl
        ld h,d
        ld l,e
        or a
        sbc hl,bc
        ld d,h
        ld e,l
        pop hl
        push hl
        push bc
        exx
        pop bc
        pop hl                      ; HL': the data, BC': the count
        ld a,b
        ld b,c
        ld c,a
        ld a,b
        or a
        jr z,__kbzrb_k5
        inc c
__kbzrb_k5:
__kbzrb_ll3:
        ld a,(hl)
        dec hl
        ld (de),a
        call __kbzrb_fastde
        djnz __kbzrb_ll3
        dec c
        jp nz,__kbzrb_ll3
        push hl
        exx
        pop hl
__kbzrb_ln4:
        ld bc,(__kbzrb_rem)
        ld a,b
        or c
        jp nz,__kbzrb_ls1
        ex af,af'
        add a,a
        jr nz,__kbzrb_b6
        ld a,(hl)
        dec hl
        rla
__kbzrb_b6:
        jp c,__kbzrb_new
        call __kbzrb_gammaplain
        ex af,af'
        ld (__kbzrb_rem),bc
        push hl                     ; the data pointer
        push ix
        pop hl
        add hl,de                   ; the copy's stream position
        ld a,h
        sub $40
        cp $18
        jp nc,__kbzrb_cs7
        ld a,d
        sub $40
        cp $18
        jp nc,__kbzrb_cs7
        push hl
        ld h,d
        ld l,e
        or a
        sbc hl,bc
        inc hl
        ld a,h
        pop hl
        jp c,__kbzrb_cs7
        cp $40
        jp c,__kbzrb_cs7
        push hl
        ld hl,0
        ld (__kbzrb_rem),hl
        pop hl
        call __kbzrb_map
        push hl
        exx
        pop hl                      ; HL': the source's place
        exx
        jp __kbzrb_cb8
__kbzrb_cs7:
        push ix
        pop hl
        add hl,de                   ; the copy's stream position
        push hl
        call __kbzrb_left
        ld (__kbzrb_sin),a
        ld bc,(__kbzrb_rem)
        call __kbzrb_min
        ld h,d
        ld l,e
        call __kbzrb_left
        call __kbzrb_min
        call __kbzrb_take          ; BC: the bytes of this segment
        pop hl
        ld (__kbzrb_din),a
        ld a,(__kbzrb_sin)
        or a
        jp nz,__kbzrb_cm9
        ld a,(__kbzrb_din)
        or a
        jp nz,__kbzrb_cm9
        push ix
        pop hl
        add hl,de
        lddr
        push de
        exx
        pop de
        exx
        jp __kbzrb_cn12
__kbzrb_cm9:
        push ix
        pop hl
        add hl,de
        call __kbzrb_map
        push hl
        exx
        pop hl                      ; HL': the source's place
        exx
        ld a,(__kbzrb_sin)
        ld hl,__kbzrb_din
        and (hl)
        jp z,__kbzrb_cx11
__kbzrb_cb8:
        push hl
        ld h,d
        ld l,e
        or a
        sbc hl,bc
        ld d,h
        ld e,l
        pop hl
        push bc
        exx
        pop bc
        ld a,b
        ld b,c
        ld c,a
        ld a,b
        or a
        jr z,__kbzrb_k13
        inc c
__kbzrb_k13:
__kbzrb_cl10:
        ld a,(hl)
        ld (de),a
        call __kbzrb_fasthl
        call __kbzrb_fastde
        djnz __kbzrb_cl10
        dec c
        jp nz,__kbzrb_cl10
        exx
        jp __kbzrb_cn12
__kbzrb_cx11:
        exx
        ld a,(hl)
        ld (de),a
        call __kbzrb_anyhl
        call __kbzrb_anyde
        exx
        dec de
        dec bc
        ld a,b
        or c
        jp nz,__kbzrb_cx11
__kbzrb_cn12:
        ld bc,(__kbzrb_rem)
        ld a,b
        or c
        jp nz,__kbzrb_cs7
        pop hl
        ex af,af'
        add a,a
        jr nz,__kbzrb_b14
        ld a,(hl)
        dec hl
        rla
__kbzrb_b14:
        jp nc,__kbzrb_lits
__kbzrb_new:
        call __kbzrb_gammaplain
        dec b                       ; a high part of 256 ends the data
        jp z,__kbzrb_done
        ld b,c
        dec b
        ld c,(hl)
        dec hl
        srl b
        rr c
        inc bc                      ; BC = the offset; carry: the length's first bit
        push bc
        pop ix
        call __kbzrb_gammacarry
        inc bc
        ex af,af'
        ld (__kbzrb_rem),bc
        push hl                     ; the data pointer
        push ix
        pop hl
        add hl,de                   ; the copy's stream position
        ld a,h
        sub $40
        cp $18
        jp nc,__kbzrb_cs15
        ld a,d
        sub $40
        cp $18
        jp nc,__kbzrb_cs15
        push hl
        ld h,d
        ld l,e
        or a
        sbc hl,bc
        inc hl
        ld a,h
        pop hl
        jp c,__kbzrb_cs15
        cp $40
        jp c,__kbzrb_cs15
        push hl
        ld hl,0
        ld (__kbzrb_rem),hl
        pop hl
        call __kbzrb_map
        push hl
        exx
        pop hl                      ; HL': the source's place
        exx
        jp __kbzrb_cb16
__kbzrb_cs15:
        push ix
        pop hl
        add hl,de                   ; the copy's stream position
        push hl
        call __kbzrb_left
        ld (__kbzrb_sin),a
        ld bc,(__kbzrb_rem)
        call __kbzrb_min
        ld h,d
        ld l,e
        call __kbzrb_left
        call __kbzrb_min
        call __kbzrb_take          ; BC: the bytes of this segment
        pop hl
        ld (__kbzrb_din),a
        ld a,(__kbzrb_sin)
        or a
        jp nz,__kbzrb_cm17
        ld a,(__kbzrb_din)
        or a
        jp nz,__kbzrb_cm17
        push ix
        pop hl
        add hl,de
        lddr
        push de
        exx
        pop de
        exx
        jp __kbzrb_cn20
__kbzrb_cm17:
        push ix
        pop hl
        add hl,de
        call __kbzrb_map
        push hl
        exx
        pop hl                      ; HL': the source's place
        exx
        ld a,(__kbzrb_sin)
        ld hl,__kbzrb_din
        and (hl)
        jp z,__kbzrb_cx19
__kbzrb_cb16:
        push hl
        ld h,d
        ld l,e
        or a
        sbc hl,bc
        ld d,h
        ld e,l
        pop hl
        push bc
        exx
        pop bc
        ld a,b
        ld b,c
        ld c,a
        ld a,b
        or a
        jr z,__kbzrb_k21
        inc c
__kbzrb_k21:
__kbzrb_cl18:
        ld a,(hl)
        ld (de),a
        call __kbzrb_fasthl
        call __kbzrb_fastde
        djnz __kbzrb_cl18
        dec c
        jp nz,__kbzrb_cl18
        exx
        jp __kbzrb_cn20
__kbzrb_cx19:
        exx
        ld a,(hl)
        ld (de),a
        call __kbzrb_anyhl
        call __kbzrb_anyde
        exx
        dec de
        dec bc
        ld a,b
        or c
        jp nz,__kbzrb_cx19
__kbzrb_cn20:
        ld bc,(__kbzrb_rem)
        ld a,b
        or c
        jp nz,__kbzrb_cs15
        pop hl
        ex af,af'
        add a,a
        jr nz,__kbzrb_b22
        ld a,(hl)
        dec hl
        rla
__kbzrb_b22:
        jp c,__kbzrb_new
        jp __kbzrb_lits
__kbzrb_done:
        exx
        pop hl
        exx
        pop ix
        ret
__kbzrb_gammaplain:
        ld bc,1
__kbzrb_g23:
        add a,a
        jr nz,__kbzrb_b26
        ld a,(hl)
        dec hl
        rla
__kbzrb_b26:
        jr nc,__kbzrb_e25
__kbzrb_d24:
        add a,a
        jr nz,__kbzrb_b27
        ld a,(hl)
        dec hl
        rla
__kbzrb_b27:
        rl c
        rl b
        jr __kbzrb_g23
__kbzrb_e25:
        ret
__kbzrb_gammacarry:
        ld bc,1
        jr nc,__kbzrb_e30
        jr __kbzrb_d29
__kbzrb_g28:
        add a,a
        jr nz,__kbzrb_b31
        ld a,(hl)
        dec hl
        rla
__kbzrb_b31:
        jr nc,__kbzrb_e30
__kbzrb_d29:
        add a,a
        jr nz,__kbzrb_b32
        ld a,(hl)
        dec hl
        rla
__kbzrb_b32:
        rl c
        rl b
        jr __kbzrb_g28
__kbzrb_e30:
        ret
__kbzrb_fastde:
        dec d                      ; the pixel line above
        ld a,d
        and 7
        cp 7
        jr nz,__kbzrb_m33
        ld a,d
        add a,8
        ld d,a                    ; line 7 of
        ld a,e
        sub 32
        ld e,a                    ; the character row above
        jr nc,__kbzrb_m33
        and 31
        jr z,__kbzrb_z34
        dec e                      ; row 7 of the column before
        jr __kbzrb_m33
__kbzrb_z34:
        ld e,$ff                  ; column 31 of the third before ($3FFF before the first)
        ld a,d
        sub 8
        ld d,a
__kbzrb_m33:
        ret
__kbzrb_anyde:
        ld a,d
        sub $40
        cp $18
        jr nc,__kbzrb_p35
        dec d                      ; the pixel line above
        ld a,d
        and 7
        cp 7
        jr nz,__kbzrb_m36
        ld a,d
        add a,8
        ld d,a                    ; line 7 of
        ld a,e
        sub 32
        ld e,a                    ; the character row above
        jr nc,__kbzrb_m36
        and 31
        jr z,__kbzrb_z37
        dec e                      ; row 7 of the column before
        jr __kbzrb_m36
__kbzrb_z37:
        ld e,$ff                  ; column 31 of the third before ($3FFF before the first)
        ld a,d
        sub 8
        ld d,a
__kbzrb_m36:
        ret
__kbzrb_p35:
        dec de
        ret
__kbzrb_fasthl:
        dec h                      ; the pixel line above
        ld a,h
        and 7
        cp 7
        jr nz,__kbzrb_m38
        ld a,h
        add a,8
        ld h,a                    ; line 7 of
        ld a,l
        sub 32
        ld l,a                    ; the character row above
        jr nc,__kbzrb_m38
        and 31
        jr z,__kbzrb_z39
        dec l                      ; row 7 of the column before
        jr __kbzrb_m38
__kbzrb_z39:
        ld l,$ff                  ; column 31 of the third before ($3FFF before the first)
        ld a,h
        sub 8
        ld h,a
__kbzrb_m38:
        ret
__kbzrb_anyhl:
        ld a,h
        sub $40
        cp $18
        jr nc,__kbzrb_p40
        dec h                      ; the pixel line above
        ld a,h
        and 7
        cp 7
        jr nz,__kbzrb_m41
        ld a,h
        add a,8
        ld h,a                    ; line 7 of
        ld a,l
        sub 32
        ld l,a                    ; the character row above
        jr nc,__kbzrb_m41
        and 31
        jr z,__kbzrb_z42
        dec l                      ; row 7 of the column before
        jr __kbzrb_m41
__kbzrb_z42:
        ld l,$ff                  ; column 31 of the third before ($3FFF before the first)
        ld a,h
        sub 8
        ld h,a
__kbzrb_m41:
        ret
__kbzrb_p40:
        dec hl
        ret
__kbzrb_left:
        push de
        ex de,hl
        ld a,d
        cp $40
        jr c,__kbzrb_below
        cp $58
        jr c,__kbzrb_inside
        ld hl,-$57ff                ; above the bitmap: down to $5800
        jr __kbzrb_out
__kbzrb_below:
        ld hl,1                     ; down to 0
__kbzrb_out:
        add hl,de
        pop de
        xor a
        ret
__kbzrb_inside:
        ld hl,-$3fff
        add hl,de
        pop de
        ld a,$ff
        ret
__kbzrb_min:
        push hl
        or a
        sbc hl,bc
        pop hl
        ret nc
        ld b,h
        ld c,l
        ret
__kbzrb_take:
        push hl
        ld hl,(__kbzrb_rem)
        or a
        sbc hl,bc
        ld (__kbzrb_rem),hl
        pop hl
        ret
__kbzrb_map:
        ld a,h
        sub $40
        ret c
        cp $18
        ret nc
        push de
        ld d,a                      ; 0 0 0 s1 s0 c4 c3 c2
        ld a,l
        and 7
        ld e,a
        ld a,d
        and $18
        or e
        or $40
        ld e,a                      ; the high byte: $40 + third * 8 + line
        ld a,d
        and 7
        add a,a
        add a,a
        ld d,a
        ld a,l
        rlca
        rlca
        and 3
        or d
        ld d,a
        ld a,l
        and $38
        add a,a
        add a,a
        or d
        ld l,a                      ; the low byte: row * 32 + column
        ld h,e
        pop de
        ret
__kbzrb_rem: dw 0
__kbzrb_sin: db 0
__kbzrb_din: db 0
__kbzrb_cnt: dw 0
    END ASM
END SUB

' Forwards, faster: the bitmap moves inline.
SUB FASTCALL __kbZx0AgileRcs()
    ASM
        push ix
        exx
        push hl                     ; BASIC's HL'
        exx
        push de
        ex de,hl
        call __kbza_map
        push hl
        exx
        pop de                      ; DE': where the destination is
        exx
        ex de,hl
        pop de                      ; DE: the destination's stream position
        ld ix,-1
        ld a,$80
__kbza_lits:
        call __kbza_gammaplain
        ex af,af'                   ; the bits wait in AF'
        ld (__kbza_rem),bc
        ld a,d
        sub $40
        cp $18
        jp nc,__kbza_ls1
        push hl
        ld h,d
        ld l,e
        add hl,bc
        dec hl
        ld a,h
        pop hl
        jp c,__kbza_ls1
        cp $58
        jp nc,__kbza_ls1
        push hl
        ld hl,0
        ld (__kbza_rem),hl
        pop hl
        jp __kbza_li2
__kbza_ls1:
        push hl
        ld h,d
        ld l,e
        call __kbza_left          ; A: $FF in the bitmap
        ld bc,(__kbza_rem)
        call __kbza_min
        call __kbza_take
        pop hl
        or a
        jp nz,__kbza_li2
        ldir                        ; outside the bitmap: where it says
        push de
        exx
        pop de
        exx
        jp __kbza_ln4
__kbza_li2:
        push hl
        ld h,d
        ld l,e
        add hl,bc
        ld d,h
        ld e,l
        pop hl
        push hl
        push bc
        exx
        pop bc
        pop hl                      ; HL': the data, BC': the count
        ld a,b
        ld (__kbza_cnt),a            ; the count's high byte
__kbza_q5:
        ld a,d
        and 7
        neg
        add a,8
        ld b,a                      ; B: the room in the cell(s)
        ld a,(__kbza_cnt)
        or a
        jr nz,__kbza_t7
        ld a,c
        cp b
        jr nc,__kbza_t7
        ld b,a                      ; fewer bytes left than room
__kbza_t7:
        ld a,c
        sub b
        ld c,a
        jr nc,__kbza_i6
        ld a,(__kbza_cnt)
        dec a
        ld (__kbza_cnt),a
__kbza_i6:
        ld a,(hl)
        inc hl
        ld (de),a
        inc d
        djnz __kbza_i6
        ld a,d
        and 7
        jr nz,__kbza_f11
        ld a,d
        sub 8
        ld d,a
        ld a,e
        add a,32
        ld e,a
        jr nc,__kbza_f11
        inc e
        ld a,e
        cp 32
        jr c,__kbza_f11
        ld e,0
        ld a,d
        add a,8
        ld d,a
__kbza_f11:
        ld a,c
        or a
        jp nz,__kbza_q5
        ld a,(__kbza_cnt)
        or a
        jp nz,__kbza_q5
        push hl
        exx
        pop hl
__kbza_ln4:
        ld bc,(__kbza_rem)
        ld a,b
        or c
        jp nz,__kbza_ls1
        ex af,af'
        add a,a
        jr nz,__kbza_b12
        ld a,(hl)
        inc hl
        rla
__kbza_b12:
        jp c,__kbza_new
        call __kbza_gammaplain
        ex af,af'
        ld (__kbza_rem),bc
        push hl                     ; the data pointer
        push ix
        pop hl
        add hl,de                   ; the copy's stream position
        ld a,h
        sub $40
        cp $18
        jp nc,__kbza_cs13
        ld a,d
        sub $40
        cp $18
        jp nc,__kbza_cs13
        push hl
        ld h,d
        ld l,e
        add hl,bc
        dec hl
        ld a,h
        pop hl
        jp c,__kbza_cs13
        cp $58
        jp nc,__kbza_cs13
        push hl
        ld hl,0
        ld (__kbza_rem),hl
        pop hl
        call __kbza_map
        push hl
        exx
        pop hl                      ; HL': the source's place
        exx
        jp __kbza_cb14
__kbza_cs13:
        push ix
        pop hl
        add hl,de                   ; the copy's stream position
        push hl
        call __kbza_left
        ld (__kbza_sin),a
        ld bc,(__kbza_rem)
        call __kbza_min
        ld h,d
        ld l,e
        call __kbza_left
        call __kbza_min
        call __kbza_take          ; BC: the bytes of this segment
        pop hl
        ld (__kbza_din),a
        ld a,(__kbza_sin)
        or a
        jp nz,__kbza_cm15
        ld a,(__kbza_din)
        or a
        jp nz,__kbza_cm15
        push ix
        pop hl
        add hl,de
        ldir
        push de
        exx
        pop de
        exx
        jp __kbza_cn18
__kbza_cm15:
        push ix
        pop hl
        add hl,de
        call __kbza_map
        push hl
        exx
        pop hl                      ; HL': the source's place
        exx
        ld a,(__kbza_sin)
        ld hl,__kbza_din
        and (hl)
        jp z,__kbza_cx17
__kbza_cb14:
        push hl
        ld h,d
        ld l,e
        add hl,bc
        ld d,h
        ld e,l
        pop hl
        push bc
        exx
        pop bc
        ld a,b
        ld (__kbza_cnt),a            ; the count's high byte
__kbza_q19:
        ld a,d
        and 7
        ld b,a
        ld a,h
        and 7
        cp b
        jr nc,__kbza_r22
        ld a,b
__kbza_r22:
        neg
        add a,8
        ld b,a                      ; B: the room in the cell(s)
        ld a,(__kbza_cnt)
        or a
        jr nz,__kbza_t21
        ld a,c
        cp b
        jr nc,__kbza_t21
        ld b,a                      ; fewer bytes left than room
__kbza_t21:
        ld a,c
        sub b
        ld c,a
        jr nc,__kbza_i20
        ld a,(__kbza_cnt)
        dec a
        ld (__kbza_cnt),a
__kbza_i20:
        ld a,(hl)
        ld (de),a
        inc h
        inc d
        djnz __kbza_i20
        ld a,h
        and 7
        jr nz,__kbza_f25
        ld a,h
        sub 8
        ld h,a
        ld a,l
        add a,32
        ld l,a
        jr nc,__kbza_f25
        inc l
        ld a,l
        cp 32
        jr c,__kbza_f25
        ld l,0
        ld a,h
        add a,8
        ld h,a
__kbza_f25:
        ld a,d
        and 7
        jr nz,__kbza_f26
        ld a,d
        sub 8
        ld d,a
        ld a,e
        add a,32
        ld e,a
        jr nc,__kbza_f26
        inc e
        ld a,e
        cp 32
        jr c,__kbza_f26
        ld e,0
        ld a,d
        add a,8
        ld d,a
__kbza_f26:
        ld a,c
        or a
        jp nz,__kbza_q19
        ld a,(__kbza_cnt)
        or a
        jp nz,__kbza_q19
        exx
        jp __kbza_cn18
__kbza_cx17:
        exx
        ld a,(hl)
        ld (de),a
        call __kbza_anyhl
        call __kbza_anyde
        exx
        inc de
        dec bc
        ld a,b
        or c
        jp nz,__kbza_cx17
__kbza_cn18:
        ld bc,(__kbza_rem)
        ld a,b
        or c
        jp nz,__kbza_cs13
        pop hl
        ex af,af'
        add a,a
        jr nz,__kbza_b27
        ld a,(hl)
        inc hl
        rla
__kbza_b27:
        jp nc,__kbza_lits
__kbza_new:
        call __kbza_gammainv
        dec b                       ; a high part of 256 ends the data
        jp z,__kbza_done
        push af
        xor a
        sub c
        ld b,a
        pop af
        ld c,(hl)
        inc hl
        sra b
        rr c                        ; BC = -the offset; carry: the length's first bit
        push bc
        pop ix
        call __kbza_gammacarry
        inc bc
        ex af,af'
        ld (__kbza_rem),bc
        push hl                     ; the data pointer
        push ix
        pop hl
        add hl,de                   ; the copy's stream position
        ld a,h
        sub $40
        cp $18
        jp nc,__kbza_cs28
        ld a,d
        sub $40
        cp $18
        jp nc,__kbza_cs28
        push hl
        ld h,d
        ld l,e
        add hl,bc
        dec hl
        ld a,h
        pop hl
        jp c,__kbza_cs28
        cp $58
        jp nc,__kbza_cs28
        push hl
        ld hl,0
        ld (__kbza_rem),hl
        pop hl
        call __kbza_map
        push hl
        exx
        pop hl                      ; HL': the source's place
        exx
        jp __kbza_cb29
__kbza_cs28:
        push ix
        pop hl
        add hl,de                   ; the copy's stream position
        push hl
        call __kbza_left
        ld (__kbza_sin),a
        ld bc,(__kbza_rem)
        call __kbza_min
        ld h,d
        ld l,e
        call __kbza_left
        call __kbza_min
        call __kbza_take          ; BC: the bytes of this segment
        pop hl
        ld (__kbza_din),a
        ld a,(__kbza_sin)
        or a
        jp nz,__kbza_cm30
        ld a,(__kbza_din)
        or a
        jp nz,__kbza_cm30
        push ix
        pop hl
        add hl,de
        ldir
        push de
        exx
        pop de
        exx
        jp __kbza_cn33
__kbza_cm30:
        push ix
        pop hl
        add hl,de
        call __kbza_map
        push hl
        exx
        pop hl                      ; HL': the source's place
        exx
        ld a,(__kbza_sin)
        ld hl,__kbza_din
        and (hl)
        jp z,__kbza_cx32
__kbza_cb29:
        push hl
        ld h,d
        ld l,e
        add hl,bc
        ld d,h
        ld e,l
        pop hl
        push bc
        exx
        pop bc
        ld a,b
        ld (__kbza_cnt),a            ; the count's high byte
__kbza_q34:
        ld a,d
        and 7
        ld b,a
        ld a,h
        and 7
        cp b
        jr nc,__kbza_r37
        ld a,b
__kbza_r37:
        neg
        add a,8
        ld b,a                      ; B: the room in the cell(s)
        ld a,(__kbza_cnt)
        or a
        jr nz,__kbza_t36
        ld a,c
        cp b
        jr nc,__kbza_t36
        ld b,a                      ; fewer bytes left than room
__kbza_t36:
        ld a,c
        sub b
        ld c,a
        jr nc,__kbza_i35
        ld a,(__kbza_cnt)
        dec a
        ld (__kbza_cnt),a
__kbza_i35:
        ld a,(hl)
        ld (de),a
        inc h
        inc d
        djnz __kbza_i35
        ld a,h
        and 7
        jr nz,__kbza_f40
        ld a,h
        sub 8
        ld h,a
        ld a,l
        add a,32
        ld l,a
        jr nc,__kbza_f40
        inc l
        ld a,l
        cp 32
        jr c,__kbza_f40
        ld l,0
        ld a,h
        add a,8
        ld h,a
__kbza_f40:
        ld a,d
        and 7
        jr nz,__kbza_f41
        ld a,d
        sub 8
        ld d,a
        ld a,e
        add a,32
        ld e,a
        jr nc,__kbza_f41
        inc e
        ld a,e
        cp 32
        jr c,__kbza_f41
        ld e,0
        ld a,d
        add a,8
        ld d,a
__kbza_f41:
        ld a,c
        or a
        jp nz,__kbza_q34
        ld a,(__kbza_cnt)
        or a
        jp nz,__kbza_q34
        exx
        jp __kbza_cn33
__kbza_cx32:
        exx
        ld a,(hl)
        ld (de),a
        call __kbza_anyhl
        call __kbza_anyde
        exx
        inc de
        dec bc
        ld a,b
        or c
        jp nz,__kbza_cx32
__kbza_cn33:
        ld bc,(__kbza_rem)
        ld a,b
        or c
        jp nz,__kbza_cs28
        pop hl
        ex af,af'
        add a,a
        jr nz,__kbza_b42
        ld a,(hl)
        inc hl
        rla
__kbza_b42:
        jp c,__kbza_new
        jp __kbza_lits
__kbza_done:
        exx
        pop hl
        exx
        pop ix
        ret
__kbza_gammaplain:
        ld bc,1
__kbza_g43:
        add a,a
        jr nz,__kbza_b46
        ld a,(hl)
        inc hl
        rla
__kbza_b46:
        jr c,__kbza_e45
__kbza_d44:
        add a,a
        jr nz,__kbza_b47
        ld a,(hl)
        inc hl
        rla
__kbza_b47:
        rl c
        rl b
        jr __kbza_g43
__kbza_e45:
        ret
__kbza_gammainv:
        ld bc,1
__kbza_g48:
        add a,a
        jr nz,__kbza_b51
        ld a,(hl)
        inc hl
        rla
__kbza_b51:
        jr c,__kbza_e50
__kbza_d49:
        add a,a
        jr nz,__kbza_b52
        ld a,(hl)
        inc hl
        rla
__kbza_b52:
        ccf
        rl c
        rl b
        jr __kbza_g48
__kbza_e50:
        ret
__kbza_gammacarry:
        ld bc,1
        jr c,__kbza_e55
        jr __kbza_d54
__kbza_g53:
        add a,a
        jr nz,__kbza_b56
        ld a,(hl)
        inc hl
        rla
__kbza_b56:
        jr c,__kbza_e55
__kbza_d54:
        add a,a
        jr nz,__kbza_b57
        ld a,(hl)
        inc hl
        rla
__kbza_b57:
        rl c
        rl b
        jr __kbza_g53
__kbza_e55:
        ret
__kbza_anyde:
        ld a,d
        sub $40
        cp $18
        jr nc,__kbza_p58
        inc d                      ; the next pixel line
        ld a,d
        and 7
        jp nz,__kbza_m59
        ld a,d
        sub 8
        ld d,a                    ; line 0 of
        ld a,e
        add a,32
        ld e,a                    ; the next character row
        jr nc,__kbza_m59
        inc e                      ; row 0 of the next column
        ld a,e
        cp 32
        jr c,__kbza_m59
        ld e,0                    ; column 0 of the next third ($5800 after the last)
        ld a,d
        add a,8
        ld d,a
__kbza_m59:
        ret
__kbza_p58:
        inc de
        ret
__kbza_anyhl:
        ld a,h
        sub $40
        cp $18
        jr nc,__kbza_p60
        inc h                      ; the next pixel line
        ld a,h
        and 7
        jp nz,__kbza_m61
        ld a,h
        sub 8
        ld h,a                    ; line 0 of
        ld a,l
        add a,32
        ld l,a                    ; the next character row
        jr nc,__kbza_m61
        inc l                      ; row 0 of the next column
        ld a,l
        cp 32
        jr c,__kbza_m61
        ld l,0                    ; column 0 of the next third ($5800 after the last)
        ld a,h
        add a,8
        ld h,a
__kbza_m61:
        ret
__kbza_p60:
        inc hl
        ret
__kbza_left:
        push de
        ex de,hl
        ld a,d
        cp $40
        jr c,__kbza_below
        cp $58
        jr c,__kbza_inside
        ld hl,0                     ; above the bitmap: to the end of memory
        jr __kbza_out
__kbza_below:
        ld hl,$4000
__kbza_out:
        or a
        sbc hl,de
        pop de
        xor a
        ret
__kbza_inside:
        ld hl,$5800
        or a
        sbc hl,de
        pop de
        ld a,$ff
        ret
__kbza_min:
        push hl
        or a
        sbc hl,bc
        pop hl
        ret nc
        ld b,h
        ld c,l
        ret
__kbza_take:
        push hl
        ld hl,(__kbza_rem)
        or a
        sbc hl,bc
        ld (__kbza_rem),hl
        pop hl
        ret
__kbza_map:
        ld a,h
        sub $40
        ret c
        cp $18
        ret nc
        push de
        ld d,a                      ; 0 0 0 s1 s0 c4 c3 c2
        ld a,l
        and 7
        ld e,a
        ld a,d
        and $18
        or e
        or $40
        ld e,a                      ; the high byte: $40 + third * 8 + line
        ld a,d
        and 7
        add a,a
        add a,a
        ld d,a
        ld a,l
        rlca
        rlca
        and 3
        or d
        ld d,a
        ld a,l
        and $38
        add a,a
        add a,a
        or d
        ld l,a                      ; the low byte: row * 32 + column
        ld h,e
        pop de
        ret
__kbza_rem: dw 0
__kbza_sin: db 0
__kbza_din: db 0
__kbza_cnt: dw 0
    END ASM
END SUB

SUB FASTCALL dzx0Standard(BYVAL src AS UInteger, BYVAL dst AS UInteger)
    ASM
        pop bc
        pop de
        push bc
        jp ___kbZx0Std
    END ASM
END SUB

SUB FASTCALL dzx0StandardBack(BYVAL src AS UInteger, BYVAL dst AS UInteger)
    ASM
        pop bc
        pop de
        push bc
        jp ___kbZx0StdBack
    END ASM
END SUB

SUB FASTCALL dzx0Turbo(BYVAL src AS UInteger, BYVAL dst AS UInteger)
    ASM
        pop bc
        pop de
        push bc
        jp ___kbZx0Turbo
    END ASM
END SUB

SUB FASTCALL dzx0TurboBack(BYVAL src AS UInteger, BYVAL dst AS UInteger)
    ASM
        pop bc
        pop de
        push bc
        jp ___kbZx0TurboBack
    END ASM
END SUB

SUB FASTCALL dzx0Mega(BYVAL src AS UInteger, BYVAL dst AS UInteger)
    ASM
        pop bc
        pop de
        push bc
        jp ___kbZx0Mega
    END ASM
END SUB

SUB FASTCALL dzx0MegaBack(BYVAL src AS UInteger, BYVAL dst AS UInteger)
    ASM
        pop bc
        pop de
        push bc
        jp ___kbZx0MegaBack
    END ASM
END SUB

SUB FASTCALL dzx0SmartRCS(BYVAL src AS UInteger, BYVAL dst AS UInteger)
    ASM
        pop bc
        pop de
        push bc
        jp ___kbZx0SmartRcs
    END ASM
END SUB

SUB FASTCALL dzx0SmartRCSBack(BYVAL src AS UInteger, BYVAL dst AS UInteger)
    ASM
        pop bc
        pop de
        push bc
        jp ___kbZx0SmartRcsBack
    END ASM
END SUB

SUB FASTCALL dzx0AgileRCS(BYVAL src AS UInteger, BYVAL dst AS UInteger)
    ASM
        pop bc
        pop de
        push bc
        jp ___kbZx0AgileRcs
    END ASM
END SUB

#pragma pop(case_insensitive)
