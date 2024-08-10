            nop
            jp L3F00
            rst $38
            rst $38
            rst $38
            rst $38
            jp L0DA3
            nop
            nop
            nop
            nop
            nop
            ld ($5B52),hl
            pop hl
            push af
            jp L0E77
            jp L2B05
            ldir
            ret
            rst $08
            djnz L004B
            ld e,l
            ld e,h
            jp L3ECF
            and b
            nop
            ld ($5B54),bc
            ex (sp),hl
            jp L2CF7
            jp L2AEE
            nop
            nop
            nop
            nop
            nop
            push af
            push hl
            ld h,$00
            ld a,$80
            jp L0046
            nop
            nop
            nop
            nop
            nop
L0046       out ($E3),a
            ld b,e
            ld a,($442F)
            ld c,a
            ld d,h
            cpl
            ld b,(hl)
            ld c,l
            rst $38
L0052       call L3842
            or e
            or d
            or c
            ret
L0059       call L26CB
            sbc a,h
            add hl,hl
            ret
            nop
            pop hl
            pop af
            ei
            ret
            nop
            nop
            retn
L0068       ld ($5B54),bc
            ex (sp),hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ex (sp),hl
L0072       push $007B
            push bc
            ld bc,($5B54)
            nextreg $8C,$80
            ret
L0080       ld ($5B54),bc
            ex (sp),hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ex (sp),hl
            push $3E93
            push $007B
            push bc
            push $007B
            jp L3E8F
            inc de
            push de
            call L3823
            pop hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            ld d,a
            ld a,c
            cp d
            jr nc,L00AA
            rst $08
            inc de
L00AA       dec b
            jr z,L00B3
            rlc d
            rlc c
            jr L00AA
L00B3       rst $18
            ld a,c
            cpl
            ld c,a
            ld hl,$3760
            rst $00
            ld l,l
            nop
            and c
            or d
            rst $00
            ld (hl),d
            nop
            rst $30
            ret
            call L08E9
            ld a,$10
            jr z,L00E0
            call L0DFC
            call L0914
            bit 6,(iy+$01)
            jr z,L011D
            call L3823
            rrca
            cp $18
            jp nz,L334E
L00E0       call L0914
            rst $18
            rst $00
            ld (hl),b
            dec c
            jr nc,L0135
            rst $30
L00EA       ex af,af'
            xor a
            ld ($5B5C),a
            ld (iy+$0A),$FF
            ld a,e
            res 4,(iy+$01)
            ld hl,(RAMTOP)
            ld (hl),$3E
            dec hl
            ld sp,hl
            ld hl,$1303
            push hl
            ld (ERRSP),sp
            set 1,(iy+$01)
            ld hl,$006B
            ld de,$5B00
            ld bc,$0058
            exx
            ld hl,$018D
            ld bc,$001C
            jr L0185
L011D       call L3842
            ex de,hl
            ld de,$DA31
            call L2B1C
            rst $18
            ld a,$FF
            ld (de),a
            xor a
            call L14A9
            ld hl,$DA31
            rst $00
            nop
L0135       jp L0DCE
            rst $18
            ld a,$10
            rst $00
            ld (hl),b
            dec c
            jp nc,L0135
            nextreg $C4,$00
            ld sp,$5BFF
            ld ix,($5C78)
            ld a,($5C7A)
            ld l,a
            ld bc,$7FFD
            ld h,$08
L0155       ld a,h
            dec a
            or $10
            out (c),a
            exx
            ld hl,$C000
            ld de,$C001
            ld bc,$3FFF
            cp $15
            jr nz,L016E
            ld h,$DB
            ld d,h
            ld b,$24
L016E       ld (hl),l
            ldir
            exx
            dec h
            jr nz,L0155
            ld ($5C78),ix
            ld a,l
            ld ($5C7A),a
            ld a,e
            exx
            ld hl,$01A9
            ld bc,$0038
L0185       ld de,$5BB8
            push de
            ldir
            exx
            ret
            nextreg $8E,$03
            nextreg $82,a
            ex af,af'
            nextreg $8C,a
            push $1B76
            bit 5,a
            jp nz,L0EDF
            call L5B43
            ldir
            jp L5B00
            nextreg $8E,$03
            nextreg $82,a
            xor a
            out (c),a
            nextreg $8C,$C0
            ld hl,$5BD3
            ld ($25C6),hl
            nextreg $8C,$80
            jp L00EA
            pop hl
            nextreg $8C,$C0
            ld hl,$36A8
            ld ($25C6),hl
            nextreg $8C,$80
            ld bc,$243B
            ld a,$24
            out (c),a
            nextreg $C4,$81
            jp L2831
            call L3823
            cp $80
L01E6       jp nc,L13E6
            push af
            call L3823
            cp $02
            jr nc,L01E6
            rra
            pop bc
            ld a,b
            jr nc,L01F8
            or $80
L01F8       ld ($5C81),a
            ld hl,$2252
            call L26CB
            ld d,b
            ld ($CDC9),hl
            inc hl
L0206       jr c,L0206
            jr nz,L0232
            add hl,bc
            cp $40
            jr z,L0214
            cp $55
            jp nz,L13E6
L0214       rst $18
            ld l,a
            call L0080
            ld h,l
            inc de
            rst $30
            ret
            nop
            nop
            nop
            nop
            rra
            rra
            rra
            rra
            dec h
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
L0232       rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            ld ($1F40),hl
            rra
            rra
            rra
            jr z,L0267
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            rra
            rra
            rra
            rra
            rra
            rra
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
L0267       dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            dec h
            rra
            rra
            rra
            rra
            rra
            rra
            add hl,de
            inc e
            pop de
            ld sp,$1F94
            rra
            cp (hl)
            call z,L1F1F
            rra
            rra
            rra
            dec bc
            ld (hl),e
            halt
            ld a,c
            ld a,h
            ld a,a
            xor (hl)
            add a,d
            add hl,bc
            add a,l
            adc a,b
            dec c
            rrca
            ld de,$8B13
            adc a,(hl)
            or d
            or (hl)
            cp d
            dec d
            sub c
            rra
            rra
            rra
            rra
            and $1F
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rra
            rla
            rra
            rra
            rra
            ld h,a
            ld (hl),b
L02D0       xor e
            dec hl
            ld l,l
            ret po
            ld l,d
            ld bc,$9F01
            rst $00
            nop
            nop
            nop
            nop
            nop
            nop
            and e
            ld h,c
            ld h,h
            scf
            ld e,b
            ld e,e
            ld e,(hl)
            ld b,e
            and a
            ld c,h
            jp c,LF340
            inc bc
            inc (hl)
            dec a
            ld bc,$0246
            ld d,l
            call pe,L3AC2
            sub a
            dec b
            ld bc,$2E49
            ld d,d
            sbc a,e
            ld c,a
            call nc,L0707
            dec bc
            ld (bc),a
            rrca
            add hl,sp
            rrca
            dec a
            rrca
            nop
            rrca
            ld c,l
            rrca
            ld c,c
            rrca
            ld (de),a
            rrca
            ld d,l
            rrca
            ld h,l
            rrca
            ld e,e
            rrca
            ld (hl),l
            rrca
            ld d,c
            inc c
            jp po,L0E3F
            inc ix
            djnz L02D0
            add hl,bc
            djnz L0386
            add hl,bc
            ld c,$A9
            dec b
            ld c,$0A
            inc de
            ld a,(bc)
            rrca
            ld b,c
            inc bc
            ld b,$1D
            ld c,$9E
            dec e
            ld c,$E2
            dec h
            inc c
            di
            ld (hl),$0E
            push de
            ld l,$0E
            ld yl,$0E
            add hl,sp
            add hl,bc
            inc c
            add hl,sp
            inc (hl)
            ld c,$DB
            dec (hl)
            dec c
            cp l
            ccf
            inc c
            jr L0385
            dec c
            ld h,e
            inc (hl)
            inc c
            adc a,c
            ld (hl),$00
            jp po,L0E36
            or h
            inc (hl)
            ld c,$AC
            dec (hl)
            ld c,$4C
            ld (hl),$0E
            pop de
            ld l,$0E
            rst $10
            dec (hl)
            ld c,$AB
            jr nz,L036B
L036B       ld l,h
            ccf
            ld c,$F3
            nop
            ld c,l
            sbc a,a
            ld c,$EA
            dec e
            ld c,$C9
            jr nz,L0388
            push de
            jr nz,L038B
            jr nz,L03A2
            ld c,$A6
            inc hl
            nop
            adc a,e
            jr nz,L0394
L0386       ld (hl),d
            dec e
L0388       inc c
            sub (hl)
            dec hl
L038B       ld c,$6B
            add a,l
            ld c,$FF
            xor d
            ld c,$7F
            sub (hl)
L0394       ld c,$90
            rra
            add hl,bc
            inc c
            pop de
            jp pe,L0E09
            or e
            ld (hl),$08
            inc c
            ret m
L03A2       ld b,e
            ex af,af'
            inc c
            ld a,d
            ld e,(hl)
            ld b,$0C
            sub h
            ld h,d
            ld c,$34
            xor e
            ex af,af'
            ld c,$04
            ld a,$0A
            inc c
            push de
            xor d
            ld a,(bc)
            inc c
            ex de,hl
            xor d
            ld a,(bc)
            inc c
            ret m
            xor d
            ex af,af'
            inc c
            pop de
            ccf
            ld b,$2C
            ld c,$9E
            inc sp
            add hl,bc
            inc l
            nop
            inc d
            dec l
            ld b,$2C
            ld c,$97
            inc sp
            inc bc
            jp po,L051C
            inc a
            ccf
            inc c
            di
            inc h
            dec b
            jr nc,L041C
            ld c,$02
            ld l,h
            ld b,$2C
            ld a,(bc)
            inc c
            ld e,e
            ccf
            ex af,af'
            call z,L0C01
            ret
            ccf
            dec b
            inc (hl)
            ccf
            inc b
            inc c
            in a,($1E)
            inc b
            dec a
            ld b,$CC
            inc bc
            ld d,(hl)
            ld e,$CD
            add a,b
            nop
            inc e
            ld a,(de)
            ret
            ld (bc),a
            dec c
            ld a,($8303)
            add a,d
            ld a,(bc)
            call z,L0A0F
            inc bc
            xor d
            ret po
            inc hl
            ld a,h
            ld a,a
            ld a,(hl)
            add a,b
            ld bc,$02E6
            add a,b
            ld b,$0F
            add hl,de
            rrca
            sub e
            call pe,LF4ED
            adc a,c
            rst $38
            jp nc,LFD9C
            push hl
            jp z,LD5F0
            ret nz
            ret nc
            ld (hl),b
            halt
            ld l,a
            ld (hl),c
            halt
            ld a,d
            add a,c
            add a,e
            add a,l
            add a,a
            adc a,c
            adc a,e
            adc a,(hl)
            sub b
            halt
            ld (hl),l
            ld bc,$8E23
            sub b
            ld bc,$92AC
            sub h
            inc bc
            cp a
            rst $18
            call z,L9292
            sub l
            sub a
            ld bc,$98CC
            sbc a,d
            ld bc,$9A8E
            sbc a,h
            ld bc,$9CD5
            sbc a,a
            ld (bc),a
            sbc a,d
            jp (hl)
            sbc a,a
            and c
            and e
            inc b
            jp (hl)
            ret nc
            sbc a,$FD
            and e
            and e
            and l
            and a
            xor c
            rlca
            sbc a,l
            sbc a,$9A
            xor h
            jp nc,LE9FD
            and e
            and l
            and a
            xor c
            xor h
            xor a
            or h
            or (hl)
            ex af,af'
            xor e
            exx
            jp c,LDCDB
            xor d
            jp nz,LB2EF
            or h
            cp b
            cp h
            push bc
            cp a
            ret z
            set 1,l
            inc c
            xor h
            ld c,(hl)
            ld a,(bc)
            inc c
            out ($A4),a
            inc c
            ldix
            inc hl
            nop
            ld sp,hl
            and h
            ld bc,$660C
            ld ($0EEF),a
            cp e
            dec h
            ld c,$BF
            dec h
            ld c,$17
            inc hl
            ld b,$2C
            ld c,$7D
            inc sp
            ld b,$2C
            ld c,$76
            inc sp
            inc c
            adc a,(hl)
            jr nc,L04BF
            dec hl
            ld sp,$BE0E
            jr nc,L04BA
            sbc a,b
            ld sp,$8B0C
            ld ($450E),a
            ld (hl),$08
            inc c
            ld l,a
            xor $0E
            jp z,L0C35
            ld (bc),a
            ret p
            ld c,$DE
            dec h
            inc hl
            ex af,af'
            inc c
            ld (hl),h
            ccf
            ld c,$45
            inc (hl)
            nop
            ex af,af'
            dec l
            cp a
            ld a,(bc)
            inc c
            ld b,a
            xor c
            inc c
            ld a,e
            xor c
            ld a,(bc)
            inc c
            jp p,L0CA8
            ld l,b
            inc l
            ld c,$BD
            dec e
            inc c
            ld l,a
            jr nz,L04ED
L04ED       ld (hl),l
            jr nz,L04F8
            inc c
            exx
            nop
            inc c
            sub d
            rst $28
            ld c,$35
            adc a,a
            inc bc
            rst $28
            sub c
            ex af,af'
            inc l
            ex af,af'
            ld c,$38
            sub d
            jp (hl)
            nop
            inc a
            sub (hl)
            nop
            xor d
            sub h
            nop
            ld h,b
            sub (hl)
            inc c
            ld l,a
            dec d
            inc bc
            push de
            inc de
            inc bc
            call c,L0094
            rst $10
            sub d
            ex af,af'
            inc c
            inc sp
L051C       sub e
            ex af,af'
            ld c,$F1
            sub d
            ex af,af'
            inc l
            ex af,af'
            ld c,$F8
            sub e
            inc c
            cp a
            inc d
            ex af,af'
            inc l
            ex af,af'
            inc c
            adc a,h
            sub e
            ld c,$C4
            nop
            nop
            sbc a,d
            nop
            rst $38
            ld bc,$9A00
            nop
            rlca
            ld bc,$9A00
            nop
            rlca
            inc b
            nop
            sbc a,d
            nop
            ld bc,$0007
            sbc a,d
            nop
            ld bc,$0808
            inc c
            pop hl
            ld bc,$0400
            ld (bc),a
            inc c
            jr c,L0557
            inc a
L0557       ld c,h
            ld e,b
            ld a,($F5E8)
            exx
            sbc a,a
            sbc a,$62
            ld e,e
            sbc a,b
            dec c
            rlca
            inc c
            call z,LC101
            jr L0570
            push de
            call L0DF0
            pop de
            cp a
L0570       pop bc
            call z,L0914
            ex de,hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            ex de,hl
            ld a,b
            add a,a
            ld a,(hl)
            jr c,L0583
            jp m,L3EBF
            push bc
            ret
L0583       res 7,b
            jp p,L0072
            res 6,b
            ld ($5B56),a
            ld a,$8A
            jp L26DA
            cp a
            push af
            call L0635
            call L3EC9
            ld b,a
            pop af
            ld de,($5C74)
            ld a,b
            jr L0570
L05A3       ld bc,$1C1F
            jp L3EC1
            ld a,xh
            dec hl
            ld ($5C5D),hl
            push bc
            pop bc
            push hl
            cp $25
            jp nz,L068D
            jp L067C
            rst $20
L05BB       ld bc,$1C8C
            jp L3EC1
            bit 7,(iy+$01)
            call nz,L133A
            call L3EC9
            call L2F69
            call L3FED
            jr nc,L05F4
            ld hl,($5C6C)
            ld b,(iy+$57)
            ld de,$0000
            bit 0,b
            jr z,L05EA
            dec e
            bit 2,b
            jr nz,L05F0
            ld a,h
            xor l
            ld d,a
            jr L05F0
L05EA       ld d,l
            bit 2,b
            jr z,L05F0
            ld d,h
L05F0       ld ($5C6C),de
L05F4       call L3EC9
            jr L063C
            jp L15DF
            bit 7,(iy+$01)
            push ix
            res 0,(iy+$02)
            jr z,L0614
            ld a,$FE
            rst $28
            ld bc,$EF16
            ld c,l
            dec c
            set 5,(iy+$45)
L0614       pop af
            pop bc
            call L2F84
            res 5,(iy+$45)
            call L0914
            ld hl,($5C8F)
            ld ($5C8D),hl
            ld hl,$5C91
            ld a,(hl)
            rlca
            xor (hl)
            and $AA
            xor (hl)
            ld (hl),a
            ret
            jp L08C9
L0634       rst $20
L0635       ld bc,$1C82
            jp L3EC1
L063B       rst $20
L063C       ld bc,$1C7A
            jp L3EC1
L0642       res 0,(iy+$01)
            rst $28
            ld l,h
            inc e
            bit 0,(iy+$01)
            ret z
            rst $08
            ld h,b
            ex de,hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ld ($5C74),hl
            cp $23
            ret nz
            pop hl
            push bc
            call L0634
            cp $CC
            jp nz,L09AF
            rst $20
            call L05A3
            bit 6,(iy+$01)
            jp z,L09AF
            pop bc
            call L0914
            push bc
            call L3823
            rst $28
            ld bc,$C916
L067C       call L26CB
            xor c
            add hl,hl
            jr c,L0688
            pop hl
            call L0914
            ret
L0688       pop hl
            push hl
            ld ($5C5D),hl
L068D       call L05A3
            call L3EC9
            cp $3D
            jr nz,L06A3
            pop hl
            rst $20
            ld bc,$1C56
            call L3EC1
            call L0914
            ret
L06A3       cp $2C
            jr z,L06E2
            pop hl
            call L0882
L06AB       bit 2,(iy+$30)
            jr nz,L06BB
L06B1       call L0829
            call L07FD
            call L0914
            ret
L06BB       ld a,c
            cp $CF
            jr nz,L06B1
            ld bc,$1C82
            call L3EC1
            call L0914
            call L26CB
            pop af
            inc h
            ld b,d
            ld c,e
            ld hl,($5C4D)
            call L26CB
            ld h,b
            jr z,L0704
            ex de,hl
            add hl,bc
            ex de,hl
            call L26CB
            ld d,l
            jr z,L06AB
L06E2       ld b,$00
            jr L06ED
L06E6       push de
            push bc
            rst $20
            call L05A3
            pop bc
L06ED       pop de
            inc b
            ld a,($5C3B)
            push af
            call L3EC9
            cp $2C
            jr z,L06E6
            push bc
            call L0882
            pop af
            push de
            ld d,a
            ld e,$00
L0703       inc e
L0704       push bc
            push de
            call L0DFC
            ld a,($5C3B)
            and $C0
            cp $80
            jr nz,L0743
            ld hl,($5C65)
            dec hl
            ld b,(hl)
            dec hl
            ld c,(hl)
            dec hl
            ld d,(hl)
            dec hl
            ld e,(hl)
            sbc hl,de
            jr c,L0729
            ld hl,($5C61)
            scf
            sbc hl,de
            jr c,L0732
L0729       push de
            rst $28
            jr nc,L072D
L072D       pop hl
            push de
            ldir
            pop de
L0732       ld hl,($5C61)
            ex de,hl
            and a
            sbc hl,de
            ex de,hl
            ld hl,($5C65)
            dec hl
            dec hl
            dec hl
            ld (hl),d
            dec hl
            ld (hl),e
L0743       pop de
            pop bc
            ld a,d
            cp e
            jp c,L0880
            call L07E2
            call L3EC9
            cp $2C
            jr nz,L0757
            rst $20
            jr L0703
L0757       ld ($5C5F),hl
            ld b,e
L075B       ld a,e
            cp d
            jr nc,L0765
            inc e
            call L07E2
            jr L075B
L0765       ld e,b
            pop hl
            ld b,d
            bit 7,(iy+$01)
            jr z,L07D0
            ld ($5C5D),hl
            ld b,$01
L0773       push de
            push bc
            call L05A3
            pop bc
            push bc
            ld a,c
            and $3F
            cp $38
            jr nz,L07DD
            bit 6,(iy+$01)
            call z,L087D
L0788       exx
            pop bc
            pop de
            push de
            push bc
            ld a,e
            cp b
            jr c,L0792
            ld a,b
L0792       ld d,a
            dec d
            ld e,$05
            mul d,e
            ld hl,($5C63)
            add hl,de
            ld a,(hl)
            inc hl
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            exx
            bit 6,c
            exx
            jr nz,L07B0
            ld hl,($5C61)
            add hl,de
            ex de,hl
L07B0       call L386C
            exx
            ld a,c
            exx
            ld e,a
            and $3F
            cp $38
            jr z,L07C2
            call L081E
            jr L07C8
L07C2       ld a,($5C3B)
            call L0810
L07C8       pop bc
            pop de
            rst $20
            inc b
            dec d
            jr nz,L0773
            dec b
L07D0       pop hl
            djnz L07D0
            ld hl,($5C5F)
            ld ($5C5D),hl
            call L0914
            ret
L07DD       call L0829
            jr L0788
L07E2       ld a,d
            sub e
            inc a
            ld h,$00
            ld l,a
            inc hl
            add hl,hl
            add hl,sp
            inc hl
            bit 6,(hl)
            ld l,c
            call z,L0870
            ld a,($5C3B)
            xor c
            ld c,l
            and $40
            ret z
            jp L0880
L07FD       call L3EC9
            cp $25
            jr z,L0817
            ld a,($5C3B)
            push af
            ld d,$00
            ld b,$01
            rst $28
            sub (hl)
            dec h
L080F       pop af
L0810       ld bc,$1C5E
            call L3EC1
            ret
L0817       push bc
            call L26CB
            nop
            inc h
            pop de
L081E       ld a,($5C3B)
            push af
            ld b,$00
            rst $28
            adc a,$27
