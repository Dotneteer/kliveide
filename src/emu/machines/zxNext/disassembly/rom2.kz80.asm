L0000       nop
            jr L0000
            nop
            nop
            nop
            nop
            nop
            jp L3F18
            ld l,$62
            ld h,c
            ld l,e
            rst $38
            nop
            nop
L0012       nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            push af
            push bc
            push hl
            ld bc,$243B
            in l,(c)
            push hl
            push bc
            xor a
            ld hl,$0045
            call L3F31
            pop bc
            pop hl
            out (c),l
            pop hl
            pop bc
            pop af
            ei
            ret
L0052       ld a,$3A
            and a
            ret
            jp L1152
            jp L14BE
            jp L1565
            jp L155B
            jp L156A
            nop
            retn
            rst $08
            ld bc,$04DD
            ret
            rst $08
            ld bc,$001D
            ret
            rst $08
            ld bc,$02E0
            ret
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
L007F       nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            jp L1A70
L00A3       jp L19AE
            jp L1ADF
L00A9       jp L01DB
L00AC       jp L184A
            jp L1879
            jp L0052
L00B5       jp L01E6
            jp L0052
            jp L0052
            jp L0052
            jp L0052
L00C4       jp L01EB
            jp L0052
            jp L0052
            jp L0740
            jp L07CF
            jp L0052
            jp L0052
            jp L16AC
L00DC       jp L1776
            jp L168B
            jp L1614
            jp L16A8
            jp L15BD
            jp L15C9
            jp L179B
L00F1       jp L03CF
L00F4       jp L0451
L00F7       jp L0478
            jp L0052
            jp L082E
            jp L252A
            jp L252C
L0106       jp L0322
L0109       jp L0258
L010C       jp L0269
            jp L0226
L0112       jp L027A
            jp L02D6
            jp L022C
            jp L0232
L011E       jp L0200
            jp L01F0
            jp L2812
            jp L2823
            jp L253C
L012D       jp L0550
L0130       jp L055E
            jp L0238
            jp L023E
L0139       jp L0246
L013C       jp L05E0
L013F       jp L05E5
            jp L01F8
            jp L024C
            jp L0214
            jp L0052
            jp L259F
            jp L20E4
            jp L2599
            jp L259D
            jp L259D
            jp L259D
            jp L259D
            jp L2789
            jp L2599
            jp L2599
            jp L2599
            jp L2599
            jp L2599
            jp L2599
            jp L2599
            jp L2750
            jp L2778
            jp L2599
            jp L2619
            jp L2628
            jp L266A
            jp L259D
            jp L279E
            jp L2599
            jp L259D
            jp L259D
            jp L259D
            jp L0052
            jp L0052
            jp L1F8A
            jp L0052
            jp L0052
            jp L0052
L01B1       jp L0527
            jp L01E0
            jp L020B
            jp L10C6
            jp L0E9F
            jp L0F9D
            jp L159E
            jp L15A8
            jp L0FB8
            jp L0FEF
L01CF       jp L0FF7
            jp L1A75
            jp L0FFD
            jp L1080
L01DB       rst $08
            nop
            inc bc
            ld bc,$79C9
            rst $08
            nop
            ld b,$01
            ret
L01E6       rst $08
            nop
            add hl,bc
            ld bc,$CFC9
            nop
            inc c
            ld bc,$CDC9
            or h
            dec b
            rst $08
            nop
            jr L01F8
            ret
L01F8       call L05B4
            rst $08
            nop
            dec de
            ld bc,$DDC9
            ld l,a
            rst $08
            nop
            ld c,a
            inc bc
            rst $08
L0207       nop
            ld a,e
            ld bc,$CFC9
            nop
            ld c,a
            inc bc
            rst $08
            nop
            ld a,(hl)
            ld bc,$CFC9
            nop
            ld c,a
            inc bc
            rst $08
            nop
            adc a,d
            ld bc,$CFC9
            nop
            ld c,a
            inc bc
            rst $08
            nop
            add a,h
            ld bc,$78C9
            rst $08
            nop
            ccf
            ld bc,$78C9
            rst $08
            nop
            ld c,b
            ld bc,$78C9
            rst $08
            nop
            ld c,e
            ld bc,$78C9
            rst $08
            nop
            ld c,(hl)
            ld bc,$78C9
            ld d,$00
            rst $08
            nop
            ld d,c
            ld bc,$78C9
            rst $08
            nop
            ld d,h
            ld bc,$79C9
            and $F8
            ld a,$1E
            ret nz
            ld a,b
            rst $08
            nop
            ld d,a
            ld bc,$78C9
            ld ($F505),sp
            ld sp,$F505
            rst $08
            nop
            ld (hl),l
            ld bc,$7BED
            dec b
            push af
            ret
L0269       ld a,b
            ld ($F505),sp
            ld sp,$F505
            rst $08
            nop
            ld a,b
            ld bc,$7BED
            dec b
            push af
            ret
L027A       ld a,h
            and $C0
            jr nz,L0292
            push bc
            push de
            push hl
            call L022C
            pop hl
            pop de
            pop bc
            jr nc,L02D1
            inc hl
            dec de
            ld a,d
            or e
            jr nz,L027A
            scf
            ret
L0292       push hl
            dec de
            add hl,de
            inc de
            jr c,L02A9
            inc hl
            ex (sp),hl
            call L02A3
L029D       pop hl
            jr nc,L02D1
            xor a
            scf
            ret
L02A3       ld a,b
            rst $08
            nop
            ld b,d
            ld bc,$E1C9
            push de
            push hl
            ex de,hl
            ld hl,$0000
            and a
            sbc hl,de
            ex de,hl
            pop hl
            ex (sp),hl
            and a
            sbc hl,de
            ex (sp),hl
            push hl
            push de
            push bc
            call L02A3
            pop bc
            pop hl
            jr nc,L02C9
            pop de
            add hl,de
            pop de
            jr L027A
L02C9       sbc hl,de
            pop bc
            add hl,bc
            pop bc
            ex de,hl
            add hl,bc
            ex de,hl
L02D1       ld b,a
            ld a,d
            or e
            ld a,b
            ret
L02D6       ld a,h
            and $C0
            jr nz,L02EF
            push bc
            push de
            push hl
            ld c,(hl)
            call L0232
            pop hl
            pop de
            pop bc
            jr nc,L02D1
            inc hl
            dec de
            ld a,d
            or e
            jr nz,L02D6
            scf
            ret
L02EF       push hl
            dec de
            add hl,de
            inc de
            jr c,L0302
            inc hl
            ex (sp),hl
            call L02FC
            jr L029D
L02FC       ld a,b
            rst $08
            nop
            ld b,l
            ld bc,$E1C9
            push de
            push hl
            ex de,hl
            ld hl,$0000
            and a
            sbc hl,de
            ex de,hl
            pop hl
            ex (sp),hl
            and a
            sbc hl,de
            ex (sp),hl
            push hl
            push de
            push bc
            call L02FC
            pop bc
            pop hl
            jr nc,L02C9
            pop de
            add hl,de
            pop de
            jr L02D6
L0322       call L03AC
            ret nc
            ld a,e
            sub $03
            jr nz,L0384
            push hl
            ld hl,$314A
            rst $08
            rlca
            dec e
            nop
            pop hl
            inc e
            rra
            jr c,L0384
            push bc
            push de
            push hl
            ld e,$00
            call L0384
            pop hl
            pop de
            pop bc
            ret c
            cp $18
            scf
            ccf
            ret nz
            push bc
            push de
            push hl
            ld b,$00
            ld de,$FF00
            push de
L0352       ld a,(hl)
            inc hl
            ld (de),a
            inc de
            cp $2E
            jr nz,L035C
            ld b,d
            ld c,e
L035C       inc a
            jr nz,L0352
            ld h,d
            ld l,e
            scf
            sbc hl,bc
            ld a,l
            and $FC
            or h
            jr nz,L036C
            ld d,b
            ld e,c
L036C       dec de
            ld hl,$000B
            ld bc,$0005
            ldir
            pop hl
            push hl
            call L021D
            pop de
            pop hl
            push hl
            call L0598
            pop hl
            pop de
            pop bc
            ret nc
L0384       ld a,c
            and $F8
            ld a,$1E
            ret nz
            push de
            ld d,b
            ld e,$38
            mul d,e
            add de,$DBD0
            push de
            pop ix
            pop de
            rst $08
            nop
            ld c,a
            inc bc
            ld ($F505),sp
            ld sp,$F505
            rst $08
            nop
            ld (hl),d
            ld bc,$7BED
            dec b
            push af
            ret
L03AC       bit 3,c
            scf
            ret z
            res 3,c
            push bc
            call L2867
            jr nc,L03BF
            pop bc
            push bc
            bit 1,c
            call nz,L28DD
L03BF       pop bc
            ld de,$0202
            ret
L03C4       ld hl,$2310
            add hl,a
            rst $08
            nop
            dec e
            nop
            add a,a
            ret
L03CF       ld d,a
            ld a,l
            call L05B4
            ld e,a
            call L03C4
            ld a,$3E
            ret nc
            ld a,d
            cp $FF
            jr z,L03E6
            ld a,e
            rst $08
            nop
            ld l,c
            ld bc,$D5C9
            push hl
            push bc
            ld h,b
            ld l,c
            ld a,e
            add a,$30
            ld d,a
            ld e,$00
            ld bc,$0100
            ld a,$09
            rst $08
            nop
            inc bc
            rlca
            pop bc
            call L2224
            pop hl
            pop de
            ret nc
            push hl
            ld hl,$2302
            ld bc,$0EFF
L0408       rst $08
            nop
            dec e
            nop
            inc hl
            and a
            jp m,L0434
            cp c
            jr z,L0434
            ld c,a
            ld a,$10
            sub b
            or $80
            ex (sp),hl
            push bc
            push de
            push hl
            push ix
            ld d,a
            ld bc,$F75F
            rst $08
            nop
            ld l,c
            ld bc,$E1DD
            pop hl
            pop de
            pop bc
            ex (sp),hl
            jr c,L043E
            cp $09
            jr nz,L043B
L0434       djnz L0408
            call L04F4
            ld a,$09
L043B       and a
            pop hl
            ret
L043E       pop hl
            ld c,(ix+$11)
            ld b,(ix+$12)
            ld a,e
            add a,a
            ld hl,$E438
            add hl,a
            ld (hl),c
            inc hl
            ld (hl),b
            scf
            ret
L0451       ld a,l
            call L05B4
            push af
            rst $08
            nop
            ld l,h
            ld bc,$38D1
            ld b,$FE
            ld d,$37
            ret z
            ccf
            ret
            ld a,d
            add a,a
            ld hl,$E438
            add hl,a
            ld e,(hl)
            inc hl
            ld d,(hl)
            ld a,d
            or e
            scf
            ret z
            xor a
            ld (hl),a
            dec hl
            ld (hl),a
            jp L04FA
L0478       ld a,l
            push af
            push bc
            and $7F
            call L05B4
            ld bc,$F700
            push af
            ld a,$FF
            ld (bc),a
            pop af
            rst $08
            nop
            ld e,$01
            jr nc,L04BA
            inc a
            jr nz,L04B9
            pop de
            pop af
            push af
            push de
            ld hl,$1FFD
            ld de,$F700
            ld bc,$0006
            ldir
            and $7F
            call L05B4
            add a,$30
            ld h,a
            ld l,$00
            ld c,$F9
            ld a,$09
            rst $08
            nop
            ld l,c
            rlca
            ld a,$FF
            ld (de),a
            xor a
            ld b,a
            ld c,a
            scf
L04B9       dec a
L04BA       pop de
            pop hl
            push af
            push bc
            jr nc,L04E8
            ld b,$FF
            bit 7,h
            push af
            ld hl,$F700
            jr nz,L04CC
            ld b,$12
L04CC       ld a,(hl)
            inc hl
            cp $FF
            jr z,L04D6
            ld (de),a
            inc de
            djnz L04CC
L04D6       pop af
            jr z,L04DE
            ld a,$FF
            ld (de),a
            jr L04E8
L04DE       inc b
            dec b
            jr z,L04E8
            ld a,$20
L04E4       ld (de),a
            inc de
            djnz L04E4
L04E8       pop bc
            pop af
            ld l,$00
            inc l
            ret c
            cp $16
            scf
            ret z
            ccf
            ret
L04F4       ld e,(ix+$11)
            ld d,(ix+$12)
L04FA       ld h,d
            ld l,e
            inc de
            ld bc,$0005
            rst $08
            nop
            in a,($04)
            scf
            ret
            rst $08
            nop
            ld c,a
            inc bc
L050A       push af
            push hl
            and $0F
            call L0555
            pop hl
            pop de
            ret nc
            ld a,d
            push af
            push hl
            swapnib
            and $0F
            call L0130
            pop hl
            pop de
            ret nc
            ld a,d
            ld b,$00
            push hl
            jr L052F
L0527       ld b,a
            push hl
            push bc
            rst $08
            nop
            ld c,a
            inc bc
            pop bc
L052F       ld de,$FF00
            push hl
            push bc
            ld ($F505),sp
            ld sp,$F505
            rst $08
            nop
            add a,c
            ld bc,$7BED
            dec b
            push af
            pop bc
            pop hl
            pop de
            ret nc
            dec b
            ret nz
L0549       ld a,(hl)
            ldi
            inc a
            jr nz,L0549
            ret
L0550       cp $FF
            call nz,L05B4
L0555       rst $08
            nop
            ld l,a
            ld bc,$C6D0
            ld b,c
            scf
            ret
L055E       push af
            ld a,$FF
            rst $08
            nop
            ld l,a
            ld bc,$5FD1
            call L03C4
            jp m,L0577
            xor a
            inc d
            scf
            ret z
            dec d
            ret z
            ld a,$14
            and a
            ret
L0577       push de
            ld a,e
            rst $08
            nop
            inc h
            ld bc,$D0D1
            inc d
            ret z
            ld a,e
            add a,$20
            ld h,a
            ld l,$01
            dec d
            ld a,d
            swapnib
            or e
            rst $08
            add hl,bc
            ret po
            ld (bc),a
            cpl
            dec hl
            rst $08
            add hl,bc
            ret po
            ld (bc),a
            scf
            ret
L0598       rst $08
            nop
            ld c,a
            inc bc
            push af
            ex de,hl
            rst $08
            nop
            ld c,a
            inc bc
            ex de,hl
            pop bc
            ld ($F505),sp
            ld sp,$F505
            rst $08
            nop
            add a,a
            ld bc,$7BED
            dec b
            push af
            ret
