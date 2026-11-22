; Data for Bank Window (bank-window.kz80.asm): a line of text at the start of three 8K pages.
; Banked data: main.kz80.asm includes this file after all unbanked code.
;
; A .bank section is assembled for $C000, so these labels are $C000-based. The demo does not
; use them: it reads the same bytes through slot 7, at $E000.

    .bank 20                ; pages 40 and 41
BwPage40:
    .defn "bank 20, first half"

    .bank 20,$2000          ; the second 8K of bank 20: page 41
BwPage41:
    .defn "bank 20, second half"

    .bank 21                ; pages 42 and 43
BwPage42:
    .defn "bank 21, first half"
