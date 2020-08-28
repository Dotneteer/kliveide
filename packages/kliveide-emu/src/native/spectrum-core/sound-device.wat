;; ============================================================================
;; Implements the ZX Spectrum PSG (AY-8912) device

;; ----------------------------------------------------------------------------
;; Sound device state
;; NOTE: The sound device shares all state variables related to sampling
;; with the beeper device, as these use the *same* sample rate.

;; Flag that indicates is the model supports PSG sound
(global $psgSupportsSound (mut i32) (i32.const 0x0000))

;; The index of the last selected PSG register
(global $psgRegisterIndex (mut i32) (i32.const 0x0000))

;; The number of ULA tacts that represent a single PSG clock tick
(global $psgCLockStep i32 (i32.const 16))

;; The value of the next ULA tact when a PSG output value should be 
;; generated
(global $psgNextClockTact (mut i32) (i32.const 0x0000))

;; Number of orphan PSG samples
(global $psgOrphanSamples (mut i32) (i32.const 0x0000))

;; Sum of orphan PSG sample values
(global $psgOrphanSum (mut i32) (i32.const 0x0000))

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

;; ----------------------------------------------------------------------------
;; PSG sound generation state

(global $psgToneA (mut i32) (i32.const 0x0000))
(global $psgToneAEnabled (mut i32) (i32.const 0x0000))
(global $psgNoiseAEnabled (mut i32) (i32.const 0x0000))
(global $psgVolA (mut i32) (i32.const 0x0000))
(global $psgEnvA (mut i32) (i32.const 0x0000))
(global $psgCntA (mut i32) (i32.const 0x0000))
(global $psgBitA (mut i32) (i32.const 0x0000))

(global $psgToneB (mut i32) (i32.const 0x0000))
(global $psgToneBEnabled (mut i32) (i32.const 0x0000))
(global $psgNoiseBEnabled (mut i32) (i32.const 0x0000))
(global $psgVolB (mut i32) (i32.const 0x0000))
(global $psgEnvB (mut i32) (i32.const 0x0000))
(global $psgCntB (mut i32) (i32.const 0x0000))
(global $psgBitB (mut i32) (i32.const 0x0000))

(global $psgToneC (mut i32) (i32.const 0x0000))
(global $psgToneCEnabled (mut i32) (i32.const 0x0000))
(global $psgNoiseCEnabled (mut i32) (i32.const 0x0000))
(global $psgVolC (mut i32) (i32.const 0x0000))
(global $psgEnvC (mut i32) (i32.const 0x0000))
(global $psgCntC (mut i32) (i32.const 0x0000))
(global $psgBitC (mut i32) (i32.const 0x0000))

(global $psgNoiseSeed (mut i32) (i32.const 0x0000))
(global $psgNoiseFreq (mut i32) (i32.const 0x0000))
(global $psgCtnNoise (mut i32) (i32.const 0x0000))
(global $psgBitNoise (mut i32) (i32.const 0x0000))