L05B4       and $DF
            sub $41
            jr c,L05BD
            cp $10
            ret c
L05BD       pop af
            ld a,$16
            and a
            ret
            rst $08
            dec c
            dec e
            nop
            ret
            rst $08
            nop
            ret po
            ld (bc),a
            ret
            push hl
            ld hl,$2006
            rst $08
            nop
            dec e
            nop
            and $0F
            pop hl
            ld ($5B52),hl
            ld hl,$04DD
            jp L3F2A
L05E0       rst $08
            dec c
            or (hl)
            inc (hl)
            ret
L05E5       rst $08
            dec c
            cp h
            inc (hl)
            ret
L05EA       rst $08
            dec c
            ld c,l
            inc (hl)
            ret
L05EF       rst $08
            dec c
            call p,LC934
L05F4       ld b,$02
            rst $08
            nop
            or d
            inc bc
            ret
            rst $08
            dec c
            ld ($C934),a
            rst $08
            dec c
            ld b,b
            inc (hl)
            ret
L0605       ld ix,$E46C
            ld e,$14
L060B       ld a,(ix)
            and a
            scf
            ret z
            push bc
            ld bc,$0013
            add ix,bc
            pop bc
            dec e
            jr nz,L060B
            ld a,$3C
            and a
            ret
L061F       sub $05
            push ix
            push de
            push hl
            ld d,a
            ld ix,$E46C
            ld e,$14
L062C       ld a,(ix)
            and a
            jr z,L0646
            ld a,(ix+$10)
            and $01
            cp d
            jr nz,L0646
            ld l,(ix+$11)
            ld h,(ix+$12)
            sbc hl,bc
            ld a,$3B
            jr z,L0651
L0646       push bc
            ld bc,$0013
            add ix,bc
            pop bc
            dec e
            jr nz,L062C
            scf
L0651       pop hl
            pop de
            pop ix
            ret
L0656       sub $05
            ccf
            jr nc,L066C
            cp $02
            jr nc,L066C
            srl a
            ld ix,$E458
            jr nc,L066B
            ld ix,$E462
L066B       and a
L066C       ld a,$16
            ret nz
            ld a,(ix)
            or (ix+$01)
            ld a,$16
            ret z
            scf
            ret
            ld a,c
            sub $05
            ld c,a
            ld ix,$3135
            jp nc,L17DE
            cp $FF
            ld a,$16
            ccf
            ret nc
            rst $08
            dec c
            dec a
            dec (hl)
            ld h,$00
            ld d,h
            ld e,h
            ld ix,$313B
            scf
            ret
L0699       call L0656
            ret nc
            ld l,(ix+$06)
            ld h,(ix+$07)
            and a
            sbc hl,bc
            ld a,$38
            ccf
            ret nc
            ld l,(ix+$08)
            ld h,(ix+$09)
            push hl
            pop ix
            push bc
            srl b
            rr c
            srl b
            rr c
            srl b
            rr c
            ld d,b
            ld e,c
            pop bc
            ld a,c
            and $07
            ld c,$00
            rra
            rr c
            rra
            rr c
            ld b,a
            scf
            ret
L06D1       push bc
            push ix
            push hl
            call L0699
            jr nc,L06F4
            push bc
            ld bc,$0700
            ld hl,$E090
            call L184A
            pop bc
            jr nc,L06F4
            ld hl,$E090
            add hl,bc
            pop de
            ld bc,$0040
            ldir
            scf
            jr L06F5
L06F4       pop hl
L06F5       pop ix
            pop bc
            ret
            push ix
            ld bc,$0000
L06FE       push af
            push bc
            push hl
            ld hl,$F712
            call L06D1
            jr nc,L072E
            pop hl
            push hl
            ld de,$F712
            ld b,$10
L0710       ld a,(de)
            cp (hl)
            jr z,L0729
            cp $41
            jr c,L071C
            cp $5B
            jr c,L0724
L071C       cp $61
            jr c,L0734
            cp $7B
            jr nc,L0734
L0724       xor $20
            cp (hl)
            jr nz,L0734
L0729       inc de
            inc hl
            djnz L0710
            scf
L072E       pop hl
            pop bc
L0730       pop hl
            pop ix
            ret
L0734       pop hl
            pop bc
            inc bc
            ld a,b
            or c
            ld a,$38
            jr z,L0730
            pop af
            jr L06FE
L0740       push af
            call L061F
            jr nc,L074B
            call L0605
            jr c,L074D
L074B       pop hl
            ret
L074D       pop af
            push af
            ld hl,$F712
            call L00C4
            jr nc,L074B
            ld a,($F722)
            dec a
            cp $FD
            ld a,$38
            jr nc,L074B
            pop af
            call L07D5
L0765       di
            push ix
            pop de
            ld hl,$F722
            ld bc,$0010
            ldir
            push iy
            push ix
            ld c,(ix+$01)
            ld b,(ix+$02)
            ld d,(ix+$03)
            call L00A9
            ld e,(ix+$03)
            push de
            ld e,(ix+$04)
            ld d,(ix+$05)
            push de
            pop ix
            ld iy,$0000
            ld hl,$0000
            ld d,h
            ld e,l
L0797       add iy,bc
            adc hl,de
            dec ix
            ld a,xh
            or xl
            jr nz,L0797
            pop bc
            ld a,b
            ld b,$00
            and a
            jr z,L07B1
L07AA       add iy,bc
            adc hl,de
            dec a
            jr nz,L07AA
L07B1       pop ix
            ld a,yl
            ld (ix+$01),a
            ld a,yh
            ld (ix+$02),a
            ld (ix+$03),l
            ld (ix+$04),h
            xor a
            ld (ix+$05),a
            ld (ix+$06),a
            pop iy
            ei
            scf
            ret
L07CF       ld (ix),$00
            scf
            ret
L07D5       push af
            sub $05
            ld (ix+$10),a
            ld (ix+$11),c
            ld (ix+$12),b
            and a
            call L1A69
            jr nc,L07EB
            set 1,(ix+$10)
L07EB       pop af
            ret
L07ED       ex de,hl
            xor a
            ex af,af'
            push af
            xor a
            ld d,a
            ld e,a
L07F4       srl b
            jr nc,L07FF
            ld c,a
            ex af,af'
            ex de,hl
            add hl,de
            ex de,hl
            adc a,c
            ex af,af'
L07FF       jr z,L0806
            add hl,hl
            adc a,a
            jp L07F4
L0806       pop af
            ex af,af'
            ret
L0809       push af
            call L0E09
            or $08
            out (c),a
            ld a,($5C93)
            nextreg $07,a
            pop af
            ret
            nop
            jr nc,L081C
L081C       inc bc
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            rst $38
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
L082E       ld d,h
            ld e,l
L0830       ld a,(de)
            inc de
            cp $FF
            jr nz,L0830
            dec de
            dec de
            dec de
            ld a,(de)
            cp $2E
            inc de
            ld a,(de)
            jr nz,L084C
            and $DF
            cp $4F
L0844       jp z,L0CA6
            cp $50
            scf
            jr z,L0844
L084C       ld a,(de)
            and $DF
            ld ($5C92),a
            call L0E09
            and $E7
            out (c),a
            ld a,$07
            call L0E0B
            and $03
            ld ($5C93),a
            cp $04
            jr nc,L086B
            ld a,$03
            out (c),a
L086B       ld bc,$0001
            ld d,b
            ld e,$02
            call L0106
            jr nc,L0809
            ld hl,$0000
            ld d,h
            ld e,l
            call L013F
            ld b,$00
            call L0139
            ld a,e
            or d
            ld ($5D00),a
            call L3F00
            cp c
            inc d
            di
            ld sp,$5BFF
            ld hl,$5800
            ld de,$5801
            ld bc,$02FF
            ld (hl),l
            ldir
            xor a
            out ($FE),a
            ld hl,$0819
            ld de,$5D45
            ld bc,$0015
            ldir
            ld a,$04
            ld ($5D79),a
            ld a,($5C92)
            bit 6,a
            jr z,L0913
            ld hl,$5D08
            ld a,$1B
            call L0AD2
            ld sp,$5D07
            pop af
            ld ($5D2D),a
            pop hl
            ld ($5D36),hl
            pop hl
            ld ($5D34),hl
            pop hl
            ld ($5D32),hl
            pop hl
            ld ($5D38),hl
            pop hl
            ld ($5D27),hl
            pop hl
            ld ($5D30),hl
            pop hl
            ld ($5D25),hl
            pop hl
            ld ($5D3A),hl
            pop hl
            ld ($5D3C),hl
            pop hl
            ld a,l
            rrca
            rrca
            and $01
            ld ($5D3E),a
            ld a,h
            ld ($5D2E),a
            pop hl
            ld ($5D23),hl
            pop hl
            ld ($5D2B),hl
            pop hl
            ld a,l
            ld ($5D40),a
            ld a,h
            add a,a
            ld ($5D2F),a
            ld sp,$5BFF
            ld hl,$2313
            ld b,$00
            jr L093A
L0913       ld hl,$5D23
            ld a,$1E
            call L0AD2
            ld hl,$5D2F
            ld a,(hl)
            cp $FF
            jr nz,L0926
            ld a,$01
            ld (hl),a
L0926       set 0,(hl)
            ld hl,$5D2E
            rl (hl)
            rrca
            rr (hl)
            and $10
            ld b,a
            ld hl,($5D29)
            ld a,h
            or l
            jr z,L09A1
L093A       ld a,b
            ld ($5D05),a
            ld ($5D43),hl
            call L0AF0
            ld a,($5C92)
            cp $58
            call z,L0B86
            ld a,$05
            call L0B71
            ld a,$02
            call L0B76
            xor a
            call L0B76
            ld a,($5D00)
            and a
            jr z,L099E
            ld a,$04
            ld ($5D45),a
            and a
            call L0B60
            ld ($5D43),bc
            ld a,e
            ld ($5D46),a
            nextreg $53,$00
            nextreg $54,$01
            ld hl,$6000
            and $07
            call L5D80
            xor a
L0982       cp $02
            jr z,L0997
            cp $05
            jr z,L0997
            ld d,a
            ld a,($5D46)
            and $07
            cp d
            ld a,d
            push af
            call nz,L0B71
            pop af
L0997       inc a
            cp $08
            jr c,L0982
            ld a,$08
L099E       jp L0A60
L09A1       ld hl,$5D41
            ld a,$02
            call L0AD2
            ld hl,($5D41)
            ld a,h
            and a
            jr nz,L0A23
            ld a,l
            cp $38
            jr nc,L0A30
            push af
            ld hl,$5D43
            call L0AD2
            call L0AF0
            ld a,$08
            call L0E0B
            and $FE
            ld hl,$5D40
            bit 2,(hl)
            jr z,L09CF
            or $01
L09CF       out (c),a
            pop af
            ld hl,$5D45
            cp $17
            jr nz,L09E3
            ld a,(hl)
            cp $03
            jr c,L09E3
            cp $05
            jr nc,L09E3
            inc (hl)
L09E3       ld a,($5D48)
            add a,a
            ld a,(hl)
            jr nc,L09FA
            cp $09
            jr nc,L09FA
            cp $04
            jr c,L09FA
            cp $07
            ld a,$0C
            jr c,L09F9
            inc a
L09F9       ld (hl),a
L09FA       cp $07
            jr nc,L0A03
            ld a,$04
            ld ($5D79),a
L0A03       ld a,(hl)
            cp $04
            jr nc,L0A35
            ld a,$30
            ld ($5D46),a
            ld d,$03
L0A0F       push de
            call L0B54
            cp $04
            ld e,$02
            jr z,L0A25
            cp $05
            ld e,$00
            jr z,L0A25
            cp $08
            ld e,$05
L0A23       jr nz,L0A30
L0A25       ld a,e
            call L0B71
            pop de
            dec d
            jr nz,L0A0F
            xor a
            jr L0A60
L0A30       ld a,$15
            jp L0AD9
L0A35       ld d,$08
L0A37       push de
            call L0B54
            sub $03
            jr c,L0A30
            cp $08
            jr nc,L0A30
            call L0B71
            pop de
            dec d
            jr nz,L0A37
            ld a,($5D45)
            ld b,$18
            cp $50
            jr z,L0A61
            ld b,$10
            cp $51
            jr z,L0A61
            cp $0C
            ld a,$08
            jr c,L0A60
            inc a
L0A60       ld b,a
L0A61       nextreg $56,$0E
            nextreg $57,$0F
            ld a,($5C92)
            cp $58
            ld de,$00FF
            jr z,L0AAA
            ld a,b
            xor $18
            push af
            call L0D70
            jr nc,L0AD9
            ld d,a
            push de
            ld b,$00
            call L0109
            pop de
            nextreg $B8,$00
            bit 5,d
            jr z,L0A93
            ld a,($5D48)
            bit 2,a
            jr z,L0A9C
L0A93       ld a,$84
            call L0E0B
            or $01
            out (c),a
L0A9C       pop af
            cp $09
            jr nc,L0AAA
            ld a,$0A
            call L0E0B
            and $EF
            out (c),a
L0AAA       call L0809
            ld a,$02
            call L0E0B
            and $80
            or $08
            out (c),a
            nop
L0AB9       ld b,$00
            push de
            nextreg $56,$0E
            nextreg $57,$0F
            call L0112
            pop hl
            ret c
            cp $19
            scf
            ccf
            ret nz
            sbc hl,de
            cp a
            ret
L0AD2       ld e,a
            ld d,$00
            call L0AB9
            ret c
L0AD9       push af
            call L3F00
            call LF137
            cp $0A
            ld d,$3E
            jr c,L0AE8
            ld d,$19
L0AE8       add a,d
            call L3F00
            dec de
            dec c
L0AEE       jr L0AEE
L0AF0       ld hl,$0C22
            ld de,$5D80
            ld bc,$0084
            ldir
            ld ($5D03),bc
            ld a,$12
            call L0E0B
            ld hl,$5D01
            ld (hl),a
            inc hl
            inc a
            ld (hl),a
            dec hl
            push hl
            ld a,(hl)
            call L0B14
            pop hl
            inc hl
            ld a,(hl)
L0B14       ld c,a
            ld hl,$C000
            ld de,$4000
            call L0AB9
            ret c
            ret z
            jr L0AD9
L0B22       ld hl,($5D03)
            bit 6,h
            jr z,L0B39
            res 6,h
            push hl
            ld hl,$5D01
            ld a,(hl)
            inc hl
            ld d,(hl)
            ld (hl),a
            dec hl
            ld (hl),d
            call L0B14
            pop hl
