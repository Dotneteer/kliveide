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
