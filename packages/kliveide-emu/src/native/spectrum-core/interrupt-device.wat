;; ============================================================================
;; Implements the ZX Spectrum interrupt device

;; ----------------------------------------------------------------------------
;; Interrupt device state

;; Signs that an interrupt has been raised in the current frame.
(global $interruptRaised (mut i32) (i32.const 0x0000))

;; Signs that the interrupt request has been revoked.
(global $interruptRevoked (mut i32) (i32.const 0x0000))

;; Checks and executes interrupt, if it's time
(func $checkForInterrupt (param $currentUlaTact i32)
  ;; We've already handled the interrupt
  get_global $interruptRevoked
  if return end

  ;; Is it too early to raise the interrupt?
  (i32.lt_u (get_local $currentUlaTact) (get_global $interruptTact))
  if return end

  ;; Are we over the longest op after the interrupt tact?
  (i32.gt_u 
    (get_local $currentUlaTact)
    (i32.add (get_global $interruptTact) (i32.const 23)) ;; tacts of the longest op
  )
  if
    ;; Let's revoke the INT signal
    i32.const 1 set_global $interruptRevoked
    (i32.and (get_global $stateFlags) (i32.const 0xfe))
    set_global $stateFlags ;; Reset the interrupt signal
    return
  end

  ;; The interrupt is raised, not revoked, but the CPU has not handled it yet
  get_global $interruptRaised
  if return end

  ;; Do not raise interrupt when CPU blocks
  get_global $isInterruptBlocked
  if return end

  ;; It is time to raise the interrupt
  i32.const 1 set_global $interruptRaised
  (i32.or (get_global $stateFlags) (i32.const 0x01))
  set_global $stateFlags ;; Set the interrupt signal
)

;; Sets the interrupt tact for test purposes
(func $setInterruptTact (param $tact i32)
  get_local $tact set_global $interruptTact
)

