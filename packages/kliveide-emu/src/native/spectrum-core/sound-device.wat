;; ============================================================================
;; Implements the ZX Spectrum PSG (AY-8912) device

;; ----------------------------------------------------------------------------
;; Sound device state

;; Sample rate of the PSG audio
(global $psgSampleRate (mut i32) (i32.const 0x0000))

;; Sample length (lower) in CPU clock tacts
(global $psgSampleLength (mut i32) (i32.const 0x0000))

;; Lower gate for sample length
(global $psgLowerGate (mut i32) (i32.const 0x0000))

;; Upper gate for sample length
(global $psgUpperGate (mut i32) (i32.const 0x0000))

;; Current PSG gate value
(global $psgGateValue (mut i32) (i32.const 0x0000))

;; Tact value of the last sample
(global $psgNextSampleTact (mut i32) (i32.const 0x0000))

;; Count of samples in this frame
(global $psgSampleCount (mut i32) (i32.const 0x0000))

;; The index of the last selected PSG register
(global $psgRegisterIndex (mut i32) (i32.const 0x0000))

;; ----------------------------------------------------------------------------
;; PSG Registers are stored in the $PSG_REGS memory area. Byte offsets:
;; Native form:
;; 0: R0: TONE A (lower 8 bits)
;; 1: R1: TONE A (upper 4 bits)
;; 2: R2: TONE B (lower 8 bits)
;; 3: R3: TONE B (upper 4 bits)
;; 4: R4: TONE C (lower 8 bits)
;; 5: R5: TONE C (upper 4 bits)
;; 6: R6: NOISE (lower 5 bits)
;; 7: R7: MIXER
;;    bit 0-bit 2: TONE Enable (A, B, C)
;;    bit 3-bit 5: NOISE Enable(A, B, C)
;; 8: R8: AMPLITUDE A
;;    bit 0-bit 3: Amplitude level
;;    bit 4: Amplitute mode
;; 9: R9: AMPLITUDE B
;;    bit 0-bit 3: Amplitude level
;;    bit 4: Amplitute mode
;; 10: R10: AMPLITUDE C
;;    bit 0-bit 3: Amplitude level
;;    bit 4: Amplitute mode
;; 11: R11: ENVELOPE period (lower 8 bits)
;; 12: R12: ENVELOPE period (upper 4 bits)
;; 13: R13: ENVELOPE shape (lower 4 bits)
;; 
;; Extracted form:
;; 16: TONE_A_EN (boolean)
;; 17: TONE_B_EN (boolean)
;; 18: TONE_C_EN (boolean)
;; 19: NOISE_A_EN (boolean)
;; 20: NOISE_B_EN (boolean)
;; 21: NOISE_C_EN (boolean)
;; 22: VOL_A (4 bits)
;; 23: VOL_B (4 bits)
;; 24: VOL_C (4 bits)
;; 25: ENV_A (boolean)
;; 26: ENV_B (boolean)
;; 27: ENV_C (boolean)
;; 28: ENV_FREQ (12 bits)
;; 29: ENV_SHAPE (4 bits)

;; ----------------------------------------------------------------------------
;; Sound device routines

;; Sets the specified sound sample rate
;; $rate: New sound sample rate
(func $setPsgSampleRate (param $rate i32)
  (local $sampleLength f32)
  get_local $rate set_global $psgSampleRate

  ;; Calculate the sample length
  (f32.div
    (f32.convert_u/i32 (i32.mul (get_global $baseClockFrequency) (get_global $clockMultiplier)))
    (f32.convert_u/i32 (get_local $rate))
  )
  tee_local $sampleLength
  i32.trunc_u/f32
  set_global $psgSampleLength

  ;; Calculate the gate values for the sample length
  (f32.mul 
    (f32.sub 
      (get_local $sampleLength) 
      (f32.convert_u/i32 (get_global $psgSampleLength))
    )
    (f32.const 100_000)
  )
  i32.trunc_u/f32
  set_global $psgLowerGate
  i32.const 100_000 set_global $psgUpperGate
)

;; Sets the index of the PSG register
(func $setPsgRegisterIndex (param $index i32)
  (i32.and (get_local $index) (i32.const 0x0f))
  set_global $psgRegisterIndex
)

