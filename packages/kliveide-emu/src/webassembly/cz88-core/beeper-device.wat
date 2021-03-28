;; ============================================================================
;; Implements the Cambridge Z88 beeper device

;; ----------------------------------------------------------------------------
;; Beeper constants
;; $GATE_DIVIDER# = 100000

;; ----------------------------------------------------------------------------
;; Beeper device state

;; Sample rate of the beeper audio
(global $audioSampleRate (mut i32) (i32.const 0x0000))

;; Sample length (lower) in CPU clock tacts
(global $audioSampleLength (mut i32) (i32.const 0x0000))

;; Lower gate for sample length
(global $audioLowerGate (mut i32) (i32.const 0x0000))

;; Upper gate for sample length
(global $audioUpperGate (mut i32) (i32.const 0x0000))

;; Current beeper gate value
(global $audioGateValue (mut i32) (i32.const 0x0000))

;; Tact value of the last sample
(global $audioNextSampleTact (mut i32) (i32.const 0x0000))

;; Count of samples in this frame
(global $audioSampleCount (mut i32) (i32.const 0x0000))

;; Last EAR bit value
(global $beeperLastEarBit (mut i32) (i32.const 0x0000))

;; Oscillator bit value (3200 Hz)
(global $oscillatorBit (mut i32) (i32.const 0x0000))

;; ----------------------------------------------------------------------------
;; Beeper device routines

;; Sets the specified beeper sample rate
;; $rate: New beeper sample rate
(func $setBeeperSampleRate (param $rate i32)
  (local $sampleLength f32)

  ;; Yes, update counters to the new sample rate
  (set_global $audioSampleRate (get_local $rate))

  ;; Calculate the sample length
  (f32.div
    (f32.convert_u/i32 (i32.mul (get_global $baseClockFrequency) (get_global $clockMultiplier)))
    (f32.convert_u/i32 (get_local $rate))
  )
  tee_local $sampleLength
  i32.trunc_u/f32
  set_global $audioSampleLength

  ;; Calculate the gate values for the sample length
  (f32.mul 
    (f32.sub 
      (get_local $sampleLength) 
      (f32.convert_u/i32 (get_global $audioSampleLength))
    )
    (f32.const $GATE_DIVIDER#)
  )
  i32.trunc_u/f32
  set_global $audioLowerGate
  i32.const $GATE_DIVIDER# set_global $audioUpperGate
)

;; Calculate the oscillator bit
(func $calculateOscillatorBit
  ;; Calculate the tick count
  (i64.add
    (i64.mul
      (i64.extend_u/i32 (get_global $frameCount))
      (i64.extend_u/i32 (get_global $tactsInFrame))
    )
    (i64.extend_u/i32 (get_global $tacts))
  )

  ;; This many clock cycles in a half oscillator period
  (i32.div_u
    (i32.mul (get_global $baseClockFrequency) (get_global $clockMultiplier))
    (i32.const 6400)
  )
  i64.extend_u/i32
  i64.div_u

  ;; Set the oscillator bit
  (i64.and (i64.const 1))
  i32.wrap/i64
  set_global $oscillatorBit
)