L0B39       ld de,$5D01
            ld a,(de)
            inc de
            add a,a
            nextreg $53,a
            inc a
            nextreg $54,a
            ld a,(de)
            add a,a
            nextreg $55,a
            inc a
            nextreg $56,a
            add hl,$6000
            ret
L0B54       scf
            call L0B60
            ld a,b
            and c
            inc a
            ld ($5D05),a
            ld a,e
            ret
L0B60       push af
            call L0B22
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ld e,(hl)
            inc hl
            pop af
            jr c,L0B7E
            ld d,(hl)
            inc hl
            jr L0B7E
L0B71       ld h,$00
            ld ($5D06),hl
L0B76       push af
            call L0B22
            pop af
            call L5D80
L0B7E       add hl,$A000
            ld ($5D03),hl
            ret
L0B86       ld a,($5D01)
            add a,a
            nextreg $53,a
            add a,$03
            nextreg $55,a
            ld a,($7C5C)
            cp $FB
            jr nz,L0BA3
            ld hl,($7C5D)
            ld de,$4DED
            sbc hl,de
            jr z,L0BBF
L0BA3       ld hl,$0BD4
L0BA6       ld a,(hl)
            and a
            ret z
            ld b,a
            inc hl
            ld e,(hl)
            inc hl
            ld d,(hl)
L0BAE       inc hl
            ld a,(de)
            inc de
            sub (hl)
            jr nz,L0BCB
            djnz L0BAE
            ld b,$02
L0BB8       inc hl
            ld e,(hl)
            inc hl
            ld d,(hl)
            ld (de),a
            djnz L0BB8
L0BBF       ld a,$05
            call L0E0B
            and $05
            or $42
            out (c),a
            ret
L0BCB       inc hl
            djnz L0BCB
            inc hl
            inc hl
            inc hl
            inc hl
            jr L0BA6
            inc c
            ld l,b
            ld a,h
            exx
            pop iy
            pop ix
            pop hl
            pop de
            pop bc
            pop af
            ei
            reti
            ld h,h
            ld a,h
            ld l,b
            ld a,h
            dec c
            ld h,h
            ld a,h
            exx
            exx
            pop iy
            pop ix
            pop hl
            pop de
            pop bc
            pop af
            ei
            reti
            ld h,h
            ld a,h
            ld h,l
            ld a,h
            inc c
            ld l,e
            ld a,h
            exx
            pop iy
            pop ix
            pop hl
            pop de
            pop bc
            pop af
            ei
            reti
            ld h,h
            ld a,h
            ld l,e
            ld a,h
            inc c
            cpl
L0C10       xor c
            exx
            pop iy
            pop ix
            pop de
            pop bc
            pop hl
            pop af
            ei
            reti
            dec hl
            xor c
            cpl
            xor c
            nop
            add a,a
            nextreg $57,a
            inc a
            push af
            cp $0B
            jr z,L0C80
            cp $0F
            jr z,L0C95
            ld de,$E000
            ld a,($5D05)
            and a
            jr nz,L0C4B
            call L5DA0
            pop af
            nextreg $57,a
            ld d,$E0
L0C42       ld bc,$2000
            ldir
L0C47       xor a
            out ($E3),a
            ret
L0C4B       call L5DB2
            pop af
            nextreg $57,a
            ld d,$E0
L0C54       ld bc,($5D06)
L0C58       inc b
            dec b
            jr nz,L0C7C
            ld a,(hl)
            inc hl
            cp $ED
            jr z,L0C71
L0C62       ld (de),a
            inc e
            jr nz,L0C58
            inc d
            bit 5,d
            jr nz,L0C58
            ld ($5D06),bc
            jr L0C47
L0C71       ld b,$01
            ld c,(hl)
            inc hl
            cp c
            jr nz,L0C62
            ld b,(hl)
            inc hl
            ld c,(hl)
            inc hl
L0C7C       ld a,c
            dec b
            jr L0C62
L0C80       ld a,$86
            out ($E3),a
            call L5DFF
            pop af
            nextreg $57,a
            ld d,$E0
L0C8D       ld a,($5D05)
            and a
            jr nz,L0C54
            jr L0C42
L0C95       pop af
            ld a,$84
            out ($E3),a
            call L5DFF
            ld a,$85
            out ($E3),a
            ld de,$2000
            jr L0C8D
L0CA6       push hl
            push af
            sub $4F
            add a,a
            add a,a
            add a,a
            call L0D70
            pop de
            pop bc
            ret nc
            ld hl,$8000
            ld sp,hl
            push de
            push bc
            call L0D50
            pop hl
            ld de,$8000
            pop af
            push af
            jr nc,L0CC6
            ld e,$09
L0CC6       ld a,$FF
            call L0E46
            jp nc,L0AD9
            ld h,$C0
            call L0D50
            ld hl,$0D07
            ld de,$F000
            ld bc,$0049
            ldir
            di
            ld a,$0A
            call L0E0B
            and $EF
            out (c),a
            ld bc,$7FFD
            ld a,$2F
            out (c),a
            xor a
            ex af,af'
            pop af
            ld iy,$4000
            im 1
            ld hl,$8000
            ld de,$4000
            ld b,d
            ld c,e
            ldir
            ex de,hl
            ld sp,hl
            jp LF000
            nextreg $8C,$A0
            ei
            jr c,L0D29
            ld a,$0E
            ld i,a
            ld hl,$3FAA
            push hl
            call L0747
            ld hl,$88FF
            ld ($4000),hl
            ld hl,$0447
            push hl
            ld bc,$0000
            jp L0934
L0D29       ld hl,$F040
            ld de,$4000
            ld bc,$0009
            ldir
            ld ix,$0281
            ld a,$1E
            ld i,a
            ld hl,$3E00
            push hl
            ld hl,$0676
            push hl
            jp L0207
            rst $38
            add a,b
            call m,L007F
            add a,b
            nop
            cp $FF
L0D50       ld l,$00
            ld d,h
            ld e,$01
            ld bc,$3FFF
            ld (hl),l
            ldir
            ret
            ld bc,$F650
            rst $08
            sub d
            ret
            ld e,a
            sub $A5
            jp nc,L0C10
            ld bc,$FB50
            rst $08
            sub d
            ret
            call LF50E
            call L1E14
            pop af
            push af
            call L0E37
            pop bc
            ret nc
            push bc
            bit 4,b
            jr z,L0DAC
            ld a,($5B68)
            bit 4,a
            jr nz,L0DAC
            ld hl,$0D5C
            ld de,$C000
            ld bc,$0014
            push de
            ldir
            pop hl
            ld de,$0EAC
            ld c,$06
            call L0E94
            ld de,$0ECD
            ld c,$0C
            call L0E94
            ld de,$15BE
            ld c,$02
            call L0E94
L0DAC       pop bc
            ld a,b
            cp $18
            ld a,$A0
            ld d,$01
            ld e,$C2
            jr nz,L0DBE
            ld a,$90
            dec d
            ld e,$C0
            ld b,e
L0DBE       nextreg $03,a
            ld a,b
            and $10
            xor $10
            add a,a
            or $80
            push af
            ld a,$83
            call L0E0B
            inc a
            jr nz,L0DE0
            nextreg $83,$3F
            ld a,d
            nextreg $84,a
            nextreg $85,$01
            jr L0DE9
L0DE0       ld a,$82
            call L0E0B
            and $25
            or e
            ld e,a
L0DE9       xor a
            nextreg $14,a
            nextreg $4A,a
            nextreg $D8,a
            call L0E09
            and $FC
            or $01
            out (c),a
            dec b
            ld a,$08
            call L0E0B
            and $BF
            out (c),a
            pop af
            scf
            ret
L0E09       ld a,$06
L0E0B       ld bc,$243B
            out (c),a
            inc b
            in a,(c)
            ret
L0E14       nextreg $82,$DA
            nextreg $83,$2B
            nextreg $84,$01
            nextreg $85,$00
            call L0E09
            and $FC
            or $01
            out (c),a
            ld a,$08
            call L0E0B
            and $BB
            out (c),a
            ret
L0E37       nextreg $8C,$C0
            ld de,$0000
            and $FE
            sub $10
            jr z,L0E46
            ld a,$04
L0E46       ld i,a
            push de
            ld bc,$0101
            ld de,$0002
            call L0106
            jr nc,L0E72
L0E54       ld hl,$C000
            ld de,$1000
            push hl
            push de
            ld bc,$0107
            call L0112
            pop bc
            pop hl
            pop de
            push af
            call L0E81
            pop af
            push de
            jr c,L0E54
            cp $19
            scf
            jr z,L0E73
L0E72       and a
L0E73       pop hl
            push af
            ld b,$01
            call L0109
            ld b,$01
            call nc,L010C
            pop af
            ret
L0E81       ld a,i
            inc a
            jr z,L0E91
            ld i,a
            res 6,d
            cp $09
            ret nc
            cp $05
            jr nc,L0E94
L0E91       ldir
            ret
L0E94       push $5B43
            push $001B
            jp L5B3E
L0E9F       ld bc,$243B
            ld a,$57
            out (c),a
            inc b
            in d,(c)
            ld a,$10
            out (c),a
            ld ix,$E000
            ld a,($E050)
            bit 0,h
            jr z,L0EBF
            ld ix,$E020
            ld a,($E051)
L0EBF       ld b,a
            inc l
            dec l
            jr z,L0F3C
            dec l
            jr nz,L0F09
            dec a
            rrca
            rrca
            rrca
            and $1F
            add a,xl
            ld xl,a
            ld a,b
            dec a
            and $07
            inc a
            ld c,$80
L0ED8       rlc c
            dec a
            jr nz,L0ED8
            ld e,b
L0EDE       ld a,(ix)
            and c
            jr z,L0EF4
            rrc c
            dec e
            jr z,L0EEF
            jr nc,L0EDE
            dec ix
            jr L0EDE
L0EEF       ld a,$24
            and a
            jr L0F61
L0EF4       dec e
L0EF5       ld a,(ix)
            or c
            ld (ix),a
            bit 7,h
            jr z,L0F07
            ld a,(ix+$28)
            or c
            ld (ix+$28),a
L0F07       jr L0F60
L0F09       ld a,l
            cp $03
            jr z,L0F6C
            ld a,e
            cp b
            jr nc,L0F67
            rrca
            rrca
            rrca
            and $1F
            add a,xl
            ld xl,a
            ld c,$01
            ld a,e
            and $07
            jr z,L0F27
L0F22       rlc c
            dec a
            jr nz,L0F22
L0F27       ld a,(ix)
            dec l
            jr nz,L0F3F
            and c
            jr z,L0EF5
            bit 7,h
            jr z,L0EEF
            ld a,(ix+$28)
            and c
            jr nz,L0EF5
            jr L0EEF
L0F3C       ld e,b
            jr L0F60
L0F3F       dec l
            jr nz,L0F67
            and c
            jr z,L0F60
            ld a,(ix+$28)
            and c
            jr z,L0F4F
            bit 7,h
            jr z,L0EEF
L0F4F       ld a,c
            cpl
            ld c,a
            ld a,(ix)
            and c
            ld (ix),a
            ld a,(ix+$28)
            and c
            ld (ix+$28),a
L0F60       scf
L0F61       ld bc,$253B
            out (c),d
            ret
L0F67       ld a,$15
            and a
            jr L0F61
L0F6C       ld e,$00
            ld c,$01
L0F70       ld a,(ix)
            and c
            jr nz,L0F77
            inc e
L0F77       rlc c
            dec b
            jr nc,L0F70
            inc ix
            jr nz,L0F70
            jr L0F60
            ld de,($5C59)
            push de
L0F87       ld a,(hl)
            inc hl
            ld (de),a
            inc de
            cp $0D
            jr nz,L0F87
            ex de,hl
            ld (hl),$80
            inc hl
            ld ($5C61),hl
            ld ($5C63),hl
            ld ($5C65),hl
            pop hl
L0F9D       ex de,hl
            ld hl,$5B68
            set 0,(hl)
            ld (iy),$FF
            call L27AD
            call L3F00
            add a,$0A
            call L27D7
            ld hl,$5B68
            res 0,(hl)
            ret
L0FB8       ld a,c
            cp $1A
            ld a,$15
            ret nc
            push hl
            dec b
            jr nz,L0FD9
            ld hl,$3300
            ld b,c
            ld c,$00
            srl b
            rr c
            add hl,bc
            pop bc
            ld a,c
            cp $40
            ld a,$15
            ret nc
            push bc
            ld b,$00
            jr L0FDE
L0FD9       ld b,$00
            ld hl,$3264
L0FDE       add hl,bc
            add hl,bc
            pop bc
            djnz L0FE9
            rst $08
            rlca
            ld d,l
            jr z,L101F
            ret
L0FE9       rst $08
            rlca
            ld h,b
            jr z,L1025
            ret
L0FEF       rst $08
            nop
            jp p,L3E00
            ld a,($C93F)
L0FF7       rst $08
            nop
            push af
            nop
            ccf
            ret
L0FFD       and a
            jr z,L1030
            dec a
            jr nz,L1011
            ld a,b
            cp $03
            jr nc,L1011
            cp $01
            jr nz,L1015
            ld a,c
            cp $04
            jr c,L101E
L1011       ld a,$15
            and a
            ret
L1015       and a
            jr z,L101C
            ld c,$01
            jr L1029
L101C       ld c,$FF
L101E       push bc
L101F       xor a
            ld bc,$123B
            out (c),a
L1025       ld ($5B7B),a
            pop bc
L1029       ld a,b
            ld d,c
            call L3F00
            jp p,L0113
            dec sp
            inc h
            ld a,$57
            out (c),a
            inc b
            in d,(c)
            ld a,$10
            out (c),a
            ld a,($5C7F)
            and $0F
            push af
            push de
            ld hl,$1620
            ld de,($5C8D)
            ld bc,$0800
            ld d,c
            jr z,L1079
            add a,$F2
            ld xh,a
            ld xl,$00
            ld e,(ix+$1F)
            ld d,(ix+$20)
            ld c,(ix+$25)
            ld b,(ix+$0F)
            ld l,(ix+$1C)
            ld h,(ix+$12)
            bit 6,(ix+$19)
            jr z,L1079
            ld h,$20
            cp $F3
            jr nz,L1079
            ld h,$10
L1079       pop af
            nextreg $57,a
            pop af
            scf
            ret
