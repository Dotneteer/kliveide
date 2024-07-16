            di
            xor a
            ld bc,$243B
            jp L3BE8
            ld hl,($5C5D)
            ld ($5C5F),hl
            jr L0053
            jp L15F2
L0013       jp (ix)
            rst $38
            rst $38
            rst $38
            jp L1555
            ld a,(hl)
L001C       call L007D
            ret nc
            jp L155B
            jr L001C
            rst $38
            rst $38
            rst $38
            jp L335B
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
L0030       push bc
            ld hl,($5C61)
            push hl
            jp L169E
            push af
            push hl
            ld hl,($5C78)
            inc hl
            ld ($5C78),hl
            ld a,h
            or l
            jr nz,L0048
            inc (iy+$40)
L0048       push bc
            push de
            call L386E
            pop de
            pop bc
            pop hl
            pop af
            ei
            ret
L0053       pop hl
            ld l,(hl)
            ld (iy),l
            ld sp,($5C3D)
            jp L16C5
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            push af
L0067       add hl,bc
            ld b,h
            ld c,l
            ex de,hl
            pop de
            ldir
            ret
            nop
            nop
            nop
            nop
            nop
L0074       ld hl,($5C5D)
            inc hl
            ld ($5C5D),hl
            ld a,(hl)
            ret
L007D       cp $21
            ret nc
            cp $0D
            ret z
            cp $10
            ret c
            cp $18
            ccf
            ret c
            inc hl
            cp $16
            jr c,L0090
            inc hl
L0090       scf
            ld ($5C5D),hl
            ret
            cp a
            ld d,d
            ld c,(hl)
            call nz,L4E49
            ld c,e
            ld b,l
            ld e,c
            and h
            ld d,b
            ret
            ld b,(hl)
L00A2       adc a,$50
            ld c,a
            ld c,c
            ld c,(hl)
            call nc,L4353
            ld d,d
            ld b,l
            ld b,l
            ld c,(hl)
            and h
            ld b,c
            ld d,h
            ld d,h
            jp nc,LD441
            ld d,h
            ld b,c
            jp nz,L4156
            ld c,h
            and h
            ld b,e
            ld c,a
            ld b,h
            push bc
            ld d,(hl)
            ld b,c
            call z,L454C
            adc a,$53
            ld c,c
            adc a,$43
            ld c,a
            out ($54),a
            ld b,c
            adc a,$41
            ld d,e
            adc a,$41
            ld b,e
            out ($41),a
            ld d,h
            adc a,$4C
            adc a,$45
            ld e,b
            ret nc
            ld c,c
            ld c,(hl)
            call nc,L5153
            jp nc,L4753
            adc a,$41
            ld b,d
            out ($50),a
            ld b,l
            ld b,l
            bit 1,c
            adc a,$55
            ld d,e
            jp nc,L5453
            ld d,d
            and h
            ld b,e
            ld c,b
            ld d,d
            and h
            ld c,(hl)
            ld c,a
            call nc,L4942
            adc a,$4F
            jp nc,L4E41
            call nz,LBD3C
            ld a,$BD
            inc a
            cp (hl)
            ld c,h
            ld c,c
            ld c,(hl)
            push bc
            ld d,h
            ld c,b
            ld b,l
            adc a,$54
            rst $08
            ld d,e
            ld d,h
            ld b,l
            ret nc
            ld b,h
            ld b,l
            ld b,(hl)
            jr nz,L0164
            adc a,$43
            ld b,c
            call nc,L4F46
            ld d,d
            ld c,l
            ld b,c
            call nc,L4F4D
            ld d,(hl)
            push bc
            ld b,l
            ld d,d
            ld b,c
            ld d,e
            push bc
            ld c,a
            ld d,b
            ld b,l
            ld c,(hl)
            jr nz,L00DA
            ld b,e
            ld c,h
            ld c,a
            ld d,e
            ld b,l
            jr nz,L00E1
            ld c,l
            ld b,l
            ld d,d
            ld b,a
            push bc
            ld d,(hl)
            ld b,l
            ld d,d
            ld c,c
            ld b,(hl)
            exx
            ld b,d
            ld b,l
            ld b,l
            ret nc
            ld b,e
            ld c,c
            ld d,d
            ld b,e
            ld c,h
            push bc
            ld c,c
            ld c,(hl)
            bit 2,b
            ld b,c
            ld d,b
            ld b,l
            jp nc,L4C46
            ld b,c
            ld d,e
            ret z
            ld b,d
            ld d,d
            ld c,c
            ld b,a
L0164       ld c,b
            call nc,L4E49
            ld d,(hl)
            ld b,l
            ld d,d
            ld d,e
            push bc
            ld c,a
            ld d,(hl)
            ld b,l
            jp nc,L554F
            call nc,L504C
            ld d,d
            ld c,c
            ld c,(hl)
            call nc,L4C4C
            ld c,c
            ld d,e
            call nc,L5453
            ld c,a
            ret nc
            ld d,d
            ld b,l
            ld b,c
            call nz,L4144
            ld d,h
            pop bc
            ld d,d
            ld b,l
            ld d,e
            ld d,h
            ld c,a
            ld d,d
            push bc
            ld c,(hl)
            ld b,l
            rst $10
            ld b,d
            ld c,a
            ld d,d
            ld b,h
            ld b,l
            jp nc,L4F43
            ld c,(hl)
            ld d,h
            ld c,c
            ld c,(hl)
            ld d,l
            push bc
            ld b,h
            ld c,c
            call L4552
            call L4F46
            jp nc,L4F47
            jr nz,L0204
            rst $08
            ld b,a
            ld c,a
            jr nz,L0208
            ld d,l
            jp nz,L4E49
            ld d,b
            ld d,l
            call nc,L4F4C
            ld b,c
            call nz,L494C
            ld d,e
            call nc,L454C
            call nc,L4150
            ld d,l
            ld d,e
            push bc
            ld c,(hl)
            ld b,l
            ld e,b
            call nc,L4F50
            ld c,e
            push bc
            ld d,b
            ld d,d
            ld c,c
            ld c,(hl)
            call nc,L4C50
            ld c,a
            call nc,L5552
            adc a,$53
            ld b,c
            ld d,(hl)
            push bc
            ld d,d
            ld b,c
            ld c,(hl)
            ld b,h
            ld c,a
            ld c,l
            ld c,c
            ld e,d
            push bc
            ld c,c
            add a,$43
            ld c,h
            out ($44),a
            ld d,d
            ld b,c
            rst $10
            ld b,e
            ld c,h
            ld b,l
            ld b,c
            jp nc,L4552
            ld d,h
            ld d,l
            ld d,d
            adc a,$43
            ld c,a
            ld d,b
L0204       exx
            ld b,d
            ld c,b
            ld e,c
L0208       ld (hl),$35
            ld d,h
            ld b,a
            ld d,(hl)
            ld c,(hl)
            ld c,d
            ld d,l
            scf
            inc (hl)
            ld d,d
            ld b,(hl)
            ld b,e
            ld c,l
            ld c,e
            ld c,c
            jr c,L024D
            ld b,l
            ld b,h
            ld e,b
            ld c,$4C
            ld c,a
            add hl,sp
            ld ($5357),a
            ld e,d
            jr nz,L0234
            ld d,b
            jr nc,L025B
            ld d,c
            ld b,c
            ex (sp),hl
            call nz,LE4E0
            or h
            cp h
            cp l
            cp e
L0234       xor a
            or b
L0236       or c
            ret nz
            and a
            and (hl)
            cp (hl)
            xor l
            or d
            cp d
            push hl
            and l
            jp nz,LB3E1
            cp c
            pop bc
            cp b
            ld a,(hl)
            call c,L5CDA
            or a
            ld a,e
            ld a,l
L024D       ret c
            cp a
            xor (hl)
            xor d
            xor e
            sbc a,$DF
            ld a,a
            or l
            sub $7C
            push de
            ld e,l
L025B       in a,($B6)
            exx
            ld e,e
            rst $10
            inc c
            rlca
            ld b,$04
            dec b
            ex af,af'
            ld a,(bc)
            dec bc
            add hl,bc
            rrca
            jp po,L3F2A
            call LCCC8
            bit 3,(hl)
            xor h
            dec l
            dec hl
            dec a
            ld l,$2C
            dec sp
            ld ($3CC7),hl
            jp LC53E
            cpl
            ret
            ld h,b
            add a,$3A
            ret nc
            adc a,$A8
            jp z,LD4D3
            pop de
            jp nc,LCFA9
L028E       ld l,$2F
            ld de,$FFFF
            ld bc,$FEFE
L0296       in a,(c)
            cpl
            and $1F
            jr z,L02AB
            ld h,a
            ld a,l
L029F       inc d
            ret nz
L02A1       sub $08
            srl h
            jr nc,L02A1
            ld d,e
            ld e,a
            jr nz,L029F
L02AB       dec l
            rlc b
            jr c,L0296
            ld a,d
            inc a
            ret z
            cp $28
            ret z
            cp $19
            ret z
            ld a,e
            ld e,d
            ld d,a
            cp $18
            ret
L02BF       call L028E
            ret nz
            ld hl,$5C00
L02C6       bit 7,(hl)
            jr nz,L02D1
            inc hl
            dec (hl)
            dec hl
            jr nz,L02D1
            ld (hl),$FF
L02D1       ld a,l
            ld hl,$5C04
            cp l
            jr nz,L02C6
            call L031E
            ret nc
            ld hl,$5C00
            cp (hl)
            jr z,L0310
            ex de,hl
            ld hl,$5C04
            cp (hl)
            jr z,L0310
            bit 7,(hl)
            jr nz,L02F1
            ex de,hl
            bit 7,(hl)
            ret z
L02F1       ld e,a
            ld (hl),a
            inc hl
            ld (hl),$05
            inc hl
            ld a,($5C09)
            ld (hl),a
            inc hl
            ld c,(iy+$07)
            ld d,(iy+$01)
            push hl
            call L0333
            pop hl
            ld (hl),a
L0308       ld ($5C08),a
            set 5,(iy+$01)
            ret
L0310       inc hl
            ld (hl),$05
            inc hl
            dec (hl)
            ret nz
            ld a,($5C0A)
            ld (hl),a
            inc hl
            ld a,(hl)
            jr L0308
L031E       ld b,d
            ld d,$00
            ld a,e
            cp $27
            ret nc
            cp $18
            jr nz,L032C
            bit 7,b
            ret nz
L032C       ld hl,$0205
            add hl,de
            ld a,(hl)
            scf
            ret
L0333       ld a,e
            cp $3A
            jr c,L0367
            dec c
            jp m,L034F
            jr z,L0341
            add a,$4F
            ret
L0341       ld hl,$01EB
            inc b
            jr z,L034A
            ld hl,$0205
L034A       ld d,$00
            add hl,de
            ld a,(hl)
            ret
L034F       ld hl,$0229
            bit 0,b
            jr z,L034A
            bit 3,d
            jr z,L0364
            bit 3,(iy+$30)
            ret nz
            inc b
            ret nz
            add a,$20
            ret
L0364       add a,$A5
            ret
L0367       cp $30
            ret c
            dec c
            jp m,L039D
            jr nz,L0389
            ld hl,$0254
            bit 5,b
            jr z,L034A
            cp $38
            jr nc,L0382
            sub $20
            inc b
            ret z
            add a,$08
            ret
L0382       sub $36
            inc b
            ret z
            add a,$FE
            ret
L0389       ld hl,$0230
            cp $39
            jr z,L034A
            cp $30
            jr z,L034A
            and $07
            add a,$80
            inc b
            ret z
            xor $0F
            ret
L039D       inc b
            ret z
            bit 5,b
            ld hl,$0230
            jr nz,L034A
            sub $10
            cp $22
            jr z,L03B2
            cp $20
            ret nz
            ld a,$5F
            ret
L03B2       ld a,$40
            ret
L03B5       di
            ld a,l
            srl l
            srl l
            cpl
            and $03
            ld c,a
            ld b,$00
L03C1       ld ix,$03D1
            add ix,bc
            ld a,($5C48)
            and $38
            rrca
            rrca
            rrca
            or $08
            nop
            nop
            nop
            inc b
            inc c
L03D6       dec c
            jr nz,L03D6
            ld c,$3F
            dec b
            jp nz,L03D6
            xor $10
            out ($FE),a
            ld b,h
            ld c,a
            bit 4,a
            jr nz,L03F2
            ld a,d
            or e
            jr z,L03F6
            ld a,c
            ld c,l
            dec de
            jp (ix)
L03F2       ld c,l
            inc c
            jp (ix)
L03F6       ei
            ret
            rst $28
            ld sp,$C027
            inc bc
            inc (hl)
            call pe,L986C
            rra
            push af
            inc b
            and c
            rrca
            jr c,L0429
            sub d
            ld e,h
            ld a,(hl)
            and a
            jr nz,L046C
            inc hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            ld a,b
            rla
            sbc a,a
            cp c
            jr nz,L046C
            inc hl
            cp (hl)
            jr nz,L046C
            ld a,b
            add a,$3C
            jp p,L0425
            jp po,L046C
L0425       ld b,$FA
L0427       inc b
            sub $0C
            jr nc,L0427
            add a,$0C
            push bc
            ld hl,$046E
            call L3406
            call L33B4
            rst $28
            inc b
            jr c,L042D
            add a,(hl)
            ld (hl),a
            rst $28
            ret nz
            ld (bc),a
            ld sp,$CD38
            sub h
            ld e,$FE
            dec bc
            jr nc,L046C
            rst $28
            ret po
            inc b
            ret po
            inc (hl)
            add a,b
            ld b,e
            ld d,l
            sbc a,a
            add a,b
            ld bc,$3405
            dec (hl)
            ld (hl),c
            inc bc
            jr c,L0429
            sbc a,c
            ld e,$C5
            call L1E99
            pop hl
            ld d,b
            ld e,c
            ld a,d
            or e
            ret z
            dec de
            jp L03B5
L046C       rst $08
            ld a,(bc)
            adc a,c
            ld (bc),a
            ret nc
            ld (de),a
            add a,(hl)
            adc a,c
            ld a,(bc)
            sub a
            ld h,b
            ld (hl),l
            adc a,c
            ld (de),a
            push de
            rla
            rra
            adc a,c
            dec de
            sub b
            ld b,c
            ld (bc),a
            adc a,c
            inc h
            ret nc
            ld d,e
            jp z,L2E89
            sbc a,l
            ld (hl),$B1
            adc a,c
            jr c,L048E
            ld c,c
            ld a,$89
            ld b,e
            rst $38
            ld l,d
            ld (hl),e
            adc a,c
            ld c,a
            and a
            nop
            ld d,h
            adc a,c
            ld e,h
            nop
            nop
            nop
            adc a,c
            ld l,c
            inc d
            or $24
            adc a,c
            halt
            pop af
            djnz L04AF
L04AA       ld bc,$3E75
            call L32C5
            jp nz,L0554
            rst $08
            inc c
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            ld hl,$053F
            push hl
            ld hl,$1F80
            bit 7,a
            jr z,L04D0
            ld hl,$0C98
L04D0       ex af,af'
            inc de
            dec ix
            di
            ld a,$02
            ld b,a
L04D8       djnz L04D8
            out ($FE),a
            xor $0F
            ld b,$A4
            dec l
            jr nz,L04D8
            dec b
L04E4       dec h
L04E5       jp p,L04D8
            ld b,$2F
L04EA       djnz L04EA
            out ($FE),a
            ld a,$0D
            ld b,$37
L04F2       djnz L04F2
            out ($FE),a
            ld bc,$3B0E
            ex af,af'
            ld l,a
            jp L0507
L04FE       ld a,d
            or e
            jr z,L050E
            ld l,(ix)
L0505       ld a,h
            xor l
L0507       ld h,a
            ld a,$01
            scf
            jp L0525
L050E       ld l,h
            jr L0505
L0511       ld a,c
            bit 7,b
L0514       djnz L0514
            jr nc,L051C
            ld b,$42
L051A       djnz L051A
L051C       out ($FE),a
            ld b,$3E
            jr nz,L0511
            dec b
            xor a
            inc a
L0525       rl l
            jp nz,L0514
            dec de
            inc ix
            ld b,$31
            ld a,$7F
            in a,($FE)
            rra
            ret nc
            ld a,d
            inc a
            jp nz,L04FE
            ld b,$3B
L053C       djnz L053C
            ret
            push af
            ld a,($5C48)
            and $38
            rrca
            rrca
            rrca
            out ($FE),a
            ld a,$7F
            in a,($FE)
            rra
            ei
            jp nc,L04AA
            nop
L0554       pop af
            ret
            inc d
            ex af,af'
            dec d
            di
            ld a,$0F
            out ($FE),a
            ld hl,$053F
            push hl
            in a,($FE)
            rra
            and $20
            or $02
            ld c,a
            cp a
L056B       ret nz
L056C       call L05E7
            jr nc,L056B
            ld hl,$0415
L0574       djnz L0574
            dec hl
            ld a,h
            or l
            jr nz,L0574
            call L05E3
            jr nc,L056B
L0580       ld b,$9C
            call L05E3
            jr nc,L056B
            ld a,$C6
            cp b
            jr nc,L056C
            inc h
            jr nz,L0580
L058F       ld b,$C9
            call L05E7
            jr nc,L056B
            ld a,b
            cp $D4
            jr nc,L058F
            call L05E7
            ret nc
            ld a,c
            xor $03
            ld c,a
            ld h,$00
            ld b,$B0
            jr L05C8
L05A9       ex af,af'
            jr nz,L05B3
            jr nc,L05BD
            ld (ix),l
            jr L05C2
L05B3       rl c
            xor l
            ret nz
            ld a,c
            rra
            ld c,a
            inc de
            jr L05C4
L05BD       ld a,(ix)
            xor l
            ret nz
L05C2       inc ix
L05C4       dec de
            ex af,af'
            ld b,$B2
L05C8       ld l,$01
L05CA       call L05E3
            ret nc
            ld a,$CB
            cp b
            rl l
            ld b,$B0
            jp nc,L05CA
            ld a,h
            xor l
            ld h,a
            ld a,d
            or e
            jr nz,L05A9
            ld a,h
            cp $01
            ret
L05E3       call L05E7
            ret nc
L05E7       ld a,$16
L05E9       dec a
            jr nz,L05E9
            and a
L05ED       inc b
            ret z
            ld a,$7F
            in a,($FE)
            rra
            ret nc
            xor c
            and $20
            jr z,L05ED
            ld a,c
            cpl
            ld c,a
            and $07
            or $08
            out ($FE),a
            scf
            ret
L0605       ld bc,$2400
            ld a,$87
            jp L26EC
L060D       ld bc,$284F
            ld a,$87
            jp L26EC
            nop
            nop
            nop
            nop
            nop
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            nop
            ex af,af'
            or e
            dec h
            adc a,d
            inc e
            adc a,l
            ld h,$8A
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            ret pe
            dec h
            adc a,d
            inc e
            adc a,d
            inc e
            xor a
            dec h
            adc a,d
            inc e
            ld sp,$8D2A
            ld h,$8A
            inc e
            adc a,l
            ld h,$8D
            ld h,$8D
            ld h,$8D
            ld h,$8D
            ld h,$8D
            ld h,$8D
            ld h,$8D
            ld h,$8D
            ld h,$8D
            ld h,$8A
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,l
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
L06AB       ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$8A
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            ret
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$C9
            ld h,$B8
            ld a,($25A5)
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            ld e,l
            dec e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            ld (bc),a
            ld a,($0805)
            adc a,d
            inc e
            dec b
            ex af,af'
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            ld e,d
            djnz L06AB
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            ld d,e
            add hl,sp
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            ld a,(hl)
            add hl,sp
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            ret m
            dec h
            ld d,c
            ld h,$44
            ld h,$98
            ex af,af'
            add a,a
            ex af,af'
            ld (hl),h
            ex af,af'
            ld a,(hl)
            ex af,af'
            adc a,d
            inc e
            adc a,d
            inc e
            scf
            ld hl,($0816)
            ld d,$08
            ld d,$08
            ld hl,($2A08)
            ex af,af'
            ld hl,($2A08)
            ex af,af'
            ld hl,($2A08)
            ex af,af'
            ld hl,($2A08)
            ex af,af'
            ld hl,($2A08)
            ex af,af'
            ld hl,($2A08)
            ex af,af'
            ld hl,($2408)
            ex af,af'
            or e
            rla
            ld a,(de)
            ex af,af'
            jr nz,L078E
            inc (hl)
            ex af,af'
            adc a,l
            ld h,$8A
            inc e
            adc a,d
            inc e
L078E       adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            add hl,sp
            ex af,af'
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            and l
            ex af,af'
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            ld (de),a
            ex af,af'
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            add hl,bc
            ex af,af'
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            adc a,d
            inc e
            ld bc,$04F2
            jr L082F
            add a,$69
            jr L082C
            ld c,$F5
            rst $20
            cp $23
            jr z,L082D
            rst $08
            dec bc
            ld c,$F8
            jr L082D
            add a,$ED
            jr L082C
            call L27D4
            jp c,L0970
            add a,$AD
            jr L082C
            call L27D4
            jp c,L20C1
            add a,$2D
L082C       ld c,a
L082D       ld b,$10
L082F       push bc
            rst $20
            jp L2504
            ld bc,$04F0
            jr L082F
            call L2530
            jr z,L0871
            ld hl,($5C57)
            ld a,($5B78)
            push af
            push hl
            ld hl,($5C5F)
            push hl
            ld hl,$34EF
            call L32CD
            push af
            call c,L2BF1
            pop af
            ld bc,$0000
            jr nc,L0862
            inc bc
            bit 6,(iy+$01)
            jr nz,L0862
            inc bc
L0862       call L2D2F
            pop hl
            ld ($5C5F),hl
            pop hl
            pop af
            ld ($5B78),a
            ld ($5C57),hl
L0871       jp L264D
            call L2522
            call nz,L2535
            rst $20
            jp L25DB
            call L2522
            call nz,L2580
            rst $20
            jr L0895
            rst $20
            cp $23
            ld c,$F4
            jr z,L082D
            call L2523
            call nz,L22CB
            rst $20
L0895       jp L26C3
L0898       ld a,($5B77)
            ld d,a
L089C       ld hl,$232E
            call L32CD
            jp L2712
            rst $20
            cp $23
            ld c,$F6
            jr z,L082D
            cp $28
L08AE       jp nz,L11F2
            rst $20
            call L28B3
            jp c,L1C2E
            jr nz,L08AE
            push hl
            push bc
            rst $20
            cp $29
            jr nz,L08AE
            rst $20
            cp $2C
            ld a,$3A
            call z,L155E
            call L1CE2
            rst $18
            cp $29
            jr nz,L08AE
            rst $20
            pop bc
            pop hl
            call L2530
            jr z,L0895
            push hl
            push bc
            call L1E94
            pop hl
            bit 7,h
            pop hl
            inc hl
            ld c,$01
            jr z,L08EB
            inc hl
            inc hl
            ld c,(hl)
            inc hl
