;; ============================================================================
;; Implementation of Z80 bit instructions

;; ----------------------------------------------------------------------------
;; Bit operation helpers

;; RLC logic - sets flags
;; $a: argument
(func $Rlc (param $a i32) (result i32)
  (local $res i32)
  (i32.shl (get_local $a) (i32.const 1))
  (i32.shr_u (get_local $a) (i32.const 7))
  i32.or
  i32.const 0xff
  i32.and
  set_local $res
  (i32.load8_u (i32.add (get_global $RLC_FLAGS) (get_local $a)))
  (call $setF (i32.and (i32.const 0xff)))
  get_local $res
)

;; RRC logic - sets flags
;; $a: argument
(func $Rrc (param $a i32) (result i32)
  (local $res i32)
  (i32.shl (get_local $a) (i32.const 7))
  (i32.shr_u (get_local $a) (i32.const 1))
  i32.or
  i32.const 0xff
  i32.and
  set_local $res
  (i32.load8_u (i32.add (get_global $RRC_FLAGS) (get_local $a)))
  (call $setF (i32.and (i32.const 0xff)))
  get_local $res
)

;; RL logic - sets flags
;; $a: argument
(func $Rl (param $a i32) (result i32)
  (local $c i32)
  (i32.and (call $getF) (i32.const 0x01))
  tee_local $c
  if (result i32)
    get_global $RL1_FLAGS
  else
    get_global $RL0_FLAGS
  end
  get_local $a
  i32.add
  i32.load8_u
  (call $setF (i32.and (i32.const 0xff)))
  (i32.shl (get_local $a) (i32.const 1))
  get_local $c
  i32.or
)

;; RR logic - sets flags
;; $a: argument
(func $Rr (param $a i32) (result i32)
  (local $c i32)
  (i32.and (call $getF) (i32.const 0x01))
  i32.const 7
  i32.shl
  tee_local $c
  if (result i32)
    get_global $RR1_FLAGS
  else
    get_global $RR0_FLAGS
  end
  get_local $a
  i32.add
  i32.load8_u
  (call $setF (i32.and (i32.const 0xff)))
  (i32.shr_u (get_local $a) (i32.const 1))
  get_local $c
  i32.or
)

;; SLA logic - sets flags
;; $a: argument
(func $Sla (param $a i32) (result i32)
  (i32.add (get_global $RL0_FLAGS) (get_local $a))
  i32.load8_u
  (call $setF (i32.and (i32.const 0xff)))
  (i32.shl (get_local $a) (i32.const 1))
)

;; SRA logic - sets flags
;; $a: argument
(func $Sra (param $a i32) (result i32)
  (i32.add (get_global $SRA_FLAGS) (get_local $a))
  i32.load8_u
  (call $setF (i32.and (i32.const 0xff)))

  (i32.shr_u (get_local $a) (i32.const 1))
  (i32.and (get_local $a) (i32.const 0x80))
  i32.or
)

;; SLL logic - sets flags
;; $a: argument
(func $Sll (param $a i32) (result i32)
  (i32.add (get_global $RL1_FLAGS) (get_local $a))
  i32.load8_u
  (call $setF (i32.and (i32.const 0xff)))

  (i32.shl (get_local $a) (i32.const 1))
  i32.const 1
  i32.or
)

;; SRL logic - sets flags
;; $a: argument
(func $Srl (param $a i32) (result i32)
  (i32.add (get_global $RR0_FLAGS) (get_local $a))
  i32.load8_u
  (call $setF (i32.and (i32.const 0xff)))

  (i32.shr_u (get_local $a) (i32.const 1))
)

