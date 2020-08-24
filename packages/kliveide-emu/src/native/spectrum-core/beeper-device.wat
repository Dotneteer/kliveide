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
  get_local $earBit set_global $beeperLastEarBit
)
