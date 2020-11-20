;; ============================================================================
;; Implements the Z88 blink device (Blink)

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
(global $z88INT (mut i32) (i32.const 0x0000))

;; Main Blink Interrupt Status (STA)
;;
;; $BM_STAFLAPOPEN# = 0x80  // Bit 7, If set, flap open, else flap closed
;; $BM_STAA19# = 0x40       // Bit 6, If set, high level on A19 occurred during coma
;; $BM_STAFLAP# = 0x20      // Bit 5, If set, positive edge has occurred on FLAPOPEN
;; $BM_STAUART# = 0x10      // Bit 4, If set, an enabled UART interrupt is active
;; $BM_STABTL# = 0x08       // Bit 3, If set, battery low pin is active
;; $BM_STAKEY# = 0x04       // Bit 2, If set, a column has gone low in snooze (or coma)
;; $BM_STATIME# = 0x01      // Bit 0, If set, an enabled TSTA interrupt is active
(global $z88STA (mut i32) (i32.const 0x0000))

;; BLINK Command Register
;;
;; $BM_COMSRUN# = 0x80    // Bit 7, SRUN
;; $BM_COMSBIT# = 0x40    // Bit 6, SBIT
;; $BM_COMOVERP# = 0x20   // Bit 5, OVERP
;; $BM_COMRESTIM# = 0x10  // Bit 4, RESTIM
;; $BM_COMPROGRAM# = 0x08 // Bit 3, PROGRAM
;; $BM_COMRAMS# = 0x04    // Bit 2, RAMS
;; $BM_COMVPPON# = 0x02   // Bit 1, VPPON
;; $BM_COMLCDON# = 0x01   // Bit 0, LCDON
(global $z88COM (mut i32) (i32.const 0x0000))

;; EPR, Eprom Programming Register
(global $z88EPR (mut i32) (i32.const 0x0000))

;; TACK, Set Timer Interrupt Acknowledge
(global $z88TACK (mut i32) (i32.const 0x0000))

;; ACK, Acknowledge INT Interrupts
(global $z88ACK (mut i32) (i32.const 0x0000))

;; ============================================================================
;; Blink methods

;; Resets main Blink registers
(func $resetZ88Blink
  i32.const 0x00 set_global $z88INT
  i32.const 0x00 set_global $z88STA
  i32.const 0x00 set_global $z88COM
)

;; ============================================================================
;; Blink test methods

(func $testSetZ88INT (param $value i32)
  get_local $value set_global $z88INT
)

(func $testSetZ88STA (param $value i32)
  get_local $value set_global $z88STA
)

(func $testSetZ88COM (param $value i32)
  get_local $value set_global $z88COM
)
