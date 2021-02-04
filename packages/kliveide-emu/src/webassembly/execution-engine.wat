;; ============================================================================
;; Core routines for the machine execution cycle

;; Execution engine constants
;; $BR_INSTR# = 0x01
;; $BR_PART_INSTR# = 0x02
;; $BR_ANY_INSTR# = 0x03

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
  (local $oldClockMultiplier i32)

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
      call $allowCpuClockChange
      if
        (set_local $oldClockMultiplier (get_global $clockMultiplier))
        (set_global $clockMultiplier (get_global $defaultClockMultiplier))
      end
      (i32.div_u (get_global $tacts) (get_global $clockMultiplier))
      set_global $lastRenderedFrameTact

      (call $onInitNewFrame (get_local $oldClockMultiplier))
    end

    ;; Calculate the current frame tact
    (i32.div_u (get_global $tacts) (get_global $clockMultiplier))
    set_local $currentFrameTact

    ;; Do not use the CPU if that is snoozed
    (i32.eqz (get_global $cpuSnoozed))
    if
      ;; Execute an entire instruction
      (call $beforeCpuCycle (get_local $currentFrameTact))
      call $executeCpuCycle
      loop $instructionLoop
        get_global $isInOpExecution
        if
          call $executeCpuCycle
          br $instructionLoop
        end
      end 
    else
      ;; Mimic that time is passing
      (i32.add (get_global $tacts) (i32.const 10))
      set_global $tacts
    end
    (call $afterCpuCycle (get_local $currentFrameTact))
    
    ;; Check termination point
    (call $beforeTerminationCheck (get_local $currentFrameTact))
    call $testIfTerminationPointReached
    if
      i32.const $EX_REA_TERM# set_global $executionCompletionReason ;; Reason: Termination point reached
      return
    end

    ;; Check breakpoints
    (i32.eq (get_global $debugStepMode) (i32.const $DEB_STOP_BR#))
    if
      call $testInstructionBreakpoint
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

;; Tests if the execution reached an instruction breakpoint
(func $testInstructionBreakpoint (result i32)
  (local $flags i32)
  
  ;; Load the breakpoint flags for PC
  (i32.load8_u
    (i32.add 
      (get_global $BREAKPOINTS_MAP)
      (get_global $PC)
    )
  )

  ;; Keep execution flags
  (i32.and (i32.const $BR_ANY_INSTR#))
  tee_local $flags
  if
    ;; An instruction breakpoint is set
    (i32.and (get_local $flags) (i32.const $BR_INSTR#))
    if 
      i32.const 1
      return
    end

    ;; Test partition breakpoint
    (i32.and (get_local $flags) (i32.const $BR_PART_INSTR#))
    if
      ;; Get the breakpoint partition
      (i32.load16_u
        (i32.add 
          (get_global $BRP_PARTITION_MAP)
          (i32.mul (get_global $PC) (i32.const 2))
        )
      )
      
      ;; Get current partition
      (i32.add
        (get_global $BLOCK_LOOKUP_TABLE)
        (i32.mul 
          (i32.shr_u (get_global $PC) (i32.const 13))
          (i32.const 16)
        )
      )
      i32.load16_u offset=0x0a

      ;; Test if partitions are equal
      i32.eq
      return
    else
      i32.const 0
      return
    end
  end

  ;; Not a breakpoint 
  i32.const 0
)
