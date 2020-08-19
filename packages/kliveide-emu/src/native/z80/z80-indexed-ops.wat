;; ============================================================================
;; Implementation of Z80 indexed operations

;; add ix,bc (0x09)
(func $AddIXBC
  (local $qq i32)
  (local $indReg i32)
  call $getIndexReg
  tee_local $indReg
  (call $setWZ (i32.add (i32.const 1)))
  (call $AluAddHL (get_local $indReg) (call $getBC))
  call $setIndexReg
  (call $incTacts (i32.const 7))
)

;; add ix,de (0x19)
(func $AddIXDE
  (local $qq i32)
  (local $indReg i32)
  call $getIndexReg
  tee_local $indReg
  (call $setWZ (i32.add (i32.const 1)))
  (call $AluAddHL (get_local $indReg) (call $getDE))
  call $setIndexReg
  (call $incTacts (i32.const 7))
)

;; ld ix,NN (0x21)
(func $LdIXNN
  call $readAddrFromCode
  call $setIndexReg
)

(func $LdNNiIX
  (local $addr i32)
  (local $ix i32)
  ;; Obtain the address to store HL
  call $readAddrFromCode
  tee_local $addr

  ;; Set WZ to addr + 1
  i32.const 1
  i32.add
  call $setWZ

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
  (call $setF (i32.and (i32.const 0xff)))
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
  (call $setF (i32.and (i32.const 0xff)))
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
  (local $qq i32)
  (local $indReg i32)
  call $getIndexReg
  tee_local $indReg
  (call $setWZ (i32.add (i32.const 1)))
  (call $AluAddHL (get_local $indReg) (get_local $indReg))
  call $setIndexReg
  (call $incTacts (i32.const 7))
)

;; ld ix,(NN) (0x2a)
(func $LdIXNNi
  (local $addr i32)
  ;; Read the address
  call $readAddrFromCode
  tee_local $addr

  ;; Set WZ to addr + 1
  i32.const 1
  i32.add
  call $setWZ

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
  (call $setF (i32.and (i32.const 0xff)))
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
  (call $setF (i32.and (i32.const 0xff)))
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
  call $writeMemory
  (call $incTacts (i32.const 1))

  ;; Adjust flags
  (i32.add (get_global $INC_FLAGS) (get_local $v))
  i32.load8_u
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
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
  call $writeMemory
  (call $incTacts (i32.const 1))

  ;; Adjust flags
  (i32.add (get_global $INC_FLAGS) (get_local $v))
  i32.load8_u
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; ld (ix+d),B (0x36)
(func $LdIXiN
  call $getIndexedAddress
  call $readCodeMemory

  ;; Adjust tacts
  get_global $useGateArrayContention
  if
    (call $incTacts (i32.const 2))
  else
    (call $memoryDelay (get_global $PC))
    (call $incTacts (i32.const 1))
    (call $memoryDelay (get_global $PC))
    (call $incTacts (i32.const 1))
  end

  ;; Store value
  call $writeMemory
)

;; add ix,sp (0x39)
(func $AddIXSP
  (local $qq i32)
  (local $indReg i32)
  call $getIndexReg
  tee_local $indReg
  (call $setWZ (i32.add (i32.const 1)))
  (call $AluAddHL (get_local $indReg) (get_global $SP))
  call $setIndexReg
  (call $incTacts (i32.const 7))
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
  (call $AdjustPcTact5 (call $getIndexedAddress))
  (call $setB (call $readMemory))
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
  (call $AdjustPcTact5 (call $getIndexedAddress))
  (call $setC (call $readMemory))
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
  (call $AdjustPcTact5 (call $getIndexedAddress))
  (call $setD (call $readMemory))
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
  (call $AdjustPcTact5 (call $getIndexedAddress))
  (call $setE (call $readMemory))
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
  (call $AdjustPcTact5 (call $getIndexedAddress))
  (call $setH (call $readMemory))
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
  (call $AdjustPcTact5 (call $getIndexedAddress))
  (call $setL (call $readMemory))
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
  call $getIndexedAddress
  call $AdjustPcTact5
  (call $writeMemory (call $getB))
)

;; ld (ix+d),c (0x71)
(func $LdIXiC
  call $getIndexedAddress
  call $AdjustPcTact5
  (call $writeMemory (call $getC))
)

;; ld (ix+d),d (0x72)
(func $LdIXiD
  call $getIndexedAddress
  call $AdjustPcTact5
  (call $writeMemory (call $getD))
)

;; ld (ix+d),e (0x73)
(func $LdIXiE
  call $getIndexedAddress
  call $AdjustPcTact5
  (call $writeMemory (call $getE))
)

;; ld (ix+d),h (0x74)
(func $LdIXiH
  call $getIndexedAddress
  call $AdjustPcTact5
  (call $writeMemory (call $getH))
)

;; ld (ix+d),l (0x75)
(func $LdIXiL
  call $getIndexedAddress
  call $AdjustPcTact5
  (call $writeMemory (call $getL))
)

;; ld (ix+d),b (0x77)
(func $LdIXiA
  call $getIndexedAddress
  call $AdjustPcTact5
  (call $writeMemory (call $getA))
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

;; ld b,(ix+d) (0x7e)
(func $LdAIXi
  (call $AdjustPcTact5 (call $getIndexedAddress))
  (call $setA (call $readMemory))
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
  call $getIndexedAddress
  call $AdjustPcTact5
  call $readMemory
  i32.const 0
  call $AluAdd
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
  call $getIndexedAddress
  call $AdjustPcTact5
  call $readMemory
  (i32.and (call $getF) (i32.const 1))
  call $AluAdd
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
  call $getIndexedAddress
  call $AdjustPcTact5
  call $readMemory
  i32.const 0
  call $AluSub
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
  call $getIndexedAddress
  call $AdjustPcTact5
  call $readMemory
  (i32.and (call $getF) (i32.const 1))
  call $AluSub
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

;; and a,(ix+d) (0x9e)
(func $AndAIXi
  call $getIndexedAddress
  call $AdjustPcTact5
  call $readMemory
  call $AluAnd
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
  call $getIndexedAddress
  call $AdjustPcTact5
  call $readMemory
  call $AluXor
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
  call $getIndexedAddress
  call $AdjustPcTact5
  call $readMemory
  call $AluOr
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
  call $getIndexedAddress
  call $AdjustPcTact5
  call $readMemory
  call $AluCp
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
  get_global $useGateArrayContention
  if
    (call $incTacts (i32.const 1))
  else
    (call $memoryDelay (get_local $tmpSp))
    (call $incTacts (i32.const 1))
  end

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
  get_global $useGateArrayContention
  if
    (call $incTacts (i32.const 2))
  else
    (call $memoryDelay (get_local $tmpSp))
    (call $incTacts (i32.const 1))
    (call $memoryDelay (get_local $tmpSp))
    (call $incTacts (i32.const 1))
  end

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
