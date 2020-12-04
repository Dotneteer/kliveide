;; ============================================================================
;; Implements the Z88 keyboard device (Blink)

;; Sets the status of the specified key
(func $setKeyStatus (param $keyCode i32) (param $isDown i32)
  (local $line i32)
  (local $mask i32)

  ;; Ignore invalid key codes
  (i32.gt_u (get_local $keyCode) (i32.const 63))
  if return end

  ;; Calculate line address
  (i32.add 
    (get_global $KEYBOARD_LINES)
    (i32.shr_u (get_local $keyCode) (i32.const 3))
  )
  set_local $line

  ;; Calculate line mask
  (i32.shl 
    (i32.const 1)
    (i32.and (get_local $keyCode) (i32.const 0x07))
  )
  set_local $mask

  get_local $isDown
  if
    ;; Key is down
    get_local $line
    (i32.load8_u (get_local $line))
    get_local $mask
    i32.or
    i32.store8
  else
    get_local $line
    (i32.load8_u (get_local $line))
    get_local $mask
    i32.const 0xff
    i32.xor
    i32.and
    i32.store8
  end
)

;; Gets the status of the specified key
(func $getKeyStatus (param $keyCode i32) (result i32)
  ;; Ignore invalid key codes
  (i32.gt_u (get_local $keyCode) (i32.const 63))
  if 
    i32.const 0
    return
  end

  ;; Get line value
  (i32.add 
    (get_global $KEYBOARD_LINES)
    (i32.shr_u (get_local $keyCode) (i32.const 3))
  )
  i32.load8_u

  ;; Calculate line mask
  (i32.shl 
    (i32.const 1)
    (i32.and (get_local $keyCode) (i32.const 0x07))
  )

  ;; Return the result
  i32.and
)

;; Gets the byte we would get when querying the I/O address with the
;; specified byte as the highest 8 bits of the address line
;; $line: The highest 8 bits of the address line
;; Returns the status value to be received when querying the I/O
(func $getKeyLineStatus (param $line i32) (result i32)
  (local $status i32)
  (local $lineIndex i32)
  ;; Init query loop
  (i32.xor (get_local $line) (i32.const 0xff))
  set_local $line
  i32.const 0 set_local $status
  i32.const 0 set_local $lineIndex

  ;; Iterate through all lines
  loop $lineLoop
    (i32.gt_u (get_local $line) (i32.const 0))
    if
      (i32.and (get_local $line) (i32.const 0x01))
      if
        (i32.add (get_global $KEYBOARD_LINES) (get_local $lineIndex))
        i32.load8_u
        get_local $status
        i32.or
        set_local $status
      end
      ;; Update for next iteration
      (i32.add (get_local $lineIndex) (i32.const 1))
      set_local $lineIndex
      (i32.shr_u (get_local $line) (i32.const 1))
      set_local $line
      br $lineLoop
    end
  end
  get_local $status
  i32.const 0xff
  i32.xor
)

