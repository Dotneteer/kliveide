; ==============================================================================
; ZX Spectrum Next Screen Test Cases 
; ==============================================================================
.model next

.savenex file "screen-tests.nex"
.savenex core "3.1.0"

main:
    ; Entry point code
    ld a,3
    out ($fe),a
trap jr trap

TX_Hello
    .defm "Hello"
TX_Hello_len = $ - TX_Hello