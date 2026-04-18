# Practical zxnDMA Examples (Klive Z80 Assembly)

All examples use the `.dma` pragma (requires `.model next`) and the OTIR upload pattern. Each DMA program is
a contiguous byte table streamed to port `$6B` with `OTIR`. Fields that change at runtime are stored as
`.dw 0` labels and patched with `LD (label), reg` before the upload.

---

## Example 1 — Memory Fill (Clear Screen Pixels)

Fill a contiguous memory block with a constant byte. The trick is `wr1 memory, fixed` — Port A reads
the same single-byte address on every transfer cycle while Port B increments through the destination.

```z80klive
;==========================================================
; Example: Memory fill — clear ULA pixel area (6144 bytes)
;==========================================================
; Fills the entire ULA pixel area ($4000–$57FF) with $00.
; Change FillByte before calling to fill with a different value.

FillByte:
    .db $00                                 ; the fill value

dmaFillProgram:
    .dma reset
    .dma wr0 a_to_b, transfer, FillByte, 6144
    .dma wr1 memory, fixed                  ; Port A stays at FillByte
    .dma wr2 memory, increment              ; Port B walks through destination
    .dma wr4 continuous, $4000              ; destination = start of ULA pixels
    .dma wr5
    .dma load
    .dma enable
dmaFillProgram_end:

DmaFillScreen:
    ld hl, dmaFillProgram
    ld b,  dmaFillProgram_end - dmaFillProgram
    ld c,  $6B
    otir
    ret
```

**Key points:**
- `wr1 memory, fixed` is what makes this a fill rather than a copy — Port A never advances.
- To fill with a different value, write it to `FillByte` before calling: `ld a, $FF : ld (FillByte), a`.
- The same pattern works for any contiguous block: change the address in `wr4` and the length in `wr0`.
- At 3.5 MHz with 6 T-states per byte, this clears the screen in ~37,000 T-states (~10.5 ms) —
  over 3× faster than the equivalent `LDIR` loop.

---

## Example 2 — Attribute Paint (Color a Row)

Fill one row of ULA attributes (32 bytes) with a specific ink/paper combination. Uses the same
fixed-source technique as the memory fill, but targets the attribute area.

```z80klive
;==========================================================
; Example: Paint a row of attributes
;==========================================================
; Paints attribute row 0 ($5800–$581F) with bright green ink on black paper.
; To paint a different row, patch dmaAttrDst before calling.

AttrByte:
    .db $00                                 ; attribute value — patched before call

dmaAttrProgram:
    .dma reset
    .dma wr0 a_to_b, transfer, AttrByte, 32
    .dma wr1 memory, fixed
    .dma wr2 memory, increment
    .dma wr4 continuous                     ; Port B address follows as .dw
dmaAttrDst:
    .dw $5800                               ; attribute row start — patchable
    .dma wr5
    .dma load
    .dma enable
dmaAttrProgram_end:

; Paint attribute row
; A  = attribute byte (ink | paper<<3 | bright<<6 | flash<<7)
; HL = attribute row start address ($5800 + row*32)
DmaPaintRow:
    ld (AttrByte), a
    ld (dmaAttrDst), hl
    ld hl, dmaAttrProgram
    ld b,  dmaAttrProgram_end - dmaAttrProgram
    ld c,  $6B
    otir
    ret
```

**Usage:**

```z80klive
    ld a,  attr(COLOR_GREEN, COLOR_BLACK, 1)  ; bright green on black
    ld hl, $5800                              ; row 0
    call DmaPaintRow

    ld a,  attr(COLOR_WHITE, COLOR_BLUE, 0)   ; white on blue
    ld hl, $5800 + 5*32                       ; row 5
    call DmaPaintRow
```

---

## Example 3 — Sprite Pattern Upload (Memory → I/O)

Upload sprite patterns from RAM into the Next's sprite pattern memory via I/O port `$5B`.
This is the most common DMA use case in Next games — it's how you get sprite graphics into
the hardware.

