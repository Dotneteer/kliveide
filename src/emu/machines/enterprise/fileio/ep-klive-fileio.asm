; =============================================================================
; Klive's FILE: device for the Enterprise 64/128 (`.plans/ENTERPRISE_PLAN.md` §9.2, D8)
;
; An EXOS extension ROM that adds the device FILE:, whose files are files of the host. Klive's own
; code, written from the EXOS 2.1 kernel specification (the extension ROM header, the device
; descriptor and the device calls). It is assembled by Klive's assembler into
; `src/public/roms/ep-klive-fileio.rom` (`test/machines/ep-fileio-rom.test.ts` checks the image
; against this source; `EP_FILEIO_ROM_WRITE=1` writes it).
;
; Every device call asks the host: it pushes AF (A is the channel number), puts the call's number
; in A and writes it to port BCh, which only Klive answers. The emulated CPU waits there until the
; host has done the work; the host takes the channel from the stack, puts its status in the stacked
; A, and the other results in B, C and DE. POP AF then hands the status back to EXOS.
;
; EXOS pages the ROM into page 3 (C000h) to call it, and reads its header through page 1 (4000h).
; =============================================================================

HOST_PORT       .equ $BC
EXOS_BUFF       .equ 27             ; EXOS: allocate a channel buffer
ERR_ISPEC       .equ $EA            ; .ISPEC: invalid special function code

; --- The host's calls: EXOS's device calls 1-13, and one of Klive's own
FN_OPEN         .equ 1
FN_CREATE       .equ 2
FN_CLOSE        .equ 3
FN_DESTROY      .equ 4
FN_RDCH         .equ 5
FN_RDBLK        .equ 6
FN_WRCH         .equ 7
FN_WRBLK        .equ 8
FN_RSTAT        .equ 9
FN_SSTAT        .equ 10
FN_INIT         .equ 12
FN_ABANDON      .equ 14             ; forget the channel just opened (EXOS gave it no buffer)

; --- A call to the host: A the call's number, the caller's A on the stack
hostcall        .macro(fn)
                push af
                ld a,{{fn}}
                out (HOST_PORT),a
                pop af
                .endm

                .org $C000

; --- The extension ROM header: the signature, the device chain (as page 1 sees it), the entry point
                .defm "EXOS_ROM"
                .defw $4000 + (Chain - $C000)
                ret                 ; the action codes: nothing to do

; --- The device: its pseudo-descriptor, ending with its size, where the chain pointer points
                .defw 0             ; XX_NEXT: no next device
                .defw $FFFE         ; XX_RAM: no device RAM (-2)
Descriptor:
                .defb 0             ; DD_TYPE
                .defb 0             ; DD_IRQFLAG: no interrupts
                .defb 0             ; DD_FLAGS: not a video device
                .defw $4000 + (Entries - $C000) ; DD_TAB (page 1)
                .defb 0             ; DD_TAB_SEG: EXOS fills it in
                .defb 0             ; DD_UNIT_COUNT
                .defb 4             ; DD_NAME
                .defm "FILE"
Chain:
                .defb Chain - Descriptor ; XX_SIZE

; --- The device's 14 entry points (EXOS calls them with this ROM in page 3)
Entries:
                .defw Interrupt, Open, Create, Close, Destroy, ReadChar, ReadBlock
                .defw WriteChar, WriteBlock, ReadStatus, SetStatus, Special, Init, BufferMoved

Interrupt:
BufferMoved:
                ret

Special:
                ld a,ERR_ISPEC
                ret

Open:
                hostcall(FN_OPEN)
                jr Allocate

Create:
                hostcall(FN_CREATE)

; --- An opened channel needs a channel buffer, even an empty one (EXOS 27, the kernel spec §7.3)
Allocate:
                or a
                ret nz
                ld de,1
                ld bc,0
                rst $30
                .defb EXOS_BUFF
                or a
                ret z
                hostcall(FN_ABANDON)
                ret

Close:
                hostcall(FN_CLOSE)
                ret

Destroy:
                hostcall(FN_DESTROY)
                ret

ReadChar:
                hostcall(FN_RDCH)
                ret

ReadBlock:
                hostcall(FN_RDBLK)
                ret

WriteChar:
                hostcall(FN_WRCH)
                ret

WriteBlock:
                hostcall(FN_WRBLK)
                ret

ReadStatus:
                hostcall(FN_RSTAT)
                ret

SetStatus:
                hostcall(FN_SSTAT)
                ret

Init:
                hostcall(FN_INIT)
                ret
