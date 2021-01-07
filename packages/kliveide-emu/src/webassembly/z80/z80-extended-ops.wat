;; ============================================================================
;; Implementation of Z80 extended instructions

;; in b,(c) (0x40)
(func $InBC
  (local $pval i32)
  ;; WZ = BC + 1
  (call $setWZ (i32.add (call $getBC) (i32.const 1)))
  
  ;; Read and store port value
  (call $setB (call $readPort (call $getBC)) (tee_local $pval))
  
  ;; Adjust flags
  i32.const $F#
  (i32.add (get_global $LOG_FLAGS) (get_local $pval))
  i32.load8_u
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  i32.or
  (i32.and (i32.const 0xff))
  i32.store8
)

;; out (c),b (0x41)
(func $OutCB
  ;; WZ = BC + 1
  (call $setWZ (i32.add (call $getBC) (i32.const 1)))

  ;; Write
  (call $writePort (call $getBC) (call $getB))
)

;; sbc hl,bc (0x42)
(func $SbcHLBC
  (call $setWZ (i32.add (call $getHL) (i32.const 1)))
  (call $AluSbcHL (call $getBC))
  (call $incTacts (i32.const 7))
)

;; ld (NN),bc (0x43)
(func $LdNNiBC
  (local $addr i32)
  call $readCode16
  (i32.add (tee_local $addr) (i32.const 1))
  call $setWZ
  get_local $addr
  (call $writeMemory (call $getC))
  call $getWZ
  (call $writeMemory (call $getB))
)

;; in c,(c) (0x48)
(func $InCC
  (local $pval i32)
  ;; WZ = BC + 1
  (call $setWZ (i32.add (call $getBC) (i32.const 1)))
  
  ;; Read and store port value
  (call $setC (call $readPort (call $getBC)) (tee_local $pval))
  
  ;; Adjust flags
  i32.const $F#
  (i32.add (get_global $LOG_FLAGS) (get_local $pval))
  i32.load8_u
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  i32.or
  (i32.and (i32.const 0xff))
  i32.store8
)

;; out (c),c (0x49)
(func $OutCC
  ;; WZ = BC + 1
  (call $setWZ (i32.add (call $getBC) (i32.const 1)))
  (call $writePort (call $getBC) (call $getC))
)

;; in d,(c) (0x50)
(func $InDC
  (local $pval i32)
  ;; WZ = BC + 1
  (call $setWZ (i32.add (call $getBC) (i32.const 1)))
  
  ;; Read and store port value
  (call $setD (call $readPort (call $getBC)) (tee_local $pval))
  
  ;; Adjust flags
  i32.const $F#
  (i32.add (get_global $LOG_FLAGS) (get_local $pval))
  i32.load8_u
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  i32.or
  (i32.and (i32.const 0xff))
  i32.store8
)

;; out (c),d (0x51)
(func $OutCD
  ;; WZ = BC + 1
  (call $setWZ (i32.add (call $getBC) (i32.const 1)))
  (call $writePort (call $getBC) (call $getD))
)

;; in e,(c) (0x58)
(func $InEC
  (local $pval i32)
  ;; WZ = BC + 1
  (call $setWZ (i32.add (call $getBC) (i32.const 1)))
  
  ;; Read and store port value
  (call $setE (call $readPort (call $getBC)) (tee_local $pval))
  
  ;; Adjust flags
  i32.const $F#
  (i32.add (get_global $LOG_FLAGS) (get_local $pval))
  i32.load8_u
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  i32.or
  (i32.and (i32.const 0xff))
  i32.store8
)

;; out (c),e (0x59)
(func $OutCE
  ;; WZ = BC + 1
  (call $setWZ (i32.add (call $getBC) (i32.const 1)))
  (call $writePort (call $getBC) (call $getE))
)

;; in h,(c) (0x60)
(func $InHC
  (local $pval i32)

  ;; WZ = BC + 1
  (call $setWZ (i32.add (call $getBC) (i32.const 1)))
  
  ;; Read and store port value
  (call $setH (call $readPort (call $getBC)) (tee_local $pval))
  
  ;; Adjust flags
  i32.const $F#
  (i32.add (get_global $LOG_FLAGS) (get_local $pval))
  i32.load8_u
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  i32.or
  (i32.and (i32.const 0xff))
  i32.store8
)

