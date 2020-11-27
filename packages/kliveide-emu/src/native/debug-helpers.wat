;; ============================================================================
;; Helpers for debugging

;; Erases all breakpoints
(func $eraseBreakPoints
  (local $counter i32)
  (local $addr i32)
  i32.const 0x2000 set_local $counter
  get_global $BREAKPOINT_MAP set_local $addr
  loop $eraseLoop
    get_local $counter
    if
      (i32.store8 (get_local $addr) (i32.const 0))
      (i32.add (get_local $addr) (i32.const 1))
      set_local $addr
      (i32.sub (get_local $counter) (i32.const 1))
      set_local $counter
      br $eraseLoop
    end
  end
)

;; Sets the specified breakpoint
(func $setBreakpoint (param $brpoint i32)
  (local $addr i32)
  get_global $BREAKPOINT_MAP
  (i32.shr_u (get_local $brpoint) (i32.const 3))
  i32.add
  tee_local $addr
  get_local $addr
  i32.load8_u ;; [ addr, brpoint byte ]

  (i32.shl
    (i32.const 0x01)
    (i32.and (get_local $brpoint) (i32.const 0x07))
  ) ;; Mask to set
  i32.or ;; [ addr, new brpoint]
  i32.store8
)

;; Erases the specified breakpoint
(func $removeBreakpoint (param $brpoint i32)
  (local $addr i32)
  get_global $BREAKPOINT_MAP
  (i32.shr_u (get_local $brpoint) (i32.const 3))
  i32.add
  tee_local $addr
  get_local $addr
  i32.load8_u ;; [ addr, brpoint byte ]

  (i32.xor
    (i32.shl
      (i32.const 0x01)
      (i32.and (get_local $brpoint) (i32.const 0x07))
    )
    (i32.const 0xff)
  )
  ;; Mask to reset
  i32.and ;; [ addr, new brpoint]
  i32.store8
)

;; Tests the specified breakpoint
(func $testBreakpoint (param $brpoint i32) (result i32)
  get_global $BREAKPOINT_MAP
  (i32.shr_u (get_local $brpoint) (i32.const 3))
  i32.add
  i32.load8_u ;; [ brpoint byte ]

  (i32.shl
    (i32.const 0x01)
    (i32.and (get_local $brpoint) (i32.const 0x07))
  ) ;; Mask to test
  i32.and
)
