;; ============================================================================
;; Implementation of Z80 indexed bit operations

;; rlc (ix+d),Q
(func $XBopQ (param $addr i32)
  (local $q i32)
  (local $res i32)
  (i32.and (get_global $opCode) (i32.const 0x07))
  set_local $q

  ;; Read the operand
  get_local $addr
  call $readMemory

  ;; Adjust tacts
  (call $contendRead (get_local $addr) (i32.const 1))

  ;; Get the type of operation
  i32.const $BOP_JT#
  (i32.shr_u
    (i32.and (get_global $opCode) (i32.const 0x38))
    (i32.const 3)
  )
  i32.add
  call_indirect (type $BitOpFunc)
  set_local $res

  ;; Write back to memory
  get_local $addr
  get_local $res
  call $writeMemory

  ;; Store conditionally to reg
  (i32.ne (get_local $q) (i32.const 6))
  if
    (call $setReg8 (get_local $q) (get_local $res))
  end
)

;; bit (ix+d),Q
(func $XBitNQ (param $addr i32)
  i32.const $F#

  get_local $addr
  call $readMemory
  (i32.shr_u 
    (i32.and (get_global $opCode) (i32.const 0x38))
    (i32.const 3)
  )
  call $Bit

  ;; Correct the R3 and R5 flags
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xd7)) ;; Mask out R3 and R5
  (i32.and
    (i32.shr_u (get_local $addr) (i32.const 8))
    (i32.const 0x28)
  )
  i32.or
  i32.store8

  ;; Adjust tacts
  (call $contendRead (call $getHL) (i32.const 1))
)

;; res (ix+d),Q
(func $XResNQ (param $addr i32)
  (local $q i32)
  (local $res i32)
  get_local $addr
  get_local $addr
  call $readMemory

  ;; Adjust tacts
  (call $contendRead (call $getHL) (i32.const 1))

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
  tee_local $res
  call $writeMemory

  (i32.and (get_global $opCode) (i32.const 0x07))
  (i32.ne (tee_local $q) (i32.const 6))
  if
    (call $setReg8 (get_local $q) (get_local $res))
  end
)

;; set (ix+d),Q
(func $XSetNQ (param $addr i32)
  (local $q i32)
  (local $res i32)
  get_local $addr
  get_local $addr
  call $readMemory

  ;; Adjust tacts
  (call $contendRead (call $getHL) (i32.const 1))

  (i32.shl 
    (i32.const 1)
    (i32.shr_u
      (i32.and (get_global $opCode) (i32.const 0x38))
      (i32.const 3)
    )
  )
  i32.or
  tee_local $res
  call $writeMemory

  (i32.and (get_global $opCode) (i32.const 0x07))
  (i32.ne (tee_local $q) (i32.const 6))
  if
    (call $setReg8 (get_local $q) (get_local $res))
  end
)