L08EB       and a
            jr z,L08F9
            dec a
            cp c
            jp nc,L2A25
            add a,a
            add hl,a
            ld c,(hl)
            inc hl
            ld b,(hl)
L08F9       jp L217E
L08FC       ex af,af'
            bit 5,h
            jr nz,L0911
            dec a
            nextreg $51,a
            inc a
            ex af,af'
            set 5,h
            ld a,(hl)
            res 5,h
L090C       nextreg $51,$FF
            ret
L0911       nextreg $51,a
            ex af,af'
            ld a,(hl)
            jr L090C
L0918       ld hl,$5C92
            push hl
            ld (hl),$2A
            inc hl
            ld (hl),e
            inc hl
            ld (hl),d
            inc hl
            ld (hl),$C9
            ret
            rst $28
            ret nz
            ld (bc),a
            ld sp,$E01E
            inc b
            jr c,L08FC
            and d
            dec l
            jp c,L1E9F
            ex af,af'
            exx
            call L2BF1
            ex de,hl
            ld d,b
            ld e,c
            ex af,af'
            jr z,L0941
            add hl,bc
            dec hl
L0941       exx
            ex af,af'
            rst $30
            call L2AB2
L0947       ld a,b
            or c
            jp z,L35BF
            exx
            ld a,d
            or e
            jr nz,L095F
            ex af,af'
            ld d,b
            ld e,c
            jr z,L0959
            add hl,bc
            jr L0960
L0959       ex af,af'
            sbc hl,bc
            ex af,af'
            jr L0960
L095F       ex af,af'
L0960       ld a,(hl)
            inc hl
            dec de
            jr z,L0967
            dec hl
            dec hl
L0967       exx
            ld (de),a
            inc de
            dec bc
            ex af,af'
            jr L0947
            rst $38
            ret
L0970       ld ix,$361F
            jp z,L179D
            bit 6,(hl)
            jp z,L1C8A
            call L1C82
            cp $2C
            ld a,$3A
            call z,L155E
            call L1CE2
            rst $18
            cp $29
            jp nz,L1C8A
            rst $20
            call L2530
            jp z,L25DB
            call L1E94
            push af
            call L1E94
            cp $25
            jp nc,L24F9
            cp $02
            jp c,L24F9
            call L2D28
            rst $28
            pop bc
            ld (bc),a
            jp LC42A
            daa
            ld sp,$01E4
            inc bc
            ld bc,$C338
            call LFF1D
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            xor (hl)
            dec c
            ld d,b
            ld (hl),d
            ld l,a
            ld h,a
            ld (hl),d
            ld h,c
            ld l,l
            ld a,($0DA0)
            ld c,(hl)
            ld (hl),l
            ld l,l
            ld h,d
            ld h,l
            ld (hl),d
            jr nz,L0A35
            ld (hl),d
            ld (hl),d
            ld h,c
            ld a,c
            ld a,($0DA0)
            ld b,e
            ld l,b
            ld h,c
            ld (hl),d
            ld h,c
            ld h,e
            ld (hl),h
            ld h,l
            ld (hl),d
            jr nz,L0A47
            ld (hl),d
            ld (hl),d
            ld h,c
            ld a,c
            ld a,($0DA0)
            ld b,d
            ld a,c
            ld (hl),h
            ld h,l
            ld (hl),e
            ld a,($CDA0)
            inc bc
            dec bc
            cp $20
            jp nc,L0AD9
            cp $06
            jr c,L0A69
            cp $18
            jr nc,L0A69
            ld hl,$0A0B
            ld e,a
            ld d,$00
            add hl,de
            ld e,(hl)
            add hl,de
            push hl
            jp L0B03
            ld c,(hl)
            ld d,a
            djnz L0A3E
            ld d,h
            ld d,e
            ld d,d
            scf
            ld d,b
            ld c,a
            ld e,a
            ld e,(hl)
            ld e,l
            ld e,h
            ld e,e
            ld e,d
            ld d,h
            ld d,e
            inc c
            ld a,$22
            cp c
            jr nz,L0A3A
            bit 1,(iy+$01)
            jr nz,L0A38
            inc b
            ld c,$02
            ld a,$19
            cp b
L0A35       jr nz,L0A3A
            dec b
L0A38       ld c,$21
L0A3A       jp L0DD9
            ld a,($5C91)
            push af
            ld (iy+$57),$01
            ld a,$20
L0A47       call L0AD9
            pop af
            ld ($5C91),a
            ret
            bit 1,(iy+$01)
            jp nz,L0ECD
            ld c,$21
            call L0C55
            dec b
            jp L0DD9
            call L0B03
            ld a,c
            dec a
            dec a
            and $10
            jr L0AC3
L0A69       ld a,$3F
            jr L0AD9
            ld de,$0A87
            ld ($5C0F),a
            jr L0A80
            ld de,$0A6D
            jr L0A7D
            ld de,$0A87
L0A7D       ld ($5C0E),a
L0A80       ld hl,($5C51)
            ld (hl),e
            inc hl
            ld (hl),d
            ret
            ld de,$09F4
            call L0A80
            ld hl,($5C0E)
            ld d,a
            ld a,l
            cp $16
            jp c,L2211
            jr nz,L0AC2
            ld b,h
            ld c,d
            ld a,$1F
            sub c
            jr c,L0AAC
            add a,$02
            ld c,a
            bit 1,(iy+$01)
            jr nz,L0ABF
            ld a,$16
            sub b
L0AAC       jp c,L1E9F
            inc a
            ld b,a
            inc b
            bit 0,(iy+$02)
            jp nz,L0C55
            cp (iy+$31)
            jp c,L0C86
L0ABF       jp L0DD9
L0AC2       ld a,h
L0AC3       call L0B03
            add a,c
            dec a
            and $1F
            ret z
            ld d,a
            set 0,(iy+$01)
L0AD0       ld a,$20
            call L0C3B
            dec d
            jr nz,L0AD0
            ret
L0AD9       call L0B24
L0ADC       bit 1,(iy+$01)
            jr nz,L0AFC
            bit 0,(iy+$02)
            jr nz,L0AF0
            ld ($5C88),bc
            ld ($5C84),hl
            ret
L0AF0       ld ($5C8A),bc
            ld ($5C82),bc
            ld ($5C86),hl
            ret
L0AFC       ld (iy+$45),c
            ld ($5C80),hl
            ret
L0B03       bit 1,(iy+$01)
            jr nz,L0B1D
            ld bc,($5C88)
            ld hl,($5C84)
            bit 0,(iy+$02)
            ret z
            ld bc,($5C8A)
            ld hl,($5C86)
            ret
L0B1D       ld c,(iy+$45)
            ld hl,($5C80)
            ret
L0B24       cp $80
            jr c,L0B65
            cp $90
            jr nc,L0B52
            ld b,a
            call L0B38
            call L0B03
            ld de,$5C92
            jr L0B7F
L0B38       ld hl,$5C92
            call L0B3E
L0B3E       rr b
            sbc a,a
            and $0F
            ld c,a
            rr b
            sbc a,a
            and $F0
            or c
            ld c,$04
L0B4C       ld (hl),a
            inc hl
            dec c
            jr nz,L0B4C
            ret
L0B52       jp L387E
            nop
L0B56       add a,$15
            push bc
            ld bc,($5C7B)
            jr L0B6A
L0B5F       call L0C10
            jp L0B03
L0B65       push bc
            ld bc,($5C36)
L0B6A       ex de,hl
            ld hl,$5C3B
            res 0,(hl)
            cp $20
            jr nz,L0B76
            set 0,(hl)
L0B76       ld h,$00
            ld l,a
            add hl,hl
            add hl,hl
            add hl,hl
            add hl,bc
            pop bc
            ex de,hl
L0B7F       ld a,c
            dec a
            ld a,$21
            jr nz,L0B93
            dec b
            ld c,a
            bit 1,(iy+$01)
            jr z,L0B93
            push de
            call L0ECD
            pop de
            ld a,c
L0B93       cp c
            push de
            call z,L0C55
            pop de
            push bc
            push hl
            ld a,($5C91)
            ld b,$FF
            rra
            jr c,L0BA4
            inc b
L0BA4       rra
            rra
            sbc a,a
            ld c,a
            ld a,$08
            and a
            bit 1,(iy+$01)
            jr z,L0BB6
            set 1,(iy+$30)
            scf
L0BB6       ex de,hl
L0BB7       ex af,af'
            ld a,(de)
            and b
            xor (hl)
            xor c
            ld (de),a
            ex af,af'
            jr c,L0BD3
            inc d
L0BC1       inc hl
            dec a
            jr nz,L0BB7
            ex de,hl
            dec h
            bit 1,(iy+$01)
            call z,L0BDB
            pop hl
            pop bc
            dec c
            inc hl
            ret
L0BD3       ex af,af'
            ld a,$20
            add a,e
            ld e,a
            ex af,af'
            jr L0BC1
L0BDB       ld a,h
            rrca
            rrca
            rrca
            and $03
            or $58
            ld h,a
            ld de,($5C8F)
            ld a,(hl)
            xor e
            and d
            xor e
            bit 6,(iy+$57)
            jr z,L0BFA
            and $C7
            bit 2,a
            jr nz,L0BFA
            xor $38
L0BFA       bit 4,(iy+$57)
            jr z,L0C08
            and $F8
            bit 5,a
            jr nz,L0C08
            xor $07
L0C08       ld (hl),a
            ret
L0C0A       push hl
            ld h,$00
            ex (sp),hl
            jr L0C14
L0C10       ld de,$0095
            push af
L0C14       call L0C41
            jr c,L0C22
            ld a,$20
            bit 0,(iy+$01)
            call z,L0C3B
L0C22       ld a,(de)
            and $7F
            call L0C3B
            ld a,(de)
            inc de
            add a,a
            jr nc,L0C22
            pop de
            cp $48
            jr z,L0C35
            cp $82
            ret c
L0C35       ld a,d
            cp $03
            ret c
            ld a,$20
L0C3B       push de
            exx
            rst $10
            exx
            pop de
            ret
L0C41       push af
            ex de,hl
            inc a
L0C44       bit 7,(hl)
            inc hl
            jr z,L0C44
            dec a
            jr nz,L0C44
            ex de,hl
            pop af
            cp $20
            ret c
            ld a,(de)
            sub $41
            ret
L0C55       bit 1,(iy+$01)
            ret nz
            ld de,$0DD9
            push de
            ld a,b
            bit 0,(iy+$02)
            jp nz,L0D02
            cp (iy+$31)
            jr c,L0C86
            ret nz
            jr L0C88
L0C6E       push bc
            push de
            call L15D4
            push af
            exx
            call L0D6E
            exx
            pop af
            pop de
            ld bc,$3E75
            call L32C5
            pop bc
            ret z
            xor a
            ret
            nop
L0C86       rst $08
            inc b
L0C88       dec (iy+$52)
            jr nz,L0CD2
            ld a,$18
            sub b
            ld ($5C8C),a
            ld hl,($5C8F)
            push hl
            ld a,($5C91)
            push af
            ld a,$FD
            call L1601
            xor a
            ld de,$0CF8
            call L0C0A
            nop
            nop
            nop
            nop
            ld hl,$5C3B
            set 3,(hl)
            res 5,(hl)
            exx
            call L0C6E
            exx
            cp $20
            jr z,L0D00
            cp $E2
            jr z,L0D00
            or $20
            cp $6E
            jr z,L0D00
            ld a,$FE
            call L1601
            pop af
            ld ($5C91),a
            pop hl
            ld ($5C8F),hl
L0CD2       call L0DFE
            ld b,(iy+$31)
            inc b
            ld c,$21
            push bc
            call L0E9B
            ld a,h
            rrca
            rrca
            rrca
            and $03
            or $58
            ld h,a
            ld de,$5AE0
            ld a,(de)
            ld c,(hl)
            ld b,$20
            ex de,hl
L0CF0       ld (de),a
            ld (hl),c
            inc de
            inc hl
            djnz L0CF0
            pop bc
            ret
            add a,b
            ld (hl),e
            ld h,e
            ld (hl),d
            ld l,a
            ld l,h
            ld l,h
            cp a
L0D00       rst $08
            inc c
L0D02       cp $02
            jr c,L0C86
            add a,(iy+$31)
            sub $19
            ret nc
            neg
            push bc
            ld b,a
            ld hl,($5C8F)
            push hl
            ld hl,($5C91)
            push hl
            call L0D4D
            ld a,b
L0D1C       push af
            ld hl,$5C6B
            ld b,(hl)
            ld a,b
            inc a
            ld (hl),a
            ld hl,$5C89
            cp (hl)
            jr c,L0D2D
            inc (hl)
            ld b,$18
L0D2D       call L0E00
            pop af
            dec a
            jr nz,L0D1C
            pop hl
            ld (iy+$57),l
            pop hl
            ld ($5C8F),hl
            ld bc,($5C88)
            res 0,(iy+$02)
            call L0DD9
            set 0,(iy+$02)
            pop bc
            ret
L0D4D       xor a
            ld hl,($5C8D)
            bit 0,(iy+$02)
            jr z,L0D5B
            ld h,a
            ld l,(iy+$0E)
L0D5B       ld ($5C8F),hl
            ld hl,$5C91
            jr nz,L0D65
            ld a,(hl)
            rrca
L0D65       xor (hl)
            and $55
            xor (hl)
            ld (hl),a
            ret
            call L0DAF
L0D6E       ld hl,$5C3C
            res 5,(hl)
            set 0,(hl)
            call L0D4D
            ld b,(iy+$31)
            call L0E44
            ld hl,$5AC0
            ld a,($5C8D)
            dec b
            jr L0D8E
L0D87       ld c,$20
L0D89       dec hl
            ld (hl),a
            dec c
            jr nz,L0D89
L0D8E       djnz L0D87
            ld (iy+$31),$02
L0D94       ld a,$FD
            call L1601
            ld hl,($5C51)
            ld de,$09F4
            and a
L0DA0       ld (hl),e
            inc hl
            ld (hl),d
            inc hl
            ld de,$10A8
            ccf
            jr c,L0DA0
            ld bc,$1721
            jr L0DD9
L0DAF       ld hl,$0000
            ld ($5C7D),hl
            res 0,(iy+$30)
            call L0D94
            ld a,$FE
            call L1601
            call L0D4D
            ld b,$18
            call L0E44
            ld hl,($5C51)
            ld de,$09F4
            ld (hl),e
            inc hl
            ld (hl),d
            ld (iy+$52),$01
            ld bc,$1821
L0DD9       ld hl,$5B00
            bit 1,(iy+$01)
            jr nz,L0DF4
            ld a,b
            bit 0,(iy+$02)
            jr z,L0DEE
            add a,(iy+$31)
            sub $18
L0DEE       push bc
            ld b,a
            call L0E9B
            pop bc
L0DF4       ld a,$21
            sub c
            ld e,a
            ld d,$00
            add hl,de
            jp L0ADC
L0DFE       ld b,$17
L0E00       call L0E9B
            ld c,$08
L0E05       push bc
            push hl
            ld a,b
            and $07
            ld a,b
            jr nz,L0E19
L0E0D       ex de,hl
            ld hl,$F8E0
            add hl,de
            ex de,hl
            ld bc,$0020
            dec a
            ldir
L0E19       ex de,hl
            ld hl,$FFE0
            add hl,de
            ex de,hl
            ld b,a
            and $07
            rrca
            rrca
            rrca
            ld c,a
            ld a,b
            ld b,$00
            ldir
            ld b,$07
            add hl,bc
            and $F8
            jr nz,L0E0D
            pop hl
            inc h
            pop bc
            dec c
            jr nz,L0E05
            call L0E88
            ld hl,$FFE0
            add hl,de
            ex de,hl
            ldir
            ld b,$01
L0E44       push bc
            call L0E9B
            ld c,$08
L0E4A       push bc
            push hl
            ld a,b
L0E4D       and $07
            rrca
            rrca
            rrca
            ld c,a
            ld a,b
            ld b,$00
            dec c
            ld d,h
            ld e,l
            ld (hl),$00
            inc de
            ldir
            ld de,$0701
            add hl,de
            dec a
            and $F8
            ld b,a
            jr nz,L0E4D
            pop hl
            inc h
            pop bc
            dec c
            jr nz,L0E4A
            call L0E88
            ld h,d
            ld l,e
            inc de
            ld a,($5C8D)
            bit 0,(iy+$02)
            jr z,L0E80
            ld a,($5C48)
L0E80       ld (hl),a
            dec bc
            ldir
            pop bc
            ld c,$21
            ret
L0E88       ld a,h
            rrca
            rrca
            rrca
            dec a
            or $50
            ld h,a
            ex de,hl
            ld h,c
            ld l,b
            add hl,hl
            add hl,hl
            add hl,hl
            add hl,hl
            add hl,hl
            ld b,h
            ld c,l
            ret
L0E9B       ld a,$18
            sub b
            ld d,a
            rrca
            rrca
            rrca
            and $E0
            ld l,a
            ld a,d
            and $18
            or $40
            ld h,a
            ret
            ld bc,$F650
            rst $08
            sub d
            ret
L0EB2       push hl
            push bc
            call L0EF4
            pop bc
            pop hl
            inc h
            ld a,h
            and $07
            jr nz,L0EC9
            ld a,l
            add a,$20
            ld l,a
            ccf
            sbc a,a
            and $F8
            add a,h
            ld h,a
L0EC9       djnz L0EB2
            jr L0EDA
L0ECD       ld e,a
            sub $A5
            jp nc,L0C10
            ld bc,$FB50
            rst $08
            sub d
            ret
            ld sp,hl
L0EDA       ld a,$04
            out ($FB),a
            ei
L0EDF       ld hl,$5B00
            ld (iy+$46),l
            xor a
            ld b,a
L0EE7       ld (hl),a
            inc hl
            djnz L0EE7
            res 1,(iy+$30)
            ld c,$21
            jp L0DD9
L0EF4       ld a,b
            cp $03
            sbc a,a
            and $02
            out ($FB),a
            ld d,a
L0EFD       call L1F54
            jr c,L0F0C
            ld a,$04
L0F04       out ($FB),a
            ei
            call L0EDF
            rst $08
            inc c
L0F0C       in a,($FB)
            add a,a
            ret m
            jr nc,L0EFD
            ld c,$20
L0F14       ld e,(hl)
            inc hl
            ld b,$08
L0F18       rl d
            rl e
            rr d
L0F1E       in a,($FB)
            rra
            jr nc,L0F1E
            ld a,d
            out ($FB),a
            djnz L0F18
            dec c
            jr nz,L0F14
            ret
            ld hl,($5C3D)
            push hl
L0F30       ld hl,$107F
            push hl
            ld ($5C3D),sp
            call L15D4
            push af
            ld d,$00
            ld e,(iy-$01)
            ld hl,$00C8
            call L03B5
            pop af
            ld hl,$0F38
            push hl
            cp $18
            jr nc,L0F81
            cp $07
            jr c,L0F81
            cp $10
            jr c,L0F92
            ld bc,$0002
            ld d,a
            cp $16
            jr c,L0F6C
            inc bc
            bit 7,(iy+$37)
            jp z,L101E
            call L15D4
            ld e,a
L0F6C       call L15D4
            push de
            ld hl,($5C5B)
            res 0,(iy+$07)
            call L1655
            pop bc
            inc hl
            ld (hl),b
            inc hl
            ld (hl),c
            jr L0F8B
L0F81       res 0,(iy+$07)
            ld hl,($5C5B)
            call L1652
L0F8B       ld (de),a
            inc de
            ld ($5C5B),de
            ret
L0F92       ld e,a
            ld d,$00
            ld hl,$0F99
            add hl,de
            ld e,(hl)
            add hl,de
            push hl
            ld hl,($5C5B)
            ret
            add hl,bc
            ld h,(hl)
            ld l,d
            ld d,b
            or l
            ld (hl),b
            ld a,(hl)
            or d
            or c
            ld hl,($5C49)
            bit 5,(iy+$37)
            jp L1097
L0FB3       cp $28
            ld a,$00
            jr nz,L0FC9
            rst $20
            call L1C82
            cp $29
            jp nz,L11F2
            rst $20
            call L2530
            call nz,L1E94
L0FC9       call L2530
            jp z,L26C3
            cp $04
            jp nc,L24F9
            ld hl,$3140
            add a,a
            add hl,a
            call L2705
            ld h,b
L0FDE       jr z,L0FDE
            ld (bc),a
            jr z,L0FE5
            ld d,$00
L0FE5       and a
            jr nz,L0FEE
            ld a,e
            inc a
            jr nz,L0FEE
            ld e,$64
L0FEE       ld b,d
            ld c,e
            jp L217E
            jr L1001
L0FF5       scf
            jr nz,L0FFE
            push de
            call L1C81
            pop de
            and a
L0FFE       rl d
            ret
L1001       ld (iy),$10
            jr L1024
            call L1031
            jr L1011
            ld a,(hl)
            cp $0D
            ret z
            inc hl
L1011       ld ($5C5B),hl
            ret
            call L1031
            ld bc,$0001
            jp L19E8
L101E       call L15D4
            call L15D4
L1024       pop hl
            pop hl
L1026       pop hl
            ld ($5C3D),hl
            bit 7,(iy)
            ret nz
            ld sp,hl
            ret
L1031       scf
            call L1195
            sbc hl,de
            add hl,de
            inc hl
            pop bc
            ret c
            push bc
            ld b,h
            ld c,l
L103E       ld h,d
            ld l,e
            inc hl
            ld a,(de)
            and $F0
            cp $10
            jr nz,L1051
            inc hl
            ld a,(de)
            sub $17
            adc a,$00
            jr nz,L1051
            inc hl
L1051       and a
            sbc hl,bc
            add hl,bc
            ex de,hl
            jr c,L103E
            ret
            ret
            rst $20
            cp $24
            jp nz,L0FB3
            ld de,$2089
L1063       rst $20
            call L2530
            call nz,L3622
            res 6,(iy+$01)
            jp L2712
            call L1E94
            ld bc,$243B
            out (c),a
            inc b
            in a,(c)
            jp L2D28
            bit 4,(iy+$30)
            jr z,L1026
            ld (iy),$FF
            ld d,$00
            ld e,(iy-$02)
            ld hl,$1A90
            call L03B5
            jp L0F30
L1097       push hl
            call L1190
            dec hl
            call L19E5
            ld ($5C5B),hl
            ld (iy+$07),$00
            pop hl
            ret
            jp L10AF
            nop
            nop
            nop
            nop
L10AF       and a
            bit 5,(iy+$01)
            ret z
            ld a,($5C08)
            res 5,(iy+$01)
            push af
            bit 5,(iy+$02)
            call nz,L0D6E
            pop af
            cp $20
            jr nc,L111B
            cp $10
            jr nc,L10FA
            cp $06
            jr nc,L10DB
            ld b,a
            and $01
            ld c,a
            ld a,b
            rra
            add a,$12
            jr L1105
L10DB       jr nz,L10E6
            ld hl,$5C6A
            ld a,$08
            xor (hl)
            ld (hl),a
            jr L10F4
