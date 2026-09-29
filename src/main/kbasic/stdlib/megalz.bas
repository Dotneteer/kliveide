' Klive BASIC standard library - megalz.bas: megaLZDepack.
' Klive's own code, written from the documented API (.ai/kbasic/stdlib-api.json) and the MegaLZ
' format as lvd's mhmt packer describes it (https://github.com/lvd2/mhmt).
'
' The format: the first byte as is, then codes read a bit at a time from bit bytes met in the data
' (the highest bit first, a new bit byte only when a bit is wanted): `1` and a byte is that byte;
' `000` and 3 bits copies one byte from 1-8 back; `001` and a byte copies two from 1-256 back; `010`
' copies three and `011` more (a length code) from a far offset: `0` and a byte (1-256 back) or `1`,
' 4 bits and a byte (257-4352 back). A length code of nine bits ends the data.
#pragma once
#pragma push(case_insensitive)
#pragma case_insensitive = true

' Unpacks the MegaLZ data at `source` to `dest`.
SUB FASTCALL megaLZDepack(BYVAL source AS UInteger, BYVAL dest AS UInteger)
    ASM
        pop bc
        pop de
        push bc
        ldi                         ; the first byte
        ld a,(hl)
        inc hl
        ld (__kbm_bits),a
        ld a,8
        ld (__kbm_left),a
__kbm_loop:
        call __kbm_bit
        jr nc,__kbm_code
        ldi                         ; a literal byte
        jr __kbm_loop
__kbm_code:
        ld b,2
        call __kbm_take
        ld a,c
        or a
        jr z,__kbm_one
        dec a
        jr z,__kbm_two
        dec a
        jr z,__kbm_three
        ld b,0                      ; `011`: the length code's size, up to its closing 1
1:      inc b
        call __kbm_bit
        jr nc,1b
        ld a,b
        cp 9
        ret z
        ld c,1                      ; the length: (1 << n) + n bits, and 2
2:      call __kbm_bit
        rl c
        djnz 2b
        ld a,c
        add a,2
        ld c,a
        push bc
        jr __kbm_far
__kbm_three:
        ld bc,3
        push bc
__kbm_far:
        call __kbm_bit
        jr c,__kbm_far2
        ld c,(hl)
        inc hl
        ld b,$ff
        jr __kbm_copy
__kbm_far2:
        ld b,4
        call __kbm_take
        ld a,c
        or $f0
        dec a
        ld b,a
        ld c,(hl)
        inc hl
        jr __kbm_copy
__kbm_one:
        ld bc,1
        push bc
        ld b,3
        call __kbm_take
        ld a,c
        or $f8
        ld c,a
        ld b,$ff
        jr __kbm_copy
__kbm_two:
        ld bc,2
        push bc
        ld c,(hl)
        inc hl
        ld b,$ff
; BC: the (negative) distance; on the stack: the length
__kbm_copy:
        ld (__kbm_src),hl
        ld h,d
        ld l,e
        add hl,bc
        pop bc
        ldir
        ld hl,(__kbm_src)
        jr __kbm_loop

; The next bit into the carry
__kbm_bit:
        ld a,(__kbm_left)
        or a
        jr nz,1f
        ld a,(hl)
        inc hl
        ld (__kbm_bits),a
        ld a,8
1:      dec a
        ld (__kbm_left),a
        ld a,(__kbm_bits)
        add a,a
        ld (__kbm_bits),a
        ret

; B bits into C
__kbm_take:
        ld c,0
1:      call __kbm_bit
        rl c
        djnz 1b
        ret

__kbm_bits: db 0
__kbm_left: db 0
__kbm_src:  dw 0
    END ASM
END SUB

#pragma pop(case_insensitive)
