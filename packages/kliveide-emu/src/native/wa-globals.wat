;; ============================================================================
;; Global settings for all machine types

;; We keep 8192 KB of memory
(memory (export "memory") 340)

;; Total number of dispatchable functions: 2000
(table $dispatch 2000 anyfunc)

;; ==========================================================================
;; Function signatures

(type $MemReadFunc (func (param $addr i32) (result i32)))
(type $MemWriteFunc (func (param $addr i32) (param $v i32)))
(type $PortReadFunc (func (param $addr i32) (result i32)))
(type $PortWriteFunc (func (param $addr i32) (param $v i32)))
(type $TbBlueWriteFunc (func (param $addr i32)))
(type $OpFunc (func))
(type $IndexedBitFunc (func (param $addr i32)))
(type $BitOpFunc (func (param $a i32) (result i32)))
(type $ActionFunc (func))
(type $ValueFunc (func (result i32)))