;; out (c),h (0x61)
(func $OutCH
  ;; WZ = BC + 1
  (call $setWZ (i32.add (call $getBC) (i32.const 1)))
  (call $writePort (call $getBC) (call $getH))
)

;; in l,(c) (0x68)
(func $InLC
  (local $pval i32)

  ;; WZ = BC + 1
  (call $setWZ (i32.add (call $getBC) (i32.const 1)))
  
  ;; Read and store port value
  (call $setL (call $readPort (call $getBC)) (tee_local $pval))
  
  ;; Adjust flags
  i32.const $F#
  (i32.add (get_global $LOG_FLAGS) (get_local $pval))
  i32.load8_u
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  i32.or
  (i32.and (i32.const 0xff))
  i32.store8
)

;; out (c),l (0x69)
(func $OutCL
  ;; WZ = BC + 1
  (call $setWZ (i32.add (call $getBC) (i32.const 1)))
  (call $writePort (call $getBC) (call $getL))
)

;; in (c) (0x70)
(func $In0C
  (local $pval i32)
  ;; WZ = BC + 1
  (call $setWZ (i32.add (call $getBC) (i32.const 1)))
  
  ;; Read port value
  (call $readPort (call $getBC)) 
  set_local $pval
  
  ;; Adjust flags
  i32.const $F#
  (i32.add (get_global $LOG_FLAGS) (get_local $pval))
  i32.load8_u
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  i32.or
  (i32.and (i32.const 0xff))
  i32.store8
)

;; out (c),0 (0x71)
(func $OutC0
  ;; WZ = BC + 1
  (call $setWZ (i32.add (call $getBC) (i32.const 1)))
  (call $writePort (call $getBC) (i32.const 0))
)

;; in a,(c) (0x78)
(func $InAC
  (local $pval i32)
  ;; WZ = BC + 1
  (call $setWZ (i32.add (call $getBC) (i32.const 1)))
  
  ;; Read and store port value
  (call $setA (call $readPort (call $getBC)) (tee_local $pval))
  
  ;; Adjust flags
  i32.const $F#
  (i32.add (get_global $LOG_FLAGS) (get_local $pval))
  i32.load8_u
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  i32.or
  (i32.and (i32.const 0xff))
  i32.store8
)

;; out (c),a (0x79)
(func $OutCA
  ;; WZ = BC + 1
  (call $setWZ (i32.add (call $getBC) (i32.const 1)))
  (call $writePort (call $getBC) (call $getA))
)

;; ld (NN),QQ 
(func $LdNNiQQ
  (local $qq i32)
  (local $addr i32)

  ;; Obtain address
  call $readCode16
  (i32.add (tee_local $addr) (i32.const 1))
  call $setWZ

  ;; Obtain reg value
  (i32.shr_u 
    (i32.and (get_global $opCode) (i32.const 0x30))
    (i32.const 4)
  )
  call $getReg16
  set_local $qq

  get_local $addr
  (i32.and (get_local $qq) (i32.const 0xff))
  call $writeMemory
  call $getWZ
  (i32.shr_u (get_local $qq) (i32.const 8))
  call $writeMemory
)

;; neg
(func $Neg
  (local $a i32)
  ;; Calc the new value of A
  (i32.sub (i32.const 0) (call $getA))
  i32.const 0xff
  i32.and
  set_local $a

  i32.const $F#

  ;; Keep S, R5, R3
  get_local $a
  i32.const 0xA8 ;; Mask for S|R5|R3
  i32.and ;; (S|R5|R3)
  ;; Set N
  i32.const 0x02 ;; (S|R5|R3, N)

  ;; Calculate Z
  i32.const 0x00
  i32.const 0x40
  (i32.ne (get_local $a) (i32.const 0))
  select ;; (S|R5|R3, N, Z)

  ;; Calculate C
  i32.const 0x01
  i32.const 0x00
  (i32.ne (get_local $a) (i32.const 0))
  select ;; (S|R5|R3, N, Z, C)

  ;; Calculate PV
  i32.const 0x04
  i32.const 0x00
  (i32.eq (get_local $a) (i32.const 0x80))
  select ;; (S|R5|R3, N, Z, C, PV)

  ;; Calculate H
  i32.const 0
  call $getA
  i32.const 0x0f
  i32.and
  i32.const 24
  i32.shl
  i32.const 24
  i32.shr_s
  i32.sub
  i32.const 0x10
  i32.and ;; (S|R5|R3, N, Z, C, PV, H)

  ;; Merge flags
  i32.or
  i32.or
  i32.or
  i32.or
  i32.or
  (i32.and (i32.const 0xff))

  ;; Store F
  i32.store8

  ;; Store the result
  get_local $a
  (call $setA (i32.and (i32.const 0xff)))
)