L0827       jr L080F
L0829       bit 2,(iy+$30)
            jr z,L0843
            push bc
            ld hl,($5C4D)
            call L26CB
            ld h,b
            jr z,L087B
            ld c,e
            bit 7,(iy+$01)
            call nz,L3867
            pop bc
            ret
L0843       bit 1,(iy+$37)
            jp nz,L252D
            ld hl,($5C4D)
            bit 6,(iy+$01)
            jr z,L0862
            inc hl
            bit 7,(iy+$01)
            ret z
            push bc
            ld bc,$33B4
            call L3EC1
            pop bc
            ret
L0862       ex de,hl
            push bc
            ld bc,($5C72)
            bit 7,(iy+$01)
            call nz,L385E
            pop bc
L0870       ld a,c
            cp $CF
            ld c,$17
            ret z
            cp $C4
            ld c,$7B
            ret z
L087B       cp $F8
L087D       ld c,$38
            ret z
L0880       rst $08
            dec bc
L0882       ld hl,$08B3
            ld bc,$000B
            cpir
            jr nz,L0880
            jp pe,L08A3
            push hl
            call L3EC9
            push hl
            rst $20
            pop hl
            cp $7C
            jr nz,L089F
            ld d,$FF
            pop hl
            jr L08A8
L089F       ld ($5C5D),hl
            pop hl
L08A3       add hl,$000A
            ld c,(hl)
L08A8       cp $3D
            jr z,L08B1
            rst $20
            cp $3D
            jr nz,L0880
L08B1       rst $20
            ret
            dec hl
            dec l
            ld hl,($262F)
            ld a,h
            adc a,h
            adc a,l
            adc a,e
            dec a
            ld e,(hl)
            rst $08
            jp LC5C4
            cp $C1
            jp nz,LF8FC
            add a,$EB
            ld l,(hl)
            ld h,$04
            ld c,(hl)
            ld b,$00
            ld e,c
            ld d,b
            inc hl
            cpir
            jr nz,L08D8
            add hl,de
L08D8       ld e,(hl)
            add hl,de
            ld ($5C74),hl
            ld ($5B5E),a
            ret nz
            add a,a
            ret nc
            jp L0020
L08E6       cp $29
            ret z
L08E9       cp $0D
            ret z
            cp $3A
            ret
L08EF       push af
            call L0AA1
            pop af
L08F4       pop hl
            ld e,(hl)
            bit 7,e
            jr z,L0905
            cp $0A
            jr nc,L0902
            add a,$3D
            jr L0904
L0902       add a,$18
L0904       ld e,a
L0905       ld h,e
            ld l,$0D
            push hl
            ld l,$CD
            ld h,$A3
            push hl
            xor a
            ld hl,$0000
            add hl,sp
            jp (hl)
L0914       bit 7,(iy+$01)
            ret nz
            pop bc
            pop bc
            jr L0956
L091D       res 7,(iy+$01)
            rst $28
            ei
            add hl,de
            xor a
            ld ($5C47),a
            dec a
            ld ($5C3A),a
L092C       call L3EC9
            jr L0962
L0931       call L2B50
            call L3EC9
            jr L096D
            pop bc
L093A       bit 7,(iy+$01)
            ret z
L093F       ld hl,($5C55)
            call L3995
            ret nc
L0946       ld ($5C55),hl
            ex de,hl
            ld ($5C5D),hl
            ld (iy+$0D),$00
            jr L0961
L0953       call L2B50
L0956       call L3EC9
            cp $0D
            jr z,L093A
            cp $3A
            jr nz,L09AF
L0961       rst $20
L0962       ld hl,$5C47
            bit 7,(hl)
            jr nz,L093A
            inc (hl)
            jp m,L09AF
L096D       ld hl,($5C61)
            ld ($5C63),hl
            ld ($5C65),hl
            ld hl,$5C92
            ld ($5C68),hl
            cp $0D
            jr z,L093A
            ld l,a
            ld xh,a
            ld h,$02
            ld l,(hl)
            inc h
            ld de,$0953
            push de
            ex de,hl
            rst $20
            ex de,hl
            jr L0993
            ld hl,($5C74)
L0993       ld a,(hl)
            inc hl
            ld ($5C74),hl
            ld de,$0990
            push de
            cp $20
            jr nc,L09B1
            ex de,hl
            ld hl,$0556
            add hl,a
            ld a,(hl)
            add hl,a
            push hl
            call L3EC9
            and a
            ret
L09AF       rst $08
            dec bc
L09B1       ld c,a
            call L3EC9
            cp c
            jr nz,L09AF
            rst $20
            ret
L09BA       ld a,b
            cpl
            ld h,a
            ld a,c
            cpl
            ld l,a
            inc hl
            add hl,sp
            ld sp,hl
            push bc
            push hl
            ex de,hl
            ldir
            pop hl
            rst $28
            ld c,$25
            pop hl
            add hl,sp
            ld sp,hl
            ret
L09D0       ld hl,($5C59)
            ld ($5C5D),hl
            call L3EC9
            ret
L09DA       call L09D0
            cp $2E
            ret z
            cp $F1
            jr z,L09EE
            cp $CE
            ret nc
            cp $A5
            jr nc,L09EE
            cp $8F
            ret nc
L09EE       ld b,a
L09EF       rst $20
            cp $3A
            ret z
            cp $0D
            jr nz,L09EF
            ld a,b
            cp $F1
            scf
            ret
L09FC       rst $08
            add hl,de
            ld (iy+$31),$02
            ld hl,$0AEF
            ld ($5B6C),hl
            ld (iy),$FF
            ld hl,$5B3A
L0A0F       push hl
            ld (ERRSP),sp
            call L09D0
            rst $18
            ld a,($D5B8)
            rst $30
            cp $04
            jp nz,L091D
            call L09DA
            jr nc,L09FC
            jp z,L091D
            ld hl,$FFFE
            ld ($5C45),hl
            res 7,(iy+$01)
            call L09D0
            call L0DFC
            bit 6,(iy+$01)
            jr z,L09FC
            cp $0D
            jr nz,L09FC
            ld a,$0D
            call L0080
            sub $03
            set 7,(iy+$01)
            call L09D0
            ld hl,$0B9E
            ld ($5B6C),hl
            call L0DFC
            bit 6,(iy+$01)
            jr z,L09FC
            ld de,$5B6E
            ld hl,($5C65)
            ld bc,$0005
            or a
            sbc hl,bc
            ldir
            ld bc,$0001
            rst $28
            jr nc,L0A74
L0A74       ld ($5C5B),hl
            push hl
            ld hl,($5C51)
            push hl
            ld a,$FF
            rst $28
            ld bc,$EF16
            ex (sp),hl
            dec l
            pop hl
            rst $28
            dec d
            ld d,$D1
            ld hl,($5C5B)
            and a
            sbc hl,de
L0A8F       ld a,(de)
            call L0080
            sub $03
            inc de
            dec hl
            ld a,h
            or l
            jr nz,L0A8F
L0A9B       ld a,$0D
            rst $28
            djnz L0AA0
L0AA0       ret
L0AA1       rst $18
            ld b,$00
            rst $00
            add hl,bc
            ld bc,$0538
            ld b,$00
            rst $00
            inc c
            ld bc,$C9F7
            call L0AA1
            call L0ABA
            ld hl,($5B6C)
L0AB9       jp (hl)
L0ABA       xor a
L0ABB       push af
            rst $00
            ld e,c
            nop
            pop af
            inc a
            cp $03
            jr c,L0ABB
            ret
            nextreg $51,$10
            ld hl,(RAMTOP)
            inc hl
            and a
            sbc hl,sp
            ld ($2393),hl
            ld b,h
            ld c,l
            ld hl,$0000
            add hl,sp
            push de
            ld de,$2216
            ldir
            pop de
            ld sp,hl
            nextreg $51,$FF
            ld b,$3E
            push bc
            ld (DEFADD),sp
            jr L0B51
            bit 7,(iy)
            ret z
            rst $28
            ei
            add hl,de
            ld a,b
            or c
            jp nz,L0D3C
            call L3EC9
            cp $0D
            ret z
            pop hl
            pop hl
            pop hl
            bit 6,(iy+$02)
            jr nz,L0B10
            call L3E80
            ret
            ld c,$FD
            rlc d
            or (hl)
            rst $18
            ld a,($D5B8)
            cp $08
            jr nz,L0B38
            ld a,($5B7B)
            ld ($D5BA),a
            ld a,($5C7F)
            ld ($D5B9),a
            bit 3,a
            jr z,L0B38
            ld ix,$FB00
            ld hl,$0048
            call L3E80
            dec hl
            daa
L0B38       ld hl,($D5B7)
            ld a,l
            and $40
            or h
            push af
            call z,L3689
            call L3E80
            ld c,$F1
            call z,L3689
            rst $30
            ld de,($5C59)
L0B51       ld hl,$0B9E
            ld ($5B6C),hl
            push de
            call L105E
            pop de
            ld hl,$5B3A
            push hl
            ld (ERRSP),sp
            push de
            call L0068
            jr nz,L0B98
            pop de
            ld hl,$5C3C
            res 3,(hl)
            ld a,$19
            sub (iy+$4F)
            ld ($5C8C),a
            set 7,(iy+$01)
            dec de
            ld hl,$FFFE
            ld ($5C45),hl
            ld hl,($5C61)
            dec hl
            ld a,$FF
            push hl
            call L38D4
            pop hl
            jp L0946
            rst $18
            call L3E80
            ld c,$F7
L0B98       ld (iy),$0F
            jr L0C1C
            push hl
            push hl
            ld c,$23
            call L3B18
            call nc,L3A86
            pop hl
            pop hl
            ld hl,$5C47
            ld a,(hl)
            push af
            ld a,($5C3A)
            inc a
            jr z,L0BD3
            ex af,af'
            call L38E3
            jr z,L0BC1
            ld a,($5B77)
            ld ($5EBA),a
L0BC1       ex af,af'
            cp $09
            jr z,L0BCA
            cp $15
            jr nz,L0BCB
L0BCA       inc (hl)
L0BCB       ld bc,$0003
            ld de,$5C70
            lddr
L0BD3       pop bc
            ld (iy+$0D),b
            and a
            jr z,L0C1C
            ld hl,$3140
            ld e,a
            call L3EB7
            ld hl,$3142
            ld de,($5C45)
            call L3EB9
            ld hl,$3144
            ld de,($5C47)
            res 7,e
            call L3EB7
            ld hl,$3146
            ld de,($5B77)
            call L3EB7
L0C01       ld hl,$5B3A
            push hl
            ld hl,$092C
            push hl
            ld c,$4B
            call L3A86
            jr c,L0C1A
            ld a,$4B
            call L3A40
            ld (iy),$FF
            ret
L0C1A       pop hl
            pop hl
L0C1C       call L0068
            add a,a
            dec l
            ld a,($5B68)
            bit 0,a
            jr z,L0C43
            nextreg $51,$10
            ld hl,(RAMTOP)
            inc hl
            ld bc,($2393)
            and a
L0C35       sbc hl,bc
            ld sp,hl
            ex de,hl
            ld hl,$2216
            ldir
            nextreg $51,$FF
            ret
L0C43       res 5,(iy+$01)
            ld a,($5C3A)
            inc a
            push af
            ld hl,($5C61)
            push hl
            ld hl,$0000
            ld (iy+$37),h
            ld (iy+$26),h
            rst $18
            ld a,($D5B8)
            rst $30
            cp $08
            jr nz,L0C7C
            ld a,($5C7F)
            and $0F
            cp $09
            jr nz,L0C79
            ld ix,$FB00
            ld hl,$004C
            call L3E80
            daa
            daa
            jr L0C7C
L0C79       call L0A9B
L0C7C       rst $28
            or b
            ld d,$CD
            add a,b
            ld a,$C9
            ld c,$FD
            rlc d
            xor $3E
            call L1368
            pop de
            pop af
            ld b,a
            cp $FF
            jr nz,L0C99
            call L37D6
            jr L0CC2
L0C99       and a
            jr nz,L0CA4
            rst $18
            ld a,($D5B8)
            rst $30
            and a
            jr nz,L0D10
L0CA4       cp $0A
            jr c,L0CB6
L0CA8       cp $1D
            jr c,L0CB4
            cp $2C
            jr nc,L0CBE
            add a,$14
            jr L0CB6
L0CB4       add a,$07
L0CB6       rst $28
            rst $28
            dec d
            ld a,$20
            rst $28
            djnz L0CBE
L0CBE       ld a,b
            call L0D1B
L0CC2       xor a
            ld de,$1536
            rst $28
            ld a,(bc)
            inc c
            call L38E3
            jr z,L0CE2
            ld a,($5B77)
            inc a
            jr z,L0CE2
            dec a
            ld c,a
            ld b,$00
            rst $28
            dec de
            ld a,(de)
            ld a,$3A
            rst $28
            djnz L0CE0
L0CE0       scf
            sbc a,a
L0CE2       ld bc,($5C45)
            jr nz,L0CFE
            bit 7,b
            jr nz,L0CFE
            ld a,($5C3A)
            inc a
            jr z,L0CFE
            cp $0D
            jr z,L0CFE
            cp $15
            jr z,L0CFE
            ld ($5C49),bc
L0CFE       rst $28
            dec de
            ld a,(de)
            ld a,$3A
            rst $28
            djnz L0D06
L0D06       ld c,(iy+$0D)
            res 7,c
            ld b,$00
            rst $28
            dec de
            ld a,(de)
L0D10       ld hl,$5BFF
            ld ($5B6A),hl
            call L3E80
            ld h,b
            ld c,$FE
            dec e
            jr c,L0D35
            sub $1D
            cp $4A
            jr c,L0D27
            ld a,$4A
L0D27       ld b,$00
            ld c,a
            ld hl,$2705
            add hl,bc
            add hl,bc
            ld e,(hl)
            inc hl
            ld d,(hl)
            jp L37D6
L0D35       ld de,$1391
            rst $28
            ld a,(bc)
            inc c
            ret
L0D3C       ld ($5C49),bc
            ld hl,($5C5D)
            ex de,hl
            ld hl,$0B91
            ld ($5B6C),hl
            ld hl,$5B3A
            push hl
            ld hl,($5C61)
            scf
            sbc hl,de
            push hl
            ld h,b
            ld l,c
            rst $28
            ld l,(hl)
            add hl,de
            jr nz,L0D62
            rst $28
            cp b
            add hl,de
            rst $28
            ret pe
            add hl,de
L0D62       pop bc
            ld a,c
            dec a
            or b
            jr nz,L0D79
            rst $18
            push hl
            ld hl,($5C49)
            call L0080
            ld sp,hl
            inc de
            ld ($5C49),hl
            pop hl
            rst $30
            jr L0DA1
L0D79       push bc
            inc bc
            inc bc
            inc bc
            inc bc
            dec hl
            ld de,($5C53)
            push de
            rst $28
            ld d,l
            ld d,$E1
            ld ($5C53),hl
            pop bc
            push bc
            inc de
            ld hl,($5C61)
            dec hl
            dec hl
            lddr
            ld hl,($5C49)
            ex de,hl
            pop bc
            ld (hl),b
            dec hl
            ld (hl),c
            dec hl
            ld (hl),e
            dec hl
            ld (hl),d
L0DA1       pop af
            ret
L0DA3       pop hl
L0DA4       ld a,(hl)
L0DA5       ld ($5B5E),a
            inc a
            cp $1E
            jr nc,L0DB0
            rst $28
            ld e,l
            ld e,e
L0DB0       dec a
            ld (iy),a
            ld sp,(ERRSP)
            rst $18
            xor a
            call L0080
            ld d,d
            jr L0DB7
            ld hl,($5C5D)
            ld ($5C5F),hl
            rst $28
            push bc
            ld d,$C9
L0DCA       call L08F4
            rst $38
L0DCE       rst $30
            jr L0DCA
            rst $28
            inc (hl)
            ld b,b
            ld b,c
            nop
            nop
            inc b
            rrca
            jr c,L0DA4
            rst $28
            ld bc,$02C1
            inc (hl)
            ld b,b
            ld b,c
            nop
            nop
            ld ($38E1),a
            ret
L0DE8       bit 7,(iy+$01)
            ret
            call L3EC9
L0DF0       call L08E9
            jp z,L3887
            ld bc,$1C82
            jp L3EC1
L0DFC       ld bc,$24FB
            jp L3EC1
            push de
            call L0E35
            push hl
            call L3EC9
            cp $CD
            scf
            ccf
            jr nz,L0E14
            call L0634
            scf
L0E14       pop hl
            ld b,$01
            call L0E6E
            pop de
            cp $E2
            jr z,L0E27
            cp $F7
            jr z,L0E27
            sla d
            jr L0E32
L0E27       scf
            rl d
            push af
            push hl
            rst $20
            pop hl
            pop af
            cp $F7
            ccf
L0E32       rl e
            ret
L0E35       ex de,hl
L0E36       ld b,$02
            call L3EC9
            cp $2C
            scf
            ccf
L0E3F       ld a,b
            jr nz,L0E6D
            rst $20
            cp $2C
            jr z,L0E6D
            cp $CD
            jr z,L0E6D
            cp $E2
            jr z,L0E6D
            push de
            call L0635
            cp $CC
            jr z,L0E66
            bit 7,(iy+$01)
            call nz,L3842
            call nz,L3876
            call nz,L386C
            jr L0E69
L0E66       call L0634
L0E69       pop de
            ld b,$02
            scf
L0E6D       ex de,hl
L0E6E       push af
L0E6F       pop af
            push af
            adc hl,hl
            djnz L0E6F
            pop af
            ret
L0E77       ld ($5B54),bc
            ld a,($2000)
            ld b,a
            ld a,(hl)
            inc hl
            add a,a
            jr c,L0EA4
L0E84       cp $03
            jp nc,L3439
            ld c,a
            pop af
            push hl
            push bc
            ld hl,$0EB0
            push hl
            nextreg $51,$FF
            ld h,$3E
            ld l,c
            ld c,(hl)
            inc hl
            ld b,(hl)
            push bc
            ld bc,($5B54)
            ld hl,($5B52)
            ret
L0EA4       push bc
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ld ($5B5A),bc
            pop bc
            jr L0E84
            ex (sp),hl
            ld l,a
            ld a,h
            nextreg $51,a
            ld a,l
            pop hl
            ret
            nextreg $51,a
            call L0EC4
            nextreg $51,$FF
            ret
L0EC4       push bc
            ret
L0EC6       ld ($5C5F),hl
            ld a,($5B65)
            inc a
            jp z,L0F5C
            dec a
            call L32D0
            call L39D1
            add a,a
            call nc,L1015
            jr L0F4A
L0EDD       ld hl,$2000
            ld a,($5B65)
            inc a
            jr z,L0EE9
            ld hl,($FFF8)
L0EE9       add hl,$00A1
            ld e,(hl)
            inc hl
            ld d,(hl)
            ex de,hl
            add hl,bc
            nextreg $51,$FF
L0EF6       ld a,(hl)
            cp $28
            jr nc,L0F34
            inc hl
            inc hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            push bc
            push hl
            dec hl
            ld d,$00
            ld e,xh
            ld b,xl
            call L1241
            jr c,L0F45
L0F0F       push de
            inc hl
            ld de,($5C5F)
L0F15       call L1228
            ld c,a
            ex de,hl
            call L1228
            ex de,hl
            cp b
            jr z,L0F26
            cp c
            jr nz,L0F3C
            jr L0F15
L0F26       cp c
            jr nz,L0F3C
            pop af
            neg
            exx
            ld d,a
            exx
            dec hl
            pop ix
            pop bc
            scf
L0F34       ld a,($5B65)
            inc a
            call nz,L2AEE
            ret
L0F3C       pop de
            dec hl
            ld c,$00
            call L125A
            jr nc,L0F0F
L0F45       pop hl
            pop bc
            add hl,bc
            jr L0EF6
L0F4A       ld bc,$C002
            ld a,($C001)
            add a,a
            jr c,L0F58
            ld hl,($FFF8)
            jr L0F69
L0F58       ld h,b
            ld l,c
            jr L0EF6
L0F5C       ld a,($5B58)
            nextreg $51,a
            ld hl,$2000
            ld bc,($5C53)
L0F69       ld a,xh
            and $03
            ld e,a
            ld d,$34
            mul d,e
            add hl,de
            ld de,($5C5F)
            ld a,(de)
            or $20
            sub $61
            add a,a
            add hl,a
            ld e,(hl)
            inc hl
            ld d,(hl)
            ex de,hl
L0F83       ld a,(hl)
            inc hl
            and a
            jp z,L0EDD
            exx
            ld d,a
            exx
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
            push hl
            push bc
            ld hl,($5C5F)
            inc hl
            ex de,hl
            add hl,bc
            ld b,xl
L0F9A       call L1228
            ld c,a
            ex de,hl
            call L1228
            ex de,hl
            cp b
            jr z,L0FB1
            cp c
            jr nz,L0FAB
            jr L0F9A
L0FAB       pop bc
            pop hl
            inc hl
            inc hl
            jr L0F83
L0FB1       cp c
            jr nz,L0FAB
            ex de,hl
            pop bc
            ex (sp),hl
            ld a,(hl)
            inc hl
            ld h,(hl)
            ld l,a
            add hl,bc
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            push hl
            pop ix
            ex de,hl
            dec hl
            pop de
            nextreg $51,$FF
            scf
            jp L0F34
L0FCE       ld hl,$C001
            bit 7,(hl)
            inc hl
            ret nz
            ex de,hl
            ld hl,($FFF8)
            jr L0FE8
L0FDB       ld a,($5B58)
            nextreg $51,a
            ld de,($5C53)
            ld hl,$2000
