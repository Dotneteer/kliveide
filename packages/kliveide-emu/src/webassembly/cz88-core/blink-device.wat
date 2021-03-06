;; ============================================================================
;; Implements the Z88 blink device (Blink)

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
(global $COM (mut i32) (i32.const 0x0000))

;; EPR, Eprom Programming Register
(global $EPR (mut i32) (i32.const 0x0000))

;; ============================================================================
;; Blink methods

;; Resets main Blink registers
(func $resetBlink
  call $resetZ88Screen
  
  i32.const 0x00 set_global $COM

  call $resetRtc

  ;;BM_INTFLAP | BM_INTTIME | BM_INTGINT
  (call $setINT (i32.const 0x23))
  
  ;; BM_TMKTICK
  i32.const 0x01 set_global $TMK

  (call $setSTA (i32.const 0x00))
  i32.const 0x00 set_global $TSTA
)

;; Raises the battery low signal
(func $raiseBatteryLow
  (call $setSTA
    (i32.or (get_global $STA) (i32.const $BM_STABTL#))
  )
  call $awakeCpu
)

;; ============================================================================
;; Register setter functions

;; Set the value of INT
(func $setINT (param $v i32)
  (set_global $INT (get_local $v))
  call $isMaskableInterruptRequested
)

;; Sets the value of COM
(func $setCOM (param $v i32)
  (local $com i32)

  ;; Se tthe register value
  (i32.and (get_local $v) (i32.const 0xff))
  tee_local $com
  set_global $COM

  ;; Reset the timer when requested
  (i32.and (get_local $v) (i32.const $BM_COMRESTIM#))
  if
    call $resetRtc
  end

  ;; Set the last beeper bit 
  (i32.eqz (i32.and (get_local $v) (i32.const $BM_COMSRUN#)))
  if
    ;; Beeper bit
    (i32.and (get_local $v) (i32.const $BM_COMSBIT#))
    set_global $beeperLastEarBit
  end

  ;; RAMS flag may change, se emulate setting SR0 again
  (call $setSR0 (i32.load8_u offset=0 (get_global $Z88_SR)))
)

;; ============================================================================
;; Blink test methods

(func $testSetZ88INT (param $value i32)
  get_local $value set_global $INT
)

(func $testSetZ88STA (param $value i32)
  get_local $value set_global $STA
)

(func $testSetZ88COM (param $value i32)
  get_local $value set_global $COM
)