L10E6       cp $0E
            ret c
            sub $0D
            ld hl,$5C41
            cp (hl)
            ld (hl),a
            jr nz,L10F4
            ld (hl),$00
L10F4       set 3,(iy+$02)
            cp a
            ret
L10FA       ld b,a
            and $07
            ld c,a
            ld a,$10
            bit 3,b
            jr nz,L1105
            inc a
L1105       ld (iy-$2D),c
            ld de,$110D
            jr L1113
            ld a,($5C0D)
            ld de,$10A8
L1113       ld hl,($5C4F)
            inc hl
            inc hl
            ld (hl),e
            inc hl
            ld (hl),d
L111B       scf
            ret
            call L0D4D
            res 3,(iy+$02)
            res 5,(iy+$02)
            ld hl,($5C8A)
            push hl
            ld hl,($5C3D)
            push hl
            ld hl,$1167
            push hl
            ld ($5C3D),sp
            ld hl,($5C82)
            push hl
            scf
            call L1195
            ex de,hl
            call L187D
            ex de,hl
            call L18E1
            ld hl,($5C8A)
            ex (sp),hl
            ex de,hl
            call L0D4D
L1150       ld a,($5C8B)
            sub d
            jr c,L117C
            jr nz,L115E
            ld a,e
            sub (iy+$50)
            jr nc,L117C
L115E       ld a,$20
            push de
            call L09F4
            pop de
            jr L1150
            ld d,$00
            ld e,(iy-$02)
            ld hl,$1A90
            call L03B5
            ld (iy),$FF
            ld de,($5C8A)
            jr L117E
L117C       pop de
            pop hl
L117E       pop hl
            ld ($5C3D),hl
            pop bc
            push de
            call L0DD9
            pop hl
            ld ($5C82),hl
            ld (iy+$26),$00
            ret
L1190       ld hl,($5C61)
            dec hl
            and a
L1195       ld de,($5C61)
            ret c
            ld hl,($5C63)
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
L11A7       ld a,(hl)
            cp $0E
            ld bc,$0006
            call z,L19E8
            ld a,(hl)
            inc hl
            cp $0D
            jr nz,L11A7
            ret
L11B7       dec c
            jr z,L1225
            bit 6,(iy+$01)
            jr z,L11F2
            rst $20
            cp $28
            jr nz,L11F2
            rst $20
            call L2530
            jr nz,L11F4
            call L24FB
            cp $2C
            jr nz,L11F2
            ld de,($5C3B)
            ld d,$01
L11D8       rst $20
            push de
            call L24FB
            pop de
            inc d
            jr z,L11F2
            ld a,($5C3B)
            xor e
            and $40
            jr nz,L11F2
            rst $18
            cp $2C
            jr z,L11D8
            cp $29
            jr z,L1221
L11F2       rst $08
            dec bc
L11F4       call L2DA2
            jr c,L1200
            jr nz,L1200
            inc b
            dec b
            ld b,c
            jr z,L1202
L1200       ld b,$FF
L1202       inc b
            rst $18
            jr L1209
L1206       call L134F
L1209       djnz L1206
            ld ($5C5D),hl
            call L24FB
            cp $29
            jr z,L1221
            rst $20
L1216       ld b,$02
            call L134F
            djnz L1216
            ld ($5C5D),de
L1221       rst $20
            jp L2713
L1225       bit 6,(iy+$01)
            jr nz,L11F2
            ld d,$00
L122D       rst $20
            ld hl,$1347
            ld bc,$0008
            cpir
            jr nz,L1253
            ld e,c
            setae
            or d
            ld d,a
            rra
            jr nc,L122D
            push de
            rst $20
            call L1C8C
            cp $2C
            jr nz,L11F2
            rst $20
            call L1C8C
            cp $29
            jr nz,L11F2
            rst $20
            pop de
L1253       cp $5D
            jr nz,L11F2
            rst $20
            call L2530
            jp z,L2713
            ld a,d
            add a,a
            jr nc,L1264
            or $C0
L1264       push af
            bit 1,a
            jr z,L1284
            call L2BF1
            ld a,b
            and a
            ld a,c
            jr nz,L1282
            push de
            push af
            call L2BF1
            pop af
            pop hl
            inc b
            dec b
            ld b,a
            jr nz,L1282
            ld a,c
            and a
            exx
            jr nz,L1284
L1282       rst $08
            add hl,bc
L1284       call L2BF1
L1287       pop hl
L1288       ld a,b
            or c
            jp z,L25DB
            bit 7,h
            jr z,L129A
            ld a,(de)
            cp $21
            jr nc,L129A
            inc de
            dec bc
            jr L1288
L129A       push de
            bit 6,h
            jr z,L12BD
            ld l,$FF
            bit 5,h
            jr z,L12A7
            ld l,$7F
L12A7       ex de,hl
            add hl,bc
            ex de,hl
            dec de
L12AB       ld a,(de)
            and l
            cp $21
            jr nc,L12BD
            dec de
            dec bc
            ld l,$FF
            res 5,h
            ld a,b
            or c
            jr nz,L12AB
            jr L1287
L12BD       push hl
            rst $30
            pop af
            pop hl
            push de
            push bc
            add hl,bc
            ex de,hl
            add hl,bc
            ex de,hl
            ex af,af'
L12C8       dec de
            dec hl
            ld a,b
            or c
            jr z,L133F
            ld a,(hl)
            ex af,af'
            bit 5,a
            jr z,L12DA
            res 5,a
            ex af,af'
            and $7F
            ex af,af'
L12DA       bit 4,a
            jr z,L12EC
            ex af,af'
            cp $61
            jr c,L12EB
            cp $7B
            jr nc,L12EB
            and $DF
            jr L12FB
L12EB       ex af,af'
L12EC       bit 3,a
            jr z,L12FC
            ex af,af'
            cp $41
            jr c,L12FB
            cp $5B
            jr nc,L12FB
            or $20
L12FB       ex af,af'
L12FC       bit 1,a
            jr z,L1323
            ex af,af'
            exx
            push af
            push hl
            push de
            push bc
            ex de,hl
            ld b,$00
            cpir
            ld a,c
            pop bc
            pop de
            pop hl
            jr nz,L1320
            sub c
            neg
            dec a
            cp b
            jr nc,L1332
            inc sp
            inc sp
            push hl
            add hl,a
            ld a,(hl)
            pop hl
            push af
L1320       pop af
            exx
            ex af,af'
L1323       bit 2,a
            jr z,L132D
            res 2,a
            ex af,af'
            or $80
            ex af,af'
L132D       ex af,af'
            ld (de),a
L132F       dec bc
            jr L12C8
L1332       pop af
            exx
            pop af
            ex (sp),hl
            inc hl
            ex (sp),hl
            push af
            ex (sp),hl
            dec hl
            ex (sp),hl
            inc de
            jr L132F
L133F       pop bc
            pop de
            call L2AB2
            jp L2712
            jr z,L13A7
            dec l
            dec hl
            ld a,(hl)
            ld a,$3C
            ret
L134F       ld d,h
            ld e,l
            ld c,$00
L1353       ld a,(hl)
            inc hl
            cp $22
            jr z,L136E
            cp $0E
            jr z,L1376
            cp $28
            jr z,L137C
            cp $29
            jr z,L1382
            cp $2C
            jr nz,L1353
            inc c
            dec c
            jr nz,L1353
            ret
L136E       ld a,(hl)
            inc hl
            cp $22
            jr nz,L136E
            jr L1353
L1376       add hl,$0005
            jr L1353
L137C       inc c
            jp p,L1353
            rst $08
            rra
L1382       dec c
            jp p,L1353
            ex de,hl
            dec de
            ld b,$01
            ret
            nop
            nop
            nop
            nop
            nop
            nop
            add a,b
            ld c,a
            bit 1,(hl)
            ld b,l
            ld e,b
            ld d,h
            jr nz,L1411
            ld l,c
            ld (hl),h
            ld l,b
            ld l,a
            ld (hl),l
            ld (hl),h
            jr nz,L13E8
            ld c,a
            jp nc,L6156
            ld (hl),d
L13A7       ld l,c
            ld h,c
            ld h,d
            ld l,h
            ld h,l
            jr nz,L141C
            ld l,a
            ld (hl),h
            jr nz,L1418
            ld l,a
            ld (hl),l
            ld l,(hl)
            call po,L7553
            ld h,d
            ld (hl),e
            ld h,e
            ld (hl),d
            ld l,c
            ld (hl),b
            ld (hl),h
            jr nz,L1438
            ld (hl),d
            ld l,a
            ld l,(hl)
            rst $20
            ld c,a
            ld (hl),l
            ld (hl),h
            jr nz,L1439
            ld h,(hl)
            jr nz,L143A
            ld h,l
            ld l,l
            ld l,a
            ld (hl),d
            ld sp,hl
            ld c,a
            ld (hl),l
            ld (hl),h
            jr nz,L1446
            ld h,(hl)
            jr nz,L144D
            ld h,e
            ld (hl),d
            ld h,l
            ld h,l
            xor $4E
            ld (hl),l
            ld l,l
            ld h,d
            ld h,l
            ld (hl),d
            jr nz,L145B
            ld l,a
L13E8       ld l,a
            jr nz,L144D
            ld l,c
            rst $20
            ld d,d
            ld b,l
            ld d,h
            ld d,l
            ld d,d
            ld c,(hl)
            jr nz,L146C
            ld l,c
            ld (hl),h
            ld l,b
            ld l,a
            ld (hl),l
            ld (hl),h
            jr nz,L1444
            ld c,a
            ld d,e
            ld d,l
            jp nz,L6E45
            ld h,h
            jr nz,L1475
            ld h,(hl)
            jr nz,L146F
            ld l,c
            ld l,h
            push hl
            ld d,e
            ld d,h
            ld c,a
            ld d,b
            jr nz,L1485
            ld (hl),h
            ld h,c
            ld (hl),h
            ld h,l
            ld l,l
            ld h,l
L1418       ld l,(hl)
            call p,L6E49
L141C       halt
            ld h,c
            ld l,h
            ld l,c
            ld h,h
            jr nz,L1484
            ld (hl),d
            ld h,a
            ld (hl),l
            ld l,l
            ld h,l
            ld l,(hl)
            call p,L6E49
            ld (hl),h
            ld h,l
            ld h,a
            ld h,l
            ld (hl),d
            jr nz,L14A2
            ld (hl),l
            ld (hl),h
            jr nz,L14A6
            ld h,(hl)
L1438       jr nz,L14AC
L143A       ld h,c
            ld l,(hl)
            ld h,a
            push hl
            ld c,(hl)
            ld l,a
            ld l,(hl)
            ld (hl),e
            ld h,l
            ld l,(hl)
L1444       ld (hl),e
            ld h,l
L1446       jr nz,L14B1
            ld l,(hl)
            jr nz,L148D
            ld b,c
            ld d,e
L144D       ld c,c
            jp L5242
            ld b,l
            ld b,c
            ld c,e
            jr nz,L1483
            jr nz,L149B
            ld c,a
            ld c,(hl)
            ld d,h
L145B       jr nz,L14CF
            ld h,l
            ld (hl),b
            ld h,l
            ld h,c
            ld (hl),h
            di
            ld c,a
            ld (hl),l
            ld (hl),h
            jr nz,L14D7
            ld h,(hl)
            jr nz,L14AF
            ld b,c
L146C       ld d,h
            pop bc
            ld c,c
L146F       ld l,(hl)
            halt
            ld h,c
            ld l,h
            ld l,c
            ld h,h
L1475       jr nz,L14DD
            ld l,c
            ld l,h
            ld h,l
            jr nz,L14EA
            ld h,c
            ld l,l
            push hl
            ld c,(hl)
            ld l,a
            jr nz,L14F5
L1483       ld l,a
L1484       ld l,a
L1485       ld l,l
            jr nz,L14EE
            ld l,a
            ld (hl),d
            jr nz,L14F8
            ld l,c
L148D       ld l,(hl)
            push hl
            ld d,e
            ld d,h
            ld c,a
            ld d,b
            jr nz,L14FE
            ld l,(hl)
            jr nz,L14E1
            ld c,(hl)
            ld d,b
            ld d,l
L149B       call nc,L4F46
            ld d,d
            jr nz,L1518
            ld l,c
L14A2       ld (hl),h
            ld l,b
            ld l,a
            ld (hl),l
L14A6       ld (hl),h
            jr nz,L14F7
            ld b,l
            ld e,b
            call nc,L6E49
            halt
L14AF       ld h,c
            ld l,h
L14B1       ld l,c
            ld h,h
            jr nz,L14FE
            cpl
            ld c,a
            jr nz,L151D
            ld h,l
            halt
            ld l,c
            ld h,e
            push hl
            ld c,c
            ld l,(hl)
            halt
            ld h,c
            ld l,h
            ld l,c
            ld h,h
            jr nz,L152A
            ld l,a
            ld l,h
            ld l,a
            ld (hl),l
            jp p,L5242
            ld b,l
L14CF       ld b,c
            ld c,e
            jr nz,L153C
            ld l,(hl)
            ld (hl),h
            ld l,a
            jr nz,L1548
            ld (hl),d
            ld l,a
            ld h,a
            ld (hl),d
            ld h,c
L14DD       sbc hl,de
            ld b,c
            ld c,l
L14E1       ld d,h
            ld c,a
            ld d,b
            jr nz,L1554
            ld l,a
            jr nz,L1550
            ld l,a
L14EA       ld l,a
            call po,L7453
L14EE       ld h,c
            ld (hl),h
            ld h,l
            ld l,l
            ld h,l
            ld l,(hl)
            ld (hl),h
L14F5       jr nz,L1563
L14F7       ld l,a
L14F8       ld (hl),e
            call p,L6E49
            halt
            ld h,c
L14FE       ld l,h
            ld l,c
            ld h,h
            jr nz,L1576
            ld (hl),h
            ld (hl),d
            ld h,l
            ld h,c
            im 0
            ld c,(hl)
            jr nz,L1583
            ld l,c
            ld (hl),h
            ld l,b
            ld l,a
            ld (hl),l
            ld (hl),h
            jr nz,L1558
            ld b,l
            add a,$50
            ld h,c
L1518       ld (hl),d
            ld h,c
            ld l,l
            ld h,l
            ld (hl),h
L151D       ld h,l
            ld (hl),d
            jr nz,L1586
            ld (hl),d
            ld (hl),d
            ld l,a
            jp p,L6154
            ld (hl),b
            ld h,l
            jr nz,L1597
            ld l,a
            ld h,c
            ld h,h
            ld l,c
            ld l,(hl)
            ld h,a
            jr nz,L1598
            ld (hl),d
            ld (hl),d
            ld l,a
            jp p,LA02C
            ld a,a
            jr nz,L156D
L153C       add hl,sp
            jr c,L1571
            jr nz,L1594
            ld l,c
            ld l,(hl)
            ld h,e
            ld l,h
            ld h,c
            ld l,c
            ld (hl),d
L1548       jr nz,L159C
            ld h,l
            ld (hl),e
            ld h,l
            ld h,c
            ld (hl),d
            ld h,e
L1550       ld l,b
            jr nz,L159F
            ld (hl),h
L1554       call po,L5D2A
            ld e,h
L1558       jp L1562
L155B       ld hl,($5C5D)
L155E       inc hl
L155F       ld ($5C5D),hl
L1562       ld a,(hl)
L1563       cp $21
            ret nc
            cp $0D
            ret z
            inc hl
            cp $18
            jr nc,L155F
            cp $10
            jr c,L155F
            cp $16
            jr c,L155E
L1576       inc hl
            jr L155E
L1579       scf
            inc d
            dec d
            jr z,L1581
            inc h
            dec h
            ret nz
L1581       ld b,d
            ld c,e
L1583       ld d,h
            mul d,e
L1586       inc d
            dec d
            ret nz
            ld a,e
            ld d,b
            ld e,l
            mul d,e
            inc d
            dec d
            ret nz
            add a,e
            ret c
            ld d,l
L1594       ld e,c
            mul d,e
L1597       ld h,a
L1598       ld l,$00
            add hl,de
            ret c
L159C       ld a,h
            or l
            ret
L159F       call L2530
            ret z
            push bc
            push de
            call L1579
            pop de
            pop bc
            ret nc
            jp L1F15
            rst $38
            call p,LA809
            djnz L15FF
            call p,LC409
            dec d
            ld d,e
            add a,c
            rrca
            call nz,L5215
            call LC40E
            dec d
            ld d,b
            add a,b
            rst $08
            ld (de),a
            ld bc,$0600
            nop
            dec bc
            nop
            ld bc,$0100
            nop
            ld b,$00
            djnz L15D4
L15D4       bit 5,(iy+$02)
            jr nz,L15DE
            set 3,(iy+$02)
L15DE       call L15E6
            ret c
            jr z,L15DE
            rst $08
            rlca
L15E6       exx
            push hl
            ld hl,($5C51)
            inc hl
            inc hl
            jr L15F7
L15EF       ld e,$30
            add a,e
L15F2       exx
            push hl
            ld hl,($5C51)
L15F7       ld e,(hl)
            inc hl
            ld d,(hl)
            ex de,hl
            call L162C
            pop hl
L15FF       exx
            ret
L1601       add a,a
            add a,$16
            ld l,a
            ld h,$5C
            ld e,(hl)
            inc hl
            ld d,(hl)
            ld a,d
            or e
            jr nz,L1610
L160E       rst $08
            rla
L1610       dec de
            ld hl,($5C4F)
            add hl,de
L1615       ld ($5C51),hl
            res 4,(iy+$30)
            inc hl
            inc hl
            inc hl
            inc hl
            ld c,(hl)
            ld hl,$162D
            call L16DC
            ret nc
            ld d,$00
            ld e,(hl)
            add hl,de
L162C       jp (hl)
            ld c,e
            ld b,$53
            ld (de),a
            ld d,b
            dec de
            nop
            set 0,(iy+$02)
            res 5,(iy+$01)
            set 4,(iy+$30)
            jr L1646
            res 0,(iy+$02)
L1646       res 1,(iy+$01)
            jp L0D4D
            set 1,(iy+$01)
            ret
L1652       ld bc,$0001
L1655       push hl
            call L1F05
            pop hl
            call L3B86
            ld hl,($5C65)
            ex de,hl
            lddr
            ret
            jp L3B86
L1667       call L2AEE
            ex (sp),hl
            call L159F
            pop bc
            add hl,bc
            inc hl
            ld b,d
            ld c,e
            ex de,hl
            call L2AB1
            rst $18
            cp $29
            jr z,L1684
            cp $2C
            jp nz,L2A25
L1681       call L2A52
L1684       rst $20
L1685       cp $28
            jr z,L1681
            res 6,(iy+$01)
            ret
            rst $38
            nop
            nop
L1691       ex de,hl
            ld de,$168F
L1695       ld a,(hl)
            and $C0
            jr nz,L1691
            ld d,(hl)
            inc hl
            ld e,(hl)
            ret
L169E       ld hl,($5C63)
            dec hl
            call L1655
            inc hl
            inc hl
            pop bc
            ld ($5C61),bc
            pop bc
            ex de,hl
            inc hl
            ret
            ld hl,($5C59)
            ld (hl),$0D
            ld ($5C5B),hl
            inc hl
            ld (hl),$80
            inc hl
            ld ($5C61),hl
            ld hl,($5C61)
            ld ($5C63),hl
L16C5       ld hl,($5C63)
            ld ($5C65),hl
            push hl
            ld hl,$5C92
            ld ($5C68),hl
            pop hl
            ret
            ld de,($5C59)
            jp L19E5
L16DB       inc hl
L16DC       ld a,(hl)
            and a
            ret z
            cp c
            inc hl
            jr nz,L16DB
            scf
            ret
            call L171E
            call L1701
            ld bc,$0000
            ld de,$A3E2
            ex de,hl
            add hl,de
            jr c,L16FC
            ld bc,$15D4
            add hl,bc
            ld c,(hl)
            inc hl
            ld b,(hl)
L16FC       ex de,hl
            ld (hl),c
            inc hl
            ld (hl),b
            ret
L1701       push hl
            ld hl,($5C4F)
            add hl,bc
            inc hl
            inc hl
            inc hl
            ld c,(hl)
            ex de,hl
            ld hl,$1716
            call L16DC
            ld c,(hl)
            ld b,$00
            add hl,bc
            jp (hl)
            ld c,e
            dec b
            ld d,e
            inc bc
            ld d,b
            ld bc,$C9E1
L171E       call L1E94
            cp $10
            jr c,L1727
L1725       rst $08
            rla
L1727       add a,$03
            rlca
            ld hl,$5C10
            ld c,a
            ld b,$00
            add hl,bc
            ld c,(hl)
            inc hl
            ld b,(hl)
            dec hl
            ret
            rst $28
            ld bc,$CD38
            ld e,$17
            ld a,b
            or c
            jr z,L1756
            ex de,hl
            ld hl,($5C4F)
            add hl,bc
            inc hl
            inc hl
            inc hl
            ld a,(hl)
            ex de,hl
            cp $4B
            jr z,L1756
            cp $53
            jr z,L1756
            cp $50
            jr nz,L1725
L1756       call L175D
            ld (hl),e
            inc hl
            ld (hl),d
            ret
L175D       push hl
            call L2BF1
            ld a,b
            or c
            jr nz,L1767
L1765       rst $08
            ld c,$C5
            ld a,(de)
            and $DF
            ld c,a
            ld hl,$177A
            call L16DC
            jr nc,L1765
            ld c,(hl)
            ld b,$00
            add hl,bc
            pop bc
            jp (hl)
            ld c,e
            ld b,$53
            ex af,af'
            ld d,b
            ld a,(bc)
            nop
            ld e,$01
            jr L178B
            ld e,$06
            jr L178B
            ld e,$10
L178B       dec bc
            ld a,b
            or c
            jr nz,L1765
            ld d,a
            pop hl
            ret
L1793       ld a,$FF
            bit 6,(hl)
            set 6,(hl)
            jr z,L17A7
L179B       rst $08
            dec bc
L179D       ld a,$BF
            jr L17A3
L17A1       ld a,$FF
L17A3       bit 6,(hl)
            jr z,L179B
L17A7       and (hl)
            ld (hl),a
            call m,L0013
            jp L2712
L17AF       ld a,d
            and a
            jr L17B5
            scf
            sbc a,a
L17B5       push af
            push de
            call L27D4
            pop de
            jr c,L17E9
            push hl
            rst $20
            cp $24
            pop hl
            jr z,L17D5
            ld ($5C5D),hl
            pop af
            jr nc,L17CF
            ld c,$ED
L17CC       jp L082D
L17CF       ld e,$C0
            ld d,a
            jp L3977
L17D5       call L27D4
            jr c,L17FA
            pop af
            ld c,$77
            jr c,L17CC
            ld e,$24
            ld d,a
            ld bc,$1040
            push de
            jp L082F
L17E9       pop de
            jr nz,L1802
            ld ix,$2188
            bit 6,(hl)
            jr nz,L17A1
            ld ix,$34BC
            jr L1793
L17FA       ld ix,$2184
            pop de
            jr z,L179D
            and a
