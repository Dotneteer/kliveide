
; Copyright 2021 Mark Woodmass

; This program is licensed under the GNU General Public License. See the
; file `COPYING' for details

                        IF NOT DEFINED PRINT_
                        PRINT_  equ 1

print_hex_16            proc
                        ld    a,h
                        call  print_hex_8
                        ld    a,l
                        call  print_hex_8
                        ret
                        endp

print_hex_8             proc
                        push  af
                        rra
                        rra
                        rra
                        rra
                        call  print_hex_char
                        pop   af
                        call  print_hex_char
                        ret
                        endp

print_hex_char          proc
                        and   15
                        cp    10
                        sbc   a,#69
                        daa
                        rst   16
                        ret
                        endp

print_text_pc           proc
                        pop   de
                        call  print_text
                        push  de
                        ret
                        endp

print_text              proc
      _loop             ld    a,(de)
                        inc   de
                        cp    255
                        ret   z
                        rst   16
                        jr    _loop
                        endp

; HL = value, DE = text ptr
word_to_string          proc
                        ld    bc,-10000
                        call  _getdigit
                        ld    bc,-1000
                        call  _getdigit
                        ld    bc,-100
                        call  _getdigit
                        ld    bc,-10
                        call  _getdigit
                        ld    a,"0"
                        add   a,l
                        ld    (de),a
                        ret

      _getdigit         ld    a,"0"-1
      _getdig1          inc   a
                        add   hl,bc
                        jr    c,_getdig1
                        sbc   hl,bc
                        ld    (de),a
                        inc   de
                        ret
                        endp

                        ENDIF
