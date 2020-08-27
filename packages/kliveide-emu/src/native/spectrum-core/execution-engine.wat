;; ============================================================================
;; Implementation of the ZX Spectrum execution engine

;; ----------------------------------------------------------------------------
;; ZX Spectrum engine configuration

;; Base CPU clock frequency
(global $baseClockFrequency (mut i32) (i32.const 0x0000))

;; Clock frequency multiplier
(global $clockMultiplier (mut i32) (i32.const 0x0000))

;; Supports ZX Spectrrum Next operations?
(global $supportsNextOperation (mut i32) (i32.const 0x0000))

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

;; Total number of screen lines
(global $screenLines (mut i32) (i32.const 0x0000))

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

;; Total width of the screen
(global $screenWidth (mut i32) (i32.const 0x0000))

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

;; The last rendered ULA tact
(global $lastRenderedUlaTact (mut i32) (i32.const 0x0000))

;; Number of frames rendered
(global $frameCount (mut i32) (i32.const 0x0000))

;; Indicates that a screen frame has just completed
(global $frameCompleted (mut i32) (i32.const 0x0000))

;; Gets or sets the value of the contention accummulated since the start
;; of the machine
(global $contentionAccummulated (mut i32) (i32.const 0x0000))

;; Gets the value of the contention accummulated since the last execution
;; cycle started
(global $lastExecutionContentionValue (mut i32) (i32.const 0x0000))

;; The emulation mode to use with the execution cycle
;; 0: Debugger
;; 1: UntilHalt
;; 2: UntilCpuFrameEnds
;; 3: UntilUlaFrameEnds
;; 4: UntilExecutionPoint
(global $emulationMode (mut i32) (i32.const 0x0000))

;; The debug step mode to use with the execution cycle
;; (only when $emulationMode is Debugger)
;; 0: StopAtBreakPoints
;; 1: StepInto
;; 2: StepOver
;; 3: StepOut
(global $debugStepMode (mut i32) (i32.const 0x0000))

;; Indicates if fast tape mode is allowed
(global $fastTapeMode (mut i32) (i32.const 0x0000))

;; The index of the ROM when a termination point is defined
(global $terminationRom (mut i32) (i32.const 0x0000))

;; The value of the PC register to reach when a termination point 
;; is defined
(global $terminationPoint (mut i32) (i32.const 0x0000))

;; This flag shows that the virtual machine should run in hidden mode
;; (no screen, no sound, no delays)
(global $fastVmMode (mut i32) (i32.const 0x0000))

;; This flag shows whether the virtual machine should render the screen.
;; True, renders the screen; false, does not render the screen.
;; This flag overrides the $fastVmMode setting.
(global $disableScreenRendering (mut i32) (i32.const 0x0000))

;; The reason the execution cycle completed.
;; 0: The machine is still executing
;; 1: Termination point reached
;; 2: Breakpoint reached
;; 3: Halted
;; 4: CPU frame completed
;; 5: Screen rendering frame/ULA frame completed
(global $executionCompletionReason (mut i32) (i32.const 0x0000))

;; The step-over breakpoint
(global $stepOverBreakpoint (mut i32) (i32.const 0x0000))

;; ----------------------------------------------------------------------------
;; Public functions to manage a ZX Spectrum machine

;; Initializes a ZX Spectrum machine with the specified type
;; $type: Machine type
;;   0: ZX Spectrum 48K
;;   1: ZX Spectrum 128K
;;   2: ZX Spectrum 3+
;;   3: ZX Spectrum Next
;; $edition: Machine edition (ignored, as of now)
(func $initZxSpectrum (param $type i32) (param $edition i32)
  ;; Store machine type
  (i32.gt_u (get_local $type) (i32.const 3))
  if (result i32)
    i32.const 0
  else
    get_local $type
  end
  set_global $MACHINE_TYPE

  call $setupMachine
)

;; Turns on the ZX Spectrum machine
(func $turnOnMachine
  call $setupMachine
)

