; =============================================================================
; Klive's boot loader for the SAM Coupé (`dev/plans/SAM_COUPE_PLAN.md` §3.4, §9.3, D7)
;
; Klive's own code, written from the research pack's facts (STORAGE_FIRMWARE_SOFTWARE.md §3.2, §4): no
; DOS is needed. It is the first file of a disk Klive builds (`src/common/samcoupe/samBootDisk.ts`): the
; ROM's F9 / BOOT reads track 4 sector 1 into the page below the screen at 8000h, checks "BOOT" at byte
; 256 and jumps to 8009h, past the file's 9-byte header.
;
; The loader reads directory entry 1 (the second half of track 0 sector 1): the program, a CODE file,
; with its start page and offset, its length and its exec page and offset. It talks to the first drive's
; VL1772 itself (Restore, Seek, Read Sector with DRQ polling), walks the file's sector chain (510 data
; bytes and a track/sector link each) and copies the data through sections A and B (LMPR = RAM0 | page),
; then pages the program in as Run does (ROM0, page 0 in section B, HMPR = 1 for an exec address in
; pages 0-2) and jumps to it with interrupts on. A read error or a disk without a program file ends in
; a SAM BASIC error report (RST 8, "Loading error").
;
; It is assembled by Klive's assembler into `src/public/sam/sam-klive-boot.bin` (the file's data from
; 8009h; `test/machines/sam-klive-boot.test.ts` checks the image against this source, and
; `SAM_BOOT_WRITE=1` writes it).
; =============================================================================

LMPR            .equ $FA
HMPR            .equ $FB
FDC             .equ $E0            ; drive 1: E0h-E3h side 1, E4h-E7h side 2
BUFFER          .equ $8200          ; one sector, in this page past the boot sector
STACK           .equ $8500
TRAMPOLINE      .equ $4B00          ; page 0's file-header buffer (HDR), free while no DOS runs
ERR_LOADING     .equ 19             ; the ROM's "Loading error"

                .org $8009
                jp Start

; --- Variables
SavedLmpr:      .defb 0
SavedSp:        .defw 0
DestPage:       .defb 0
Remaining:      .defb 0, 0, 0       ; bytes still to copy, 24 bits
NextTrack:      .defb 0
NextSector:     .defb 0
FirstSector:    .defb 0             ; 1 while the first sector (with the 9-byte header) is read
ExecPage:       .defb 0
ExecOffset:     .defw 0

; --- Waits for the controller (C = its status port); returns the status in A
WaitReady:
                in a,(c)
                bit 0,a
                jr nz,WaitReady
                ret

; --- Reads track D (bit 7: side 2), sector E into BUFFER; NZ on an error
ReadSector:
                ld a,d
                and $80
                rrca
                rrca
                rrca
                rrca
                rrca                ; the side as A2: 00h or 04h
                or FDC
                ld c,a
                ; --- Seek: the cylinder into the data register, then the command
                ld a,d
                and $7F
                inc c
                inc c
                inc c
                out (c),a           ; data register
                dec c
                ld a,e
                out (c),a           ; sector register
                dec c
                dec c
                ld a,$10
                out (c),a           ; SEEK, 6 ms steps, spin-up
                call WaitReady
                ld hl,BUFFER
                ld a,$80
                out (c),a           ; READ SECTOR
ReadLoop:
                in a,(c)
                bit 1,a
                jr nz,ReadByte
                bit 0,a
                jr nz,ReadLoop
                and $1C             ; record not found, CRC error, lost data
                ret
ReadByte:
                inc c
                inc c
                inc c
                ini
                dec c
                dec c
                dec c
                jr ReadLoop

; --- The program's paging and the jump (in page 0, where it survives the HMPR change)
Exec:
                ld a,(SavedLmpr)
                and $BF             ; ROM1 off: page 2 shows at C000h
                out (LMPR),a
                ld hl,$79ED         ; OUT (C),A
                ld (TRAMPOLINE),hl
                ld hl,$E9FB         ; EI ; JP (HL)
                ld (TRAMPOLINE + 2),hl
                ld hl,(ExecOffset)
                ld a,(ExecPage)
                cp 3
                jr nc,ExecOwnPage
                ; --- Pages 0-2: HMPR = 1, the address as Run's paging shows it
                ld de,$4000
                or a
                jr z,ExecLow
                cp 2
                jr nz,ExecRun
                add hl,de           ; page 2: C000h-FFFFh
                jr ExecRun
