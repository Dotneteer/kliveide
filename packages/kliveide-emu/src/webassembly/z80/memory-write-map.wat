;; ============================================================================
;; Memory write functions to help memory view refresh

;; Erases the memory write map
(func $eraseMemoryWriteMap
  (local $counter i32)
  (local $addr i32)
  i32.const 0x2000 set_local $counter
  get_global $MEMWRITE_MAP set_local $addr
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

;; Sets the specified memory write point
(func $setMemoryWritePoint (param $point i32)
  (local $addr i32)
  get_global $MEMWRITE_MAP
  (i32.shr_u (get_local $point) (i32.const 3))
  i32.add
  tee_local $addr
  get_local $addr
  i32.load8_u ;; [ addr, point byte ]

  (i32.shl
    (i32.const 0x01)
    (i32.and (get_local $point) (i32.const 0x07))
  ) ;; Mask to set
  i32.or ;; [ addr, new point]
  i32.store8
)