L1802       push de
            push af
            bit 6,(hl)
            jp z,L1C8A
            call L24FB
            pop af
            ld hl,$5C3B
            bit 6,(hl)
            push af
            jr nz,L181C
            bit 7,(hl)
            call nz,L2BF1
            jr L1821
L181C       bit 7,(hl)
            call nz,L1E99
L1821       push bc
            push de
            bit 7,(iy+$01)
            call nz,L1E99
            push bc
            ld c,$00
L182D       rst $18
            cp $2C
            jr nz,L184B
            rst $20
            bit 4,c
            jp nz,L1C8A
            push bc
            push de
            call L24FB
            pop de
            pop bc
            inc c
            ld a,($5C3B)
            add a,a
            add a,a
            rr d
            rr e
            jr L182D
L184B       cp $29
            jp nz,L1C8A
            rst $20
            ex de,hl
            ld a,c
            exx
            pop hl
            exx
            pop de
            pop bc
            exx
            ld c,a
            pop af
            ld a,c
            pop de
            call L2199
            jp L2712
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
L187D       set 0,(iy+$01)
            push de
            ex de,hl
            res 2,(iy+$30)
            ld hl,$5C3B
            res 2,(hl)
            bit 5,(iy+$37)
            jr z,L1894
            set 2,(hl)
L1894       ld hl,($5C5F)
            and a
            sbc hl,de
            jr nz,L18A1
            ld a,$3F
            call L18C1
L18A1       call L18E1
            ex de,hl
            ld a,(hl)
            call L18B6
            inc hl
            cp $0D
            jr z,L18B4
            ex de,hl
            call L1937
            jr L1894
L18B4       pop de
            ret
L18B6       cp $0E
            ret nz
            inc hl
            inc hl
            inc hl
            inc hl
            inc hl
            inc hl
            ld a,(hl)
            ret
L18C1       exx
            ld hl,($5C8F)
            push hl
            res 7,h
            set 7,l
            ld ($5C8F),hl
            ld hl,$5C91
            ld d,(hl)
            push de
            ld (hl),$00
            call L09F4
            pop hl
            ld (iy+$57),h
            pop hl
            ld ($5C8F),hl
            exx
            ret
L18E1       ld hl,($5C5B)
            and a
            sbc hl,de
            ret nz
            ld a,($5C41)
            rlc a
            jr z,L18F3
            add a,$43
            jr L1909
L18F3       ld hl,$5C3B
            res 3,(hl)
            ld a,$4B
            bit 2,(hl)
            jr z,L1909
            set 3,(hl)
            inc a
            bit 3,(iy+$30)
            jr z,L1909
            ld a,$43
L1909       push de
            call L18C1
            pop de
            ret
            ld e,(hl)
            inc hl
            ld d,(hl)
            push hl
            ex de,hl
            inc hl
            call L196E
            call L1695
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
L1925       ld a,e
            and a
            ret m
            jr L1937
L192A       xor a
L192B       add hl,bc
            inc a
            jr c,L192B
            sbc hl,bc
            dec a
            jr z,L1925
            jp L15EF
L1937       call L2D1B
            jr nc,L196C
            cp $21
            jr c,L196C
            res 2,(iy+$01)
            cp $CB
            jr z,L196C
            cp $3A
            jr nz,L195A
            jr L1968
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
L195A       cp $22
            jr nz,L1968
            push af
            ld a,($5C6A)
            xor $04
            ld ($5C6A),a
            pop af
L1968       set 2,(iy+$01)
L196C       rst $10
            ret
L196E       push hl
            ld hl,($5C53)
            ld d,h
            ld e,l
            pop bc
L1975       call L1980
            ret nc
            push hl
            call L19C6
            pop de
            jr L1975
L1980       ld a,(hl)
            cp b
            ret nz
            inc hl
            ld a,(hl)
            dec hl
            cp c
            ret
            inc hl
            inc hl
            inc hl
L198B       ld ($5C5D),hl
            ld c,$00
L1990       dec d
            ret z
            rst $20
            cp e
            jr nz,L199A
            and a
            ret
L1998       inc hl
            ld a,(hl)
L199A       call L18B6
            ld ($5C5D),hl
            cp $22
            jr nz,L19A5
            dec c
L19A5       cp $3A
            jr z,L19AD
            cp $CB
            jr nz,L19B1
L19AD       bit 0,c
            jr z,L1990
L19B1       cp $0D
            jr nz,L1998
            dec d
            scf
            ret
            push hl
            ld a,$3F
            cp (hl)
            call nc,L19C6
            call c,L1A48
            pop de
            jp L19DD
L19C6       inc hl
            inc hl
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
            add hl,de
            ret
L19CE       push $5B48
            push hl
            jp L5B4D
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
L19DD       and a
            sbc hl,de
            ld b,h
            ld c,l
            add hl,de
            ex de,hl
            ret
L19E5       call L19DD
L19E8       push bc
            ld a,b
            cpl
            ld b,a
            ld a,c
            cpl
            ld c,a
            inc bc
            call L3B86
            ex de,hl
            pop hl
            add hl,de
            push de
            ldir
            pop hl
            ret
            ld hl,($5C59)
            dec hl
            ld ($5C5D),hl
            rst $20
            ld hl,$5C92
            ld ($5C65),hl
            call L2D3B
            call L2DA2
            jr c,L1A15
            ld hl,$D8F0
            add hl,bc
L1A15       jp c,L1C8A
            jp L16C5
L1A1B       push de
            push hl
            xor a
            bit 7,b
            jr nz,L1A42
            ld h,b
            ld l,c
            ld e,$FF
            jr L1A30
            push de
            ld d,(hl)
            inc hl
            ld e,(hl)
            push hl
            ex de,hl
            ld e,$20
L1A30       ld bc,$FC18
            call L192A
            ld bc,$FF9C
            call L192A
            ld c,$F6
            call L192A
            ld a,l
L1A42       call L15EF
            pop hl
            pop de
            ret
L1A48       ld a,(hl)
            cp $7F
            jr z,L1A68
            bit 5,a
            jr z,L1A6E
            add a,a
            jp m,L1A5D
L1A55       inc hl
            ld a,(hl)
            add a,a
            jr nc,L1A55
            add a,a
            add a,a
            ccf
L1A5D       ld de,$0006
            jp nc,L1A73
            ld e,$13
            jp L1A73
L1A68       inc hl
L1A69       inc hl
            bit 7,(hl)
            jr z,L1A69
L1A6E       inc hl
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
L1A73       add hl,de
            ret
L1A75       exx
            push hl
            exx
            pop de
            inc de
L1A7A       inc hl
L1A7B       ld a,(de)
            inc de
            cp $20
            jr z,L1A7B
            or $20
            cp (hl)
            jr z,L1A7A
            or $80
            cp (hl)
            jr z,L1A90
            and $DF
            cp (hl)
            scf
            ret nz
L1A90       ld a,(de)
            inc de
            cp $20
            jr z,L1A90
            jp L2C88
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            call nz,L3BCF
            jp LC53B
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            call LCCCE
            nop
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            ld bc,$3B3B
            add a,$3B
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            cp $3B
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            call m,LC2C1
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            rst $00
            ret z
            ret
            jp z,L3BCB
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
            dec sp
L1B99       jr c,L1BA1
            inc bc
            ld hl,($5C4D)
            lddr
L1BA1       pop de
            call L1BAD
            ex de,hl
            pop bc
            inc hl
            ld (hl),c
            inc hl
            ld (hl),b
            ret
            nop
L1BAD       ld hl,($5C5B)
            ld a,(hl)
            and $1F
            or xh
            ld b,xl
            dec b
            jr z,L1BCE
            ex de,hl
            ld (hl),$7F
            inc hl
            ex de,hl
L1BBF       ld (de),a
L1BC0       inc hl
            ld a,(hl)
            cp $20
            jr z,L1BC0
            or $20
            inc de
            ld (de),a
            djnz L1BC0
            or $80
L1BCE       ld (de),a
            ret
            nop
L1BD1       ld hl,($5C4D)
L1BD4       ld b,$00
            jr L1BE2
L1BD8       inc hl
            ld a,(hl)
            cp $20
            jr z,L1BD8
            call L2C88
            ret nc
L1BE2       djnz L1BD8
            rst $08
            dec bc
            ret
            rst $38
            rst $38
            rst $38
L1BEA       rst $38
            rst $38
            rst $38
            rst $38
L1BEE       call L2530
            ret nz
            pop bc
            pop hl
            pop bc
            push $0956
            jp (hl)
L1BFA       ld ($5B8C),de
            jr L1C22
            rst $38
            rrca
            dec e
            ld c,e
            add hl,bc
            ld h,a
            dec bc
            ld a,e
            adc a,(hl)
            ld (hl),c
            or h
            add a,c
            rst $08
            call L1CDE
            cp a
            pop bc
            call z,L1BEE
            ex de,hl
            ld hl,($5C74)
            ld c,(hl)
            inc hl
            ld b,(hl)
            ex de,hl
            push bc
            ret
            call L28B2
L1C22       ld (iy+$37),$00
            jr nc,L1C30
            set 1,(iy+$37)
            jr nz,L1C46
L1C2E       rst $08
            ld bc,$96CC
            add hl,hl
            bit 6,(iy+$01)
            jr nz,L1C4A
            xor a
            call L2530
            call nz,L2BF1
            ld hl,$5C71
            or (hl)
            ld (hl),a
            ex de,hl
L1C46       ld ($5C72),bc
L1C4A       ld ($5C4D),hl
            ret
            pop bc
            call L1C56
            call L1BEE
            ret
L1C56       ld a,($5C3B)
            push af
            call L24FB
            pop af
            ld d,(iy+$01)
            xor d
            and $40
            jr nz,L1C8A
            bit 7,d
            jp nz,L2AFF
            ret
            call L28B3
            push af
            bit 5,c
            jr z,L1C8A
            pop af
            jp L1BFA
            nop
L1C79       rst $20
L1C7A       call L1C82
            cp $2C
            jr nz,L1C8A
L1C81       rst $20
L1C82       call L24FB
            bit 6,(iy+$01)
            ret nz
L1C8A       rst $08
            dec bc
L1C8C       call L24FB
            bit 6,(iy+$01)
            ret z
            jr L1C8A
            bit 7,(iy+$01)
            res 0,(iy+$02)
            call nz,L0D4D
            pop af
            ld a,($5C74)
            sub $13
            call L21FC
            call L1BEE
            ld hl,($5C8F)
            ld ($5C8D),hl
            ld hl,$5C91
            ld a,(hl)
L1CB7       rlca
            xor (hl)
            and $AA
            xor (hl)
            ld (hl),a
            ret
            call L2530
            jr z,L1CD6
L1CC3       res 0,(iy+$02)
            call L0D4D
            ld hl,$5C90
            ld a,(hl)
            or $F8
            ld (hl),a
            res 6,(iy+$57)
            rst $18
L1CD6       call L21E2
            jr L1C7A
L1CDB       jp L1CDB
L1CDE       cp $0D
            jr z,L1CE6
L1CE2       cp $3A
            jr nz,L1C82
L1CE6       call L2530
            ret z
            rst $28
            and b
            jr c,L1CB7
            rst $28
            ret nz
            ld (bc),a
            ld bc,$01E0
            jr c,L1CC3
            rst $38
            ld hl,($2BE5)
            and $40
            jr nz,L1D06
            bit 5,(hl)
            jr z,L1D3C
            res 5,(hl)
            jr L1D0C
L1D06       bit 7,(hl)
            jr nz,L1D3C
            set 7,(hl)
L1D0C       pop hl
            push hl
            add hl,$0005
            push hl
            ld bc,($5C65)
            and a
            sbc hl,bc
            pop hl
            ld bc,$000D
            jr c,L1D39
            push bc
            call L3AD4
            pop bc
            ld hl,($5B8C)
            scf
            sbc hl,bc
            ld d,(hl)
            dec hl
            ld e,(hl)
            ex de,hl
            add hl,bc
            ex de,hl
            ld (hl),e
            inc hl
            ld (hl),d
            pop hl
            sbc hl,bc
            jr L1D3D
L1D39       call L1655
L1D3C       pop hl
L1D3D       push hl
            ld ($5C68),hl
            rst $28
            ld (bc),a
            ld (bc),a
            jr c,L1D27
            add hl,$0005
            ex de,hl
            ld c,$0A
            ldir
            ld hl,($5C45)
            ex de,hl
            ld (hl),e
            inc hl
            ld (hl),d
            ld d,(iy+$0D)
            inc hl
            ld (hl),d
            jr L1DBB
            rst $20
            cp $24
            ld de,$1F23
            jp z,L1063
            ld de,($5C7A)
            ld hl,($5C78)
            ld a,h
            or l
            jr nz,L1D75
            ld a,($5C7A)
            ld e,a
L1D75       ld d,$00
            call L2530
            call nz,L3932
            jp L2181
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            bit 1,(iy+$37)
            ld b,$01
            ret nz
            dec b
            ld hl,($5B8C)
            ld a,(hl)
            add a,a
            ret nc
            add a,a
            ld hl,($5C4D)
            jr c,L1D9D
            bit 5,(hl)
            ret nz
L1D9D       inc hl
            ld ($5C68),hl
            add hl,$000F
            add de,$0007
            ld c,$03
L1DAB       ld a,(de)
            inc de
            cp (hl)
            inc hl
            ret nz
            dec c
            jr nz,L1DAB
            ret
            rst $28
            ret po
            jp po,LC00F
            ld (bc),a
            jr c,L1DAB
            pop hl
            ret po
            jp po,L0036
            ld (bc),a
            ld bc,$3703
            nop
            inc b
            jr c,L1D70
            ret
            jr c,L1E03
            ret
            ld bc,$0000
L1DD0       push bc
            rst $28
            pop hl
            ld ($3801),a
            call L2DD5
            call L1E42
            pop bc
            push af
            inc sp
            inc c
L1DE0       jp z,L31AD
            call L34E9
            jr nc,L1DD0
            bit 7,(iy+$68)
            ld a,$2D
            jr z,L1DF5
            push af
            inc sp
L1DF2       inc c
            jr z,L1DE0
L1DF5       rst $30
            ld h,d
            ld l,e
            ld b,c
L1DF9       dec sp
            pop af
            ld (hl),a
            inc hl
            djnz L1DF9
            pop af
            push de
            and a
            jr z,L1E2B
            add bc,a
            inc bc
            push bc
            push af
            inc a
            ld c,a
            ld b,$00
            rst $30
            ld a,$2E
            ld (de),a
            inc de
            pop af
L1E13       push af
            push de
            rst $28
            inc bc
            pop hl
            inc b
            ld sp,$313A
            jr c,L1DEB
            push de
            dec l
            call L1E42
            pop de
            ld (de),a
            inc de
            pop af
            dec a
            jr nz,L1E13
            pop bc
L1E2B       push bc
            rst $28
            ld (bc),a
            ld (bc),a
            jr c,L1DF2
            pop de
            jp L25DB
            rst $38
            rst $38
            rst $38
            rst $38
            ld b,a
            cpdr
            ld de,$0200
            jp L198B
L1E42       add a,$30
            cp $3A
            ret c
            add a,$07
            ret
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            call L1E99
            ld a,b
            or c
            jr nz,L1E5A
            ld bc,($5C78)
L1E5A       ld ($5C76),bc
            ret
L1E5F       push $5B48
            push $007B
            push hl
            push $007B
            jp L5B4D
L1E6F       rr d
            ld c,$00
            ret c
            push de
            call L1E94
            pop de
            ret
            call L1E85
            out (c),a
            ret
            call L1E85
            ld (bc),a
            ret
L1E85       call L2DD5
            jr c,L1E9F
            jr z,L1E8E
            neg
L1E8E       push af
            call L1E99
            pop af
            ret
L1E94       call L2DD5
            jr L1E9C
L1E99       call L2DA2
L1E9C       jr c,L1E9F
            ret z
L1E9F       rst $08
            ld a,(bc)
L1EA1       cp $65
            jr z,L1EA8
            cp $45
            ret nz
L1EA8       ld a,($5CAD)
            cp $0A
            ret nz
            ld b,$FF
            rst $20
            cp $2B
            jr z,L1EBA
            cp $2D
            jr nz,L1EBB
            inc b
L1EBA       rst $20
L1EBB       push bc
            call L1ED8
            jp c,L2CF8
            call L2D3B
            call L2DD5
            pop bc
            jp c,L31AD
            and a
            jp m,L31AD
            inc b
            jr z,L1ED5
            neg
L1ED5       jp L2D4F
L1ED8       ld b,a
            sub $30
            jr c,L1EF0
            cp $0A
            jr c,L1EEB
            and $DF
            sub $07
            jr c,L1EF0
            cp $0A
            jr c,L1EF0
L1EEB       cp (iy+$73)
            ccf
            ret nc
L1EF0       ld a,b
            ret
L1EF2       push $5B48
            push $007B
            push bc
            push $007B
            jp L5B3E
            rst $38
            rst $38
            rst $38
L1F05       ld hl,($5C65)
            add hl,bc
            jr c,L1F15
            ex de,hl
            ld hl,$0050
            add hl,de
            jr c,L1F15
            sbc hl,sp
            ret c
L1F15       rst $08
            inc bc
            nop
            nop
            nop
            ld bc,$0000
            call L1F05
            ld b,h
            ld c,l
            ret
            rst $08
            adc a,(hl)
            ret c
            push hl
            ld hl,$3747
            call L32CD
            pop hl
            ld l,h
            ld bc,$373B
            call L32C5
            ret
            rst $38
            rst $38
            rst $38
            rst $38
            call L1E99
L1F3D       halt
            dec bc
            ld a,b
            or c
            jr z,L1F4F
            ld a,b
            and c
            inc a
            jr nz,L1F49
            inc bc
L1F49       bit 5,(iy+$01)
            jr z,L1F3D
L1F4F       res 5,(iy+$01)
            ret
L1F54       ld a,$7F
            in a,($FE)
            rra
            ret c
            ld a,$FE
            in a,($FE)
            rra
            ret c
            ld bc,$3E75
            call L32C5
            scf
            ret nz
            and a
            ret
L1F6A       ex af,af'
L1F6B       ld a,d
            inc d
            jr z,L1F90
            ex de,hl
            ld hl,($5B6A)
            ld ($5B6A),sp
            ld sp,hl
            push de
            ld hl,$332C
            call L32CD
            pop hl
            jp nz,L1F15
            ld a,c
            add a,a
            nextreg $56,a
            inc a
            nextreg $57,a
            set 7,h
            set 6,h
L1F90       push af
            call L1FA8
            pop af
            jr z,L1FA3
            nextreg $8E,$0B
            ld hl,($5B6A)
            ld ($5B6A),sp
            ld sp,hl
L1FA3       ld iy,$5C3A
            ret
L1FA8       push hl
            ld a,$10
            ld ($5B5C),a
            ld a,$04
            ld ($5B67),a
            exx
            ex af,af'
            ret
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
L1FC3       call L2530
            pop hl
            ret z
            jp (hl)
            nop
            ex af,af'
            inc bc
            ld (bc),a
            ld (bc),a
            nop
            inc c
            inc c
            ld b,$08
            ex af,af'
            ld a,(bc)
            ld (bc),a
            inc bc
            dec b
            dec b
            dec b
            dec b
            dec b
            dec b
            ld b,$FF
            rst $18
            call L2045
            jr z,L1FF2
L1FE5       call L204E
            jr z,L1FE5
            call L1FFC
            call L204E
            jr z,L1FE5
L1FF2       cp $29
            ret z
L1FF5       call L1FC3
            ld a,$0D
            rst $10
            ret
L1FFC       rst $18
            cp $AC
            jr nz,L200E
            call L1C79
            call L1FC3
            call L2307
            ld a,$16
            jr L201E
L200E       cp $AD
            jr nz,L2024
            rst $20
            call L1C82
            call L1FC3
            call L1E99
            ld a,$17
L201E       rst $10
            ld a,c
            rst $10
            ld a,b
            rst $10
            ret
L2024       call L21F2
            ret nc
            call L2070
            ret nc
            call L24FB
            call L1FC3
            bit 6,(iy+$01)
            call z,L2BF1
            jp nz,L2DE3
L203C       ld a,b
            or c
            dec bc
            ret z
            ld a,(de)
            inc de
            rst $10
            jr L203C
L2045       cp $29
            ret z
            cp $0D
            ret z
            cp $3A
            ret
L204E       rst $18
            cp $3B
            jr z,L2067
            cp $2C
            jr nz,L2061
            call L2530
            jr z,L2067
            ld a,$06
            rst $10
            jr L2067
L2061       cp $27
            ret nz
            call L1FF5
L2067       rst $20
            call L2045
            jr nz,L206E
            pop bc
L206E       cp a
            ret
L2070       cp $23
            scf
            ret nz
            rst $20
            call L1C82
            and a
            call L1FC3
            call L1E94
            cp $10
            jp nc,L160E
            call L1601
            and a
            ret
            ld hl,$3140
            call L2705
            ld h,b
            jr z,L210D
            inc a
            jr nz,L2097
            ld e,$64
L2097       ld a,e
            ld hl,$0D1B
            call L32CD
            ret
            rst $38
            ld bc,($5C88)
            ld a,($5C6B)
            cp b
            jr c,L20AD
            ld c,$21
            ld b,a
L20AD       ld ($5C88),bc
            ld a,$19
            sub b
            ld ($5C8C),a
            res 0,(iy+$02)
            call L0DD9
            jp L0D6E
L20C1       ld ix,$34A5
            jp z,L17A1
            bit 6,(hl)
            jp nz,L27CB
            call L1C8C
            cp $2C
            jr nz,L20E1
            call L1C81
            cp $2C
            jr nz,L20E9
            rst $20
            call L1C8C
            jr L20F5
L20E1       call L2530
            ld a,$01
            call nz,L2D28
L20E9       call L2530
            ld de,$1539
            ld bc,$0001
            call nz,L2AB2
L20F5       rst $18
            cp $29
            jp nz,L27CB
            rst $20
            call L2530
            jp z,L2181
            call L2BF1
            ld a,b
            or c
            jr z,L210A
            ld a,(de)
L210A       push af
            call L2DA2
            pop de
            jp c,L24F9
            ld a,d
            ex af,af'
            ld a,b
            or c
L2116       jp z,L39F8
            exx
            call L2BF1
            ex de,hl
            ld a,b
            or c
            jr z,L2116
            exx
            push bc
            call L2BF1
            exx
            pop de
            push de
            exx
            pop hl
            dec hl
            ld a,c
            sub l
            ld c,a
            ld a,b
            sbc a,h
            ld b,a
            ld a,$00
            jp c,L39F8
            add hl,de
            ex af,af'
            ld d,a
            ex af,af'
L213C       ld a,b
            or c
            jr z,L2116
            push bc
            push hl
            exx
            push bc
            push hl
L2145       ld a,b
            or c
            jr z,L2178
            ld a,(hl)
            inc hl
            dec bc
            exx
            cp d
            jr z,L2153
            cp (hl)
            jr nz,L215C
