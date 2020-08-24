;; ============================================================================
;; Implements the ZX Spectrum PSG (AY-8912) device

;; ----------------------------------------------------------------------------
;; Sound device state

;; Flag that indicates is the model supports PSG sound
(global $psgSupportsSound (mut i32) (i32.const 0x0000))

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

;; The clock frequency of the PSG chip
(global $psgClockFrequency (mut i32) (i32.const 0x0000))

;; The previous PSG chip tact used for calculation
(global $psgPreviousTact (mut i64) (i64.const 0x0000))

;; The noise seed value
(global $psgNoiseSeed (mut i32) (i32.const 0x0000))

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

;; Initializes the PSG envelop tables
(func $initEnvelopeTables
  (local $env i32)
  (local $pos i32)
  (local $hold i32)
  (local $dir i32)
  (local $vol i32)
  (local $samplePtr i32)

  ;; Reset the sample pointer
  get_global $PSG_ENVELOP_TABLE set_local $samplePtr

  ;; Iterate through envelopes
  i32.const 0 set_local $env
  loop $envLoop
    (i32.lt_u (get_local $env) (i32.const 16))
    if
      ;; Reset $hold
      i32.const 0 set_local $hold

      ;; Set $dir according to $env
      i32.const 1
      i32.const -1
      (i32.and (get_local $env) (i32.const 4))
      select
      set_local $dir

      ;; Set vol according to $env
      i32.const -1
      i32.const 0x20
      (i32.and (get_local $env) (i32.const 4))
      set_local $vol
      
      ;; Iterate through envelope positions
      i32.const 0 set_local $pos
      loop $posLoop
        (i32.lt_u (get_local $pos) (i32.const 128))
        if
          ;; Is $hold 0?
          (i32.eqz (get_local $hold))
          if
            ;; $vol += $dir
            (i32.add (get_local $vol) (get_local $dir))
            set_local $vol

            ;; Is $vol < 0 or $vol >= 32?
            (i32.lt_s (get_local $vol) (i32.const 0))
            (i32.ge_s (get_local $vol) (i32.const 32))
            i32.or
            if
              ;; Continue is set?
              (i32.and (get_local $env) (i32.const 0x08))
              if
                ;; Yes. continue.
                ;; If alternate is set, reverse the direction
                (i32.and (get_local $env) (i32.const 0x02))
                if
                  (i32.sub (i32.const 0) (get_local $dir))
                  set_local $dir
                end

                ;; Set start volume according to direction
                i32.const 0
                i32.const 31
                (i32.gt_u (get_local $dir) (i32.const 0))
                select
                set_local $vol

                ;; Hold is set?
                (i32.and (get_local $env) (i32.const 1))
                if
                  ;; Hold, and set up next volume
                  i32.const 1 set_local $hold
                  i32.const 31
                  i32.const 0
                  (i32.gt_u (get_local $dir) (i32.const 0))
                  select
                  set_local $vol
                end
              else
                ;; Mute and hold this value
                i32.const 0 set_local $vol
                i32.const 1 set_local $hold
              end
            end
          end

          ;; Store the envelop sample
          (i32.store8 (get_local $samplePtr) (get_local $vol))

          ;; Move the pointer to the next sample
          (i32.add (get_local $samplePtr) (i32.const 1))
          set_local $samplePtr

          ;; Increment inner loop counter
          (i32.add (get_local $pos) (i32.const 1))
          set_local $pos
          br $posLoop
        end
      end

      ;; Increment outer loop counter
      (i32.add (get_local $env) (i32.const 1))
      set_local $env
      br $envLoop
    end
  end
)

;; Creates PSG sound samples
(func $createPsgSoundSamples
  (local $psgTact i64)
  (local $tone_A i32)
  (local $tone_B i32)
  (local $tone_C i32)
  loop $psgLoop
    (i32.le_u (get_global $psgNextSampleTact) (get_global $tacts))
    if
      ;; Calculate PSG tact (64 bit)
      (i64.add
        (i64.mul 
          (i64.extend_u/i32 (get_global $frameCount))
          (i64.extend_u/i32 (get_global $tactsInFrame))
        )
        (i64.extend_u/i32 (get_global $tacts))
      )
      (i64.shl (i64.const 5))
      set_local $psgTact

      ;; ;; Calc TONE A bit
      ;; (i64.div_u 
      ;;   (get_local $psgTact) 
      ;;   (i64.extend_u/i32 (i32.load16_u offset=0 (get_global $PSG_REGS)))
      ;; )
      ;; (i64.and (i64.const 0x01))
      ;; (i32.wrap/i64)
      ;; set_local $tone_A

      ;; ;; Calc TONE B bit
      ;; (i64.div_u 
      ;;   (get_local $psgTact) 
      ;;   (i64.extend_u/i32 (i32.load16_u offset=2 (get_global $PSG_REGS)))
      ;; )
      ;; (i64.and (i64.const 0x01))
      ;; (i32.wrap/i64)
      ;; set_local $tone_B

      ;; ;; Calc TONE C bit
      ;; (i64.div_u 
      ;;   (get_local $psgTact) 
      ;;   (i64.extend_u/i32 (i32.load16_u offset=4 (get_global $PSG_REGS)))
      ;; )
      ;; (i64.and (i64.const 0x01))
      ;; (i32.wrap/i64)
      ;; set_local $tone_C

      ;; Note the last calculation tact
      get_local $psgTact set_global $psgPreviousTact

      ;; Store the next sample
      (i32.add (get_global $PSG_SAMPLE_BUFFER) (get_global $psgSampleCount))

      ;; TODO: Use the sample bit to store
      i32.const 0
      i32.store8 

      ;; Adjust sample count
      (i32.add (get_global $psgSampleCount) (i32.const 1))
      set_global $psgSampleCount

      ;; Calculate the next sound sample tact
      (i32.add (get_global $psgGateValue) (get_global $psgLowerGate))
      set_global $psgGateValue
      (i32.add (get_global $psgNextSampleTact) (get_global $psgSampleLength))
      set_global $psgNextSampleTact

      (i32.ge_u (get_global $psgGateValue) (get_global $psgUpperGate))
      if
        ;; Shift the next sample 
        (i32.add (get_global $psgNextSampleTact) (i32.const 1))
        set_global $psgNextSampleTact

        (i32.sub (get_global $psgGateValue) (get_global $psgUpperGate))
        set_global $psgGateValue
      end
      br $psgLoop
    end
  end
)
