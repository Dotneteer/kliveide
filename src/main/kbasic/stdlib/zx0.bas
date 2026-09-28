' Klive BASIC standard library - zx0.bas: the ZX0 decompressors.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json) and the published
' ZX0 and RCS formats by Einar Saukas (https://github.com/einar-saukas/ZX0), whose author asks that
' programs using ZX0 mention it in their documentation. Data in ZX0's current format (version 2).
'
' Every name decodes the same stream; Standard is the smallest decoder, Turbo and Mega faster ones.
' "Back" names read the data from its last byte down (src and dst are the last addresses); "RCS"
' names write bytes that land in the screen bitmap to their RCS places.
#pragma once
#pragma push(case_insensitive)
#pragma case_insensitive = true

' The decoder. In: HL the data, DE the destination, A 0 forwards / 1 backwards, C 1 for RCS.
SUB FASTCALL __kbZx0()
    ASM
        ld (__kbz_dir),a
        ld a,c
        ld (__kbz_rcs),a
        ld a,$80
        ld (__kbz_bits),a
        ld bc,1
        ld (__kbz_off),bc
__kbz_lits:
        call __kbz_gamma
__kbz_litloop:
        push bc
        call __kbz_byte
        ld c,a
        call __kbz_put
        pop bc
        dec bc
        ld a,b
        or c
        jr nz,__kbz_litloop
        call __kbz_bit
        jr c,__kbz_new
        call __kbz_gamma            ; a copy from the last offset
        call __kbz_match
        call __kbz_bit
        jr nc,__kbz_lits
__kbz_new:
        call __kbz_gammamsb         ; the offset's high part; 256 ends the data
        dec b
        ret z
        inc b
        push de
        ld d,c
        ld e,0
        srl d
        rr e                        ; DE = high part * 128
        call __kbz_byte
        srl a                       ; A = low 7 bits; carry: the length's first bit
        push af
        ld c,a
        ld b,0
        ex de,hl
        ld a,(__kbz_dir)
        or a
        jr nz,1f
        sbc hl,bc                   ; forwards: high * 128 - low
        jr 2f
1:      add hl,bc                   ; backwards: high * 128 + low - 127
        ld bc,127
        sbc hl,bc
2:      ld (__kbz_off),hl
        ex de,hl
        pop af
        pop de
        call __kbz_gammacarry
        inc bc
        call __kbz_match
        call __kbz_bit
        jr c,__kbz_new
        jr __kbz_lits

; BC bytes from the offset behind (or ahead of, backwards) the destination
__kbz_match:
        push bc
        push hl
        ld bc,(__kbz_off)
        ld h,d
        ld l,e
        ld a,(__kbz_dir)
        or a
        jr nz,1f
        sbc hl,bc
        jr 2f
1:      add hl,bc
2:      call __kbz_map
        ld c,(hl)
        pop hl
        call __kbz_put
        pop bc
        dec bc
        ld a,b
        or c
        jr nz,__kbz_match
        ret

; Interlaced Elias gamma codes into BC: plain, with the value bits inverted (the forwards offset's
; high part), or with the first flag bit already in the carry. Backwards data flips the flag bits.
__kbz_gamma:
        ld bc,1
__kbz_gloop:
        call __kbz_flag
        ret c
__kbz_gdata:
        call __kbz_bit
        rl c
        rl b
        jr __kbz_gloop
__kbz_gammacarry:
        call __kbz_flip
        ld bc,1
        ret c
        jr __kbz_gdata
__kbz_gammamsb:
        ld a,(__kbz_dir)
        or a
        jr nz,__kbz_gamma
        ld bc,1
1:      call __kbz_bit
        ret c
        call __kbz_bit
        ccf
        rl c
        rl b
        jr 1b

; A gamma code's flag bit into the carry: 1 ends the code forwards, 0 backwards
__kbz_flag:
        call __kbz_bit
__kbz_flip:
        ld a,0
        rla
        push hl
        ld hl,__kbz_dir
        xor (hl)
        pop hl
        rra
        ret

; The next bit into the carry; a new byte of bits when the last one is used up
__kbz_bit:
        ld a,(__kbz_bits)
        add a,a
        jr nz,1f
        call __kbz_byte
        rla
1:      ld (__kbz_bits),a
        ret

; The next data byte into A (flags kept)
__kbz_byte:
        ld a,(hl)
        push af
        ld a,(__kbz_dir)
        or a
        jr nz,1f
        inc hl
        pop af
        ret
1:      dec hl
        pop af
        ret

; C written at DE (through the RCS map), DE moved on
__kbz_put:
        push hl
        ld h,d
        ld l,e
        call __kbz_map
        ld (hl),c
        pop hl
        ld a,(__kbz_dir)
        or a
        jr nz,1f
        inc de
        ret
1:      dec de
        ret

; HL: where the byte of the stream's screen position HL lands. RCS keeps each third's bytes
; column by column: position s:c:r:l (third, column, character row, pixel line) is the screen
; byte of third s, pixel line l, row r, column c.
__kbz_map:
        ld a,(__kbz_rcs)
        or a
        ret z
        ld a,h
        sub $40
        ret c
        cp $18
        ret nc
        push de
        ld d,a                      ; D: 0 0 0 s1 s0 c4 c3 c2
        ld a,l
        and 7
        ld e,a
        ld a,d
        and $18
        or e
        or $40
        ld e,a                      ; E: the new high byte, $40 + s * 8 + l
        ld a,d
        and 7
        add a,a
        add a,a
        ld d,a                      ; c4 c3 c2 into bits 4-2
        ld a,l
        rlca
        rlca
        and 3
        or d
        ld d,a                      ; c1 c0 into bits 1-0
        ld a,l
        and $38
        add a,a
        add a,a
        or d                        ; r into bits 7-5
        ld l,a
        ld h,e
        pop de
        ret

__kbz_dir:  db 0
__kbz_rcs:  db 0
__kbz_bits: db 0
__kbz_off:  dw 0
    END ASM
END SUB

' The register decoders, one per name (the RCS names use the decoder above). In: HL the data (its
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
        xor a
        ld c,1
        jp ___kbZx0
    END ASM
END SUB

SUB FASTCALL dzx0SmartRCSBack(BYVAL src AS UInteger, BYVAL dst AS UInteger)
    ASM
        pop bc
        pop de
        push bc
        ld a,1
        ld c,a
        jp ___kbZx0
    END ASM
END SUB

SUB FASTCALL dzx0AgileRCS(BYVAL src AS UInteger, BYVAL dst AS UInteger)
    ASM
        pop bc
        pop de
        push bc
        xor a
        ld c,1
        jp ___kbZx0
    END ASM
END SUB

#pragma pop(case_insensitive)