L2153       inc hl
            ld a,b
            or c
            jr z,L215C
            dec bc
            exx
            jr L2145
L215C       exx
            pop hl
            pop bc
            inc de
            ex af,af'
            jr z,L2169
            dec de
            dec de
            ld a,d
            or e
            jr z,L217A
L2169       exx
            pop hl
            pop bc
            jr nz,L2173
            ex af,af'
            inc hl
            dec bc
            jr L213C
L2173       ex af,af'
            dec hl
            inc bc
            jr L213C
L2178       pop hl
            pop hl
L217A       pop hl
            pop hl
            ld b,d
            ld c,e
L217E       call L2D2F
L2181       jp L26C3
L2184       push de
            and a
            jr L218A
            push de
            scf
L218A       pop de
            dec d
L218C       push af
            push de
            call L1E99
            push bc
            exx
            pop hl
            pop de
            pop af
            inc d
            ld a,$00
L2199       push af
            ex af,af'
            bit 7,(iy+$01)
            call nz,L1F6B
            pop af
            ld hl,$5C3B
            set 6,(hl)
            jr c,L21B4
            res 6,(hl)
            bit 7,(hl)
            call nz,L2AB2
            jp L35BF
L21B4       bit 7,(hl)
            call nz,L2D2F
            ret
L21BA       set 7,b
            jr L21C5
L21BE       ld b,c
            ld a,c
            and $E0
            set 7,a
            ld c,a
L21C5       rst $18
            exx
            push hl
            exx
            pop hl
            cp $28
            jp z,L2987
            set 5,b
            jp L2987
            rst $38
            rst $38
            ld hl,($5C51)
            inc hl
            inc hl
            inc hl
            inc hl
            ld a,(hl)
            cp $4B
            ret
L21E1       rst $20
L21E2       call L21F2
            ret c
            rst $18
            cp $2C
            jr z,L21E1
            cp $3B
            jr z,L21E1
            jp L1C8A
L21F2       cp $D9
            ret c
            cp $DF
            ccf
            ret c
            push af
            rst $20
            pop af
L21FC       sub $C9
            push af
            call L1C82
            pop af
            and a
            call L1FC3
            push af
            call L1E94
            ld d,a
            pop af
            rst $10
            ld a,d
            rst $10
            ret
L2211       sub $11
            adc a,$00
            jr z,L2234
            sub $02
            adc a,$00
            jr z,L2273
            cp $01
            ld a,d
            ld b,$01
            jr nz,L2228
            rlca
            rlca
            ld b,$04
L2228       ld c,a
            ld a,d
            cp $02
            jr nc,L2244
            ld a,c
            ld hl,$5C91
            jr L226C
L2234       ld a,d
            ld b,$07
            jr c,L223E
            rlca
            rlca
            rlca
            ld b,$38
L223E       ld c,a
            ld a,d
            cp $0A
            jr c,L2246
L2244       rst $08
            inc de
L2246       ld hl,$5C8F
            cp $08
            jr c,L2258
            ld a,(hl)
            jr z,L2257
            or b
            cpl
            and $24
            jr z,L2257
            ld a,b
L2257       ld c,a
L2258       ld a,c
            call L226C
            ld a,$07
            cp d
            sbc a,a
            call L226C
            rlca
            rlca
            and $50
            ld b,a
            ld a,$08
            cp d
            sbc a,a
L226C       xor (hl)
            and b
            xor (hl)
            ld (hl),a
            inc hl
            ld a,b
            ret
L2273       sbc a,a
            ld a,d
            rrca
            ld b,$80
            jr nz,L227D
            rrca
            ld b,$40
L227D       ld c,a
            ld a,d
            cp $08
            jr z,L2287
            cp $02
            jr nc,L2244
L2287       ld a,c
            ld hl,$5C8F
            call L226C
            ld a,c
            rrca
            rrca
            rrca
            jr L226C
            call L1E94
            cp $08
            jr nc,L2244
            out ($FE),a
            rlca
            rlca
            rlca
            bit 5,a
            jr nz,L22A6
            xor $07
L22A6       ld ($5C48),a
            ret
L22AA       ld a,$AF
            sub b
            jp c,L24F9
            ld b,a
            and a
            rra
            scf
            rra
            and a
            rra
            xor b
            and $F8
            xor b
            ld h,a
            ld a,c
            rlca
            rlca
            rlca
            xor b
            and $C7
            xor b
            rlca
            rlca
            ld l,a
            ld a,c
            and $07
            ret
L22CB       call L2307
            call L22AA
            ld b,a
            inc b
            ld a,(hl)
L22D4       rlca
            djnz L22D4
            and $01
            jp L2D28
L22DC       call L2307
            call L22E5
            jp L0D4D
L22E5       ld ($5C7D),bc
            call L22AA
            ld b,a
            inc b
            ld a,$FE
L22F0       rrca
            djnz L22F0
            ld b,a
            ld a,(hl)
            ld c,(iy+$57)
            bit 0,c
            jr nz,L22FD
            and b
L22FD       bit 2,c
            jr nz,L2303
            xor b
            cpl
L2303       ld (hl),a
            jp L0BDB
L2307       call L2314
            ld b,a
            push bc
            call L2314
            ld e,c
            pop bc
            ld d,c
L2312       ld c,a
            ret
L2314       call L2DD5
            jp c,L24F9
            ld c,$01
            ret z
            ld c,$FF
            ret
            rst $18
            cp $2C
            jp nz,L1C8A
            rst $20
            call L1C82
            call L1BEE
            rst $28
            ld hl,($383D)
            ld a,(hl)
            cp $81
            jr nc,L233B
            rst $28
            ld (bc),a
            jr c,L2352
            and c
L233B       rst $28
            and e
            jr c,L2375
            add a,e
            rst $28
            push bc
            ld (bc),a
            jr c,L2312
            ld a,l
            inc h
            push bc
            rst $28
            ld sp,$04E1
            jr c,L23CC
            cp $80
            jr nc,L235A
L2352       rst $28
            ld (bc),a
            ld (bc),a
            jr c,L2318
            jp L22DC
L235A       rst $28
            jp nz,LC001
            ld (bc),a
            inc bc
            ld bc,$0FE0
            ret nz
L2364       ld bc,$E031
            ld bc,$E031
            and b
            pop bc
L236C       ld (bc),a
            jr c,L236C
            inc (hl)
            ld h,d
            call L1E94
            ld l,a
L2375       push hl
            call L1E94
            pop hl
            ld h,a
            ld ($5C7D),hl
            pop bc
            jp L2420
L2382       rst $18
            cp $2C
            jr z,L238D
            call L1BEE
            jp L2477
L238D       rst $20
            call L1C82
            call L1BEE
            rst $28
            push bc
            and d
            inc b
            rra
            ld sp,$3030
            nop
            ld b,$02
            jr c,L2364
            ld (hl),a
L23A2       inc h
            ret nz
            ld (bc),a
            pop bc
            ld (bc),a
            ld sp,$E12A
            ld bc,$2AE1
            rrca
            ret po
            dec b
            ld hl,($01E0)
            dec a
            jr c,L2434
            cp $81
            jr nc,L23C1
            rst $28
            ld (bc),a
            ld (bc),a
            jr c,L2382
            ld (hl),a
            inc h
L23C1       call L247D
            push bc
            rst $28
            ld (bc),a
            pop hl
            ld bc,$C105
            ld (bc),a
L23CC       ld bc,$E131
            inc b
            jp nz,L0102
            ld sp,$04E1
            jp po,LE0E5
            inc bc
            and d
            inc b
            ld sp,$C51F
            ld (bc),a
            jr nz,L23A2
            ld (bc),a
            jp nz,LC102
            push hl
            inc b
            ret po
            jp po,L0F04
            pop hl
            ld bc,$02C1
            ret po
            inc b
            jp po,L04E5
            inc bc
            jp nz,LE12A
            ld hl,($020F)
            jr c,L2418
            cp $81
            pop bc
            jp c,L2477
            push bc
            rst $28
            ld bc,$3A38
            ld a,l
            ld e,h
            call L2D28
            rst $28
            ret nz
            rrca
            ld bc,$3A38
            ld a,(hl)
            ld e,h
            call L2D28
            rst $28
            push bc
            rrca
            ret po
            push hl
            jr c,L23E1
L2420       dec b
            jr z,L245F
            jr L2439
L2425       rst $28
            pop hl
L2427       ld sp,$04E3
            jp po,L04E4
            inc bc
            pop bc
            ld (bc),a
            call po,LE204
            ex (sp),hl
L2434       inc b
            rrca
            jp nz,L3802
L2439       push bc
            rst $28
            ret nz
            ld (bc),a
            pop hl
            rrca
            ld sp,$3A38
            ld a,l
            ld e,h
            call L2D28
            rst $28
            inc bc
            ret po
            jp po,LC00F
            ld bc,$38E0
            ld a,($5C7E)
            call L2D28
            rst $28
            inc bc
L2458       jr c,L2427
            or a
            inc h
            pop bc
            djnz L2425
L245F       rst $28
            ld (bc),a
            ld (bc),a
            ld bc,$3A38
            ld a,l
            ld e,h
            call L2D28
            rst $28
            inc bc
            ld bc,$3A38
            ld a,(hl)
            ld e,h
            call L2D28
            rst $28
            inc bc
            jr c,L2445
            or a
            inc h
            jp L0D4D
L247D       rst $28
            ld sp,$3428
            ld ($0100),a
            dec b
            push hl
            ld bc,$2A05
            jr c,L2458
            push de
            dec l
            jr c,L2495
            and $FC
            add a,$04
            jr nc,L2497
L2495       ld a,$FC
L2497       push af
            call L2D28
            rst $28
            push hl
            ld bc,$3105
            rra
            call nz,L3102
            and d
            inc b
            rra
            pop bc
            ld bc,$02C0
            ld sp,$3104
            rrca
            and c
            inc bc
            dec de
            jp L3802
            pop bc
            ret
            call L2307
            ld a,c
            cp b
            jr nc,L24C4
            ld l,c
            push de
            xor a
            ld e,a
            jr L24CB
L24C4       or c
            ret z
            ld l,b
            ld b,c
            push de
            ld d,$00
L24CB       ld h,b
            ld a,b
            rra
L24CE       add a,l
            jr c,L24D4
            cp h
            jr c,L24DB
L24D4       sub h
            ld c,a
            exx
            pop bc
            push bc
            jr L24DF
L24DB       ld c,a
            push de
            exx
            pop bc
L24DF       ld hl,($5C7D)
            ld a,b
            add a,h
            ld b,a
            ld a,c
            inc a
            add a,l
            jr c,L24F7
            jr z,L24F9
L24EC       dec a
            ld c,a
            call L22E5
            exx
            ld a,c
            djnz L24CE
            pop de
            ret
L24F7       jr z,L24EC
L24F9       rst $08
            ld a,(bc)
L24FB       rst $18
            cp $25
            jp z,L0605
            ld b,$00
            push bc
L2504       ex de,hl
            ld h,$06
            ld l,a
            add hl,a
            ld c,(hl)
            inc hl
            ld h,(hl)
            ld l,c
            jp (hl)
L250F       call L0074
            inc bc
            cp $0D
            jp z,L1C8A
            cp $22
            jr nz,L250F
            call L0074
            cp $22
            ret
L2522       rst $20
L2523       cp $28
            jr nz,L252D
            call L1C79
            rst $18
            cp $29
L252D       jp nz,L1C8A
L2530       bit 7,(iy+$01)
            ret
L2535       call L2307
            ld hl,($5C36)
            add hl,$0100
            ld a,c
            rrca
            rrca
            rrca
            and $E0
            xor b
            ld e,a
            ld a,c
            and $18
            xor $40
            ld d,a
            ld b,$60
L254F       push bc
            push de
            push hl
            ld a,(de)
            xor (hl)
            jr z,L255A
            inc a
            jr nz,L2572
            dec a
L255A       ld c,a
            ld b,$07
L255D       inc d
            inc hl
            ld a,(de)
            xor (hl)
            xor c
            jr nz,L2572
            djnz L255D
            pop bc
            pop bc
            pop bc
            ld a,$80
            sub b
            ld bc,$0001
            rst $30
            ld (de),a
            ret
L2572       pop hl
            add hl,$0008
            pop de
            pop bc
            djnz L254F
            ld c,b
            ret
            rst $38
            rst $38
            rst $38
L2580       call L2307
            ld a,c
            rrca
            rrca
            rrca
            ld c,a
            and $E0
            xor b
            ld l,a
            ld a,c
            and $03
            xor $58
            ld h,a
            ld a,(hl)
            jp L2D28
            push de
            push bc
            rst $18
            jp L2504
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            pop bc
            ld a,c
            cp $C6
            jp nz,L1C8A
            ld c,$FF
            push bc
            rst $20
            jp L2504
            rst $18
            inc hl
            push hl
            ld bc,$0000
            call L250F
            jr nz,L25D9
L25BE       call L250F
            jr z,L25BE
            call L2530
            jr z,L25D9
            rst $30
            pop hl
            push de
L25CB       ld a,(hl)
            inc hl
            ld (de),a
            inc de
            cp $22
            jr nz,L25CB
            ld a,(hl)
            inc hl
            cp $22
            jr z,L25CB
L25D9       dec bc
            pop de
L25DB       ld hl,$5C3B
            res 6,(hl)
            bit 7,(hl)
            call nz,L2AB2
            jp L2712
            rst $20
            call L24FB
            cp $29
L25EE       jp nz,L1C8A
            rst $20
            jp L2712
            jp L0898
            rst $20
            cp $28
            jr nz,L261A
            call L1C81
            cp $29
            jr nz,L25EE
            call L2530
            jr z,L264D
            call L1E99
            ld d,b
            ld e,c
            call L2705
            inc l
            ld hl,($4B42)
            call L2D2F
            jr L264D
L261A       call L2530
            jr z,L2642
            ld de,$FFFF
            call L2705
            ld (hl),$2A
            ld hl,($5C76)
            ld a,$80
L262C       bit 7,d
            jr nz,L2638
            add hl,hl
            ex de,hl
            adc hl,hl
            ex de,hl
            dec a
            jr L262C
L2638       res 7,d
            ld b,e
            ld e,d
            ld d,b
            ld c,h
            ld b,l
            call L2AB6
L2642       jr L26C3
            call L2530
            jr z,L264D
            rst $28
            and e
            jr c,L2681
L264D       rst $20
            jp L26C3
            ld bc,$105A
            rst $20
            cp $23
            jp z,L082F
            ld hl,$5C3B
            res 6,(hl)
            bit 7,(hl)
            jr z,L2682
            call L028E
            ld c,$00
            jr nz,L267D
            call L031E
            jr nc,L267D
            dec d
            ld e,a
            call L0333
            push af
            ld bc,$0001
            rst $30
            pop af
            ld (de),a
            ld c,$01
L267D       ld b,$00
            call L2AB2
L2682       jp L2712
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            call L2530
            jr nz,L26B5
            call L2CCC
            rst $18
            ld bc,$0006
            call L1655
            inc hl
            ld (hl),$0E
            inc hl
            ex de,hl
            ld hl,($5C65)
            ld c,$05
            and a
            sbc hl,bc
            ld ($5C65),hl
            ldir
            ex de,hl
            dec hl
            call L155E
            jr L26C3
L26B5       rst $18
L26B6       inc hl
            ld a,(hl)
            cp $0E
            jr nz,L26B6
            inc hl
            call L33B4
            ld ($5C5D),hl
L26C3       set 6,(iy+$01)
            jr L26DE
            ex de,hl
            call L28C2
            jp c,L1C2E
            call z,L2996
            ld a,($5C3B)
            cp $C0
            jr c,L26DE
            inc hl
            call L33B4
L26DE       jr L2712
            nop
            nop
L26E2       ld ($5B54),bc
            ex (sp),hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ex (sp),hl
L26EC       push $26F3
            push bc
            push af
            ld a,($5B56)
            jr L26FB
            ld ($5B54),bc
L26FB       pop bc
            ld c,$E3
            out (c),b
            ld bc,($5B54)
            ret
L2705       ld ($5B56),a
            ld a,$87
            jp L26E2
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
L2712       rst $18
L2713       cp $28
            jr nz,L2723
            bit 6,(iy+$01)
            jr nz,L2737
            call L2A52
            rst $20
            jr L2713
L2723       ld hl,$1A99
            add hl,a
            ld c,(hl)
            ld hl,$1FC9
            ld a,c
            sub $3B
            jp c,L11B7
            and $3F
            add hl,a
            ld b,(hl)
L2737       pop de
            ld a,d
            cp b
            jr c,L2773
            and a
            jp z,L1555
L2740       push bc
            ld hl,$5C3B
            ld a,e
            cp $ED
            jr nz,L274F
            bit 6,(hl)
            jr nz,L274F
            ld e,$99
L274F       push de
            bit 7,(hl)
            jr z,L27B9
            ld a,e
            and $3F
            jp z,L3886
            call L279D
            ld ($5C65),de
L2761       pop de
            ld hl,$5C3B
            set 6,(hl)
            bit 7,e
            jr nz,L276D
            res 6,(hl)
L276D       pop bc
            jr L2737
            rst $38
            rst $38
            rst $38
L2773       push de
            ld a,c
            bit 6,(iy+$01)
            jr nz,L2790
            and $3F
            add a,$08
            ld c,a
            cp $10
            jr nz,L2788
            set 6,c
            jr L2790
L2788       jr c,L2795
            cp $17
            jr z,L2790
            set 7,c
L2790       push bc
            rst $20
            jp L2504
L2795       cp $0C
            ld c,$7B
            jr z,L2790
            jr L27CB
L279D       ld hl,$32D7
            add hl,a
            add hl,a
            ld c,(hl)
            inc hl
            ld b,(hl)
            push bc
            ld b,a
            ld de,$FFFB
            ld hl,($5C65)
            sub $18
            cp $23
            jr c,L27B6
            add hl,de
L27B6       ex de,hl
            add hl,de
            ret
L27B9       pop bc
            ld a,c
            and $3F
            jr nz,L27C2
            pop hl
            pop af
            push hl
L27C2       push bc
            ld a,e
            xor (iy+$01)
            and $40
            jr z,L2761
L27CB       jp L1C8A
            ld b,$00
            push bc
            jp L2740
L27D4       rst $18
            push hl
            rst $20
            cp $28
            jr nz,L27F3
            pop hl
            rst $20
            call L24FB
            cp $29
            jr z,L27EA
            cp $2C
            jp nz,L1C8A
            inc a
L27EA       push af
            rst $20
            pop af
            ld a,(hl)
            ld hl,$5C3B
            scf
            ret
L27F3       pop hl
            jp L155F
            rst $28
            ld ($3802),a
            ret
L27FC       push hl
            call L2BF1
            pop hl
            push bc
            push de
            dec hl
            dec hl
            push hl
            xor a
L2807       dec hl
            dec a
            bit 5,(hl)
            jr nz,L2807
            cp $FF
            jr z,L2813
            dec hl
            dec a
L2813       dec hl
            ld d,(hl)
            dec hl
            ld e,(hl)
            push hl
            exx
            pop hl
            exx
            dec de
            dec de
            ex de,hl
            push bc
            ld c,a
            ld b,$FF
            add hl,bc
            pop bc
            and a
            sbc hl,bc
            jr nc,L285A
            ld a,h
            cpl
            ld b,a
            ld a,l
            cpl
            ld c,a
            inc bc
            pop hl
            pop de
            push hl
            and a
            sbc hl,de
            jr c,L2845
            ld hl,($5C65)
            and a
            sbc hl,de
            jr nc,L2845
            and a
            ex de,hl
            sbc hl,bc
            ex de,hl
L2845       pop hl
            push de
            push bc
            call L3AD4
            exx
            pop bc
            sbc hl,bc
            ld e,(hl)
            inc hl
            ld d,(hl)
            ex de,hl
            add hl,bc
            ex de,hl
            ld (hl),d
            dec hl
            ld (hl),e
            exx
            push de
L285A       pop hl
            pop de
            pop bc
            ld (hl),c
            inc hl
            ld (hl),b
            ld a,xh
            add a,a
            ret c
            inc hl
            ex de,hl
            ld a,b
            or c
            ret z
            ldir
            ret
L286C       set 2,(iy+$30)
            set 6,(iy+$01)
            ld bc,$27BD
            ld a,$87
            call L26EC
            ld c,$60
            ld a,h
            cp $32
            jr z,L2885
            ld c,$00
L2885       xor a
            inc a
            ret
L2888       and $60
            cp $20
            jp z,L2922
            call L2A3D
            jp c,L28FC
            djnz L28AF
            push hl
L2898       ld a,c
            exx
            pop hl
            ex af,af'
            inc hl
            ld a,(hl)
            inc hl
            and a
            exx
            ld b,$80
            ld c,a
            jr nz,L28FC
            exx
            ex af,af'
            ld c,a
            inc hl
            inc hl
            set 0,(iy+$01)
L28AF       jp L297B
L28B2       rst $18
L28B3       cp $25
            jp z,L286C
L28B8       res 2,(iy+$30)
            call L2C8D
            jp nc,L1C8A
L28C2       set 6,(iy+$01)
            push hl
            exx
            pop hl
            and $1F
            ld c,a
            ld b,$00
L28CE       rst $20
            call L2C88
            inc b
            jr c,L28CE
            cp $28
            jr z,L28ED
            set 6,c
            cp $24
            jr z,L28E8
            set 5,c
            dec b
            jr z,L28ED
            res 6,c
            jr L28ED
L28E8       rst $20
            res 6,(iy+$01)
L28ED       bit 7,(iy+$01)
            jp z,L21BE
            ld hl,($5C0B)
            ld de,$0000
L28FA       res 7,b
L28FC       inc hl
L28FD       add hl,de
            ld a,(hl)
            cp $02
            jr nc,L2933
            inc hl
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
            bit 7,b
            jr nz,L28FC
            ld b,a
            ld a,(hl)
            and $7F
            cp c
            jp z,L2888
            inc a
            jp p,L28FC
            inc hl
            dec de
            ld a,(hl)
            and $7F
            cp c
            jr nz,L28FC
            jr L2922
L2922       push hl
            push de
            call L1A75
            pop de
            jr nc,L292D
            pop hl
            jr L28FC
L292D       djnz L297F
            ex (sp),hl
            jp L2898
L2933       ld de,$000A
            cp $22
            jr c,L28FC
            cp $3E
            jr c,L28FA
            ld e,a
            res 6,e
            jr nz,L28FD
            ld hl,($5C4B)
L2946       ld a,(hl)
            and $7F
            jr z,L2977
            cp c
            jr z,L295E
            inc a
            jp p,L2972
            inc hl
            ld a,(hl)
            dec hl
            and $7F
            cp c
            jr nz,L2972
            push hl
            inc hl
            jr L296C
L295E       and $60
            cp $20
            jr z,L296B
            call L2A3D
            jr c,L2972
            jr L297B
L296B       push hl
L296C       call L1A75
            jr nc,L297F
            pop hl
L2972       call L1A48
            jr L2946
L2977       ld b,c
            jp L21BA
