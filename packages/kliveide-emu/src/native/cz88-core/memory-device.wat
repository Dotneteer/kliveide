;; ============================================================================
;; Implements the Z88 memory device (Blink)

;; Sets the specified memory segment (0x00..0x03) to the specified band (8-bit)
(func $setZ88MemorySegment (param $segment i32) (param $bankNo)
  ;; Mask out the used bits
  (i32.and (get_local $segment) (i32.const 0x03))
  set_local $segment
  (i32.and (get_local $bankNo) (i32.const 0xff))
  set_local $bankNo

  ;; TODO: Implement the paging logic
)
