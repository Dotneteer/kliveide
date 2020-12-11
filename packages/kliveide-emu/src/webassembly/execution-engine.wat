;; ============================================================================
;; Core routines for the machine execution cycle

;; Gets the execution engine state
(func $getExecutionEngineState
  ;; ZX Spectrum engine state
  (i32.store offset=80 (get_global $STATE_TRANSFER_BUFF) (get_global $lastRenderedFrameTact))
  (i32.store offset=84 (get_global $STATE_TRANSFER_BUFF) (get_global $frameCount))
  (i32.store8 offset=88 (get_global $STATE_TRANSFER_BUFF) (get_global $frameCompleted))
  (i32.store offset=89 (get_global $STATE_TRANSFER_BUFF) (get_global $contentionAccummulated))
  (i32.store offset=93 (get_global $STATE_TRANSFER_BUFF) (get_global $lastExecutionContentionValue))
  (i32.store8 offset=97 (get_global $STATE_TRANSFER_BUFF) (get_global $emulationMode))
  (i32.store8 offset=98 (get_global $STATE_TRANSFER_BUFF) (get_global $debugStepMode))
  (i32.store8 offset=99 (get_global $STATE_TRANSFER_BUFF) (get_global $disableScreenRendering))
  (i32.store8 offset=100 (get_global $STATE_TRANSFER_BUFF) (get_global $executionCompletionReason))
  (i32.store16 offset=101 (get_global $STATE_TRANSFER_BUFF) (get_global $stepOverBreakpoint))
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

;; Executes the virtual machine cycle
(func $executeMachineLoop
  (local $currentFrameTact i32)
  (local $nextOpCode i32)
  (local $length i32)

  ;; Initialize the execution cycle
  i32.const $EX_REA_EXEC# set_global $executionCompletionReason
  get_global $contentionAccummulated set_global $lastExecutionContentionValue

  ;; The physical frame cycle that goes on while CPU and ULA
  ;; processes everything within a screen rendering frame
  loop $frameCycle
    ;; Check if we're just about starting the next frame
    get_global $frameCompleted
    if
      ;; Reset frame information
      (i32.div_u (get_global $tacts) (get_global $clockMultiplier))
      set_global $lastRenderedFrameTact

      call $onInitNewFrame
    end

    ;; Calculate the current frame tact
    (i32.div_u (get_global $tacts) (get_global $clockMultiplier))
    set_local $currentFrameTact

    ;; Execute an entire instruction
    (call $beforeCpuCycle (get_local $currentFrameTact))
    call $executeCpuCycle
    (call $afterCpuCycle (get_local $currentFrameTact))
    
    loop $instructionLoop
      get_global $isInOpExecution
      if
        (call $beforeCpuCycle (get_local $currentFrameTact))
        call $executeCpuCycle
        (call $afterCpuCycle (get_local $currentFrameTact))
        br $instructionLoop
      end
    end 

    (call $beforeTerminationCheck (get_local $currentFrameTact))

    ;; Check termination point
    call $testIfTerminationPointReached
    if
      i32.const $EX_REA_TERM# set_global $executionCompletionReason ;; Reason: Termination point reached
      return
    end

    ;; Check breakpoints
    (i32.eq (get_global $debugStepMode) (i32.const $DEB_STOP_BR#))
    if
      ;; Stop at breakpoints mode
      (call $testBreakpoint (get_global $PC))
      if
        i32.const $EX_REA_BREAK# set_global $executionCompletionReason ;; Reason: Break
        return
      end
    else
      ;; Check step-into mode
      (i32.eq (get_global $debugStepMode) (i32.const $DEB_INTO#))
      if
        i32.const $EX_REA_BREAK# set_global $executionCompletionReason ;; Reason: Break
        return
      else
        ;; Check step-over mode
        (i32.eq (get_global $debugStepMode) (i32.const $DEB_OVER#))
        if
          (i32.eq (get_global $PC) (get_global $stepOverBreakpoint))
          if
            i32.const $EX_REA_BREAK# set_global $executionCompletionReason ;; Reason: Break
            return
          end
        else
          ;; Check step-out mode
          (i32.eq (get_global $debugStepMode) (i32.const $DEB_OUT#))
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
                i32.const $EX_REA_BREAK# set_global $executionCompletionReason ;; Reason: Break
                return
              end
            end
          end
        end
      end
    end 

    ;; Exit if halted and execution mode is UntilHalted
    (i32.eq (get_global $emulationMode) (i32.const $EMU_HALT#))
    if
      (i32.and (get_global $cpuSignalFlags) (i32.const $SIG_HLT#))
      if
        i32.const $EX_REA_HALT# set_global $executionCompletionReason ;; Reason: halted
        return
      end
    end     

    call $afterTerminationCheck

    ;; Test frame completion
    (i32.ge_u (get_local $currentFrameTact) (get_global $tactsInFrame))
    set_global $frameCompleted
    (br_if $frameCycle (i32.eqz (get_global $frameCompleted)))
  end

  call $onFrameCompleted

  ;; Adjust tacts
  (i32.rem_u 
    (get_global $tacts)
    (i32.mul (get_global $tactsInFrame) (get_global $clockMultiplier))
  )
  set_global $tacts

  (i32.add (get_global $frameCount) (i32.const 1))
  set_global $frameCount

  ;; Sign frame completion
  i32.const $EX_REA_FRAME# set_global $executionCompletionReason ;; Reason: frame completed
)