L297B       ld d,h
            ld e,l
            jr L2986
L297F       pop de
            ld a,(de)
            cp $7F
            jr nz,L2986
            inc de
L2986       ld b,c
L2987       rl b
            bit 6,b
            ld a,(de)
            ld b,a
            ret
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
L2996       xor a
            nop
            bit 7,c
            jr nz,L29E9
            bit 7,b
            jr nz,L29AE
            inc a
L29A1       inc hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ex de,hl
            call L2AB2
            rst $18
            jp L1685
L29AE       inc hl
            inc hl
            inc hl
            ld b,(hl)
            bit 6,c
            jr z,L29C0
            dec b
            jr z,L29A1
            ex de,hl
            rst $18
            cp $28
            jr nz,L2A25
            ex de,hl
L29C0       ex de,hl
            jr L29EA
L29C3       push hl
            rst $18
            pop hl
            cp $2C
            jr z,L29ED
            bit 7,c
            jr z,L2A25
            bit 6,c
            jr nz,L29D8
            cp $29
            jr nz,L2A16
            rst $20
            ret
L29D8       cp $29
            jp z,L1684
            cp $CC
            jr nz,L2A16
L29E1       rst $18
            dec hl
            ld ($5C5D),hl
            jp L1681
L29E9       ld b,a
L29EA       ld hl,$0000
L29ED       push hl
            rst $20
            pop hl
            ld a,c
            cp $C0
            jr nz,L29FF
            rst $18
            cp $29
            jp z,L1684
            cp $CC
            jr z,L29E1
L29FF       push bc
            push hl
            call L2AEE
            ex (sp),hl
            ex de,hl
            call L2ACC
            jr c,L2A25
            dec bc
            call L159F
            add hl,bc
            pop de
            pop bc
            djnz L29C3
            bit 7,c
L2A16       jr nz,L2A7A
            push hl
            bit 6,c
            jp nz,L1667
            ld b,d
            ld c,e
            rst $18
            cp $29
            jr z,L2A27
L2A25       rst $08
            ld (bc),a
L2A27       rst $20
            pop hl
            ld de,$0005
            call L159F
            add hl,bc
            ret
            ld bc,$09DB
            jp L082F
            ld bc,$1018
            jp L082F
L2A3D       exx
            push hl
L2A3F       inc hl
            ld a,(hl)
            cp $20
            jr z,L2A3F
            pop hl
            exx
            jp L2C88
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
L2A52       call L2530
            call nz,L2BF1
            rst $20
            cp $29
            jr z,L2AAD
            push de
            xor a
            push af
            push bc
            ld de,$0001
            rst $18
            pop hl
            cp $CC
            jr z,L2A81
            pop af
            call L2ACD
            push af
            ld d,b
            ld e,c
            push hl
            rst $18
            pop hl
            cp $CC
            jr z,L2A81
            cp $29
L2A7A       jp nz,L1C8A
            ld h,d
            ld l,e
            jr L2A94
L2A81       push hl
            rst $20
            pop hl
            cp $29
            jr z,L2A94
            pop af
            call L2ACD
            push af
            rst $18
            ld h,b
            ld l,c
            cp $29
            jr nz,L2A7A
L2A94       pop af
            ex (sp),hl
            add hl,de
            dec hl
            ex (sp),hl
            and a
            sbc hl,de
            ld bc,$0000
            jr c,L2AA8
            inc hl
            and a
            jp m,L2A25
            ld b,h
            ld c,l
L2AA8       pop de
            res 6,(iy+$01)
L2AAD       call L2530
            ret z
L2AB1       xor a
L2AB2       res 6,(iy+$01)
L2AB6       push bc
            call L3C1B
            pop bc
            ld hl,($5C65)
            ld (hl),a
            inc hl
            ld (hl),e
            inc hl
            ld (hl),d
            inc hl
            ld (hl),c
            inc hl
            ld (hl),b
            inc hl
            ld ($5C65),hl
            ret
L2ACC       xor a
L2ACD       push de
            push hl
            push af
            call L1C82
            pop af
            call L2530
            jr z,L2AEB
            push af
            call L1E99
            pop de
            ld a,b
            or c
            scf
            jr z,L2AE8
            pop hl
            push hl
            and a
            sbc hl,bc
L2AE8       ld a,d
            sbc a,$00
L2AEB       pop hl
            pop de
            ret
L2AEE       ex de,hl
            inc hl
            ld e,(hl)
            inc hl
            ld d,(hl)
            ret
            call L2530
            ret z
            call L30A9
            jp c,L1F15
            ret
L2AFF       ld hl,($5C4D)
            bit 2,(iy+$30)
            jp nz,L060D
            ld xh,$40
            bit 1,(iy+$37)
            jr z,L2B4E
            call L1BD4
            cp $24
            jp z,L2BB5
            ld a,$05
            sub b
            ld c,a
            ld b,$00
            ld hl,($5C59)
            dec hl
            call L1655
            inc hl
            ex de,hl
            ld hl,($5C4D)
            sub $06
            ld b,a
            ld a,(hl)
            set 5,a
            ld (de),a
            jr z,L2B3C
            xor $C0
            ld c,a
            call L1BBF
            ld a,c
L2B3C       inc de
            ld bc,$0005
            ld hl,($5C65)
            and a
            sbc hl,bc
            ld ($5C65),hl
            push de
            ldir
            pop hl
            ret
L2B4E       bit 6,(iy+$01)
            ex de,hl
            ld a,(de)
            jr nz,L2B3C
            ex de,hl
            ld bc,($5C72)
            bit 0,(iy+$37)
            jr nz,L2B82
            ld a,b
            or c
            ret z
            push hl
            push bc
            call L2BF1
            pop hl
            sbc hl,bc
            jp c,L0067
            ex (sp),hl
            ex de,hl
            ld a,b
            or c
            jr z,L2B77
            ldir
L2B77       pop bc
            ex de,hl
L2B79       ld a,b
            or c
            ret z
            ld (hl),$20
            inc hl
            dec bc
            jr L2B79
L2B82       ex de,hl
            ld hl,($5C65)
            sbc hl,de
            ex de,hl
            jp c,L27FC
            dec hl
            inc bc
            dec hl
            inc bc
            xor a
L2B91       dec a
            dec hl
            inc bc
            res 7,(hl)
            bit 5,(hl)
            jr nz,L2B91
            set 6,(hl)
            push hl
            push bc
            push af
            ld b,a
            call L2BB8
            pop af
            pop bc
            ex (sp),hl
            inc a
            jr z,L2BAB
            dec hl
            inc bc
L2BAB       push bc
            call L19E8
            pop bc
            pop hl
            and a
            sbc hl,bc
            ret
L2BB5       ld hl,($5C4D)
L2BB8       ld ($5C5B),hl
            push bc
            call L2BF1
            pop af
            neg
            ld xl,a
            dec a
            jr z,L2BC8
            inc a
L2BC8       push bc
            ex de,hl
            add hl,bc
            dec hl
            ld ($5C4D),hl
            add bc,a
            inc bc
            inc bc
            inc bc
            ld hl,($5C59)
            dec hl
            call L1655
            pop bc
            push bc
            inc hl
            push hl
            ld a,xh
            add a,a
            jp L1B99
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
L2BF1       ld hl,($5C65)
            dec hl
            ld b,(hl)
            dec hl
            ld c,(hl)
            dec hl
            ld d,(hl)
            dec hl
            ld e,(hl)
            dec hl
            ld a,(hl)
            ld ($5C65),hl
            ret
            call L28B8
L2C05       jp nz,L1C8A
            ld ($5C4D),hl
            ld ($5C5B),de
            bit 7,c
            jr z,L2C1B
            res 6,c
            call L2996
            call L1BEE
L2C1B       push af
            pop hl
            ld ($5B52),hl
            set 7,c
            ld xh,c
            ld b,$00
            push bc
            ld de,$0001
            bit 6,c
            jr nz,L2C30
            ld e,$05
L2C30       rst $20
            ld h,$FF
            call L2ACC
            jp c,L2A25
            pop hl
            push bc
            inc h
            push hl
            ld h,b
            ld l,c
            call L159F
            ex de,hl
            rst $18
            cp $2C
            jr z,L2C30
            cp $29
            jr nz,L2C05
            rst $20
            pop bc
            ld l,b
            ld h,$00
            add hl,hl
            inc hl
            add hl,de
            push de
            push hl
            push bc
L2C57       jp c,L1F15
            ld a,$C0
            cp h
            jr c,L2C57
            ld b,h
            ld c,l
            call L2AB6
            ld hl,($5B52)
            push hl
            pop af
            jr c,L2CA4
            ld hl,($5C5B)
            set 7,(hl)
            ld hl,($5C4D)
            inc hl
            xor a
            ld c,(hl)
            ld (hl),a
            inc hl
            ld b,(hl)
            ld (hl),a
            inc hl
            push hl
            ex de,hl
            ld hl,($5C65)
            sbc hl,de
            ex de,hl
            call nc,L19E8
            jr L2C9B
L2C88       call L2D1B
            ccf
            ret c
L2C8D       cp $41
            ccf
            ret nc
            cp $5B
            ret c
            cp $61
            ccf
            ret nc
            cp $7B
            ret
L2C9B       ld bc,$0000
            pop hl
            call L2B82
            jr L2CAA
L2CA4       call L1BD1
            call L2BB5
L2CAA       inc hl
            pop af
            ld (hl),a
            ld a,xh
            add a,a
            ld a,(hl)
            pop bc
            add hl,bc
            dec hl
            ld d,h
            ld e,l
            dec de
            pop bc
            ld (hl),$00
            jp p,L2CBF
            ld (hl),$20
L2CBF       lddr
            ex de,hl
            inc hl
L2CC3       pop de
            ld (hl),d
            dec hl
            ld (hl),e
            dec hl
            dec a
            jr nz,L2CC3
            ret
L2CCC       ld c,$10
            cp $24
            jr z,L2CE0
            ld c,$02
            cp $C4
            jr z,L2CE0
            cp $40
            jr z,L2CE0
            ld c,$0A
            jr L2CE1
L2CE0       rst $20
L2CE1       ld a,c
            call L2D0F
            cp $2E
            jr z,L2CF4
            call L2D3E
            cp $2E
            jp nz,L1EA1
            rst $20
L2CF2       jr L2CFC
L2CF4       rst $20
            call L1ED8
L2CF8       jp c,L1C8A
            rst $18
L2CFC       call L2D22
            jp c,L1EA1
            rst $28
            call po,L04E5
            call nz,L0F05
            jr c,L2CF2
            jr L2CFC
L2D0D       ld a,$0A
L2D0F       call L2D28
            rst $28
            push bc
            ld (bc),a
            and c
            call nz,LA002
            jr c,L2CE4
L2D1B       cp $30
            ret c
            cp $3A
            ccf
            ret
L2D22       call L1ED8
            ret c
            nop
            nop
L2D28       ld c,a
            ld b,$00
            ld iy,$5C3A
L2D2F       xor a
            ld e,a
            ld d,c
            ld c,b
            ld b,a
            call L2AB6
            rst $28
            jr c,L2CE1
            ret
L2D3B       call L2D0D
L2D3E       rst $18
L2D3F       call L2D22
            ret c
            rst $28
            ld bc,$04E5
            rrca
L2D48       jr c,L2D17
            ld (hl),h
            nop
            jr L2D3F
L2D4E       ld a,d
L2D4F       rlca
            rrca
L2D51       jr nc,L2D55
            cpl
            inc a
L2D55       push af
            ld hl,$5C92
            call L350B
            rst $28
            and h
            jr c,L2D51
L2D60       srl a
L2D62       jr nc,L2D71
            push af
            rst $28
            pop bc
            ret po
            nop
            inc b
            inc b
L2D6B       inc sp
            ld (bc),a
            dec b
            pop hl
            jr c,L2D62
L2D71       jr z,L2D7B
            push af
            rst $28
            ld sp,$3804
            pop af
            jr L2D60
L2D7B       rst $28
            ld (bc),a
            jr c,L2D48
L2D7F       inc hl
            ld c,(hl)
            inc hl
            ld a,(hl)
            xor c
            sub c
            ld e,a
            inc hl
            ld a,(hl)
            adc a,c
            xor c
            ld d,a
            ret
            ld c,$00
L2D8E       push hl
            ld (hl),$00
            inc hl
            ld (hl),c
            inc hl
            ld a,e
            xor c
L2D96       sub c
            ld (hl),a
            inc hl
            ld a,d
            adc a,c
            xor c
            ld (hl),a
L2D9D       inc hl
            ld (hl),$00
            pop hl
            ret
L2DA2       rst $28
L2DA3       jr c,L2E23
            and a
            jr z,L2DAD
            rst $28
            and d
            rrca
            daa
            jr c,L2D9D
            ld (bc),a
            jr c,L2D96
            push de
            ex de,hl
            ld b,(hl)
            call L2D7F
            xor a
            sub b
            bit 7,c
            ld b,d
            ld c,e
            ld a,e
            pop de
            pop hl
            ret
L2DC1       ld d,a
            rla
            sbc a,a
            ld e,a
            ld c,a
            xor a
            ld b,a
L2DC8       call L2AB6
            rst $28
            inc (hl)
            rst $28
            ld a,(de)
            jr nz,L2D6B
            add a,l
            inc b
            daa
            jr c,L2DA3
            and d
            dec l
L2DD8       ret c
            push af
            dec b
            inc b
            jr z,L2DE1
            pop af
            scf
            ret
L2DE1       pop af
            ret
L2DE3       rst $28
            ld sp,$0036
            dec bc
            ld sp,$0037
            dec c
            ld (bc),a
            jr c,L2E2D
            jr nc,L2DC8
            ret
            ld hl,($3E38)
            dec l
            rst $10
            rst $28
            and b
            jp LC5C4
            ld (bc),a
            jr c,L2DD8
            push hl
            exx
L2E01       rst $28
            ld sp,$C227
            inc bc
            jp po,LC201
            ld (bc),a
            jr c,L2E8A
            and a
            jr nz,L2E56
            call L2D7F
            ld b,$10
            ld a,d
            and a
            jr nz,L2E1E
            or e
            jr z,L2E24
            ld d,e
            ld b,$08
L2E1E       push de
            exx
            pop de
            exx
            jr L2E7B
L2E24       rst $28
            ld (bc),a
            jp po,L7E38
            sub $7E
            call L2DC1
            ld d,a
            ld a,($5CAC)
            sub d
            ld ($5CAC),a
            call L2D4E
            rst $28
            ld sp,$C127
            inc bc
            pop hl
            jr c,L2E0E
            push de
            dec l
            push hl
            ld ($5CA1),a
            dec a
            rla
            sbc a,a
            inc a
            ld hl,$5CAB
            ld (hl),a
            inc hl
            add a,(hl)
            ld (hl),a
            pop hl
            jp L2ECF
L2E56       sub $80
            cp $1C
            jr c,L2E6F
            call L2DC1
            sub $07
            ld b,a
            ld hl,$5CAC
            add a,(hl)
            ld (hl),a
            ld a,b
            neg
            call L2D4F
            jr L2E01
L2E6F       ex de,hl
            call L2FBA
            exx
            set 7,d
            ld a,l
            exx
            sub $80
            ld b,a
L2E7B       sla e
            rl d
            exx
            rl e
            rl d
            exx
            ld hl,$5CAA
            ld c,$05
L2E8A       ld a,(hl)
            adc a,a
            daa
            ld (hl),a
            dec hl
            dec c
            jr nz,L2E8A
            djnz L2E7B
            xor a
            ld hl,$5CA6
            ld de,$5CA1
            ld b,$09
            rld
            ld c,$FF
L2EA1       rld
            jr nz,L2EA9
            dec c
            inc c
            jr nz,L2EB3
L2EA9       ld (de),a
            inc de
            inc (iy+$71)
            inc (iy+$72)
            ld c,$00
L2EB3       bit 0,b
            jr z,L2EB8
            inc hl
L2EB8       djnz L2EA1
            ld a,($5CAB)
            sub $09
            jr c,L2ECB
            dec (iy+$71)
            ld a,$04
            cp (iy+$6F)
            jr L2F0C
L2ECB       rst $28
            ld (bc),a
            jp po,LEB38
            call L2FBA
            exx
            ld a,$80
            sub l
            ld l,$00
            set 7,d
            exx
            call L2FDD
L2EDF       ld a,(iy+$71)
            cp $08
            jr c,L2EEC
            exx
            rl d
            exx
            jr L2F0C
L2EEC       ld bc,$0200
L2EEF       ld a,e
            call L2F8B
            ld e,a
            ld a,d
            call L2F8B
            ld d,a
            push bc
            exx
            pop bc
            djnz L2EEF
            ld hl,$5CA1
            ld a,(iy+$71)
            add hl,a
            ld (hl),c
            inc (iy+$71)
            jr L2EDF
L2F0C       push af
L2F0D       ld hl,$5CA1
            ld b,(iy+$71)
            ld a,b
            add hl,a
            pop af
            nop
L2F18       dec hl
            ld a,(hl)
            adc a,$00
            ld (hl),a
            and a
            jr z,L2F25
            cp $0A
            ccf
            jr nc,L2F2D
L2F25       djnz L2F18
            ld (hl),$01
            inc b
            inc (iy+$72)
L2F2D       ld (iy+$71),b
            rst $28
            ld (bc),a
            jr c,L2F0D
            pop hl
            exx
            ld bc,($5CAB)
            ld hl,$5CA1
            ld a,b
            cp $09
            jr c,L2F46
            cp $FC
            jr c,L2F6C
L2F46       and a
            call z,L15EF
L2F4A       xor a
            sub b
            jp m,L2F52
            ld b,a
            jr L2F5E
L2F52       ld a,c
            and a
            jr z,L2F59
            ld a,(hl)
            inc hl
            dec c
L2F59       call L15EF
            djnz L2F52
L2F5E       ld a,c
            and a
            ret z
            inc b
            ld a,$2E
L2F64       rst $10
            ld a,$30
            djnz L2F64
            ld b,c
            jr L2F52
L2F6C       ld d,b
            dec d
            ld b,$01
            call L2F4A
            ld a,$45
            rst $10
            ld c,d
            ld a,c
            and a
            jp p,L2F83
            neg
            ld c,a
            ld a,$2D
            jr L2F85
L2F83       ld a,$2B
L2F85       rst $10
            ld b,$00
            jp L1A1B
L2F8B       push de
            ld l,a
            ld h,$00
            ld e,l
            ld d,h
            add hl,hl
            add hl,hl
            add hl,de
            add hl,hl
            ld e,c
            add hl,de
            ld c,h
            ld a,l
            pop de
            ret
L2F9B       ld a,(hl)
            ld (hl),$00
            and a
            ret z
            inc hl
            bit 7,(hl)
            set 7,(hl)
            dec hl
            ret z
            push bc
            ld bc,$0005
            add hl,bc
            ld b,c
            ld c,a
            scf
L2FAF       dec hl
            ld a,(hl)
            cpl
            adc a,$00
            ld (hl),a
            djnz L2FAF
            ld a,c
            pop bc
            ret
L2FBA       push hl
            push af
            ld c,(hl)
            inc hl
            ld b,(hl)
            ld (hl),a
            inc hl
            ld a,c
            ld c,(hl)
            push bc
            inc hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            ex de,hl
            ld d,a
            ld e,(hl)
            push de
            inc hl
            ld d,(hl)
            inc hl
            ld e,(hl)
            push de
            exx
            pop de
            pop hl
            pop bc
            exx
            inc hl
            ld d,(hl)
            inc hl
            ld e,(hl)
            pop af
            pop hl
            ret
L2FDD       and a
            ret z
            cp $21
            jr nc,L2FF9
            push bc
            ld b,a
L2FE5       exx
            sra l
            rr d
            rr e
            exx
            rr d
            rr e
            djnz L2FE5
            pop bc
            ret nc
            call L3004
            ret nz
L2FF9       exx
            xor a
L2FFB       ld l,$00
            ld d,a
            ld e,l
            exx
            ld de,$0000
            ret
L3004       inc e
            ret nz
            inc d
            ret nz
            exx
            inc e
            jr nz,L300D
            inc d
L300D       exx
            ret
L300F       ex de,hl
            call L346E
            ex de,hl
            ld a,(de)
            or (hl)
            jr nz,L303E
            push de
            inc hl
            push hl
            inc hl
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
            inc hl
            inc hl
            ld a,(hl)
            inc hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            pop hl
            ex de,hl
            adc hl,bc
            ex de,hl
            jp z,L3226
            adc a,(hl)
            rrca
            adc a,$00
            jr nz,L303C
            sbc a,a
L3036       ld (hl),a
            inc hl
            ld (hl),e
            jp L3237
L303C       dec hl
            pop de
L303E       call L3293
            exx
            push hl
            exx
            push de
            push hl
            call L2F9B
            ld b,a
            ex de,hl
            call L2F9B
            ld c,a
            cp b
            jr nc,L3055
            ld a,b
            ld b,c
            ex de,hl
L3055       push af
            sub b
            call L2FBA
            call L2FDD
            pop af
            pop hl
            ld (hl),a
            push hl
            ld l,b
            ld h,c
            add hl,de
            exx
            ex de,hl
            adc hl,bc
            ex de,hl
            ld a,h
            adc a,l
            ld l,a
            rra
            xor l
            exx
            ex de,hl
            pop hl
            rra
            jr nc,L307C
            ld a,$01
            call L2FDD
            inc (hl)
            jr z,L309F
L307C       exx
            ld a,l
            and $80
            exx
            inc hl
            ld (hl),a
            dec hl
            jr z,L30A5
            ld a,e
            neg
            ccf
            ld e,a
            ld a,d
            cpl
            adc a,$00
            ld d,a
            exx
            ld a,e
            cpl
            adc a,$00
            ld e,a
            ld a,d
            cpl
            adc a,$00
            jr nc,L30A3
            rra
            exx
            inc (hl)
L309F       jp z,L31AD
            exx
L30A3       ld d,a
            exx
L30A5       xor a
            jp L3155
L30A9       push bc
            ld b,$10
            ld a,h
            ld c,l
            ld hl,$0000
L30B1       add hl,hl
            jr c,L30BE
            rl c
            rla
            jr nc,L30BC
            add hl,de
            jr c,L30BE
L30BC       djnz L30B1
L30BE       pop bc
            ret
L30C0       call L34E9
            ret c
            inc hl
            xor (hl)
            set 7,(hl)
            dec hl
            ret
            ld a,(de)
            or (hl)
            jr nz,L30F0
            push de
            push hl
            push de
            call L2D7F
            ex de,hl
            ex (sp),hl
            ld b,c
            call L2D7F
            ld a,b
            xor c
            ld c,a
            pop hl
            push bc
            call L1579
            pop bc
            ex de,hl
            pop hl
            jr c,L30EF
            jr nz,L30EA
            ld c,a
L30EA       call L2D8E
            pop de
            ret
