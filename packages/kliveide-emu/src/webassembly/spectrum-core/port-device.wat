;; ==========================================================================
;; Implements the ZX Spectrum core port device

;; --------------------------------------------------------------------------
;; Port device state

;; Last value of bit 3 on port $FE
(global $portBit3LastValue (mut i32) (i32.const 0x0000))

;; Last value of bit 4 on port $FE
(global $portBit4LastValue (mut i32) (i32.const 0x0000))

;; Tacts value when last time bit 4 of $fe changed from 0 to 1
(global $portBit4ChangedFrom0Tacts (mut i32) (i32.const 0x0000))

;; Tacts value when last time bit 4 of $fe changed from 1 to 0
(global $portBit4ChangedFrom1Tacts (mut i32) (i32.const 0x0000))

;; --------------------------------------------------------------------------
;; Generic I/O device routines

;; Applies memory contention delay according to the current
;; screen rendering tact
(func $applyContentionDelay
  (local $delay i32)
  (i32.add
    (get_global $CONTENTION_TABLE) 
    (i32.div_u (get_global $tacts) (get_global $clockMultiplier))
  )
  i32.load8_u
  tee_local $delay
  call $incTacts

  (i32.add (get_global $contentionAccummulated) (get_local $delay))
  set_global $contentionAccummulated
)

;; Applies I/O contention wait
;; $addr: port address
(func $applyIOContentionDelay (param $addr i32)
  (local $lowbit i32)

  ;; Calculate the low bit value
  (i32.and (get_local $addr) (i32.const 0x0001))
  set_local $lowbit

  ;; Check for contended range
  (i32.eq
    (i32.and (get_local $addr) (i32.const 0xc000))
    (i32.const 0x4000)
  )
  if
    ;; Contended address
    get_local $lowbit
    if
      ;; Low bit set, C:1, C:1, C:1, C:1 
      call $applyContentionDelay
      (call $incTacts (i32.const 1))
      call $applyContentionDelay
      (call $incTacts (i32.const 1))
      call $applyContentionDelay
      (call $incTacts (i32.const 1))
      call $applyContentionDelay
      (call $incTacts (i32.const 1))
    else
      ;; Low bit reset, C:1, C:3
      call $applyContentionDelay
      (call $incTacts (i32.const 1))
      call $applyContentionDelay
      (call $incTacts (i32.const 3))
    end
  else
    ;; Non-contended address
    get_local $lowbit
    if
      ;; Low bit set, N:4
      (call $incTacts (i32.const 4))
    else
      ;; Low bit reset, N:1, C:3
      (call $incTacts (i32.const 1))
      call $applyContentionDelay
      (call $incTacts (i32.const 3))
    end
  end
)

;; Reads information from the 0xfe port
(func $readPort$FE (param $addr i32) (result i32)
  (local $portValue i32)
  (local $bit4Sensed i32)
  (local $chargeTime i32)
  (local $bit6Value i32)
  (local $earBit i32)

  ;; Scan keyboard line status
  (call $getKeyLineStatus (i32.shr_u (get_local $addr) (i32.const 8)))
  set_local $portValue

  ;; Check for LOAD mode
  (i32.eq (get_global $tapeMode) (i32.const 1))
  if (result i32)
    (i32.and (get_local $portValue) (i32.const 0xbf))
    call $getTapeEarBit tee_local $earBit
    (i32.shl (i32.const 4))
    set_global $beeperLastEarBit
    (i32.shl (get_local $earBit) (i32.const 6))
    i32.or
  else
    ;; Handle analog EAR bit
    get_global $portBit4LastValue
    (i32.eq (tee_local $bit4Sensed) (i32.const 0))
    if
      ;; Changed later to 1 from 0 than to 0 from 1?
      (i32.sub (get_global $portBit4ChangedFrom1Tacts) (get_global $portBit4ChangedFrom0Tacts))
      (i32.gt_s (tee_local $chargeTime) (i32.const 0))
      if 
        ;; Yes, calculate charge time
        (i32.gt_u (get_local $chargeTime) (i32.const 700))
        if (result i32)
          i32.const 2800
        else
          (i32.mul (i32.const 4) (get_local $chargeTime))
        end
        set_local $chargeTime

        ;; Calculate time ellapsed since last change from 1 to 0
        (i32.sub (get_global $tacts) (get_global $portBit4ChangedFrom1Tacts))
        ;; Less than charge time?
        (i32.lt_u (get_local $chargeTime))
        i32.const 4
        i32.shl
        set_local $bit4Sensed
      end
    end

    ;; Calculate bit 6 value
    get_global $portBit3LastValue
    if (result i32)
      i32.const 0x40
    else
      i32.const 0x40
      i32.const 0x00
      get_local $bit4Sensed
      select
    end
    set_local $bit6Value

    ;; Check for ULA 3
    (i32.eq (get_global $ulaIssue) (i32.const 3))
    if
      get_global $portBit3LastValue
      if
        (i32.eq (get_local $bit4Sensed) (i32.const 0))
        if
        i32.const 0
        set_local $bit6Value
        end
      end
    end

    ;; Merge bit 6 with port value
    (i32.and (get_local $portValue) (i32.const 0xbf))
    get_local $bit6Value
    i32.or
  end
)

;; Writes information to the 0xfe port
(func $writePort$FE (param $addr i32) (param $v i32)
  (local $bit4 i32)

  ;; Extract border color
  (i32.and (get_local $v) (i32.const 0x07))
  set_global $borderColor

  ;; Let's store the last EAR bit
  (i32.and (get_local $v) (i32.const 0x10))
  tee_local $bit4
  set_global $beeperLastEarBit

  ;; Set the last value of bit3
  (i32.and (get_local $v) (i32.const 0x08))
  set_global $portBit3LastValue

  ;; Have the tape device process the MIC bit
  (call $processMicBit (get_global $portBit3LastValue))

  ;; Manage bit 4 value
  get_global $portBit4LastValue
  if
    ;; Bit 4 was 1, is it now 0?
    (i32.eq (get_local $bit4) (i32.const 0))
    if
      get_global $tacts set_global $portBit4ChangedFrom1Tacts
      i32.const 0 set_global $portBit4LastValue
    end
  else
    ;; Bit 4 was 0, is it now 1?
    get_local $bit4
    if
      get_global $tacts set_global $portBit4ChangedFrom0Tacts
      i32.const 0x10 set_global $portBit4LastValue
    end
  end
)