L0FE8       push bc
            push de
            add hl,$009C
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
            ld a,(hl)
            inc hl
            ex af,af'
            ld a,(hl)
            inc hl
            ld h,(hl)
            ld l,a
            and a
            sbc hl,bc
            jr nc,L1001
            add hl,bc
            ld b,h
            ld c,l
L1001       ex de,hl
            ld d,b
            ld e,c
            ex af,af'
            ld b,a
            bsrl de,b
            add hl,de
            add hl,de
            ld e,(hl)
            inc hl
            ld d,(hl)
            pop hl
            add hl,de
            pop bc
            nextreg $51,$FF
            ret
L1015       push ix
            ld hl,$C002
L101A       ld a,(hl)
            inc hl
            cp $28
            jr nc,L1028
            inc hl
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
            add hl,de
            jr L101A
L1028       ex de,hl
            ld hl,$C000
            set 7,(hl)
            ld a,d
            cp $FE
            jr nc,L104F
            ex de,hl
            ld ($FFF8),hl
            ld de,$C002
            call L106B
            ld ($FFFC),hl
            ld hl,$FFF7
            ld ($FFFE),hl
            ld hl,$0000
            ld ($FFFA),hl
            pop ix
            ret
L104F       inc hl
            set 7,(hl)
            set 0,(iy+$01)
            inc hl
            ex de,hl
            call L1073
            pop ix
            ret
L105E       ld a,($5B58)
            nextreg $51,a
            ld hl,$2000
            ld de,($5C53)
L106B       res 5,(iy+$30)
            res 0,(iy+$01)
L1073       ld a,$07
            call L127D
            and $03
            push af
            nextreg $07,$03
            push de
            push hl
            bit 0,(iy+$01)
            jr nz,L1098
            ld d,h
            ld e,l
            add de,$00A3
            xor a
            ld b,$4F
L1090       ld (hl),e
            inc hl
            ld (hl),d
            inc hl
            ld (de),a
            inc de
            djnz L1090
L1098       pop hl
            exx
            ld hl,$0000
            ld ($5B54),hl
            pop hl
            push hl
L10A2       ld a,(hl)
            cp $28
            jp nc,L118D
            ld b,a
            inc hl
            ld c,(hl)
            inc hl
            ld ($5B54),bc
            inc hl
            push hl
            ld b,$01
            res 6,(iy+$30)
L10B8       inc hl
            ld a,(hl)
            cp $0D
            jr z,L10E8
            cp $21
            jr c,L10B8
            bit 0,(iy+$01)
            jr nz,L10D4
            cp $40
            jr z,L1114
            cp $91
            jr z,L1114
            cp $CE
            jr z,L1114
L10D4       cp $98
            jr nz,L10DC
            set 6,(iy+$30)
L10DC       ld d,$01
            ld c,$00
            call L125B
            inc b
            cp $0D
            jr nz,L10B8
L10E8       inc hl
            pop de
            bit 6,(iy+$30)
            jr z,L10A2
            push hl
            ex de,hl
L10F2       ld de,$00FA
            call L1241
            jr c,L10FE
            ld (hl),$83
            jr L10F2
L10FE       pop hl
            jr L10A2
L1101       bit 5,(iy+$30)
            jr nz,L1110
            ex (sp),hl
            ld ($5B52),hl
            ex (sp),hl
            set 5,(iy+$30)
L1110       exx
            ex af,af'
            jr L10DC
L1114       ex af,af'
            exx
            ld a,d
            or $C0
            cp $FF
            jr c,L1122
            ld a,e
            cp $E6
            jr nc,L1101
L1122       exx
            ex af,af'
            and $03
            ld e,a
            ld d,$1A
            mul d,e
            inc hl
            call L1228
            sub $61
            add de,a
            ld a,$4E
            sub e
            ex af,af'
            push de
            exx
            pop bc
            push hl
            inc bc
            add hl,bc
            add hl,bc
            push hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            dec bc
            ld h,d
            ld l,e
            sbc hl,bc
            ld b,h
            ld c,l
            ld h,d
            ld l,e
            dec hl
            add de,$0004
            push de
            lddr
            pop de
            inc de
            inc hl
            push hl
            exx
            pop de
            exx
            ex af,af'
            ld b,a
            pop hl
L115D       ld a,$05
            add a,(hl)
            ld (hl),a
            inc hl
            ld a,$00
            adc a,(hl)
            ld (hl),a
            inc hl
            djnz L115D
            pop hl
            exx
            ld a,b
            ld (de),a
            inc de
            pop ix
            pop bc
            push bc
            push ix
            and a
            sbc hl,bc
            ex de,hl
            ld (hl),e
            inc hl
            ld (hl),d
            inc hl
            ex de,hl
            add hl,bc
            ex (sp),hl
            dec hl
            sbc hl,bc
            ex de,hl
            ld (hl),e
            inc hl
            ld (hl),d
            pop hl
            push ix
            ld b,a
            jp L10DC
L118D       bit 0,(iy+$01)
            jp nz,L121E
            bit 5,(iy+$30)
            jr z,L11A0
            ld hl,($5B52)
            dec hl
            dec hl
            dec hl
L11A0       pop bc
            push bc
            and a
            sbc hl,bc
            push hl
            exx
            pop bc
            add hl,$00A1
            ld (hl),c
            inc hl
            ld (hl),b
            dec hl
            dec hl
            push de
            push hl
            set 7,d
            set 6,d
            xor a
            ld hl,$FFF6
            sbc hl,de
            srl h
            rr l
            ld bc,($5B54)
            pop de
            ex de,hl
            ld (hl),b
            dec hl
            ld (hl),c
            dec hl
            ex de,hl
L11CC       and a
            sbc hl,bc
            jr nc,L11D9
            add hl,bc
            inc a
            srl b
            rr c
            jr L11CC
L11D9       ld (de),a
            ld b,a
            ld hl,$0000
            exx
            pop hl
            dec hl
            ld (hl),$00
            inc hl
            ld (hl),$00
            inc hl
            pop de
            push de
L11E9       ld a,(de)
            cp $28
            jr nc,L121E
            ld b,a
            inc de
            ld a,(de)
            ld c,a
            push bc
            exx
            pop de
            bsrl de,b
            ex de,hl
            and a
            sbc hl,de
            ex de,hl
            exx
            jr z,L1214
            pop bc
            push bc
            push de
            ex de,hl
            scf
            sbc hl,bc
            ex de,hl
L1207       ld (hl),e
            inc hl
            ld (hl),d
            inc hl
            exx
            inc hl
            dec de
            ld a,d
            or e
            exx
            jr nz,L1207
            pop de
L1214       ex de,hl
            inc hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            add hl,bc
            ex de,hl
            jr L11E9
L121E       pop bc
            pop af
            nextreg $07,a
            nextreg $51,$FF
            ret
L1228       ld a,(hl)
            inc hl
            cp $0D
            jr z,L123B
            cp $21
            jr c,L1228
            cp $5B
            ret nc
            cp $41
            ret c
            or $20
            ret
L123B       ld a,$3A
            ret
L123E       ld hl,($5C5D)
L1241       ld c,$00
L1243       dec d
            scf
            ret z
L1246       inc hl
            ld a,(hl)
            cp $0D
            jr z,L127A
            cp $21
            jr c,L1246
            cp e
            jr nz,L125B
            and a
            ret
L1255       add hl,$0005
L1259       inc hl
L125A       ld a,(hl)
L125B       cp $0E
            jr z,L1255
            cp $22
            jr nz,L1266
            dec c
            jr L1259
L1266       cp $3A
            jr z,L1272
            cp $CB
            jr z,L1272
            cp $98
            jr nz,L1276
L1272       bit 0,c
            jr z,L1243
L1276       cp $0D
            jr nz,L1259
L127A       dec d
            scf
            ret
L127D       ld bc,$243B
            out (c),a
            inc b
            in a,(c)
            ret
L1286       ld ($5B92),sp
            ex af,af'
            pop af
            ex af,af'
            call L3A40
            ex af,af'
            push af
            ex af,af'
            sub $21
            add a,a
            ld hl,$1304
            add hl,a
            ld a,(hl)
            inc hl
            ld xh,a
            ld a,(hl)
            ld xl,a
            ld hl,($5C5D)
            ld a,($5B65)
            inc a
            call nz,L39E3
            ld ($5B8A),hl
            call L0EC6
            jr c,L12C3
            ld a,xh
            cp $91
            jp z,L2159
            cp $CE
            jr z,L12C1
            rst $08
            ld h,l
L12C1       rst $08
            jr L12B1
            ld d,e
            ld e,a
            ld e,h
            push ix
            exx
            ld xh,d
            exx
            ld a,($5B65)
            inc a
            jr z,L12F2
            dec a
            ex (sp),hl
            add hl,$FFFC
            call L3925
            ex (sp),hl
            ld bc,($5EBB)
            and a
            sbc hl,bc
            add hl,$5DB6
            ld ($5C5D),hl
            ex de,hl
            ld d,(hl)
            inc hl
            ld e,(hl)
            pop hl
            jr L1301
L12F2       ld ($5C5D),hl
            pop hl
            dec hl
            dec hl
            dec hl
            ld e,(hl)
            dec hl
            ld d,(hl)
            add hl,$0004
            add hl,bc
L1301       ld a,xh
            ret
            ld b,b
            ld a,($2891)
            adc a,$28
            ld e,$3A
            call L1315
            call L0914
            ret
L1313       ld e,$28
L1315       call L3EC9
            call L38A6
            jr nc,L1338
L131D       rst $20
            cp e
            ld d,$40
            ret z
            call L38A1
            jr c,L131D
            cp $24
            jr nz,L1330
            rst $20
            cp e
            ld d,$00
            ret z
L1330       cp $0D
            jr nz,L1338
            ld a,e
            cp $3A
            ret z
L1338       rst $08
            dec bc
L133A       res 0,(iy+$02)
            ld a,$FE
            rst $28
            ld bc,$CD16
            and (hl)
            inc de
            ret nc
            ld hl,$5C90
            ld a,(hl)
            or $F8
            ld (hl),a
            res 6,(iy+$57)
            ret
L1353       call L3EF9
            rst $28
            ld bc,$7916
            cp $53
            jr z,L136B
            cp $4B
            jr z,L136B
            ret
L1363       ld a,$FE
            call L3EF9
L1368       rst $28
            ld bc,$CD16
            and (hl)
            inc de
            ret c
L136F       call L3FED
            ld hl,$5B9D
            ld d,h
            ld e,l
            ld bc,($5C6C)
            ld (hl),$18
            jr nc,L1386
            ld (hl),$11
            inc hl
            ld (hl),b
            inc hl
            ld (hl),$10
L1386       inc hl
            ld (hl),c
            inc hl
            ld (hl),$14
            inc hl
            ld a,($5C91)
            ld b,a
            rrca
            rrca
            and $01
            ld (hl),a
            inc hl
            ld (hl),$15
            inc hl
            ld a,b
            and $01
            ld (hl),a
            inc hl
            sbc hl,de
            ld b,h
            ld c,l
            rst $28
            inc a
            jr nz,L136F
            ld a,($5C7F)
            and $0F
            jr z,L13D0
            rrca
            bit 2,a
            jr z,L13B4
            rrca
            inc a
L13B4       and $07
            add a,$5F
            ld l,a
            ld h,$5B
            ld e,(hl)
            ld a,l
            add a,$29
            ld l,a
            ld d,(hl)
            ld ($5C6C),de
            ld hl,$5C91
            ld a,(hl)
            rrca
            xor (hl)
            and $55
            xor (hl)
            ld (hl),a
            ret
L13D0       rst $28
            ld c,l
            dec c
            scf
            ret
            cp $2C
            jr nz,L13E8
            call L0634
            call L0914
            call L3823
            cp $04
            jr c,L13ED
L13E6       rst $08
            ld a,(bc)
L13E8       call L0914
            ld a,$FF
L13ED       push af
            call L3823
            pop de
            cp $03
            jr nc,L13E6
            ld e,a
            and a
            jr nz,L13FF
            inc d
            jr nz,L13E6
            jr L141F
L13FF       dec a
            jr nz,L140D
            ld a,d
            cp $04
            jr nc,L13E6
            add a,a
            add a,a
            or e
            ld e,a
            jr L141F
L140D       ld a,d
            cp $FF
            jr z,L141F
            cp $02
            jr nc,L13E6
            add a,a
            ld bc,$123B
            out (c),a
            ld ($5B7B),a
L141F       ld a,($5C7F)
            and $F0
            or e
            ld ($5C7F),a
            and $03
            ld hl,$0B11
            ld e,a
            ld bc,$09F4
            jr z,L144F
            dec a
            scf
            jr nz,L144C
            ld hl,$110B
            ld a,d
            and a
            ld e,$80
            jr z,L144C
            ld e,$00
            dec a
            jr z,L144C
            dec a
            ld a,$06
            jr z,L144C
            ld a,$02
L144C       ld bc,$5B4D
L144F       push hl
            ld hl,($5C4F)
            ld (hl),c
            inc hl
            ld (hl),b
            inc hl
            inc hl
            inc hl
            inc hl
            ld (hl),c
            inc hl
            ld (hl),b
            pop hl
            ret c
            ld d,a
            push de
            call L1479
            pop de
            ld a,($5B62)
            and $38
            or d
            out ($FF),a
            ld d,$7F
L146F       ld a,$15
L1471       call L127D
            and d
            or e
            out (c),a
            ret
L1479       ld bc,$243B
            ld de,$5354
            out (c),d
            inc b
            in a,(c)
            cp h
            ret z
            di
            out (c),h
            dec b
            out (c),e
            inc b
            in a,(c)
            out (c),l
            ld hl,$8000
            ld de,$6000
            ld b,a
L1498       ld a,(de)
            ld c,(hl)
            ld (hl),a
            ld a,c
            ld (de),a
            inc de
            inc hl
            bit 7,d
            jr z,L1498
            ld a,b
            nextreg $54,a
            ei
            ret
L14A9       push ix
            and $0F
            ld e,a
            ld d,a
            srl d
            srl d
            call L141F
            pop ix
            ret
            call L156F
            call L1548
            call L3E80
            ld b,h
            ld h,$11
            add hl,bc
            add hl,bc
            ld l,$12
            call L1501
            ld de,$0000
            ld l,$32
            call L1501
            ld l,$26
            call L1501
            ld l,$16
            call L1501
            ld l,$2F
            call L1501
            xor a
            nextreg $31,a
            nextreg $68,a
            nextreg $6B,a
            call L141F
            ld bc,$123B
            xor a
            out (c),a
            ld ($5B7B),a
            ld d,$E3
            ld e,a
            call L146F
            jr L1518
L1501       ld bc,$243B
            out (c),l
            inc b
            out (c),e
            inc l
            dec b
            out (c),l
            inc b
            out (c),d
            ret
            call L1518
L1514       ld l,$19
            jr L1527
L1518       ld l,$1B
            ld de,$9FFF
            call L152A
            ld l,$18
            call L1527
            ld l,$1A
L1527       ld de,$FFBF
L152A       ld bc,$0000
            push bc
            ld bc,$243B
            ld a,$1C
            out (c),a
            inc b
            ld a,$0F
            out (c),a
            dec b
            out (c),l
            inc b
            pop hl
            out (c),h
            out (c),d
            out (c),l
            out (c),e
            ret
L1548       ld de,$FC00
            call L146F
            nextreg $34,a
            ld b,$80
L1553       nextreg $78,$00
            djnz L1553
            nextreg $51,$10
            ld de,$24DF
            ld h,d
            ld l,e
            inc de
            ld (hl),b
            ld bc,$0820
            ldir
            nextreg $51,$FF
            jr L1514
L156F       xor a
L1570       push af
            nextreg $43,a
            xor a
            ld h,a
            nextreg $40,a
L1579       ld de,$3DE3
L157C       ld a,(de)
            inc de
            cp $AA
            jr z,L1579
            nextreg $41,a
            dec h
            jr nz,L157C
            pop af
            xor $40
            jr nz,L1570
            ld de,$1002
L1590       ld a,d
            nextreg $43,a
            xor a
            nextreg $40,a
L1598       nextreg $41,a
            inc a
            jr nz,L1598
            bit 6,d
            set 6,d
            jr z,L1590
            ld d,$20
            dec e
            jr nz,L1590
            set 4,(iy+$45)
            xor a
            nextreg $43,a
            nextreg $4A,a
            nextreg $4C,$0F
            xor a
            call L15C5
            ld a,$E3
            nextreg $14,a
            nextreg $4B,a
            ret
L15C5       ld h,a
            and a
            jr z,L15CF
            inc a
            and h
            jp nz,L30BC
            inc a
L15CF       ld d,$FE
            ld e,a
            ld a,$43
            call L1471
            ld a,h
            ld ($5B64),a
            nextreg $42,a
            ret
L15DF       pop af
            ld hl,$5C74
            ld (hl),$03
            ld a,xh
            cp $D5
            jr z,L15F0
            swapnib
            cpl
            and (hl)
            ld (hl),a
L15F0       call L3EC9
            cp $2A
            call z,L3ECF
            call L05BB
            call L0DE8
            jp z,L171C
            ld bc,$0011
            ld a,($5C74)
            and a
            jr z,L160C
            ld c,$22
L160C       rst $28
            jr nc,L160F
L160F       push de
            pop ix
            ld b,$0B
            ld a,$20
L1616       ld (de),a
            inc de
            djnz L1616
            ld (ix+$01),$FF
            call L3842
            push de
            push bc
            call L3EC9
            call L08E9
            jr nz,L166A
            ld a,($5C74)
            cp $01
            jr nz,L166A
            ld a,($5B79)
            cp $54
            jr z,L166A
            ld a,c
            dec a
            or b
            jr nz,L166A
            ld a,(de)
            cp $2A
            jr nz,L166A
            push ix
            rst $18
            rst $00
            ld hl,($F701)
            pop ix
            cp $23
            pop bc
            pop de
            push $1662
            ld de,$1666
            ld bc,$0004
            push de
            push bc
            jr z,L166A
            call L08EF
            rst $38
            rst $00
            inc d
            ld c,$C9
            ld h,h
            ld l,c
            ld (hl),e
            ld l,e
L166A       inc de
            ld a,(de)
            dec de
            cp $3A
            jr nz,L1680
            ld a,(de)
            and $DF
            cp $54
            jr z,L1692
            cp $41
            jr c,L1680
            cp $51
            jr c,L1692
L1680       ld a,($5C74)
            and $01
            ld a,($5B7A)
            jr z,L168D
            ld a,($5B79)
L168D       ld ($5B5E),a
            jr L16D9
L1692       ld ($5B5E),a
            call L3EC9
            call L08E9
            jr nz,L16D9
            ld a,c
            dec a
            dec a
            or b
            jr nz,L16CA
            ld a,($5B5E)
            cp $54
            jr z,L16B5
            rst $18
            rst $00
            dec l
            ld bc,$38F7
            inc b
            call L08EF
            rst $38
L16B5       ld a,($5C74)
            and $01
            ld a,($5B5E)
            jr z,L16C4
            ld ($5B79),a
            jr L16C7
L16C4       ld ($5B7A),a
L16C7       pop bc
            pop de
            ret
L16CA       ld a,($5B5E)
            cp $54
            jr nz,L16D9
            pop bc
            pop de
            inc de
            inc de
            dec bc
            dec bc
            jr L16FC
L16D9       ld a,($5B5E)
            cp $54
            jr z,L16FA
            ld a,b
            or c
            jr nz,L16E8
            call L08EF
            ld c,$21
            nop
            rst $30
            ex de,hl
            call L2B1C
            pop bc
            ld bc,$000A
            rst $18
            ld a,$FF
            ld (de),a
            rst $30
            jr L16FB
L16FA       pop bc
L16FB       pop de
L16FC       ld hl,$FFF6
            dec bc
            add hl,bc
            inc bc
            jr nc,L1715
            ld a,($5C74)
            and a
            jr nz,L170E
            call L08EF
            ld c,$78
            or c
            jr z,L171C
            ld bc,$000A
L1715       push ix
            pop hl
            inc hl
            ex de,hl
            ldir
L171C       ld a,$FF
            ld ($5B65),a
            call L3EC9
            cp $E4
            jr nz,L177B
            call L1824
            rst $20
            rst $28
            or d
            jr z,L176A
            ld (hl),h
            ld e,h
            jr nc,L1744
            ld ($5C5B),hl
            ld ($5C4D),hl
            ld hl,$0000
            dec a
            jr z,L175E
L1740       call L08EF
            ld bc,$2AC2
            jr L1715
            ret pe
            dec c
            jr z,L176D
            and a
            jr nz,L1753
            bit 7,b
            jr z,L1740
L1753       inc hl
            ld a,(hl)
            ld (ix+$0B),a
            inc hl
            ld a,(hl)
            ld (ix+$0C),a
            inc hl
L175E       set 7,c
            ld (ix+$0E),c
            ld a,$01
            bit 6,c
            jr z,L176A
            inc a
L176A       ld (ix),a
L176D       ex de,hl
            rst $20
            cp $29
            jr nz,L1744
            rst $20
            call L0914
            ex de,hl
            jp L18DD
L177B       cp $9A
            jr nz,L17D1
            call L1824
            call L0634
            cp $2C
            jr z,L1798
            ld hl,$C000
            ld de,$4000
            ld a,($5C74)
            and a
            jr z,L17B9
            ld d,e
            jr L17B9
L1798       call L063B
            call L0914
            call L381B
            push bc
            call L381B
            ld h,b
            ld l,c
            pop de
            add hl,de
            jp c,L30BC
            dec hl
            ld a,h
            and $C0
            jp nz,L30BC
            ld hl,$C000
            add hl,bc
            jr L17BC
L17B9       call L0914
L17BC       push de
            push hl
            call L3823
            ld ($5B65),a
            call L32D0
            rst $30
            call L38E3
            call nz,L38DD
            jp L1878