L1080       ld a,b
            cp $02
            jr nc,L1011
            push af
            inc sp
            ld a,($5C3C)
            push af
            inc sp
            res 7,(iy+$02)
            call L27AD
            call L3E18
            and a
            inc d
            call L27D7
            ex (sp),hl
            ld (iy+$02),l
            push de
            push af
            jr nc,L10BE
            dec h
            jr z,L10BE
            ld hl,($5C59)
            ld de,($5C5D)
            scf
            sbc hl,de
            jr nc,L10BE
            ex de,hl
            add hl,bc
            ld ($5C5D),hl
            ld hl,($5C55)
            add hl,bc
            ld ($5C55),hl
L10BE       pop af
            pop de
            pop hl
            ld (iy),$FF
            ret
L10C6       push hl
            push af
            ld a,($D5B8)
            ld hl,($D5E9)
            ld h,a
            pop af
            ex (sp),hl
            call L3E00
            ld l,$2C
            ex (sp),hl
            push af
            ld a,h
            ld ($D5B8),a
            ld a,l
            ld ($D5E9),a
            pop af
            pop hl
            ret
L10E3       add a,$03
            cp $13
            jr nc,L10F8
            rlca
            ld hl,$5C10
            ld c,a
            ld b,$00
            add hl,bc
            ld c,(hl)
            inc hl
            ld b,(hl)
            dec hl
            scf
            ret
L10F7       pop bc
L10F8       ld a,$17
            and a
            ret
L10FC       inc hl
            inc hl
L10FE       ld a,(hl)
            inc hl
            and a
            ret z
            cp c
            jr nz,L10FC
            scf
            ret
L1107       ld a,($5C7F)
            and $0F
            cp $01
            jr nz,L1111
            ld l,h
L1111       ld h,$00
            push hl
            call L1124
            jr nc,L1122
            ex de,hl
            ex (sp),hl
            and a
            sbc hl,de
            ccf
            pop hl
            ex de,hl
            ret
L1122       pop hl
            ret
L1124       ld a,b
            or c
            ret z
            ld a,(de)
            cp $2C
            scf
            ccf
            ret nz
            inc de
            dec bc
L112F       ld hl,$0000
L1132       ld a,b
            or c
            scf
            ret z
            ld a,(de)
            cp $20
            jr z,L114E
            sub $30
            ret c
            cp $0A
            ccf
            ret c
            push de
            add hl,hl
            ld d,h
            ld e,l
            add hl,hl
            add hl,hl
            add hl,de
            ld d,$00
            ld e,a
            add hl,de
            pop de
L114E       inc de
            dec bc
            jr L1132
L1152       push bc
            call L10E3
            jr nc,L10F7
            ld a,b
            or c
            jr z,L1172
            push hl
            ld hl,($5C4F)
            add hl,bc
            inc hl
            inc hl
            inc hl
            ld a,(hl)
            pop hl
            cp $4B
            jr z,L1172
            cp $53
            jr z,L1172
            cp $50
            jr nz,L10F7
L1172       pop bc
            push hl
            ld hl,$11B2
            ld a,b
            or c
            jr z,L11AD
            dec bc
            ld a,b
            or c
            inc bc
            ld a,(de)
            jr z,L1193
            ld hl,$11CA
            inc de
            ld a,(de)
            dec de
            cp $3E
            ld a,$49
            jr nz,L1193
            ld a,(de)
            inc de
            inc de
            dec bc
            dec bc
L1193       and $DF
            push bc
            ld c,a
            call L10FE
            pop bc
            jr nc,L11AD
            ld a,(hl)
            inc hl
            ld h,(hl)
            ld l,a
            call L11AC
            pop hl
            jr nc,L11AE
            ld (hl),e
            inc hl
            ld (hl),d
            scf
            ret
L11AC       jp (hl)
L11AD       pop bc
L11AE       ld a,$0E
            and a
            ret
            ld c,e
            cp h
            ld de,$C053
            ld de,$C450
            ld de,$1E00
            ld bc,$0618
            ld e,$06
            jr L11C6
            ld e,$10
L11C6       ld d,$00
            scf
            ret
            ld c,c
            xor $11
            ld c,a
            rst $20
            ld de,$E055
            ld de,$594D
            ld (de),a
            ld d,(hl)
            sub h
            ld (de),a
            ld d,a
            inc sp
            inc de
            ld b,h
            jp c,L0012
            ld hl,$0202
            ld a,$03
            jr L11F3
            ld hl,$0204
            ld a,$02
            jr L11F3
            ld hl,$0002
            ld a,$05
L11F3       push af
            push hl
            ld hl,$DA31
            ld a,b
            and a
            jr nz,L11FF
            ld b,c
            jr L1201
L11FF       ld b,$FF
L1201       ex de,hl
L1202       ld a,(hl)
            inc hl
            call L1587
            ld (de),a
            inc de
            call L1570
            djnz L1202
            call L1587
            ld a,$FF
            ld (de),a
            call L1570
            call L1587
            call L05F4
            call L1570
            jr c,L1225
            pop hl
            pop hl
            ret
L1225       ld hl,$DA31
            pop de
            pop af
            ld c,a
            push bc
            call L1587
            call L0106
            call L1570
            pop bc
            ret nc
            push bc
            ld hl,$124C
            ld bc,$000E
            ld de,$000D
            call L148E
            ld bc,$000D
            add hl,bc
            pop bc
            ld (hl),b
            scf
            ret
            ld c,l
            ld e,e
            ld c,l
            ld e,e
            ld b,(hl)
            jr nc,L1258
            daa
            dec b
            ex af,af'
            dec b
            ld c,$00
            call L112F
            push hl
            call L1124
            pop de
            ret nc
            ld a,b
            or c
            ret nz
            ld a,h
            or l
            ret z
            push de
            push hl
            ld hl,$1287
            ld bc,$0013
            ld de,$000D
            call L148E
            ld bc,$000D
            add hl,bc
            pop bc
            ld (hl),c
            inc hl
            ld (hl),b
            inc hl
            inc hl
            inc hl
            pop bc
            ld (hl),c
            inc hl
            ld (hl),b
            scf
            ret
            ld c,l
            ld e,e
            ld c,l
            ld e,e
            ld c,l
            inc sp
            nop
            sbc a,d
            inc b
            sbc a,a
            inc b
            inc de
            nop
            ld a,b
            or c
            ret z
            ld h,d
            ld l,e
            add hl,bc
            dec hl
            ld a,(hl)
            cp $24
            scf
            ccf
            ret nz
            add bc,$0010
            ld ($5C5F),de
            push bc
            ld hl,$12CF
            ld de,$000B
            call L148E
            pop bc
            push de
            add hl,$000B
            ld (hl),c
            inc hl
            ld (hl),b
            inc hl
            inc hl
            inc hl
            ex de,hl
            add bc,$FFF0
            ld hl,($5C5F)
            ldir
            ld a,$28
            ld (de),a
            pop de
            scf
            ret
            ld c,l
            ld e,e
            ld c,l
            ld e,e
            ld d,(hl)
            rst $30
            ld a,$E0
            ld a,$03
            ccf
            ld a,b
            or c
            ret z
            ld a,(de)
            inc de
            dec bc
            push af
            ld hl,$0000
            ld a,b
            or c
            jr z,L1304
            ld a,(de)
            inc de
            dec bc
            cp $3E
            jr z,L1305
            cp $2C
            jr z,L12F5
L12F3       pop af
            ret
L12F5       call L112F
            push hl
            ld hl,$0000
            call L1124
            ld a,b
            or c
            pop bc
            jr nz,L12F3
L1304       ex de,hl
L1305       ex de,hl
            ld d,b
            ld e,c
            pop af
            ld c,a
            ld b,$F9
            push bc
            call L01CF
            pop de
            ret nc
            ld d,a
            push de
            ld hl,$132A
            ld bc,$0007
            ld de,$0005
            call L148E
            ld bc,$0005
            add hl,bc
            pop bc
            ld (hl),c
            inc hl
            ld (hl),b
            scf
            ret
            ld c,l
            ld e,e
            ld c,l
            ld e,e
            ld b,h
L132F       pop hl
L1330       pop hl
L1331       pop hl
            ret
            call L112F
            ld a,h
            and a
            ret nz
            ld h,$18
            ld a,($5C7F)
            and $0F
            cp $01
            jr nz,L1346
            ld h,$0C
L1346       ld a,l
            cp h
            ret nc
            push hl
            ld hl,$0F1F
            call L1107
            jr nc,L1331
            ld a,l
            pop hl
            ld h,a
            push hl
            ld a,$0C
            sub l
            ld h,a
            ld a,$18
            sub l
            ld l,a
            call L1107
            jr nc,L1331
            ex (sp),hl
            push hl
            ld a,$20
            sub h
            ld l,a
            ld a,$10
            sub h
            ld h,a
            call L1107
            ld a,l
            pop hl
            ex (sp),hl
            ld h,a
            push hl
            call L1124
            ld a,$08
            jr nc,L1391
            ld a,h
            and a
            jr nz,L1330
            ld a,l
            cp $03
            ccf
            jr nc,L1330
            cp $09
            jr nc,L1330
            push af
            call L1124
            jr c,L13A4
            pop af
L1391       push af
            ld hl,$1475
            sub $03
            jr z,L139E
L1399       inc hl
            inc hl
            dec a
            jr nz,L1399
L139E       ld a,(hl)
            inc hl
            ld h,(hl)
            ld l,a
            jr L13AA
L13A4       ld a,h
            and $C0
            jr z,L132F
            dec h
L13AA       ld a,b
            or c
            jr nz,L132F
            push hl
            ld hl,$1481
            ld bc,$0030
            ld de,$000D
            call L148E
            ld bc,$000D
            add hl,bc
            pop bc
            ld (hl),c
            inc hl
            ld (hl),b
            inc hl
            pop af
            ld (hl),a
            inc hl
            ld b,a
            xor a
L13C9       scf
            rra
            djnz L13C9
            ld (hl),a
            inc hl
            pop bc
            ld (hl),b
            inc hl
            ld (hl),c
            inc hl
            ex de,hl
            ex (sp),hl
            ex de,hl
            push de
            ld (hl),d
            inc hl
            ld (hl),e
            inc hl
            ld a,e
            ex de,hl
            add hl,bc
            ex de,hl
            dec d
            dec e
            ld (hl),d
            inc hl
            ld (hl),e
            inc hl
            add a,a
            add a,a
            add a,a
            push af
            ld (hl),a
            inc hl
            ld a,e
            inc a
            add a,a
            add a,a
            add a,a
            ld (hl),a
            inc hl
            xor a
            ld (hl),a
            inc hl
            ld (hl),a
            inc hl
            ld (hl),a
            inc hl
            ld de,$FFF3
            ex de,hl
            add hl,de
            ld c,(hl)
            ld l,b
            ld h,$00
            ld b,h
            add hl,hl
            add hl,hl
            add hl,hl
            ld a,($5C7F)
            and $0F
            cp $09
            push af
            ld a,$00
            jr nz,L1414
            add hl,hl
L1414       and a
            sbc hl,bc
            inc a
            jr nc,L1414
            dec a
            ex de,hl
            ld (hl),a
            inc hl
            pop af
            ld (hl),$08
            jr nz,L1425
            ld (hl),$10
L1425       inc hl
            ld (hl),a
            inc hl
            ld c,$00
            and a
            jr z,L145A
            cp $05
            jr nc,L145F
            push af
            add a,$F2
            ld d,a
            ld e,$20
            ld a,i
            push af
            di
            push hl
            ld bc,$243B
            ld a,$57
            out (c),a
            inc b
            in l,(c)
            ld a,$10
            out (c),a
            ld a,(de)
            ld h,a
            out (c),l
            ld c,h
            pop hl
            pop af
            jp po,L1455
            ei
L1455       pop af
            add a,$5E
            jr L1465
L145A       ld a,($5C8D)
            jr L1469
L145F       srl a
            srl a
            add a,$60
L1465       ld e,a
            ld d,$5B
            ld a,(de)
L1469       ld (hl),a
            inc hl
            ld (hl),c
            inc hl
            pop af
            pop de
            ld (hl),d
            inc hl
            ld (hl),a
            pop de
            scf
            ret
            nop
            call pe,LEC00
            nop
            rst $28
            nop
            rst $28
            nop
            rst $30
            nop
            ei
            ld c,l
            ld e,e
            ld c,l
            ld e,e
            ld d,a
            ld e,e
            daa
            ret po
            ld de,$2B9A
            jr nc,L148E
L148E       push hl
            push de
            push bc
            ld hl,($5C53)
            dec hl
            push hl
            exx
            call L3E00
            halt
            dec b
            pop de
            pop hl
            pop bc
            and a
            sbc hl,bc
            ex (sp),hl
            push de
            ldir
            pop hl
            pop bc
L14A8       ld a,b
            or c
            jr z,L14B2
            xor a
            ld (de),a
            inc de
            dec bc
            jr L14A8
L14B2       push hl
            ld de,($5C4F)
            and a
            sbc hl,de
            inc hl
            ex de,hl
            pop hl
            ret
L14BE       call L10E3
            ret nc
            ld a,b
            or c
            scf
            ret z
            push hl
            ld hl,($5C4F)
            add hl,bc
            inc hl
            inc hl
            inc hl
            ld c,(hl)
            ex de,hl
            ld hl,$14FB
            call L10FE
            jp nc,L10F8
            ld a,(hl)
            inc hl
            ld h,(hl)
            ld l,a
            call L11AC
            pop hl
            ld a,$12
            ret nc
            ld bc,$0000
            ld de,$A3E2
            ex de,hl
            add hl,de
            jr c,L14F5
            ld bc,$1522
            add hl,bc
            ld c,(hl)
            inc hl
            ld b,(hl)
L14F5       ex de,hl
            ld (hl),c
            inc hl
            ld (hl),b
            scf
            ret
            ld c,e
            ld sp,hl
            inc d
            ld d,e
            ld sp,hl
            inc d
            ld d,b
            ld sp,hl
            inc d
            ld b,(hl)
            ld ($4D15),hl
            inc sp
            dec d
            ld d,(hl)
            inc sp
            dec d
            ld d,a
            inc sp
            dec d
            ld b,h
            ld b,a
            dec d
            nop
            ld bc,$0600
            nop
            dec bc
            nop
            ld bc,$0100
            nop
            ld b,$00
            djnz L1522
L1522       ld hl,$0009
            add hl,de
            ld b,(hl)
            push de
            call L1587
            call L0109
            call L1570
            pop de
            ret nc
            ld hl,$0007
            add hl,de
            ld c,(hl)
            inc hl
            ld b,(hl)