;; retn/reti
(func $Retn
  get_global $iff2
  set_global $iff1
  call $popValue
  call $setWZ
  call $getWZ
  call $setPC

  call $popFromStepOver
)

;; im N
(func $ImN
  (local $mode i32)
  (i32.shr_u
    (i32.and (get_global $opCode) (i32.const 0x18))
    (i32.const 3)
  )
  (i32.lt_u (tee_local $mode) (i32.const 2))
  if (result i32)
    i32.const 1
  else
    get_local $mode
  end
  i32.const 1
  i32.sub
  set_global $interruptMode
)

;; ld i,a 0x47
(func $LdIA
  call $getA
  call $setI    
  (call $incTacts (i32.const 1))
)

;; adc hl,bc (0x4a)
(func $AdcHLBC
  (call $setWZ (i32.add (call $getHL) (i32.const 1)))
  (call $AluAdcHL (call $getBC))
  (call $incTacts (i32.const 7))
)

;; ld bc,(NN) (0x4b)
(func $LdBCNNi
  (local $addr i32)
  call $readCode16
  (call $setWZ (i32.add (tee_local $addr) (i32.const 1)))
  (call $setC (call $readMemory (get_local $addr)))
  (call $setB (call $readMemory (call $getWZ)))
)

;; ld r,a 0x4f
(func $LdRA
  call $getA
  call $setR    
  (call $incTacts (i32.const 1))
)

;; sbc hl,de (0x52)
(func $SbcHLDE
  (call $setWZ (i32.add (call $getHL) (i32.const 1)))
  (call $AluSbcHL (call $getDE))
  (call $incTacts (i32.const 7))
)

;; ld (NN),de (0x53)
(func $LdNNiDE
  (local $addr i32)
  call $readCode16
  (i32.add (tee_local $addr) (i32.const 1))
  call $setWZ
  get_local $addr
  (call $writeMemory (call $getE))
  call $getWZ
  (call $writeMemory (call $getD))
)

;; ld a,i (0x57)
(func $LdAXr
  (local $xr i32)
  (i32.and (get_global $opCode) (i32.const 0x08))
  if (result i32)
    call $getR
  else
    call $getI
  end
  tee_local $xr
  (call $setA (i32.and (i32.const 0xff)))

  ;; Set flags
  i32.const $F#

  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01)) ;; (C)
  (i32.and (get_local $xr) (i32.const 0xa8)) ;; (C, S|R5|R3)

  i32.const 0x04
  i32.const 0x00
  get_global $iff2
  select  ;; (C, S|R5|R3, PV)

  i32.const 0x00
  i32.const 0x40
  get_local $xr
  select  ;; (C, S|R5|R3, PV, Z)

  ;; Merge flags
  i32.or
  i32.or
  i32.or
  (i32.and (i32.const 0xff))
  i32.store8

  (call $incTacts (i32.const 1))
)

;; adc hl,de (0x5a)
(func $AdcHLDE
  (call $setWZ (i32.add (call $getHL) (i32.const 1)))
  (call $AluAdcHL (call $getDE))
  (call $incTacts (i32.const 7))
)

;; ld de,(NN) (0x5b)
(func $LdDENNi
  (local $addr i32)
  call $readCode16
  (call $setWZ (i32.add (tee_local $addr) (i32.const 1)))
  (call $setE (call $readMemory (get_local $addr)))
  (call $setD (call $readMemory (call $getWZ)))
)

;; sbc hl,hl (0x62)
(func $SbcHLHL
  (call $setWZ (i32.add (call $getHL) (i32.const 1)))
  (call $AluSbcHL (call $getHL))
  (call $incTacts (i32.const 7))
)

