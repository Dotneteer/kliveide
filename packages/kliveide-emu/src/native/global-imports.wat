;; ============================================================================
;; Imported functions used globally

(func $trace (import "imports" "trace") (param i32))
(func $opCodeFetched (import "imports" "opCodeFetched") (param i32) (param i32))
(func $standardOpExecuted (import "imports" "standardOpExecuted") (param i32) (param i32))
(func $extendedOpExecuted (import "imports" "extendedOpExecuted") (param i32) (param i32))
(func $indexedOpExecuted (import "imports" "indexedOpExecuted") (param i32) (param i32) (param i32))
(func $bitOpExecuted (import "imports" "bitOpExecuted") (param i32) (param i32))
(func $indexedBitOpExecuted (import "imports" "indexedBitOpExecuted") (param i32) (param i32) (param i32))
(func $intExecuted (import "imports" "intExecuted") (param i32))
(func $nmiExecuted (import "imports" "nmiExecuted"))
(func $halted (import "imports" "halted") (param i32))
(func $memoryRead (import "imports" "memoryRead") (param i32) (param i32))
(func $memoryWritten (import "imports" "memoryWritten") (param i32) (param i32))
(func $ioRead (import "imports" "ioRead") (param i32) (param i32))
(func $ioWritten (import "imports" "ioWritten") (param i32) (param i32))