The sprite hardware auto-increments its internal write pointer on each byte written to port `$5B`,
so Port B stays fixed at `$5B` while the DMA streams the data.

```z80klive
;==========================================================
; Example: Upload sprite patterns to sprite RAM via DMA
;==========================================================
; Each 8-bit sprite pattern is 256 bytes (16×16 pixels).
; Select the starting pattern slot BEFORE calling.
;
; Entry: HL = source address of sprite data in RAM
;        BC = number of bytes to upload (e.g. 4*256 = 1024 for 4 patterns)

dmaSpritePgm:
    .dma reset
    .dma wr0 a_to_b, transfer               ; base byte only — address + length follow
dmaSpriteSrc:
    .dw 0                                   ; Port A address — patched
dmaSpriteLen:
    .dw 0                                   ; block length   — patched
    .dma wr1 memory, increment              ; Port A = memory, incrementing
    .dma wr2 io, fixed                      ; Port B = I/O port, fixed address
    .dma wr4 continuous                     ; continuous mode — Port B address follows
    .dw $005B                               ; Port B = sprite pattern data port
    .dma wr5
    .dma load
    .dma enable
dmaSpritePgm_end:

DmaUploadSprites:
    ld (dmaSpriteSrc), hl
    ld (dmaSpriteLen), bc
    ld hl, dmaSpritePgm
    ld b,  dmaSpritePgm_end - dmaSpritePgm
    ld c,  $6B
    otir
    ret
```

**Usage — upload 4 sprite patterns starting at slot 0:**

```z80klive
SpriteData:
    .incbin "sprites.bin"                   ; 1024 bytes of 8-bit pattern data

LoadGameSprites:
    ; Select starting pattern slot
    ld bc, $303B
    ld a,  0                                ; slot 0
    out (c), a

    ; Upload 4 patterns (4 × 256 = 1024 bytes)
    ld hl, SpriteData
    ld bc, 1024
    call DmaUploadSprites
    ret
```

**Key points:**
- `wr2 io, fixed` tells the DMA that Port B is an I/O port whose address does not change.
  Every byte goes to `$5B` while the sprite hardware's internal pointer advances automatically.
- The DMA uses 16-bit port addresses. Port `$5B` is encoded as `$005B` — the high byte is zero.
- For 4-bit sprite patterns (128 bytes per 16×16 sprite), change the byte count accordingly.

---

## Example 4 — Reverse Copy (LDDR Equivalent)

Copy a block where the destination overlaps the source from below. Like `LDDR`, use decrementing
addresses so the copy proceeds from high to low, avoiding data corruption in the overlap zone.

Port A and Port B both use `decrement` mode. The starting addresses point to the **last byte**
of each block (source + length − 1 and destination + length − 1).

```z80klive
;==========================================================
; Example: Reverse block copy (LDDR-style, for overlapping regions)
;==========================================================
; Copies 'length' bytes from source to destination using decrementing addresses.
; Safe when destination overlaps the source from below (dest > source).
;
; IMPORTANT: Starting addresses must be the LAST byte of each block.
;   source_start = source_base + length - 1
;   dest_start   = dest_base   + length - 1

dmaReversePgm:
    .dma reset
    .dma wr0 a_to_b, transfer
dmaRevSrc:
    .dw 0                                   ; Port A start (last byte of source)
dmaRevLen:
    .dw 0                                   ; block length
    .dma wr1 memory, decrement              ; Port A decrements
    .dma wr2 memory, decrement              ; Port B decrements
    .dma wr4 continuous
dmaRevDst:
    .dw 0                                   ; Port B start (last byte of dest)
    .dma wr5
    .dma load
    .dma enable
dmaReversePgm_end:

; Reverse-copy BC bytes from HL to DE (both point to the LAST byte of their block).
DmaReverseCopy:
    ld (dmaRevSrc), hl
    ld (dmaRevDst), de
    ld (dmaRevLen), bc
    ld hl, dmaReversePgm
    ld b,  dmaReversePgm_end - dmaReversePgm
    ld c,  $6B
    otir
    ret
```

