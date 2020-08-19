;; ============================================================================
;; Implements the ZX Spectrum beeper device

;; ----------------------------------------------------------------------------
;; Beeper device state

;; Sample rate of the beeper audio
(global $beeperSampleRate (mut i32) (i32.const 0x0000))

;; Sample length (lower) in CPU clock tacts
(global $beeperSampleLength (mut i32) (i32.const 0x0000))

;; Lower gate for sample length
(global $beeperLowerGate (mut i32) (i32.const 0x0000))

;; Upper gate for sample length
(global $beeperUpperGate (mut i32) (i32.const 0x0000))

;; Current beeper gate value
(global $beeperGateValue (mut i32) (i32.const 0x0000))

;; Tact value of the last sample
(global $beeperNextSampleTact (mut i32) (i32.const 0x0000))

;; Last EAR bit value
(global $beeperLastEarBit (mut i32) (i32.const 0x0000))

;; Count of samples in this frame
(global $beeperSampleCount (mut i32) (i32.const 0x0000))

;; ----------------------------------------------------------------------------
;; Beeper device routines

;; Sets the specified beeper sample rate
;; $rate: New beeper sample rate
(func $setBeeperSampleRate (param $rate i32)
  (local $sampleLength f32)
  get_local $rate set_global $beeperSampleRate

  ;; Calculate the sample length
  (f32.div
    (f32.convert_u/i32 (i32.mul (get_global $baseClockFrequency) (get_global $clockMultiplier)))
    (f32.convert_u/i32 (get_local $rate))
  )
  tee_local $sampleLength
  i32.trunc_u/f32
  set_global $beeperSampleLength

  ;; Calculate the gate values for the sample length
  (f32.mul 
    (f32.sub 
      (get_local $sampleLength) 
      (f32.convert_u/i32 (get_global $beeperSampleLength))
    )
    (f32.const 100_000)
  )
  i32.trunc_u/f32
  set_global $beeperLowerGate
  i32.const 100_000 set_global $beeperUpperGate
)

;; This function processes the EAR bit (beeper device)
(func $processEarBit (param $earBit i32)
  call $createEarBitSamples
  get_local $earBit set_global $beeperLastEarBit
)

;; Creates EAR bit samples until the current CPU tact
(func $createEarBitSamples
  loop $earBitLoop
    (i32.le_u (get_global $beeperNextSampleTact) (get_global $tacts))
    if
      ;; Store the next sample
      (i32.add (get_global $BEEPER_SAMPLE_BUFFER) (get_global $beeperSampleCount))
      i32.const 1
      i32.const 0
      get_global $beeperLastEarBit
      select
      i32.store8 

      ;; Adjust sample count
      (i32.add (get_global $beeperSampleCount) (i32.const 1))
      set_global $beeperSampleCount

      ;; Calculate the next beeper sample tact
      (i32.add (get_global $beeperGateValue) (get_global $beeperLowerGate))
      set_global $beeperGateValue
      (i32.add (get_global $beeperNextSampleTact) (get_global $beeperSampleLength))
      set_global $beeperNextSampleTact

      (i32.ge_u (get_global $beeperGateValue) (get_global $beeperUpperGate))
      if
        ;; Shift the next sample 
        (i32.add (get_global $beeperNextSampleTact) (i32.const 1))
        set_global $beeperNextSampleTact

        (i32.sub (get_global $beeperGateValue) (get_global $beeperUpperGate))
        set_global $beeperGateValue
      end
      br $earBitLoop
    end
  end
)