;; Resets the ZX Spectrum machine
(func $resetMachine
  call $resetCpu

  ;; Reset engine state variables
  i32.const 0 set_global $lastRenderedUlaTact
  i32.const 0 set_global $frameCount
  i32.const 0 set_global $tacts
  i32.const 1 set_global $frameCompleted
  i32.const 0 set_global $contentionAccummulated
  i32.const 0 set_global $lastExecutionContentionValue
  i32.const 0 set_global $emulationMode
  i32.const 0 set_global $debugStepMode
  i32.const 0 set_global $fastTapeMode
  i32.const -1 set_global $terminationRom
  i32.const -1 set_global $terminationPoint
  i32.const 0 set_global $fastVmMode
  i32.const 0 set_global $disableScreenRendering
  i32.const 0 set_global $executionCompletionReason
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
  get_global $psgCLockStep set_global $psgNextClockTact

  (i32.store offset=0 (get_global $PSG_REGS) (i32.const 0))
  (i32.store offset=4 (get_global $PSG_REGS) (i32.const 0))
  (i32.store offset=8 (get_global $PSG_REGS) (i32.const 0))
  (i32.store offset=12 (get_global $PSG_REGS) (i32.const 0))
  (i32.store offset=16 (get_global $PSG_REGS) (i32.const 0))
  (i32.store offset=20 (get_global $PSG_REGS) (i32.const 0))
  (i32.store offset=24 (get_global $PSG_REGS) (i32.const 0))
  (i32.store offset=28 (get_global $PSG_REGS) (i32.const 0))
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

;; Copies execution options from the transfer area
(func $setExecutionOptions
  (i32.load8_u offset=0 (get_global $STATE_TRANSFER_BUFF)) set_global $emulationMode
  (i32.load8_u offset=1 (get_global $STATE_TRANSFER_BUFF)) set_global $debugStepMode
  (i32.load8_u offset=2 (get_global $STATE_TRANSFER_BUFF)) set_global $fastTapeMode
  (i32.load8_u offset=3 (get_global $STATE_TRANSFER_BUFF)) set_global $terminationRom
  (i32.load16_u offset=4 (get_global $STATE_TRANSFER_BUFF)) set_global $terminationPoint
  (i32.load8_u offset=6 (get_global $STATE_TRANSFER_BUFF)) set_global $fastVmMode
  (i32.load8_u offset=7 (get_global $STATE_TRANSFER_BUFF)) set_global $disableScreenRendering
  (i32.load offset=8 (get_global $STATE_TRANSFER_BUFF)) set_global $stepOverBreakpoint
)

;; Executes the ZX Spectrum machine cycle
(func $executeMachineCycle
  (local $currentUlaTact i32)
  (local $nextOpCode i32)
  (local $length i32)

  ;; Initialize the execution cycle
  i32.const 0 set_global $executionCompletionReason
  get_global $contentionAccummulated set_global $lastExecutionContentionValue

  ;; The physical frame cycle that goes on while CPU and ULA
  ;; processes everything within a screen rendering frame
  loop $frameCycle
    ;; Check if we're just about starting the next frame
    get_global $frameCompleted
    if
      ;; Reset frame information
      (i32.div_u (get_global $tacts) (get_global $clockMultiplier))
      set_global $lastRenderedUlaTact

      ;; Reset interrupt information
      i32.const 0 set_global $interruptRevoked
      i32.const 0 set_global $interruptRaised

      ;; Reset pointers used for screen rendering
      (i32.add
        (get_global $RENDERING_TACT_TABLE)
        (i32.mul (get_global $lastRenderedUlaTact) (i32.const 5))
      )
      set_global $renderingTablePtr

      get_global $PIXEL_RENDERING_BUFFER set_global $pixelBufferPtr
      i32.const 0 set_global $frameCompleted

      ;; Calculate flash phase
      (i32.rem_u (get_global $frameCount) (get_global $flashFrames))
      i32.eqz
      if
        (i32.xor (get_global $flashPhase) (i32.const 0x01))
        set_global $flashPhase
      end

      ;; Reset beeper frame state
      i32.const 0 set_global $audioSampleCount
    end

    ;; Calculate the current frame tact
    (i32.div_u (get_global $tacts) (get_global $clockMultiplier))

    ;; Take care of raising the interrupt
    (call $checkForInterrupt (tee_local $currentUlaTact))

    ;; Execute an entire instruction
    call $executeCpuCycle
    call $preparePsgSample
    loop $instructionLoop
      get_global $isInOpExecution
      if
        call $executeCpuCycle
        call $preparePsgSample
        br $instructionLoop
      end
    end 

    ;; Render the screen
    (call $renderScreen (get_local $currentUlaTact))

    ;; Check breakpoints
    (i32.eq (get_global $debugStepMode) (i32.const 1))
    if
      ;; Stop at breakpoints mode
      (call $testBreakpoint (get_global $PC))
      if
        i32.const 2 set_global $executionCompletionReason ;; Reason: Break
        return
      end
    else
      ;; Check step-into mode
      (i32.eq (get_global $debugStepMode) (i32.const 2))
      if
        i32.const 2 set_global $executionCompletionReason ;; Reason: Break
        return
      else
        ;; Check step-over mode
        (i32.eq (get_global $debugStepMode) (i32.const 3))
        if
          (i32.eq (get_global $PC) (get_global $stepOverBreakpoint))
          if
            i32.const 2 set_global $executionCompletionReason ;; Reason: Break
            return
          end
        else
          ;; Check step-out mode
          (i32.eq (get_global $debugStepMode) (i32.const 4))
          if
            get_global $retExecuted
            if
              ;; Last statement was a RET. Is it the call frame we're looking for?
              (i32.eq 
                (get_global $stepOutStartDepth)
                (i32.add (get_global $stepOutStackDepth) (i32.const 1))
              )
              if
                ;; PC is the return address after RET
                (i32.ne (get_global $PC) (get_global $stepOutAddress))
                if
                  ;; Some invalid code is used, clear the step over stack
                  call $resetStepOverStack
                end
                i32.const 2 set_global $executionCompletionReason ;; Reason: Break
                return
              end
            end
          end
        end
      end
    end 

    ;; Exit if halted and execution mode is UntilHalted
    (i32.eq (get_global $emulationMode) (i32.const 1))
    if
      (i32.and (get_global $stateFlags) (i32.const 0x08)) ;; HLT signal set?
      if
        i32.const 3 set_global $executionCompletionReason ;; Reason: halted
        return
      end
    end     

    ;; Notify the tape device to check tape hooks
    call $checkTapeHooks

    ;; ;; Is it time to generate the next PSG output value?
    ;; (i32.ge_u (get_local $currentUlaTact) (get_global $psgNextClockTact))
    ;; if
    ;;   call $generatePsgOutputValue
    ;;   loop $nextClock
    ;;     (i32.add (get_global $psgNextClockTact) (get_global $psgCLockStep))
    ;;     set_global $psgNextClockTact
    ;;     (i32.ge_u (get_local $currentUlaTact) (get_global $psgNextClockTact))
    ;;     if
    ;;       call $generatePsgOutputValue
    ;;       br $nextClock
    ;;     end
    ;;   end
    ;; end

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

      ;; Render next PSG sample
      (i32.add (get_global $PSG_SAMPLE_BUFFER) (get_global $audioSampleCount))
      get_global $psgLastOutputValue
      i32.store8

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

    ;; Test frame completion
    (i32.ge_u (get_local $currentUlaTact) (get_global $tactsInFrame))
    set_global $frameCompleted
    (br_if $frameCycle (i32.eqz (get_global $frameCompleted)))
  end

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

  ;; Adjust tacts
  (i32.sub 
    (get_global $tacts)
    (i32.mul (get_global $tactsInFrame) (get_global $clockMultiplier))
  )
  set_global $tacts

  (i32.add (get_global $frameCount) (i32.const 1))
  set_global $frameCount

  ;; Sign frame completion
  i32.const 5 set_global $executionCompletionReason ;; Reason: frame completed
)

(func $preparePsgSample
  (local $currentUlaTact i32)
  (i32.div_u (get_global $tacts) (get_global $clockMultiplier))
  (i32.ge_u (tee_local $currentUlaTact) (get_global $psgNextClockTact))
  if
    call $generatePsgOutputValue
    loop $nextClock
      (i32.add (get_global $psgNextClockTact) (get_global $psgCLockStep))
      set_global $psgNextClockTact
      (i32.ge_u (get_local $currentUlaTact) (get_global $psgNextClockTact))
      if
        call $generatePsgOutputValue
        br $nextClock
      end
    end
  end
)