**Usage — scroll screen attributes down by one row:**

```z80klive
; Shift attribute rows 0–22 down to rows 1–23 (23 rows × 32 bytes = 736 bytes).
; Source and dest overlap, so we must copy from the END (high addresses) backward.
ScrollAttrsDown:
    ld hl, $5800 + 23*32 - 1               ; last byte of source (row 22 end)
    ld de, $5800 + 24*32 - 1               ; last byte of dest   (row 23 end)
    ld bc, 23*32                            ; 736 bytes
    call DmaReverseCopy
    ret
```

**Key points:**
- `wr1 memory, decrement` and `wr2 memory, decrement` mirror the behavior of `LDDR`.
- Addresses must point to the **last** byte, not the first — the DMA counts down from there.
- For non-overlapping copies, the standard forward copy (Example 6 below) is simpler.

---

## Example 5 — DAC Audio Streaming (Burst Mode + Prescaler)

Stream an audio sample buffer to the SpecDrum-compatible DAC at port `$DF`. Burst mode with a
prescaler gives precise sample timing while letting the CPU run between bytes.

The prescaler formula is: **sample rate = 875 kHz / prescaler**.

| Prescaler | Sample Rate | Quality |
|-----------|-------------|---------|
| 80        | ~10.9 kHz   | Speech, simple effects |
| 55        | ~15.9 kHz   | General purpose |
| 40        | ~21.9 kHz   | Near-telephone quality |
| 20        | ~43.8 kHz   | Near-CD quality |

```z80klive
;==========================================================
; Example: Stream audio to DAC via DMA (burst mode)
;==========================================================
; Streams unsigned 8-bit samples to port $DF at ~15.9 kHz (prescaler 55).
; The CPU is FREE during playback — burst mode releases the bus between samples.

dmaAudioPgm:
    .dma reset
    .dma wr0 a_to_b, transfer
dmaAudioSrc:
    .dw 0                                   ; buffer address — patched
dmaAudioLen:
    .dw 0                                   ; sample count   — patched
    .dma wr1 memory, increment              ; Port A = memory, incrementing
    .dma wr2 io, fixed, 2t, 55             ; Port B = I/O, fixed, 2T cycles, prescaler=55
    .dma wr4 burst                          ; burst mode — CPU runs between samples
    .dw $00DF                               ; Port B = SpecDrum DAC port
    .dma wr5
    .dma load
    .dma enable
dmaAudioPgm_end:

; Stream BC samples from address HL to the DAC
DmaPlayAudio:
    ld (dmaAudioSrc), hl
    ld (dmaAudioLen), bc
    ld hl, dmaAudioPgm
    ld b,  dmaAudioPgm_end - dmaAudioPgm
    ld c,  $6B
    otir
    ret                                     ; returns immediately — DMA streams in background
```

**Usage:**

```z80klive
AudioSamples:
    .incbin "voice.raw"                     ; unsigned 8-bit PCM at 15.9 kHz
AUDIO_LENGTH = $ - AudioSamples

PlayVoice:
    ld hl, AudioSamples
    ld bc, AUDIO_LENGTH
    call DmaPlayAudio
    ; CPU continues executing here while audio plays
    ret
```

**For looping audio** (e.g. a background music sample), change `.dma wr5` to `.dma wr5 auto_restart`:

```z80klive
dmaAudioLoopPgm:
    .dma reset
    .dma wr0 a_to_b, transfer
dmaLoopSrc:
    .dw 0
dmaLoopLen:
    .dw 0
    .dma wr1 memory, increment
    .dma wr2 io, fixed, 2t, 55
    .dma wr4 burst
    .dw $00DF
    .dma wr5 auto_restart                   ; reload addresses and restart on completion
    .dma load
    .dma enable
dmaAudioLoopPgm_end:
```