L153A       dec de
            dec de
            dec de
            dec de
            ex de,hl
            exx
            call L3E00
            ld a,$05
            scf
            ret
            ex de,hl
            push hl
            inc hl
            ld c,(hl)
            inc hl
            ld d,(hl)
            ld b,$FA
            call L01CF
            pop de
            ld a,$24
            ret nc
            ld bc,$0007
            jr L153A
L155B       exx
            ld de,$0000
L155F       call L3E00
            push hl
            inc bc
            ret
L1565       ld de,$0002
            jr L155F
L156A       exx
            ld de,$0004
            jr L155F
L1570       nextreg $8E,$0A
            ex af,af'
            pop af
            ld ($5B52),hl
            ld hl,($5B6A)
            ld ($5B6A),sp
            ld sp,hl
            ld hl,($5B52)
            push af
            ex af,af'
            ret
L1587       ex af,af'
            pop af
            ld ($5B52),hl
            ld hl,($5B6A)
            ld ($5B6A),sp
            ld sp,hl
            ld hl,($5B52)
            push af
            ex af,af'
            nextreg $8E,$7A
            ret
L159E       ld ix,($5C51)
            call L3E00
            push de
            daa
            ret
L15A8       ld ix,($5C51)
            call L3E00
            dec l
            daa
            ret
L15B2       ld a,(ix)
            cp $02
            scf
            ret z
            ld a,$3D
            and a
            ret
L15BD       call L15B2
            ret nc
            ld c,(ix+$0C)
            ld b,(ix+$0D)
            scf
            ret
L15C9       call L15B2
            ret nc
            push hl
            ld l,(ix+$0E)
            ld h,(ix+$0F)
            and a
            sbc hl,bc
            pop hl
            ccf
            ld a,$15
            ret nc
L15DC       ld (ix+$0C),c
            ld (ix+$0D),b
            scf
            ret
L15E4       call L15B2
            ret nc
            ld a,b
            push af
            push hl
            ld e,(ix+$0C)
            ld d,(ix+$0D)
            ld l,(ix+$0E)
            ld h,(ix+$0F)
            and a
            sbc hl,de
            jr nc,L15FF
            ld de,$0000
L15FF       push de
            ld b,(ix+$0B)
            call L07ED
            ld c,a
            pop hl
            inc hl
            ld (ix+$0C),l
            ld (ix+$0D),h
            pop hl
            pop af
            ld b,a
            scf
            ret
L1614       call L15E4
            ret nc
            push bc
            push hl
            call L187E
            jr nc,L1688
            ld a,$52
            call L18C3
            jr nc,L1688
            call L191D
            pop hl
            jr nz,L1683
            pop bc
            ld d,(ix+$0B)
            ld a,b
            call L3E4C
            push bc
            ld c,$EB
L1637       ld e,$20
L1639       ini
            ini
            ini
            ini
            ini
            ini
            ini
            ini
            ini
            ini
            ini
            ini
            ini
            ini
            ini
            ini
            dec e
            jp nz,L1639
            in a,(c)
            nop
            in a,(c)
            nop
L1663       in a,(c)
            cp $FF
            jr z,L1663
            cp $FE
            jr nz,L1683
            dec d
            jr nz,L1637
            scf
L1671       push af
            ld a,$07
            call L3E4C
            bit 0,(ix+$10)
            push hl
            call L195A
            pop hl
            pop af
            pop bc
            ret
L1683       ld a,$00
            and a
            jr L1671
L1688       pop hl
            jr L1671
L168B       call L15E4
            ret nc
            ld a,(ix+$0B)
L1692       push af
            push de
            call L1879
            pop de
            jr nc,L16A6
            inc de
            ld a,d
            or e
            jr nz,L16A0
            inc c
L16A0       pop af
            dec a
            jr nz,L1692
            scf
            ret
L16A6       pop de
            ret
L16A8       ld a,$3A
            and a
            ret
L16AC       bit 7,a
            res 7,a
            push af
            and a
            jr z,L16B6
            cp $21
L16B6       ld a,$15
            jr nc,L16A6
            pop af
            push af
            jr z,L1713
            ld a,$02
            call L2226
            jr nc,L16A6
            pop af
L16C6       push af
            call L23D5
            ld c,(ix+$07)
            ld b,(ix+$08)
            jr nz,L16EC
            add hl,$0020
            ld a,(hl)
            cp $02
            scf
            ccf
            ld a,$09
            jr nz,L1703
            dec bc
            push ix
            pop de
            add de,$0001
            push bc
            call L236A
            pop bc
L16EC       pop af
            push af
            ld e,a
            ld d,$00
            call L17C2
            pop af
            dec a
            cp l
            jr z,L16FA
            dec bc
L16FA       inc a
            call L1763
            push ix
            call L0605
L1703       push af
            call nc,L04F4
            pop af
            pop hl
            ret nc
            push ix
            pop de
            ld bc,$0013
            ldir
            ret
L1713       push bc
            ld hl,$2018
            ld a,$09
            call L1C99
            jr nc,L1773
            dec b
            ld a,$40
            ccf
            jr z,L1773
            ld hl,$FB70
L1727       push bc
            push hl
            ld a,(hl)
            ld ($D837),a
            ld a,$02
            ld bc,$D827
            call L2226
            jr nc,L174E
            ld a,$01
            call L16C6
            jr nc,L174E
            pop hl
            pop de
            pop bc
            pop af
            push af
            push bc
            push de
            push hl
            call L179B
            jr c,L175B
            call L1776
L174E       pop hl
            ld bc,$000D
            add hl,bc
            pop bc
            djnz L1727
            ld a,$40
            and a
            jr L1773
L175B       pop hl
            pop bc
            pop bc
            pop af
            scf
            ret
L1761       pop bc
            pop af
L1763       ld (ix+$0E),c
            ld (ix+$0F),b
            ld (ix+$0B),a
            ld bc,$0000
            jp L15DC
L1772       pop bc
L1773       pop bc
            pop bc
            ret
L1776       call L15B2
            ret nc
            call L04F4
            ld (ix),$00
            scf
            ret
L1783       ld hl,$0000
            ld d,a
            dec a
            ld e,a
            cp $20
            ld a,$15
            jr nc,L1772
            ld a,h
L1790       add hl,bc
            adc a,$00
            dec d
            jr nz,L1790
            add hl,de
            adc a,d
            ex de,hl
            ld l,a
            ret
L179B       ld d,a
            call L15B2
            ret nc
            ld a,d
            push af
            push bc
            call L1783
            ld a,(ix+$09)
            cp l
            jr c,L17BC
            jr nz,L1761
            ld a,(ix+$08)
            cp d
            jr c,L17BC
            jr nz,L1761
            ld a,(ix+$07)
            cp e
            jr nc,L1761
L17BC       pop bc
            pop bc
            ld a,$15
            and a
            ret
L17C2       ld a,b
            ld hl,$0000
            ld b,$10
            and a
L17C9       rl c
            rla
            adc hl,hl
            sbc hl,de
            jr nc,L17D3
            add hl,de
L17D3       djnz L17C9
            rl c
            rla
            cpl
            ld b,a
            ld a,c
            cpl
            ld c,a
            ret
L17DE       ld a,c
            cp $02
            ld a,$41
            ret nc
            inc c
            dec c
            ld hl,$F700
            call L18EB
            jr nc,L1827
            and a
            jr z,L182A
            ld hl,($F706)
            ld a,l
            and $03
            ld l,h
            ld h,a
            ld a,($F708)
            rlca
            adc hl,hl
            rlca
            adc hl,hl
            inc hl
            ld bc,($F709)
            ld a,c
            and $03
            rl b
            rla
            ld c,a
            ld a,($F705)
            and $0F
            add a,c
            sub $07
            ld de,$0000
L1819       add hl,hl
            ex de,hl
            adc hl,hl
            ex de,hl
            dec a
            jr nz,L1819
            ld b,$00
L1823       ld c,$80
            scf
            ret
L1827       ld a,$00
            ret
L182A       ld hl,($F708)
            ld a,h
            ld h,l
            ld l,a
            ld a,($F707)
            and $3F
            ld de,$0001
            add hl,de
            adc a,d
            add hl,hl
            adc a,a
            add hl,hl
            adc a,a
            ld e,h
            ld h,l
            ld l,d
            ld d,a
            ld b,$02
            jr nc,L1823
            dec de
            dec hl
            jr L1823
L184A       ld a,b
            res 7,a
L184D       push bc
            push de
            push hl
            call L187E
            ex (sp),ix
            jr nc,L186D
            push af
            and $7F
            call L3E4C
            pop af
            push af
            bit 7,a
            jr z,L1869
            pop af
            call L1961
            jr L186D
L1869       pop af
            call L192C
L186D       pop ix
            push af
            ld a,$07
            call L3E4C
            pop af
            pop de
            pop bc
            ret
L1879       ld a,b
            set 7,a
            jr L184D
L187E       ld b,$00
            ld l,(ix+$07)
            ld h,(ix+$08)
            and a
            sbc hl,de
            ld l,(ix+$09)
            ld h,(ix+$0A)
            sbc hl,bc
            jr nc,L1897
            ld a,$02
            and a
            ret
L1897       ld l,(ix+$01)
            ld h,(ix+$02)
            add hl,de
            ex de,hl
            ld l,(ix+$03)
            ld h,(ix+$04)
            adc hl,bc
            bit 1,(ix+$10)
            jr nz,L18B7
            ld h,l
            ld l,d
            ld d,e
            ld e,$00
            ex de,hl
            add hl,hl
            ex de,hl
            adc hl,hl
L18B7       bit 0,(ix+$10)
            scf
            ret
L18BD       ld h,$00
L18BF       ld l,$00
            ld d,l
            ld e,l
L18C3       ld b,$FF
L18C5       ld c,a
            ld a,$FE
            jr z,L18CC
            ld a,$FD
L18CC       out ($E7),a
            in a,($EB)
            ld a,c
            ld c,$EB
            out (c),a
            ld a,h
            out (c),a
            ld a,l
            out (c),a
            ld a,d
            out (c),a
            ld a,e
            out (c),a
            ld a,b
            out (c),a
            call L190F
            and a
            ret nz
            scf
            ret
L18EB       push hl
            push af
            call L19C4
            pop af
            push de
            ld a,$49
            call L18BD
            pop de
            pop hl
            jr nc,L190D
            call L191D
            jr z,L1903
            and a
            jr L190D
L1903       ld b,$12
            ld c,$EB
L1907       ini
            jr nz,L1907
            scf
            ld a,d
L190D       jr L194E
L190F       ld bc,$0032
L1912       in a,($EB)
            cp $FF
            ret nz
            djnz L1912
            dec c
            jr nz,L1912
            ret
L191D       ld e,$0A
L191F       call L190F
            cp $FE
            jr z,L192B
            jr c,L192B
            dec e
            jr nz,L191F
L192B       ret
L192C       ld a,$51
            call L18C3
L1931       ld a,$00
            jr nc,L194E
            call L191D
            jr z,L193D
            and a
            jr L1931
L193D       push ix
            pop hl
            ld bc,$00EB
            inir
            inir
            in a,($EB)
            nop
            nop
            in a,($EB)
            scf
L194E       push af
            in a,($EB)
            ld a,$FF
            out ($E7),a
            nop
            in a,($EB)
            pop af
            ret
L195A       ld a,$4C
            call L18BD
            jr L194E
L1961       push af
            ld a,$58
            call L18C3
            jr nc,L19A8
            ld a,$FE
            out ($EB),a
            ld bc,$00EB
            push ix
            pop hl
            otir
            otir
            ld a,$FF
            out ($EB),a
            nop
            nop
            out ($EB),a
            call L190F
            and $1F
            cp $05
            jr nz,L19A8
L1988       call L190F
            and a
            jr z,L1988
            pop af
            ld a,$4D
            push hl
            call L18BD
            pop hl
            jr nc,L19A9
            in a,($EB)
            and a
            scf
            jr z,L19AC
            and $23
            ld a,$01
            jr nz,L19AC
            ld a,$03
            jr L19AC
L19A8       pop af
L19A9       ld a,$00
            and a
L19AC       jr L194E
L19AE       ld bc,$0200
L19B1       ld a,$02
            sub b
            ld hl,$E090
            push bc
            call L18EB
            pop bc
            jr c,L19BF
            dec c
L19BF       inc c
            djnz L19B1
            ld a,c
            ret
L19C4       push af
            call L195A
            pop af
            push af
            ld a,$40
            ld hl,$0000
            ld d,h
            ld e,l
            ld b,$95
            call L18C5
            dec a
            jr nz,L1A24
            ld bc,$0078
L19DC       pop af
            push af
            push bc
            ld a,$48
            ld hl,$0000
            ld de,$01AA
            ld b,$87
            call L18C5
            pop bc
            bit 2,a
            ld h,$00
            jr nz,L1A0D
            dec a
            jr nz,L1A26
            in a,($EB)
            ld h,a
            nop
            in a,($EB)
            ld l,a
            nop
            in a,($EB)
            and $0F
            ld d,a
            in a,($EB)
            cp e
            jr nz,L1A26
            dec d
            jr nz,L1A4A
            ld h,$40
L1A0D       pop af
            push af
            push hl
            ld a,$77
            call L18BD
            pop hl
            pop af
            push af
            push hl
            ld a,$69
            call L18BF
            pop hl
            jr c,L1A2D
            dec a
            jr z,L1A0D
L1A24       jr L1A4A
L1A26       djnz L19DC
            dec c
            jr nz,L19DC
            jr L1A4A
L1A2D       pop af
            push af
            call L1A4F
            jr nc,L1A4A
            ld d,a
            jr z,L1A47
            pop af
            push af
            ld a,$50
            ld de,$0200
            ld h,e
            ld l,e
            call L18C3
            jr nc,L1A4A
            ld d,$01
L1A47       scf
            jr L1A4B
L1A4A       and a
L1A4B       pop bc
            jp L194E
L1A4F       ld a,$7A
            call L18BD
            ret nc
            ld d,$C0
            in a,($EB)
            and d
            ld h,a
            in a,($EB)
            ld l,a
            nop
            in a,($EB)
            ld e,a
            nop
            in a,($EB)
            ld a,h
            sub d
            scf
            ret
L1A69       call L1A4F
            ret nc
            ret z
            and a
            ret
L1A70       ld de,$0109
            scf
            ret
L1A75       cp $01
            jr z,L1AEB
            and a
            ld a,$15
            ret nz
            ld b,$10