;; Bit logic - sets flags
;; $a: argument
;; $n: bit index
(func $Bit (param $a i32) (param $n i32)
  (local $val i32)
  get_local $a
  (i32.shl (i32.const 0x01) (get_local $n))
  i32.and
  tee_local $val

  ;; Z and PV
  if (result i32) ;; (Z|PV|S)
    i32.const 0x80
    i32.const 0x00
    (i32.eq (get_local $n) (i32.const 7))
    select
  else
    i32.const 0x44
  end

  ;; Keep C
  (i32.and (call $getF) (i32.const 0x01))
  (i32.and (get_local $val) (i32.const 0x28)) ;; (Z|PV|S, C, R3|R5)
  i32.const 0x10 ;; (Z|PV|S, C, R3|R5, H)

  ;; Merge flags
  i32.or
  i32.or
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; ----------------------------------------------------------------------------
;; Bit operations

;; Bop Q
(func $BopQ
  (local $q i32)
  (tee_local $q (i32.and (get_global $opCode) (i32.const 0x07)))
  get_local $q
  call $getReg8

  ;; Call the bit operation
  get_global $BOP_JT
  (i32.shr_u
    (i32.and (get_global $opCode) (i32.const 0x38))
    (i32.const 3)
  )
  i32.add
  call_indirect (type $BitOpFunc)

  ;; Store result
  call $setReg8
)

;; Bop (hl)
(func $BopHLi
  call $getHL
  call $getHL
  call $readMemory
  get_global $useGateArrayContention
  if
    (call $incTacts (i32.const 1))
  else
    (call $memoryDelay (call $getHL))
    (call $incTacts (i32.const 1))
  end

  ;; Call the bit operation
  get_global $BOP_JT
  (i32.shr_u
    (i32.and (get_global $opCode) (i32.const 0x38))
    (i32.const 3)
  )
  i32.add
  call_indirect (type $BitOpFunc)

  ;; Store the result
  call $writeMemory
)

;; Bit N,Q (0x40-7f)
(func $BitNQ
  (i32.and (get_global $opCode) (i32.const 0x07)) ;;
  call $getReg8
  (i32.shr_u
    (i32.and (get_global $opCode) (i32.const 0x38))
    (i32.const 3)
  )
  call $Bit
)

;; bit N,(hl)
(func $BitNHLi
  call $getHL
  call $readMemory
  (i32.shr_u
    (i32.and (get_global $opCode) (i32.const 0x38))
    (i32.const 3)
  )
  call $Bit

  (i32.eq (get_global $useGateArrayContention) (i32.const 0))
  if
    (call $memoryDelay (call $getHL))
  end
  (call $incTacts (i32.const 1))
)

;; res N,Q (0x80-bf)
(func $ResNQ
  (local $q i32)
  (i32.and (get_global $opCode) (i32.const 0x07))
  tee_local $q  ;; (Q)
  get_local $q
  call $getReg8 ;; (Q,regQ)

  (i32.shl 
    (i32.const 1)
    (i32.shr_u
      (i32.and (get_global $opCode) (i32.const 0x38))
      (i32.const 3)
    )
  )
  i32.const 0xff
  i32.xor
  i32.and
  call $setReg8
)

;; res N,(hl)
(func $ResNHLi
  call $getHL
  call $getHL
  call $readMemory

  (i32.shl 
    (i32.const 1)
    (i32.shr_u
      (i32.and (get_global $opCode) (i32.const 0x38))
      (i32.const 3)
    )
  )
  i32.const 0xff
  i32.xor
  i32.and
  call $writeMemory

  get_global $useGateArrayContention
  if
    (call $incTacts (i32.const 1))
  else
    (call $memoryDelay (call $getHL))
    (call $incTacts (i32.const 1))
  end
)

;; set N,Q (0xc0-ff)
(func $SetNQ
  (local $q i32)
  (i32.and (get_global $opCode) (i32.const 0x07))
  tee_local $q  ;; (Q)
  get_local $q
  call $getReg8 ;; (Q,regQ)

  (i32.shl 
    (i32.const 1)
    (i32.shr_u
      (i32.and (get_global $opCode) (i32.const 0x38))
      (i32.const 3)
    )
  )
  i32.or
  call $setReg8
)

;; set N,(hl)
(func $SetNHLi
  call $getHL
  call $getHL
  call $readMemory

  (i32.shl 
    (i32.const 1)
    (i32.shr_u
      (i32.and (get_global $opCode) (i32.const 0x38))
      (i32.const 3)
    )
  )
  i32.or
  call $writeMemory

  get_global $useGateArrayContention
  if
    (call $incTacts (i32.const 1))
  else
    (call $memoryDelay (call $getHL))
    (call $incTacts (i32.const 1))
  end
)