L17D1       cp $9C
            jr nz,L1805
            call L1824
            rst $20
            call L0914
            ld hl,$0000
            ld a,($5C7F)
            and $0F
            jr z,L1837
            cp $05
            jr z,L1837
            cp $02
            ld a,$FE
            ld ($5B65),a
            jr z,L17FC
            ld (ix),$04
            ld de,$3000
            jr L1803
L17FC       ld (ix),$05
            ld de,$C000
L1803       jr L187E
L1805       cp $EE
            jr z,L180D
            cp $BA
            jr nz,L182C
L180D       ld e,a
            call L1824
            rst $20
            call L0914
            ld a,e
            call L26CB
            jp pe,L5029
            ld e,c
            ld a,$FD
            ld ($5B65),a
            jr L187A
L1824       ld a,($5C74)
            cp $03
            ret nz
L182A       rst $08
            dec bc
L182C       cp $AA
            jr nz,L183F
            call L1824
            rst $20
            call L0914
L1837       ld de,$1B00
            ld hl,$4000
            jr L187A
L183F       cp $AF
            jr nz,L188C
            call L1824
            rst $20
            call L08E9
            jr nz,L1857
            ld a,($5C74)
            and a
            jr z,L182A
            call L3887
            jr L1864
L1857       call L0635
            cp $2C
            jr z,L1869
            ld a,($5C74)
            and a
            jr z,L182A
L1864       call L3887
            jr L186D
L1869       rst $20
            call L0635
L186D       call L0914
            call L381B
            push bc
            call L381B
            push bc
L1878       pop hl
            pop de
L187A       ld (ix),$03
L187E       ld (ix+$0B),e
            ld (ix+$0C),d
            ld (ix+$0D),l
            ld (ix+$0E),h
            jr L18DD
L188C       cp $CA
            jr z,L1899
            call L0914
            ld (ix+$0E),$80
            jr L18B6
L1899       ld a,($5C74)
            and a
            jr nz,L182A
            rst $20
            ld b,$00
            call L25EB
            call L0914
            ld hl,($5C45)
            ld (ix+$0D),l
            ld (ix+$0E),h
            ld c,$21
            call L3A86
L18B6       ld (ix),$00
            ld a,($5C74)
            and a
            call nz,L1C9B
            ld hl,($5C59)
            ld de,($5C53)
            scf
            sbc hl,de
            ld (ix+$0B),l
            ld (ix+$0C),h
            ld hl,($5C4B)
            sbc hl,de
            ld (ix+$0F),l
            ld (ix+$10),h
            ex de,hl
L18DD       ld a,($5C74)
            and a
            jp z,L1B49
            push hl
            ld bc,$0011
            add ix,bc
            ld a,($5B5E)
            cp $54
            jr nz,L1959
L18F1       push ix
            ld de,$0011
            xor a
            scf
            rst $28
            ld d,(hl)
            dec b
            pop ix
            jr nc,L18F1
            call L1363
            ld (iy+$52),$03
            ld c,$80
            ld a,(ix)
            cp (ix-$11)
            jr nz,L1912
            ld c,$F6
L1912       cp $06
            jr nc,L18F1
            cp $04
            jr c,L192A
            push af
            call L0A9B
            pop af
            call L1C8D
            ld hl,$29F8
            call L37C4
            jr L1932
L192A       ld de,$09C0
            push bc
            rst $28
            ld a,(bc)
            inc c
            pop bc
L1932       push ix
            pop de
            ld hl,$FFF0
            add hl,de
            ld b,$0A
            ld a,(hl)
            inc a
            jr nz,L1942
            ld a,c
            add a,b
            ld c,a
L1942       inc de
            ld a,(de)
            cp (hl)
            inc hl
            jr nz,L1949
            inc c
L1949       rst $28
            djnz L194C
L194C       djnz L1942
            bit 7,c
            jr nz,L18F1
            call L0A9B
            pop hl
            jp L19AC
L1959       ld a,($5C74)
            cp $02
            pop hl
            ret z
            push hl
            push ix
            ld b,$00
            ld c,$01
            ld d,$00
            ld e,$01
            ld hl,$F700
            rst $18
            rst $00
            ld b,$01
            rst $30
            jr c,L1979
            call L08EF
            rst $38
L1979       ld b,$00
            rst $18
            rst $00
            rrca
            ld bc,$DDF7
            ex (sp),hl
            pop hl
            rst $18
            ld a,(hl)
            rst $30
            cp (ix-$11)
            jr z,L1999
            cp $03
            jr nz,L1995
            bit 2,(ix-$11)
            jr nz,L1999
L1995       call L08EF
            dec e
L1999       ld (ix),a
            push ix
            pop de
            ex de,hl
            ld bc,$000B
            add hl,bc
            ex de,hl
            inc hl
            ld c,$06
            call L2B38
            pop hl
L19AC       ld a,(ix-$11)
            cp $03
            jr nc,L19BE
            ld a,($5C74)
            dec a
            jr z,L19F4
            cp $02
            jp z,L1AC0
L19BE       push hl
            ld l,(ix-$06)
            ld h,(ix-$05)
            ld e,(ix+$0B)
            ld d,(ix+$0C)
            ld a,h
            or l
            jr z,L19E0
            push hl
            sbc hl,de
            pop hl
            jr z,L19E0
            jr nc,L19D8
            ex de,hl
L19D8       ld a,(ix-$11)
            cp $03
            jp c,L1C7D
L19E0       pop hl
            ld a,h
            or l
            jr nz,L19EB
            ld l,(ix+$0D)
            ld h,(ix+$0E)
L19EB       ld (ix+$0B),e
            ld (ix+$0C),d
            jp L1BA4
L19F4       ld e,(ix+$0B)
            ld d,(ix+$0C)
            ld ($5C5F),ix
            ld a,h
            or l
            jr nz,L1A33
            push de
            rst $28
            pop de
            dec de
            xor a
            sub b
            ld hl,($5C59)
            dec hl
            pop bc
            push bc
            add bc,a
            push af
            dec a
            jr z,L1A15
            inc bc
L1A15       inc bc
            inc bc
            rst $28
            ld d,l
            ld d,$DD
            ld hl,($5C5F)
            inc hl
            ex de,hl
            pop bc
            ld a,(ix-$03)
            ld xh,a
            ld xl,b
            rst $28
            xor l
            dec de
            ex de,hl
            pop de
            inc hl
            ld (hl),e
            inc hl
            ld (hl),d
            jr L1A65
L1A33       push de
            push hl
            ld l,(ix-$06)
            ld h,(ix-$05)
            push hl
            ex de,hl
            scf
            sbc hl,de
            jr c,L1A4B
            ld de,$0005
            add hl,de
            ld b,h
            ld c,l
            call L388F
L1A4B       pop de
            pop hl
            ld a,(ix)
            and a
            jr z,L1A6D
            pop bc
            push bc
            push hl
            call L385E
            pop hl
            ld b,d
            ld c,e
            ld a,(ix-$03)
            ld xh,a
            rst $28
            add a,d
            dec hl
            pop de
L1A65       ld ix,($5C5F)
            inc hl
            jp L19EB
L1A6D       ex de,hl
            ld hl,($5C59)
            dec hl
            ld ($5C5F),ix
            rst $28
            push hl
            add hl,de
            pop bc
            push bc
            push hl
            rst $28
            ld d,l
            ld d,$DD
            ld hl,($5C5F)
            inc hl
            ld c,(ix+$0F)
            ld b,(ix+$10)
            add hl,bc
            ld ($5C4B),hl
            call L26CB
            ld b,$2A
            call L0068
            add a,a
            dec l
            pop hl
            pop de
            push ix
            call L19EB
            call L1AB7
            pop ix
            ld b,(ix+$0E)
            ld a,b
            and $C0
            ret nz
            ld c,(ix+$0D)
            ld a,$FF
            ld hl,$0931
            ex (sp),hl
            jp L267E
L1AB7       call L105E
            call L0068
            jr nz,L1AED
            ret
L1AC0       call L0068
            add a,a
            dec l
            ld c,(ix+$0B)
            ld b,(ix+$0C)
            push bc
            inc bc
            rst $28
            jr nc,L1AD0
L1AD0       ld (hl),$80
            ex de,hl
            pop de
            push hl
            call L19EB
            pop hl
            ld de,($5C53)
            ld a,(hl)
            and $C0
            jr nz,L1AFE
L1AE2       ld a,(de)
            inc de
            cp (hl)
            inc hl
            jr nz,L1AEA
            ld a,(de)
            cp (hl)
L1AEA       dec de
            dec hl
            jr nc,L1AF7
            push hl
            ex de,hl
            rst $28
            add a,$19
            ex de,hl
            pop hl
            jr L1AE2
L1AF7       call L26CB
            nop
            ld ($DF18),hl
L1AFE       ld a,(hl)
            ld c,a
            cp $80
            jr z,L1AB7
            push hl
            ld hl,($5C4B)
L1B08       ld a,(hl)
            cp $80
            jr z,L1B3E
            cp c
            jr z,L1B15
L1B10       rst $28
            ld c,b
            ld a,(de)
            jr L1B08
L1B15       cp $7F
            jr nz,L1B24
            pop de
            push de
            push hl
            inc hl
            inc de
            ld a,(de)
            cp (hl)
            jr nz,L1B39
            jr L1B2D
L1B24       and $E0
            cp $A0
            jr nz,L1B3C
            pop de
            push de
            push hl
L1B2D       inc hl
            inc de
            ld a,(de)
            cp (hl)
            jr nz,L1B39
            rla
            jr nc,L1B2D
            pop hl
            jr L1B3C
L1B39       pop hl
            jr L1B10
L1B3C       ld a,$FF
L1B3E       pop de
            ex de,hl
            inc a
            scf
            call L26CB
            nop
            ld ($B518),hl
L1B49       ld a,($5B5E)
            cp $54
            jr z,L1B92
            push hl
            rst $18
            ld b,$00
            ld c,$03
            ld d,$01
            ld e,$03
            ld hl,$F700
            push ix
            rst $00
            ld b,$01
            jr c,L1B69
            rst $30
            call L08EF
            rst $38
L1B69       ld b,$00
            rst $00
            rrca
            ld bc,$0538
            rst $30
            call L08EF
            rst $38
            ex (sp),ix
            pop hl
            rst $30
            ld a,(ix)
            rst $18
            ld (hl),a
            inc hl
            push ix
            pop de
            ex de,hl
            ld bc,$000B
            add hl,bc
            ld bc,$0006
            rst $30
            call L2B1C
            pop hl
            jp L1BA4
L1B92       push hl
            ld de,$0011
            xor a
            push ix
            rst $28
            jp nz,LDD04
            pop hl
            ld b,$32
L1BA0       halt
            djnz L1BA0
            pop hl
L1BA4       ld a,($5B5E)
            cp $54
            jr z,L1BBA
            call L1BBA
            ld b,$00
            rst $18
            rst $00
            add hl,bc
            ld bc,$D8F7
            call L08EF
            rst $38
L1BBA       ld a,($5B65)
            inc a
            jr z,L1C30
            dec a
            cp $FE
            jr z,L1BFA
            cp $FD
            jr nz,L1BF3
            ld c,(ix+$0B)
            ld b,(ix+$0C)
            push bc
            push hl
            ld de,$C000
            push de
            rst $18
            call L26CB
            jr L1C05
            rst $30
            pop hl
            push hl
            ld a,$07
            call L1C30
            pop hl
            pop de
            pop bc
            ld a,($5C74)
            dec a
            ret nz
            rst $18
            call L26CB
            jr L1C1B
            rst $30
            ret
L1BF3       ld c,a
            call L32D0
            rst $30
            jr L1C31
L1BFA       bit 1,(iy+$45)
            jr nz,L1C15
            ld hl,$C000
            ld de,$1800
            push de
            ld c,$05
            call L1C37
            ld hl,$E000
            pop de
            ld c,$05
            jp L1C37
L1C15       ld bc,$243B
            ld a,$12
            out (c),a
            inc b
            in c,(c)
            ld b,$03
L1C21       ld hl,$C000
            ld de,$4000
            push bc
            call L1C37
            pop bc
            inc c
            djnz L1C21
            ret
L1C30       ld c,a
L1C31       ld e,(ix+$0B)
            ld d,(ix+$0C)
L1C37       ld a,d
            or e
            ret z
            ld a,($5B5E)
            cp $54
            jr z,L1C58
            ld a,($5C74)
            and a
            rst $18
            ld b,$00
            jr nz,L1C4F
            rst $00
            dec d
            ld bc,$0318
L1C4F       rst $00
            ld (de),a
            ld bc,$D8F7
            call L08EF
            rst $38
L1C58       ld a,c
            and a
            jr z,L1C5F
            call L32D0
L1C5F       push hl
            pop ix
            ld a,($5C74)
            and a
            jr nz,L1C81
            ld a,$FF
            rst $28
            jp nz,L3704
L1C6E       push af
            pop bc
            ld hl,$0000
            add hl,sp
            ld a,h
            cp $5C
            call c,L2AEE
            push bc
            pop af
            ret c
L1C7D       call L08EF
            ld a,(de)
L1C81       sub $02
            cp $01
            ccf
            ld a,$FF
            rst $28
            ld d,(hl)
            dec b
            jr L1C6E
L1C8D       add a,$2D
            push af
            ld de,$3F99
            call L37D6
            pop af
            rst $28
            djnz L1C9A
L1C9A       ret
L1C9B       ld hl,$0000
            ld ($5C49),hl
            rst $18
            ld ($D74E),hl
            rst $30
            ret
L1CA7       ld hl,($5C5D)
L1CAA       inc (iy+$0D)
            call L3ED0
            cp $98
            jp z,L0961
L1CB5       ld a,(hl)
            inc hl
            cp $0E
            jr z,L1CD8
            cp $3A
            jr z,L1CAA
            cp $CB
            jr z,L1CAA
            cp $0D
            jr z,L1CD5
            cp $22
            jr nz,L1CB5
L1CCB       ld a,(hl)
            inc hl
            cp $22
            jr z,L1CB5
            cp $0D
            jr nz,L1CCB
L1CD5       jp L093F
L1CD8       add hl,$0005
            jr L1CB5
L1CDE       inc (iy+$0D)
            push bc
            cp $CB
            jr nz,L1D0A
            rst $20
            pop bc
            bit 7,(iy+$01)
            jr z,L1CF3
            call L0052
            jr z,L1CA7
L1CF3       jp L092C
L1CF6       pop bc
            rst $20
            bit 7,(iy+$01)
            jr z,L1CF3
            call L0052
            jr nz,L1CF3
            jp L093F
            cp $CB
            jr z,L1CF6
L1D0A       ld a,($5C47)
            dec a
            jp nz,L1DA8
            call L0914
            call L0052
            ret nz
L1D18       ld c,$98
L1D1A       ld b,$01
            ld (iy+$0D),b
            pop hl
L1D20       ld hl,($5C55)
            push bc
            call L3995
            pop bc
            jr nc,L1D4D
            ld ($5C55),hl
            ex de,hl
            ld ($5C5D),hl
            rst $20
            cp $84
            jr z,L1D4F
            cp c
            jr z,L1D55
            cp $FA
            jr z,L1D41
            cp $83
            jr nz,L1D20
L1D41       push bc
            call L0634
            pop bc
            cp $CB
            jr z,L1D20
            inc b
            jr nz,L1D20
L1D4D       rst $08
            ld h,h
L1D4F       djnz L1D20
            rst $20
            jp L0953
L1D55       ld a,b
            dec a
            jr nz,L1D20
            rst $20
            cp $FA
            jr z,L1D62
            cp $83
            jr nz,L1CF3
L1D62       call L0634
            cp $CB
            jp z,L1CDE
            call L0052
            jr nz,L1CF3
            push hl
            jr L1D18
            ld hl,($5C47)
            dec l
            jr z,L1D83
L1D78       pop bc
            bit 7,(iy+$01)
            jp nz,L093F
            jp L092C
L1D83       ld c,$84
            bit 7,(iy+$01)
            jr nz,L1D1A
            cp $FA
            jr z,L1D93
            cp $83
            jr nz,L1D78
L1D93       call L0634
            cp $CB
            call nz,L0914
            rst $20
            jr L1D78
            ld a,($5C47)
            dec a
            jr nz,L1DA8
            call L0914
            ret
L1DA8       rst $08
            dec bc
L1DAA       call L1313
            rst $20
            push de
            ld d,$C0
            cp $29
            call nz,L2568
            pop de
            cp $29
            jr nz,L1DA8
            rst $20
            ret
            ld de,$3140
L1DC0       push de
            call L05A3
            bit 6,(iy+$01)
            jr z,L1DA8
            pop hl
            push hl
            call L3F93
            ld b,d
            ld c,e
            call L3867
            call L0DE8
            call nz,L3DCF
            pop de
            ld a,e
            cp $46
            ret z
            inc de
            inc de
            call L3EC9
            cp $2C
            ret nz
            rst $20
            jr L1DC0
            cp $8F
            jr nz,L1E15
            rst $20
            bit 7,(iy+$01)
            pop bc
            jp z,L0931
            push bc
            ld hl,$0005
            add hl,sp
            ld a,(hl)
            cp $4B
            call z,L3BFD
            call L3EC9
            call L08E9
            ret z
            call L1EB4
            ld a,$4B
            call L3A40
            pop bc
            jp L093A
L1E15       call L0635
            cp $0D
            jr z,L1DA8
            call L0914
            call L37EF
            jr c,L1E2A
            jr nz,L1E2A
            ld a,b
            and a
            jr z,L1E2C
L1E2A       ld c,$FF
L1E2C       inc c
            ld b,c
            ld d,b
            ld e,$98
            call L123E
            ld ($5C5D),hl
            ld a,b
            sub d
            exx
            ld hl,$5C47
            add a,(hl)
            ld (hl),a
            exx
            ld a,(hl)
            cp $0D
            ret z
            cp e
            call nz,L3ECF
            cp e
            exx
            jr z,L1E4E
            set 7,(hl)
L1E4E       exx
            call z,L3ECF
            pop hl
            jp L0931
            cp $CD
            jr z,L1E65
            ld a,$01
            bit 7,(iy+$01)
            call nz,L3864
            jr L1E68
L1E65       call L0634
L1E68       call L0914
            call L1ECA
            call L3A40
            ld hl,$0005
            add hl,sp
            ld ($5B8E),hl
            cp $1D
            jr nz,L1E8D
            rst $28
            xor $1C
            ret nc
            call L1E87
L1E83       call L3C12
            ret
L1E87       ld ix,$2CE2
            jr L1EAC
L1E8D       ld bc,$0034
            call L1F40
            ld bc,$0068
            call L1F40
            ld bc,$0000
            call L1F40
            call L1F58
            ret nc
            call L1EA8
            jr L1E83
L1EA8       ld ix,$2CCB
L1EAC       ld e,$F3
            call L1FF1
            ret nc
            rst $08
            ld de,$18AF
            ld (bc),a
            ld a,$01
            ld hl,($5C59)
            ld de,($5C5D)
            sbc hl,de
            bit 0,a
            jr z,L1EC7
            ccf
L1EC7       ret nc
L1EC8       rst $08
            ld e,a
L1ECA       bit 2,(iy+$30)
            ld a,$1D
            ret z
            ld a,($5C4D)
            sub $64
            srl a
            add a,$03
            ret
            call L1ECA
            ld c,a
            call L3B18
            jr c,L1F2C
            push hl
            cp $1D
            jr nz,L1EFC
            ex de,hl
            push bc
            rst $28
            add a,(hl)
            dec e
            ld a,b
            pop bc
            jr nz,L1F23
            rst $28
            or h
            dec e
            jr c,L1F1E
L1EF7       pop hl
            call L3AC8
            ret
L1EFC       ld de,$0000
            call L1F51
            push de
            ld de,$0034
            call L1F51
            pop hl
            add hl,de
            bit 7,d
            jr z,L1F10
            ccf
L1F10       jr c,L1F1E
            ex de,hl
            ld bc,$0000
            call L1F4A
            call L1F58
            jr nc,L1EF7
L1F1E       pop hl
L1F1F       call L3BFD
            ret
L1F23       pop hl
            ld h,a
            ld a,c
            cp $1D
            ld a,h
            jp nz,L0DA5
L1F2C       ld a,c
            cp $1D
            jr nz,L1F3E
            bit 1,(iy+$37)
            jp nz,L252D
            ld hl,($5B8C)
            bit 7,(hl)
            ret nz
L1F3E       rst $08
            nop
L1F40       push bc
            call L26CB
            pop af
            inc h
            jp c,L13E6
            pop bc
L1F4A       ld hl,($5C4D)
            add hl,bc
            jp L3EB9
L1F51       ld hl,($5C4D)
            add hl,de
            jp L3F93
L1F58       ld de,$0068
            call L1F51
            push de
            ld de,$0000
            call L1F51
            push de
            ld de,$0034
            call L1F51
            bit 7,d
            pop de
            pop hl
            jr nz,L1F76
            and a
            sbc hl,de
            ret
L1F76       scf
            sbc hl,de
            ccf
            ret
L1F7B       call L3ECF
            cp $85
            jr z,L1F8F
            cp $98
            jp nz,L09AF
            ld ($5C5D),de
            call L0914
            ret
L1F8F       rst $20
            bit 7,(iy+$01)
            jr z,L1FA1
            ld c,$20
            call L3B18
            ld a,(hl)
            cp $1F
            jp nc,L2080
L1FA1       ex de,hl
            call L3EC9
            call L08E9
            ld ($5C5F),hl
            ex de,hl
            jp nz,L25D5
            bit 7,(iy+$01)
            jr z,L1FE1
            push hl
            ld ($5B8E),hl
            call L3AC8
            pop hl
            push hl
            ld a,(hl)
            cp $1E
            jr nz,L1FC8
            call L2099
            jr L1FDD