;; rrd (0x67)
(func $Rrd
  (local $hl i32)
  (local $tmp i32)
  call $getHL
  tee_local $hl
  call $readMemory
  set_local $tmp

  ;; Adjust tacts
  (call $contendRead (get_local $hl) (i32.const 1))
  (call $contendRead (get_local $hl) (i32.const 1))
  (call $contendRead (get_local $hl) (i32.const 1))
  (call $contendRead (get_local $hl) (i32.const 1))

  ;; WZ := HL + 1
  (i32.add (get_local $hl) (i32.const 1))
  call $setWZ

  ;; Write back to memory
  call $getHL
  (i32.shl (call $getA) (i32.const 4))
  (i32.shr_u (get_local $tmp) (i32.const 4))
  i32.or
  call $writeMemory

  ;; Set A
  (i32.and (call $getA) (i32.const 0xf0))
  (i32.and (get_local $tmp) (i32.const 0x0f))
  i32.or
  (call $setA (i32.and (i32.const 0xff)))

  ;; Adjust flags
  i32.const $F#
  (i32.add (get_global $LOG_FLAGS) (call $getA))
  i32.load8_u

  ;; Keep C
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  i32.or
  (i32.and (i32.const 0xff))
  i32.store8
)

;; adc hl,hl (0x6a)
(func $AdcHLHL
  (call $setWZ (i32.add (call $getHL) (i32.const 1)))
  (call $AluAdcHL (call $getHL))
  (call $incTacts (i32.const 7))
)

;; rld (0x6f)
(func $Rld
  (local $hl i32)
  (local $tmp i32)
  call $getHL
  tee_local $hl
  call $readMemory
  set_local $tmp

  ;; Adjust tacts
  (call $contendRead (get_local $hl) (i32.const 1))
  (call $contendRead (get_local $hl) (i32.const 1))
  (call $contendRead (get_local $hl) (i32.const 1))
  (call $contendRead (get_local $hl) (i32.const 1))

  ;; WZ := HL + 1
  (i32.add (get_local $hl) (i32.const 1))
  call $setWZ

  ;; Write back to memory
  call $getHL
  (i32.and (call $getA) (i32.const 0x0f))
  (i32.shl (get_local $tmp) (i32.const 4))
  i32.or
  call $writeMemory

  ;; Set A
  (i32.and (call $getA) (i32.const 0xf0))
  (i32.shr_u (get_local $tmp) (i32.const 4))
  i32.or
  (call $setA (i32.and (i32.const 0xff)))

  ;; Adjust flags
  i32.const $F#
  (i32.add (get_global $LOG_FLAGS) (call $getA))
  i32.load8_u

  ;; Keep C
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  i32.or
  (i32.and (i32.const 0xff))
  i32.store8
)

;; sbc hl,sp (0x72)
(func $SbcHLSP
  (call $setWZ (i32.add (call $getHL) (i32.const 1)))
  (call $AluSbcHL (get_global $SP))
  (call $incTacts (i32.const 7))
)

;; ld (NN),sp (0x73)
(func $LdNNiSP
  (local $addr i32)
  call $readCode16
  (i32.add (tee_local $addr) (i32.const 1))
  call $setWZ
  get_local $addr
  (call $writeMemory (i32.and (get_global $SP) (i32.const 0xff)))
  call $getWZ
  (call $writeMemory (i32.shr_u (get_global $SP) (i32.const 8)))
)

;; adc hl,sp (0x7a)
(func $AdcHLSP
  (call $setWZ (i32.add (call $getHL) (i32.const 1)))
  (call $AluAdcHL (get_global $SP))
  (call $incTacts (i32.const 7))
)

;; ld sp,(NN) (0x7b)
(func $LdSPNNi
  (local $addr i32)
  call $readCode16
  (call $setWZ (i32.add (tee_local $addr) (i32.const 1)))
  (call $readMemory (get_local $addr))
  (call $readMemory (call $getWZ))
  i32.const 8
  i32.shl
  i32.add
  call $setSP
)

;; ----------------------------------------------------------------------------
;; Helpers for block operations