L1A7F       push bc
            dec b
            call L0109
            pop bc
            call L1AE1
            djnz L1A7F
            ld ix,$E46C
            ld b,$14
L1A90       push bc
            push ix
            call L00DC
            pop ix
            ld bc,$0013
            add ix,bc
            pop bc
            djnz L1A90
            ld b,$41
L1AA2       push bc
            ld l,b
            ld bc,$0000
            call L00F7
            pop bc
            call L1AE1
            jr z,L1ABC
            inc a
            jr nz,L1ABC
            push bc
            ld l,b
            call L00F4
            pop bc
            call L1AE1
L1ABC       inc b
            ld a,b
            cp $51
            jr nz,L1AA2
            ld b,$41
L1AC4       push bc
            ld l,b
            call L00F4
            pop bc
            call L1AE1
            inc b
            ld a,b
            cp $51
            jr nz,L1AC4
            ld b,$01
            rst $08
            nop
            adc a,d
            ld sp,$0106
            rst $08
            nop
            ld h,a
            ld sp,$C937
L1AE1       ret c
            cp $1D
            ret z
            cp $38
            ret z
            and a
            pop hl
            ret
L1AEB       ld hl,$5B8A
            ld de,$DA33
            ld bc,$0075
            ldir
            ld ($DA31),sp
            ld sp,$5BFF
            ld d,a
            ld hl,$2007
            rst $08
            nop
            dec e
            nop
            ld e,a
            inc hl
            rst $08
            nop
            dec e
            nop
            cpl
            cp e
            jr z,L1B11
            ld a,$02
L1B11       push af
            push de
            xor a
            ld hl,$DBA0
            ld de,$DBA1
            ld bc,$07F9
            ld (hl),a
            ldir
            ld hl,$E3F7
            ld de,$E3F8
            ld bc,$1119
            ld (hl),a
            ldir
            dec a
            ld c,$2C
            ld hl,$E300
            ld de,$E301
            push bc
            ld (hl),a
            ldir
            pop bc
            ld hl,$E36D
            ld de,$E36E
            ld (hl),a
            ldir
            ld c,$1F
            ld hl,$E3CA
            ld de,$E3CB
            ld (hl),a
            ldir
            call L00A3
            ld hl,$2300
            ld de,$2301
            ld bc,$0E2C
            rst $08
            nop
            in a,($04)
            ld hl,$2300
            ld de,$2301
            ld bc,$002F
            dec a
            rst $08
            nop
            call c,L2104
            ret p
            scf
            ld de,$37F1
            ld bc,$080C
            rst $08
            dec c
            in a,($04)
            ld hl,$2300
            ld de,$0000
            rst $08
            nop
            ld h,(hl)
            ld bc,$4321
            nop
            call L1BEA
            pop af
            push hl
            push af
            and a
            call z,L1CF3
            ld hl,$2302
            ld de,$024D
            rst $08
            nop
            ld h,(hl)
            ld bc,$CDF1
            ret nz
            inc e
            ld hl,$044D
            ld b,$01
            call L1BEC
            pop hl
            ld h,$05
            call L1BEA
            ld hl,$2003
            ld a,$09
            call L1C99
            jr nc,L1BC7
            dec b
            jr z,L1BC7
            push bc
            ld de,$200C
            call L1C13
            pop bc
            ld de,$200F
            call L1C13
L1BC7       pop af
            ld hl,$DA33
            ld de,$5B8A
            ld bc,$0075
            ldir
            ld sp,($DA31)
            add a,$41
            call L012D
            jr c,L1BE3
            ld a,$43
            call L012D
L1BE3       ld ($5B79),a
            ld ($5B7A),a
            ret
L1BEA       ld b,$02
L1BEC       push bc
            ld bc,$0000
L1BF0       push bc
            push hl
            ld a,h
            call L00F1
            pop hl
            pop bc
            jr nc,L1C05
            push bc
            push hl
            call L1C6B
            pop hl
            pop bc
L1C01       inc l
L1C02       inc bc
            jr L1BF0
L1C05       cp $09
            jr z,L1C02
            dec bc
            cp $3E
            jr z,L1C01
            pop bc
            inc h
            djnz L1BEC
            ret
L1C13       ld hl,$FB6C
L1C16       push bc
            push de
            push hl
            call L1CB4
            jr nz,L1C61
            inc hl
            ld a,(hl)
            inc hl
            res 7,a
            cp $41
            jr c,L1C61
            cp $51
            jr nc,L1C61
            ld c,a
            inc hl
            inc hl
            inc hl
            ld de,$2012
            push hl
            call L1CB4
            pop hl
            jr z,L1C41
            ld de,$2015
            call L1CB4
            jr nz,L1C61
L1C41       pop hl
            push hl
            ld de,$D833
            ld b,$0B
L1C48       ld a,(hl)
            inc hl
            res 7,a
            ld (de),a
            inc de
            djnz L1C48
            ld a,$FF
            ld (de),a
            ld l,c
            ld a,$FF
            ld bc,$D827
            push hl
            call L00F1
            pop hl
            call c,L1C6B
L1C61       pop hl
            pop de
            add hl,$000D
            pop bc
            djnz L1C16
            ret
L1C6B       push hl
            ld a,l
            add a,$DF
            ld bc,$0100
            ld h,a
            ld l,c
            ld de,$E090
            push de
            ld a,$09
            rst $08
            nop
            ld l,c
            rlca
            pop hl
            ld a,(hl)
            cpl
            inc hl
            cp (hl)
            inc hl
            scf
            ccf
            push hl
            call z,L050A
            pop hl
            pop bc
            ret c
            ld a,c
            sub $41
            ld (hl),$2F
            inc hl
            ld (hl),$FF
            dec hl
            jp L050A
L1C99       call L1E2C
            push hl
            ld hl,$FB5F
            ld de,$FB60
            ld bc,$000C
            ld (hl),b
            ldir
            pop hl
            ld de,$FB5F
            ld bc,$4021
            xor a
            jp L011E
L1CB4       ld b,$03
L1CB6       res 7,(hl)
            ld a,(de)
            cp (hl)
            ret nz
            inc de
            inc hl
            djnz L1CB6
            ret
            push af
            call L013C
            ld de,$0080
            pop af
            and a
            sbc hl,de
            jr z,L1CCE
            xor a
L1CCE       ld hl,$0080
            ld de,$0000
            push de
            call L24A2
            pop de
            call L05EF
            ld hl,$E458
            ld de,$E46C
            ld a,$05
            call L1F07
            ld hl,$E462
            ld de,$E47F
            ld a,$06
            call L1F07
            ret
L1CF3       ld hl,$1FDC
            ld a,$0B
            call L1E23
            push hl
            ld a,$10
            call L0E37
            pop hl
            jp nc,L1DE7
            call L3E18
            inc bc
            nop
            ld hl,$D827
            call L1E7D
            ld hl,$2021
            ld a,$0C
            ld de,$0EC2
            call L1DD8
            ld hl,$C002
            ld de,$3140
            ld bc,$0EC0
            ld a,$00
            call L1DCA
            ld hl,$C000
            ld de,$0700
            push hl
            push de
            call L1E07
            pop bc
            pop hl
            push hl
            ld de,$2000
            call L1DC8
            pop hl
            ld de,$0580
            push hl
            push de
            call L1E07
            pop bc
            pop hl
            push hl
            ld de,$3180
            call L1DC8
            pop hl
            ld de,$1400
            push hl
            push de
            call L1E07
            pop bc
            pop hl
            push hl
            ld de,$2300
            ld a,$0C
            call L1DCA
            pop hl
            ld de,$0BF8
            push hl
            push de
            call L1E07
            pop bc
            pop hl
            push hl
            push bc
            ld de,$2000
            ld a,$0D
            call L1DCA
            pop de
            pop hl
            push hl
            push de
            call L1E07
            pop bc
            pop hl
            push hl
            ld de,$2BF8
            ld a,$0D
            call L1DCA
            pop hl
            ld de,$1500
            push hl
            push de
            call L1E07
            pop bc
            pop hl
            push hl
            ld de,$2000
            ld a,$0A
            call L1DCA
            pop hl
            ld de,$1140
            push de
            call L1E07
            call L1DCF
            pop bc
            ld de,$2000
            ld a,$07
            call L1DCA
            ld hl,$202D
            ld a,$07
            ld b,$C9
            ld de,$0200
            call L1DF2
            call L1DCF
            ld de,$2700
            ld bc,$0200
L1DC8       ld a,$01
L1DCA       rst $08
            nop
            inc bc
            rlca
            ret
L1DCF       ld b,$00
            call L0109
            ld hl,$C000
            ret
L1DD8       ld b,$00
            call L1DF2
            ld de,($C000)
            ld hl,$D827
            jp c,L1E7D
L1DE7       push hl
            ld hl,$20AA
            call L1ECD
            pop hl
            jp L1EB0
L1DF2       push bc
            push de
            call L1E2C
            inc c
            ld de,$0002
            call L0106
            pop de
            ld hl,$C001
            pop bc
            ld (hl),b
            dec hl
            ld (hl),b
            ret nc
L1E07       ld bc,$0007
            call L0112
            ret c
            cp $19
            scf
            ret z
            and a
            ret
L1E14       ld hl,$1FBD
            add hl,a
            bit 0,a
            ld a,$08
            jr z,L1E23
            inc a
            ld hl,$1FE7
L1E23       push hl
            ld hl,$206C
            ld bc,$0011
            jr L1E33
L1E2C       push hl
            ld hl,$2052
            ld bc,$000C
L1E33       ld de,$D827
            ldir
            pop hl
            ld c,a
            ldir
            ld a,$FF
            ld (de),a
            ld hl,$D827
            ret
            xor a
            call L0E0B
            cp $08
            jr z,L1E62
            ld a,$01
            call L0E0B
            ld h,a
            ld a,$0E
            call L0E0B
            ld l,a
            ld bc,$310A
            and a
            sbc hl,bc
            ld hl,$208D
            jr c,L1EB0
L1E62       ld hl,$1EB9
            ld de,$ED27
            ld bc,$0014
            ldir
            call LED27
            ld hl,$1FF0
            jr z,L1E7D
            call L1ECD
            ld hl,$20A1
            jr L1EB0
L1E7D       push hl
            ld hl,$0208
            and a
            sbc hl,de
            pop hl
            ret z
            push hl
            ld hl,$20BF
            call L1ECD
            ex de,hl
            ld b,$04
L1E90       ld a,h
            swapnib
            and $0F
            add a,$30
            cp $3A
            jr c,L1E9D
            add a,$27
L1E9D       call L3E00
            djnz L1EA2
L1EA2       add hl,hl
            add hl,hl
            add hl,hl
            add hl,hl
            djnz L1E90
            ld a,$20
            call L3E00
            djnz L1EAF
L1EAF       pop hl
L1EB0       call L1ECD
            ld a,$02
            out ($FE),a
L1EB7       jr L1EB7
            ld a,$80
            out ($E3),a
            ld hl,($0004)
            ld de,($0006)
            xor a
            out ($E3),a
            ld bc,$5644
            sbc hl,bc
            ret
L1ECD       push de
            ld de,$E090
            ld bc,$0200
            push de
            ldir
            pop hl
            call L3E00
            dec e
            ex af,af'
            pop de
            ret
L1EDF
            nextreg $8E,$7A        ; RAM Bank 7, ROM 2
            ld hl,$1EF1            
            ld de,$ED27
            ld bc,$0016            
            ldir                   ; Copy 16 bytes from $1EF1 to $ED27 
            jp LED27               ; Jump immediately to $ED27 
L1EF1
            ld a,$81               
            out ($E3),a            ; Map in DivMMC ROM lower 8K to $0000-1fff
                                   ; Map in DivMMC RAM bank 1 to $2000-3fff
            ld a,$C9               
            ld ($2009),a           ; Store a "RET" statement to $2009
            ld a,$80                
            out ($E3),a            ; Map in DivMMC ROM lower 8K to $0000-1fff
                                   ; Map in DivMMC RAM bank 0 to $2000-3fff
            ld a,$C9            
            ld ($3D00),a           ; Store a "RET" statement to $3D00
            xor a                   
            out ($E3),a            ; Page out DivMMC ROM and RAM
            ret                    ; Done.
L1F07       push de
            push hl
            ld hl,$1F77
            ld bc,$0010
            ldir
            pop de
            ex (sp),ix
            push de
            call L07D5
            pop de
            ex (sp),ix
            push de
            ld hl,$1F82
            ld bc,$0008
            ldir
            ex de,hl
            pop bc
            pop de
            push de
            push bc
            ld (hl),e
            inc hl
            ld (hl),d
            push af
            ld hl,$207D
            call L00B5
            pop bc
            jr nc,L1F3D
            ld a,($F722)
            cp $01
            jr z,L1F57
L1F3D       pop hl
            ex (sp),ix
            set 7,(ix+$01)
            ex (sp),ix
            push hl
            ld a,b
            ld hl,$207D
            call L00B5
            jr nc,L1F6F
            ld a,($F722)
            cp $01
            jr nz,L1F6F
L1F57       pop de
            ld hl,$F732
            ld bc,$0008
            ldir
            ex (sp),ix
            ld a,(ix+$10)
            and $01
            add a,$05
            call L0765
            pop ix
            ret
L1F6F       xor a
            pop hl
            ld (hl),a
            inc hl
            ld (hl),a
            pop hl
            ld (hl),a
            ret
            ld bc,$0000
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            ld bc,$0200
            add a,b
            nop
            ld bc,$0000
L1F8A       ld c,a
            ld ix,$E46C
            ld b,$14
            ld e,$00
            ld h,e
            ld l,e
L1F95       ld a,(ix)
            and a
            jr z,L1FB8
            ld a,(ix+$10)
            and $01
            cp c
            jr nz,L1FAC
            ld a,(ix+$11)
            or (ix+$12)
            jr z,L1FAC
            inc e
L1FAC       push de
            ld de,$0013
            add ix,de
            pop de
            djnz L1F95
            ld a,e
            scf
            ret
L1FB8       push ix
            pop hl
            jr L1FAC
            ld a,d
            ld a,b
            jr c,L1FF1
            ld l,$72
            ld l,a
            ld l,l
            ld a,d
            ld a,b
            jr c,L1FFA
            ld l,$72
            ld l,a
            ld l,l
            ld sp,$3832
            ld l,$72
            ld l,a
            ld l,l
            rst $38
            inc (hl)
            jr c,L2006
            ld (hl),d
            ld l,a
            ld l,l
            rst $38
            ld h,l
            ld l,(hl)
            ld b,c
            ld l,h
            ld (hl),h
            ld e,d
            ld e,b
            ld l,$72
            ld l,a
            ld l,l
            ld sp,$3832
            dec l
            ld ($722E),a
            ld l,a
            ld l,l
            ld h,l