ExecLow:
                sbc hl,de           ; page 0: 4000h-7FFFh (carry is clear)
ExecRun:
                ld a,1
ExecOwnPage:
                ld sp,(SavedSp)
                ld c,HMPR
                jp TRAMPOLINE

; --- A loading error: SAM BASIC's report
Fail:
                call Restore
                rst $08
                .defb ERR_LOADING

; --- BASIC's paging and stack back, interrupts on; returns to the caller on that stack
Restore:
                pop hl
                ld a,(SavedLmpr)
                out (LMPR),a
                ld sp,(SavedSp)
                ei
                jp (hl)

; --- The tag the ROM looks for, at byte 256 of the boot sector
                .org $8100
                .defm "BOOT"

Start:
                di
                ld (SavedSp),sp
                ld sp,STACK
                in a,(LMPR)
                ld (SavedLmpr),a
                ; --- Restore, then the directory's first sector (track 0, sector 1)
                ld c,FDC
                xor a
                out (c),a
                call WaitReady
                ld de,$0001
                call ReadSector
                jp nz,Fail
                ; --- Entry 1 (the second half of the sector): a file there?
                ; --- IX at the entry's byte 128: displacements are -128..127
                ld ix,BUFFER + 256 + 128
                ld a,(ix - 128)
                and $3F
                jp z,Fail
                ld a,(ix + 108)
                and $1F
                ld (DestPage),a
                ld l,(ix - 115)
                ld h,(ix - 114)
                ld (NextTrack),hl
                ; --- The length: pages x 16384 + the length mod 16384
                ld a,(ix + 112)
                ld (Remaining),a
                ld a,(ix + 111)
                ld b,a
                ld a,(ix + 113)
                and $3F
                ld c,0
                srl b               ; pages x 64 as the high byte, x 16384 overall
                rr c
                srl b
                rr c
                or c
                ld (Remaining + 1),a
                ld a,b
                ld (Remaining + 2),a
                ld a,(ix + 114)
                ld (ExecPage),a
                ld l,(ix + 115)
                ld h,(ix + 116)
                ld (ExecOffset),hl
                ; --- The destination: section A at the start offset - 8000h
                ld l,(ix + 109)
                ld h,(ix + 110)
                res 7,h
                ex de,hl
                ld a,1
                ld (FirstSector),a
NextChunk:
                ld hl,(NextTrack)   ; L the track, H the sector
                ld a,l
                or h
                jr z,Loaded
                push de
                ld d,l
                ld e,h
                call ReadSector
                pop de
                jp nz,Fail
                ld hl,(BUFFER + 510)
                ld (NextTrack),hl
                ; --- The chunk: 510 bytes, past the header in the first sector
                ld hl,BUFFER
                ld bc,510
                ld a,(FirstSector)
                or a
                jr z,ChunkSize
                xor a
                ld (FirstSector),a
                ld hl,BUFFER + 9
                ld bc,501
ChunkSize:
                ; --- No more than what remains
                ld a,(Remaining + 2)
                or a
                jr nz,ChunkCopy
                push hl
                ld hl,(Remaining)
                or a
                sbc hl,bc
                pop hl
                jr nc,ChunkCopy
                ld bc,(Remaining)
ChunkCopy:
                ; --- Remaining -= BC
                push hl
                ld hl,(Remaining)
                or a
                sbc hl,bc
                ld (Remaining),hl
                ld a,(Remaining + 2)
                sbc a,0
                ld (Remaining + 2),a
                pop hl
                ld a,b
                or c
                jr z,Loaded
                ; --- Page the destination into sections A and B and copy
                ld a,(DestPage)
                or $20
                out (LMPR),a
                ldir
                ; --- Past section A: the next page
                bit 6,d
                jr z,NextChunk
                res 6,d
                ld a,(DestPage)
                inc a
                and $1F
                ld (DestPage),a
                jp NextChunk
Loaded:
                ld a,(ExecPage)
                cp $FF
                jp nz,Exec
                ; --- No exec address: back to BASIC
                call Restore
                ret