The DMA replays the buffer endlessly. To stop: `ld bc, $6B : ld a, $83 : out (c), a` (disable command).

**Key points:**
- **Burst mode is essential for audio.** Continuous mode would halt the CPU for the entire playback —
  a 32 KB sample at prescaler 55 would freeze the CPU for ~1.8 seconds.
- The prescaler value is constant across CPU speed changes (3.5, 7, 14, 28 MHz). The FPGA's internal
  timer scales automatically so real-time sample rate stays the same.
- `wr2 io, fixed, 2t, 55` encodes the WR2 base byte, timing byte, and prescaler byte in a single
  readable line — the pragma emits exactly the same three bytes as `DB $68, $22, $37`.
- Port `$DF` writes to DAC channels A+D (SpecDrum-compatible mono/stereo). See the Next I/O port
  documentation for other DAC channel ports.

---

## Example 6 — Generic Runtime-Patched Memory Copy

A reusable `memcpy` routine where source, destination, and length are all patched at runtime.
This is the general-purpose DMA building block.

```z80klive
;==========================================================
; Example: Generic DMA memory copy with runtime patching
;==========================================================
; HL = source address
; DE = destination address
; BC = byte count

dmaCopyPgm:
    .dma reset
    .dma wr0 a_to_b, transfer
dmaCopySrc:
    .dw 0                                   ; Port A address — patched
dmaCopyLen:
    .dw 0                                   ; block length   — patched
    .dma wr1 memory, increment
    .dma wr2 memory, increment
    .dma wr4 continuous
dmaCopyDst:
    .dw 0                                   ; Port B address — patched
    .dma wr5
    .dma load
    .dma enable
dmaCopyPgm_end:

DmaMemCopy:
    ld (dmaCopySrc), hl
    ld (dmaCopyDst), de
    ld (dmaCopyLen), bc
    ld hl, dmaCopyPgm
    ld b,  dmaCopyPgm_end - dmaCopyPgm
    ld c,  $6B
    otir
    ret
```

**Usage:**

```z80klive
    ; Copy 256 bytes from $8000 to $C000
    ld hl, $8000
    ld de, $C000
    ld bc, 256
    call DmaMemCopy

    ; Copy a screen-sized block
    ld hl, BackBuffer
    ld de, $4000
    ld bc, 6912                             ; 6144 pixels + 768 attributes
    call DmaMemCopy
```

**Key points:**
- The DMA program table lives in RAM because `LD (label), reg` must write to it.
- `.dma wr0 a_to_b, transfer` without address/length arguments emits only the WR0 base byte ($7D)
  with all follow-byte indicator bits set. The `.dw 0` labels that follow are consumed as those
  follow bytes. Same principle applies to `.dma wr4 continuous` and its `.dw 0`.
- For non-overlapping copies, this is ~3.5× faster than `LDIR`. For overlapping copies where the
  destination is above the source, use Example 4 (reverse copy) instead.

---

## Example 7 — Upload Sprite Attributes (Batch Positioning)

Update multiple sprite attribute records at once by DMA-streaming them to port `$57`. The Next
sprite hardware auto-increments the attribute slot on each 4-byte or 5-byte write, so a single
DMA transfer can position dozens of sprites in one operation.

Each sprite attribute record is 4 bytes (or 5 bytes with extended attributes):

| Byte | Content |
|------|---------|
| 0    | X position [7:0] |
| 1    | Y position [7:0] |
| 2    | Palette offset [7:4], X mirror [3], Y mirror [2], Rotate [1], X MSB [0] |
| 3    | Visible [7], 5th attr enable [6], Pattern [5:0] |
| 4    | *(5-byte mode only)* Extended: H [0], N6 [1], sub-pattern etc. |