;; Reads the value of the selected PSG reginster
(func $psgReadPsgRegisterValue (result i32)
  (i32.add
    (get_global $PSG_REGS)
    (i32.and (get_global $psgRegisterIndex) (i32.const 0x0f))
  )
  i32.load8_u
)

;; Writes the value of the selected PSG register
(func $psgWriteRegisterValue (param $v i32)
  ;; Write the native register values
  (i32.store8
    (i32.add (get_global $PSG_REGS) (get_global $psgRegisterIndex))
    (get_local $v)
  )

  ;; Write preprocessed register values
  ;; Check for TONE values
  (i32.lt_u (get_global $psgRegisterIndex) (i32.const 6))
  if
    ;; Lower 8-bit values are already stored
    (i32.and (get_global $psgRegisterIndex) (i32.const 1))
    if
      ;; Store upper 4-bit values
      (i32.add
        (get_global $PSG_REGS)
        (get_global $psgRegisterIndex)
      )
      (i32.and (get_local $v) (i32.const 0x0f))
      i32.store8
    end
    return
  end

  ;; Check for NOISE values
  (i32.lt_u (get_global $psgRegisterIndex) (i32.const 6))
  if
    (get_global $PSG_REGS)
    (i32.and (get_local $v) (i32.const 0x1f))
    i32.store8 offset=6
    return
  end

  ;; Check for mixer values
  (i32.lt_u (get_global $psgRegisterIndex) (i32.const 7))
  if
    (i32.store8 offset=16
      (get_global $PSG_REGS)
      (i32.and (get_local $v) (i32.const 0x01))
    )
    (i32.store8 offset=17
      (get_global $PSG_REGS)
      (i32.and (get_local $v) (i32.const 0x02))
    )
    (i32.store8 offset=18
      (get_global $PSG_REGS)
      (i32.and (get_local $v) (i32.const 0x04))
    )
    (i32.store8 offset=19
      (get_global $PSG_REGS)
      (i32.and (get_local $v) (i32.const 0x08))
    )
    (i32.store8 offset=20
      (get_global $PSG_REGS)
      (i32.and (get_local $v) (i32.const 0x10))
    )
    (i32.store8 offset=21
      (get_global $PSG_REGS)
      (i32.and (get_local $v) (i32.const 0x20))
    )
    return
  end

  ;; Check for volume values
  (i32.lt_u (get_global $psgRegisterIndex) (i32.const 8))
  if
    (i32.store8 offset=22
      (get_global $PSG_REGS)
      (i32.and (get_local $v) (i32.const 0x0f))
    )
    (i32.store8 offset=25
      (get_global $PSG_REGS)
      (i32.and (get_local $v) (i32.const 0x10))
    )
    return
  end
  (i32.lt_u (get_global $psgRegisterIndex) (i32.const 9))
  if
    (i32.store8 offset=23
      (get_global $PSG_REGS)
      (i32.and (get_local $v) (i32.const 0x0f))
    )
    (i32.store8 offset=26
      (get_global $PSG_REGS)
      (i32.and (get_local $v) (i32.const 0x10))
    )
    return
  end
  (i32.lt_u (get_global $psgRegisterIndex) (i32.const 10))
  if
    (i32.store8 offset=24
      (get_global $PSG_REGS)
      (i32.and (get_local $v) (i32.const 0x0f))
    )
    (i32.store8 offset=27
      (get_global $PSG_REGS)
      (i32.and (get_local $v) (i32.const 0x10))
    )
    return
  end

  ;; Check envelope frequency
  (i32.lt_u (get_global $psgRegisterIndex) (i32.const 12))
  if
    ;; Store upper 4 bits
    (i32.store8 offset=12
      (get_global $PSG_REGS)
      (i32.and (get_local $v) (i32.const 0x0f))
    )
    return
  end
  
  ;; Check envelope shape
  (i32.lt_u (get_global $psgRegisterIndex) (i32.const 12))
  if
    ;; Store lower 4 bits
    (i32.store8 offset=13
      (get_global $PSG_REGS)
      (i32.and (get_local $v) (i32.const 0x0f))
    )
    return
  end
)
