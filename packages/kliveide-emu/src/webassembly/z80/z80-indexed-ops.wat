;; ============================================================================
;; Implementation of Z80 indexed operations

;; add ix,bc (0x09)
(func $AddIXBC
  (call $AluAdd16 (call $getIndexReg) (call $getBC))
  call $setIndexReg
)

;; add ix,de (0x19)
(func $AddIXDE
  (call $AluAdd16 (call $getIndexReg) (call $getDE))
  call $setIndexReg
)

;; ld ix,NN (0x21)
(func $LdIXNN
  call $readCode16
  call $setIndexReg
)

(func $LdNNiIX
  (local $addr i32)
  (local $ix i32)
  ;; Obtain the address to store HL
  (tee_local $addr (call $readCode16))
  
  ;; Set WZ to addr + 1
  (call $setWZ (i32.add (i32.const 1)))
  
  ;; Store IX
  get_local $addr
  call $getIndexReg
  tee_local $ix
  call $writeMemory
  call $getWZ
  (i32.shr_u (get_local $ix) (i32.const 8))
  call $writeMemory
)

;; inc ix (0x23)
(func $IncIX
  (i32.add (call $getIndexReg) (i32.const 1))
  call $setIndexReg
  (call $incTacts (i32.const 2))
)

;; inc xh (0x24)
(func $IncXH
  (local $ix i32)
  (local $v i32)
  ;; Get register value
  (i32.const 8 (call $getIndexReg) (tee_local $ix))
  i32.shr_u
  tee_local $v

  ;; Increment register value
  i32.const 1
  i32.add
  i32.const 8
  i32.shl
  get_local $ix
  i32.const 0xff
  i32.and
  i32.or
  call $setIndexReg

  ;; Adjust flags
  (i32.add (get_global $INC_FLAGS) (get_local $v))
  i32.load8_u
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setQ (i32.and (i32.const 0xff)))
  (call $setF (call $getQ))
)

;; dec xh (0x25)
(func $DecXH
  (local $ix i32)
  (local $v i32)
  ;; Get register value
  call $getIndexReg
  (i32.shr_u (tee_local $ix) (i32.const 8))
  tee_local $v

  ;; Decrement register value
  i32.const 1
  i32.sub
  i32.const 8
  i32.shl
  get_local $ix
  i32.const 0xff
  i32.and
  i32.or
  call $setIndexReg

  ;; Adjust flags
  (i32.add (get_global $DEC_FLAGS) (get_local $v))
  i32.load8_u
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setQ (i32.and (i32.const 0xff)))
  (call $setF (call $getQ))
)

;; ld xh,N (0x26)
(func $LdXHN
  (i32.and (call $getIndexReg) (i32.const 0xff))
  (i32.shl (call $readCodeMemory) (i32.const 8))
  i32.or
  call $setIndexReg
)

;; add ix,ix (0x29)
(func $AddIXIX
  (local $indReg i32)
  (call $AluAdd16 (call $getIndexReg) (call $getIndexReg))
  call $setIndexReg
)

;; ld ix,(NN) (0x2a)
(func $LdIXNNi
  (local $addr i32)
  ;; Read the address
  (tee_local $addr (call $readCode16))
  
  ;; Set WZ to addr + 1
  (call $setWZ (i32.add (i32.const 1)))

  ;; Read HL from memory
  get_local $addr
  call $readMemory
  call $getWZ
  call $readMemory
  i32.const 8
  i32.shl
  i32.or
  call $setIndexReg
)

;; dec ix (0x2b)
(func $DecIX
  (i32.sub (call $getIndexReg) (i32.const 1))
  call $setIndexReg
  (call $incTacts (i32.const 2))
)

;; inc xl (0x2c)
(func $IncXL
  (local $ix i32)
  (local $v i32)
  ;; Get register value
  call $getIndexReg
  (i32.and (tee_local $ix) (i32.const 0xff))
  tee_local $v

  ;; Increment register value
  i32.const 1
  i32.add
  get_local $ix
  i32.const 0xff00
  i32.and
  i32.or
  call $setIndexReg

  ;; Adjust flags
  (i32.add (get_global $INC_FLAGS) (get_local $v))
  i32.load8_u
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setQ (i32.and (i32.const 0xff)))
  (call $setF (call $getQ))
)

