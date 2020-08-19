;; ============================================================================
;; ZX Spectrum memory management functions

(func $setMemoryPageIndex (param $page i32) (param $bankOffset i32) (param $contended i32) (param $readonly i32)
  (local $indexAddr i32)
  ;; Calculate the address within th index table
  (i32.add
    (i32.mul 
      (i32.and (get_local $page) (i32.const 0x03)) ;; We allow only four pages
      (i32.const 6)
    )
    (get_global $PAGE_INDEX_16)
  )
  (i32.store (tee_local $indexAddr) (get_local $bankOffset))
  (i32.store8 offset=4 (get_local $indexAddr) (get_local $contended))
  (i32.store8 offset=5 (get_local $indexAddr) (get_local $readonly))
)

;; Reads the paged memory according to the page index table
(func $readPagedMemory16 (param $addr i32) (result i32)
  (local $indexAddr i32)

  ;; Calculate the index table address
  (i32.shr_u
    (i32.and (get_local $addr) (i32.const 0xffff))  
    (i32.const 14)
  ) ;; Now, we have the page number
  (i32.mul (i32.const 6)) ;; Offset in the index table
  (i32.add (get_global $PAGE_INDEX_16))
  tee_local $indexAddr ;; Index entry address

  ;; Get memory value from the offset
  i32.load ;; New we have the page offset
  (i32.and (get_local $addr) (i32.const 0x3fff))
  i32.add
  i32.load8_u ;; (memory value)

  ;; Apply contention
  (i32.load8_u offset=4 (get_local $indexAddr))
  if
    call $applyContentionDelay
  end
)

(func $writePagedMemory16 (param $addr i32) (param $value i32)
  (local $indexAddr i32)

  ;; Calculate the index table address
  (i32.shr_u
    (i32.and (get_local $addr) (i32.const 0xffff))  
    (i32.const 14)
  ) ;; Now, we have the page number
  (i32.mul (i32.const 6)) ;; Offset in the index table
  (i32.add (get_global $PAGE_INDEX_16))
  tee_local $indexAddr ;; Index entry address

  ;; Check for read-onliness
  i32.load8_u offset=5
  if return end

  ;; Get memory value from the offset
  (i32.load (get_local $indexAddr)) ;; New we have the page offset
  (i32.and (get_local $addr) (i32.const 0x3fff))
  i32.add
  (i32.store8 (get_local $value)) ;; (memory value)

  ;; Apply contention
  (i32.load8_u offset=4 (get_local $indexAddr))
  if
    call $applyContentionDelay
  end
)