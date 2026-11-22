; The menu, in two levels: the parts of the book, then the demos of one part.
; The tables are in main.kz80.asm: PartTable, and one demo table per part.

TitleAttr:   .equ $78       ; BRIGHT 1, PAPER 7, INK 0
TextAttr:    .equ $38       ; PAPER 7, INK 0
PlannedAttr: .equ $39       ; PAPER 7, INK 1: a demo that is not written yet
KeyAttr:     .equ $68       ; BRIGHT 1, PAPER 5, INK 0
FirstRow:    .equ 4         ; the row of the first item in a list

; A demo table entry: the title, the entry point, then Ready or Planned
DemoEntrySize: .equ 5
Ready:       .equ 1
Planned:     .equ 0

; Draws the first screen: the book's title and the list of parts
DrawParts:
    ld de,$0000             ; row 0, column 0
    ld c,TitleAttr
    ld hl,MenuTitle
    call PrintText
    ld de,$0100             ; row 1, column 0
    ld c,TextAttr
    ld hl,MenuSubtitle
    call PrintText
    ld de,$0200             ; row 2, column 0: the subtitle is too long for one row
    ld hl,MenuSubtitle2
    call PrintText
    ld ix,PartTable
    ld b,4                  ; four bytes per entry, no Ready flag
    call DrawList
    ld hl,PartsPrompt
    jp DrawPrompt

; Draws the screen of the part whose PartTable entry is at (CurrentPart)
DrawDemos:
    ld ix,(CurrentPart)
    ld l,(ix+0)
    ld h,(ix+1)             ; HL: the part's title
    ld de,$0000
    ld c,TitleAttr
    call PrintText
    ld l,(ix+2)
    ld h,(ix+3)
    push hl
    pop ix                  ; IX: the part's demo table
    ld b,DemoEntrySize
    call DrawList
    ld de,$1400             ; row 20
    ld c,PlannedAttr
    ld hl,PlannedNote
    call PrintText
    ld hl,DemosPrompt
DrawPrompt:
    ld de,$1600             ; row 22, column 0
    ld c,TextAttr
    jp PrintText

; Draws the list at IX from row FirstRow: a key, then the title. B is the size of an entry; an
; entry of DemoEntrySize bytes is drawn in PlannedAttr when its last byte is Planned. Sets
; ListCount to the number of entries.
DrawList:
    ld a,b
    ld (ListEntrySize),a
    xor a
    ld (ListCount),a
    ld d,FirstRow
DrawListLoop:
    ld l,(ix+0)
    ld h,(ix+1)             ; HL: the title
    ld a,h
    or l
    ret z                   ; a zero title ends the table
    push hl
    ld a,(ListCount)
    ld hl,MenuKeys
    add hl,a
    ld a,(hl)               ; the item's key
    ld e,1
    ld c,KeyAttr
    call PrintChar
    ld c,TextAttr
    ld a,(ListEntrySize)
    cp DemoEntrySize
    jr nz,DrawListTitle
    ld a,(ix+4)
    cp Planned
    jr nz,DrawListTitle
    ld c,PlannedAttr
DrawListTitle:
    pop hl
    ld e,3
    call PrintText
    inc d
    ld a,(ListCount)
    inc a
    ld (ListCount),a
    ld a,(ListEntrySize)
    ld c,a
    ld b,0
    add ix,bc               ; the next entry
    jr DrawListLoop

; Waits for the key of a listed item and returns its index in A. When ListBack is not zero,
; SPACE returns with carry set instead.
ChooseItem:
    call WaitKey            ; A: the character of the key
    cp 32
    jr nz,ChooseItemKey
    ld a,(ListBack)
    or a
    jr z,ChooseItem
    call WaitNoKey
    scf
    ret
ChooseItemKey:
    ld b,a
    ld a,(ListCount)
    or a
    jr z,ChooseItem         ; an empty table: nothing to choose
    ld c,a
    ld hl,MenuKeys
ChooseItemFind:
    ld a,(hl)
    cp b
    jr z,ChooseItemFound
    inc hl
    dec c
    jr nz,ChooseItemFind
    jr ChooseItem           ; not an item's key: wait again
ChooseItemFound:
    ld de,MenuKeys
    or a
    sbc hl,de
    ld a,l                  ; the index; carry is clear
    ret

; Chooses a part and stores the address of its PartTable entry in CurrentPart
ChoosePart:
    xor a
    ld (ListBack),a
    call ChooseItem
    add a,a
    add a,a                 ; four bytes per entry
    ld hl,PartTable
    add hl,a
    ld (CurrentPart),hl
    ret

; Chooses a demo of the current part and returns its entry point in HL, or carry set for SPACE
ChooseDemo:
    ld a,1
    ld (ListBack),a
    call ChooseItem
    ret c
    ld e,a
    ld d,DemoEntrySize
    mul d,e                 ; DE: the entry's offset
    ld ix,(CurrentPart)
    ld l,(ix+2)
    ld h,(ix+3)             ; HL: the part's demo table
    add hl,de
    inc hl
    inc hl                  ; HL: the address of the entry point
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    or a                    ; carry clear
    ret

; Every planned demo's entry point jumps here with its title in HL
NotWritten:
    ld de,$0000
    ld c,TitleAttr
    call PrintText
    ld de,$0200
    ld c,TextAttr
    ld hl,NotWrittenText
    call PrintText
    call WaitForMenu
    ret

CurrentPart:
    .defw PartTable
ListCount:
    .defb 0
ListEntrySize:
    .defb 0
ListBack:
    .defb 0
MenuKeys:
    .defm "123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
MenuTitle:
    .defn "UNRAVELING THE ZX SPECTRUM NEXT"
MenuSubtitle:
    .defn "Volume 1: The Hardware,"
MenuSubtitle2:
    .defn "as a Programmer Sees It"
PartsPrompt:
    .defn "Press the key of a part"
DemosPrompt:
    .defn "Key: run a demo  SPACE: parts"
PlannedNote:
    .defn "Blue: not written yet"
NotWrittenText:
    .defn "This demo is not written yet."