;; Implements the core of the ldi/ldd/ldir/lddr operations
;; $step: direction (1 or -1)
;; result: the value of flags
(func $LdBase (param $step i32) (result i32)
  (local $de i32)
  (local $hl i32)
  (local $memVal i32)

  ;; (DE) := (HL)
  call $getDE
  tee_local $de
  call $getHL
  tee_local $hl
  call $readMemory
  tee_local $memVal
  call $writeMemory

  ;; Increment/decrement HL
  (i32.add (get_local $hl) (get_local $step))
  call $setHL

  ;; Adjust tacts
  (call $contendRead (get_local $de) (i32.const 1))
  (call $contendRead (get_local $de) (i32.const 1))

  ;; Increment/decrement DE
  (i32.add (get_local $de) (get_local $step))
  call $setDE

  ;; Keep S, Z, and C
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xc1)) ;; (S|Z|C)
  (i32.add (get_local $memVal) (call $getA))
  (i32.and (tee_local $memVal) (i32.const 0x08))
  (i32.shl (get_local $memVal) (i32.const 4))
  
  i32.const 0x20 ;; Mask for R5
  i32.and
  i32.or ;; (S|Z|C, R5|R3)
  i32.or

  ;; Decrement BC
  (i32.sub (call $getBC) (i32.const 1))
  call $setBC
)

;; Base of the cpi/cpd/cpir/cpdr operations
;; $step: direction, 1/-1
(func $CpBase (param $step i32) (result i32)
  (local $hl i32)
  (local $compRes i32)
  (local $r3r5 i32)
  call $getA
  call $getHL
  tee_local $hl
  call $readMemory

  ;; Calc compRes
  i32.sub
  tee_local $compRes
  set_local $r3r5
  
  ;; Keep C 
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))

  ;; Set N
  i32.const 0x02 ;; (C, N)

  ;; Calculate H
  (i32.and (call $getA) (i32.const 0x0f))
  (i32.and (get_local $compRes) (i32.const 0x0f))
  i32.sub
  i32.const 0x10
  i32.and
  if (result i32) ;; (C, N, H)
    (i32.sub (get_local $compRes) (i32.const 1))
    set_local $r3r5
    i32.const 0x10
  else
    i32.const 0x00
  end

  ;; Calculate Z
  i32.const 0x00
  i32.const 0x40
  (i32.and (get_local $compRes) (i32.const 0xff))
  select ;; (C, N, H, Z)

  (i32.and (get_local $compRes) (i32.const 0x80)) ;; (C, N, H, Z, S)
  (i32.and (get_local $r3r5) (i32.const 0x08)) ;; (C, N, H, Z, S, R3)
  (i32.shl (get_local $r3r5) (i32.const 4))
  i32.const 0x20
  i32.and ;; (C, N, H, Z, S, R3,R5)

  ;; Adjust tacts
  (call $Adjust5Tacts (get_local $hl))

  ;; Increment/decrement HL
  (i32.add (get_local $hl) (get_local $step))
  call $setHL

  ;; Decrement BC
  (i32.sub (call $getBC) (i32.const 1))
  call $setBC

  ;; Merge flags
  i32.or
  i32.or
  i32.or
  i32.or
  i32.or
  i32.or
)