L1FF1       ld l,(hl)
            ld c,(hl)
            ld a,b
            ld (hl),h
            ld l,l
            ld l,l
            ld h,e
            ld l,$72
L1FFA       ld l,a
            ld l,l
            rst $38
            ld c,l
            ld l,a
            ld (hl),l
            ld l,(hl)
            ld (hl),h
            dec a
            ccf
            ccf
            ccf
L2006       dec l
            ccf
            ld l,$3F
            ccf
            ccf
            ld b,h
            ld d,d
            ld d,(hl)
            ld b,e
            ld d,b
            ld c,l
            ld d,b
            inc sp
            ld b,h
            ld b,h
            ld d,e
            ld c,e
            ld d,e
            ld d,a
            ld d,b
            dec l
            ccf
            ld l,$50
            inc sp
            ld d,e
            ld h,l
            ld l,(hl)
            ld d,e
            ld a,c
            ld (hl),e
            ld (hl),h
            ld h,l
            ld l,l
            ld l,$73
            ld a,c
            ld (hl),e
            ld (hl),d
            ld (hl),h
            ld h,e
            ld l,$73
            ld a,c
            ld (hl),e
            rst $28
            ld ($3A63),hl
            cpl
            ld l,(hl)
            ld h,l
            ld a,b
            ld (hl),h
            ld a,d
            ld a,b
            ld l,a
            ld (hl),e
            cpl
            ld h,c
            ld (hl),l
            ld (hl),h
            ld l,a
            ld h,l
            ld a,b
            ld h,l
            ld h,e
            ld l,$31
            ld (hl),e
            ld (hl),h
            ld ($EF0D),hl
            ld ($3A63),hl
            cpl
            ld l,(hl)
            ld h,l
            ld a,b
            ld (hl),h
            ld a,d
            ld a,b
            ld l,a
            ld (hl),e
            cpl
            ld h,c
            ld (hl),l
            ld (hl),h
            ld l,a
            ld h,l
            ld a,b
            ld h,l
            ld h,e
            ld l,$62
            ld h,c
            ld (hl),e
            ld ($630D),hl
            ld a,($6D2F)
            ld h,c
            ld h,e
            ld l,b
            ld l,c
            ld l,(hl)
            ld h,l
            ld (hl),e
            cpl
            ld l,(hl)
            ld h,l
            ld a,b
            ld (hl),h
            cpl
            ld d,b
            ld c,h
            ld d,l
            ld d,e
            ld c,c
            ld b,h
            ld b,l
            ld b,h
            ld c,a
            ld d,e
            jr nz,L20A9
            jr nz,L20AB
            jr nz,L20AD
            ld b,e
            ld l,a
            ld (hl),d
            ld h,l
            jr nz,L20C6
            ld l,$30
            ld sp,$312E
            jr nc,L20BA
            ld l,(hl)
            ld h,l
            ld h,l
            ld h,h
            ld h,l
            ld h,h
            rst $38
            jr nz,L210C
            ld l,(hl)
            halt
            ld h,c
            ld l,h
            ld l,c
            ld h,h
L20A9       rst $38
            ld b,l
L20AB       ld (hl),d
            ld (hl),d
L20AD       ld l,a
            ld (hl),d
            jr nz,L2123
            ld h,l
            ld h,c
            ld h,h
            ld l,c
            ld l,(hl)
            ld h,a
            jr nz,L211F
            ld l,c
L20BA       ld l,h
            ld h,l
            ld a,($FF0D)
            ld d,(hl)
            ld h,l
            ld (hl),d
            ld (hl),e
            ld l,c
            ld l,a
            ld l,(hl)
L20C6       jr nz,L2135
            ld l,c
            ld (hl),e
            ld l,l
            ld h,c
            ld (hl),h
            ld h,e
            ld l,b
            ld a,($300D)
            ld ($3830),a
            jr nz,L213C
            ld l,(hl)
            ld c,(hl)
            ld h,l
            ld a,b
            ld (hl),h
            ld e,d
            ld e,b
            ld l,$72
            ld l,a
            ld l,l
            dec c
            rst $38
L20E4       and $DF
            sub $41
            ccf
            jr nc,L20FA
            cp $10
            jr nc,L20FA
            call L20FD
            push bc
            pop ix
            ld a,(hl)
            inc hl
            or (hl)
            add a,$FF
L20FA       ld a,$16
            ret
L20FD       ld e,a
            ld d,$30
            mul d,e
            add de,$E5E8
            add a,a
            ld hl,$E2A0
            add hl,a
L210C       ld bc,$E2C0
            and a
            ret z
            ld bc,$E32D
            cp $02
            ret z
            ld bc,$E39A
            cp $18
            ret z
            ld b,d
            ld c,e
L211F       ret
            ld a,d
            cp $05
L2123       jr nc,L2153
            ld hl,$E844
            cp $04
            jr z,L2130
L212C       ld a,$41
            and a
            ret
L2130       ld a,(hl)
            and a
            jp m,L212C
L2135       ld a,$3B
            ret nz
            ld a,e
            add a,$41
            ld (hl),a
L213C       add hl,$FFE4
            push hl
            ld a,e
            call L20FD
            ex (sp),hl
            ld d,b
            ld e,c
            push de
            ld bc,$0030
            ldir
            pop de
            pop hl
            jp L21F1
L2153       push bc
            push de
            ld a,e
            call L20FD
            pop de
            ex (sp),hl
            push bc
            push de
            ld b,h
            ld c,l
            ld a,d
            and a
            jp p,L2170
            ld a,$03
            call L232F
            jr c,L218D
L216B       and a
            pop de
            pop de
            pop de
            ret
L2170       ld hl,$F712
            call L00C4
            jr nc,L216B
            ld a,($F722)
            cp $03
            ld a,$09
            jr nz,L216B
            pop af
            push af
            push bc
            call L0740
            pop bc
            jr nc,L216B
            ld hl,$F732
L218D       pop af
            pop de
            push de
            push af
            ld bc,$001C
            ldir
            ex de,hl
            pop bc
            ld a,c
            add a,$41
            ld (hl),a
            inc hl
            ld a,b
            and $7F
            ld (hl),a
            inc hl
            ld b,$0C
L21A4       ld (hl),$00
            inc hl
            djnz L21A4
            ld (hl),$96
            inc hl
            ld (hl),$2E
            inc hl
            ld (hl),$98
            inc hl
            ld (hl),$2E
            inc hl
            ld (hl),$E3
            inc hl
            ld (hl),$2E
            add hl,$FFEC
            ld a,(hl)
            and $30
            add hl,$FFF4
            or (hl)
            ld (ix+$05),a
            add hl,$0005
            ld a,(hl)
            ld (ix+$06),a
            push ix
            pop hl
            push hl
            ld d,c
            ld e,$13
            mul d,e
            add de,$376E
            ld bc,$0013
            rst $08
            inc c
            inc b
            pop de
            pop hl
            push hl
            add hl,$0028
            ld (hl),e
            inc hl
            ld (hl),d
            pop de
            pop hl
L21F1       ld (hl),e
            inc hl
            ld (hl),d
            ex de,hl
            ld de,$F72F
            push de
            ld bc,$000F
            ldir
            add hl,$000B
            ld a,(hl)
            and $40
            inc hl
            or (hl)
            inc hl
            ld (de),a
            inc de
            ldi
            pop hl
            ld bc,$0016
            dec de
            ld a,(de)
            sub $41
            ld d,a
            ld e,c
            mul d,e
            add de,$3870
            ld c,$11
            rst $08
            dec c
            inc b
            scf
            ret
L2224       ld a,$03
L2226       push bc
            ld hl,$F700
            ld de,$F701
            ld bc,$0012
            ld (hl),b
            ldir
            ld ($F700),a
            pop hl
            push hl
L2238       ld a,(hl)
            cp $FF
            jr z,L2251
            inc hl
            cp $2E
            jr nz,L2238
L2242       push hl
L2243       ld a,(hl)
            inc hl
            cp $FF
            jr z,L2250
            cp $2E
            jr nz,L2243
            pop af
            jr L2242
L2250       pop hl
L2251       ld b,$03
L2253       ld a,(hl)
            cp $FF
            jr z,L2265
            inc hl
            cp $61
            jr c,L2267
            cp $7B
            jr nc,L2267
            and $DF
            jr L2267
L2265       ld a,$20
L2267       ld (de),a
            inc de
            djnz L2253
            call L05F4
            pop hl
            ret nc
            push hl
            rst $08
            nop
            ld c,a
            inc bc
            pop hl
            and $0F
            ld c,a
            push bc
            ld c,$01
            ld de,$0002
            call L0106
            pop bc
            ret nc
            push bc
            call L0139
            pop bc
            jr nc,L22AB
            ld ($F70B),hl
            ld ($F70D),de
            push bc
            ld a,b
            ld hl,$F717
            ld de,$0002
            rst $08
            nop
            ld c,a
            inc (hl)
            pop bc
            push af
            ld ($F710),a
            or $80
            ld ($F716),a
            pop af
            ld a,$09
L22AB       push af
            push bc
            push de
            call L0109
            pop de
            pop bc
            pop af
            ret nc
            dec e
            ld a,$4A
            ccf
            ret nz
            ld hl,($F71B)
            ld a,h
            or l
            ld a,$09
            ret z
            dec hl
            ld ($F707),hl
            ld a,c
            ld ($F71B),a
            ld de,($F717)
            ld hl,($F719)
            ld a,($F710)
            bit 1,a
            jr nz,L22E3
            ld e,d
            ld d,l
            ld l,h
            ld h,$00
            srl l
            rr d
            rr e
L22E3       ld ($F701),de
            ld ($F703),hl
            ld ix,$F71C
            ld (ix+$10),$80
            ld bc,$0000
            ld d,b
            ld e,c
            rst $08
            nop
            sub h
            inc de
            ld a,$3C
            ccf
            ret nc
            ld ($F711),hl
            push hl
            ld ix,$F700
            ld hl,$F75F
            ld bc,$0700
            ld d,c
            ld e,c
            call L00AC
            ld hl,$F95F
            ld bc,$0700
            ld de,$0001
            call c,L00AC
            pop de
            ret nc
            ld hl,$F716
            ld bc,$0006
            rst $08
            nop
            inc b
            ld bc,$F75F
            scf
            ret
L232F       push af
            call L23D5
            jr nz,L2374
            pop bc
L2336       ld a,$09
            scf
            ccf
            ret nz
            add hl,$0020
            ld a,(hl)
            cp b
            jr nz,L2336
            add hl,$FFE4
L2347       push hl
            push ix
            call L0605
            pop hl
            pop de
            ret nc
            push de
            push ix
            pop de
            ld bc,$0013
            ldir
            pop hl
            push hl
            add hl,$001B
            set 4,(hl)
            bit 5,(hl)
            pop hl
            scf
            ret nz
            add de,$FFEE
L236A       ld b,$04
L236C       ex de,hl
            inc (hl)
            ex de,hl
            inc de
            ret nz
            djnz L236C
            ret
L2374       pop af
            cp $03
            jr nz,L2336
            ld de,$2409
            call L23F0
            jr z,L2389
            ld de,$2401
            call L23F0
            jr nz,L2336
L2389       add hl,$0031
            ld a,(hl)
            dec a
            jr nz,L2336
            add hl,$00E9
            ld a,(hl)
            and $C0
            jr nz,L23B0
            add hl,$00E6
            ld d,h
            ld e,l
            ld b,$0A
            ld a,(de)
            ld c,a
L23A4       ld a,(de)
            inc de
            cp c
            jr nz,L23B9
            djnz L23A4
            ld hl,$2728
            jr L23B9
L23B0       rlca
            ld hl,$2732
            jr nc,L23B9
            ld hl,$273C
L23B9       push ix
            ld ix,$F72F
            call L2628
            pop ix
            ld hl,$3000
            ld ($F749),hl
            ld h,$80
            ld ($F73A),hl
            ld hl,$F72F
            jp L2347
L23D5       ld h,b
            ld l,c
            ld b,$04
            ld de,$23FD
            call L23F2
            ret nz
            push hl
            ld a,$1F
            ld bc,$02FF
L23E6       add a,(hl)
            inc hl
            dec c
            jr nz,L23E6
            djnz L23E6
            cp (hl)
            pop hl
            ret
L23F0       ld b,$08
L23F2       push hl
L23F3       ld a,(de)
            cp (hl)
            inc de
            inc hl
            jr nz,L23FB
            djnz L23F3
L23FB       pop hl
            ret
            ld d,b
            inc sp
            ld b,h
            ld a,(de)
            ld c,l
            ld d,(hl)
            jr nz,L2432
            jr nz,L244A
            ld d,b
            ld b,e
            ld b,l
            ld e,b
            ld d,h
            ld b,l
            ld c,(hl)
            ld b,h
            ld b,l
            ld b,h
            push ix
            push af
            add a,$41
            push hl
            call L05EA
            pop hl
            pop de
            pop ix
            ret nc
            ld a,d
            add a,$41
            ld b,$00
            ld (hl),b
            inc hl
            ld (hl),b
            ld hl,$E844
            cp (hl)
            jr nz,L242E
            ld (hl),b
L242E       ld l,(ix+$28)
            ld h,(ix+$29)
            ld a,h
            or l
            scf
            ret z
            ld (hl),b
            ret
            add a,$41
            ld d,b
            ld e,c
            ld hl,$E844
            cp (hl)
            ld hl,$27A3
            ld bc,$000A
            jr nz,L2451
L244A       ld a,(hl)
            sub $30
            ldir
            scf
            ret
L2451       push ix
            push de
            sub $41
            call L20FD
            push bc
            pop ix
            ld a,$FF
            bit 4,(ix+$1B)
            jr nz,L249D
            ld e,(ix+$28)
            ld d,(ix+$29)
            push de
            pop ix
            ld a,(ix+$10)
            and $01
            add a,$05
            ld c,(ix+$11)
            ld b,(ix+$12)
            push bc
            push af
            ld hl,$F712
            call L00C4
            pop hl
            pop bc
            pop de
            jr nc,L249E
            ld a,h
            add a,$30
            ld (de),a
            inc de
            ld a,$3E
            ld (de),a
            inc de
            push bc
            ld a,h
            ld hl,$F712
            ld bc,$0010
            ldir
            ex de,hl
            ld (hl),$FF