;; dec xl (0x2d)
(func $DecXL
  (local $ix i32)
  (local $v i32)
  ;; Get register value
  call $getIndexReg
  (i32.and (tee_local $ix) (i32.const 0xff))
  tee_local $v

  ;; Increment register value
  i32.const 1
  i32.sub
  get_local $ix
  i32.const 0xff00
  i32.and
  i32.or
  call $setIndexReg

  ;; Adjust flags
  (i32.add (get_global $DEC_FLAGS) (get_local $v))
  i32.load8_u
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setQ (i32.and (i32.const 0xff)))
  (call $setF (call $getQ))
)

;; ld xl,N (0x2e)
(func $LdXLN
  (i32.and (call $getIndexReg) (i32.const 0xff00))
  call $readCodeMemory
  i32.or
  call $setIndexReg
)

;; inc (ix+d) (0x34)
(func $IncIXi
  (local $v i32)
  (local $addr i32)
  call $getIndexedAddress
  tee_local $addr
  call $readMemory
  (call $AdjustPcTact5 (set_local $v))

  ;; Increment value
  get_local $addr
  (i32.add (get_local $v) (i32.const 1))

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
  (call $contendRead (get_local $addr) (i32.const 1))
  call $writeMemory

  ;; Adjust flags
  (i32.add (get_global $INC_FLAGS) (get_local $v))
  i32.load8_u
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setQ (i32.and (i32.const 0xff)))
  (call $setF (call $getQ))

)

  ;; dec (ix+d) (0x35)
