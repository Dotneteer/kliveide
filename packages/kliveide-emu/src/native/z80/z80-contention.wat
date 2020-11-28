;; ============================================================================
;; Z80 CPU contention methods

;; Memory contention on read operation
(func $contendRead (param $addr i32) (param $delay i32)
  ;; The default implementation ignores the address, uses only delay
  (call $incTacts (get_local $delay))
)

;; Memory contention on write operation
(func $contendWrite (param $addr i32) (param $delay i32)
  ;; The default implementation ignores the address, uses only delay
  (call $incTacts (get_local $delay))
)