L249D       pop bc
L249E       pop ix
            scf
            ret
L24A2       push af
            push hl
            ld hl,$2515
            ld de,$E843
            ld bc,$0015
            ldir
            pop hl
            pop af
            push hl
            ld ix,$E828
            ld hl,$250D
            ld de,$E3EF
            ld bc,$0008
            ldir
            pop de
            push af
            ld a,e
            cp $04
            jr c,L24FC
            add a,d
            ld ($E3F1),a
            ld a,d
            ld ($E3F4),a
            pop af
            and a
            jr nz,L24DF
L24D4       ld a,d
            push de
            rst $08
            dec c
            dec l
            ld (hl),$D1
            inc d
            dec e
            jr nz,L24D4
L24DF       ld hl,$E3EF
            call L266A
            ld hl,$E3F1
            ld de,$3E76
            ld bc,$0001
            rst $08
            dec c
            inc b
            bit 7,(ix+$1C)
            scf
            ret z
            inc (ix+$1C)
            ret
L24FC       pop af
            ld l,(ix+$1C)
            push ix
            call L00F4
            pop ix
            ld (ix+$1C),$FF
            scf
            ret
            nop
            nop
            nop
            ld bc,$0002
            inc bc
            nop
            ex af,af'
            nop
            rst $38
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            sub (hl)
            ld l,$96
            ld l,$96
            ld l,$37
            ret
L252C       xor a
            ld b,$01
            sub b
            ld a,$00
            ld b,a
            ld c,a
            ld de,$0101
            ld hl,$0069
            scf
            ret
L253C       ld a,$41
            ld b,$07
            ld hl,$E090
            push hl
            rst $08
            dec c
            and l
            inc (hl)
            pop hl
            ret nc
            push hl
            xor a
            ld b,a
            ld e,$02
L254F       add a,(hl)
            inc hl
            djnz L254F
            dec e
            jr nz,L254F
            pop hl
            xor $03
            ld a,$23
            ret nz
            di
            ld a,$06
            nextreg $54,a
            inc a
            nextreg $55,a
            ld de,$BE00
            ld bc,$0200
            ldir
            nextreg $8E,$3A
            ld sp,$FE00
            ld a,$03
            ld ($5B5C),a
            inc a
            ld ($5B67),a
            call L0E14
            ld hl,$2594
            ld de,$FDFB
            ld bc,$0005
            ldir
            ld bc,$1FFD
            ld a,$07
            jp LFDFB
            out (c),a
            jp LFE10
L2599       ld a,$3A
            and a
            ret
L259D       scf
            ret
L259F       ld hl,$0000
            ret
L25A3       ld a,(ix+$19)
            or $06
            call L25DB
            ld a,e
            add a,(ix+$14)
            ld e,a
            push de
            ld hl,($E419)
            ld a,h
            or l
            call nz,L275C
            ld a,e
            ld ($E40A),a
            ld l,(ix+$0F)
            ld h,e
            ld ($E40B),hl
            ld a,(ix+$17)
            ld ($E40D),a
            ld h,b
            ld l,d
            ld ($E408),hl
            ld a,$09
            ld ($E405),a
            ld hl,$E40E
            ld (hl),$FF
            pop de
            ret
L25DB       ld ($E401),hl
            ld l,a
            ld a,b
            ld ($E400),a
            call L25F4
            ld h,c
            ld ($E406),hl
            ld l,(ix+$15)
            ld h,(ix+$16)
            ld ($E403),hl
            ret
L25F4       ld a,(ix+$11)
            and $7F
            ld b,$00
            ret z
            dec a
            jr nz,L2607
            ld a,d
            rra
            ld d,a
            ld a,b
            rla
            ld b,a
            jr L2613
L2607       ld a,d
            sub (ix+$12)
            jr c,L2613
            sub (ix+$12)
            cpl
            ld d,a
            inc b
L2613       ld a,b
            add a,a
            add a,a
            or c
            ld c,a
            ret
L2619       or a
            jr nz,L261F
            ld hl,$0000
L261F       ld de,($E419)
            ld ($E419),hl
            ex de,hl
            ret
L2628       push hl
            push bc
            ld a,(hl)
            ld b,$41
            dec a
            jr z,L2637
            ld b,$C1
            dec a
            jr z,L2637
            ld b,$01
L2637       ld (ix+$14),b
            inc hl
            ld a,(hl)
            ld (ix+$11),a
            inc hl
            ld a,(hl)
            ld (ix+$12),a
            inc hl
            ld a,(hl)
            ld (ix+$13),a
            inc hl
            ld b,(hl)
            inc hl
            inc hl
            inc hl
            inc hl
            ld a,(hl)
            ld (ix+$17),a
            inc hl
            ld a,(hl)
            ld (ix+$18),a
            ld hl,$0080
            call L2767
            ld (ix+$15),l
            ld (ix+$16),h
            ld (ix+$19),$60
            pop bc
            pop hl
L266A       push bc
            push hl
            ex de,hl
            ld hl,$0004
            add hl,de
            ld a,(hl)
            ld (ix+$0F),a
            push af
            call L275D
            ld (ix+$10),a
            dec hl
            ld l,(hl)
            ld h,$00
            pop bc
            call L2767
            ld (ix),l
            ld (ix+$01),h
            ld hl,$0006
            add hl,de
            ld a,(hl)
            ld (ix+$02),a
            ld c,a
            push hl
            call L275D
            ld (ix+$03),a
            dec hl
            ld e,(hl)
            ld (ix+$0D),e
            ld (ix+$0E),$00
            dec hl
            dec hl
            ld b,(hl)
            dec hl
            ld d,(hl)
            dec hl
            ld a,(hl)
            ld l,d
            ld h,$00
            ld d,h
            and $7F
            jr z,L26B3
            add hl,hl
L26B3       sbc hl,de
            ex de,hl
            ld hl,$0000
L26B9       add hl,de
            djnz L26B9
            ld a,c
            sub (ix+$0F)
            ld b,a
            call L276E
            dec hl
            ld (ix+$05),l
            ld (ix+$06),h
            ld b,$03
            ld a,h
            or a
            jr z,L26D2
            inc b
L26D2       ld a,c
            sub b
            call L275D
            ld (ix+$04),a
            pop de
            push hl
            ld b,$02
            call L276E
            inc hl
            inc hl
            ex (sp),hl
            inc de
            ld a,(de)
            or a
            jr nz,L26F1
            add hl,hl
            ld a,h
            inc a
            cp $02
            jr nc,L26F1
            inc a
L26F1       ld b,a
            ld hl,$0000
L26F5       scf
            rr h
            rr l
            djnz L26F5
            ld (ix+$09),h
            ld (ix+$0A),l
            ld h,$00
            ld l,a
            ld b,c
            inc b
            inc b
            call L2767
            push hl
            dec hl
            ld (ix+$07),l
            ld (ix+$08),h
            ld b,$02
            call L276E
            inc hl
            ld (ix+$0B),l
            ld (ix+$0C),h
            pop hl
            add hl,hl
            add hl,hl
            pop de
            pop bc
            ld a,(bc)
            scf
            pop bc
            ret
            nop
            nop
            jr z,L2735
            ld (bc),a
            ld bc,$0203
            ld hl,($0152)
            nop
            jr z,L273F
            ld (bc),a
            ld (bc),a
            inc bc
            ld (bc),a
            ld hl,($0252)
            nop
            jr z,L2749
            ld (bc),a
            nop
            inc bc
            ld (bc),a
            ld hl,($0352)
            add a,c
            ld d,b
L2749       add hl,bc
            ld (bc),a
            ld bc,$0404
            ld hl,($C552)
            ld c,$01
            call L2778
            pop bc
            and $60
            ret z
            scf
            ret
L275C       jp (hl)
L275D       or a
            ret z
            ld b,a
            ld a,$01
L2762       add a,a
            djnz L2762
            dec a
            ret
L2767       ld a,b
            or a
            ret z
L276A       add hl,hl
            djnz L276A
            ret
L276E       ld a,b
            or a
            ret z
L2771       srl h
            rr l
            djnz L2771
            ret
L2778       ld a,c
            and $01
            ld c,a
            ld a,($E2DB)
            jr z,L2784
            ld a,($E348)
L2784       and $20
            or c
            scf
            ret
L2789       call L25A3
            push de
            push bc
            ld hl,$E400
            rst $08
            inc c
            call z,LC130
            pop de
            inc hl
            ld a,(hl)
            xor c
            scf
            ret z
            xor a
            ret
L279E       rst $08
            inc c
            call z,LC930
            inc (hl)
            ld a,$52
            ld b,c
            ld c,l
            ld h,h
            ld l,c
            ld (hl),e
            ld l,e
            rst $38
L27AD       pop ix
            push hl
            push de
            ld hl,($5C3D)
            push hl
            ld hl,($5B6C)
            push hl
            ld hl,($5C0B)
            push hl
            ld h,$3E
            push hl
            push bc
            ld a,$2F
            call L3F00
            ld b,b
            ld a,($21C1)
            inc de
            nop
            add hl,sp
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
            ld a,(hl)
            inc hl
            ld h,(hl)
            ld l,a
            jp (ix)
L27D7       push hl
            push de
            push bc
            push af
            ld hl,$000B
            add hl,sp
            call L3F00
            ret z
            ld a,($2323)
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
            ld ($5C0B),de
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
            ld ($5B6C),de
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
            ld ($5C3D),de
            add hl,$0004
            pop af
            pop bc
            pop de
            ex (sp),hl
            exx
            pop hl
            pop ix
            ld sp,hl
            exx
            set 7,(iy+$01)
            jp (ix)
L2812       push hl
            call L021D
            pop hl
            ret nc
            ld de,$F700
            call L2867
            call c,L021D
            scf
            ret
L2823       push hl
            push de
            ld de,$F700
            call L286D
            pop hl
            push hl
            push de
            ld de,$FB00
            call c,L286D
            pop hl
            dec hl
            ld a,(hl)
            cp $2F
            jr nz,L2848
            ld (hl),$FF
            ex de,hl
            dec hl
            ld a,(hl)
            cp $7D
            jr nz,L2848
            dec hl
            dec hl
            ld (hl),$FF
L2848       pop de
            pop hl
            push af
            call L0598
            pop bc
            ret nc
            push bc
            ld hl,$FB00
            call L28DD
            pop af
            push hl
            ld a,$03
            call z,L01B1
            pop de
            ld hl,$F700
            call L0598
            scf
            ret
L2867       ld de,$F700
            and a
            jr L2886
L286D       push de
            push hl
            rst $08
            nop
            ld c,a
            inc bc
            rst $08
            nop
            jr L2879
            pop bc
            pop de
L2879       ret nc
            push de
            push bc
            scf
            jp p,L2884
            rst $08
            nop
            inc hl
            inc e
L2884       pop hl
            pop de
L2886       push de
            push af
            push hl
            ld hl,$2907
            ld bc,$0015
            ldir
            pop hl
            push de
            push hl
L2894       ld a,(hl)
            ld (de),a
            inc hl
            inc de
            cp $3A
            jr z,L28A4
            cp $2F
            jr z,L28A4
            cp $5C
            jr nz,L28A6
L28A4       pop bc
            push hl
L28A6       inc a
            jr nz,L2894
            pop hl
            ex (sp),hl
            push hl
            ld a,$01
            call L01B1
            pop hl
            pop de
            jr nc,L28D9
L28B5       ld a,(hl)
            cp $3A
            jr nz,L28BC
            ld (hl),$5F
L28BC       inc hl
            inc a
            jr nz,L28B5
            dec hl
            pop af
            push af
            jr c,L28D8
L28C5       ld a,(de)
            ld (hl),a
            inc hl
            inc de
            inc a
            jr nz,L28C5
            dec hl
            ld (hl),$2E
            inc hl
            ld (hl),$7B
            inc hl
            ld (hl),$7D
            inc hl
            ld (hl),$FF
L28D8       scf
L28D9       ex de,hl
            pop bc
            pop hl
            ret
L28DD       push hl
            inc hl
            inc hl
            inc hl
L28E1       ld a,(hl)
            cp $2F
            jr z,L28F1
            cp $5C
            jr z,L28F1
L28EA       inc hl
            inc a
            jr nz,L28E1
            pop hl
            scf
            ret
L28F1       ld (hl),$FF
            ex (sp),hl
            push hl
            ld a,$02
            call L01B1
            pop hl
            ex (sp),hl
            ld (hl),$2F
            jr c,L28EA
            cp $18
            jr z,L28EA
            pop de
            and a
            ret
            ld b,e
            ld a,($4E2F)
            ld b,l
            ld e,b
            ld d,h
            ld e,d
            ld e,b
            ld c,a
            ld d,e
            cpl
            ld c,l
            ld b,l
            ld d,h
            ld b,c
            ld b,h
            ld b,c
            ld d,h
            ld b,c
            cpl
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
L3CFC       nextreg $8E,$03
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
L3E00       ld ($5B54),bc
            ex (sp),hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ex (sp),hl
            push $3E13
            push bc
L3E0F       ld bc,($5B54)
            nextreg $8E,$00
            ret
L3E18       ld ($5B54),bc
            ex (sp),hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ex (sp),hl
            push $3E13
            push $007B
            push bc
            push $007B
            jp L3E0F
            ld ($5B54),bc
            ex (sp),hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ex (sp),hl
            push $3F13
            push $007B
            push bc
            push $007B
            jp L3F0F
L3E4C       push hl
            push bc
            ld l,$56
            ld bc,$243B
            out (c),l
            inc b
            in l,(c)
            add a,a
            nextreg $56,a
            inc a
            nextreg $57,a
            ld a,l
            srl a
            pop bc
            pop hl
            ret
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
L3F00       ld ($5B54),bc
            ex (sp),hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ex (sp),hl
            push $3F13
            push bc
L3F0F       ld bc,($5B54)
            nextreg $8E,$01
            ret
L3F18       ld ($5B52),hl
            push af
            pop hl
            ld ($5B56),hl
            pop hl
            push de
            ld a,(hl)
            inc hl
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
            ex (sp),hl
            ex de,hl
L3F2A       push hl
            ld h,a
            ld a,i
            ld a,h
            pop hl
            di
L3F31       push af
            push iy
            push af
            xor a
            out ($E3),a
            pop af
            push $0448
            jp L3CFC
            pop iy
            ex (sp),hl
            push af
            bit 2,l
            jr z,L3F49
            ei
L3F49       pop af
            pop hl
            ret
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop

