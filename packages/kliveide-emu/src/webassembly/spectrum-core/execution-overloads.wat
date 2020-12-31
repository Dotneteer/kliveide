;; ============================================================================
;; Implementation of the ZX Spectrum execution engine

;; ----------------------------------------------------------------------------
;; ZX Spectrum engine configuration

;; Number of ROMs
(global $numberOfRoms (mut i32) (i32.const 0x0000))

;; The address in memory where the machine's ROM contents start
(global $romContentsAddress (mut i32) (i32.const 0x0000))

;; The index of the ROM with ZX Spectrum 48 code
(global $spectrum48RomIndex (mut i32) (i32.const 0x0000))

;; Contention type of memory
;; 0: No contention
;; 1: ULA
;; 2: GateArray
;; 3: ZX Spectrum Next
(global $contentionType (mut i32) (i32.const 0x0000))

;; Number of RAM banks
(global $ramBanks (mut i32) (i32.const 0x0000))

;; Size of Next memory in KBytes
;; 0 - Legacy models that do not support Next memory mapping
;; 512 - 512KBytes
;; 1024 - 1024 KBytes
;; 1536 - 1.5MBytes
;; 2048 - 2 MBytes
(global $nextMemorySize (mut i32) (i32.const 0x0000))

;; The tact index of the interrupt relative to the top-left screen pixel
(global $interruptTact (mut i32) (i32.const 0x0000))

;; Number of lines used for vertical sync
(global $verticalSyncLines (mut i32) (i32.const 0x0000))

;; The number of top border lines that are not visible when rendering the screen
(global $nonVisibleBorderTopLines (mut i32) (i32.const 0x0000))

;; The number of border lines before the display
(global $borderTopLines (mut i32) (i32.const 0x0000))

;; Number of display lines
(global $displayLines (mut i32) (i32.const 0x0000))

;; The number of border lines after the display
(global $borderBottomLines (mut i32) (i32.const 0x0000))

;; The number of bottom border lines that are not visible when rendering the screen
(global $nonVisibleBorderBottomLines (mut i32) (i32.const 0x0000))

;; Horizontal blanking time (HSync+blanking). Given in Z80 clock cycles.
(global $horizontalBlankingTime (mut i32) (i32.const 0x0000))

;; The time of displaying left part of the border. Given in Z80 clock cycles.
(global $borderLeftTime (mut i32) (i32.const 0x0000))

;; The time of displaying a pixel row. Given in Z80 clock cycles.
(global $displayLineTime (mut i32) (i32.const 0x0000))

;; The time of displaying right part of the border. Given in Z80 clock cycles.
(global $borderRightTime (mut i32) (i32.const 0x0000))

;; The time used to render the nonvisible right part of the border. Given in Z80 clock cycles.
(global $nonVisibleBorderRightTime (mut i32) (i32.const 0x0000))

;; The time the data of a particular pixel should be prefetched before displaying it.
;; Given in Z80 clock cycles.
(global $pixelDataPrefetchTime (mut i32) (i32.const 0x0000))

;; The time the data of a particular pixel attribute should be prefetched before displaying it.
;; Given in Z80 clock cycles.
(global $attributeDataPrefetchTime (mut i32) (i32.const 0x0000))

;; First visible display line
(global $firstDisplayLine (mut i32) (i32.const 0x0000))

;; Last visible display line
(global $lastDisplayLine (mut i32) (i32.const 0x0000))

;; Number of pixels in the left border
(global $borderLeftPixels (mut i32) (i32.const 0x0000))

;; Number of pixels in the right border
(global $borderRightPixels (mut i32) (i32.const 0x0000))

;; Width of display in pixels
(global $displayWidth (mut i32) (i32.const 0x0000))

;; Total time of a screen line
(global $screenLineTime (mut i32) (i32.const 0x0000))

;; Total number of raster lines (including the non-visible ones)
(global $rasterLines (mut i32) (i32.const 0x0000))

;; The tact in which the top left pixel should be displayed. Given in Z80 clock cycles.
(global $firstDisplayPixelTact (mut i32) (i32.const 0x0000))

;; The tact at which the first pixel is displayed
(global $firstScreenPixelTact (mut i32) (i32.const 0x0000))

;; ----------------------------------------------------------------------------
;; ZX Spectrum execution engine state

;; The ULA issue of the engine
(global $ulaIssue (mut i32) (i32.const 0x0000))

;; ----------------------------------------------------------------------------
;; Public functions to manage a ZX Spectrum machine