L30EF       pop de
L30F0       call L3293
            xor a
            call L30C0
            ret c
            exx
            push hl
            exx
            push de
            ex de,hl
            call L30C0
            ex de,hl
            jr c,L315D
            push hl
            call L2FBA
            ld a,b
            and a
            sbc hl,hl
            exx
            push hl
            sbc hl,hl
            exx
            ld b,$21
            jr L3125
L3114       jr nc,L311B
            add hl,de
            exx
            adc hl,de
            exx
L311B       exx
            rr h
            rr l
            exx
            rr h
            rr l
L3125       exx
            rr b
            rr c
            exx
            rr c
            rra
            djnz L3114
            ex de,hl
            exx
            ex de,hl
            exx
            pop bc
            pop hl
            ld a,b
            add a,c
            jr nz,L313B
            and a
L313B       dec a
            ccf
L313D       rla
            ccf
            rra
            jp p,L3146
            jr nc,L31AD
            and a
L3146       inc a
            jr nz,L3151
            jr c,L3151
            exx
            bit 7,d
            exx
            jr nz,L31AD
L3151       ld (hl),a
            exx
            ld a,b
            exx
L3155       jr nc,L316C
            ld a,(hl)
            and a
L3159       ld a,$80
            jr z,L315E
L315D       xor a
L315E       exx
            and d
            call L2FFB
            rlca
            ld (hl),a
            jr c,L3195
            inc hl
            ld (hl),a
            dec hl
            jr L3195
L316C       ld b,$20
L316E       exx
            bit 7,d
            exx
            jr nz,L3186
            rlca
            rl e
            rl d
            exx
            rl e
            rl d
            exx
            dec (hl)
            jr z,L3159
            djnz L316E
            jr L315D
L3186       rla
            jr nc,L3195
            call L3004
            jr nz,L3195
            exx
            ld d,$80
            exx
            inc (hl)
            jr z,L31AD
L3195       push hl
            inc hl
            exx
            push de
            exx
            pop bc
            ld a,b
            rla
            rl (hl)
            rra
            ld (hl),a
            inc hl
            ld (hl),c
            inc hl
            ld (hl),d
            inc hl
            ld (hl),e
            pop hl
            pop de
            exx
            pop hl
            exx
            ret
L31AD       rst $08
            dec b
            call L3293
            ex de,hl
            xor a
            call L30C0
            jr c,L31AD
            ex de,hl
            call L30C0
            ret c
            exx
            push hl
            exx
            push de
            push hl
            call L2FBA
            exx
            push hl
            ld h,b
            ld l,c
            exx
            ld h,c
            ld l,b
            xor a
            ld b,$DF
            jr L31E2
L31D2       rla
            rl c
            exx
            rl c
            rl b
            exx
L31DB       add hl,hl
            exx
            adc hl,hl
            exx
            jr c,L31F2
L31E2       sbc hl,de
            exx
            sbc hl,de
            exx
            jr nc,L31F9
            add hl,de
            exx
            adc hl,de
            exx
            and a
            jr L31FA
L31F2       and a
            sbc hl,de
            exx
            sbc hl,de
            exx
L31F9       scf
L31FA       inc b
            jp m,L31D2
            push af
            jr z,L31DB
            ld e,a
            ld d,c
            exx
            ld e,c
            ld d,b
            pop af
            rr b
            pop af
            rr b
            exx
            pop bc
            pop hl
            ld a,b
            sub c
            jp L313D
            ld a,(hl)
            and a
            ret z
            cp $81
            jr nc,L3221
            ld (hl),$00
            ld a,$20
            jr L3272
L3221       cp $91
            jp L323F
L3226       jr nc,L323B
            xor (hl)
            ld a,e
            jp nz,L3036
            ld a,(hl)
            and $80
            dec hl
            ld (hl),$91
            inc hl
            jp L3036
L3237       inc hl
            ld (hl),d
            dec hl
            dec hl
L323B       dec hl
            pop de
            ret
            rst $38
L323F       jr nc,L326D
            push de
            cpl
            add a,$91
            inc hl
            ld d,(hl)
            inc hl
            ld e,(hl)
            dec hl
            dec hl
            ld c,$00
            bit 7,d
            jr z,L3252
            dec c
L3252       set 7,d
            ld b,$08
            sub b
            add a,b
            jr c,L325E
            ld e,d
            ld d,$00
            sub b
L325E       jr z,L3267
            ld b,a
L3261       srl d
            rr e
            djnz L3261
L3267       call L2D8E
            pop de
            ret
            ld a,(hl)
L326D       sub $A0
            ret p
            neg
L3272       push de
            ex de,hl
            dec hl
            ld b,a
            srl b
            srl b
            srl b
            jr z,L3283
L327E       ld (hl),$00
            dec hl
            djnz L327E
L3283       and $07
            jr z,L3290
            ld b,a
            ld a,$FF
L328A       sla a
            djnz L328A
            and (hl)
            ld (hl),a
L3290       ex de,hl
L3291       pop de
            ret
L3293       call L3296
L3296       ex de,hl
L3297       ld a,(hl)
            and a
            ret nz
            push de
            call L2D7F
            xor a
            inc hl
            ld (hl),a
            dec hl
            ld (hl),a
            ld b,$91
            ld a,d
            and a
            jr nz,L32B1
            or e
L32AA       ld b,d
            jr z,L32BD
            ld d,e
            ld e,b
            ld b,$89
L32B1       ex de,hl
L32B2       dec b
            add hl,hl
            jr nc,L32B2
            rrc c
            rr h
            rr l
L32BC       ex de,hl
L32BD       dec hl
            ld (hl),e
            dec hl
            ld (hl),d
            dec hl
            ld (hl),b
            pop de
            ret
L32C5       push $5B48
            push bc
            jp L5B3E
L32CD       push $5B48
            push hl
            jp L5B3E
            rst $38
            rst $38
            nop
            nop
            ld c,e
            inc a
            ld e,l
            inc a
            rrca
            jr nc,L32AA
            jr nc,L3291
            ld sp,$3851
            dec de
            dec (hl)
            inc h
            dec (hl)
            dec sp
            dec (hl)
            dec sp
            dec (hl)
            dec sp
            dec (hl)
            dec sp
            dec (hl)
            dec sp
            dec (hl)
            dec sp
            dec (hl)
            inc d
            jr nc,L3325
            dec (hl)
            dec sp
            dec (hl)
            dec sp
            dec (hl)
            dec sp
            dec (hl)
            dec sp
            dec (hl)
            dec sp
L3302       dec (hl)
            dec sp
            dec (hl)
            sbc a,h
            dec (hl)
            sbc a,$35
            cp h
            inc (hl)
            ld b,l
            ld (hl),$6E
            inc (hl)
            ld l,c
            ld (hl),$DE
            dec (hl)
            ld (hl),h
            ld (hl),$B5
            scf
            xor d
            scf
            jp c,L3337
            jr c,L3361
            jr c,L3302
            scf
            inc de
            scf
            call nz,LAF36
            ld (hl),$4A
            jr c,L32BC
            inc (hl)
            ld l,d
            inc (hl)
            xor h
            inc (hl)
            and l
            inc (hl)
            or e
            inc (hl)
            rra
            ld (hl),$C9
            dec (hl)
L3337       ld bc,$7135
            djnz L33B1
            inc a
            ld b,(hl)
            add hl,sp
            ld (bc),a
            add hl,sp
            ld (bc),a
            add hl,sp
            ld (bc),a
            add hl,sp
            cp c
            inc (hl)
            cp d
            jr c,L334A
L334A       nop
            nop
            nop
            ld h,$09
            rst $30
            daa
            adc a,a
            inc a
            adc a,c
            inc a
            add a,e
            inc a
            rst $38
            rst $38
            rst $38
            rst $38
L335B       call L35BF
L335E       ld a,b
            ld ($5C67),a
L3362       exx
            ex (sp),hl
            exx
            ld ($5C65),de
            exx
            ld a,(hl)
            inc hl
L336C       push hl
            and a
            jp p,L3380
            ld d,a
            and $60
            swapnib
            add a,$7C
            ld l,a
            ld a,d
            and $1F
            jp L338E
            nop
L3380       cp $18
            jr nc,L338C
            exx
            ld d,h
            ld e,l
            add hl,$FFFB
            exx
L338C       rlca
            ld l,a
L338E       ld h,$00
            add hl,$3B02
            ld e,(hl)
            inc hl
            ld d,(hl)
            ld hl,$3365
            ex (sp),hl
            push de
            exx
            ld bc,($5C66)
            ret
            pop af
            ld a,($5C67)
            exx
            jr L336C
L33A9       push de
            push hl
            ld bc,$0005
            call L1F05
L33B1       pop hl
            pop de
            ret
L33B4       ld de,($5C65)
            call L3C2E
            ld ($5C65),de
            ret
            call L33A9
            ldir
            ret
            ld h,d
            ld l,e
            call L3C1B
            exx
            push hl
            exx
            ex (sp),hl
            ld a,(hl)
            and $C0
            rlca
            rlca
            ld c,a
            inc c
            ld a,(hl)
            and $3F
            jr nz,L33DD
            inc hl
            ld a,(hl)
L33DD       add a,$50
            ld (de),a
            ld a,$05
            sub c
            inc hl
            inc de
            ld b,$00
            ldir
            ex (sp),hl
            exx
            pop hl
            exx
            ld b,a
            xor a
L33EF       dec b
            ret z
            ld (de),a
            inc de
            jr L33EF
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
L3406       ld c,a
            rlca
            rlca
            add a,c
            add hl,a
            ret
            rst $38
            rst $38
            push de
            ld hl,($5C68)
            call L3406
            call L3C2E
            pop hl
            ret
            ld hl,$3C02
            ld c,a
            add a,a
            add a,a
            add a,c
            add hl,a
            push de
            call L3C2E
L3428       pop hl
            ret
            rst $38
            rst $38
            rst $38
            push hl
            ex de,hl
            ld hl,($5C68)
            call L3406
            ex de,hl
            call L3C40
            ex de,hl
            pop hl
            ret
L343C       ld b,$05
L343E       ld a,(de)
            ld c,(hl)
            ex de,hl
            ld (de),a
            ld (hl),c
            inc hl
            inc de
            djnz L343E
            ex de,hl
            ret
            ld b,a
            call L335E
            ld sp,$C00F
            ld (bc),a
            and b
            jp nz,LE031
            inc b
            jp po,L03C1
            jr c,L3428
            add a,$33
            call L3362
            rrca
            ld bc,$02C2
            dec (hl)
            xor $E1
            inc bc
            jr c,L3433
            ld b,$FF
            jr L3474
L346E       call L34E9
            ret c
            ld b,$00
L3474       ld a,(hl)
            and a
            jr z,L3483
            inc hl
            ld a,b
            and $80
            or (hl)
            rla
            ccf
            rra
            ld (hl),a
            dec hl
            ret
L3483       push de
            push hl
            call L2D7F
            pop hl
            ld a,b
            or c
            cpl
            ld c,a
            call L2D8E
            pop de
            ret
            call L34E9
            ret c
            push de
            ld de,$0001
            inc hl
            rl (hl)
            dec hl
            sbc a,a
            ld c,a
            call L2D8E
            pop de
            ret
            call L1E99
            in a,(c)
            jr L34B0
            call L1E99
            ld a,(bc)
L34B0       jp L2D28
            scf
L34B4       ld d,$FE
            jp L218C
            and a
            jr L34B4
            call L2BF1
            dec bc
            ld a,b
            or c
            jr nz,L34E7
            ld a,(de)
            call L3BDF
            sub $90
            jr c,L34E7
            ld h,$00
            ld l,a
            add hl,hl
            add hl,hl
            add hl,hl
            ld bc,($5C7B)
            add hl,bc
            ld b,h
            ld c,l
            jr nc,L34DF
            cp $15
            jr nc,L34E7
L34DF       jp L2D2F
L34E2       push hl
            jp L1601
            nop
L34E7       rst $08
            add hl,bc
L34E9       push hl
            push bc
            ld b,a
            ld a,(hl)
            inc hl
            or (hl)
            inc hl
            or (hl)
            inc hl
            or (hl)
            ld a,b
            pop bc
            pop hl
            ret nz
            scf
            ret
L34F9       call L34E9
            ret c
            ld a,$FF
            jr L3507
L3501       call L34E9
            jr L350B
            xor a
L3507       inc hl
            xor (hl)
            dec hl
            rlca
L350B       push hl
            ld a,$00
            ld (hl),a
            inc hl
            ld (hl),a
            inc hl
            rla
            ld (hl),a
            rra
            inc hl
            ld (hl),a
            inc hl
            ld (hl),a
            pop hl
            ret
            ex de,hl
            call L34E9
            ex de,hl
            ret c
            scf
            jr L350B
            ex de,hl
            call L34E9
            ex de,hl
            ret nc
            and a
            jr L350B
            ex de,hl
            call L34E9
            ex de,hl
            ret nc
            push de
            dec de
            xor a
            ld (de),a
            dec de
            ld (de),a
            pop de
            ret
            ld a,b
            sub $08
            bit 2,a
            jr nz,L3543
            dec a
L3543       rrca
            jr nc,L354E
            push af
            push hl
            call L343C
            pop de
            ex de,hl
            pop af
L354E       bit 2,a
            jr nz,L3559
            rrca
            push af
            call L300F
            jr L358C
L3559       rrca
            push af
            call L2BF1
            push de
            push bc
            call L2BF1
            pop hl
L3564       ld a,h
            or l
            ex (sp),hl
            ld a,b
            jr nz,L3575
            or c
L356B       pop bc
            jr z,L3572
            pop af
            ccf
            jr L3588
L3572       pop af
            jr L3588
L3575       or c
            jr z,L3585
            ld a,(de)
            sub (hl)
            jr c,L3585
            jr nz,L356B
L357E       dec bc
            inc de
            inc hl
            ex (sp),hl
            dec hl
            jr L3564
L3585       pop bc
            pop af
            and a
L3588       push af
            rst $28
            and b
            jr c,L357E
            push af
            call c,L3501
            pop af
            push af
            call nc,L34F9
            pop af
            rrca
            call nc,L3501
            ret
            call L2BF1
            push de
            push bc
            call L2BF1
            pop hl
            push hl
            push de
            push bc
            add hl,bc
            ld b,h
            ld c,l
            rst $30
            call L2AB2
            pop bc
            pop hl
            ld a,b
            or c
            jr z,L35B7
            ldir
L35B7       pop bc
            pop hl
            ld a,b
            or c
            jr z,L35BF
            ldir
L35BF       ld hl,($5C65)
            ld d,h
            ld e,l
            add hl,$FFFB
            ret
            call L2DD5
            jr c,L35DC
            jr nz,L35DC
            push af
            ld bc,$0001
            rst $30
            pop af
            ld (de),a
L35D7       call L2AB2
            ex de,hl
            ret
L35DC       rst $08
            ld a,(bc)
            ld hl,($5C5D)
            push hl
            ld a,b
            add a,$E3
            sbc a,a
            push af
            call L2BF1
            push de
            inc bc
            rst $30
            pop hl
            ld ($5C5D),de
            push de
            ldir
            ex de,hl
            dec hl
            ld (hl),$0D
            res 7,(iy+$01)
            call L24FB
            rst $18
            cp $0D
            jr nz,L360C
            pop hl
            pop af
            xor (iy+$01)
            and $40
L360C       jp nz,L1C8A
            ld ($5C5D),hl
            set 7,(iy+$01)
            call L24FB
            pop hl
            ld ($5C5D),hl
            jr L35BF
            ld de,$2DE3
L3622       push de
            ld bc,$0001
            rst $30
            ld ($5C5B),hl
            ex (sp),hl
            push hl
            ld hl,($5C51)
            ex (sp),hl
            ld a,$FF
            call L34E2
            pop hl
            call L1615
            pop de
            ld hl,($5C5B)
            and a
            sbc hl,de
            ld b,h
            ld c,l
            jp L35D7
            call L1E94
            cp $10
            jp nc,L1E9F
            ld hl,($5C51)
            push hl
            call L1601
            call L15E6
            ld bc,$0000
            jr nc,L365F
            inc c
            rst $30
            ld (de),a
L365F       call L2AB2
            pop hl
            call L1615
            jp L35BF
            call L2BF1
            ld a,b
            or c
            jr z,L3671
            ld a,(de)
L3671       jp L2D28
L3674       call L2BF1
            jp L2D2F
            exx
            push hl
            ld hl,$5C67
            dec (hl)
            pop hl
            jr nz,L3687
            inc hl
            exx
            ret
L3686       exx
L3687       ld e,(hl)
            ld a,e
            rla
            sbc a,a
            ld d,a
            add hl,de
L368D       exx
            ret
            inc de
            inc de
            ld a,(de)
            dec de
            dec de
            and a
            jr nz,L3686
            exx
            inc hl
            exx
            ret
            pop af
            exx
            ex (sp),hl
            exx
            ret
            rst $28
            ret nz
            ld (bc),a
            ld sp,$05E0
            daa
            ret po
            ld bc,$04C0
            inc bc
            ret po
            jr c,L3678
            rst $28
            ld sp,$0036
            inc b
            ld a,($C938)
            ld sp,$C03A
            inc bc
            ret po
            ld bc,$0030
            inc bc
            and c
            inc bc
            jr c,L368D
            rst $28
            dec a
            inc (hl)
L36C7       pop af
            jr c,L3674
            dec sp
            add hl,hl
            inc b
            ld sp,$C327
            inc bc
            ld sp,$A10F
            inc bc
            adc a,b
            inc de
            ld (hl),$58
            ld h,l
            ld h,(hl)
            sbc a,l
L36DC       ld a,b
            ld h,l
            ld b,b
            and d
            ld h,b
            ld ($E7C9),a
            ld hl,$AFF7
            inc h
            ex de,hl
            cpl
L36EA       or b
            or b
            inc d
            xor $7E
            cp e
            sub h
            ld e,b
            pop af
            ld a,($F87E)
            rst $08
            ex (sp),hl
            jr c,L36C7
            push de
            dec l
            jr nz,L3705
            jr c,L3703
            add a,(hl)
            jr nc,L370C
L3703       rst $08
            dec b
L3705       jr c,L370E
            sub (hl)
            jr nc,L370E
            neg
L370C       ld (hl),a
            ret
L370E       rst $28
            ld (bc),a
            and b
            jr c,L36DC
            rst $28
            dec a
            ld sp,$0037
            inc b
            jr c,L36EA
            add hl,bc
            and b
            ld (bc),a
            jr c,L379E
            ld (hl),$80
            call L2D28
            rst $28
            inc (hl)
            jr c,L3729
L3729       inc bc
            ld bc,$3431
            ret p
            ld c,h
            call z,LCDCC
            inc bc
            scf
            nop
            ex af,af'
            ld bc,$03A1
            ld bc,$3438
            rst $28
            ld bc,$F034
            ld sp,$1772
            ret m
            inc b
            ld bc,$03A2
            and d
            inc bc
            ld sp,$3234
            jr nz,L3753
            and d
            inc bc
            adc a,h
            ld de,$14AC
            add hl,bc
            ld d,(hl)
            jp c,L59A5
            jr nc,L3721
            ld e,h
            sub b
            xor d
            sbc a,(hl)
            ld (hl),b
            ld l,a
            ld h,c
            and c
            set 3,d
            sub (hl)
            and h
            ld sp,$B49F
            rst $20
            and b
            cp $5C
            call m,L1BEA
            ld b,e
L3773       jp z,LED36
            and a
            sbc a,h
            ld a,(hl)
            ld e,(hl)
            ret p
            ld l,(hl)
            inc hl
            add a,b
            sub e
            inc b
            rrca
            jr c,L374C
            rst $28
            dec a
            inc (hl)
            xor $22
            ld sp,hl
            add a,e
            ld l,(hl)
            inc b
            ld sp,$0FA2
            daa
            inc bc
            ld sp,$310F
            rrca
            ld sp,$A12A
            inc bc
            ld sp,$C037
            nop
            inc b
L379E       ld (bc),a
            jr c,L376A
            and c
            inc bc
            ld bc,$0036
            ld (bc),a
            dec de
            jr c,L3773
            rst $28
L37AB       add hl,sp
            ld hl,($03A1)
            ret po
            nop
            ld b,$1B
            inc sp
            inc bc
            rst $28
L37B6       add hl,sp
L37B7       ld sp,$0431
            ld sp,$A10F
            inc bc
            add a,(hl)
            inc d
            and $5C
            rra
            dec bc
            and e
            adc a,a
            jr c,L37B6
            jp (hl)
            dec d
            ld h,e
            cp e
            inc hl
            xor $92
            dec c
            call LF1ED
            inc hl
            ld e,l
            dec de
            jp pe,L3804
            ret
            rst $28
            ld sp,$011F
            jr nz,L37E5
            jr c,L37AB
            call L3297
L37E5       ld a,(hl)
            cp $81
            jr c,L37F8
            rst $28
            and c
            dec de
            ld bc,$3105
            ld (hl),$A3
            ld bc,$0600
            dec de
            inc sp
            inc bc
L37F8       rst $28
            and b
            ld bc,$3131
            inc b
            ld sp,$A10F
            inc bc
L3802       adc a,h
            djnz L37B7
            inc de
            ld c,$55
            call po,L588D
            add hl,sp
            cp h
            ld e,e
            sbc a,b
            sbc a,(iy)
            ld (hl),$75
            and b
            in a,($E8)
            or h
            ld h,e
            ld b,d
            call nz,LB5E6
            add hl,bc
L381E       ld (hl),$BE
            jp (hl)
            ld (hl),$73
            dec de
            ld e,l
            call pe,LDED8
            ld h,e
            cp (hl)
            ret p
            ld h,c
            and c
            or e
            inc c
            inc b
            rrca
            jr c,L37FC
            rst $28
            ld sp,$0431
L3837       and c
            inc bc
            dec de
            jr z,L37DD
            rrca
            dec b
            inc h
            ld sp,$380F
            ret
            rst $28
            ld ($03A3),hl
            dec de
            jr c,L3813
            rst $28
            ld sp,$0030
            ld e,$A2
            jr c,L3841
            ld bc,$3031
            nop
            rlca
            dec h
            inc b
            jr c,L381E
            call nz,L0236
            ld sp,$0030
            add hl,bc
            and b
            ld bc,$0037
            ld b,$A1
            ld bc,$0205
            and c
            jr c,L3837
L386E       jp L02BF
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
L387E       sub $A5
            jp nc,L0B5F
            jp L0B56
L3886       pop hl
            pop bc
            pop de
            push bc
            push hl
            call L2530
            jp z,L27B9
            push $2761
            ld a,e
            cp $24
            jp z,L2184
            push de
            call L1E99
            pop de
            ld a,e
            cp $9E
            jr z,L38B1
            cp $E8
            jr z,L38B1
            ld h,b
            ld l,c
            call L38D3
            jp L2D2F
L38B1       ld e,c
            ld l,a
            inc b
            dec b
            jp z,L39A4
            rst $08
            ld a,(bc)
            call L2DA2
            jp c,L24F9
            jr z,L38C9
            ld a,b
            cpl
            ld b,a
            ld a,c
            cpl
            ld c,a
            inc bc
