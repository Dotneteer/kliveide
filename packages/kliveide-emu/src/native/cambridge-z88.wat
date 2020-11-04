;; ==========================================================================
;; Cambridge Z88 functions

;; Reads the memory of the Cambridge Z88 machibe
;; $addr: 16-bit memory address
;; returns: Memory contents
(func $readCz88Memory (param $addr i32) (result i32)
  ;; TODO: Implement this method
  i32.const 0xff
)

;; Writes the memory of the Cambridge Z88 machibe
;; $addr: 16-bit memory address
;; $v: 8-bit value to write
(func $writeCz88Memory (param $addr i32) (param $v i32)
  ;; TODO: Implement this method
)

;; Reads a port of the Cambridge Z88 machine
;; $addr: port address
;; Returns: value read from port
(func $readPortCz88 (param $addr i32) (result i32)
  ;; TODO: Implement this method

  ;; Return the default port value
  i32.const 0xff
)

;; Writes a port of the Cambridge Z88 machine
;; $addr: port address
;; $v: Port value
(func $writePortCz88 (param $addr i32) (param $v i32)
  ;; TODO: Implement this method
)

;; Sets up the Cambridge Z88 machine
(func $setupCz88
  ;; TODO: Implement this method
)

;; Gets the Cambridge Z88 machine state
(func $getCz88MachineState
  ;; TODO: Implement this method
)
