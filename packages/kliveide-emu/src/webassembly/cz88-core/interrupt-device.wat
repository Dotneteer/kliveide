;; ============================================================================
;; Implements the Z88 interrupt device (Blink)

;; Main Blink Interrrupts (INT).
;;
;; $BM_INTKWAIT# = 0x80 // Bit 7, If set, reading the keyboard will Snooze
;; $BM_INTA19# = 0x40   // Bit 6, If set, an active high on A19 will exit Coma
;; $BM_INTFLAP# = 0x20  // Bit 5, If set, flap interrupts are enabled
;; $BM_INTUART# = 0x10  // Bit 4, If set, UART interrupts are enabled
;; $BM_INTBTL# = 0x08   // Bit 3, If set, battery low interrupts are enabled
;; $BM_INTKEY# = 0x04   // Bit 2, If set, keyboard interrupts (Snooze or Coma) are enabl.
;; $BM_INTTIME# = 0x02  // Bit 1, If set, RTC interrupts are enabled
;; $BM_INTGINT# = 0x01  // Bit 0, If clear, no interrupts get out of blink
(global $INT (mut i32) (i32.const 0x0000))

;; Main Blink Interrupt Status (STA)
;;
;; $BM_STAFLAPOPEN# = 0x80  // Bit 7, If set, flap open, else flap closed
;; $BM_STAA19# = 0x40       // Bit 6, If set, high level on A19 occurred during coma
;; $BM_STAFLAP# = 0x20      // Bit 5, If set, positive edge has occurred on FLAPOPEN
;; $BM_STAUART# = 0x10      // Bit 4, If set, an enabled UART interrupt is active
;; $BM_STABTL# = 0x08       // Bit 3, If set, battery low pin is active
;; $BM_STAKEY# = 0x04       // Bit 2, If set, a column has gone low in snooze (or coma)
;; $BM_STATIME# = 0x01      // Bit 0, If set, an enabled TSTA interrupt is active

;; $BM_STATIME_MASK# = 0xfe // Bit 0 reset mask
(global $STA (mut i32) (i32.const 0x0000))

;; Tests if the maskable interrupt has been requested
(func $isMaskableInterruptRequested (result i32)
  ;; Is the BM_INTGINT flag set?
  (i32.and (get_global $INT) (i32.const $BM_INTGINT#))
  if
    (select
      (i32.const $SIG_INT#)
      (i32.const 0)
      (i32.and (get_global $INT) (get_global $STA))
    )
    return
  end
  i32.const 0
)

;; Sets the value of the TACK register
(func $setTACK (param $v i32)
  (i32.and 
    (get_global $TSTA)
    ;; Create bit mask
    (i32.xor
      ;; 8-bit LSB
      (i32.and (get_local $v) (i32.const 0xff))
      (i32.const 0xff)
    )
  )
  set_global $TSTA

  (i32.eqz (get_global $TSTA))
  if
    (i32.and (get_global $STA) (i32.const $BM_STATIME_MASK#))
    set_global $STA
  end
)

;; Set the value of the ACK register
(func $setACK (param $v i32)
  (i32.and 
    (get_global $STA)
    ;; Create bit mask
    (i32.xor
      ;; 8-bit LSB
      (i32.and (get_local $v) (i32.const 0xff))
      (i32.const 0xff)
    )
  )
  set_global $STA
)