;; Base of ini/id/inir/indr operations
(func $InBase (param $step i32)
  (local $bc i32)
  (local $hl i32)
  (call $incTacts (i32.const 1))
  call $getBC

  ;; Increment or decrement WZ
  (i32.add (tee_local $bc) (get_local $step))
  call $setWZ

  ;; (HL) := in(BC)
  call $getHL
  tee_local $hl
  get_local $bc
  call $readPort
  call $writeMemory

  ;; Set N
  i32.const $F#
  (i32.or (i32.load8_u (i32.const $F#)) (i32.const 0x02))
  (i32.and (i32.const 0xff))
  i32.store8

  ;; Decrement B
  (i32.sub (call $getB) (i32.const 1))
  tee_local $bc
  call $setB

  ;; Set or reset Z
  i32.const $F#
  (i32.eq (get_local $bc) (i32.const 0))
  if (result i32)
    (i32.or (i32.load8_u (i32.const $F#)) (i32.const 0x40))
  else
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xbf))
  end
  (i32.and (i32.const 0xff))
  i32.store8

  ;; Increment or decrement HL
  (i32.add (call $getHL) (get_local $step))
  call $setHL
)

;; Base of outi/outd/otir/otdr operations
(func $OutBase (param $step i32)
  (local $v i32)
  (local $v2 i32)
  (local $f i32)

  ;; Delay
  (call $incTacts (i32.const 1))

  ;; Read the value from memory
  call $getHL
  call $readMemory
  set_local $v

  ;; Decrement B
  (i32.sub (call $getB) (i32.const 1))
  call $setB

  ;; WZ := BC +/- 1
  (i32.add (call $getBC) (get_local $step))
  call $setWZ

  ;; Now, write to the port
  (call $writePort (call $getBC) (get_local $v))

  ;; Increment/decrement HL
  (i32.add (call $getHL) (get_local $step))
  call $setHL

  ;; Calculate $v2
  (i32.and
    (i32.add (get_local $v) (call $getL))
    (i32.const 0xff)
  )
  set_local $v2

  i32.const $F#

  ;; Calculate flag N 
  (i32.shr_u
    (i32.and (get_local $v) (i32.const 0x80))
    (i32.const 6)
  )
  set_local $f

  ;; Calculate flag H and flag C
  (i32.lt_u (get_local $v2) (get_local $v))
  if
    (i32.or (get_local $f) (i32.const 0x11))
    set_local $f
  end

  ;; Calculate flag P
  (i32.load8_u
    (i32.add
      (get_global $PAR_FLAGS)
      (i32.xor
        (i32.and (get_local $v2) (i32.const 0x07))
        (call $getB)
      )
    )
  )
  (i32.or (get_local $f))
  set_local $f

  ;; Get R3 and R5
  (i32.load8_u
    (i32.add
      (get_global $SZ53_FLAGS)
      (call $getB)
    )
  )
  (i32.or (get_local $f))

  ;; Store the flags
  i32.store8
)


;; Tail of the ldir/lddr operations
(func $LdrTail
  (local $pc i32)

  ;; Test exit
  (i32.eq (call $getBC) (i32.const 0))
  if return end

  ;; Set PV
  i32.const $F#
  (i32.or (i32.load8_u (i32.const $F#)) (i32.const 0x04))
  (i32.and (i32.const 0xff))
  i32.store8

  ;; PC := PC - 2
  (i32.sub (get_global $PC) (i32.const 2))
  tee_local $pc
  call $setPC

  ;; Adjust tacts
  (i32.sub (call $getDE) (i32.const 1))
  call $Adjust5Tacts

  ;; WZ := PC + 1
  (i32.add (get_local $pc) (i32.const 1))
  call $setWZ
)

;; Tail of the cpir/cpdr operations
(func $CprTail (param $step i32)

  (local $f i32)
  (local $pc i32)
  call $getBC
  if
    ;; Set PV
    i32.const $F#
    (i32.load8_u (i32.const $F#))
    (i32.or (tee_local $f) (i32.const 0x04))
    (i32.and (i32.const 0xff))
    i32.store8

    (i32.eq
      (i32.and (get_local $f) (i32.const 0x40))
      (i32.const 0)
    )
    if
      ;; Value not found yet
      ;; PC := PC - 2
      (i32.sub (get_global $PC) (i32.const 2))
      tee_local $pc
      call $setPC

      ;; Adjust tacts
      (i32.sub (call $getHL) (i32.const 1))
      call $Adjust5Tacts

      ;; WZ := PC + 1
      (i32.add (get_local $pc) (i32.const 1))
      call $setWZ

    else
      ;; WZ++/WZ--
      (i32.add (call $getWZ) (get_local $step))
      call $setWZ
    end
  end
)

;; Tail of the inir/indr operations
(func $IndTail
  (i32.ne (call $getB) (i32.const 0))
  if
    ;; Set PV
    i32.const $F#
    (i32.or (i32.load8_u (i32.const $F#)) (i32.const 0x04))
    (i32.and (i32.const 0xff))
    i32.store8

    ;; PC := PC - 2
    (i32.sub (get_global $PC) (i32.const 2))
    call $setPC

    ;; Adjust tacts
    (i32.sub (call $getHL) (i32.const 1))
    call $Adjust5Tacts
  else
    ;; Reset PV
    i32.const $F#
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xfb))
    (i32.and (i32.const 0xff))
    i32.store8
  end
)

;; Tail of the otir/otdr instructions
(func $OutrTail
  (i32.ne (call $getB) (i32.const 0))
  if
    ;; Set PV
    i32.const $F#
    (i32.or (i32.load8_u (i32.const $F#)) (i32.const 0x04))
    (i32.and (i32.const 0xff))
    i32.store8

    ;; PC := PC - 2
    (i32.sub (get_global $PC) (i32.const 2))
    call $setPC

    ;; Adjust tacts
    (call $Adjust5Tacts (call $getBC))
  else
    ;; Reset PV
    i32.const $F#
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xfb))
    (i32.and (i32.const 0xff))
    i32.store8
  end
)

;; ----------------------------------------------------------------------------
;; Block operations

;; ldi (0xa0)
(func $Ldi
  i32.const $F#

  (call $LdBase (i32.const 1))
  
  ;; Calc PV
  i32.const 0x04
  i32.const 0x00
  (i32.ne (call $getBC) (i32.const 0))
  select

  ;; Merge flags
  i32.or
  (i32.and (i32.const 0xff))
  i32.store8
)

;; cpi (0xa1)
(func $Cpi
  i32.const $F#
  (call $CpBase (i32.const 1))

  ;; Calc PV
  i32.const 0x04
  i32.const 0x00
  (i32.ne (call $getBC) (i32.const 0))
  select

  ;; Merge flags
  i32.or
  (i32.and (i32.const 0xff))
  i32.store8

  ;; WZ++
  (i32.add (call $getWZ) (i32.const 1))
  call $setWZ
)

;; ini (0xa2)
(func $Ini
  (call $InBase (i32.const 1))
)

;; outi (0xa3)
(func $Outi
  (call $OutBase (i32.const 1))
)

;; ldd (0xa8)
(func $Ldd
  i32.const $F#
  (call $LdBase (i32.const -1))

  ;; Calc PV
  i32.const 0x04
  i32.const 0x00
  (i32.ne (call $getBC) (i32.const 0))
  select

  ;; Merge flags
  i32.or
  (i32.and (i32.const 0xff))
  i32.store8
)

;; cpd (0xa9)
(func $Cpd
  i32.const $F#
  (call $CpBase (i32.const -1))

  ;; Calc PV
  i32.const 0x04
  i32.const 0x00
  (i32.ne (call $getBC) (i32.const 0))
  select

  ;; Merge flags
  i32.or
  (i32.and (i32.const 0xff))
  i32.store8

  (i32.sub (call $getWZ) (i32.const 1))
  call $setWZ
)

;; ind (0xaa)
(func $Ind
  (call $InBase (i32.const -1))
)

;; outd (0xab)
(func $Outd
  (call $OutBase (i32.const -1))
)

;; ldir (0xb0)
(func $Ldir
  i32.const $F#
  (call $LdBase (i32.const 1))
  (i32.and (i32.const 0xff))
  i32.store8

  call $LdrTail
)

;; cpir (0xb1)
(func $Cpir
  i32.const $F#
  (call $CpBase (i32.const 1))
  (i32.and (i32.const 0xff))
  i32.store8

  i32.const 1
  call $CprTail
)

;; Inir (0xb2)
(func $Inir
  (call $InBase (i32.const 1))
  call $IndTail
)

;; Otir (0xb3)
(func $Otir
  (call $OutBase (i32.const 1))
  call $OutrTail
)

;; lddr (0xb8)
(func $Lddr
  i32.const $F#
  (call $LdBase (i32.const -1))
  (i32.and (i32.const 0xff))
  i32.store8

  call $LdrTail
)

;; cpdr (0xb9)
(func $Cpdr
  i32.const $F#
  (call $CpBase (i32.const -1))
  (i32.and (i32.const 0xff))
  i32.store8

  i32.const -1
  call $CprTail
)

;; Indr (0xba)
(func $Indr
  (call $InBase (i32.const -1))
  call $IndTail
)

;; Otdr (0xbb)
(func $Otdr
  (call $OutBase (i32.const -1))
  call $OutrTail
)
