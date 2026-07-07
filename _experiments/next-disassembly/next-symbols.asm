; ZX Spectrum Next ROM disassembly symbols
; Shared RAM/state addresses confirmed during ROM0 annotation.

; Temporary BC save slot used by ROM trampoline/cross-ROM call helpers.
TMPBC           .equ $5B54

; Display-state swap record. ROM0 copies the initial six-byte record from
; $035A at startup; L0EE8 swaps the saved values with live display state.
DISP_MODE       .equ $D5B8       ; Display/mode marker shared with other ROMs
DISP_GMODE      .equ $D5B9       ; GMODE swap byte
DISP_L2SOFT     .equ $D5BA       ; L2SOFT / port $123B Layer 2 control swap byte
DISP_CPUSPEED   .equ $D5BB       ; NextReg $07 CPU-speed bits swap byte
DISP_CHARS      .equ $D5BC       ; CHARS pointer low-byte swap slot
DISP_CHARS_H    .equ $D5BD       ; CHARS pointer high-byte swap slot
DISP_REC_END    .equ $D5BE       ; First byte after the display-state swap record

; Display-state/palette slots. INIT_DISP_SLOT builds 96-byte records from
; templates; SAVE_DISP_STATE stores the current hardware state into save slots.
DISP_SLOT0      .equ $D633       ; Primary display-state template destination
DISP_SLOT1      .equ $D6DA       ; Alternate display-state template destination
DISP_SAVE0      .equ $D694       ; Current-state save slot used for one mode path
DISP_SAVE1      .equ $D5ED       ; Current-state save slot used for alternate path

; Display/menu parameters used while building boot/display request records.
DISP_PARAM0     .equ $D73D       ; Width/count parameter initialized to $0020
DISP_PARAM1     .equ $D73F       ; Companion parameter initialized to $0023

; Startup menu parser/renderer state.
MENU_BODY       .equ $D742       ; Pointer to active menu section body
MENU_SECTION    .equ $D744       ; Active/pending startup menu section number
MENU_CHOICE     .equ $F700       ; Last/current selected menu entry index
MENU_KEYS       .equ $F701       ; Hotkey table for rendered menu entries
MENU_PTRS       .equ $F70B       ; Word table of pointers to menu entry text
MENU_LAST       .equ $F71F       ; Last rendered menu entry index
MENU_WORK       .equ $F720       ; 2K startup menu script/config work buffer

; Boot/game command buffers used by startup menu command dispatch.
BOOT_STR        .equ $DA31       ; Boot/game string copied from "g" menu commands
BOOT_REQ        .equ $E090       ; Boot request marker/buffer used by "b" commands
