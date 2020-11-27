;; ============================================================================
;; Stack helper functions for step-over debugging

(global $stepOutStackDepth (mut i32) (i32.const 0x0000))
(global $retExecuted (mut i32) (i32.const 0x0000))
(global $stepOutAddress (mut i32) (i32.const 0x0000))
(global $stepOutStartDepth (mut i32) (i32.const 0x0000))

;; Resets the step-over stack
(func $resetStepOverStack
  i32.const 0 set_global $stepOutStackDepth
  i32.const 0 set_global $retExecuted
  i32.const -1 set_global $stepOutAddress
  i32.const 0 set_global $stepOutStartDepth
)

;; Marks the depth of the step-over stack before each run
(func $markStepOverStack
  get_global $stepOutStackDepth
  set_global $stepOutStartDepth
)

;; Pushes the value to the step-over stack
(func $pushToStepOver (param $value i32)
  ;; Do not allow stack overflow
  (i32.ge_u (get_global $stepOutStackDepth) (i32.const 512))
  if return end

  ;; Store the value on stack
  (i32.store16
    (i32.add 
      (get_global $STEP_OUT_STACK) 
      (i32.mul (i32.const 2) (get_global $stepOutStackDepth))
    )
    (get_local $value)
  )

  ;; Increment counter
  (i32.add (get_global $stepOutStackDepth) (i32.const 1))
  set_global $stepOutStackDepth
)

;; Pops a value from the step-over stack
(func $popFromStepOver
  ;; Do not allow stack underflow
  (i32.eqz (get_global $stepOutStackDepth))
  if
    i32.const 0
    return
  end

  ;; Decrement counter
  (i32.sub (get_global $stepOutStackDepth) (i32.const 1))
  set_global $stepOutStackDepth

  ;; Load the value from the stack
  (i32.load16_u
    (i32.add 
      (get_global $STEP_OUT_STACK) 
      (i32.mul (i32.const 2) (get_global $stepOutStackDepth))
    )
  )

  ;; Store as the step out address
  set_global $stepOutAddress

  ;; Sign a RET statement
  i32.const 1 set_global $retExecuted
)
