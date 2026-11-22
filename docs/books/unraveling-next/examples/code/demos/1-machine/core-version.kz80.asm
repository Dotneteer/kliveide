; Demo: Core Version
; Chapter: The FPGA and Its Cores (content/next-fpga-boot.mdx)
;
; Reads the machine ID and the core's version from the NextRegs and prints them.
; Changes nothing, so it has nothing to restore.

CoreVersionTitle:
    .defn "Core Version"

CoreVersion:
    ReadNextReg($00)
    ld (CvMachineId),a
    ReadNextReg($01)
    ld (CvVersion),a
    ReadNextReg($0E)
    ld (CvSubMinor),a

    ld de,$0000
    ld c,$78
    ld hl,CoreVersionTitle
    call PrintText

    ld de,$0300             ; row 3
    ld c,$38
    ld hl,CvMachineText
    call PrintText
    ld a,(CvMachineId)
    call PrintHex8

    ld de,$0500             ; row 5
    ld hl,CvCoreText
    call PrintText
    ld a,(CvVersion)
    rrca
    rrca
    rrca
    rrca
    and $0F                 ; major: the high nibble of NextReg $01
    add a,$30
    call PrintCharNext
    ld a,$2E                ; "."
    call PrintCharNext
    ld a,(CvVersion)
    and $0F                 ; minor: the low nibble
    call PrintDec8
    ld a,$2E
    call PrintCharNext
    ld a,(CvSubMinor)       ; sub-minor: NextReg $0E
    call PrintDec8

    call WaitForMenu
    ret

CvMachineId:
    .defb 0
CvVersion:
    .defb 0
CvSubMinor:
    .defb 0
CvMachineText:
    .defn "Machine ID (NextReg $00): $"
CvCoreText:
    .defn "Core version: "