```z80klive
;==========================================================
; Example: Batch-update sprite attributes via DMA
;==========================================================
; Uploads a pre-built attribute table to sprite attribute port $57.
; Build or patch the table in SpriteAttrTable before calling.

; 4-byte attribute records for up to 64 sprites (256 bytes max)
SpriteAttrTable:
    .defs 64 * 4, 0                         ; reserve space for 64 sprites

dmaSprAttrPgm:
    .dma reset
    .dma wr0 a_to_b, transfer
dmaSASrc:
    .dw SpriteAttrTable                     ; defaults to table start
dmaSALen:
    .dw 0                                   ; byte count — patched
    .dma wr1 memory, increment
    .dma wr2 io, fixed                      ; sprite attribute port is I/O, fixed
    .dma wr4 continuous
    .dw $0057                               ; Port B = sprite attribute port
    .dma wr5
    .dma load
    .dma enable
dmaSprAttrPgm_end:

; Upload N sprite attributes starting at slot 0
; B = number of sprites to update (1–64)
DmaUploadSpriteAttrs:
    ; Select sprite attribute slot 0
    ld a, 0
    ld bc, $303B
    out (c), a

    ; Calculate byte count = num_sprites × 4
    ld a, b
    ld c, a
    ld b, 0
    sla c : rl b                            ; BC = N × 2
    sla c : rl b                            ; BC = N × 4
    ld (dmaSALen), bc

    ld hl, dmaSprAttrPgm
    ld b,  dmaSprAttrPgm_end - dmaSprAttrPgm
    ld c,  $6B
    otir
    ret
```

**Usage — position 4 sprites:**

```z80klive
SetupSprites:
    ; Build attribute records in the table
    ld hl, SpriteAttrTable

    ; Sprite 0: x=32, y=48, no mirror/rotate, pattern 0, visible
    ld (hl), 32  : inc hl                   ; X
    ld (hl), 48  : inc hl                   ; Y
    ld (hl), $00 : inc hl                   ; palette=0, no transforms, X MSB=0
    ld (hl), $80 : inc hl                   ; visible, pattern 0

    ; Sprite 1: x=64, y=48, pattern 1, visible
    ld (hl), 64  : inc hl
    ld (hl), 48  : inc hl
    ld (hl), $00 : inc hl
    ld (hl), $81 : inc hl                   ; visible, pattern 1

    ; Sprite 2: x=96, y=48, pattern 2, visible, X-mirrored
    ld (hl), 96  : inc hl
    ld (hl), 48  : inc hl
    ld (hl), $08 : inc hl                   ; X mirror set
    ld (hl), $82 : inc hl                   ; visible, pattern 2

    ; Sprite 3: x=128, y=48, pattern 3, visible
    ld (hl), 128 : inc hl
    ld (hl), 48  : inc hl
    ld (hl), $00 : inc hl
    ld (hl), $83 : inc hl                   ; visible, pattern 3

    ; Upload all 4 at once
    ld b, 4
    call DmaUploadSpriteAttrs
    ret
```

**Key points:**
- Updating sprite attributes via DMA is much faster than individual `OUT` instructions when
  positioning many sprites per frame — games with 20+ active sprites benefit significantly.
- Build the attribute table in RAM, then DMA it in one burst during VBLANK.
- For 5-byte extended attributes, change the multiplier from ×4 to ×5 and enable the 5th-attribute
  flag in each record's byte 3.

---

## Summary — Which Example to Use

| Task | Example | DMA Technique |
|------|---------|---------------|
| Clear/fill screen or buffer | 1 — Memory Fill | `wr1 memory, fixed` (same byte repeated) |
| Color a screen row/region | 2 — Attribute Paint | Fixed source, patchable destination |
| Load sprite graphics | 3 — Sprite Upload | Memory → I/O, `wr2 io, fixed` |
| Overlap-safe copy | 4 — Reverse Copy | `wr1 memory, decrement` + `wr2 memory, decrement` |
| Play audio samples | 5 — Audio Streaming | Burst mode, prescaler, `wr5 auto_restart` for loops |
| General block copy | 6 — Generic Copy | All three addresses patched at runtime |
| Batch sprite positioning | 7 — Attribute Upload | Memory → I/O, attribute table pattern |