;; Resets the ZX Spectrum machine
(func $resetSpectrumMachine

  ;; Reset engine state variables
  i32.const 0 set_global $lastRenderedFrameTact
  i32.const 0 set_global $frameCount
  i32.const 0 set_global $tacts
  i32.const 1 set_global $frameCompleted
  i32.const 0 set_global $contentionAccummulated
  i32.const 0 set_global $lastExecutionContentionValue
  i32.const $EMU_CONT# set_global $emulationMode
  i32.const $DEB_NONE# set_global $debugStepMode
  i32.const 0 set_global $fastTapeMode
  i32.const -1 set_global $terminationRom
  i32.const -1 set_global $terminationPoint
  i32.const 0 set_global $fastVmMode
  i32.const 0 set_global $disableScreenRendering
  i32.const $EX_REA_EXEC# set_global $executionCompletionReason
  i32.const 0 set_global $stepOverBreakpoint

  ;; Reset keyboard line status
  (i32.store offset=0 (get_global $KEYBOARD_LINES) (i32.const 0))
  (i32.store offset=4 (get_global $KEYBOARD_LINES) (i32.const 0))

  ;; Reset memory state
  i32.const 0 set_global $memorySelectedRom
  i32.const 1 set_global $memoryPagingEnabled
  i32.const 0 set_global $memorySelectedBank
  i32.const 0 set_global $memoryUseShadowScreen

  ;; Reset port state
  i32.const 0 set_global $portBit3LastValue
  i32.const 0 set_global $portBit4LastValue
  i32.const 0 set_global $portBit4ChangedFrom0Tacts
  i32.const 0 set_global $portBit4ChangedFrom1Tacts

  ;; Reset interrupt state
  i32.const 0 set_global $interruptRaised
  i32.const 0 set_global $interruptRevoked

  ;; Reset beeper state
  i32.const 0 set_global $audioGateValue
  i32.const 0 set_global $audioNextSampleTact
  i32.const 0 set_global $beeperLastEarBit

  ;; Reset PSG state
  get_global $psgClockStep set_global $psgNextClockTact

  (i32.store offset=0 (get_global $PSG_REGS) (i32.const 0))
  (i32.store offset=4 (get_global $PSG_REGS) (i32.const 0))
  (i32.store offset=8 (get_global $PSG_REGS) (i32.const 0))
  (i32.store offset=12 (get_global $PSG_REGS) (i32.const 0))
  i32.const 0xffff set_global $psgNoiseSeed

  ;; Reset tape state
  i32.const 0 set_global $tapeMode
  i32.const 0 set_global $tapeBlocksToPlay
  i32.const 1 set_global $tapeEof
  get_global $TAPE_DATA_BUFFER set_global $tapeBufferPtr
  get_global $TAPE_DATA_BUFFER set_global $tapeNextBlockPtr
  i32.const 0 set_global $tapePlayPhase
  i64.const 0 set_global $tapeStartTact

  ;; Reset debugging state
  i32.const 0 set_global $stepOutStackDepth
)

;; Sets the ULA issue to use
(func $setUlaIssue (param $ula i32)
  i32.const 0x02
  i32.const 0x03
  (i32.eq (get_local $ula) (i32.const 2))
  select
  set_global $ulaIssue
)

;; Should CPU clock change be allowed?
(func $allowCpuClockChange (result i32)
  (i32.eqz (get_global $tapeMode))
)


;; The execution engine starts a new frame
(func $onInitNewFrame (param $oldClockMultiplier i32)
  (local $overflow i32)

  ;; Reset interrupt information
  i32.const 0 set_global $interruptRevoked
  i32.const 0 set_global $interruptRaised

  ;; Reset pointers used for screen rendering
  (set_local $overflow (get_global $lastRenderedFrameTact))
  (set_global $renderingTablePtr (get_global $RENDERING_TACT_TABLE))
  (set_global $pixelBufferPtr (get_global $PIXEL_RENDERING_BUFFER))
  i32.const 0 set_global $frameCompleted

  (call $renderScreen (get_local $overflow))

  ;; Calculate flash phase
  (i32.rem_u (get_global $frameCount) (get_global $flashFrames))
  i32.eqz
  if
    (i32.xor (get_global $flashPhase) (i32.const 0x01))
    set_global $flashPhase
  end

  ;; Reset beeper frame state
  (i32.ne (get_local $oldClockMultiplier) (get_global $clockMultiplier))
  if
    (call $setBeeperSampleRate (get_global $audioSampleRate))
  end 
  i32.const 0 set_global $audioSampleCount
)