L1FC8       cp $1D
            jr nz,L1FD1
            call L1E87
            jr L1FDD
L1FD1       add a,a
            ld hl,$325E
            add hl,a
            ld ($5C4D),hl
            call L1EA8
L1FDD       pop hl
            call L3BFD
L1FE1       ld de,($5C5D)
            ld hl,($5C5F)
            ld a,(hl)
            cp $3A
            jr z,L1F7B
            call L0914
            ret
L1FF1       ld hl,($5C45)
            ld ($5C42),hl
            ld a,($5C47)
            neg
            ld d,a
L1FFD       call L3EC9
            call L2029
L2003       ret c
L2004       call L2027
            jr nc,L201A
            call L3EC9
            ld c,$00
            call L125B
            ld ($5C5D),hl
            jr nc,L2004
            ld d,$FF
            jr L1FFD
L201A       xor a
            sub d
            ld ($5C47),a
            ld hl,($5C42)
            ld ($5C45),hl
            and a
            ret
L2027       jp (ix)
L2029       cp $3A
            jr z,L2066
L202D       ld a,($5B77)
            inc a
            jr z,L2049
            push de
            dec a
            ld hl,($5C55)
            call L3925
            pop bc
            ccf
            ret c
            res 7,h
            res 6,h
            ld ($5C55),hl
            ex de,hl
            ld e,c
            jr L205B
L2049       inc hl
            ld a,(hl)
            and $C0
            scf
            ret nz
            push hl
            inc hl
            inc hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            add hl,bc
            ld ($5C55),hl
            pop hl
L205B       ld b,(hl)
            inc hl
            ld c,(hl)
            inc hl
            ld ($5C42),bc
            inc hl
            ld d,$00
L2066       call L1241
            ld ($5C5D),hl
            ret nc
            jr L202D
            ld a,$1E
            call L3A40
            ret
            call L0052
            ld c,$1E
            jr nz,L2082
            call L3AC4
            ret nc
L2080       rst $08
            ld h,b
L2082       call L3B22
            jr c,L2080
            call L3BFD
            ret
            call L0052
            ret nz
            ld c,$1E
            call L3B22
            jr c,L2080
            call L3BFD
L2099       ld (iy+$58),$01
            ld e,$97
            ld ix,$2CBB
            call L1FF1
            jr c,L2080
            jp L35BC
            call L0DE8
            jp nz,L35BC
            call L1DAA
            cp $3D
            jr nz,L20C4
            rst $20
            push de
            call L0DFC
            pop de
            ld a,($5C3B)
            xor d
            and $40
L20C4       jp nz,L1DA8
            jr L20D2
            call L0DE8
            jp nz,L1EC8
            call L1DAA
L20D2       call L0914
            bit 7,(iy+$01)
            jr nz,L20E7
            cp $3D
            jr nz,L20D2
            rst $20
            ld d,$80
            call L254A
            jr L20D2
L20E7       cp $3D
            call z,L0020
            ld a,($5B77)
            inc a
            call nz,L39E3
            ld ($5C5F),hl
            ld hl,(DEFADD)
            ld ($5B8C),hl
            ld c,$22
            call L3AC4
            jr c,L2159
            ld ($5B94),sp
            call L217B
            ld a,(hl)
            cp $CC
            jr nz,L2155
L210F       rst $20
            call L05A3
            call L2C9F
            ld a,($5C3B)
            push af
            call L0DFC
            cp $2C
            call z,L3ECF
            call L2C9F
            ld d,(iy+$01)
            pop af
            xor d
            and $40
            jp nz,L2272
            bit 2,(iy+$30)
            jr nz,L215B
L2135       call L3DCF
            ld hl,($5B94)
            and a
            sbc hl,sp
            jr z,L214E
            ld ($5B94),sp
            ex de,hl
            ld hl,($5B8C)
            and a
            sbc hl,de
            ld ($5B8C),hl
L214E       call L3EC9
            cp $2C
            jr z,L210F
L2155       call L3A8A
            ret
L2159       rst $08
            ld h,c
L215B       ld hl,($5C4D)
            ld de,$3264
            sbc hl,de
            ld a,h
            and a
            jr nz,L2135
            ld a,l
            rra
            cp $1A
            jr nc,L2135
            push af
            call L26CB
            pop af
            inc h
            pop af
            call L26CB
            or l
            jr z,L2192
            out ($CD),a
            ret
            ld a,$01
            ld bc,$0D01
L2182       ld a,(hl)
            inc hl
            cp $22
            jr z,L2181
            bit 0,c
            jr nz,L2182
            cp $29
            jr z,L219E
            cp $28
L2192       jr z,L21A4
            cp $0E
            jr nz,L2182
            add hl,$0005
            jr L2182
L219E       djnz L2182
            ld ($5C5D),hl
            ret
L21A4       inc b
            jr L2182
L21A7       bit 7,(iy+$01)
            push de
            jr z,L21B2
            inc d
            call nz,L38BB
L21B2       pop af
            ld ($5B65),a
            bit 7,(iy+$01)
            jr nz,L21DA
            call L1313
            push de
            rst $20
            cp $29
            ld d,$00
            call nz,L254A
            cp $29
            jp nz,L1DA8
            rst $20
            pop de
            ex af,af'
            cp $23
            ret z
            ex af,af'
            cp $CC
            call z,L2565
            ret
L21DA       pop hl
            ld ($5B97),hl
            call L26CB
            sub b
            jr z,L21EC
            call L1286
            ld ($5B8E),hl
            ld ($5B90),de
            ld ($5B96),a
L21F1       rst $20
            cp $86
            jr nz,L223C
            rst $20
            call L2CAD
            cp $25
            jr z,L2272
            cp $22
            jr z,L2272
            push hl
            ld bc,$28B2
            call L3EC1
            jp c,L252D
            call L3EC9
            pop de
            sbc hl,de
            inc hl
            push bc
            ld b,h
            ld c,l
            call L3876
            pop de
            ld d,$90
            ld ($5CA6),de
            cp $28
            jr nz,L2228
            rst $20
            rst $20
            set 0,d
L2228       cp $2C
            call z,L0020
            call L2CAD
            bit 6,e
            jr z,L2238
            bit 5,e
            jr z,L223A
L2238       set 6,d
L223A       jr L228C
L223C       cp $E4
            jr z,L229B
            call L2CAD
            cp $29
            jr z,L224C
            cp $2C
            jr nz,L2258
            rst $20
L224C       call L2CAD
            cp $29
            jp z,L22DA
            ld d,$20
            jr L228C
L2258       call L24FB
            jr nc,L2274
            ld d,$85
            jr z,L226C
            inc hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ex de,hl
            call L3876
            ld d,$81
L226C       rst $20
            jr L2279
L226F       call L2CAD
L2272       rst $08
            add hl,de
L2274       call L0DFC
            ld d,$80
L2279       cp $2C
            call z,L3ECF
            call L2CAD
            cp $29
            jr z,L226F
            ld a,($5C3B)
            and $40
            or d
            ld d,a
L228C       call L3C1C
            jr nc,L226F
            call L3EC9
            cp $2C
            jr nz,L22DA
            jp L21F1
L229B       rst $20
            pop de
            pop bc
            exx
            ld a,($5B78)
            ld c,a
            ld hl,($5C57)
            inc a
            jr nz,L22B0
            ld de,($5C53)
            and a
            sbc hl,de
L22B0       push hl
            ld a,($5C6A)
            and $80
            push af
            inc sp
            ld b,$45
            push bc
            exx
            push bc
            ld (ERRSP),sp
            push de
            call L2CAD
            ld a,($5B77)
            ld ($5B78),a
L22CB       dec hl
            ld a,(hl)
            cp $21
            jr c,L22CB
            ld ($5C57),hl
            set 7,(iy+$30)
            jr L22E1
L22DA       call L2CAD
            cp $29
            jr nz,L2272
L22E1       call L263A
            call L2CAD
            rst $20
            ld a,($5B65)
            call L38D4
            ld hl,($5B90)
            ld ($5C45),hl
            ld hl,($5B8E)
            ld ($5C55),hl
            ld a,($5B96)
            ld ($5C47),a
            ld hl,($5B97)
            push hl
            bit 7,(iy+$01)
            ret z
L2309       call L26CB
            rlca
            add hl,hl
L230E       ld hl,(ERRSP)
            inc hl
            inc hl
            ld (DEFADD),hl
            ret
            bit 7,(iy+$01)
            call nz,L3823
            jr L2323
            ld a,($5B77)
L2323       ld d,a
            ld a,$22
            ex af,af'
            call L21A7
            call L0914
            ret
            exx
            ld hl,(DEFADD)
            push hl
            ld a,($5B65)
            push af
            ld hl,($5C5F)
            push hl
            ld hl,$FFF1
            add hl,sp
            ld sp,hl
            push hl
            ex de,hl
            ld hl,$5B8A
            ld bc,$000F
            ldir
            pop bc
            ld l,$FE
            push hl
            xor a
            ld hl,(DEFADD)
            dec bc
            dec bc
            sbc hl,bc
            push hl
            push af
            ld hl,$5B3A
            push hl
            ld hl,(ERRSP)
            ld (ERRSP),sp
            push hl
            ld a,$23
            ex af,af'
            exx
            rst $20
            call L21A7
            bit 7,(iy+$01)
            jr z,L239C
            rst $20
            call L0DFC
            ld c,$23
            call L3A86
            call L217B
L237E       pop hl
            ld (ERRSP),hl
            ld hl,$0008
            add hl,sp
            ld de,$5B8A
            ld bc,$000F
            ldir
            ld sp,hl
            pop hl
            ld ($5C5F),hl
            pop af
            ld ($5B65),a
            pop hl
            ld (DEFADD),hl
            ret
L239C       ld hl,$5C3B
            ld a,(hl)
            and $BF
            or d
            ld (hl),a
            jr L237E
L23A6       bit 7,(iy+$01)
            jr nz,L23B4
            ld d,$80
            call L2568
            call L0914
L23B4       call L23CC
            call L26CB
            sub b
            jr z,L23D3
            ld (bc),a
            call L3C1C
            call L3EC9
            cp $2C
            jp nz,L2309
            rst $20
            jr L23BC
L23CC       ld c,$20
            call L3B18
            ld a,(hl)
            cp $1F
            jp c,L2080
            call L26CB
            and d
            jr z,L23A6
            cp $FD
            jp z,L2474
            bit 7,(iy+$01)
            jr nz,L241C
L23E8       call L3EC9
            ld bc,$0006
            rst $28
            ld d,l
            ld d,$23
            ld (hl),$0E
            ld bc,$0500
L23F7       inc hl
            ld (hl),c
            djnz L23F7
            call L3ECF
            rst $28
            cp b
            jr z,L23CD
            ld l,c
            jp z,L09AF
            call L3EC9
            cp $3D
            call z,L0634
            call L08E9
            call z,L0914
            cp $2C
            jp nz,L1DA8
            rst $20
            jr L23E8
L241C       cp $0E
            jp nz,L1DA8
            push hl
            call L1EB4
            call L23CC
            pop hl
            inc hl
            push hl
            ld a,($5B77)
            ld d,a
            ld e,$00
            ld ($5CA6),de
            inc a
            jr nz,L246E
            ld de,($5C53)
            and a
            sbc hl,de
L243F       ld ($5CA8),hl
            pop hl
            ld de,$5CAA
            ld bc,$0005
            ldir
            ld ($5C5D),hl
            ld de,$5CA7
            ld bc,$0008
            call L386C
            ld d,$D0
            call L3C1C
            pop hl
            pop de
            pop bc
            dec c
            push bc
            push de
            push hl
            call L3EC9
            cp $2C
            jp nz,L230E
            rst $20
            jr L241C
L246E       ex de,hl
            call L3A2F
            jr L243F
L2474       rst $20
            call L0914
            ld a,$21
            call L3A40
            ld a,($5B77)
            ld bc,$0000
            call L267E
            ex de,hl
            dec hl
            ld ix,$24ED
            ld de,$0082
            call L2066
            call L2003
            jr L24A0
L2497       ld ix,$24ED
            ld e,$82
            call L1FF1
L24A0       jr c,L24F3
L24A2       call L3EC9
            inc hl
            push hl
            add hl,$0005
            call L3ED0
            rst $28
            cp b
            jr z,L247F
            ret
            ld a,$FE
            dec a
            ld hl,$3FB8
            jr nz,L24C1
            call L0634
            call L3853
L24C1       pop de
            ld bc,$0005
            ldir
            call L0068
            cp $30
            ld a,($5B77)
            inc a
            jr z,L24E3
            dec a
            call L32D0
            dec de
            push de
            call L3A2F
            pop de
            ex de,hl
            ld bc,$0005
            lddr
            rst $30
L24E3       call L3EC9
            cp $2C
            jr nz,L2497
            rst $20
            jr L24A2
            rst $20
            cp $0E
            ret z
            scf
            ret
L24F3       ld c,$21
            call L3A86
            ret nc
            rst $08
            ld b,$54
            ld e,l
            cp $25
            jr z,L252F
            call L38A6
            ret nc
L2505       rst $20
            call L38A1
            jr c,L2505
            cp $24
            call z,L3ECF
            cp $28
            jr nz,L2517
            rst $20
            cp $29
L2517       ex de,hl
            ld ($5C5D),hl
            scf
            ccf
            ret nz
            push de
            ld bc,$28B2
            call L3EC1
            pop de
            ld ($5C5D),de
            dec d
            ccf
            ret c
L252D       rst $08
            ld bc,$CDE7
            and (hl)
            jr c,L2559
            jr nc,L2517
            or $20
            ex af,af'
            rst $20
            cp $28
            jr nz,L2517
            rst $20
            cp $29
            jr nz,L2517
            ex af,af'
            sub $61
            ld e,a
            xor a
            scf
            ret
L254A       push de
            bit 7,d
            jr nz,L255B
            cp $2C
            jr z,L255E
            call L24FB
            jr nc,L255B
            rst $20
L2559       jr L255E
L255B       call L0DFC
L255E       pop de
            cp $2C
            ret nz
            rst $20
            jr L254A
L2565       ld d,$00
L2567       rst $20
L2568       call L3EC9
            bit 6,d
            jr z,L257E
            cp $E4
            jr z,L25B5
            cp $86
            jr nz,L257E
            rst $20
            cp $25
            jr nz,L257E
L257C       rst $08
            add hl,de
L257E       push de
            bit 7,d
            jr z,L258C
            call L24FB
            jr nc,L258C
            rst $20
            pop de
            jr L25B0
L258C       call L05A3
            call L3EC9
            pop de
            bit 7,d
            jr z,L25B0
            cp $3D
            jr nz,L25B0
            rst $20
            ld a,($5C3B)
            ld e,a
            push de
            call L0DFC
            pop de
            ld a,($5C3B)
            xor e
            and $40
            jr nz,L257C
            call L3EC9
L25B0       cp $2C
            ret nz
            jr L2567
L25B5       rst $20
            cp $29
            jr nz,L257C
            ret
            xor a
            ld ($5C75),a
            ld b,$00
            call L25C6
            jr L25E7
L25C6       ld c,b
L25C7       bit 7,(iy+$01)
            push bc
            call nz,L38BB
            call nz,L3823
            pop bc
            jr L25EF
L25D5       bit 7,(iy+$01)
            jr z,L25DE
            call L3BFD
L25DE       xor a
            ld ($5C75),a
            ld b,$00
            call L25EB
L25E7       pop hl
            jp L0931
L25EB       ld c,b
L25EC       ld a,($5B77)
L25EF       ld ($5B65),a
            pop hl
            ld ($5B56),hl
            call L3EC9
            inc c
            jr nz,L2609
            dec c
            ld de,$2228
            cp $93
            jr z,L2610
            inc d
            cp $A8
            jr z,L2610
L2609       cp $40
            jr nz,L265D
            ld de,$213A
L2610       rst $20
            bit 7,(iy+$01)
            jr z,L264E
            ld a,d
            call L1286
            ld ($5C47),a
            ld ($5C45),de
            ld ($5C55),hl
            ld a,($5B65)
            call L38D4
            ld hl,($5B56)
            push hl
            ld a,($5C75)
            and a
            jp z,L3C12
            ld hl,($5C5F)
            dec hl
L263A       ld de,($5B8A)
            and a
            sbc hl,de
            ex de,hl
            ld hl,($5B92)
            dec hl
            ld a,e
            add a,(hl)
            ld (hl),a
            inc hl
            ld a,d
            adc a,(hl)
            ld (hl),a
            ret
L264E       push de
            call L1315
            pop af
            inc c
            ld hl,($5B56)
            push hl
            ret z
            pop hl
            call L0914
L265D       ld hl,$0635
            djnz L2665
            ld hl,$0DF0
L2665       call L0AB9
            call L0914
            ld a,($5C75)
            and a
            ld a,$21
            call nz,L3A40
            ld hl,($5B56)
            push hl
            call L381B
            ld a,($5B65)
L267E       ld ($5C45),bc
            call L38D4
            call L3962
            jr nc,L269B
            call L3995
            inc de
            scf
L268F       ld (iy+$0D),$01
            ld ($5C55),hl
            ld ($5C5D),de
            ret
L269B       ld a,$FF
            ld ($5B77),a
            ld hl,($5C61)
            dec hl
            ld d,h
            ld e,l
            dec hl
            ex de,hl
            jr L268F
            nop
            nop
            nop
            ex (sp),hl
            pop hl
            ex (sp),hl
            ld ($5B56),hl
            pop hl
            ex (sp),hl
            ld ($5B54),hl
            pop hl
            call L32D0
            push hl
            ld hl,($5B54)
            ex (sp),hl
            ld ($5B54),bc
            ld bc,($5B56)
            jr L26FC
L26CB       ld ($5B56),a
            ld a,$87
L26D0       ld ($5B54),bc
            ex (sp),hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ex (sp),hl
L26DA       push $2705
            push bc
            push af
L26E0       ld a,($5B56)
            jr L26FB
L26E5       ld ($5B56),a
L26E8       ld a,$8A
L26EA       jr L26D0
            call L0068
            add a,d
            jr z,L26BB
            nop
            nop
            nop
            nop
            nop
            ld ($5B54),bc
L26FB       pop bc
L26FC       ld c,$E3
L26FE       out (c),b
L2700       ld bc,($5B54)
            ret
            ld h,$00
            sbc a,e
L2708       daa
            ld h,$00
            xor d
            daa
            dec h
L270E       jr z,L26FE
            daa
            rla
            jr z,L272B
            jr z,L2779
            add hl,hl
            ld h,$00
            cp (hl)
            daa
            add a,l
            jr z,L26E8
            daa
            rst $08
L2720       daa
            in a,($27)
            ld h,$00
            xor $27
            jp m,L0827
            jr z,L2743
            jr z,L2753
L272E       jr z,L2763
L2730       jr z,L2770
            jr z,L277B
            jr z,L2785
            jr z,L2790
            jr z,L27A1
            jr z,L27A9
            jr z,L26E8
            jr z,L26EA
            jr z,L26C7
            jr z,L26D0
            jr z,L27AD
            jr z,L26E0
            jr z,L2799
            jr z,L26ED
            jr z,L26F8
            jr z,L26FA
            jr z,L26FC
            jr z,L2708
            jr z,L2700
            jr z,L2702
            jr z,L270E
            jr z,L2720
L275C       jr z,L2784
L275E       nop
            push de
L2760       jr z,L2749
L2762       jr z,L275C
            jr z,L275E
            jr z,L2760
            jr z,L2762
            jr z,L2771
            add hl,hl
            ld d,$29
            dec h
L2770       jr z,L2799
            add hl,hl
            ld (hl),$29
            ld b,h
            add hl,hl
            ld d,$29
L2779       dec h
            jr z,L27C0
            add hl,hl
            ld d,d
            add hl,hl
            ld h,e
            add hl,hl
            xor d
            jr z,L272E
L2784       jr z,L2730
            jr z,L27F9
            add hl,hl
            sub l
            add hl,hl
            and c
            add hl,hl
            or l
            add hl,hl
            cp a
L2790       add hl,hl
            ld a,l
            add hl,hl
            ret
            add hl,hl
            jp c,LE229
            add hl,hl
L2799       ld h,$00
            ld d,a
            ld (hl),d
            ld l,a
            ld l,(hl)
            ld h,a
            jr nz,L2808
            ld l,c
            ld l,h
            ld h,l
            jr nz,L281B
            ld a,c
            ld (hl),b
L27A9       push hl
            ld d,h
            ld l,a
            ld l,a
L27AD       jr nz,L281C
            ld h,c
            ld l,(hl)
            ld a,c
            jr nz,L2824
            ld h,c
            ld (hl),d
            ld h,l
            ld l,(hl)
            ld (hl),h
            ld l,b
            ld h,l
            ld (hl),e
            ld h,l
            di
            ld c,c
            ld l,(hl)
L27C0       halt
            ld h,c
            ld l,h
            ld l,c
            ld h,h
            jr nz,L2835
            ld l,a
            ld (hl),h
            push hl
            ld c,(hl)
            ld l,a
            ld (hl),h
            ld h,l
            jr nz,L281F
            ld (hl),l
            ld (hl),h
            jr nz,L2843
            ld h,(hl)
            jr nz,L2849
            ld h,c
            ld l,(hl)
            ld h,a
            push hl
            ld d,h
            ld l,a
            ld l,a
            jr nz,L284D
            ld h,c
            ld l,(hl)
            ld a,c
            jr nz,L2859
            ld l,c
            ld h,l
            ld h,h
            jr nz,L2858
            ld l,a
            ld (hl),h
            ld h,l
            di
            ld b,d
            ld h,c
            ld h,h
            jr nz,L2859
            ld l,c
            ld l,h
            ld h,l
            ld l,(hl)
            ld h,c
            ld l,l