(func $DecIXi
  (local $v i32)
  (local $addr i32)

  call $getIndexedAddress
  tee_local $addr
  call $readMemory
  (call $AdjustPcTact5 (set_local $v))

  ;; Increment value
  get_local $addr
  (i32.sub (get_local $v) (i32.const 1))
  (call $contendRead (get_local $addr) (i32.const 1))
  call $writeMemory

  ;; Adjust flags
  (i32.add (get_global $DEC_FLAGS) (get_local $v))
  i32.load8_u
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setQ (i32.and (i32.const 0xff)))
  (call $setF (call $getQ))

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; ld (ix+d),N (0x36)
(func $LdIXiN
  (local $addr i32)

  call $getIndexedAddress
  tee_local $addr
  call $readCodeMemory

  ;; Adjust tacts
  (call $contendRead (get_local $addr) (i32.const 1))
  (call $contendRead (get_local $addr) (i32.const 1))

  ;; Store value
  call $writeMemory

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; add ix,sp (0x39)
(func $AddIXSP
  (call $AluAdd16 (call $getIndexReg) (get_global $SP))
  call $setIndexReg
)

;; ld b,xh (0x44)
(func $LdBXH
  (i32.shr_u (call $getIndexReg) (i32.const 8))
  call $setB
)

;; ld b,xl (0x45)
(func $LdBXL
  (i32.and (call $getIndexReg) (i32.const 0xff))
  call $setB
)

;; ld b,(ix+d) (0x46)
(func $LdBIXi
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  (call $setB (call $readMemory))

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; ld c,xh (0x4c)
(func $LdCXH
  (i32.shr_u (call $getIndexReg) (i32.const 8))
  call $setC
)

;; ld c,xl (0x4d)
(func $LdCXL
  (i32.and (call $getIndexReg) (i32.const 0xff))
  call $setC
)

;; ld c,(ix+d) (0x4e)
(func $LdCIXi
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  (call $setC (call $readMemory))

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; ld d,xh (0x54)
(func $LdDXH
  (i32.shr_u (call $getIndexReg) (i32.const 8))
  call $setD
)

;; ld d,xl (0x55)
(func $LdDXL
  (i32.and (call $getIndexReg) (i32.const 0xff))
  call $setD
)

;; ld d,(ix+d) (0x56)
(func $LdDIXi
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  (call $setD (call $readMemory))

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; ld e,xh (0x5c)
(func $LdEXH
  (i32.shr_u (call $getIndexReg) (i32.const 8))
  call $setE
)

;; ld e,xl (0x5d)
(func $LdEXL
  (i32.and (call $getIndexReg) (i32.const 0xff))
  call $setE
)

;; ld e,(ix+d) (0x5e)
(func $LdEIXi
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  (call $setE (call $readMemory))

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; ld xh,b (0x60)
(func $LdXHB
  (i32.and (call $getIndexReg) (i32.const 0x00ff))
  (i32.shl (call $getB) (i32.const 8))
  i32.or
  call $setIndexReg
)

;; ld xh,c (0x61)
(func $LdXHC
  (i32.and (call $getIndexReg) (i32.const 0x00ff))
  (i32.shl (call $getC) (i32.const 8))
  i32.or
  call $setIndexReg
)

;; ld xh,d (0x62)
(func $LdXHD
  (i32.and (call $getIndexReg) (i32.const 0x00ff))
  (i32.shl (call $getD) (i32.const 8))
  i32.or
  call $setIndexReg
)

;; ld xh,e (0x63)
(func $LdXHE
  (i32.and (call $getIndexReg) (i32.const 0x00ff))
  (i32.shl (call $getE) (i32.const 8))
  i32.or
  call $setIndexReg
)

;; ld xh,xl (0x65)
(func $LdXHXL
  (i32.and (call $getIndexReg) (i32.const 0x00ff))
  (i32.shl (call $getIndexReg) (i32.const 8))
  i32.or
  call $setIndexReg
)

;; ld h,(ix+d) (0x66)
(func $LdHIXi
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  (call $setH (call $readMemory))

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; ld xh,e (0x67)
(func $LdXHA
  (i32.and (call $getIndexReg) (i32.const 0x00ff))
  (i32.shl (call $getA) (i32.const 8))
  i32.or
  call $setIndexReg
)

;; ld xl,b (0x68)
(func $LdXLB
  (i32.or 
    (i32.and (call $getIndexReg) (i32.const 0xff00))
    (call $getB)
  )
  call $setIndexReg
)

;; ld xl,c (0x69)
(func $LdXLC
  (i32.or 
    (i32.and (call $getIndexReg) (i32.const 0xff00))
    (call $getC)
  )
  call $setIndexReg
)

;; ld xl,d (0x6a)
(func $LdXLD
  (i32.or 
    (i32.and (call $getIndexReg) (i32.const 0xff00))
    (call $getD)
  )
  call $setIndexReg
)

;; ld xl,e (0x6b)
(func $LdXLE
  (i32.or 
    (i32.and (call $getIndexReg) (i32.const 0xff00))
    (call $getE)
  )
  call $setIndexReg
)

;; ld xl,xh (0x6c)
(func $LdXLXH
  (local $xh i32)
  (i32.and (call $getIndexReg) (i32.const 0xff00))
  (i32.shr_u (tee_local $xh) (i32.const 8))
  get_local $xh
  i32.or
  call $setIndexReg
)

;; ld l,(ix+d) (0x6e)
(func $LdLIXi
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  (call $setL (call $readMemory))

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; ld xl,a (0x6f)
(func $LdXLA
  (i32.or 
    (i32.and (call $getIndexReg) (i32.const 0xff00))
    (call $getA)
  )
  call $setIndexReg
)

;; ld (ix+d),b (0x70)
(func $LdIXiB
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  (call $writeMemory (call $getB))

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; ld (ix+d),c (0x71)
(func $LdIXiC
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  (call $writeMemory (call $getC))

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; ld (ix+d),d (0x72)
(func $LdIXiD
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  (call $writeMemory (call $getD))

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; ld (ix+d),e (0x73)
(func $LdIXiE
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  (call $writeMemory (call $getE))

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; ld (ix+d),h (0x74)
(func $LdIXiH
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  (call $writeMemory (call $getH))

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; ld (ix+d),l (0x75)
(func $LdIXiL
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  (call $writeMemory (call $getL))

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; ld (ix+d),a (0x77)
(func $LdIXiA
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  (call $writeMemory (call $getA))

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; ld a,xh (0x7c)
(func $LdAXH
  (i32.shr_u (call $getIndexReg) (i32.const 8))
  call $setA
)

;; ld a,xl (0x7d)
(func $LdAXL
  (i32.and (call $getIndexReg) (i32.const 0xff))
  call $setA
)

;; ld a,(ix+d) (0x7e)
(func $LdAIXi
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  (call $setA (call $readMemory))

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; add a,xh (0x84)
(func $AddAXH
  (i32.shr_u (call $getIndexReg) (i32.const 8))
  i32.const 0
  call $AluAdd
)

;; add a,xl (0x85)
(func $AddAXL
  (i32.and (call $getIndexReg) (i32.const 0xff))
  i32.const 0
  call $AluAdd
)

;; add a,(ix+d) (0x86)
(func $AddAIXi
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  call $readMemory
  i32.const 0
  call $AluAdd

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; adc a,xh (0x8c)
(func $AdcAXH
  (i32.shr_u (call $getIndexReg) (i32.const 8))
  (i32.and (call $getF) (i32.const 1))
  call $AluAdd
)

;; adc a,xl (0x8d)
(func $AdcAXL
  (i32.and (call $getIndexReg) (i32.const 0xff))
  (i32.and (call $getF) (i32.const 1))
  call $AluAdd
)

;; adc a,(ix+d) (0x8e)
(func $AdcAIXi
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  call $readMemory
  (i32.and (call $getF) (i32.const 1))
  call $AluAdd

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; sub a,xh (0x94)
(func $SubAXH
  (i32.shr_u (call $getIndexReg) (i32.const 8))
  i32.const 0
  call $AluSub
)

;; sub a,xl (0x95)
(func $SubAXL
  (i32.and (call $getIndexReg) (i32.const 0xff))
  i32.const 0
  call $AluSub
)

;; sub a,(ix+d) (0x96)
(func $SubAIXi
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  call $readMemory
  i32.const 0
  call $AluSub

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; sbc a,xh (0x9c)
(func $SbcAXH
  (i32.shr_u (call $getIndexReg) (i32.const 8))
  (i32.and (call $getF) (i32.const 1))
  call $AluSub
)

;; sbc a,xl (0x9d)
(func $SbcAXL
  (i32.and (call $getIndexReg) (i32.const 0xff))
  (i32.and (call $getF) (i32.const 1))
  call $AluSub
)

;; sub a,(ix+d) (0x9e)
(func $SbcAIXi
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  call $readMemory
  (i32.and (call $getF) (i32.const 1))
  call $AluSub

    ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; and a,xh (0xa4)
(func $AndAXH
  (i32.shr_u (call $getIndexReg) (i32.const 8))
  call $AluAnd
)

;; and a,xl (0xa5)
(func $AndAXL
  (i32.and (call $getIndexReg) (i32.const 0xff))
  call $AluAnd
)

;; and a,(ix+d) (0xa6)
(func $AndAIXi
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  call $readMemory
  call $AluAnd

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; xor a,xh (0xac)
(func $XorAXH
  (i32.shr_u (call $getIndexReg) (i32.const 8))
  call $AluXor
)

;; xor a,xl (0xad)
(func $XorAXL
  (i32.and (call $getIndexReg) (i32.const 0xff))
  call $AluXor
)

;; xor a,(ix+d) (0xae)
(func $XorAIXi
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  call $readMemory
  call $AluXor

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; or a,xh (0xb4)
(func $OrAXH
  (i32.shr_u (call $getIndexReg) (i32.const 8))
  call $AluOr
)

;; or a,xl (0xb5)
(func $OrAXL
  (i32.and (call $getIndexReg) (i32.const 0xff))
  call $AluOr
)

;; or a,(ix+d) (0xb6)
(func $OrAIXi
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  call $readMemory
  call $AluOr

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; cp xh (0xbc)
(func $CpAXH
  (i32.shr_u (call $getIndexReg) (i32.const 8))
  call $AluCp
)

;; cp xl (0xbd)
(func $CpAXL
  (i32.and (call $getIndexReg) (i32.const 0xff))
  call $AluCp
)

;; cp (ix+d) (0xbe)
(func $CpAIXi
  (local $addr i32)
  call $getIndexedAddress
  (call $AdjustPcTact5 (tee_local $addr))
  call $readMemory
  call $AluCp

  ;; Adjust WZ
  (call $setWZ (get_local $addr))
)

;; pop ix (0xe1)
(func $PopIX
  call $popValue
  call $setIndexReg
)

  ;; ex (sp),ix (0xe3)
(func $ExSPiIX
  (local $tmpSp i32)
  get_global $SP
  tee_local $tmpSp
  call $readMemory
  (i32.add (get_local $tmpSp) (i32.const 1))
  tee_local $tmpSp
  (i32.shl (call $readMemory) (i32.const 8))
  i32.add
  call $setWZ

  ;; Adjust tacts
  ;; Adjust tacts
  (call $contendRead (get_local $tmpSp) (i32.const 1))

  ;; Write H to stack
  get_local $tmpSp
  (i32.shr_u (call $getIndexReg) (i32.const 8))
  call $writeMemory

  ;; Write L to stack
  (i32.sub (get_local $tmpSp) (i32.const 1))
  tee_local $tmpSp
  (i32.and (call $getIndexReg) (i32.const 0xff))
  call $writeMemory

  ;; Adjust tacts
  (call $contendWrite (get_local $tmpSp) (i32.const 1))
  (call $contendWrite (get_local $tmpSp) (i32.const 1))

  ;; Copy WZ to IX
  call $getWZ
  call $setIndexReg
)

;; push ix (0xe5)
(func $PushIX
  call $getIndexReg
  call $pushValue
)

;; jp (ix) (0xe9)
(func $JpIX
  call $getIndexReg
  call $setPC
)

;; ld sp,ix (0xf9)
(func $LdSPIX
  call $getIndexReg
  call $setSP
  i32.const 2
  call $incTacts
)
