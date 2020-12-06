;; ========================================================
;; Z80 CPU hooks that call JavaScript methods

;; $HK_OPFETCHED#       = 0x01
;; $HK_STD_OP_EXEC#     = 0x02
;; $HK_EXT_OP_EXEC#     = 0x04
;; $HK_IDX_OP_EXEC#     = 0x08
;; $HK_BIT_OP_EXEC#     = 0x10
;; $HK_IDX_BIT_OP_EXEC# = 0x20
;; $HK_INT_EXEC#        = 0x40
;; $HK_NMI_EXEC#        = 0x80
;; $HK_HALTED#          = 0x100

;; Invokes the $opCodeFetched diagnostics hook method
(func $hookOpCodeFetched
  (i32.and (get_global $cpuDiagnostics) (i32.const $HK_OPFETCHED#))
  if
    (call $opCodeFetched (get_global $opCode) (get_global $PC))
  end
)

;; Invokes the $standardOpExecuted diagnostics hook method
(func $hookStandardOpExecuted
  (i32.and (get_global $cpuDiagnostics) (i32.const $HK_STD_OP_EXEC#))
  if
    (call $standardOpExecuted (get_global $opCode) (get_global $PC))
  end
)

;; Invokes the $extendedOpExecuted diagnostics hook method
(func $hookExtendedOpExecuted
  (i32.and (get_global $cpuDiagnostics) (i32.const $HK_EXT_OP_EXEC#))
  if
    (call $extendedOpExecuted (get_global $opCode) (get_global $PC))
  end
)

;; Invokes the $indexedOpExecuted diagnostics hook method
(func $hookIndexedOpExecuted
  (i32.and (get_global $cpuDiagnostics) (i32.const $HK_IDX_OP_EXEC#))
  if
    (call $indexedOpExecuted 
      (get_global $opCode)
      (i32.sub (get_global $indexMode) (i32.const 1))
      (get_global $PC)
    )
  end
)

;; Invokes the $bitOpExecuted diagnostics hook method
(func $hookBitOpExecuted
  (i32.and (get_global $cpuDiagnostics) (i32.const $HK_BIT_OP_EXEC#))
  if
    (call $bitOpExecuted (get_global $opCode) (get_global $PC))
  end
)

;; Invokes the $indexedBitOpExecuted diagnostics hook method
(func $hookIndexedBitOpExecuted
  (i32.and (get_global $cpuDiagnostics) (i32.const $HK_IDX_BIT_OP_EXEC#))
  if
    (call $indexedBitOpExecuted 
      (get_global $opCode)
      (i32.sub (get_global $indexMode) (i32.const 1))
      (get_global $PC)
    )
  end
)

;; Invokes the $intExecuted diagnostics hook method
(func $hookIntExecuted
  (i32.and (get_global $cpuDiagnostics) (i32.const $HK_INT_EXEC#))
  if
    (call $intExecuted (get_global $PC))
  end
)

;; Invokes the $nmiExecuted diagnostics hook method
(func $hookNmiExecuted
  (i32.and (get_global $cpuDiagnostics) (i32.const $HK_INT_EXEC#))
  if
    call $nmiExecuted
  end
)

;; Invokes the $intExecuted diagnostics hook method
(func $hookHalted
  (i32.and (get_global $cpuDiagnostics) (i32.const $HK_HALTED#))
  if
    (call $halted (get_global $PC))
  end
)