L38C9       ld d,b
            ld e,c
            call L2705
            add a,d
            ld l,$EB
            jr L394E
L38D3       push de
            ld a,d
            ld bc,$3308
            call L32C5
            ex af,af'
            pop de
            ld a,e
            cp $C0
            jr z,L38F1
            push de
            call L08FC
            inc hl
            ld c,a
            pop de
            ld a,e
            sub $BE
            call nz,L08FC
            ld b,a
            ret
L38F1       ld a,d
            push hl
            ld b,h
            ld c,l
            exx
            ld d,a
            pop hl
            xor a
            cp $01
            jp L1F6A
            rst $38
            rst $38
            rst $38
            rst $38
            push bc
            ld hl,($5C51)
            push hl
            push bc
            call L1E94
            call L1601
            pop af
L390F       sub $34
            ld b,a
            exx
            add a,a
            jr nz,L3918
            ld a,$04
L3918       ld e,a
            ld d,$00
            ld hl,$03E5
            call L19CE
            ex (sp),hl
            push de
            push af
            call L1615
            pop af
            pop de
            pop hl
            ld c,a
            ld b,$00
            pop af
            cp $35
            jr z,L3950
L3932       push de
            ld b,h
            ld c,l
            call L2D2F
            pop bc
            call L2D2F
            rst $28
            inc (hl)
            ld b,b
            ld b,c
            nop
            nop
            inc b
            rrca
            jr c,L390F
            call L1E99
            ld d,b
            ld e,c
            call L0918
L394E       ld b,h
            ld c,l
L3950       jp L2D2F
            call L1C81
            call L2530
            call nz,L1E94
            ld d,a
            rst $18
            cp $A8
            jp z,L089C
            cp $87
            jp z,L3A04
            cp $C0
            jp z,L17AF
            cp $BE
            jr z,L3976
            cp $8A
            jp nz,L3A0C
L3976       ld e,a
L3977       push de
            ld bc,$10C0
            jp L082F
            rst $20
            cp $E8
            jr z,L3976
            cp $AC
            jr z,L3993
            cp $DE
            jr z,L39AF
            dec hl
            ld ($5C5D),hl
            ld a,$9E
            jr L3976
L3993       call L2522
            call nz,L399D
            rst $20
            jp L26C3
L399D       call L2307
            ld e,c
            ld d,b
            ld l,$AC
L39A4       ld bc,$099B
            call L1EF2
            ld b,d
            ld c,e
            jp L2D2F
L39AF       rst $20
            cp $28
            jr nz,L3A0C
            call L1C79
            cp $CC
            call L0FF5
            cp $2C
            call L0FF5
            cp $2C
            call L0FF5
            cp $29
            jr nz,L3A0C
            rst $20
            call L2530
            jr z,L39FB
            call L1E6F
            ld l,c
            push hl
            call L1E6F
            pop hl
            ld h,c
            push hl
            call L1E6F
            push bc
            call L1E94
            pop de
            ld b,e
            inc b
            dec b
            jr nz,L39E9
            ld b,c
L39E9       push bc
            call L1E94
            ld l,c
            pop de
            ld a,e
            ld h,d
            pop de
            ld bc,$0934
            call L1EF2
L39F8       call L2D28
L39FB       jp L26C3
            rst $38
            rst $38
            rst $38
            rst $38
            ld d,$FF
L3A04       push $25DB
            push de
            rst $20
            cp $28
L3A0C       jp nz,L1C8A
            call L1C81
            cp $2C
            jr nz,L3A0C
            rst $20
            ld b,a
            ld c,a
            cp $7E
            jr nz,L3A23
            rst $20
            ld c,a
            cp $29
            jr z,L3A2C
L3A23       push bc
            call L1C82
            pop bc
            cp $29
            jr nz,L3A0C
L3A2C       pop de
            rst $20
            call L2530
            ret z
            push de
            push bc
            ld a,c
            cp $29
            call nz,L1E99
            push bc
            call L1E99
            ld d,b
            ld e,c
            pop bc
            pop hl
            pop af
            ex af,af'
            ld a,h
            cp $7E
            jp nz,L3A6F
            ld a,l
            cp $29
            ld hl,$8080
            jr z,L3A5A
            ld h,$FF
            ld l,c
            ld a,b
            and a
            jp nz,L24F9
L3A5A       ld bc,$FFFF
            ex af,af'
            inc a
            jr nz,L3A75
            push de
L3A62       ld a,(de)
            inc de
            inc bc
            and h
            cp l
            jr nz,L3A62
            inc h
            jr z,L3A6D
            inc bc
L3A6D       pop de
            ret
L3A6F       ex af,af'
            inc a
            ret z
            ld hl,$00FF
L3A75       ex de,hl
            dec a
            push bc
            push de
            ld bc,$3308
            call L32C5
            ex af,af'
            pop de
            pop bc
            exx
            ld de,($5C63)
            ld hl,$6000
            and a
            sbc hl,de
            ld b,h
            ld c,l
            call nc,L0030
            ld hl,($5C63)
            push hl
            ld bc,$0000
            exx
L3A9A       ld a,b
            or c
            jr z,L3AB1
            dec bc
            call L08FC
            inc hl
            exx
            push bc
            ld bc,$0001
            rst $30
            pop bc
            ld (de),a
            inc bc
            exx
            and d
            cp e
            jr nz,L3A9A
L3AB1       inc d
            exx
            jr nz,L3AB6
            dec bc
L3AB6       pop de
            ret
            push $25DB
L3ABC       rst $20
            call L1C8C
            cp $7D
            jp nz,L3A0C
            rst $20
            call L2530
            ret z
            call L2BF1
            ld hl,$17CF
            call L1E5F
            ret
L3AD4       push hl
L3AD5       call L1F05
            pop de
            ld hl,($5C3D)
            and a
            sbc hl,bc
            ld ($5C3D),hl
            ld hl,($5C0B)
            sbc hl,bc
L3AE7       ld ($5C0B),hl
            ld hl,$0000
            add hl,sp
            ex de,hl
            sbc hl,de
            push hl
            ld h,d
            ld l,e
            sbc hl,bc
            pop bc
            ld sp,hl
            ex de,hl
            ldir
            ret
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            adc a,a
            ld (hl),$3C
            inc (hl)
            and c
            inc sp
            rrca
            jr nc,L3AD5
            jr nc,L3ABC
            ld sp,$3851
            dec de
            dec (hl)
            inc h
            dec (hl)
            dec sp
            dec (hl)
            dec sp
            dec (hl)
            dec sp
            dec (hl)
            dec sp
            dec (hl)
            dec sp
            dec (hl)
            dec sp
            dec (hl)
            inc d
            jr nc,L3B50
            dec (hl)
            dec sp
            dec (hl)
            dec sp
            dec (hl)
            dec sp
            dec (hl)
            dec sp
            dec (hl)
            dec sp
L3B2D       dec (hl)
            dec sp
            dec (hl)
            sbc a,h
            dec (hl)
            sbc a,$35
            cp h
            inc (hl)
            ld b,l
            ld (hl),$6E
            inc (hl)
            ld l,c
            ld (hl),$DE
            dec (hl)
            ld (hl),h
            ld (hl),$B5
            scf
            xor d
            scf
            jp c,L3337
            jr c,L3B8C
            jr c,L3B2D
            scf
            inc de
            scf
            call nz,LAF36
            ld (hl),$4A
            jr c,L3AE7
            inc (hl)
            ld l,d
            inc (hl)
            xor h
            inc (hl)
            and l
            inc (hl)
            or e
            inc (hl)
            rra
            ld (hl),$C9
            dec (hl)
            ld bc,$2E35
            inc a
            and b
            ld (hl),$86
            ld (hl),$C6
            inc sp
            ld a,d
            ld (hl),$06
            dec (hl)
            ld sp,hl
            inc (hl)
            sbc a,e
            ld (hl),$83
            scf
            inc d
            ld ($0000),a
            ld c,a
            dec l
            sub a
            ld ($3449),a
            dec de
            inc (hl)
            dec l
            inc (hl)
            rrca
            inc (hl)
L3B86       push af
            push ix
            ld a,h
            ld xh,a
L3B8C       ld a,l
            ld xl,a
            ld hl,($5C4B)
            sub l
            ld a,xh
            sbc a,h
            jr nc,L3B9C
            add hl,bc
            ld ($5C4B),hl
L3B9C       ld hl,($5C4D)
            sbc hl,sp
            jr nc,L3BB0
            add hl,sp
            ld a,xl
            sub l
            ld a,xh
            sbc a,h
            jr nc,L3BB0
            add hl,bc
            ld ($5C4D),hl
L3BB0       ld hl,$5C4F
L3BB3       ld e,(hl)
            inc hl
            ld d,(hl)
            ld a,xl
            sub e
            ld a,xh
            sbc a,d
            jr nc,L3BC5
            ex de,hl
            add hl,bc
            ex de,hl
            ld (hl),d
            dec hl
            ld (hl),e
            inc hl
L3BC5       inc hl
            ld a,$65
            cp l
            jp nc,L3BB3
            ex de,hl
            ld e,xl
L3BCF       ld d,xh
            pop ix
            pop af
            and a
            sbc hl,bc
            sbc hl,de
            ld b,h
            ld c,l
            inc bc
            add hl,de
            ex de,hl
            ret
L3BDF       call L2C8D
            ret nc
            and $1F
            add a,$8F
            ret
L3BE8       ld a,$02
            out (c),a
            inc b
            in a,(c)
            and $80
            or $01
            out (c),a
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            rst $38
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            ld bc,$0000
            add a,b
            nop
            nop
            nop
            nop
            add a,c
            ld c,c
            rrca
            jp c,L00A2
            nop
            ld a,(bc)
            nop
            nop
L3C1B       push hl
            ld hl,($5C65)
            ld bc,$0055
            add hl,bc
            jr c,L3C2B
            sbc hl,sp
            jr nc,L3C2B
            pop hl
            ret
L3C2B       jp L1F15
L3C2E       push hl
            ld hl,($5C65)
            ld bc,$0055
            add hl,bc
            jr c,L3C2B
            sbc hl,sp
            jr nc,L3C2B
            pop hl
            ld bc,$0005
L3C40       ldi
            ldi
            ldi
            ldi
            ldi
            ret
            call L2314
            jr nz,L3C62
L3C50       and a
            ret z
            push af
            call L3297
            pop af
            add a,(hl)
            jp c,L31AD
L3C5B       ld (hl),a
            ret
            call L2314
            jr nz,L3C50
L3C62       and a
            ret z
            push af
            call L3297
            pop bc
            ld a,(hl)
            sub b
            jr nc,L3C5B
            ld b,$05
L3C6F       ld (hl),$00
            inc hl
            djnz L3C6F
            ret
            ld bc,$FFFF
            call L2D2F
            ld d,h
            ld e,l
            inc hl
            dec (hl)
            add hl,$FFFA
            ld ix,$3CFB
            jr L3C93
            ld ix,$3CF9
            jr L3C93
            ld ix,$3CF7
L3C93       ld a,(de)
            or (hl)
            jr nz,L3CA5
            push de
            ld b,$03
L3C9A       inc hl
            inc de
            ld a,(de)
            call L0013
            ld (hl),a
            djnz L3C9A
            pop de
            ret
L3CA5       call L3293
            exx
            push hl
            exx
            push de
            push hl
            call L2F9B
            ld b,a
            ex de,hl
            call L2F9B
            ld c,a
            cp b
            jr nc,L3CBC
            ld a,b
            ld b,c
            ex de,hl
L3CBC       push af
            sub b
            call L2FBA
            call L2FDD
            pop af
            pop hl
            ld (hl),a
            push hl
            exx
            ld a,l
            ex af,af'
            ld a,h
            ld hl,$5B5E
            ld (hl),a
            ex af,af'
            call L0013
            ex af,af'
            ld (hl),b
            ld a,d
            call L0013
            ld d,a
            ld (hl),c
            ld a,e
            call L0013
            ld e,a
            ex af,af'
            ld l,a
            exx
            ld hl,$5B5E
            ld (hl),c
            ld a,d
            call L0013
            ld d,a
            ld (hl),b
            ld a,e
            call L0013
            ld e,a
            pop hl
            jp L307C
            and (hl)
            ret
            or (hl)
            ret
            xor (hl)
            ret
            rst $38
            rst $38
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
            djnz L3D1B
            djnz L3D1D
            nop
            djnz L3D10
L3D10       nop
            inc h
            inc h
            nop
            nop
            nop
            nop
            nop
            nop
            inc h
            ld a,(hl)
L3D1B       inc h
            inc h
L3D1D       ld a,(hl)
            inc h
            nop
            nop
            ex af,af'
            ld a,$28
            ld a,$0A
            ld a,$08
            nop
            ld h,d
            ld h,h
            ex af,af'
            djnz L3D54
            ld b,(hl)
            nop
            nop
            djnz L3D5B
            djnz L3D5F
            ld b,h
            ld a,($0000)
            ex af,af'
            djnz L3D3C
L3D3C       nop
            nop
            nop
            nop
            nop
            inc b
            ex af,af'
            ex af,af'
            ex af,af'
            ex af,af'
            inc b
            nop
            nop
            jr nz,L3D5B
            djnz L3D5D
            djnz L3D6F
            nop
            nop
            nop
            inc d
            ex af,af'
L3D54       ld a,$08
            inc d
            nop
            nop
            nop
            ex af,af'
L3D5B       ex af,af'
            ld a,$08
            ex af,af'
L3D5F       nop
            nop
            nop
            nop
            nop
            nop
            ex af,af'
            ex af,af'
            djnz L3D69
L3D69       nop
            nop
            nop
            ld a,$00
            nop
L3D6F       nop
            nop
            nop
            nop
            nop
            nop
            jr L3D8F
            nop
            nop
            nop
            ld (bc),a
            inc b
            ex af,af'
            djnz L3D9F
            nop
            nop
            inc a
            ld b,(hl)
            ld c,d
            ld d,d
            ld h,d
            inc a
            nop
            nop
            jr L3DB3
            ex af,af'
            ex af,af'
            ex af,af'
            ld a,$00
            nop
            inc a
            ld b,d
            ld (bc),a
            inc a
            ld b,b
            ld a,(hl)
            nop
            nop
            inc a
            ld b,d
            inc c
            ld (bc),a
            ld b,d
            inc a
L3D9F       nop
            nop
            ex af,af'
            jr L3DCC
            ld c,b
            ld a,(hl)
            ex af,af'
            nop
            nop
            ld a,(hl)
            ld b,b
            ld a,h
            ld (bc),a
            ld b,d
            inc a
            nop
            nop
            inc a
            ld b,b
L3DB3       ld a,h
            ld b,d
            ld b,d
            inc a
            nop
            nop
            ld a,(hl)
            ld (bc),a
            inc b
            ex af,af'
            djnz L3DCF
            nop
            nop
            inc a
            ld b,d
            inc a
            ld b,d
            ld b,d
            inc a
            nop
            nop
            inc a
            ld b,d
            ld b,d
L3DCC       ld a,$02
            inc a
L3DCF       nop
            nop
            nop
            nop
            djnz L3DD5
L3DD5       nop
            djnz L3DD8
L3DD8       nop
            nop
            djnz L3DDC
L3DDC       nop
            djnz L3DEF
            jr nz,L3DE1
L3DE1       nop
            inc b
            ex af,af'
            djnz L3DEE
            inc b
            nop
            nop
            nop
            nop
            ld a,$00
            ld a,$00
L3DEF       nop
            nop
            nop
            djnz L3DFC
            inc b
            ex af,af'
            djnz L3DF8
L3DF8       nop
            inc a
            ld b,d
            inc b
L3DFC       ex af,af'
            nop
            ex af,af'
            nop
            nop
            inc a
            ld c,d
            ld d,(hl)
            ld e,(hl)
            ld b,b
            inc a
            nop
            nop
            inc a
            ld b,d
            ld b,d
            ld a,(hl)
            ld b,d
            ld b,d
            nop
            nop
            ld a,h
            ld b,d
            ld a,h
            ld b,d
            ld b,d
            ld a,h
            nop
            nop
            inc a
            ld b,d
            ld b,b
            ld b,b
            ld b,d
            inc a
            nop
            nop
            ld a,b
            ld b,h
            ld b,d
            ld b,d
            ld b,h
            ld a,b
            nop
            nop
            ld a,(hl)
            ld b,b
            ld a,h
            ld b,b
            ld b,b
            ld a,(hl)
            nop
            nop
            ld a,(hl)
            ld b,b
            ld a,h
            ld b,b
            ld b,b
            ld b,b
            nop
            nop
            inc a
            ld b,d
            ld b,b
            ld c,(hl)
            ld b,d
            inc a
            nop
            nop
            ld b,d
            ld b,d
            ld a,(hl)
            ld b,d
            ld b,d
            ld b,d
            nop
            nop
            ld a,$08
            ex af,af'
            ex af,af'
            ex af,af'
            ld a,$00
            nop
            ld (bc),a
            ld (bc),a
            ld (bc),a
            ld b,d
            ld b,d
            inc a
            nop
            nop
            ld b,h
            ld c,b
            ld (hl),b
            ld c,b
            ld b,h
            ld b,d
            nop
            nop
            ld b,b
            ld b,b
            ld b,b
            ld b,b
            ld b,b
            ld a,(hl)
            nop
            nop
            ld b,d
            ld h,(hl)
            ld e,d
            ld b,d
            ld b,d
            ld b,d
            nop
            nop
            ld b,d
            ld h,d
            ld d,d
            ld c,d
            ld b,(hl)
            ld b,d
            nop
            nop
            inc a
            ld b,d
            ld b,d
            ld b,d
            ld b,d
            inc a
            nop
            nop
            ld a,h
            ld b,d
            ld b,d
            ld a,h
            ld b,b
            ld b,b
            nop
            nop
            inc a
            ld b,d
            ld b,d
            ld d,d
            ld c,d
            inc a
            nop
            nop
            ld a,h
            ld b,d
            ld b,d
            ld a,h
            ld b,h
            ld b,d
            nop
            nop
            inc a
            ld b,b
            inc a
            ld (bc),a
            ld b,d
            inc a
            nop
            nop
            cp $10
            djnz L3EB5
            djnz L3EB7
            nop
            nop
            ld b,d
            ld b,d
            ld b,d
            ld b,d
            ld b,d
            inc a
            nop
            nop
            ld b,d
            ld b,d
            ld b,d
            ld b,d
L3EB5       inc h
            jr L3EB8
L3EB8       nop
            ld b,d
            ld b,d
            ld b,d
            ld b,d
            ld e,d
            inc h
            nop
            nop
            ld b,d
            inc h
            jr L3EDD
            inc h
            ld b,d
            nop
            nop
            add a,d
            ld b,h
            jr z,L3EDD
            djnz L3EDF
            nop
            nop
            ld a,(hl)
            inc b
            ex af,af'
            djnz L3EF6
            ld a,(hl)
            nop
            nop
            ld c,$08
            ex af,af'
            ex af,af'
L3EDD       ex af,af'
            ld c,$00
            nop
            nop
            ld b,b
            jr nz,L3EF5
            ex af,af'
            inc b
            nop
            nop
            ld (hl),b
            djnz L3EFC
            djnz L3EFE
            ld (hl),b
            nop
            nop
            djnz L3F2B
            ld d,h
            djnz L3F06
L3EF6       djnz L3EF8
L3EF8       nop
            nop
            nop
            nop
L3EFC       nop
            nop
L3EFE       nop
            rst $38
            nop
            inc e
            ld ($2078),hl
            jr nz,L3F85
            nop
            nop
            nop
            jr c,L3F10
            inc a
            ld b,h
            inc a
            nop
L3F10       nop
            jr nz,L3F33
            inc a
            ld ($3C22),hl
            nop
            nop
            nop
            inc e
            jr nz,L3F3D
            jr nz,L3F3B
            nop
            nop
            inc b
            inc b
            inc a
            ld b,h
            ld b,h
            inc a
            nop
            nop
            nop
L3F2A       jr c,L3F70
            ld a,b
            ld b,b
            inc a
            nop
            nop
            inc c
            djnz L3F4C
            djnz L3F46
            djnz L3F38
L3F38       nop
            nop
            inc a
L3F3B       ld b,h
            ld b,h
L3F3D       inc a
            inc b
            jr c,L3F41
L3F41       ld b,b
            ld b,b
            ld a,b
            ld b,h
            ld b,h
L3F46       ld b,h
            nop
            nop
            djnz L3F4B
L3F4B       jr nc,L3F5D
            djnz L3F87
            nop
            nop
            inc b
            nop
            inc b
            inc b
            inc b
            inc h
            jr L3F59
L3F59       jr nz,L3F83
            jr nc,L3F8D
L3F5D       jr z,L3F83
            nop
            nop
            djnz L3F73
            djnz L3F75
            djnz L3F73
            nop
            nop
            nop
            ld l,b
            ld d,h
            ld d,h
            ld d,h
            ld d,h
            nop
L3F70       nop
            nop
            ld a,b
L3F73       ld b,h
            ld b,h
L3F75       ld b,h
            ld b,h
            nop
            nop
            nop
            jr c,L3FC0
            ld b,h
            ld b,h
            jr c,L3F80
L3F80       nop
            nop
            ld a,b
L3F83       ld b,h
            ld b,h
L3F85       ld a,b
            ld b,b
L3F87       ld b,b
            nop
            nop
            inc a
            ld b,h
            ld b,h
L3F8D       inc a
            inc b
            ld b,$00
            nop
            inc e
            jr nz,L3FB5
            jr nz,L3FB7
            nop
            nop
            nop
            jr c,L3FDC
            jr c,L3FA2
            ld a,b
            nop
            nop
            djnz L3FDB
            djnz L3FB5
            djnz L3FB3
            nop
            nop
            nop
            ld b,h
            ld b,h
            ld b,h
            ld b,h
            jr c,L3FB0
L3FB0       nop
            nop
            ld b,h
L3FB3       ld b,h
            jr z,L3FDE
            djnz L3FB8
L3FB8       nop
            nop
            ld b,h
            ld d,h
            ld d,h
            ld d,h
            jr z,L3FC0
L3FC0       nop
            nop
            ld b,h
            jr z,L3FD5
            jr z,L400B
            nop
            nop
            nop
            ld b,h
            ld b,h
            ld b,h
            inc a
            inc b
            jr c,L3FD1
L3FD1       nop
            ld a,h
            ex af,af'
            djnz L3FF6
            ld a,h
            nop
            nop
            ld c,$08
L3FDB       jr nc,L3FE5
            ex af,af'
L3FDE       ld c,$00
            nop
            ex af,af'
            ex af,af'
            ex af,af'
            ex af,af'
L3FE5       ex af,af'
            ex af,af'
            nop
            nop
            ld (hl),b
            djnz L3FF8
            djnz L3FFE
            ld (hl),b
            nop
            nop
            inc d
            jr z,L3FF4
L3FF4       nop
            nop
L3FF6       nop
            nop
L3FF8       inc a
            ld b,d
            sbc a,c
            and c
            and c
            sbc a,c
L3FFE       ld b,d
            inc a