(global $psgEnvFreq (mut i32) (i32.const 0x0000))
(global $psgEnvStyle (mut i32) (i32.const 0x0000))
(global $psgCntEnv (mut i32) (i32.const 0x0000))
(global $psgPosEnv (mut i32) (i32.const 0x0000))

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
  ;; Just for the sake of safety
  (i32.and (get_local $v) (i32.const 0xff))
  set_local $v

  ;; Write the native register values
  (i32.store8
    (i32.add (get_global $PSG_REGS) (get_global $psgRegisterIndex))
    (get_local $v)
  )

  ;; Tone A (lower 8 bits)
  (i32.eqz (get_global $psgRegisterIndex))
  if
    (i32.or 
      (i32.and (get_global $psgToneA) (i32.const 0x0f00))
      (get_local $v)
    )
    set_global $psgToneA
    return
  end

  ;; Tone A (upper 4 bits)
  (i32.eq (get_global $psgRegisterIndex) (i32.const 1))
  if
    (i32.or 
      (i32.and (get_global $psgToneA) (i32.const 0x0ff))
      (i32.shl (i32.and (get_local $v) (i32.const 0x0f)) (i32.const 8))
    )
    set_global $psgToneA
    return
  end

  ;; Tone B (lower 8 bits)
  (i32.eq (get_global $psgRegisterIndex) (i32.const 2))
  if
    (i32.or 
      (i32.and (get_global $psgToneB) (i32.const 0x0f00))
      (get_local $v)
    )
    set_global $psgToneB
    return
  end

  ;; Tone B (upper 4 bits)
  (i32.eq (get_global $psgRegisterIndex) (i32.const 3))
  if
    (i32.or 
      (i32.and (get_global $psgToneB) (i32.const 0x0ff))
      (i32.shl (i32.and (get_local $v) (i32.const 0x0f)) (i32.const 8))
    )
    set_global $psgToneB
    return
  end

  ;; Tone C (lower 8 bits)
  (i32.eq (get_global $psgRegisterIndex) (i32.const 4))
  if
    (i32.or 
      (i32.and (get_global $psgToneC) (i32.const 0x0f00))
      (get_local $v)
    )
    set_global $psgToneC
    return
  end

  ;; Tone C (upper 4 bits)
  (i32.eq (get_global $psgRegisterIndex) (i32.const 5))
  if
    (i32.or 
      (i32.and (get_global $psgToneC) (i32.const 0x0ff))
      (i32.shl (i32.and (get_local $v) (i32.const 0x0f)) (i32.const 8))
    )
    set_global $psgToneC
    return
  end

  ;; Noise frequency
  (i32.eq (get_global $psgRegisterIndex) (i32.const 6))
  if
    (i32.mul 
      (i32.and (get_local $v) (i32.const 0x1f))
      (i32.const 2)
    )
    set_global $psgNoiseFreq
    return
  end

  ;; Mixer flags
  (i32.eq (get_global $psgRegisterIndex) (i32.const 7))
  if
    (i32.and (get_local $v) (i32.const 0x01))
    (i32.xor (i32.const 0x01))
    set_global $psgToneAEnabled

    (i32.and (get_local $v) (i32.const 0x02))
    (i32.xor (i32.const 0x02))
    (i32.shr_u (i32.const 1))
    set_global $psgToneBEnabled

    (i32.and (get_local $v) (i32.const 0x04))
    (i32.xor (i32.const 0x04))
    (i32.shr_u (i32.const 2))
    set_global $psgToneCEnabled

    (i32.and (get_local $v) (i32.const 0x08))
    (i32.xor (i32.const 0x08))
    (i32.shr_u (i32.const 3))
    set_global $psgNoiseAEnabled

    (i32.and (get_local $v) (i32.const 0x10))
    (i32.xor (i32.const 0x10))
    (i32.shr_u (i32.const 4))
    set_global $psgNoiseBEnabled

    (i32.and (get_local $v) (i32.const 0x20))
    (i32.xor (i32.const 0x20))
    (i32.shr_u (i32.const 5))
    set_global $psgNoiseCEnabled
    return
  end

  ;; Volume A
  (i32.eq (get_global $psgRegisterIndex) (i32.const 8))
  if
    (i32.and (get_local $v) (i32.const 0x0f))
    set_global $psgVolA
    (i32.and (get_local $v) (i32.const 0x10))
    set_global $psgEnvA
    return
  end

  ;; Volume B
  (i32.eq (get_global $psgRegisterIndex) (i32.const 9))
  if
    (i32.and (get_local $v) (i32.const 0x0f))
    set_global $psgVolB
    (i32.and (get_local $v) (i32.const 0x10))
    set_global $psgEnvB
    return
  end

  ;; Volume C
  (i32.eq (get_global $psgRegisterIndex) (i32.const 10))
  if
    (i32.and (get_local $v) (i32.const 0x0f))
    set_global $psgVolB
    (i32.and (get_local $v) (i32.const 0x10))
    set_global $psgEnvB
    return
  end

  ;; Envelope fequency (lower 8 bit)
  (i32.eq (get_global $psgRegisterIndex) (i32.const 11))
  if
    (i32.or 
      (i32.and (get_global $psgEnvFreq) (i32.const 0xff00))
      (get_local $v)
    )
    set_global $psgEnvFreq
    return
  end

  ;; Envelope frequency (upper 4 bits)
  (i32.eq (get_global $psgRegisterIndex) (i32.const 12))
  if
    (i32.or 
      (i32.and (get_global $psgEnvFreq) (i32.const 0x0ff))
      (i32.shl (get_local $v) (i32.const 8))
    )
    set_global $psgEnvFreq
    return
  end
  
  ;; Check envelope shape
  (i32.eq (get_global $psgRegisterIndex) (i32.const 13))
  if
    ;; Store lower 4 bits
    (i32.and (get_local $v) (i32.const 0x0f))
    set_global $psgEnvStyle
    i32.const 0 set_global $psgPosEnv
    i32.const 0 set_global $psgCntEnv
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
      select
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
                (i32.gt_s (get_local $dir) (i32.const 0))
                select
                set_local $vol

                ;; Hold is set?
                (i32.and (get_local $env) (i32.const 0x01))
                if
                  ;; Hold, and set up next volume
                  i32.const 1 set_local $hold
                  i32.const 31
                  i32.const 0
                  (i32.gt_s (get_local $dir) (i32.const 0))
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