;; The execution engine is about to execute a CPU cycle
(func $beforeCpuCycle (param $frameTact i32)
  (call $checkForInterrupt (get_local $frameTact))
)

;; The execution engine is about to execute a CPU cycle
(func $afterCpuCycle (param $frameTact i32)
  call $preparePsgSamples
)

;; The execution engine is before checking loop termination
(func $beforeTerminationCheck  (param $frameTact i32)
  (call $renderScreen (get_local $frameTact))
)

;; Tests if the execution cycle reached the termination point
(func $testIfTerminationPointReached (result i32)
  (i32.eq (get_global $memorySelectedRom) (get_global $terminationRom))
  if
    ;; Termination ROM matches
    (i32.eq (get_global $PC) (get_global $terminationPoint)) 
    return
  end
  i32.const 0
)

;; The execution engine is after checking loop termination
(func $afterTerminationCheck
  ;; Notify the tape device to check tape hooks
  call $checkTapeHooks

  ;; Is it time to render the next beeper/sound sample?
  (i32.ge_u (get_global $tacts) (get_global $audioNextSampleTact))
  if
    ;; Render next beeper sample
    (i32.add (get_global $BEEPER_SAMPLE_BUFFER) (get_global $audioSampleCount))
    i32.const 1
    i32.const 0
    get_global $beeperLastEarBit
    select
    i32.store8 

    get_global $psgSupportsSound
    if
      ;; Render next PSG sample
      (i32.add 
        (get_global $PSG_SAMPLE_BUFFER) 
        (i32.mul (get_global $audioSampleCount) (i32.const 2))
      )
      (i32.eqz (get_global $psgOrphanSamples))
      if (result i32)
        i32.const 0
      else
        (i32.div_u 
          (i32.div_u (get_global $psgOrphanSum) (get_global $psgOrphanSamples))
          (i32.const 3)
        )
      end
      i32.store16
      i32.const 0 set_global $psgOrphanSum
      i32.const 0 set_global $psgOrphanSamples
    end

    ;; Adjust sample count
    (i32.add (get_global $audioSampleCount) (i32.const 1))
    set_global $audioSampleCount

    ;; Calculate next sample tact
    (i32.add (get_global $audioGateValue) (get_global $audioLowerGate))
    set_global $audioGateValue
    (i32.add (get_global $audioNextSampleTact) (get_global $audioSampleLength))
    set_global $audioNextSampleTact

    (i32.ge_u (get_global $audioGateValue) (get_global $audioUpperGate))
    if
      ;; Shift the next sample 
      (i32.add (get_global $audioNextSampleTact) (i32.const 1))
      set_global $audioNextSampleTact

      (i32.sub (get_global $audioGateValue) (get_global $audioUpperGate))
      set_global $audioGateValue
    end
  end
)

;; The execution engine has just completed the current frame
(func $onFrameCompleted
  ;; The current screen rendering frame completed
  ;; Prepare for the next PSG tact that may overflow to the next frame
  (i32.gt_u (get_global $psgNextClockTact) (get_global $tactsInFrame))
  if
    (i32.sub 
      (get_global $psgNextClockTact)
      (get_global $tactsInFrame)
    )
    set_global $psgNextClockTact
  end

  ;; Prepare for the next beeper sample rate that may overflow to the next frame
  (i32.gt_u (get_global $audioNextSampleTact) (get_global $tacts))
  if
    (i32.sub 
      (get_global $audioNextSampleTact)
      (i32.mul (get_global $tactsInFrame) (get_global $clockMultiplier))
    )
    set_global $audioNextSampleTact
  end
)

;; Prepares samples for PSG emulation
(func $preparePsgSamples
  (local $currentFrameTact i32)
  (i32.eqz (get_global $psgSupportsSound))
  if return end

  (i32.div_u (get_global $tacts) (get_global $clockMultiplier))
  (i32.ge_u (tee_local $currentFrameTact) (get_global $psgNextClockTact))
  if
    call $generatePsgOutputValue
    loop $nextClock
      (i32.add (get_global $psgNextClockTact) (get_global $psgClockStep))
      set_global $psgNextClockTact
      (i32.ge_u (get_local $currentFrameTact) (get_global $psgNextClockTact))
      if
        call $generatePsgOutputValue
        br $nextClock
      end
    end
  end
)