L27F9       push hl
            ld b,d
            ld h,c
            ld h,h
            jr nz,L286F
            ld h,c
            ld (hl),d
            ld h,c
            ld l,l
            ld h,l
            ld (hl),h
            ld h,l
            ld (hl),d
            di
L2808       ld b,h
            ld (hl),d
            ld l,c
            halt
            ld h,l
            jr nz,L287D
            ld l,a
            ld (hl),h
            jr nz,L2879
            ld l,a
            ld (hl),l
            ld l,(hl)
            call po,L6946
            ld l,h
            ld h,l
L281B       jr nz,L288B
            ld l,a
            ld (hl),h
L281F       jr nz,L2887
            ld l,a
            ld (hl),l
            ld l,(hl)
L2824       call po,L6C41
            ld (hl),d
            ld h,l
            ld h,c
            ld h,h
            ld a,c
            jr nz,L2893
            ld a,b
            ld l,c
            ld (hl),e
L2831       ld (hl),h
            di
            ld b,l
            ld l,(hl)
L2835       ld h,h
            jr nz,L28A7
            ld h,(hl)
            jr nz,L28A1
            ld l,c
            ld l,h
            push hl
            ld b,h
            ld l,c
            ld (hl),e
            ld l,e
            jr nz,L28AA
            ld (hl),l
            ld l,h
            call pe,L6944
L2849       ld (hl),d
            jr nz,L28B2
            ld (hl),l
L284D       ld l,h
            call pe,L6552
            ld h,c
            ld h,h
            jr nz,L28C4
            ld l,(hl)
            ld l,h
            ld sp,hl
L2858       ld b,d
L2859       ld h,c
            ld h,h
            jr nz,L28C3
            ld l,c
            ld l,h
            ld h,l
            jr nz,L28D0
            ld (hl),l
            ld l,l
            ld h,d
            ld h,l
            jp p,L6E49
            jr nz,L28E0
            ld (hl),e
            push hl
            ld c,(hl)
            ld l,a
L286F       jr nz,L28E3
            ld h,l
            ld l,(hl)
            ld h,c
            ld l,l
            ld h,l
            jr nz,L28DA
            ld h,l
L2879       ld (hl),h
            ld (hl),a
            ld h,l
            ld h,l
L287D       ld l,(hl)
            jr nz,L28E4
            ld (hl),d
            ld l,c
            halt
            ld h,l
            di
            ld d,h
            ld l,a
L2887       ld l,a
            jr nz,L28EC
            ld l,c
L288B       rst $20
            ld c,(hl)
            ld l,a
            ld (hl),h
            jr nz,L28F3
            ld l,a
            ld l,a
L2893       ld (hl),h
            ld h,c
            ld h,d
            ld l,h
            push hl
            ld c,(hl)
            ld l,a
            ld (hl),h
            jr nz,L290F
            ld h,l
            ld h,c
            ld h,h
            ld sp,hl
L28A1       ld d,e
            ld h,l
            ld h,l
            ld l,e
            jr nz,L290D
L28A7       ld h,c
            ld l,c
            call pe,L6944
            ld (hl),e
            ld l,e
            jr nz,L2915
            ld (hl),d
            ld (hl),d
L28B2       ld l,a
            jp p,L6E55
            ld (hl),e
            ld (hl),l
            ld l,c
            ld (hl),h
            ld h,c
            ld h,d
            ld l,h
            ld h,l
            jr nz,L292D
            ld h,l
            ld h,h
            ld l,c
L28C3       pop hl
L28C4       ld c,c
            ld l,(hl)
            halt
            ld h,c
            ld l,h
            ld l,c
            ld h,h
            jr nz,L292E
            ld (hl),h
            ld (hl),h
            ld (hl),d
L28D0       ld l,c
            ld h,d
            ld (hl),l
            ld (hl),h
            push hl
            ld b,h
            ld h,l
            ld (hl),e
            ld (hl),h
            jr nz,L293E
            ld h,c
            ld l,(hl)
            daa
            ld (hl),h
            jr nz,L2943
            ld h,l
            jr nz,L295B
L28E4       ld l,c
            ld l,h
            call po,L6544
            ld (hl),e
            ld (hl),h
            jr nz,L295A
            ld (hl),l
            ld (hl),e
            ld (hl),h
            jr nz,L2954
            ld h,l
L28F3       jr nz,L2965
            ld h,c
            ld (hl),h
            ret pe
            ld c,c
            ld l,(hl)
            halt
            ld h,c
            ld l,h
            ld l,c
            ld h,h
            jr nz,L2965
            ld (hl),d
            ld l,c
            halt
            push hl
            ld b,e
            ld l,a
            ld h,h
            ld h,l
            jr nz,L2977
            ld h,l
            ld l,(hl)
L290D       ld h,a
            ld (hl),h
L290F       ld l,b
            jr nz,L2977
            ld (hl),d
            ld (hl),d
            ld l,a
L2915       jp p,L6E49
            halt
            ld h,c
            ld l,h
            ld l,c
            ld h,h
            jr nz,L298F
            ld h,c
            ld (hl),d
            ld (hl),h
            ld l,c
            ld (hl),h
            ld l,c
            ld l,a
            xor $4E
            ld l,a
            ld (hl),h
            jr nz,L2995
            ld l,l
L292D       ld (hl),b
L292E       ld l,h
            ld h,l
            ld l,l
            ld h,l
            ld l,(hl)
            ld (hl),h
            ld h,l
            call po,L6150
            ld (hl),d
            ld (hl),h
            ld l,c
            ld (hl),h
            ld l,c
            ld l,a
L293E       ld l,(hl)
            jr nz,L29B0
            ld (hl),b
            ld h,l
L2943       xor $4F
            ld (hl),l
            ld (hl),h
            jr nz,L29B8
            ld h,(hl)
            jr nz,L29B4
            ld h,c
            ld l,(hl)
            ld h,h
            ld l,h
            ld h,l
            di
            ld c,(hl)
            ld l,a
L2954       jr nz,L29C9
            ld (hl),a
            ld h,c
            ld (hl),b
            jr nz,L29CB
L295B       ld h,c
            ld (hl),d
            ld (hl),h
            ld l,c
            ld (hl),h
            ld l,c
            ld l,a
            xor $49
            ld l,(hl)
L2965       halt
            ld h,c
            ld l,h
            ld l,c
            ld h,h
            jr nz,L29D0
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
L2977       ld h,h
            jr nz,L29EA
            ld h,c
            ld (hl),h
            ret pe
            ld b,(hl)
            ld (hl),d
            ld h,c
            ld h,a
            ld l,l
            ld h,l
            ld l,(hl)
            ld (hl),h
            ld h,l
            ld h,h
            jr nz,L29B6
            jr nz,L2A00
            ld (hl),e
            ld h,l
            jr nz,L29BD
L298F       ld b,h
            ld b,l
            ld b,(hl)
            ld d,d
            ld b,c
            rst $00
L2995       ld c,c
            ld l,(hl)
            halt
            ld h,c
            ld l,h
            ld l,c
            ld h,h
            jr nz,L2A0B
            ld l,a
            ld h,h
            push hl
            ld b,h
            ld l,c
            ld (hl),d
            ld h,l
            ld h,e
            ld (hl),h
            jr nz,L2A0C
            ld l,a
            ld l,l
            ld l,l
            ld h,c
            ld l,(hl)
            ld h,h
            jr nz,L2A16
            ld (hl),d
            ld (hl),d
            ld l,a
L29B4       jp p,L6F4C
            ld l,a
L29B8       ld (hl),b
            jr nz,L2A20
            ld (hl),d
            ld (hl),d
L29BD       ld l,a
            jp p,L6F4E
            jr nz,L2A07
            ld b,l
            ld b,(hl)
            ld d,b
            ld d,d
            ld c,a
            jp L6F44
L29CB       ld (hl),h
            jr nz,L2A31
            ld l,a
            ld l,l
L29D0       ld l,l
            ld h,c
            ld l,(hl)
            ld h,h
            jr nz,L2A3B
            ld (hl),d
            ld (hl),d
            ld l,a
            jp p,L6F4E
            jr nz,L2A23
            ld c,(hl)
            ld b,h
            ld c,c
            add a,$4E
            ld l,a
            jr nz,L2A52
            ld h,c
            ld h,d
            ld h,l
            call pe,L6F4C
            ld h,a
            ld l,c
            ld h,e
            ld h,c
            ld l,h
            jr nz,L2A57
            ld (hl),d
            ld l,c
            halt
            ld h,l
            ld (hl),e
            ld a,($0020)
            ld d,d
            ld h,l
            ld h,(hl)
            ld l,a
            ld (hl),d
L2A00       ld l,l
            ld h,c
            ld (hl),h
            jr nz,L2A6B
            ld l,a
            ld (hl),d
L2A07       ld l,l
            ld h,c
            ld (hl),h
            ld (hl),h
L2A0B       ld h,l
L2A0C       ld h,h
            jr nz,L2A73
            ld l,c
            ld (hl),e
            ld l,e
            nop
            nop
            nop
            nop
L2A16       nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
L2A20       nop
            nop
            nop
L2A23       nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
L2A31       nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
L2A3B       nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
L2A52       nop
            nop
            nop
            nop
            nop
L2A57       nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
L2A6B       nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
L2A73       nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            ld b,l
            ld (hl),d
            ld h,c
            ld (hl),e
            ld h,l
            jr nz,L2A83
L2A83       nop
            nop
            ld d,b
            ld h,c
            ld (hl),e
            ld (hl),h
            ld h,l
            jr nz,L2AF4
            ld h,l
            ld (hl),d
            ld h,l
            nop
            ld b,e
            ld l,a
            ld (hl),b
            ld a,c
            nop
            ld c,l
            ld l,a
            halt
            ld h,l
            nop
            ld c,l
            ld l,a
            halt
            ld h,l
            jr nz,L2B08
            ld h,l
            ld (hl),d
            ld h,l
            nop
            ld a,a
            ld sp,$3839
            ld ($202C),a
            ld sp,$3839
            ld (hl),$2C
            jr nz,L2AE3
            add hl,sp
            jr c,L2AEC
            jr nz,L2AF8
            ld l,l
            ld (hl),e
            ld (hl),h
            ld (hl),d
            ld h,c
            ld h,h
            jr nz,L2B0F
            ld l,h
            ld h,e
            ld l,$0D
            ld a,a
            ld ($3030),a
            jr nc,L2AF6
            ld ($3230),a
            inc sp
            jr nz,L2B16
            ld h,c
            ld (hl),d
            ld (hl),d
            ld a,c
            jr nz,L2B21
            ld h,c
            ld l,(hl)
            ld h,e
            ld h,c
            ld (hl),e
            ld (hl),h
            ld h,l
            ld (hl),d
            jr nz,L2B55
            ld ($302E),a
            cp b
L2AE3       ld bc,$000A
            ld h,b
            ld l,c
            call L26E5
            xor b
L2AEC       daa
            ret
L2AEE       nextreg $8E,$09
L2AF2       ex af,af'
            pop af
L2AF4       ld ($5B52),hl
            ld hl,($5B6A)
            ld ($5B6A),sp
            ld sp,hl
            ld hl,($5B52)
            push af
            ex af,af'
            ret
L2B05       ex af,af'
            pop af
            ld ($5B52),hl
            ld hl,($5B6A)
            ld ($5B6A),sp
            ld sp,hl
            ld hl,($5B52)
            push af
L2B16       ex af,af'
            nextreg $8E,$79
            ret
L2B1C       call L2AF2
L2B1F       nextreg $8E,$09
            ld a,(hl)
            nextreg $8E,$79
            ld (de),a
            inc hl
            inc de
            dec bc
            ld a,b
            or c
            jr nz,L2B1F
            nextreg $8E,$09
            call L2AF2
            ret
L2B38       call L2AF2
L2B3B       nextreg $8E,$79
            ld a,(hl)
            nextreg $8E,$09
            ld (de),a
            inc hl
            inc de
            dec bc
            ld a,b
            or c
            jr nz,L2B3B
            call L2AF2
            ret
L2B50       ld a,$7F
            in a,($FE)
            rra
L2B55       ret c
            ld a,$FE
            in a,($FE)
            rra
            ret c
            call L3E75
            ret nz
            pop hl
            ld bc,$0934
            sbc hl,bc
            jr z,L2B6A
            rst $08
            inc d
L2B6A       rst $08
            inc c
            call L37B9
            ld hl,$3F9F
            call L37B9
            ld hl,$5C3B
            res 5,(hl)
L2B7A       bit 5,(hl)
            jr z,L2B7A
            res 5,(hl)
            ld a,($5C08)
            and $DF
            cp $59
            jr z,L2B8E
            cp $4E
            jr nz,L2B7A
            and a
L2B8E       push af
            call L3E80
            ret
            ld c,$F1
            ret
            rst $18
            ld c,$02
            call L2BA1
            jp nc,L0DCE
            rst $30
            ret
L2BA1       push bc
            xor a
            rst $00
            jp nc,LC101
            ret nc
            push bc
            ld hl,$2C4A
            call L37B9
L2BAF       call L3E80
            ret po
            ld de,$DFE6
            cp $59
            jr nz,L2BAF
            call L3E80
            ret
            ld c,$C1
            ld a,c
            cp $02
            jr nz,L2BCA
            call L1353
            ld a,$02
L2BCA       push af
            rst $00
            ex de,hl
            ld a,(de)
            pop af
            call L26E5
            ld l,e
            jr nc,L2BCA
            cp $02
            jr nc,L2BDE
            call L26CB
            jp m,LF129
            cp $03
            scf
            ret z
            cp $02
            jr nc,L2C11
            call L3E80
            ld c,$F7
            nextreg $07,$00
            ld hl,$2034
            rst $00
            add a,d
            rrca
            ld hl,$2050
            rst $00
            add a,d
            rrca
            rst $18
            call L3E80
            inc bc
            djnz L2BF3
            ld l,e
            dec c
            call L26CB
            dec de
            ld hl,($A421)
            ld hl,($F5CD)
            ld (hl),$21
            jp pe,LCD29
            push af
            ld (hl),$01
            ld b,c
            djnz L2C94
            sub $41
            rst $00
            call nz,L3803
            ld e,$3E
            inc d
            call L3708
            ld a,($5B79)
            cp c
            ld a,$00
            jr nz,L2C30
            inc a
L2C30       call L3708
            ld a,c
            call L3708
            ld a,$14
            call L3708
            xor a
            call L3708
            inc c
            djnz L2C1A
            ld a,$0D
            call L3708
            scf
            ret
            ld d,d
            ld h,l
            ld l,l
            ld l,a
            halt
            ld h,l
            cpl
            ld l,c
            ld l,(hl)
            ld (hl),e
            ld h,l
            ld (hl),d
            ld (hl),h
            jr nz,L2CAC
            ld b,h
            jr nz,L2CBD
            ld l,(hl)
            ld h,h
            jr nz,L2CD0
            ld (hl),d
            ld h,l
            ld (hl),e
            ld (hl),e
            jr nz,L2CBF
            dec c
            nop
            ld hl,$3140
            call L3F93
            ld a,e
            cp $FF
            jr nz,L2C77
            ld a,$63
            jr L2C78
L2C77       dec a
L2C78       ld ($5C3A),a
            ld hl,$3142
            call L3F93
            ld ($5C45),de
            ld hl,$3144
            call L3F93
            ld a,e
            ld ($5C47),a
            ld hl,$3146
            call L3F93
            ld a,e
            call L38D4
            call L0ABA
            jp L0C1A
L2C9F       ld bc,(DEFADD)
            ld hl,($5B8C)
            ld ($5B8C),bc
            ld (DEFADD),hl
L2CAD       ld bc,($5C5D)
            ld hl,($5C5F)
            ld ($5C5F),bc
            jp L3ED0
            rst $20
            cp $8E
            scf
L2CBF       jr z,L2CC5
            inc (iy+$58)
            ret
L2CC5       dec (iy+$58)
            ret nz
            and a
            ret
            rst $20
            cp $25
            scf
            ret nz
L2CD0       rst $20
            push de
            call L26CB
            ret nz
            daa
            ex de,hl
            ld hl,($5C4D)
            and a
            sbc hl,de
            pop de
            ret z
            scf
            ret
            rst $20
            cp $25
            scf
            ret z
            push de
            call L0642
            ld de,($5B8E)
            rst $28
            add a,(hl)
            dec e
            pop de
            scf
            ret nz
            and a
            ret
L2CF7       ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ex (sp),hl
            push $5B3E
            push bc
            ld bc,($5B54)
            jp L5B48
            call L3823
            cp $04
            jp nc,L13E6
            nextreg $07,a
            ret
            ld a,($5C7F)
            and $0F
            jr z,L2D21
            call L26E5
            add hl,de
            dec l
            ret
L2D21       rst $28
            dec l
            inc hl
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
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
L2DE1       call L3EC9
            cp $3B
            jr z,L2DFF
            cp $2C
            jr nz,L2DF9
            bit 7,(iy+$01)
            jr z,L2DFF
            ld a,$06
            rst $28
            djnz L2DF7
L2DF7       jr L2DFF
L2DF9       cp $27
            ret nz
            rst $28
            push af
            rra
L2DFF       rst $20
            call L08E6
            jr nz,L2E06
L2E05       pop bc
L2E06       cp a
            ret
L2E08       call L3EC9
            cp $AC
            jr nz,L2E1C
            call L063B
            call L3EF9
            rst $28
            rlca
            inc hl
            ld a,$16
            jr L2E57
L2E1C       cp $A9
            jr nz,L2E48
            push hl
            rst $20
            pop hl
            ld ($5C5D),hl
            cp $28
            jr z,L2E62
            cp $23
            jr z,L2E62
            call L063B
            call L3EF9
            call L3823
            push af
            call L381B
            pop af
            push bc
            ld b,a
            ld c,$19
            rst $28
            rra
            jr nz,L2E05
            rst $28
            rra
            jr nz,L2E11
L2E48       cp $AD
            jr nz,L2E5B
            call L0634
            call L3EF9
            call L381B
            ld a,$17
L2E57       rst $28
            ld e,$20
            ret
L2E5B       call L2F7A
            call c,L2EA3
            ret nc
L2E62       call L0DFC
            call L3EF9
            bit 6,(iy+$01)
            jr z,L2E72
            rst $28
            ex (sp),hl
            dec l
            ret
L2E72       call L3842
            ld ix,($5C51)
            ld a,(ix+$04)
            cp $53
            jr nz,L2E94
L2E80       ld a,($5C7F)
            and $0F
            jr z,L2E9C
            add a,$F2
            ld xh,a
            ld xl,$00
L2E8E       call L3E80
            adc a,b
            daa
            ret
L2E94       cp $4B
            jr z,L2E80
            cp $57
            jr z,L2E8E
L2E9C       rst $28
            inc a
            jr nz,L2E69
L2EA0       call L3EC9
L2EA3       cp $23
            scf
            ret nz
            call L0634
            and a
            call L3EF9
            call L381B
            cp $10
            jr nc,L2EBA
            rst $28
            ld bc,$A716
            ret
L2EBA       rst $08
            rla
            ld a,$02
L2EBE       call L1353
            call L2EA0
            ret c
            call L3EC9
            cp $3B
            jr z,L2ECF
            cp $2C
            ret nz
L2ECF       rst $20
            ret
            ld a,$03
            jr L2ED7
            ld a,$02
L2ED7       call L1353
            call L2EE1
            call L0914
            ret
L2EE1       call L3EC9
            call L08E6
            jr z,L2EF6
L2EE9       call L2DE1
            jr z,L2EE9
            call L2E08
            call L2DE1
            jr z,L2EE9
L2EF6       cp $29
            ret z
            rst $28
            push af
            rra
            ret
            ld a,$01
            call L1353
            call L0DE8
            jr z,L2F0C
            call L3E80
            ret
            ld c,$CD
            inc e
            cpl
            call L0914
            ld a,($5C7F)
            and $0F
            ret nz
            rst $28
            and b
            jr nz,L2EE5
L2F1C       call L2DE1
            jr z,L2F1C
            cp $28
            jr nz,L2F33
            rst $20
            call L2EE1
            call L3EC9
            cp $29
            jr nz,L2F78
            rst $20
            jr L2F62
L2F33       cp $CA
            jr nz,L2F47
            rst $20
            call L05A3
            set 7,(iy+$37)
            bit 6,(iy+$01)
            jr z,L2F57
            jr L2F78
L2F47       cp $25
            jr z,L2F50
            call L38A6
            jr nc,L2F5F
L2F50       call L05A3
            res 7,(iy+$37)
L2F57       call L0DE8
            call nz,L2F8F
            jr L2F62
L2F5F       call L2E08
L2F62       call L2DE1
            jr z,L2F1C
            ret
L2F68       rst $20
L2F69       call L2F7A
            ret c
            call L3EC9
            cp $2C
            jr z,L2F68
            cp $3B
            jr z,L2F68
L2F78       rst $08
            dec bc
L2F7A       cp $D9
            ret c
            cp $DF
            ccf
            ret c
            push af
            rst $20
            pop af
L2F84       sub $C9
            push af
            call L0635
            pop af
            rst $28
            inc bc
            ld ($EFC9),hl
            cp a
            ld d,$3A
            dec sp
            ld e,h
            ld hl,$5C71
            res 6,(hl)
            and $40
            or (hl)
            ld (hl),a
            ld ix,($5C51)
            rst $28
            sub $21
            jr z,L2FFD
            cp $57
            jr z,L3002
L2FAB       ld bc,$0001
            rst $28
            jr nc,L2FB1
L2FB1       res 3,(iy+$02)
            res 5,(iy+$02)
            rst $28
            sbc a,$15
            ld (hl),a
            cp $0D
            jr nz,L2FAB