;; Generates a PSG output value
(func $generatePsgOutputValue
  (local $tmp i32)
  (local $vol i32)

  i32.const 0 set_local $vol
  
  ;; Increment TONE A counter
  (i32.add  (get_global $psgCntA) (i32.const 1))
  tee_local $tmp
  set_global $psgCntA

  ;; CNT_A >= TONE A?
  (i32.ge_u (get_local $tmp) (get_global $psgToneA))
  if
    ;; Reset counter and reverse output bit
    i32.const 0 set_global $psgCntA
    (i32.xor (get_global $psgBitA) (i32.const 0x01))
    set_global $psgBitA
  end

  ;; Calculate noise sample
  (i32.add (get_global $psgCtnNoise) (i32.const 1))
  set_global $psgCtnNoise
  (i32.ge_u (get_global $psgCtnNoise) (get_global $psgNoiseFreq))
  if
    ;; It is time to generate the next noise sample
    i32.const 0 set_global $psgCtnNoise
    (i32.add 
      (i32.mul (i32.const 2) (get_global $psgNoiseSeed)) 
      (i32.const 1)
    )                                                      ;; [ seed * 2 + 1 ]
    (i32.shr_u (get_global $psgNoiseSeed) (i32.const 16))  ;; [ seed * 2 + 1, seed >> 16 ]
    (i32.shr_u (get_global $psgNoiseSeed) (i32.const 13))  ;; [ seed * 2 + 1, seed >> 16, seed >> 13 ]
    i32.xor
    (i32.and (i32.const 0x01))
    i32.xor
    set_global $psgNoiseSeed ;; New noise seed

    (i32.and (i32.shr_u (get_global $psgNoiseSeed) (i32.const 16)) (i32.const 0x01))
    set_global $psgBitNoise
  end

  ;; Calculate envelope position
  (i32.add (get_global $psgCntEnv) (i32.const 1))
  set_global $psgCntEnv
  (i32.ge_u (get_global $psgCntEnv) (get_global $psgEnvFreq))
  if
    ;; Move to the new position
    i32.const 0 set_global $psgCntEnv
    (i32.add (get_global $psgPosEnv) (i32.const 1))
    set_global $psgPosEnv
    (i32.gt_u (get_global $psgPosEnv) (i32.const 0x7f))
    if
      i32.const 0x40 set_global $psgPosEnv
    end
  end

  ;; Add the volume value
  (i32.or
    (i32.and (get_global $psgBitA) (get_global $psgToneAEnabled))
    (i32.and (get_global $psgBitNoise) (get_global $psgNoiseAEnabled))
  )
  if
    get_global $psgEnvA
    if (result i32)
      (i32.add
        (i32.add 
          (get_global $PSG_ENVELOP_TABLE)
          (i32.mul (i32.const 128) (get_global $psgEnvStyle))
        )
        (get_global $psgPosEnv)
      )
      i32.load8_u
    else
      (i32.mul (i32.const 2) (get_global $psgVolA))
    end
    (i32.add (get_local $vol))
    set_local $vol
  end

  (i32.add (get_local $vol) (get_global $psgOrphanSum))
  set_global $psgOrphanSum

  ;; Increment the number of orphan samples
  (i32.add (get_global $psgOrphanSamples) (i32.const 1))
  set_global $psgOrphanSamples
)