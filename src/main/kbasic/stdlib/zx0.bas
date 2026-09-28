' Klive BASIC standard library - zx0.bas: the ZX0 decompressors.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json) and the published
' ZX0 and RCS formats by Einar Saukas (https://github.com/einar-saukas/ZX0), whose author asks that
' programs using ZX0 mention it in their documentation. Data in ZX0's current format (version 2).
'
' Every name decodes the same stream: the speed variants of the original decompressors are one
' decoder here. "Back" names read the data from its last byte down (src and dst are the last
' addresses); "RCS" names write bytes that land in the screen bitmap to their RCS places.
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

SUB FASTCALL dzx0Standard(BYVAL src AS UInteger, BYVAL dst AS UInteger)
    ASM
        pop bc
        pop de
        push bc
        xor a
        ld c,a
        jp ___kbZx0
    END ASM
END SUB

SUB FASTCALL dzx0StandardBack(BYVAL src AS UInteger, BYVAL dst AS UInteger)
    ASM
        pop bc
        pop de
        push bc
        ld a,1
        ld c,0
        jp ___kbZx0
    END ASM
END SUB

SUB FASTCALL dzx0Turbo(BYVAL src AS UInteger, BYVAL dst AS UInteger)
    ASM
        pop bc
        pop de
        push bc
        xor a
        ld c,a
        jp ___kbZx0
    END ASM
END SUB

SUB FASTCALL dzx0TurboBack(BYVAL src AS UInteger, BYVAL dst AS UInteger)
    ASM
        pop bc
        pop de
        push bc
        ld a,1
        ld c,0
        jp ___kbZx0
    END ASM
END SUB

SUB FASTCALL dzx0Mega(BYVAL src AS UInteger, BYVAL dst AS UInteger)
    ASM
        pop bc
        pop de
        push bc
        xor a
        ld c,a
        jp ___kbZx0
    END ASM
END SUB

SUB FASTCALL dzx0MegaBack(BYVAL src AS UInteger, BYVAL dst AS UInteger)
    ASM
        pop bc
        pop de
        push bc
        ld a,1
        ld c,0
        jp ___kbZx0
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
