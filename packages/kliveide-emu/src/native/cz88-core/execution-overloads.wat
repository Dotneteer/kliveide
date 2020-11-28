;; The execution engine starts a new frame
(func $execOnInitNewFrame
  ;; TODO: Implement this method
)

;; The execution engine is about to execute a CPU cycle
(func $execBeforeCpuCycle (param $frameTact i32)
  ;; TODO: Implement this method
)

;; The execution engine is about to execute a CPU cycle
(func $execAfterCpuCycle (param $frameTact i32)
  ;; TODO: Implement this method
)

;; The execution engine is before checking loop termination
(func $execBeforeTerminationCheck (param $frameTact i32)
  ;; TODO: Implement this method
)

;; Tests if the execution cycle reached the termination point
(func $execTestIfTerminationPointReached (result i32)
  ;; TODO: Implement this method
  i32.const 0
)

;; The execution engine is after checking loop termination
(func $execAfterTerminationCheck
  ;; TODO: Implement this method
)

;; The execution engine has just completed the current frame
(func $execOnFrameCompleted
  ;; TODO: Implement this method
)
