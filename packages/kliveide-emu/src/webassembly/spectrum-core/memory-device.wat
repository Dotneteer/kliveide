;; ============================================================================
;; ZX Spectrum memory management functions

;; The selected ROM page
(global $memorySelectedRom (mut i32) (i32.const 0x0000))

;; Is memory pagin enabled?
(global $memoryPagingEnabled (mut i32) (i32.const 0x0000))

;; The selected memory bank
(global $memorySelectedBank (mut i32) (i32.const 0x0000))

;; Shadow screen is to be used?
(global $memoryUseShadowScreen (mut i32) (i32.const 0x0000))

;; The WA memory offset where the screen memory starts
(global $memoryScreenOffset (mut i32) (i32.const 0x0000))

;; ----------------------------------------------------------------------------
;; Memory handler routines

(func $setMemoryPageIndex (param $page i32) (param $bankOffset i32) (param $contended i32) (param $readonly i32)
  (local $indexAddr i32)
  ;; Calculate the address within the index table
  (i32.add
    (i32.mul 
      (i32.and (get_local $page) (i32.const 0x03)) ;; We allow only four pages
      (i32.const 6)
    )
    (get_global $PAGE_INDEX_16)
  )
  (i32.store (tee_local $indexAddr) (get_local $bankOffset))
  (i32.store8 offset=4 (get_local $indexAddr) (get_local $contended))
  (i32.store8 offset=5 (get_local $indexAddr) (get_local $readonly))
)

;; Sets an entry in the BLOCK_LOOKUP_TABLE
;; $block: Block index
;; $bankOffset: Offset in the 16MB virtual memory
;; $contended: Is that block contended?
;; $readonly: Is that blcok read-only?
(func $setMemoryBlockEntry (param $block i32) (param $bankOffset i32) (param $contended i32) (param $readonly i32)
  (local $indexAddr i32)
  
  ;; Calculate the address within the index table
  (i32.add
    (i32.shl 
      ;; 8 blocks, 16 bytes each
      (i32.and (get_local $block) (i32.const 0x07))
      (i32.const 4)
    )
    (get_global $BLOCK_LOOKUP_TABLE)
  )

  ;; Store read pointer
  (i32.store (tee_local $indexAddr) (get_local $bankOffset))

  ;; Store write pointer
  (i32.store offset=4 (get_local $indexAddr) (get_local $bankOffset))

  ;; Store read RAM/ROM information
  (i32.store8 offset=8 (get_local $indexAddr) (get_local $readonly))
  
  ;; Store contention information
  (i32.store8 offset=9 (get_local $indexAddr) (get_local $contended))
)