L2FC1       ld hl,($5C63)
            ld de,($5C61)
            scf
            sbc hl,de
            ld b,h
            ld c,l
            ld a,b
            or c
            jr z,L2FED
            call L385E
            bit 7,(iy+$37)
            jr nz,L2FE7
            ld b,$1D
            bit 6,(iy+$37)
            jr nz,L2FE4
            ld b,$18
L2FE4       rst $28
            sbc a,$35
L2FE7       ld a,($5C71)
            jp L3DD2
L2FED       bit 6,(iy+$37)
            jr nz,L2FF8
            call L385E
            jr L2FE7
L2FF8       call L3887
            jr L2FE7
L2FFD       ld bc,$E0BF
            jr L3015
L3002       ld c,$C0
            xor a
            ld b,(ix+$12)
L3008       add a,(ix+$1C)
            jr c,L3013
            cp c
            jr nc,L3013
            djnz L3008
            ld c,a
L3013       ld b,$60
L3015       ld e,$00
L3017       xor a
            ld hl,$E152
            push bc
            call L3E80
            exx
            daa
            push de
            ld c,e
            ld b,$00
            inc bc
            push bc
            rst $28
            jr nc,L302A
L302A       pop bc
            ld hl,$100B
            ld ($5B8A),hl
            ld hl,$E152
            call L2AF2
            call L3E80
            ld b,a
            add hl,de
            call L2AF2
            ex de,hl
            ld (hl),$0D
            ld hl,($5C5D)
            push hl
            ld hl,(ERRSP)
            push hl
            ld hl,($5B6C)
            push hl
            ld hl,$306F
            ld ($5B6C),hl
            ld hl,$5B3A
            push hl
            ld (ERRSP),sp
            call L2FC1
            pop hl
            pop hl
            ld ($5B6C),hl
            pop hl
            ld (ERRSP),hl
            pop hl
            ld ($5C5D),hl
            pop de
            pop bc
            ret
            call L3E80
            jr L30B2
            rst $28
            cp a
            ld d,$E1
            ld ($5B6C),hl
            pop hl
            ld (ERRSP),hl
            pop hl
            ld ($5C5D),hl
            ld (iy),$FF
            pop de
            ld d,e
            pop bc
            ld b,$74
            jr L3017
            call L381B
            ld hl,$0542
            and a
            sbc hl,bc
            jp nz,L334E
            ld a,($5B5E)
            and $10
            add a,a
            add a,a
            add a,a
            ld de,$0000
            ld h,d
            ld l,a
            push hl
            rst $18
            rst $00
            ccf
            ld bc,$E1F7
            jp nc,L0DCA
            ld a,($5B68)
            or $80
            xor l
            ld ($5B68),a
            ret
L30BB       rst $30
L30BC       rst $08
            ld a,(bc)
            ld hl,$5B66
            res 7,(hl)
            res 6,(hl)
            call L08E9
            jr z,L30E9
            set 7,(hl)
            call L0635
            cp $2C
            jr nz,L30E9
            ld hl,$5B66
            res 7,(hl)
            set 6,(hl)
            call L0634
            cp $2C
            jr nz,L30E9
            ld hl,$5B66
            set 7,(hl)
            call L0634
L30E9       call L0914
            xor a
            ld hl,$5B66
            bit 7,(hl)
            jr z,L30F7
            call L3823
L30F7       push af
            ld hl,$5B66
            bit 6,(hl)
            ld bc,$4000
            ld h,c
            ld l,c
            jr z,L310E
            call L381B
            push bc
            call L381B
            ld h,b
            ld l,c
            pop bc
L310E       push hl
            push bc
            call L3823
            pop bc
            pop hl
            pop de
            call L32C3
            dec bc
            push hl
            add hl,bc
            pop hl
            jr c,L30BB
            ld (hl),d
            ld d,h
            ld e,l
            inc de
            ld a,b
            or c
            jr z,L3129
            ldir
L3129       rst $30
            ret
            cp $CC
            jr z,L3156
            call L063C
            cp $CC
            jr nz,L31A5
            call L063B
            call L0914
            call L381B
            push bc
            call L3823
            push af
            call L381B
            push bc
            call L381B
            push bc
            call L3823
            pop hl
            pop bc
            pop ix
            pop de
            jr L316D
L3156       call L0634
            call L0914
            call L3823
            push af
            call L3823
            pop ix
            ld hl,$0000
            ld d,h
            ld e,l
            ld bc,$4000
L316D       ld xl,a
            call L32C3
            rst $30
            ex de,hl
            ld a,xh
            call L32C3
            dec bc
            push hl
            add hl,bc
            pop hl
            jp c,L30BB
            ex de,hl
            push hl
            add hl,bc
            pop hl
            jp c,L30BB
            inc bc
            ld a,xl
            call L32FF
            res 6,h
            ldir
            ld a,$02
            call L32FF
            rst $30
            ret
            cp $2C
            jr z,L31BA
            call L3245
            push bc
            call L063C
            cp $2C
L31A5       jp nz,L09AF
            call L063B
            pop af
            call L0914
            ld (iy+$58),a
            call L3205
            call L381B
            jr L31DC
L31BA       call L0634
            cp $2C
            jr nz,L31A5
            call L063B
            call L3245
            push bc
            call L0635
            pop af
            call L0914
            or $80
            ld (iy+$58),a
            call L381B
            push bc
            call L3205
            pop bc
L31DC       push bc
            call L3823
            pop hl
            call L32C3
            srl a
            call L32FF
            res 6,h
            ld ($5B9B),hl
            ld a,$14
            call L127D
            ld ($5C93),a
            ld ix,$5C92
            ld hl,$218A
            call L3E80
            call nz,LC320
            sub c
            ld sp,$07EF
            inc hl
            ld ($5CA3),bc
            ld a,b
            and a
            jr z,L3242
            ld a,c
            and a
            jr z,L3242
            rst $28
            rlca
            inc hl
            ld ($5CA5),bc
            ld a,($5C7F)
            and $0F
            ld e,a
            ld a,($5CA3)
            add a,c
            jr c,L3242
            cp $21
            jr nc,L3242
            dec e
            jr nz,L3232
            cp $11
            jr nc,L3242
L3232       inc e
            ld a,($5CA4)
            add a,b
            jr c,L3242
            cp $19
            jr nc,L3242
            dec e
            ret nz
            cp $0D
            ret c
L3242       jp L30BC
L3245       cp $CC
            jp nz,L09AF
            rst $20
            ld b,$01
            cp $26
            jr z,L3264
            ld b,$02
            cp $7C
            jr z,L3264
            ld b,$03
            cp $5E
            jr z,L3264
            ld b,$00
            cp $7E
            ret nz
            ld b,$04
L3264       rst $20
            ret
            rst $18
            ld a,($5B69)
L326A       call L332C
            jr z,L3282
            ld a,(de)
            and b
            jr nz,L3282
            ld a,(de)
            or b
            ld (de),a
            ld a,(hl)
            or b
            ld (hl),a
            rst $30
            ld b,$00
            call L3867
            jp L3DCF
L3282       dec c
            ld a,$08
            cp c
            ld a,c
            jr c,L326A
            jr L32E7
            call L3823
            cp $09
            jp c,L334E
            ld bc,$243B
            ld d,$12
            out (c),d
            inc b
            in e,(c)
            dec b
            inc d
            out (c),d
            inc b
            in d,(c)
            ld b,$03
L32A6       cp d
            jp z,L32C1
            cp e
            jr z,L32C1
            inc d
            inc e
            djnz L32A6
            rst $18
            call L332C
            jr nz,L32BF
            ld a,b
            cpl
            ld b,a
            and (hl)
            ld (hl),a
            ld a,(de)
            and b
            ld (de),a
L32BF       rst $30
            ret
L32C1       rst $08
            inc a
L32C3       ex af,af'
            ld a,h
            and $C0
            jr z,L32CB
L32C9       rst $08
            ld a,(bc)
L32CB       ex af,af'
L32CC       set 7,h
            set 6,h
L32D0       ex (sp),hl
            exx
            pop hl
            ld ($5B52),hl
            ld hl,($5B6A)
            ld ($5B6A),sp
            ld sp,hl
L32DE       call L332C
            jr z,L32F0
            ld a,(de)
            and b
            jr z,L32EA
L32E7       rst $30
            rst $08
            inc bc
L32EA       ld a,(hl)
            or b
            ld (hl),a
            ld a,(de)
            or b
            ld (de),a
L32F0       ld a,c
            exx
            push hl
            ld hl,($5B52)
L32F6       add a,a
            nextreg $56,a
            inc a
            nextreg $57,a
            ret
L32FF       add a,a
            nextreg $54,a
            inc a
            nextreg $55,a
            ret
            ex af,af'
            ld a,h
            and $C0
            jr nz,L32C9
            ex af,af'
            push hl
            ld hl,($5B6A)
            ld ($5B6A),sp
            ld sp,hl
            ld hl,$331E
            exx
            jr L32DE
            nextreg $8E,$09
            ld hl,($5B6A)
            ld ($5B6A),sp
            ld sp,hl
            pop hl
            ret
L332C       ld hl,($5B68)
            cp $08
            jr z,L334D
            jr nc,L3350
            cp $07
            jr z,L334D
            cp $01
            jr z,L3349
            cp $03
            jr z,L3349
            cp $04
            jr z,L3349
            cp $06
            jr nz,L3354
L3349       bit 7,l
            jr nz,L3354
L334D       rst $30
L334E       rst $08
            add hl,bc
L3350       inc h
            cp h
            jr nc,L32E7
L3354       ex af,af'
            ld a,$08
            call L32F6
            ex af,af'
            ld c,a
            rrca
            rrca
            and $1F
            ld d,$C0
            ld e,a
            ld h,d
            add a,$28
            ld l,a
            ld a,c
            and $03
            inc a
            ld b,a
            ld a,$C0
L336E       rlca
            rlca
            djnz L336E
            ld b,a
            and (hl)
            cp b
            ret
            ld hl,$5B68
            set 5,(hl)
            jr L3382
            ld hl,$5B68
            res 5,(hl)
L3382       call L0DE8
            jr z,L33A3
            call L381B
            push bc
            call L3823
            pop hl
            push af
            call L32C3
            rst $30
            push hl
            jr L33AD
            ld hl,$5B68
            set 5,(hl)
            jr L33A3
            ld hl,$5B68
            res 5,(hl)
L33A3       ld a,$FF
            push af
            call L0DE8
            call nz,L381B
            push bc
L33AD       call L0DFC
            bit 6,(iy+$01)
            jr z,L33EE
            cp $7E
            ld a,($5B68)
            jr nz,L33C2
            push af
            rst $20
            pop af
            xor $20
L33C2       call L0DE8
            jr z,L33DE
            and $20
            jr z,L33D7
            call L382B
            call L3421
            ld c,b
            call L3421
            jr L33DE
L33D7       call L3839
            ld c,a
            call L3421
L33DE       call L3EC9
            cp $2C
            jr nz,L33E8
            rst $20
            jr L33AD
L33E8       pop hl
            pop af
            call L0914
            ret
L33EE       ld d,a
            cp $7E
            call z,L3ECF
            call L0DE8
            jr z,L33DE
            push de
            call L3842
            pop hl
            ld a,b
            or c
            jr z,L33DE
L3402       ld a,(de)
            inc de
            exx
            ld c,a
            call L3421
            exx
            dec bc
            ld a,b
            or c
            jr nz,L3402
            ld a,h
            cp $7E
            jr nz,L33DE
            dec de
            ld a,(de)
            set 7,a
            pop hl
            dec hl
            push hl
            ld c,a
            call L3421
            jr L33DE
L3421       pop ix
            pop hl
            pop af
            push af
            inc a
            jr nz,L342E
            ld (hl),c
L342A       inc hl
            push hl
            jp (ix)
L342E       dec a
            call L2AF2
            call L32F6
            ld (hl),c
            rst $30
            jr L342A
L3439       di
            nextreg $07,$03
            ld b,$01
            call L3E80
            ei
            ld bc,$CBCD
            ld h,$06
            ld hl,($FF0E)
            ld hl,($5C53)
            dec hl
            call L367B
            xor a
            ld ($5C75),a
            dec a
            ld b,$01
            call L25EF
            ld hl,$0931
            ex (sp),hl
            jr L346A
            call L381B
            ld a,b
            or c
            jr nz,L346E
L346A       ld bc,(RAMTOP)
L346E       call L3485
InitStack
            pop de                 ; DE = Return address
            pop hl                 ; HL = Top of the stack
            ld sp,(RAMTOP)         ; SP = The top of the RAM available by NEXT OS
            ld b,$3E               ; BC = $3E00
            push bc                ; Push $00 $3E mark to the top of the RAM
            ld (DEFADD),sp         ; Store SP as the address of arguments of user defined function
            push hl                ; Restore the previous top of the stack
            ld (ERRSP),sp          ; Store SP as the address of item on machine stack to be
                                   ; used as error return
            push de                ; Restore the return address
            ret                    ; Done
L3485       push bc
            ld de,($5C4B)
            ld hl,($5C59)
            dec hl
            rst $28
            push hl
            add hl,de
            call L26CB
            dec c
            ld hl,($89CD)
            ld (hl),$2A
            ld h,l
            ld e,h
            ld de,$0032
            add hl,de
            pop de
            sbc hl,de
            jr nc,L34AD
            ld hl,($5CB4)
            and a
            sbc hl,de
            jr nc,L34AF
L34AD       rst $08
            dec d
L34AF       ld (RAMTOP),de
            ret
            call L0DE8
            jr nz,L34C2
            ld d,$00
            call L2568
            call L0914
L34C1       rst $20
L34C2       call L05A3
            ld a,($5C3B)
            push af
            call L34EF
            pop bc
            jr nc,L34DB
            ld a,b
            rst $28
            ld e,(hl)
            inc e
            call L3EC9
            cp $2C
            jr z,L34C1
            ret
L34DB       jr nz,L34E7
            ld a,($5C3A)
            cp $0B
            jp nz,L0DA5
L34E5       rst $08
            add hl,de
L34E7       bit 7,(iy+$30)
            jr nz,L34E5
            rst $08
            dec c
L34EF       ld hl,($5C5D)
            ld ($5C5F),hl
            ld hl,($5C57)
            ld a,($5B78)
            cp $FF
            call nz,L32C3
            ld a,(hl)
            cp $2C
            jr z,L3536
            cp $28
            jr z,L3536
            cp $29
            jp z,L3596
            ex de,hl
            ld hl,$5B77
            ld c,(hl)
            push bc
            ld (hl),$FF
            ld hl,($5C55)
            push hl
            ex de,hl
            ld de,$00E4
            call L2029
            pop bc
            ld ($5C55),bc
            pop bc
            ld a,c
            ld ($5B77),a
            jr c,L3596
            ld d,h
            res 7,h
            res 6,h
            ld ($5C57),hl
            ld h,d
L3536       ld a,($5B78)
            inc a
            jr z,L3540
            call L39E3
            rst $30
L3540       ld ($5C5D),hl
            ld hl,(DEFADD)
            push hl
            rst $20
            bit 7,(iy+$30)
            jr z,L3556
            ld c,$22
            call L3B18
            ld (DEFADD),hl
L3556       ld hl,($5B6C)
            push hl
            ld hl,$35A9
            ld ($5B6C),hl
            ld hl,(ERRSP)
            push hl
            ld hl,$5B3A
            push hl
            ld (ERRSP),sp
            call L0DFC
            ld a,($5B78)
            inc a
            jr z,L357E
            add hl,$A34A
            ld de,($5C57)
            add hl,de
L357E       ld ($5C57),hl
            pop hl
            scf
L3583       pop hl
            ld (ERRSP),hl
            pop hl
            ld ($5B6C),hl
            pop hl
            ld (DEFADD),hl
            ld hl,($5C5F)
            ld ($5C5D),hl
            ret
L3596       ld hl,$5B78
            inc (hl)
            call nz,L2AEE
            ld a,$FF
            ld (hl),a
            ld hl,($5C59)
            dec hl
            ld ($5C57),hl
            and a
            ret
            xor a
            jr L3583
            call L0DE8
            jr nz,L35BC
L35B1       call L0DFC
            cp $2C
            call nz,L0914
            rst $20
            jr L35B1
L35BC       ld de,$0200
            call L123E
            ld ($5C5D),hl
            ret
            ld a,$03
            jr L35CC
            ld a,$FE
L35CC       call L2EBE
            ld bc,$01FF
            call L25C7
            jr L35E6
            ld a,$03
            jr L35DD
            ld a,$FE
L35DD       call L2EBE
            ld bc,$01FF
            call L25EC
L35E6       ld bc,($5C45)
            exx
            call L0DE8
            call nz,L3A7B
            call L3EC9
            cp $28
            jr nz,L35FF
            rst $20
            cp $29
            jp nz,L09AF
            rst $20
L35FF       call L0914
            exx
            ld a,($5B65)
            cp $FF
            jr nz,L360E
            ld ($5C49),bc
L360E       call L3962
            ret nc
            call L0080
            jp po,LC919
            ld bc,($5C6E)
            bit 7,b
            jp nz,L39E1
            call L38E3
            ld a,$FF
            jr z,L362B
            ld a,($5EBA)
L362B       call L267E
            ld a,($5C70)
            ld ($5C47),a
            ld d,a
            ld e,$00
            call L123E
            ld ($5C5D),hl
            cp $3A
            call z,L3ECF
            jp L25E7
            ld b,$01
            call L25C6
            jr L3651
            ld b,$01
            call L25EB
L3651       ld hl,($5C5D)
            jr nc,L365A
            add hl,$FFFB
L365A       ld a,($5B77)
            ld ($5B65),a
            inc a
            jr z,L3670
            add hl,$A24A
            ld de,($5EBB)
            add hl,de
            res 7,h
            res 6,h
L3670       ld ($5B9D),hl
            ld c,$21
            call L3A86
            ld hl,($5B9D)
L367B       ld a,($5B65)
            ld ($5B78),a
            ld ($5C57),hl
            res 7,(iy+$30)
            ret
L3689       ld a,($5C7F)
            and $0F
            jr z,L36AF
            add a,$F2
            push ix
            ld xh,a
            ld xl,$00
            ld hl,$0000
            ld ($5B84),hl
            ld ($5B86),hl
            call L136B
            ld a,$0E
            call L3E80
            ld e,e
            daa
            pop ix
            ret
L36AF       rst $28
            ld l,e
            dec c
            ret
            cp $2C
            jr z,L36CB
            call L0914
            ld a,($5C7F)
            and $0F
            jr z,L36C7
            call L26E5
            ld a,d
            inc l
            ret
L36C7       rst $28
            ld (hl),a
            inc h
            ret
L36CB       call L0634
            call L0914
            ld a,($5C7F)
            and $0F
            jr z,L36DE
            call L26E5
            inc h
            inc l
            ret
L36DE       rst $28
            sub h
            inc hl
            ret
            call L381B
            ld a,b
            or c
            jr z,L36ED
            rst $28
            dec a
            rra
            ret
L36ED       call L3E80
            ret po
            ld de,$CFC9
            ex af,af'
L36F5       ld a,(hl)
            inc hl
            cp $0D
            ret c
            cp $FF
            ret z
            push af
            call L3706
            pop af
            add a,a
            jr nc,L36F5
            ret
L3706       and $7F
L3708       rst $30
            rst $28
            djnz L370C
L370C       rst $18
            ret
            rst $30
            call L3714
            jr L370C
L3714       push hl
            ld bc,$D8F0
            rst $28
            ld hl,($0119)
            jr L371A
            rst $28
            ld hl,($1819)
            ld bc,$01E5
            sbc a,h
            rst $38
            rst $28
            ld hl,($0119)
            or $FF
            rst $28
            ld hl,($7D19)
            rst $28
            rst $28
            dec d
            pop hl
            ret
L3736       ld l,a
            ld a,$2D
            jr L373D
L373B       ld a,$3A
L373D       ld h,$00
            rst $28
            djnz L3742
L3742       push hl
            ld e,$30
            jr L372A
L3747       ld a,b
            or c
            jr z,L3787
            push de
            push bc
            ld a,b
            srl a
            ld hl,$07BC
            add hl,a
            ld e,$FF
            call L3714
            pop hl
            ld a,l
            push af
            srl h
            rra
            rrca
            rrca
            rrca
            rrca
            and $0F
            call L3736
            pop af
L376A       and $1F
            call L3736
            pop hl
            push hl
            ld a,h
            rrca
            rrca
            rrca
            and $1F
            ld l,a
            ld a,$20
            call L373D
            pop hl
            add hl,hl
            add hl,hl
            add hl,hl
            ld a,h
            and $3F
            ld l,a
            jr L373B
L3787       ld b,$10
L3789       ld a,$20
            rst $28
            djnz L378E
L378E       djnz L3789
            ret
            ld hl,$3E98
            call L37AF
            ld a,($F71F)
            add a,$09
            ld c,a
            ld b,$08
            rst $28
            rra
            jr nz,L376A
            call z,L3A01
            ret po
            sub $32
            adc a,a
            ld e,h
            call c,L3747
            ret
L37AF       ld a,(hl)
            cp $FF
            ret z
            rst $28
            djnz L37B6
L37B6       inc hl
            jr L37AF
L37B9       push bc
            push de
            push hl
            ld a,$FD
            rst $28
            ld bc,$E116
            pop de
            pop bc
L37C4       ld a,(hl)
            or a
            ret z
            rst $28
            djnz L37CA
L37CA       inc hl
            jr L37C4
            call L3689
            ld a,$02
            rst $28
            ld bc,$C916
L37D6       ld a,(de)
            and $7F
            rst $28
            djnz L37DC
L37DC       ld a,(de)
            inc de
            add a,a
            jr nc,L37D6
            ret
L37E2       inc hl
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
L37EF       ld hl,($5C65)
            add hl,$FFFB
            ld a,(hl)
            and a
            jr nz,L3806
            ld ($5C65),hl
            call L37E2
            bit 7,c
            ld b,d
L3803       ld c,e
            ld a,e
            ret
L3806       ld bc,$2DA8
            call L3EC1
            ret
L380D       call L37EF
            ret c
            push af
            dec b
            inc b
            jr nz,L3818
            pop af
            ret
L3818       pop af
            scf
            ret
L381B       call L37EF
            jr c,L3821
            ret z
L3821       rst $08
            ld a,(bc)
L3823       call L380D
            jr c,L3821
            ret z
            jr L3821
L382B       call L37EF
            jr c,L3821
            ret z
            ld a,b
            cpl
            ld b,a
            ld a,c
            cpl
            ld c,a
            inc bc
            ret
L3839       call L380D
            jr c,L3821
            ret z
            neg
            ret
L3842       ld hl,($5C65)
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
L3853       ld hl,($5C65)
            add hl,$FFFB
            ld ($5C65),hl
            ret
L385E       res 6,(iy+$01)
            jr L386C
L3864       ld c,a
            ld b,$00
L3867       xor a
            ld e,a
            ld d,c
            ld c,b
            ld b,a
L386C       push bc
            push de
            ld bc,$0005
            call L388F
            pop de
            pop bc
L3876       ld hl,($5C65)
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
L3887       bit 7,(iy+$01)
            ret z
            xor a
            jr L3864
L388F       ld hl,($5C65)
            add hl,bc
            jr c,L389F
            ex de,hl
            ld hl,$0050
            add hl,de
            jr c,L389F
            sbc hl,sp
            ret c
L389F       rst $08
            inc bc
L38A1       call L38B4
            ccf
            ret c
L38A6       cp $41
            ccf
            ret nc
            cp $5B
            ret c
            cp $61
            ccf
            ret nc
            cp $7B
            ret
L38B4       cp $30
            ret c
            cp $3A
            ccf
            ret
L38BB       call L38E3
            ret nz
            ld hl,($5C4F)
            dec hl
            ld bc,$0207
            rst $28
            ld d,l
            ld d,$AF
            ld hl,$5EBC
            ld (hl),a
            dec hl
            dec hl
            dec a
            ld (hl),a
            and a
            ret
L38D4       ld hl,$5B77
            cp (hl)
            ret z
            ld (hl),a
            cp $FF
            ret z
L38DD       xor a
            ld ($5EBC),a
            ld a,(hl)
            ret
L38E3       ld a,($5C50)
            cp $5C
            ret
L38E9       set 7,h
            set 6,h
            ld ($5EB6),hl
            ld bc,($5EBB)
            and a
            sbc hl,bc
            jr c,L390F
            inc h
            dec h
            jr nz,L390F
            add hl,$5DB6
            push hl
            inc hl
            inc hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            add hl,bc
            ld l,a
            ld a,$5D
            cp h
            ld a,l
            pop hl
            ret nc
L390F       ld hl,($5EB6)
            ld ($5EBB),hl
            call L32D0
            ld de,$5DB6
            ld bc,$0100
            ldir
            rst $30
            ld hl,$5DB6
            ret
L3925       call L38E9
            ld a,(hl)
            cp $28
            ret nc
            ld d,h
            ld e,l
            inc hl
            inc hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            add hl,bc
            add hl,$A24A
            ld bc,($5EBB)
            add hl,bc
            scf
            ret
            inc a
            ret z
            dec a
            call L32CC
            push hl
            ld a,(hl)
            inc hl
            inc hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            pop hl
            add bc,$0004
            ld de,$5CB6
            push de
            ldi
            cp $28
            jr nc,L395E
            ldir
L395E       ex de,hl
            pop hl
            rst $30
            ret
L3962       inc a
            jr nz,L3980
            call L0FDB
L3968       ld a,(hl)
            cp $28
            ret nc
            ld d,a
            inc hl
            ld e,(hl)
            dec hl
            ex de,hl
            and a
            sbc hl,bc
            ex de,hl
            ccf
            ret c
            inc hl
            inc hl
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
            add hl,de
            jr L3968
L3980       dec a
            call L32D0
            push bc
            call L39D1
            add a,a
            call nc,L1015
            pop bc
            call L0FCE
            call L3968
            rst $30
            ret
L3995       ld a,($5B77)
            inc a
            jr nz,L39AF
            ld d,(hl)
            ld a,$C0
            and d
            ret nz
            inc hl
            ld e,(hl)
            ld ($5C45),de
            inc hl
            ld e,(hl)
            inc hl
            ld d,(hl)
            ex de,hl
            add hl,de
            inc hl
            scf
            ret
L39AF       dec a
            call L38E9
            ld d,(hl)
            ld a,$C0
            and d
            ret nz
            inc hl
            ld e,(hl)
            ld ($5C45),de
            inc hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            ex de,hl
            ld hl,($5EB6)
            add hl,$0004
            add hl,bc
            res 7,h
            res 6,h
            scf
            ret
L39D1       ld hl,($C000)
            ld a,l
            res 7,l
            res 7,h
            ld bc,$4342
            and a
            sbc hl,bc
            ret z
            rst $30
L39E1       rst $08
            ld d,$11
            or (hl)
            ld e,h
            push de
            ld c,$00
L39E9       dec c
L39EA       ld a,(hl)
            ldi
            cp $22
            jr z,L39EA
            cp $10
            jr c,L3A00
            cp $3A
            jp nz,L39E9
            bit 0,c
            jr nz,L39E9
L39FE       pop hl
            ret
L3A00       cp $0D
            jr z,L39FE
            ldi
            ldi
            ldi
            ldi
            ldi
            jr L39EA
            ld hl,($5C45)
L3A13       and a
            bit 7,h
            ld hl,($5C59)
            ret nz
            ld hl,($5B77)
            inc l
            ld hl,($5C53)
            ret z
L3A22       ld hl,($5EB6)
            push de
            ld de,($5EBB)
            sbc hl,de
            pop de
            scf
            ret
L3A2F       call L3A22
            ex de,hl
            add hl,$A24A
            and a
            sbc hl,de
            ld de,($5EB6)
            add hl,de
            ret
L3A40       ld bc,$000B
            call L388F
            pop hl
            pop de
            pop bc
            exx
            ld hl,($5C46)
            push hl
            inc sp
            ld hl,($5C45)
            push hl
            call L3A13
            ex de,hl
            ld hl,($5C55)
            jr c,L3A5E
            sbc hl,de
L3A5E       push hl
            ld hl,($5C5D)
            and a
            sbc hl,de
            push hl
            ld hl,($5EB6)
            push hl
            ld hl,($5B77)
            ld h,a
            push hl
            ld (DEFADD),sp
            exx
            push bc
            ld (ERRSP),sp
            push de
            jp (hl)
L3A7B       ld hl,(ERRSP)
            inc hl
            inc hl
            inc hl
            ld c,(hl)
            ld a,c
            ld ($5B5E),a
L3A86       call L3AC4
            ret c
L3A8A       ld bc,(ERRSP)
            call L26CB
            ld a,(bc)
            add hl,hl
            ld hl,($5B99)
            bit 0,h
            jr nz,L3AB5
            ld a,($5C6A)
            and $7F
            or h
            ld ($5C6A),a
            ld a,l
            ld ($5B78),a
            ld hl,($5B9B)
            inc a
            jr nz,L3AB2
            ld de,($5C53)
            add hl,de
L3AB2       ld ($5C57),hl
L3AB5       pop hl
            pop de
            pop bc
            ld sp,(DEFADD)
            push bc
            ld (ERRSP),sp
            push de
L3AC2       xor a
            jp (hl)
L3AC4       call L3B18
            ret c
L3AC8       dec hl
            push hl
            ld a,(hl)
            inc hl
            ex de,hl
            call L38D4
            ex de,hl
            inc hl
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
            inc a
            jr z,L3AE6
            inc a
            jr z,L3B16
            dec a
            dec a
            push hl
            ex de,hl
            call L3925
            jr nc,L3B16
            pop hl
L3AE6       ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
            ld a,(hl)
            inc hl
            ex af,af'
            ld a,(hl)
            inc hl
            ld l,(hl)
            ld (iy+$0D),l
            ld h,a
            ex af,af'
            ld l,a
            ld ($5C45),hl
            call L3A13
            ex de,hl
            jr c,L3B04
            add hl,de
L3B04       ld ($5C55),hl
            ex de,hl
            add hl,bc
            ld ($5C5D),hl
            pop hl
            add hl,$000B
            ld (DEFADD),hl
            xor a
            ret
L3B16       rst $08
            ld d,$3E
            ld bc,$9A32
            ld e,e
            call L26CB
            and d
            jr z,L3B4D
            dec a
            ld e,h
            add hl,$FFF8
L3B29       add hl,$000B
L3B2D       ld a,(hl)
            cp c
            ret z
            cp $4B
            jr z,L3B29
            cp $02
            jr c,L3B48
            cp $3E
            jr z,L3B62
            jr nc,L3B60
            ld a,c
            cp $20
            ret z
            and $E0
            cp (hl)
            jr nc,L3B29
            ret
L3B48       bit 5,c
            ret z
            dec hl
L3B4C       ld b,(hl)
L3B4D       inc hl
            inc hl
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
            add hl,de
            cp $01
            jr nz,L3B5D
            inc b
            dec b
            call z,L3BAA
L3B5D       inc hl
            jr L3B2D
L3B60       bit 5,c
L3B62       scf
            ret z
            cp $48
            jr z,L3B80
            jr nc,L3B8F
            dec hl
            ld e,(hl)
            inc hl
            inc hl
            ld d,(hl)
            inc hl
            ld ($5B99),de
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
            ld ($5B9B),de
            inc hl
            jp L3B2D
L3B80       dec hl
            ld a,(hl)
            inc hl
            inc hl
            push bc
            call L26CB
            add a,b
            jr z,L3B4C
            inc hl
            jp L3B2D
L3B8F       push bc
            push hl
            dec hl
            ld a,(hl)
            ld e,a
            inc hl
            ld bc,(ERRSP)
            and a
            sbc hl,bc
            call L26CB
            xor $28
            pop hl
            pop bc
            add hl,$0082
            jp L3B2D
L3BAA       push bc
            push hl
            add hl,$FFF8
            ld a,(hl)
            inc hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            inc a
            jr nz,L3BC7
            ex de,hl
            ld hl,($5C53)
            add hl,bc
            ex de,hl
            ld bc,$0005
            ldir
L3BC4       pop hl
            pop bc
            ret
L3BC7       inc a
            jr z,L3BC4
            push bc
            ld de,$5CAA
            ld bc,$0005
            ldir
            pop hl
            dec a
            dec a
            call L32D0
            ex de,hl
            ld hl,$5CAA
            ld bc,$0005
            ldir
            rst $30
            ld hl,($5EBB)
            ex de,hl
            and a
            sbc hl,de
            inc h
            dec h
            jr nz,L3BC4
            ex de,hl
            add de,$5DB1
            ld hl,$5CAA
            ld bc,$0005
            ldir
            jr L3BC4
L3BFD       pop ix
            pop bc
            pop de
            add hl,$000A
L3C05       ld sp,hl
            ld (DEFADD),sp
            push de
            ld (ERRSP),sp
            push bc
            jp (ix)
L3C12       pop ix
            pop bc
            pop de
            ld hl,$000B
            add hl,sp
            jr L3C05
L3C1C       call L3EC9
            cp $25
            jp z,L3D2C
            ld e,a
            set 5,e
            rst $28
            call nc,LC51B
            ld ($5C5B),hl
            cp $0E
            jr nz,L3C36
            add hl,$0006
L3C36       call L3ED0
            cp $24
            jr nz,L3C87
            inc hl
            ld a,(hl)
            cp $0E
            jr nz,L3C47
            add hl,$0006
L3C47       call L3ED0
            cp $28
            jr nz,L3C56
            rst $20
            ld c,$C0
            res 0,d
L3C53       rst $20
            jr L3C5A
L3C56       ld c,$40
            res 1,d
L3C5A       ld a,e
            and $1F
            or c
            ex af,af'
            bit 7,c
            call z,L3DB3
            ld a,d
            and $65
            jr nz,L3C9A
            ld xh,$02
            bit 4,d
            jr z,L3C72
L3C70       inc xh
L3C72       bit 1,d
            jr z,L3C7E
            ld de,$3D9E
            ld bc,$0003
            jr L3CBC
L3C7E       ld a,d
            ld b,a
            ld c,a
            and a
            call nz,L3842
            jr L3CBC
L3C87       cp $28
            jr nz,L3C9C
            rst $20
            ld c,$80
            bit 1,d
            jr nz,L3C53
            ld a,d
            xor $41
            ld d,a
            and $41
            jr z,L3C53
L3C9A       pop bc
            ret
L3C9C       inc b
            jr z,L3CA3
            set 7,e
            res 6,e
L3CA3       ld a,e
            ex af,af'
            call L3DA1
            jr nc,L3C9A
            ld xh,$00
            bit 4,d
            jr nz,L3C70
            ld hl,$3FB8
            and a
            call nz,L3853
            ex de,hl
            ld bc,$0005
L3CBC       pop af
            neg
            ld xl,a
            push bc
            add bc,a
            push de
            call nz,L388F
            pop de
            pop bc
            exx
            pop hl
            pop de
            pop bc
            exx
            ld hl,$0000
            and a
            sbc hl,bc
            add hl,sp
            jr z,L3CDE
            ld sp,hl
            ex de,hl
            push bc
            ldir
            pop bc
L3CDE       ld a,xh
            cp $02
            jr nz,L3CE7
            push bc
            inc bc
            inc bc
L3CE7       rra
            jr nc,L3CF0
            ld a,($5CA6)
            push af
            inc sp
            inc bc
L3CF0       ld a,xl
            add bc,a
            dec a
            jr nz,L3D0A
L3CF7       ex af,af'
            push af
            inc sp
L3CFA       push bc
            ld d,xh
            res 1,d
            ld e,d
            push de
            exx
            push bc
            ld (ERRSP),sp
            push de
            scf
            jp (hl)
L3D0A       ld hl,($5C5B)
            ld d,a
            ld e,$A0
L3D10       dec hl
            ld a,(hl)
            cp $20
            jr z,L3D10
            or e
            ld e,$20
            push af
            inc sp
            dec d
            jr nz,L3D10
            ld a,xh
            bit 1,a
            jr z,L3CF7
            ex af,af'
            ld d,a
            ld e,$7F
            push de
            inc bc
            jr L3CFA
L3D2C       rst $20
            or $20
            sub $61
            ex af,af'
            rst $20
            cp $28
            jr z,L3D5D
            call L3DA1
            ret nc
            ex af,af'
            ld hl,$FFF8
            call L3D78
            ld (hl),$48
            inc hl
            push af
            call L26CB
            ld h,h
            jr z,L3D54
            ld d,a
            ld e,a
            jr z,L3D55
            call L26CB
            pop af
L3D54       inc h
L3D55       pop af
            call L26CB
            or l
            jr z,L3D93
            ret
L3D5D       rst $20
            rst $20
            bit 2,d
            jr nz,L3D68
            bit 1,d
            ret z
            ld e,$FF
L3D68       ex af,af'
            ld hl,$FF7E
            call L3D78
            ld (hl),$C2
            call L26CB
            ret c
            jr z,L3DAE
            ret
L3D78       pop ix
            exx
            pop hl
            pop de
            pop bc
            exx
            add hl,sp
            ld bc,($5C65)
            add bc,$0050
            and a
            sbc hl,bc
            jr c,L3D9C
            add hl,bc
            ld sp,hl
            ld (hl),a
            inc hl
            exx
            push bc
L3D93       ld (ERRSP),sp
            push de
            push hl
            exx
            jp (ix)
L3D9C       rst $08
            inc bc
            ld bc,$0000
L3DA1       call L3DB3
            ld a,d
            and $20
            ret nz
            ld a,d
            add a,a
            add a,d
            and $80
            ret nz
L3DAE       ld a,d
            and $80
            scf
            ret
L3DB3       ld a,(hl)
            cp $3D
            ret nz
            rst $20
            push de
            push ix
            call L0DFC
            pop ix
            pop de
            bit 7,d
            jp nz,L3853
            ld a,($5C3B)
            and $40
            or $80
            ld d,a
            ret
L3DCF       ld a,($5C3B)
L3DD2       bit 2,(iy+$30)
            jr z,L3DDD
            bit 6,a
            jp z,L09AF
L3DDD       ld bc,$2AFF
            jp L3EC1
            nop
            ld (bc),a
            and b
            and d
            inc d
            ld d,$B4
            or (hl)
            nop
            inc bc
            ret po
            rst $20
            inc e
            rra
            call m,LAAFF
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            add hl,sp
            inc (hl)
            add hl,sp
            inc (hl)
            call L0DE8
            jr z,L3E12
            call L3823
            push af
            call L3823
            pop bc
            ld c,a
L3E12       push bc
            call L3E3E
            push hl
            call L3E3E
            pop de
            pop bc
            call L0DE8
            jr z,L3E28
            rst $00
            rst $08
            ld bc,$0238
            rst $08
            ld (de),a
L3E28       push hl
            push de
            call L3EC9
            cp $CC
            call L3E59
            pop bc
            call nc,L3E54
            pop bc
            call nc,L3E54
            call L0914
            ret
L3E3E       call L3EC9
            ld hl,$0000
            cp $2C
            ret nz
            call L0634
            call L0DE8
            ret z
            call L381B
            ld h,b
            ld l,c
            ret
L3E54       call L3EC9
            cp $2C
L3E59       scf
            ret nz
            push bc
            rst $20
            call L05A3
            bit 6,(iy+$01)
            jp z,L09AF
            pop bc
            call L0DE8
            jr z,L3E73
            call L3867
            call L3DCF
L3E73       and a
            ret
L3E75       push de
            call L0059
            bit 1,e
            pop de
            ret
            nop
            nop
            nop
L3E80       ld ($5B54),bc
            ex (sp),hl
            ld c,(hl)
            inc hl
            ld b,(hl)
L3E88       inc hl
            ex (sp),hl
            push $3E93
            push bc
L3E8F       ld bc,($5B54)
            nextreg $8E,$00
            ret
            inc de
            ld bc,$0710
            ld de,$1600
            rst $38
            ld ($5B56),a
            ld a,$87
            ld ($5B54),bc
            pop bc
            push $007B
            jp L26DA
            call L0068
            and e
            dec h
            ret
L3EB7       ld d,$00
L3EB9       call L26CB
            ld d,l
            jr z,L3E88
L3EBF       res 6,b
L3EC1       push $5B3E
            push bc
            jp L5B48
L3EC9       ld hl,($5C5D)
            jp L3ED3
L3ECF       inc hl
L3ED0       ld ($5C5D),hl
L3ED3       ld a,(hl)
            cp $21
            ret nc
            cp $0D
            ret z
            cp $0E
            ret z
            inc hl
            cp $18
            jr nc,L3ED0
            cp $10
            jr c,L3ED0
            cp $16
            jr c,L3ECF
            inc hl
            jr L3ECF
            exx
            ld hl,($5B77)
            ld e,h
            ld h,l
            ld l,e
            ld ($5B77),hl
            exx
            ret
L3EF9       bit 7,(iy+$01)
            ret nz
            pop hl
            ret
L3F00       ld ($5B54),bc
            ex (sp),hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ex (sp),hl
            push $3F13
            push bc
            ld bc,($5B54)
            nextreg $8E,$02
            ret
            cp $21
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
            jr c,L3F2B
            inc hl
L3F2B       scf
            ld ($5C5D),hl
            ret
            ld b,$02
            jr L3F3E
            rst $00
            ld e,h
            nop
            call L3864
            jr L3F54
            ld b,$00
L3F3E       rst $00
            ld h,d
            nop
            push de
            push hl
            pop bc
            call L3867
            pop bc
            call L3867
            ld de,$0DD1
            ld bc,$000A
            call L09BA
L3F54       set 6,(iy+$01)
            jp L3DCF
            call L3842
            push bc
            push de
            call L3823
            pop de
            pop bc
            rst $00
            ld d,(hl)
            nop
L3F68       jp nc,L0904
            ret
            call L3823
            rst $00
            ld e,c
            nop
            jr L3F68
            ld de,$0DDB
            ld bc,$000D
            call L09BA
            call L3823
            rst $28
            ld bc,$CD16
            rst $28
            scf
            push bc
            call L37EF
            push bc
            pop hl
            pop de
            ld b,$01
            rst $00
            ld h,d
            nop
            ret
L3F93       call L26CB
            ld h,b
            jr z,L3F62
            ld c,h
            ld h,c
            ld a,c
            ld h,l
            ld (hl),d
            and b
            ccf
            jr nz,L3FCA
            ld e,c
            cpl
            ld c,(hl)
            add hl,hl
            dec c
            nop
            jr nz,L3FCA
            jr nz,L3FCC
            jr nz,L3FCE
            jr nz,L3FD0
            jr nz,L3FD2
            jr nz,L3FD4
            jr nz,L3FD6
            jr nz,L3FD8
            nop
            nop
            nop
            nop
            nop
            rst $28
            ld c,a
            ld e,$21
            sbc a,d
            ld hl,($0011)
            nop
            jp L3EB9
            call L26E5
L3FCC       ret p
            ld hl,($CFC3)
L3FD0       dec a
            call L3823
L3FD4       push af
            call L3823
L3FD8       ld bc,$243B
            out (c),a
            inc b
            pop af
            out (c),a
            ret
            ld hl,$0000
            ld ($5C78),hl
            xor a
            ld ($5C7A),a
            ret
L3FED       ld a,($5C7F)
            and $0F
            ret z
            cp $03
            ret c
            srl a
            srl a
            dec a
            ret
            nop
            nop
            nop
            nop

