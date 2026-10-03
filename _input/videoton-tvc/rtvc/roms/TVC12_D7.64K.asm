; -----------------------------------------------------------------------------
; TVC BASIC 1.2 EXTH ROM - TVC12_D7.64K
; Source: roms/TVC12_D7.64K
; ORG: E000H
; Size: 8192 bytes
; Instructions use CPU-visible addresses at ORG; the ROM bank is recorded separately.
; Physical bank: EXTH offset 0000H
; CPU-visible aliases: E000H
; Data ranges: E000H-EFFFH, F291H-F29BH, F3C6H-F3D7H, F741H-F77AH
; Auto labels: branch and call targets are emitted as Lxxxx.
; This is a standalone listing; all required technical explanations are embedded here.
; Technical descriptions are based on the Kaszanyiczki and Ludanyi TVC ROM references.
; -----------------------------------------------------------------------------

; =============================================================================
; EXTENSION PAGE AND CARD IOMEM CONTRACT
; =============================================================================
; The EXT physical segment is visible only in CPU page 3 (E000H-FFFFH). The lower half of that
; page can be replaced by the selected expansion-card IOMEM; the upper 8 KiB remains the extension
; ROM.
; Port 03 bits 7-6 select card IOMEM slot 0-3. Card selection is shared with the keyboard row low
; nibble, so extension routines use the 0B11H mirror and preserve the other field.
; A card supplies the mandatory initialization, character/block function, and interrupt entry
; points expected by the cards device class. The ROM records the assigned base slot in 0B1CH or FF
; when no card is installed.
; The serial USART pairs are at slot-relative data/status addresses 10H/11H, 20H/21H, 30H/31H, and
; 40H/41H. Select the card IOMEM before using the pair and restore the caller's page on return.
; Extension initialization probes card signatures, installs or rejects card handlers, initializes
; serial format/divider state, and returns through the SYS/U0 bridge. A failed probe must leave
; the device selector disabled rather than dispatching through uninitialized IOMEM.
; Card IRQs are represented by IRQ-STAT bits 2-5 and INT-DES bits 4-7. The shared interrupt tail
; restores the prior mapping and AF; card handlers must clear their hardware source before taking
; that tail.
; The final extension gateway is a page-sensitive call target. Standalone annotations should
; identify its EXTH physical offset and describe the CPU-visible E000H-FFFFH view separately from
; SYS routines in the same range.

; =============================================================================
; EXTENSION MEMORY VIEW AND RESET OWNERSHIP
; =============================================================================
; The EXTH physical image is an 8 KiB extension ROM at physical offsets 1000H-1FFFH, visible as
; CPU F000H-FFFFH when page 3 is mapped to EXT. Physical offsets 0000H-0FFFH are FFH filler in
; BASIC 1.2.
; The lower 8 KiB of the CPU EXT view (E000H-EFFFH) is not extension code in this ROM: the mapper
; can expose the selected card's IOMEM there. Never use a CPU E000H address as an EXTH identity
; without checking the page and physical offset.
; EXT_INIT is entered after SYS has decided warm versus cold reset. It establishes the
; U0-U1-VID-EXT working map, copies templates into U0, discovers connectors, initializes cards,
; then returns to the SYS continuation through the FFF0H gateway.
; The extension owns the reset-time transition between the U0-U1-VID-EXT working map and the
; normal U0-U1-U2-SYS map. Any asynchronous exit from an extension routine must restore the saved
; page register before returning to SYS.
; The page register is written through port 02H. Card IOMEM selection is independent state in port
; 03H bits 7-6; the low nibble simultaneously selects the keyboard row, so extension code must
; preserve both fields that it does not own.

; =============================================================================
; RESET COPIES AND U0 TEMPLATE LAYOUT
; =============================================================================
; On a cold reset EXT_INIT copies 32 ten-byte accented or semigraphic character matrices from the
; extension ROM into U0 character RAM at 0740H, then clears the remaining 64 user-character slots.
; The initialization template supplies the default input assignment bytes at U0 0B00H-0B07H and
; output assignment bytes at 0B08H-0B0FH. It also supplies the RST30 and interrupt entry bytes at
; U0 0030H-003FH.
; A second template fragment is copied to U0 0B23H-0B48H. It contains the page-saving
; function-call bridge, the RST30 post-byte reader, the SYS dispatch transfer, and the interrupt
; restore/RETI tail.
; The copied bridge saves the caller's current page at U0 0003H, maps the selected U0/U1/U2/SYS
; arrangement, and reaches the SYS dispatcher. Its return restores page and AF; callers must
; return through that RAM code.
; Cold initialization starts INT-DES with the built-in video/keyboard sources active, initializes
; the port mirrors, and writes 0F10H as the graphics stack floor at 0B17H-0B18H. Warm reset
; preserves tested RAM state where the integrity check permits it.
; Card descriptors are built in four U0 records beginning at 0040H, 0070H, 00A0H, and 00D0H. Each
; record has a fixed stride of 30H bytes; name/type data and an assigned unit number are kept in
; the record for later dispatch.

; =============================================================================
; CARD DISCOVERY AND IDENTIFICATION
; =============================================================================
; EXT_INIT reads four two-bit connector identifiers from port 5AH, selects each connector's IOMEM
; with port 03H, and copies an identifying descriptor into that connector's U0 record.
; Recognized built-in identifiers include RS232 for serial, VGB for a game/program module, and
; DISK for a disk interface. An unrecognized connector is accepted only when its card memory
; begins with the ASCII signature MOPS.
; A connector that is empty, lacks MOPS, or fails name matching receives FFH in its descriptor.
; Dispatch must treat that value as unavailable and must not enter the card's 0C00BH or 0C00DH
; locations.
; The descriptor name is length-prefixed and copied from ROM or card memory. The startup scan
; compares names, then increments the unit field for identical names so multiple cards of one type
; receive units 0 through 3.
; The first RS232 connector found becomes the default serial assignment in the final input/output
; selector entries and is also recorded at 0B1CH. If no serial card is present, 0B1CH is FFH.
; The card scan is deliberately tolerant of unsupported hardware: recognized cards are initialized
; by contract, while unidentified cards remain inert. This fallback prevents a random IOMEM image
; from becoming an executable device.

; =============================================================================
; CARD INITIALIZATION CONTRACT
; =============================================================================
; Every identified non-serial card is paged into CPU page 3 and must provide a two-byte
; initialization target at card address 0C00BH. EXT_INIT calls that target through the indirect
; FFF9H gateway.
; The card's counted function table begins at card address 0C00DH. Its first byte is the highest
; supported function count; following entries are two-byte routine addresses indexed by the
; logical function number.
; The card interrupt target is read from card address 0C00EH by the expansion IRQ dispatcher. A
; card handler must clear or acknowledge its own hardware source before returning to the shared
; interrupt tail.
; A missing descriptor, out-of-range function number, or missing table returns the
; unavailable-device status and repairs the affected logical assignment from the reset defaults.
; It must not leave a selector pointing at a card that was just rejected.
; The extension selects a card by writing its connector number into port 03 bits 7-6 and then
; calls the card routine with the card IOMEM visible. Card code must not assume that SYS or U0
; remains visible in the other pages.
; The built-in serial device is the exception to the external function-table rule: its service
; table is in EXTH and is selected after the serial card has been identified.

; =============================================================================
; EXPANSION DISPATCH AND IRQ CONVENTIONS
; =============================================================================
; Expansion input dispatch receives the connector and function class, indexes the selected input
; table, pages the connector, then enters the class routine. Output dispatch obtains the connector
; from the output selector's final assignment entry.
; The connector number is validated before it is shifted into port 03 bits 7-6. Invalid values and
; FFH descriptors take the common error path and leave the prior page/selector state intact.
; The expansion IRQ path receives active-low request bits in C bits 3-0. It rotates through
; requesting connectors, selects each one, reads its 0C00EH vector, calls the handler, and
; continues until all pending requests are serviced.
; After card service the dispatcher restores the original port-03 selection and rejoins the SYS
; interrupt handler. Card code therefore owns only its private IOMEM and hardware acknowledge, not
; the global mapping.
; Card block helpers accept DE as source or destination and BC as a byte count. They compare the
; transfer address with HI-MEM at 0B19H before each byte, stop on overflow, and propagate the
; character routine's first error.

; =============================================================================
; LOGICAL DEVICE ASSIGNMENT AND FALLBACK
; =============================================================================
; The eight logical classes are video, keyboard, editor, sound, printer, cassette, cards, and
; kernel/connector selection. The selectors copied to U0 are the policy layer; EXTH dispatch is
; the mechanism layer.
; Default input selectors are video=FFH, keyboard=01H, editor=02H, sound=FFH, printer=FFH,
; cassette=05H, cards=06H, and kernel=FFH. Default outputs are video=00H, keyboard=FFH,
; editor=02H, sound=FFH, printer=04H, cassette=05H, cards=06H, and kernel=FFH.
; During card discovery the serial class is assigned to the lowest-numbered RS232 connector.
; Duplicate cards keep the same logical class but receive distinct unit bytes in their descriptor
; records.
; An unavailable device is represented by FFH in the relevant selector. Device calls must return
; the common unavailable status rather than silently falling through to the built-in serial or
; cassette routines.
; Initialization and recovery paths may rewrite the selectors after a failed probe. A caller
; should read the selector at dispatch time, not cache a card number across a reset, device close,
; or interrupt.
; The function byte after RST30H carries direction in bit 7, class in bits 6-4, and routine number
; in bits 3-0. This lets BASIC/editor callers stay independent of the physical card layout.

; =============================================================================
; SERIAL SERVICE TABLE AND BAUD DIVISORS
; =============================================================================
; SERIAL_JUMP_TABLE is a counted table with five services: reserved entry, character I/O, block
; I/O, SER-SET, and a CLOSE-compatible no-op. Its addresses point into the F2xx-F3xx serial
; implementation.
; SERIAL_INIT writes BAUD=04H and FORMAT=EEH, selecting 1200 bit/s, two stop bits, no parity,
; eight data bits, and a 16-times clock before entering SER-SET.
; BAUD values 00H-08H select 110, 150, 300, 600, 1200, 2400, 4800, 9600, and 19200 bit/s. Values
; above 08H are clamped to 08H instead of indexing past the divisor table.
; The EXTH divisor table stores low/high words for BAUD 0..8: 0C88H, 0D75H, 0EBAH, 0F5DH, 0FAFH,
; 0FD7H, 0FECH, 0FF6H, and 0FFBH. The high nibble is combined with the port-05 mirror.
; SER-SET clears sound volume while the serial clock is active, preserves cassette motor bits,
; writes the divider through ports 04H/05H, and programs the selected USART command port. It
; clears SER-OK while changing timing and sets it clear-to-valid on completion.
; The four USART pairs are selected as command/status and data ports 11H/10H, 21H/20H, 31H/30H, or
; 41H/40H. The pair is derived from port 03's connector selection; do not use a hard-coded pair
; for a movable card.

; =============================================================================
; SERIAL CHARACTER AND BLOCK TRANSFERS
; =============================================================================
; SER-CHOUT enters with C=character. It waits for an active tone to finish, checks STOP-FLAG,
; derives the selected USART port, reinitializes timing if SER-OK is invalid, enables
; transmission, waits for status bits 7 and 0, then writes the character.
; SER-CHIN derives the USART pair and first checks receive-ready status bit 1. If no byte is
; pending it temporarily disables interrupts, enables receiver/transmitter operation, and polls
; both USART status and the CTRL+ESC keyboard row.
; On input the USART error mask is tested for parity, overrun, and framing faults. The routine
; issues the USART error-clear command, returns the received byte in C, and maps the error to a
; distinct status instead of handing corrupted data to BASIC.
; A serial STOP returns F5H. The polling loops test STOP-FLAG, so a blocked character transfer can
; be cancelled without requiring a reset or a second device interrupt.
; SER-BKOUT accepts DE=source and BC=count; SER-BKIN accepts DE=destination and BC=count. Both
; delegate to the shared HI-MEM-bounded byte loop and propagate serial, memory-limit, and STOP
; status.
; SER-CHIN and SER-CHOUT may change the page register, divider, USART command state, and interrupt
; mask. Callers must return through the device bridge and must not assume the card IOMEM remains
; selected.

; =============================================================================
; SERIAL WORKSPACE AND TIMING OWNERSHIP
; =============================================================================
; BAUD is at U0 0B69H and FORMAT at 0B6AH. SER-SET also changes the port-04 low divider byte,
; port-05 divider/enables, port-06 volume, and the selected card's USART mode registers.
; SER-OK at 0B71H is zero when the shared divider is synchronized for serial. Sound and cassette
; timing deliberately invalidate it; the next character operation must run SER-SET before using
; the USART.
; The serial device owns the divider frequency but not the cassette motors. SER-SET preserves
; port-05 bits 7-6 so serial traffic cannot accidentally stop a tape drive selected by another
; logical operation.
; The serial polling path watches the CTRL+ESC matrix row while interrupts are masked. The row
; selection is written through the port-03 mirror and must be restored before returning to normal
; keyboard scanning.
; The external card's IOMEM is a transient window. Any local serial buffer or card state that must
; survive a page switch belongs in U0 or the card's own memory, not in the currently mapped EXT
; lower half.
; A CLOSE dispatch to the serial table is intentionally harmless. It exists so generic
; device-closing code can call every selected class without inventing a serial-specific close
; protocol.

; =============================================================================
; CASSETTE ENTRY STUBS AND FILE LIFECYCLE
; =============================================================================
; The EXTH cassette stubs split character and block direction, call the low-level
; buffered/unbuffered implementation, and return through the common F3F4H path. F3F4H loads the
; SYS D4 return target D9E7H and crosses FFF0H.
; CAS-OPEN (D3H) receives DE=filename and returns the canonical filename address in DE with A=00
; on success. It rejects an already-open input file, clears 0BF3H-0D13H, normalizes the requested
; name, and searches tape headers.
; Names are length-prefixed, capped at 10H characters, and folded to uppercase ASCII. A
; zero-length requested name is a wildcard that accepts the first valid file header; a nonzero
; name is compared against the normalized name read from tape.
; A successful open records the file type, protection, sector number/count, first destination or
; buffer address, and remaining byte count. It displays the search/found/reading status through
; the selected output device but the state bytes are the API contract.
; CAS-CRTE (53H) receives DE=filename, rejects an existing open file or a protected target,
; normalizes the name into the output workspace, copies it into the first output buffer, and sets
; the output type to buffered (01H) or unbuffered (11H).
; CAS-CLOSE flushes any partial buffered output exactly once, clears open/protection state, resets
; MUDDLE/CRC to zero, stops the selected motor, and restores the pre-tape interrupt configuration.

; =============================================================================
; CASSETTE FILE STATE AND BUFFER OWNERSHIP
; =============================================================================
; Input state uses 0BF3H for open/type, 0BF4H for the requested filename, 0C05H for the name read
; from tape, and 0C16H-0D04H for the active input buffer.
; Input counters at 0D05H-0D0AH hold bytes read, next input pointer, and bytes remaining. 0D0BH
; holds the current error, 0D0CH protection, 0D0DH sector number, and 0D0EH the sector-end marker.
; Output state uses 0D14H for open/type, 0D15H for the normalized name, 0D26H-0E25H for the output
; buffer, 0E26H-0E29H for count and next-byte pointer, and 0E2AH-0E32H for error, source, file
; type, protection, and header/data phase.
; Buffered character input consumes the current sector until the count reaches zero, then loads
; the next sector unless the prior marker was FFH. A 00H marker means another sector; FFH becomes
; EOF.
; Buffered character output appends to the output buffer and invokes the physical writer at 256
; bytes. A partial sector remains owned by the output state until CAS-CLOSE or an explicit block
; flush.
; Unbuffered block operations bypass the character buffer and pass the caller's DE/BC directly to
; the physical reader/writer. VERIFY applies to the physical block path as well as buffered
; character comparisons.
; The input and output buffers occupy adjacent shared U0 workspace. No editor or BASIC scratch
; allocation may overlap them while a cassette file is open; the open flags are the ownership
; lock.

; =============================================================================
; CASSETTE BLOCK RECORD FORMAT
; =============================================================================
; A physical write begins with a pilot waveform, synchronization periods, an empty synchronization
; byte, and marker 6AH. The marker is followed by block metadata and then one or more sector
; records.
; The block type byte is FFH for a header block and 00H for a data block. File type distinguishes
; buffered and unbuffered files; the protection byte records write protection; the sector count
; and byte count describe the transfer.
; Each data sector carries a sector number, a byte-count byte, payload bytes, a sector-end marker,
; and a two-byte CRC. A byte-count of 00H denotes a full 256-byte sector; a nonzero count is the
; final partial sector length.
; The sector-end marker is 00H for an intermediate sector and FFH for the final sector of the
; file. The reader stores it in 0D0EH and only promotes FFH to the EOF variable after the final
; payload has been consumed.
; The header carries the normalized filename and the initial transfer metadata. OPEN compares the
; name before accepting the file, while the data path checks sector sequence, lengths, protection,
; and CRC.
; The physical writer increments the sector number and source address after each sector. The last
; sector's partial count is emitted instead of padding the data area, so the reader must honor the
; count rather than always consuming 256 bytes.
; A physical read failure preserves the current error and sector state long enough for OPEN or the
; block caller to retry. CTRL+ESC takes a separate abort path that clears open/CRC state before
; returning.

; =============================================================================
; CASSETTE READ TIMING AND DECODING
; =============================================================================
; CAS-READ-PHYSICAL-BLOCK starts the selected read motor, enables the cassette timing interrupt,
; measures the pilot waveform, locks to synchronization, and expects marker 6AH before accepting
; block metadata.
; The input signal is port 59 bit 5. A half-bit primitive waits for an input transition and
; returns its elapsed divider count; a full-bit measurement waits for both levels and uses the
; period to distinguish one and zero timings.
; CAS-READ-BYTE assembles eight measured bits in H, updates CRC for each bit, and returns the byte
; in the order used by the tape serializer. D carries the calibrated full-wave period supplied by
; the synchronization phase.
; The reader checks block type, file type, protection, sector number, byte count, sector-end
; marker, and CRC. A wrong sequence or short block is rejected even if the waveform itself remains
; synchronized.
; Buffered reads store payload bytes in 0C16H or the active sector buffer; VERIFY compares each
; decoded byte with the caller's memory instead. Unbuffered reads can deliver the physical block
; directly to the caller's DE/BC range.
; The reader may retry a failed waveform/header read, but CTRL+ESC ends the retry loop. Every
; failure path returns through interrupt restoration so the normal cursor, card, sound, and
; keyboard services are not stranded disabled.
; Read timing resets and acknowledges the divider interrupt after each transition. Border changes
; are diagnostic activity feedback only; they do not encode the data format.

; =============================================================================
; CASSETTE WRITE WAVEFORM AND TIMING CONSTANTS
; =============================================================================
; The writer starts the selected motor, waits for speed to settle, enables the cassette timing
; service, emits a pilot, emits synchronization, writes marker 6AH and metadata, then serializes
; sectors and CRC.
; The timing constants at FAF3H-FAF6H are D6H for pilot, DEH for a one bit, CEH for a zero bit,
; and BCH for synchronization. They are low divider bytes used by the timed transition primitive.
; CAS-WRITE-BYTE serializes the byte least significant bit first. Each bit emits a transition at
; the selected one/zero period, updates CRC, emits the complementary transition, and repeats for
; eight bits.
; CAS-WRITE-PERIODS emits B times C half-period transitions and is used for pilot,
; synchronization, and the five-period trailer. It does not write payload bytes or update CRC.
; A full 256-byte sector is represented on tape by count 00H; the final partial sector writes its
; remaining count. After payload, the writer emits the sector-end byte and the sector CRC, then
; advances source, remaining count, and sector number.
; The timing primitive waits for the interrupt, toggles port 50H, writes the current divider value
; to port 04H, acknowledges the timing source, and checks CTRL+ESC between transitions.
; The writer cannot verify whether the recorder accepted the waveform. Its correctness boundary is
; the generated timing and CRC; physical media faults are detected only on a later read or VERIFY.

; =============================================================================
; CASSETTE CRC AND MUDDLE SEED
; =============================================================================
; CAS-CRC-UPDATE keeps the running two-byte checksum in HL'. The input Z state supplies the
; current bit; the routine combines it with the CRC high bit, conditionally toggles H bit 3 and L
; bit 4, then shifts the pair.
; The same bit update runs while writing and reading. The writer emits the resulting CRC low/high
; bytes after each sector; the reader compares the received pair with its computed value before
; accepting the sector.
; MUDDLE at U0 0B6FH-0B70H supplies the initial CRC seed. Normal initialization and CLOSE clear it
; to zero, but a nonzero seed can be used as a simple file password when both sides know the
; value.
; CRC is per sector rather than one checksum for the whole file. A successful intermediate sector
; leaves the running file state ready for the next sector; a failed CRC returns a cassette read
; error and does not advance the logical payload pointer.
; VERIFY does not bypass CRC: it validates the physical sector first, then compares decoded
; payload bytes to memory. A mismatch returns E8H with DE at the mismatch and BC as the remaining
; length.
; Changing MUDDLE while a file is open invalidates the remaining sectors. Callers should set the
; seed before OPEN/CRTE and leave it unchanged until CLOSE.

; =============================================================================
; TAPE INTERRUPT TAKEOVER AND RESTORATION
; =============================================================================
; CAS-ENABLE-TAPE-INTERRUPT enters with interrupts disabled. It disables card, cursor, sound, and
; normal keyboard work, clears the divider state, invalidates SER-OK, and leaves only the CTRL+ESC
; keyboard row observable.
; The routine preserves cassette motor bits while disabling sound, programs the divider for
; timing, acknowledges the previous interrupt source, and disables the CRTC cursor. It replaces
; the first byte at 0038H with C9H and saves the original byte in 0BF2H.
; During tape transfer the timing interrupt drives port-50 transitions or measures port-59
; transitions. Normal card handlers must not run inside this critical window because they can
; change the divider or mapper.
; CAS-RESTORE-INTERRUPTS stops both motors, restores port-03 and port-05 from their U0 mirrors,
; reinstates the cursor interrupt when it was previously enabled, and restores the saved 0038H
; byte.
; The restore path re-enables each previously active card source in the original order and finally
; enables interrupts. It returns carry to the physical transfer caller so a successful restore is
; distinguishable from an aborted transfer.
; Any error, EOF, protection failure, CRC mismatch, or STOP path must converge on the same
; restoration sequence. Returning directly to BASIC with 0038H still C9H would disable the system
; interrupt chain.

; =============================================================================
; GATEWAYS, RETURN MAPS, AND EXTENSION CAVEATS
; =============================================================================
; FFF0H is the page-and-call gateway in the EXTH image at the CPU FFF0H view. It saves AF, selects
; the U0-U1-VID-EXT arrangement in port 02H, restores AF, and falls through to FFF9H, which
; performs JP (HL).
; FFF9H is an indirect call gateway, not a normal subroutine return. The target routine must
; eventually return through a RAM bridge that restores the caller's saved page and register state.
; The cassette stubs use F3F4H to load HL=D9E7H, the SYS D4 cassette return stub, and then enter
; FFF0H. This is why the physical cassette implementation can live in EXTH while its device-class
; entry remains in SYS.
; Card initialization and IRQ dispatch use the same indirect gateway but with card IOMEM selected.
; A card routine must return normally; jumping into SYS or another card without the bridge leaves
; page 3 selected and corrupts subsequent dispatch.
; SYS and EXTH both occupy CPU C000H-FFFFH under different page selections. Standalone labels in
; this appendix are EXTH physical identities; a caller's CPU address is only meaningful together
; with the current port-02 mapping.
; The extension code shares U0 system variables, buffers, and port mirrors with D4. Treat the U0
; address as shared state and use read-modify-write for port mirrors so card selection, keyboard
; scanning, motors, sound, and printer control do not interfere.

; =============================================================================
; PRACTICAL ERROR AND OWNERSHIP RULES
; =============================================================================
; Unavailable-card, invalid-function, and missing-file conditions are ordinary device statuses,
; not invitations to retry through another physical device. The assignment table is the only
; supported fallback policy.
; HI-MEM bounds are checked by card and serial block helpers before each transfer byte. Cassette
; physical routines additionally check requested sector length, destination/source progression,
; and the STOP flag.
; A tape file owns its input or output buffer from OPEN/CRTE through CLOSE. BASIC may update
; program pointers around a transfer, but it must not reuse the cassette buffer or MUDDLE while
; the file remains open.
; The shared divider has three clients: sound, serial, and cassette timing. SER-OK, SOUND-ACT, and
; the tape interrupt takeover state are the coordination flags; changing PITCH directly without
; updating them creates a stale-clock failure.
; Port-03 writes affect both keyboard scanning and card IOMEM visibility. Port-05 writes affect
; both cassette motors and the sound/serial divider. Extension routines therefore update mirrors
; first or atomically mask interrupts around a hardware write.
; If a routine is interrupted or cancelled, restore the mapper, USART/tape divider, motor bits,
; cursor state, 0038H opcode, and interrupt masks before returning. These restoration obligations
; are part of the EXTH calling contract.

ORG E000H, EXTH0, E000H


; Physical EXTH offsets 0000H-0FFFH (CPU E000H-EFFFH) are FFH filler in BASIC 1.2; active
; extension code begins at F000H.

; -----------------------------------------------------------------------------
; UNUSED LOWER EXTH HALF
; -----------------------------------------------------------------------------
;
; Reserved EXTH space filled with FFH.
;
; The lower physical half of this 8-KiB extension image appears at CPU addresses E000H-EFFFH when
; EXTH is selected. In BASIC 1.2 it is unused filler; executable extension code begins at physical
; offset 1000H, CPU address F000H.
; -----------------------------------------------------------------------------
EXTH_UNUSED_E000_EFFF:
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|
    DB FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH, FFH ; |................|

; Extension ROM initialization; copies tables to RAM, initializes expansion devices, then returns
; to the main ROM.
; Select U0-U1-VID-EXT mapping before copying extension templates and probing expansion
; connectors.
; EXT_INIT starts in the reset-selected working map; the active EXTH code is CPU F000H onward,
; while the physical lower half is filler/card-window space.

; -----------------------------------------------------------------------------
; EXTENSION-ROM INITIALIZATION
; -----------------------------------------------------------------------------
;
; Completes reset initialization, builds U0 tables, discovers expansion cards, and initializes
; their devices.
;
; EXT_INIT enters with the reset path's warm/cold decision already made. It selects the
; U0-U1-VID-EXT mapping, copies character matrices and system templates into U0 RAM, establishes
; the I/O assignment tables and interrupt descriptors, and prepares the card buffers at 0040H,
; 0070H, 00A0H, and 00D0H.
;
; It then scans the four expansion connectors, identifies serial, cartridge, disk, and
; MOPS-compatible devices, records the first serial card, assigns unit numbers to duplicate card
; types, initializes the serial line, and invokes each non-serial card's initialization vector at
; its private 0C00BH entry. Main-ROM startup resumes through the FFF0H gateway at C2D3H.
;
; Entry:
;   Reset state from SYS ROM; connector identifiers are read from port 5AH.
;
; Exit:
;   U0 tables, card descriptors, I/O assignments, and device initialization are complete.
;
; Effects:
;   Pages memory, writes U0 RAM and I/O variables, and calls expansion-card code.
;
; Destroys:
;   AF, BC, DE, HL, IX, IY and alternate registers.
; -----------------------------------------------------------------------------
EXT_INIT:
    LD A,D0H
    OUT (02H),A
    LD A,(0B21H)
    OR A

; On cold reset, save the U3 RAM-good/bad status in U3-STAT; warm reset preserves the existing
; value.
    JR NZ,F00EH
    EX AF,AF'
    DB 32H                                                                          ; |2|

; Copy 32 ten-byte accented/semigraphic character matrices from FB6BH into U0 character RAM at
; 0740H.
    DEC DE
    DEC BC

; Cold reset copies 32 ten-byte character matrices to U0 0740H, then clears the remaining 64
; user-character slots. Warm reset deliberately leaves user matrices intact.

; -----------------------------------------------------------------------------
; COPY BUILT-IN CHARACTER MATRICES
; -----------------------------------------------------------------------------
;
; Copies the accented/semigraphic matrices into U0 and clears the remaining user slots.
;
; The cold-reset path enters this stage after selecting the U0-U1-VID-EXT map. The first LDIR
; copies 32 ten-byte matrices from the extension data area at FB6BH to U0 0740H.
;
; The second loop copies the remaining user-character area as zero bytes. This gives the character
; generator deterministic contents before the video initializer selects its mode.
;
; Entry:
;   Cold reset selected; U0 character RAM is writable.
;
; Exit:
;   U0 0740H onward contains the built-in matrices and cleared free slots.
;
; Effects:
;   Writes U0 character RAM; consumes AF, BC, DE, HL.
;
; Destroys:
;   AF, BC, DE, HL.
;
; Note:
;   Warm reset skips the destructive copy so user-defined matrices survive.
; -----------------------------------------------------------------------------
EXT_COPY_CHAR_MATRICES:
    LD HL,FB6BH
    LD DE,0740H

; Clear the remaining 64 ten-byte user-character slots to zero.
    LD BC,0140H
    LDIR
    LD A,40H

; The template copy is three separate ranges: 10H bytes to U0 0B00H, 10H bytes to U0 0030H, and
; 26H bytes to U0 0B23H. Keep these ranges separate when auditing a damaged bridge.

; -----------------------------------------------------------------------------
; COPY U0 DEVICE AND BRIDGE TEMPLATES
; -----------------------------------------------------------------------------
;
; Installs assignment bytes, RST vectors, and page-safe call/interrupt bridges in U0.
;
; The extension copies the 10H-byte input/output assignment template to U0 0B00H, the 10H-byte
; RST/interrupt entry template to U0 0030H, and 26H bytes of bridge code to U0 0B23H.
;
; It then initializes INT-DES, PORT06, IRQ-STAT, and the graphics stack floor. These copies are
; executable RAM infrastructure, not merely a configuration table.
;
; Entry:
;   U0 writable under the reset working map.
;
; Exit:
;   RST30 and interrupt bridges are callable from the SYS ROM.
;
; Effects:
;   Writes U0 0030H-003FH and 0B00H-0B48H; initializes 0B10H, 0B13H, 0B1FH, and 0B17H.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
EXT_COPY_U0_TEMPLATES:
    PUSH HL
    LD C,0AH
    LDIR

; Copy the U0 I/O assignment and dispatch templates from FB0EH into 0B00H-0B48H.
    POP HL
    DEC A
    JR NZ,F01BH
    LD HL,FB0EH
    LD DE,0B00H
    LD C,10H
    LDIR
    DB 11H, 30H                                                                     ; |.0|

; The copied RST/interrupt bytes at U0 0030H-003FH are RAM entry stubs; the dispatcher integrity
; check later compares the U0 copy with its EXTH reference.
    NOP
    LD C,10H
    LDIR
    LD DE,0B23H
    LD C,26H
    LDIR
    LD A,FCH

; Initialize INT-DES, PORT03/PORT05/PORT06 mirrors, the U0 function-call bridge, and the stack
; lower limit.
    LD (0B10H),A
    LD A,80H
    LD (0B13H),A
    RLCA
    LD (0B1FH),A
    LD HL,0F10H
    LD (0B17H),HL
    IN A,(5AH)
    LD BC,0403H
    LD HL,0040H

; Read four two-bit expansion identifiers from port 5AH and select each connector's memory with
; port 03H.
; Connector selection writes the connector number into port 03 bits 7-6. The same write must
; retain the low keyboard-row nibble.

; -----------------------------------------------------------------------------
; SCAN ONE EXPANSION CONNECTOR
; -----------------------------------------------------------------------------
;
; Selects one card IOMEM window and classifies the connector identifier.
;
; B counts down the four connectors while A carries the port-5A identifier word. The connector
; number is shifted into port 03 bits 7-6 and the corresponding U0 descriptor record is selected
; with a 30H stride.
;
; Known two-bit identifiers branch to built-in VGB, RS232, or DISK strings. Other identifiers
; enter the MOPS probe; empty or rejected connectors receive FFH in their descriptor.
;
; Entry:
;   A=packed connector identifiers; B=connector loop count; HL=descriptor base.
;
; Exit:
;   One descriptor is filled or marked unavailable; the next descriptor is selected.
;
; Effects:
;   Writes port 03 and the U0 descriptor records at 0040H/0070H/00A0H/00D0H.
; -----------------------------------------------------------------------------
CARD_SCAN_CONNECTOR:
    LD D,A
    LD A,04H
    SUB B
    RRCA
    RRCA
    OUT (03H),A
    LD A,D
    AND C
    CP 03H
    PUSH HL
    EXX
    JR Z,F079H
    LD HL,FB5CH
    OR A
    JR Z,F089H
    LD HL,FB58H
    DEC A
    JR Z,F089H
    LD HL,FB62H
    JR F089H

; Known serial, game-cartridge, and disk identifiers are recognized directly; other cards must
; begin with MOPS.
; Known connector identifiers bypass MOPS probing. Unknown hardware is accepted only when C000H
; begins with the four-byte MOPS signature.

; -----------------------------------------------------------------------------
; PROBE MOPS-COMPATIBLE CARD
; -----------------------------------------------------------------------------
;
; Checks the card's leading signature before accepting an unclassified connector.
;
; The probe compares four bytes at the card's C000H-visible start against the ROM MOPS signature.
; A mismatch abandons the connector without calling any card code.
;
; On a match the descriptor name is copied from the card's signature area. The post-signature
; bytes are therefore an executable card identity contract, not arbitrary display text.
;
; Entry:
;   Card IOMEM selected; HL points at MOPS or a built-in identifier.
;
; Exit:
;   Z set for a matching MOPS signature; descriptor source remains selected.
;
; Effects:
;   Reads card IOMEM and controls whether the initialization vector will later be trusted.
;
; Note:
;   A MOPS card must place its takeover entry immediately after the signature as required by the
;   ROM's handoff convention.
; -----------------------------------------------------------------------------
CARD_MOPS_PROBE:
    LD HL,C000H
    LD DE,FB54H
    LD B,04H

LF081:
    LD A,(DE)
    CP (HL)
    JR NZ,F092H
    INC DE
    INC HL
    DJNZ F081H

; Copy each recognized card name into its U0 descriptor buffer; write FFH for an empty or
; unidentified connector.
; Descriptor copy uses a length byte plus name bytes; a rejected or empty connector starts with
; FFH so every later dispatch can fail closed.

; -----------------------------------------------------------------------------
; COPY CARD NAME DESCRIPTOR
; -----------------------------------------------------------------------------
;
; Copies a length-prefixed card name into its U0 record or records FFH for unavailable hardware.
;
; The selected ROM/card name has a length byte followed by characters. C is loaded from the first
; byte, incremented to include the length, and LDIR copies the record into the descriptor buffer.
;
; The mismatch path stores FFH at the record start. Later dispatch tests that sentinel before
; touching card function or IRQ addresses.
;
; Entry:
;   HL=source name; DE=U0 descriptor destination.
;
; Exit:
;   Descriptor is copied with its length prefix or marked FFH.
;
; Effects:
;   Writes one connector descriptor.
; -----------------------------------------------------------------------------
CARD_COPY_DESCRIPTOR:
    LD C,(HL)
    INC C
    LD B,00H
    POP DE
    LDIR
    JR F095H

LF092:
    POP HL
    LD (HL),FFH

LF095:
    EXX
    LD A,D
    RRCA
    RRCA
    LD DE,0030H
    ADD HL,DE
    DJNZ F058H
    LD B,04H

; After card discovery, scan for the first RS232 card and store its connector number in the final
; I/O assignment slots.
; The first RS232 connector in scan order is written to the final selector entries and 0B1CH. No
; RS232 card leaves those values at FFH.

; -----------------------------------------------------------------------------
; ASSIGN LOWEST SERIAL CONNECTOR
; -----------------------------------------------------------------------------
;
; Finds the first RS232 connector and installs it in the serial selector slots.
;
; The scan rotates the port-5A identifier word in connector order. The first serial identifier
; writes its connector number to the kernel input/output selectors and to 0B1CH.
;
; If no serial identifier is found, 0B1CH and the connector selectors remain FFH. The later serial
; dispatcher consequently cannot accidentally use an arbitrary card.
;
; Entry:
;   A=packed identifiers; B=4 connector iterations; C=RS232 mask.
;
; Exit:
;   0B1CH and the final selector slots contain the lowest serial connector or FFH.
;
; Effects:
;   Writes U0 assignment bytes and the serial-card base variable.
; -----------------------------------------------------------------------------
CARD_ASSIGN_FIRST_SERIAL:
    LD D,A
    AND C
    JR NZ,F0B0H
    LD A,04H
    SUB B
    LD (0B07H),A
    LD (0B0FH),A
    JR F0B7H

LF0B0:
    LD A,D
    RRCA
    RRCA
    DJNZ F0A1H
    LD A,FFH

LF0B7:
    LD (0B1CH),A
    LD HL,0047H
    LD DE,0030H
    LD B,04H
    XOR A

; Compare descriptor names to assign unit numbers to identical card types.
; Duplicate names are compared across all four 30H-spaced descriptors; the per-record unit byte
; becomes 00H for the first unit and increments for equal names.

; -----------------------------------------------------------------------------
; NUMBER DUPLICATE CARD TYPES
; -----------------------------------------------------------------------------
;
; Assigns unit numbers by comparing each descriptor name with later records.
;
; The routine clears each descriptor's unit byte, then compares a descriptor against the four
; records using 30H strides. Each equal name increments the current record's unit number.
;
; The unit field distinguishes multiple cards of one class while preserving a single logical
; device class. It is copied into the card call context before dispatch.
;
; Entry:
;   Four populated U0 descriptors beginning at 0040H.
;
; Exit:
;   Each descriptor has a stable unit number from 0 through 3.
;
; Effects:
;   Reads and writes descriptor records; uses IX/IY and alternate registers.
;
; Destroys:
;   AF, BC, DE, HL, IX, IY, alternate register set.
; -----------------------------------------------------------------------------
CARD_ASSIGN_UNIT_NUMBERS:
    LD (HL),A
    ADD HL,DE
    DJNZ F0C3H
    LD E,40H
    LD HL,0070H
    PUSH DE
    POP IX

LF0CF:
    PUSH HL
    POP IY
    LD B,(HL)
    INC B

LF0D4:
    LD A,(DE)
    CP (HL)
    JR NZ,F0DFH
    INC HL
    INC DE
    DJNZ F0D4H
    INC (IY+07H)

LF0DF:
    PUSH IY
    POP HL
    LD DE,0030H
    ADD HL,DE
    BIT 0,H
    JR Z,F0F6H
    PUSH IX
    POP HL
    ADD HL,DE
    BIT 0,H
    JR NZ,F0FBH
    PUSH HL
    POP IX
    ADD HL,DE

LF0F6:
    PUSH IX
    POP DE
    JR F0CFH

; Page each non-serial card and call its mandatory initialization vector at card address 0C00BH.
; Non-serial initialization reads the card's little-endian target at C00BH after selecting its
; IOMEM. The call is indirect so the card may place its initializer anywhere in its mapped memory.

; -----------------------------------------------------------------------------
; INITIALIZE NON-SERIAL CARDS
; -----------------------------------------------------------------------------
;
; Pages each identified card and calls its mandatory C00BH initializer.
;
; The loop establishes the U-U-U-EXT page arrangement, selects each connector, tests its
; descriptor sentinel and connector presence, then reads the two-byte initializer address at card
; C00BH.
;
; The target is called indirectly through FFF9H. After return the extension restores the U-U-U-EXT
; page and advances to the next descriptor.
;
; Entry:
;   Four U0 descriptors; port-5A connector identifiers.
;
; Exit:
;   Every recognized non-serial card has had its initialization routine called.
;
; Effects:
;   Changes port 02 and port 03; enters arbitrary card code.
;
; Destroys:
;   Registers are card-defined across the indirect call.
; -----------------------------------------------------------------------------
CARD_INIT_LOOP:
    LD A,F0H

; Memory paging: U U U E page layout.
    OUT (02H),A
    CALL FFE8H
    LD IX,0040H
    LD B,04H
    IN A,(5AH)

; An FFH descriptor or absent connector is skipped; only an identified card is allowed to supply a
; C00BH initializer.

; -----------------------------------------------------------------------------
; SELECT NEXT CARD INITIALIZER
; -----------------------------------------------------------------------------
;
; Maps the next connector, rejects empty descriptors, and invokes its C00BH vector.
;
; The connector index is encoded into port 03 bits 7-6 while the corresponding descriptor is
; selected by IX. A descriptor whose first byte is FFH or whose identifier is empty is skipped.
;
; A valid card supplies the initializer pointer at C00BH. The mapping is restored after the call
; so the next connector starts from a known page state.
;
; Entry:
;   B=remaining connector count; IX=current descriptor; C=packed identifiers.
;
; Exit:
;   Next card initialized or skipped; loop state advances.
;
; Effects:
;   Reads card IOMEM at C00BH and executes external code.
; -----------------------------------------------------------------------------
CARD_INIT_NEXT_CONNECTOR:
    LD C,A
    LD A,04H
    SUB B
    RRCA
    RRCA
    OUT (03H),A
    LD A,(IX+00H)
    INC A
    JR Z,F12DH
    LD A,C
    AND 03H
    JR Z,F12DH
    LD HL,(C00BH)
    PUSH BC
    PUSH IX
    CALL FFF9H
    POP IX
    POP BC
    LD A,F0H

; Memory paging: U U U E page layout.
    OUT (02H),A

; Resume main-ROM startup at C2D3H through the SYS return gateway.

LF12D:
    LD DE,0030H
    ADD IX,DE
    LD A,C
    RRCA
    RRCA
    DJNZ F10AH
    LD HL,C2D3H
    JP FFF0H

; Reset integrity check; decides between warm reset and cold reset.
; Compare U0 RAM function-call and interrupt templates against the reference bytes at FB2EH.
; Reset integrity compares 1EH bytes of the U0 bridge against its EXTH reference. A bad copy
; forces the cold path; a second reset while WARM-FLAG is active also forces cold reset.

; -----------------------------------------------------------------------------
; RESET INTEGRITY CHECK
; -----------------------------------------------------------------------------
;
; Verifies RAM-resident system templates and chooses warm or cold reset.
;
; The routine compares the U0 RAM function-call/interrupt template against the reference bytes at
; FB2EH. If the copy is damaged, warm reset is not trusted. If it is intact, WARM-FLAG at 0B21H is
; set for the first warm reset, but a second reset while that flag is already active forces the
; cold path.
;
; Entry:
;   AF' carries the original SYS page selection and the U0 RAM area contains the copied template.
;
; Exit:
;   WARM-FLAG is updated and control returns to SYS reset continuation at 023AH.
;
; Effects:
;   Temporarily pages U0/U1/VID/EXT and restores the caller's mapping.
; -----------------------------------------------------------------------------
RESET_INTEGRITY_CHECK:
    EX AF,AF'
    LD A,D0H

; Memory paging: U U V E page layout.
    OUT (02H),A
    LD DE,FB2EH
    LD HL,0B23H
    LD BC,001EH

LF14B:
    LD A,(DE)
    INC DE
    CPI
    JR NZ,F15CH
    JP PE,F14BH
    LD A,(0B21H)
    OR A
    LD A,FFH
    JR Z,F15DH

; A valid U0 copy permits WARM-FLAG=FF on the first reset; an already-set flag forces a cold reset
; on the next RESET press.

LF15C:
    XOR A

LF15D:
    LD (0B21H),A
    EX AF,AF'
    OUT (02H),A
    JP 023AH

; Expansion input dispatch.
; Direct-card input dispatch computes the requested function entry from A=connector, B=function
; class, and DE=input table.

; -----------------------------------------------------------------------------
; EXPANSION INPUT DISPATCH
; -----------------------------------------------------------------------------
;
; Selects a card's input entry from the RST 30H device state and enters the card code.
;
; For a direct card assignment, A contains the connector number, B the selected function class,
; and DE the relevant input table. The routine computes the class entry and shares the
; card-selection and function-table logic with expansion output.
;
; Entry:
;   RST 30H expansion state; A=card number, B=function class, DE=input table base.
;
; Exit:
;   Control transfers to the selected card's input routine or the common error return.
;
; Effects:
;   Pages the selected expansion-card memory and restores the system mapping on return.
; -----------------------------------------------------------------------------
EXPANSION_INPUT_DISPATCH:
    LD L,B
    LD H,00H
    ADD HL,DE
    JR F171H

; Expansion output dispatch.
; Card output dispatch obtains the connector from the kernel table's final assignment entry.

; -----------------------------------------------------------------------------
; EXPANSION OUTPUT DISPATCH
; -----------------------------------------------------------------------------
;
; Selects and invokes an expansion-card output function.
;
; The output path reads the device selector from the final kernel table entry, validates the
; connector number, pages the card into the third memory page, and locates the card's mandatory
; function table at 0C00DH. It indexes the requested function number, dispatches the card routine,
; then returns through the common SYS gateway.
;
; Entry:
;   RST 30H output state and the output assignment table.
;
; Exit:
;   Card routine status is returned to the function-call dispatcher; FFH denotes an unavailable
;   function.
;
; Effects:
;   Changes page-3 mapping and may restore default device assignment after an error.
; -----------------------------------------------------------------------------
EXPANSION_OUTPUT_DISPATCH:
    LD HL,0007H
    ADD HL,DE
    LD A,(HL)

; Card function dispatch rejects connector values >=04H before shifting them into port 03. Four
; descriptors are exactly the supported connector set.

; -----------------------------------------------------------------------------
; INDEX CARD FUNCTION CLASS
; -----------------------------------------------------------------------------
;
; Validates the class number and locates the selected descriptor record.
;
; The routine rejects a connector number of four or greater. Valid connector numbers are shifted
; into port 03 and converted to a 30H descriptor stride from the 0040H base.
;
; The selected descriptor's first byte is checked before its card function table is read. The same
; index path is used by both input and output dispatch.
;
; Entry:
;   A=connector number; B=function class; DE=class table base for input or output.
;
; Exit:
;   HL/DE context points at the selected descriptor or enters unavailable recovery.
;
; Effects:
;   Writes port 03 and 0B11H; preserves alternate dispatch context.
; -----------------------------------------------------------------------------
CARD_FUNCTION_CLASS_INDEX:
    CP 04H
    JR NC,F1D9H
    EXX
    LD HL,0040H
    LD DE,0030H
    LD B,A
    RRCA
    RRCA
    LD (0B11H),A
    OUT (03H),A
    LD A,B
    OR A
    JR Z,F18BH

; Descriptor records are selected from 0040H with a 30H stride. The first byte is tested as
; FFH-unavailable before C00DH or C00EH is read.

; -----------------------------------------------------------------------------
; SELECT CARD DESCRIPTOR RECORD
; -----------------------------------------------------------------------------
;
; Adds the 30H connector stride and tests its availability sentinel.
;
; Starting from the first descriptor at U0 0040H, the loop adds 30H once per connector. The
; descriptor's first byte is incremented and tested, making FFH the unavailable sentinel without a
; separate compare.
;
; The descriptor pointer is retained while the card IOMEM is visible, so following name and unit
; bytes can be used to construct the call context.
;
; Entry:
;   HL=0040H; B=connector index.
;
; Exit:
;   HL points to the connector descriptor; Z indicates unavailable.
;
; Effects:
;   Reads U0 descriptor state.
; -----------------------------------------------------------------------------
CARD_DESCRIPTOR_SELECT:
    ADD HL,DE
    DJNZ F188H

; Select the card's page-3 memory and its U0 descriptor buffer at 0040H/0070H/00A0H/00D0H.

LF18B:
    LD A,(HL)
    INC A
    JR Z,F1D8H
    LD C,(HL)
    INC HL
    LD DE,FB5DH

; A descriptor beginning FFH denotes an empty connector and returns an unavailable-device status.
; RS232 is dispatched through the built-in F291H counted table; every other accepted card must
; expose its own counted table at C00DH.

; -----------------------------------------------------------------------------
; MATCH CARD DESCRIPTOR NAME
; -----------------------------------------------------------------------------
;
; Distinguishes the built-in serial table from an external card function table.
;
; The selected descriptor name is compared against the ROM's RS232 identity. A match selects the
; built-in SERIAL_JUMP_TABLE; any other accepted card selects the table at card C00DH.
;
; The comparison runs for the length-prefixed descriptor and branches to unavailable recovery on
; the first mismatch or a FFH descriptor.
;
; Entry:
;   DE=ROM identity; current card descriptor visible in U0/card context.
;
; Exit:
;   HL points to serial or card function table.
;
; Effects:
;   Reads descriptor and ROM/card identifier bytes.
; -----------------------------------------------------------------------------
CARD_DESCRIPTOR_NAME_MATCH:
    LD A,(DE)
    INC DE
    CPI
    JR NZ,F1A3H
    JP PE,F194H
    EXX
    LD HL,F291H
    JR F1A7H

LF1A3:
    EXX
    LD HL,C00DH

; Serial cards use the built-in SERIAL_JUMP_TABLE; other devices must expose a counted table at
; card address 0C00DH.
; The table count is decremented before comparing the requested function number. The subsequent
; index is doubled because entries are little-endian two-byte addresses.
; Card calls compare DE with HI-MEM before entering the target; FAH reports an address-limit
; failure rather than a card-level error.

; -----------------------------------------------------------------------------
; LOOK UP COUNTED CARD FUNCTION
; -----------------------------------------------------------------------------
;
; Bounds-checks a function number, fetches its two-byte target, and invokes it.
;
; The first byte of the selected table is decremented and compared with the requested function
; index. An out-of-range index returns FFH through the common unavailable path.
;
; For a valid index the routine doubles the index, adds it to the table base, reads the
; little-endian target, checks the caller's transfer address against HI-MEM, and calls through
; FFF9H.
;
; Entry:
;   C=function number; HL=counted table base; DE=transfer pointer/context.
;
; Exit:
;   Card status is returned; FFH denotes an unavailable function.
;
; Effects:
;   May enter arbitrary card code and change page-3 mapping.
;
; Destroys:
;   AF and dispatch scratch registers; card-defined state is not preserved.
; -----------------------------------------------------------------------------
CARD_FUNCTION_ROUTINE_LOOKUP:
    LD A,(HL)
    DEC A
    CP C
    JR C,F1E0H
    INC HL
    EX DE,HL
    LD L,C
    LD H,00H
    ADD HL,HL
    ADD HL,DE
    LD E,(HL)
    INC HL
    LD D,(HL)
    EX DE,HL
    LD A,(0B11H)
    RLCA
    RLCA
    AND 03H
    LD IX,0048H
    LD DE,0030H
    JR Z,F1CCH
    LD B,A

; -----------------------------------------------------------------------------
; RESTORE PAGE AFTER CARD CALL
; -----------------------------------------------------------------------------
;
; Selects the descriptor unit record before returning from an external function.
;
; The connector bits in 0B11H are converted back to a descriptor offset from IX=0048H. This lets
; the return path restore the card's unit context while the target status remains in the alternate
; accumulator.
;
; The bridge then invokes FFF9H with the saved page/return context; card code never returns
; directly to an unmapped SYS address.
;
; Entry:
;   Saved connector selection and alternate AF from card dispatch.
;
; Exit:
;   Original mapping and dispatch status are restored.
;
; Effects:
;   Reads/writes port 03 mirror and calls the indirect gateway.
; -----------------------------------------------------------------------------
CARD_RESTORE_DESCRIPTOR_PAGE:
    ADD IX,DE
    DJNZ F1C8H

; Restore the SYS mapping before returning from a card call.
; The return path restores the saved page and connector/unit context before the external status is
; handed back through FFF9H.

LF1CC:
    EX AF,AF'
    POP DE
    POP BC
    CALL FFF9H

; Error recovery repairs the affected input/output assignment from the default templates and
; returns through C40EH.

; -----------------------------------------------------------------------------
; EXPANSION ASSIGNMENT ERROR RECOVERY
; -----------------------------------------------------------------------------
;
; Restores default device assignments after an invalid card call.
;
; When an empty connector, unsupported function, or missing card table is detected, this path
; repairs the affected input or output assignment from the initialization templates. It returns a
; system error status through C40EH rather than leaving the I/O tables pointed into an unmapped
; card.
; -----------------------------------------------------------------------------
EXPANSION_ASSIGNMENT_RECOVERY:
    LD HL,C3FCH
    JP FFF0H

LF1D8:
    EXX

LF1D9:
    LD A,(0B1CH)
    LD (HL),A
    LD A,FEH
    DB 11H                                                                          ; |.|

LF1E0:
    LD A,FFH
    POP DE
    POP BC
    JR F1D2H

; Expansion-call error recovery; restores default device assignments.
    RLCA
    LD HL,0B00H
    LD DE,FB0EH
    LD IX,0B07H
    JR C,F1FDH
    LD HL,0B08H
    LD DE,FB16H
    LD IX,0B0FH

; Assignment recovery selects FB0EH for input or FB16H for output, copies the default class
; selector, and returns via C40EH/FFF0H.

; -----------------------------------------------------------------------------
; REPAIR FAILED CARD ASSIGNMENT
; -----------------------------------------------------------------------------
;
; Restores an input/output selector from its ROM default after card failure.
;
; The recovery code chooses the input template at FB0EH or output template at FB16H, indexes the
; failed class, and copies the default selector back into U0.
;
; If the failed class is cards, the serial assignment at 0B1CH is reinserted only when a serial
; connector exists. The final path returns through C40EH via FFF0H.
;
; Entry:
;   Alternate AF identifies direction and logical class; U0 selector table is addressable.
;
; Exit:
;   The selector no longer points at the rejected card; C40EH reports the error.
;
; Effects:
;   Writes U0 selector bytes and may restore serial fallback.
; -----------------------------------------------------------------------------
CARD_REPAIR_ASSIGNMENT:
    RLCA
    RLCA
    RLCA
    AND 07H
    CP 07H
    JR Z,F218H
    LD C,A
    LD B,00H
    ADD HL,BC
    EX DE,HL
    ADD HL,BC
    EX DE,HL
    LD A,(HL)
    CP 06H
    CALL Z,F21EH
    RLCA
    JR C,F218H
    LD A,(DE)
    LD (HL),A

LF218:
    LD HL,C40EH
    JP FFF0H

LF21E:
    EX AF,AF'
    LD A,(0B1CH)
    LD (IX+00H),A
    EX AF,AF'
    RET

; Expansion-card interrupt dispatch.
; C bit 0 of each rotated position is active-low: service every requesting expansion card in
; connector order.

; -----------------------------------------------------------------------------
; EXPANSION INTERRUPT DISPATCH
; -----------------------------------------------------------------------------
;
; Services pending interrupt requests from up to four expansion cards.
;
; C carries active-low request bits for the four connectors. The routine rotates through them,
; selects each requesting card on port 03H, reads the card's mandatory interrupt-vector address at
; 0C00EH, and calls it through the FFF9H bank gateway. After all requests are serviced, it
; restores the original port-03 selection and returns to the SYS interrupt handler.
;
; Entry:
;   C=b3..b0 pending expansion interrupt requests.
;
; Exit:
;   All requested card handlers have been called; the original mapping is restored.
;
; Effects:
;   Pages each requesting card and invokes arbitrary card interrupt code.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
EXPANSION_IRQ_DISPATCH:
    LD B,04H

; Card IRQ request bits are active-low and consumed one connector at a time with RR C. A clear
; carry means the current card requested service.

; -----------------------------------------------------------------------------
; SCAN NEXT ACTIVE CARD IRQ
; -----------------------------------------------------------------------------
;
; Rotates active-low request bits and dispatches each requesting card.
;
; C carries four active-low request bits. RR C examines one connector per iteration; a carry means
; no request, while a clear carry selects the connector and reads its vector at C00EH.
;
; The handler is called through FFF9H, then the U-U-U-EXT mapping is restored before the next
; request is examined.
;
; Entry:
;   C bits 3-0 active-low card interrupt requests; B=04H.
;
; Exit:
;   All active card handlers are called; the original port-03 selection is restored.
;
; Effects:
;   Changes card selection and page 3; executes card IRQ code.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
CARD_IRQ_SCAN_NEXT:
    RR C
    JR C,F240H
    PUSH BC
    LD A,04H

; The card IRQ vector is read at C00EH and called indirectly. The card must acknowledge its own
; source before the dispatcher advances.
    SUB B
    RRCA
    RRCA
    OUT (03H),A

; Card interrupt handlers are entered through their mandatory vector at 0C00EH, then UUU-E mapping
; is restored.
    LD HL,(C00EH)
    CALL FFF9H
    LD A,F0H
    OUT (02H),A
    POP BC

; After four slots, writing the saved 0B11H value restores both card selection and keyboard row
; before SYS interrupt continuation.

; -----------------------------------------------------------------------------
; RESTORE CARD IRQ SELECTION
; -----------------------------------------------------------------------------
;
; Restores the saved keyboard/card selection before rejoining SYS interrupt code.
;
; After four request slots, the original 0B11H value is written to port 03H. HL is then restored
; and FFF0H returns control to the SYS-side interrupt continuation.
;
; This final write matters because the low nibble is also the keyboard row; restoring only the
; card bits would leave normal scanning on the wrong row.
;
; Entry:
;   Saved port-03 value and SYS interrupt return context.
;
; Exit:
;   Port 03 and page mapping are ready for the SYS interrupt tail.
;
; Effects:
;   Writes port 03 and crosses the EXTH/SYS gateway.
; -----------------------------------------------------------------------------
CARD_IRQ_RESTORE_SELECTION:
    DJNZ F229H
    LD A,(0B11H)
    OUT (03H),A
    POP HL
    JP FFF0H

; Bounded card block output: reject a source address crossing HI-MEM before invoking the character
; worker.

; -----------------------------------------------------------------------------
; BOUNDED CARD BLOCK OUTPUT
; -----------------------------------------------------------------------------
;
; Checks HI-MEM and repeatedly invokes a card character-output routine.
;
; The helper accepts DE as the source address, BC as the byte count, and HL as the
; character-output entry. Before every byte it compares the transfer address with HI-MEM at 0B19H,
; returning FAH on overflow; it also propagates the character routine's status and stops at the
; first error.
; -----------------------------------------------------------------------------
EXPANSION_BLOCK_OUTPUT:
    EX DE,HL

; Card block output checks HI-MEM before every byte and calls the card's character routine only
; after the boundary test succeeds.

; -----------------------------------------------------------------------------
; BOUND CARD OUTPUT BEFORE EACH BYTE
; -----------------------------------------------------------------------------
;
; Checks HI-MEM before invoking a card character-output target.
;
; The source address is compared against HI-MEM at 0B19H before each character call. Carry returns
; FAH for an address beyond the allowed memory boundary.
;
; Only a successful character call advances the source pointer and decrements BC. A card error
; stops without claiming the remaining bytes were transferred.
;
; Entry:
;   DE=source; BC=count; HL=card character-output target.
;
; Exit:
;   A=00 when count completes, FAH on memory overflow, or card status on failure.
;
; Effects:
;   Reads HI-MEM and calls card code through FFF9H.
; -----------------------------------------------------------------------------
CARD_BLOCK_OUTPUT_BOUNDARY:
    PUSH HL
    PUSH DE
    PUSH BC
    PUSH HL
    PUSH DE
    EX DE,HL
    LD HL,(0B19H)
    OR A
    SBC HL,DE
    LD A,FAH
    POP DE
    POP HL
    RET C
    LD C,(HL)
    EX DE,HL
    CALL FFF9H
    POP BC
    POP DE
    POP HL
    OR A
    RET NZ
    CPI
    RET PO
    JR F24CH

; Bounded card block input: reject a destination crossing HI-MEM before receiving each byte.
; Card block input stores a received byte only after a zero status. A failed character call leaves
; the destination pointer/count at the first uncompleted byte.

; -----------------------------------------------------------------------------
; BOUNDED CARD BLOCK INPUT
; -----------------------------------------------------------------------------
;
; Checks HI-MEM and repeatedly invokes a card character-input routine.
;
; This is the input counterpart to EXPANSION_BLOCK_OUTPUT. It bounds the destination against
; HI-MEM, calls the character input routine for each byte, and advances DE and BC only after
; successful transfers.
; -----------------------------------------------------------------------------
EXPANSION_BLOCK_INPUT:
; -----------------------------------------------------------------------------
; BOUND CARD INPUT BEFORE EACH BYTE
; -----------------------------------------------------------------------------
;
; Checks HI-MEM before receiving each card character.
;
; The destination is compared against HI-MEM before the card input target is called. The received
; byte is stored only after the target reports success.
;
; The helper preserves the card return status in the alternate accumulator while restoring the
; caller's DE/BC loop state.
;
; Entry:
;   DE=destination; BC=count; HL=card character-input target.
;
; Exit:
;   A=00 on completion or the first card/memory error.
;
; Effects:
;   Writes destination memory and calls card code through FFF9H.
; -----------------------------------------------------------------------------
CARD_BLOCK_INPUT_BOUNDARY:
    PUSH HL
    PUSH DE
    PUSH BC
    PUSH HL
    PUSH DE
    LD HL,(0B19H)
    OR A
    SBC HL,DE
    LD A,FAH
    POP DE
    POP HL
    RET C
    CALL FFF9H
    EX AF,AF'
    LD A,C
    POP BC
    POP DE
    POP HL
    EX AF,AF'
    OR A
    RET NZ
    EX AF,AF'
    LD (DE),A
    XOR A
    EX DE,HL
    CPI
    EX DE,HL
    RET PO
    JR F26CH

; Serial-line routine jump table; first byte is the routine count, followed by routine addresses.
; Serial function table: reserved, SER-CHIN/OUT, SER-BKIN/OUT, SER-SET, and CLOSE-compatible NOP.
; The serial service count is five; the generic device function number therefore remains aligned
; with reserved, character, block, setup, and close-compatible entries.

; -----------------------------------------------------------------------------
; SERIAL SERVICE TABLE
; -----------------------------------------------------------------------------
;
; Counted OS dispatch table for RS232 serial services.
;
; The table has five functions: a reserved function, serial character input/output, serial block
; input/output, SER-SET, and a CLOSE-compatible NOP. Its entries point into the serial
; implementation at F29CH and later.
; -----------------------------------------------------------------------------
SERIAL_JUMP_TABLE:
    DB 05H                                                                          ; |.|

; -----------------------------------------------------------------------------
; SERIAL COUNTED SERVICE ENTRIES
; -----------------------------------------------------------------------------
;
; Five counted entries select reserved, character, block, setup, and close-compatible services.
;
; The byte at F291H is the service count. It is followed by little-endian routine pointers; the
; reserved first service keeps generic OS class numbering aligned with the other device classes.
;
; The final entry is a harmless CLOSE-compatible service, allowing generic device teardown to call
; serial without a separate close implementation.
;
; Effects:
;   Read by card/function dispatch; entries target EXTH serial routines.
; -----------------------------------------------------------------------------
SERIAL_SERVICE_ENTRIES:
    DB 05H, F3H, 39H, F3H, B7H, F3H, A4H, F2H, 57H, F3H                             ; |..9.....W.|

; SERIAL_INIT enters SER-SET with BAUD=04H (1200 bit/s) and FORMAT=EEH.

; -----------------------------------------------------------------------------
; SERIAL INITIALIZATION
; -----------------------------------------------------------------------------
;
; Stores default serial parameters and falls into SER-SET.
;
; Initialization records BAUD=04H (the 1200-bit/s default) and FORMAT=EEH, then executes the same
; USART and sound-divider setup used by SER-SET. The serial device shares the tone divider, so its
; setup also establishes the serial-clock validity flag.
;
; Entry:
;   A=default BAUD value during startup.
;
; Exit:
;   Serial hardware is configured and SER-OK is asserted.
;
; Effects:
;   Updates BAUD, FORMAT, port-04/05/06 mirrors, and USART registers.
; -----------------------------------------------------------------------------
SERIAL_INIT:
    LD (0B69H),A
    LD A,EEH
    LD (0B6AH),A

; Clear sound-volume bits while serial is active; the shared frequency divider becomes the USART
; clock source.
; SER_SET clears sound volume while using the shared divider, clamps BAUD at 08H, preserves
; cassette motor bits, and programs only the selected USART pair.

; -----------------------------------------------------------------------------
; SERIAL PARAMETER SETUP
; -----------------------------------------------------------------------------
;
; Programs the sound divider and USART mode for the selected baud and format.
;
; SER-SET silences sound-volume bits, clamps BAUD to the supported table range, and loads the
; corresponding PITCH divisor from the table at F3C6H. It preserves motor-control bits in PORT05
; while enabling the divider, writes the low divisor byte to port 04H, and masks FORMAT to the
; USART-supported mode bits before issuing reset and mode commands on the selected card's port.
;
; Entry:
;   BAUD at 0B69H and FORMAT at 0B6AH; C/B carry OS serial parameters.
;
; Exit:
;   USART and divider are configured; A=00 indicates success.
;
; Effects:
;   Changes sound/serial hardware state and clears SER-OK until setup completes.
; -----------------------------------------------------------------------------
SER_SET:
    PUSH BC
    PUSH HL
    LD A,(0B13H)
    AND C3H
    LD (0B13H),A
    OUT (06H),A
    LD A,(0B69H)
    CP 09H
    JR C,F2B9H
    LD A,08H

; BAUD indexes the PITCH divisor table at F3C6H; unsupported values are clamped to the highest
; supported entry.
; Divisor words are indexed by BAUD*2. The high byte is masked to its low nibble before it is ORed
; with the 10H divider-enable field and preserved motor bits.

; -----------------------------------------------------------------------------
; SELECT SERIAL DIVIDER
; -----------------------------------------------------------------------------
;
; Clamps BAUD and fetches the matching divider word.
;
; BAUD is clamped to 08H, doubled, and added to the divisor table at F3C6H. The high byte's low
; nibble is combined with the port-05 mirror while preserving cassette motor bits.
;
; The low byte is written to port 04H and the high byte to port 05H, making the tone divider the
; USART clock source.
;
; Entry:
;   BAUD at 0B69H; port mirrors hold motor state.
;
; Exit:
;   Divider bytes selected and ready for USART initialization.
;
; Effects:
;   Updates 0B12H/0B13H and ports 04H-06H.
; -----------------------------------------------------------------------------
SERIAL_DIVISOR_SELECT:
    LD L,A
    LD H,00H
    ADD HL,HL
    LD DE,F3C6H
    ADD HL,DE
    LD E,(HL)
    INC HL
    LD D,(HL)
    LD A,D
    AND 0FH
    OR 10H
    LD D,A
    LD A,(0B12H)
    AND C0H
    OR D
    LD (0B12H),A
    OUT (05H),A
    LD A,E
    OUT (04H),A
    LD A,(0B6AH)
    AND B4H
    OR 4AH
    LD H,A
    LD BC,0411H
    LD DE,4003H
    IN A,(5AH)

; Issue the USART reset/mode sequence on the selected card's 11H/21H/31H/41H command port.
; The USART reset/mode sequence is sent to 11H, 21H, 31H, or 41H only when the matching port-5A
; connector identifier is present.

; -----------------------------------------------------------------------------
; PROGRAM SELECTED USART PORTS
; -----------------------------------------------------------------------------
;
; Runs the reset/mode command sequence on each possible USART base.
;
; The connector identifier word from port 5AH is rotated alongside command ports 11H, 21H, 31H,
; and 41H. Only the selected connector receives the USART reset, mode, and clock commands.
;
; This avoids assuming that the serial card is in slot zero while still allowing the common setup
; routine to initialize the selected slot.
;
; Entry:
;   Port-5A connector identifiers; C=first USART command port; D/H=commands.
;
; Exit:
;   The selected USART accepts the chosen BAUD/FORMAT configuration.
;
; Effects:
;   Writes command/status ports for the selected card.
; -----------------------------------------------------------------------------
SERIAL_PROGRAM_ALL_USARTS:
    LD L,A
    AND E
    JR NZ,F2F6H
    OUT (C),A
    OUT (C),A
    OUT (C),A
    OUT (C),D
    OUT (C),H

LF2F6:
    LD A,10H
    ADD A,C
    LD C,A
    LD A,L
    RRCA
    RRCA
    DJNZ F2E8H
    XOR A
    LD (0B71H),A
    POP HL
    POP BC
    RET

; Wait for any active tone to end, check STOP-FLAG, and derive the USART port address from PORT03.

; -----------------------------------------------------------------------------
; SERIAL PORT PREPARATION
; -----------------------------------------------------------------------------
;
; Checks STOP and active sound, then derives the selected card's USART port address.
;
; The helper waits until an active tone ends, checks STOP-FLAG, moves the character into H, and
; converts the port-03 connector selection into one of 11H, 21H, 31H, or 41H. Carry indicates that
; the caller may proceed.
;
; Entry:
;   C=character to transmit and port-03 mirror selects the connector.
;
; Exit:
;   Carry=1 with H=character, C=USART command/status port, A=00; carry=0 on abort.
; -----------------------------------------------------------------------------
SER_PREPARE_PORT:
    CALL F331H
    RET NZ

LF30A:
    LD A,(0B14H)
    OR A
    JR NZ,F306H
    LD H,C
    LD A,(0B11H)
    RRCA
    RRCA
    AND 30H
    ADD A,11H
    LD C,A
    XOR A
    CCF
    RET
    NOP

; Poll USART status b7/b0 until transmitter-ready; CTRL+ESC remains an abort path.

; -----------------------------------------------------------------------------
; WAIT FOR USART READY
; -----------------------------------------------------------------------------
;
; Waits for the selected USART to become ready while remaining abortable.
;
; The routine polls USART status bits b7 and b0 after STOP checks. It returns carry set with the
; character in H and the command/status port in C when the transmitter is ready; CTRL+ESC returns
; F5H instead of waiting forever.
; -----------------------------------------------------------------------------
SER_WAIT_READY:
    CALL F30AH
    RET NZ

; Transmit-ready requires status mask 81H. The loop calls the common STOP checker between polls,
; so a blocked serial output is cancellable.

; -----------------------------------------------------------------------------
; POLL USART TRANSMIT READY
; -----------------------------------------------------------------------------
;
; Waits for USART status bits 7 and 0 without losing CTRL+ESC cancellation.
;
; The status port is read and masked with 81H; only the 81H ready combination permits output.
; Otherwise SER_CHECK_STOP is called and the loop continues or returns F5H.
;
; The helper preserves the character in H and the command/status port in C for SER_CHOUT.
;
; Entry:
;   H=character; C=USART command/status port.
;
; Exit:
;   Carry set when ready; A=F5H on STOP.
;
; Effects:
;   Reads the selected USART status port.
; -----------------------------------------------------------------------------
SERIAL_TX_READY_LOOP:
    IN A,(C)
    AND 81H
    CP 81H
    CCF
    RET C
    CALL F331H
    JR Z,F323H
    RET

; Common STOP check: A=00 when clear, F5H when CTRL+ESC has set STOP-FLAG.
; SER_CHECK_STOP maps a nonzero STOP-FLAG to F5H; zero means polling may continue.

; -----------------------------------------------------------------------------
; SERIAL STOP CHECK
; -----------------------------------------------------------------------------
;
; Converts STOP-FLAG into the serial abort status.
;
; A=00 is returned when 0B16H is clear. If CTRL+ESC has set STOP-FLAG, the helper returns A=F5H so
; both character and block serial operations can terminate consistently.
; -----------------------------------------------------------------------------
SER_CHECK_STOP:
    LD A,(0B16H)
    OR A
    RET Z
    LD A,F5H
    RET
    JP M,F359H

; SER-CHOUT enables transmission, waits for ready, and writes the character to the selected USART
; data port.

; -----------------------------------------------------------------------------
; SERIAL CHARACTER OUTPUT
; -----------------------------------------------------------------------------
;
; Sends one character through the selected USART.
;
; SER-CHOUT prepares the card port, reinitializes the divider if SER-OK is clear, issues the USART
; transmit-enable command, waits for transmitter-ready, and writes H to the data port. It returns
; A=00 on success or propagates F5H for CTRL+ESC.
;
; Entry:
;   C=character code.
;
; Exit:
;   A=00 on success or a serial/STOP error code.
;
; Effects:
;   Writes USART command and data ports; may reconfigure serial timing.
; -----------------------------------------------------------------------------
SER_CHOUT:
    CALL F31FH
    RET NC
    LD A,(0B71H)
    OR A
    CALL NZ,F2A4H
    LD A,05H
    OUT (C),A

LF34B:
    CALL F331H
    RET NZ
    IN A,(C)
    RRCA
    JR NC,F34BH
    DEC C
    OUT (C),H
    XOR A
    RET

; SER-CHIN consumes an already received character when status b1 is set; otherwise it waits while
; watching CTRL+ESC.

; -----------------------------------------------------------------------------
; SERIAL CHARACTER INPUT
; -----------------------------------------------------------------------------
;
; Reads one character from the selected USART, waiting if necessary.
;
; The input path first consumes an already received character when USART status b1 is set.
; Otherwise it disables interrupts, enables receive/transmit operation, and polls both the USART
; and the CTRL+ESC keyboard row until a character arrives or the user aborts. It then examines
; parity, overrun, and framing bits, clears the USART error state, and returns the received byte
; with an appropriate status.
;
; Entry:
;   No data register input; C is repurposed for the selected USART port.
;
; Exit:
;   C=received byte, A=00 or a receive/STOP error.
;
; Effects:
;   May temporarily disable interrupts and writes USART reset/error-clear commands.
; -----------------------------------------------------------------------------
SER_CHIN:
    CALL F30AH
    RET NC
    LD A,(0B71H)
    OR A
    CALL NZ,F2A4H
    IN A,(C)
    RRCA
    RRCA
    JR NC,F370H
    DEC C
    IN A,(C)
    LD C,A
    XOR A
    RET

; Receive wait temporarily selects keyboard row 7 and watches port 58 bits 3-4 for CTRL+ESC while
; the USART is idle.

; -----------------------------------------------------------------------------
; WAIT SERIAL RECEIVE WITH CTRL+ESC
; -----------------------------------------------------------------------------
;
; Restricts the keyboard scan to the abort row while waiting for USART input.
;
; With interrupts disabled the routine selects keyboard row 7 through port 03 and sends the USART
; receive/transmit enable command. It polls port 58 bits 3-4 for CTRL+ESC while also polling USART
; receive-ready.
;
; A stop sets the keyboard hold flag and returns F5H; a received byte re-enters the normal
; status/error path.
;
; Entry:
;   Selected USART command/status port in C.
;
; Exit:
;   Receive wait completes with a byte or an abort status.
;
; Effects:
;   Temporarily changes keyboard row selection and interrupt state.
; -----------------------------------------------------------------------------
SERIAL_RX_WAIT_KEYBOARD_ABORT:
    DI
    LD A,(0B11H)
    AND F0H
    OR 07H
    OUT (03H),A
    LD A,25H
    OUT (C),A

LF37E:
    IN A,(58H)
    AND 18H
    JR NZ,F38DH
    LD HL,0B62H
    SET 3,(HL)
    LD A,F5H
    EI
    RET

; On receive errors, issue the USART error-clear/transmit-enable command and return parity,
; overrun, or framing status.
; USART status mask 38H distinguishes receive faults. The routine clears the USART state before
; returning the byte and mapped error code.

; -----------------------------------------------------------------------------
; MAP USART RECEIVE ERRORS
; -----------------------------------------------------------------------------
;
; Clears USART error state and maps parity, overrun, or framing faults.
;
; After reading the data byte the status mask 38H is examined. The routine issues the
; error-clear/transmit-enable command, returns the byte in C, and selects distinct F4H, F2H, or
; F3H-style statuses.
;
; The mapping prevents a caller from confusing a valid zero byte with an error; A carries status
; independently of C.
;
; Entry:
;   USART status and data already read; C=selected command/status port.
;
; Exit:
;   C=received byte; A=00 or mapped receive error.
;
; Effects:
;   Writes USART command port and re-enables interrupts.
; -----------------------------------------------------------------------------
SERIAL_RX_ERROR_MAP:
    IN A,(C)
    RRCA
    RRCA
    JR NC,F37EH
    LD A,05H
    OUT (C),A
    IN A,(C)
    DEC C
    IN H,(C)
    EI
    AND 38H
    JR Z,F3B5H
    LD B,A
    INC C
    LD A,11H
    OUT (C),A
    LD A,F4H
    BIT 3,B
    JR NZ,F3B5H
    LD A,F2H
    BIT 4,B
    JR NZ,F3B5H
    LD A,F3H

LF3B5:
    LD C,H
    RET
    JP M,F3C0H

; SER-BKOUT delegates to the shared HI-MEM-checked block output helper.

; -----------------------------------------------------------------------------
; SERIAL BLOCK OUTPUT
; -----------------------------------------------------------------------------
;
; Sends a bounded memory block through SER-CHOUT.
;
; BC supplies the byte count and DE the source. The routine passes SER-CHOUT to the shared
; HI-MEM-checked block helper, so memory-limit and STOP statuses are handled identically to other
; OS block devices.
;
; Entry:
;   DE=source; BC=count.
;
; Exit:
;   A=00 or propagated error.
; -----------------------------------------------------------------------------
SER_BKOUT:
    LD HL,F33CH
    JP F24BH

; SER-BKIN delegates to the shared HI-MEM-checked block input helper.

; -----------------------------------------------------------------------------
; SERIAL BLOCK INPUT
; -----------------------------------------------------------------------------
;
; Receives a bounded memory block through SER-CHIN.
;
; BC supplies the byte count and DE the destination. The routine uses the shared HI-MEM-checked
; block-input helper with SER-CHIN as its worker.
;
; Entry:
;   DE=destination; BC=count.
;
; Exit:
;   A=00 or propagated receive/memory/STOP error.
; -----------------------------------------------------------------------------
SER_BKIN:
    LD HL,F359H
    JP F26CH

; Serial-line baud-rate divisor table.
; BAUD/PITCH table: low/high divisor bytes for the supported serial rates.
; Divisor words in physical EXTH are little-endian. BAUD=04H selects 0FAFH, the startup 1200-bit/s
; default under the 16-times USART clock.

; -----------------------------------------------------------------------------
; SERIAL BAUD DIVISOR TABLE
; -----------------------------------------------------------------------------
;
; Low/high divider words for BAUD values 00H through 08H.
;
; The nine little-endian words are 0C88H, 0D75H, 0EBAH, 0F5DH, 0FAFH, 0FD7H, 0FECH, 0FF6H, and
; 0FFBH.
;
; SER_SET indexes this table after clamping BAUD; the high byte is masked to the divider's low
; nibble before it is merged with the port-05 motor bits.
;
; Effects:
;   Read-only EXTH data used by SER_SET.
; -----------------------------------------------------------------------------
SERIAL_DIVISOR_TABLE:
    DB 88H, 0CH, 75H, 0DH, BAH, 0EH, 5DH, 0FH, AFH, 0FH, D7H, 0FH, ECH, 0FH, F6H, 0FH ; |..u...].........|
    DB FBH, 0FH                                                                     ; |..|

; Cassette character direction dispatcher; actual buffered routines begin at F593H/F653H.
; SYS cassette calls arrive at EXTH direction stubs; the common F3F4H exit loads D4 return address
; D9E7H and crosses FFF0H.

; -----------------------------------------------------------------------------
; CASSETTE CHARACTER DISPATCH
; -----------------------------------------------------------------------------
;
; Selects cassette character input or output and returns to SYS through the common gateway.
;
; The SYS D4 cassette entry reaches this stub after EXTH is paged. The direction flag selects
; CAS-CHIN or CAS-CHOUT, while F593H and F653H contain the actual buffered-device logic. F3F4H
; returns the result to the D4 forwarding stub.
; -----------------------------------------------------------------------------
EXT_CAS_CHIN_OUT:
    CALL F593H
    JR F3F4H

; Cassette block direction dispatcher; actual block routines begin at F633H/F6ADH.

; -----------------------------------------------------------------------------
; CASSETTE BLOCK DISPATCH
; -----------------------------------------------------------------------------
;
; Selects cassette block input or output and returns to SYS.
;
; This companion stub selects CAS-BKIN or CAS-BKOUT based on the operation direction and joins the
; common F3F4H return path.
; -----------------------------------------------------------------------------
EXT_CAS_BKIN_OUT:
    CALL F630H
    JR F3F4H
    CALL F3FAH
    JR F3F4H
    CALL F558H
    JR F3F4H
    CALL F605H
    JR F3F4H
    CALL F707H

; Common cassette return: point HL at D4's D9E7H return stub and cross FFF0H.

; -----------------------------------------------------------------------------
; RETURN TO SYS CASSETTE STUB
; -----------------------------------------------------------------------------
;
; Hands an EXTH cassette status back to the D4 forwarding routine.
;
; HL is loaded with the D4 return address D9E7H and the common FFF0H gateway restores the original
; mapping before returning to SYS.
; -----------------------------------------------------------------------------
EXT_DEVICE_RETURN:
    LD HL,D9E7H
    JP FFF0H

LF3FA:
    JP P,F4CFH

; CAS-OPEN searches normalized names in tape headers, displaying Searching/Found/Reading status.
; OPEN retries non-STOP physical read errors while searching. CTRL+ESC clears CRC/open state and
; returns the abort status.

; -----------------------------------------------------------------------------
; OPEN CASSETTE FILE FOR READING
; -----------------------------------------------------------------------------
;
; Searches tape headers for a requested file and initializes buffered or unbuffered input state.
;
; The open-read path rejects an existing input file, clears its work area, canonicalizes the
; requested name into 0BF4H, and repeatedly reads physical blocks while displaying Searching.
; Header names are compared case-insensitively; an empty requested name accepts the first file. A
; match displays Found and Reading, records file type, protection, sector count, buffer address,
; and remaining bytes, then returns the canonical name in DE.
;
; Entry:
;   DE=requested filename; cassette work area is available.
;
; Exit:
;   DE=canonical filename; A=00 on success or an open/read/protection/STOP error.
;
; Effects:
;   Starts the selected cassette motor and fills 0BF3H-0D14H input state.
; -----------------------------------------------------------------------------
CAS_OPEN_READ:
    CALL F762H
    LD A,EBH
    RET NZ
    LD HL,0BF3H
    LD BC,0121H
    CALL F54FH
    LD HL,0BF4H
    CALL F526H
    CALL F73CH
    LD HL,F74EH
    CALL F730H
    CALL F73CH

; Initialize input-sector pointer, remaining byte count, file type, protection, and next-sector
; state.

; -----------------------------------------------------------------------------
; INITIALIZE CASSETTE OPEN SEARCH
; -----------------------------------------------------------------------------
;
; Sets the open-read phase and performs the first physical block read.
;
; The path stores FFH in the read phase at 0D13H, points the name/destination state at 0C05H, and
; calls the physical reader. A non-STOP failure loops back to search; CTRL+ESC clears CRC/open
; state and returns the error.
;
; A successful header is left in the input buffer for the name comparison stage.
;
; Entry:
;   Requested normalized name at 0BF4H; cassette motors and work area available.
;
; Exit:
;   Physical header buffered or search error returned.
;
; Effects:
;   Updates 0D10H-0D13H, CRC seed use, status text, and tape timing state.
; -----------------------------------------------------------------------------
CAS_OPEN_RETRY_STATE:
    LD A,FFH
    LD (0D13H),A
    LD HL,0C05H
    LD (0D10H),HL
    LD HL,0100H
    LD (0D09H),HL
    XOR A
    LD (0D0BH),A
    LD (0D0CH),A
    LD (0D0DH),A
    CALL F77BH
    JR C,F451H
    LD A,(0D0BH)
    CP F5H
    JR NZ,F41EH

LF445:
    LD HL,0000H
    LD (0B6FH),HL
    LD HL,0BF3H
    LD (HL),00H
    RET

LF451:
    LD HL,F758H
    EXX
    LD HL,0C05H
    PUSH HL
    LD DE,0BF4H
    LD A,(DE)
    OR A
    JR Z,F46AH
    LD B,A
    INC B

; Filename comparison is length-prefixed and uppercase. A zero requested length is a wildcard;
; mismatch returns to the next physical header.

; -----------------------------------------------------------------------------
; COMPARE REQUESTED AND TAPE NAMES
; -----------------------------------------------------------------------------
;
; Accepts the first valid name for a wildcard request or compares a normalized name byte by byte.
;
; The length byte in the requested name is tested first. A zero length skips comparison and
; accepts the current header; otherwise the name bytes at 0BF4H and 0C05H are subtracted until
; mismatch or the length reaches zero.
;
; Mismatch resumes the physical search. Match proceeds to protection/type administration and
; copies the canonical name back to the caller's buffer.
;
; Entry:
;   DE=requested name; HL=tape name; length-prefixed uppercase strings.
;
; Exit:
;   Z/match path continues open; mismatch starts another search.
;
; Effects:
;   Reads/writes filename buffers and status-display state.
; -----------------------------------------------------------------------------
CAS_OPEN_NAME_COMPARE:
    LD A,(DE)
    SUB (HL)
    JR NZ,F46EH
    INC DE
    INC HL
    DJNZ F462H

LF46A:
    LD HL,F744H
    EXX

LF46E:
    EXX
    EX AF,AF'
    CALL F730H
    POP HL
    PUSH HL
    LD A,(HL)
    OR A
    CALL NZ,F730H
    CALL F73CH
    EX AF,AF'
    POP HL
    JR NZ,F41EH
    LD A,(0D14H)
    OR A
    JR Z,F495H
    LD HL,0D0CH
    LD A,(HL)
    OR A
    JR Z,F495H
    XOR A
    LD (HL),A
    LD A,E6H
    JP F445H

; A matched header copies its normalized name back to the caller's filename buffer and returns its
; address in DE.
; On a match, the input pointer is derived from 0C05H plus the filename length, leaving the
; payload byte immediately after the name.

; -----------------------------------------------------------------------------
; FINALIZE OPEN-READ ADMINISTRATION
; -----------------------------------------------------------------------------
;
; Records type, protection, buffer pointer, and remaining bytes after a matching header.
;
; The tape file type is copied into BUFFER policy, protection is checked against any output file,
; and the normalized name is copied to the caller's requested-name buffer.
;
; The first payload address is derived from the input buffer start plus the name length. The byte
; count and sector state are then ready for CAS_CHIN or CAS_BKIN.
;
; Entry:
;   Matching header already decoded into cassette workspace.
;
; Exit:
;   DE points at the canonical filename; A=00 on successful open.
;
; Effects:
;   Writes 0BF3H, 0B6BH, 0D05H-0D13H and filename buffers.
; -----------------------------------------------------------------------------
CAS_OPEN_MATCH_FINALIZE:
    LD A,(0BF3H)
    SUB 11H
    LD (0B6BH),A
    LD A,00H
    LD (0D13H),A
    LD HL,0C05H
    LD DE,0BF4H
    LD A,(HL)
    CP 11H
    JR C,F4AFH
    LD A,10H

LF4AF:
    INC A
    LD C,A
    LD B,00H
    LDIR
    LD HL,0C05H
    LD E,(HL)
    INC E
    LD D,00H
    ADD HL,DE
    LD (0D07H),HL
    LD HL,(0D05H)
    XOR A
    SBC HL,DE
    LD (0D05H),HL
    LD DE,0BF4H
    JP F5B5H

; CAS-CRTE rejects an existing file, clears output state, and prepares the first 0D26H buffer.
; CRTE rejects an existing open file and records buffered type as 01H or unbuffered type as 11H in
; the output state.

; -----------------------------------------------------------------------------
; CREATE CASSETTE FILE FOR WRITING
; -----------------------------------------------------------------------------
;
; Initializes an output file, canonicalizes its name, and prepares the first tape buffer.
;
; The routine rejects an already open file or a protected target, clears the output work area,
; converts the requested name into 0D15H, and records buffered/unbuffered and protection flags. It
; writes the name into the output buffer, sets the next output pointer and byte count, and leaves
; the file ready for CAS_CHOUT or CAS_BKOUT.
;
; Entry:
;   DE=requested filename and file attributes in system variables.
;
; Exit:
;   DE=canonical filename; A=00 on success.
;
; Effects:
;   Starts output-file state and reserves the 0D26H cassette buffer.
; -----------------------------------------------------------------------------
CAS_CREATE_WRITE:
    CALL F76BH
    LD A,EBH
    RET NZ
    LD A,(0D0CH)
    OR A
    LD A,E6H
    RET NZ
    LD HL,0D14H
    LD BC,0120H
    CALL F54FH
    LD HL,0D15H
    CALL F526H
    LD A,(0B6BH)
    OR A
    LD A,01H
    JR NZ,F4F5H
    LD A,11H

; -----------------------------------------------------------------------------
; INITIALIZE CASSETTE OUTPUT STATE
; -----------------------------------------------------------------------------
;
; Creates the normalized output name and seeds the first output buffer.
;
; The routine stores buffered/unbuffered type in both 0D14H and 0E2FH, records protection
; separately from the global PROTECT byte, and marks the output file as being in its header phase.
;
; The normalized name is copied to 0D26H, the first payload pointer follows it, and the initial
; count is the name length until the header is flushed.
;
; Entry:
;   DE=requested filename; BUFFER/type and protection policy in U0 variables.
;
; Exit:
;   Output file state ready for CAS_CHOUT or CAS_BKOUT.
;
; Effects:
;   Writes 0D14H-0E32H and initializes the output buffer.
; -----------------------------------------------------------------------------
CAS_CREATE_WRITE_STATE:
    LD (0D14H),A
    LD (0E2FH),A
    LD HL,0B6DH
    LD A,(HL)
    LD (HL),00H
    LD (0E30H),A
    LD A,FFH
    LD (0E32H),A
    LD HL,0D15H
    LD DE,0D26H
    LD (0E2CH),DE
    LD C,(HL)
    INC C
    LD B,00H
    LD (0E26H),BC
    LDIR
    LD (0E28H),DE
    LD DE,0D15H
    XOR A
    RET

; Filename normalizer caps names at 10H characters and folds lowercase ASCII to uppercase.
; The filename normalizer caps the length at 10H and folds lowercase ASCII to uppercase before any
; header comparison or write.

; -----------------------------------------------------------------------------
; NORMALIZE CASSETTE FILE NAME
; -----------------------------------------------------------------------------
;
; Copies a filename into a fixed ten-character, uppercase form.
;
; DE points to the source name and HL to the destination buffer. The first length byte is capped
; at 10H; each lowercase ASCII letter is converted to uppercase and copied. The resulting
; length-prefixed form is used in cassette headers and comparisons.
;
; Entry:
;   DE=source filename; HL=destination.
;
; Exit:
;   Canonical length-prefixed filename at HL.
; -----------------------------------------------------------------------------
CAS_NORMALIZE_FILENAME:
    EX DE,HL
    LD A,(HL)
    CP 11H
    JR C,F52EH
    LD A,10H

LF52E:
    LD (DE),A
    OR A
    RET Z
    LD B,A

LF532:
    INC HL
    INC DE
    LD A,(HL)
    CP 61H
    JR C,F54BH
    CP 7BH
    JR NC,F541H
    AND DFH
    JR F54BH

LF541:
    CP 90H
    JR C,F54BH
    CP 99H
    JR NC,F54BH
    SUB 10H

LF54B:
    LD (DE),A
    DJNZ F532H
    RET

; Zero-memory helper used for cassette work areas; DE is intentionally preserved.

; -----------------------------------------------------------------------------
; CLEAR MEMORY RANGE
; -----------------------------------------------------------------------------
;
; Fills BC bytes beginning at HL with zero.
;
; The cassette and reset paths use this compact helper to clear work areas without disturbing DE.
; HL advances and BC counts down until the requested region is zeroed.
;
; Entry:
;   HL=start; BC=count.
;
; Exit:
;   HL and BC advanced to the end of the range.
;
; Effects:
;   Writes zero bytes to RAM.
; -----------------------------------------------------------------------------
ZERO_MEMORY:
    LD (HL),00H
    INC HL
    DEC BC
    LD A,B
    OR C
    JR NZ,F54FH
    RET

; Partial buffered output is flushed by CLOSE or the next block operation; failure preserves the
; output error so a second CLOSE does not silently retry stale state.

; -----------------------------------------------------------------------------
; FLUSH PARTIAL OUTPUT BUFFER
; -----------------------------------------------------------------------------
;
; Writes pending buffered data or resets an output file after an error.
;
; The helper tests whether an output file is open and whether a partial buffer remains. If present
; it points 0E2CH at the buffer and calls the physical writer; a failed write preserves the error
; for CLOSE.
;
; The success path resets the next-byte pointer and count so CLOSE cannot emit the same partial
; sector twice.
;
; Entry:
;   Output state at 0D14H/0E26H-0E2AH.
;
; Exit:
;   Partial sector flushed or output error retained.
;
; Effects:
;   Calls physical tape writer and updates output counters.
; -----------------------------------------------------------------------------
CAS_OUTPUT_PARTIAL_FLUSH:
    JP M,F585H
    CALL F76BH
    JR Z,F57CH
    LD HL,0D26H
    LD (0E2CH),HL

LF566:
    LD A,FFH
    LD (0E2BH),A
    LD A,(0E2AH)
    OR A
    JR NZ,F57CH
    CALL F972H
    JR C,F57CH
    EX AF,AF'
    CALL F57CH
    EX AF,AF'
    RET

LF57C:
    XOR A
    LD (0D14H),A
    LD (0E2AH),A
    JR F58CH

LF585:
    XOR A
    LD (0BF3H),A
    LD (0D0CH),A

LF58C:
    LD HL,0000H
    LD (0B6FH),HL
    RET

LF593:
    JP P,F653H

; CAS-CHIN consumes buffered bytes and turns only the final FFH sector marker into EOF.

; -----------------------------------------------------------------------------
; CASSETTE CHARACTER INPUT
; -----------------------------------------------------------------------------
;
; Returns the next character from the input buffer, loading another tape sector when needed.
;
; CAS-CHIN validates that a file is open and not at EOF, then consumes the next buffered byte
; while advancing the input pointer and remaining-byte count. A sector-end marker causes the next
; buffered sector to be loaded; on the final sector its FFH marker becomes the file-end
; indication. Unbuffered files use the physical block reader directly.
;
; Entry:
;   Open cassette input state.
;
; Exit:
;   C=character and A=00, or E7H/EEH/EC H-style cassette status codes.
;
; Effects:
;   Advances 0D07H/0D05H and may invoke CAS_READ_PHYSICAL_BLOCK.
; -----------------------------------------------------------------------------
CAS_CHIN:
    CALL F762H
    RET Z
    CALL F772H
    RET NZ

; CAS_CHIN decrements 0D05H after fetching a byte and copies 0D0EH to EOF only when the count
; reaches zero. FFH is final; 00H requests another sector.

; -----------------------------------------------------------------------------
; CONSUME NEXT BUFFERED CASSETTE BYTE
; -----------------------------------------------------------------------------
;
; Returns one byte and advances the input pointer/count, promoting the sector marker to EOF at the
; final sector.
;
; The input byte is read through the pointer at 0D07H, the pointer advances, and 0D05H decrements.
; When the count reaches zero, 0D0EH is copied to EOF at 0B6EH; only FFH therefore ends the file.
;
; If the buffer is empty before a final marker, the helper resets the buffer pointer and enters
; the next-sector reader. Unbuffered files return their error rather than pretending a second byte
; buffer exists.
;
; Entry:
;   Open cassette input; 0D07H points at next byte and 0D05H counts bytes.
;
; Exit:
;   C=byte, A=00 on success, or cassette/EOF status.
;
; Effects:
;   Updates input pointer/count and may call the physical reader.
; -----------------------------------------------------------------------------
CAS_BUFFERED_INPUT_NEXT:
    LD BC,(0D05H)
    LD A,B
    OR C
    JR Z,F5C1H

LF5A6:
    LD HL,(0D07H)
    LD C,(HL)
    INC HL
    LD (0D07H),HL
    LD HL,(0D05H)
    DEC HL
    LD (0D05H),HL

LF5B5:
    LD A,H
    OR L
    JR NZ,F5BFH
    LD A,(0D0EH)
    LD (0B6EH),A

LF5BF:
    XOR A
    RET

LF5C1:
    LD A,(0BF3H)
    DEC A
    LD A,E7H
    RET NZ
    LD HL,0100H
    LD (0D09H),HL
    LD HL,0C05H
    LD (0D10H),HL
    LD (0D07H),HL

; When a buffered sector is exhausted, reset its pointer/count and read the next physical sector.
; A buffered sector rollover resets 0D07H and 0D10H to the input buffer start before reading the
; next physical block; an FFH prior marker bypasses the read.

; -----------------------------------------------------------------------------
; ADVANCE CASSETTE SECTOR
; -----------------------------------------------------------------------------
;
; Loads the next buffered sector only when the previous marker is not final.
;
; A zero sector-end marker causes 0D10H and 0D07H to reset to the input buffer start before the
; physical read. An FFH marker becomes EOF and bypasses another read.
;
; Physical failure is copied to 0D0BH; the routine sets the terminal state and clears the
; available-byte count before returning the saved error.
;
; Entry:
;   Previous sector exhausted; 0D0EH contains its end marker.
;
; Exit:
;   Next sector buffered or terminal/error state returned.
;
; Effects:
;   Updates sector number, buffer pointers, EOF, and cassette error.
; -----------------------------------------------------------------------------
CAS_INPUT_LOAD_NEXT_SECTOR:
    LD A,(0D0EH)
    OR A
    LD A,ECH
    CALL Z,F77BH
    JR NC,F5EEH
    LD A,(0BF3H)
    DEC A
    JR Z,F5A6H
    XOR A
    SCF
    RET

LF5EB:
    LD (0D0BH),A

LF5EE:
    LD HL,0D0BH
    LD A,(HL)
    LD (HL),ECH

LF5F4:
    LD HL,0D0EH
    LD (HL),FFH
    LD HL,0000H
    LD (0D05H),HL
    LD HL,0B6EH
    LD (HL),FFH
    RET

; CAS-VERIFY compares each received byte with memory and returns E8H at the first mismatch.

; -----------------------------------------------------------------------------
; VERIFY CASSETTE DATA
; -----------------------------------------------------------------------------
;
; Compares bytes read from a cassette file against a memory block.
;
; The routine marks verify mode, repeatedly obtains bytes through the character-input path, and
; compares each one with memory at DE. On mismatch it returns E8H with DE at the failing address
; and BC holding the remaining length; a complete match returns A=00.
;
; Entry:
;   DE=memory address; BC=length.
;
; Exit:
;   A=00 if equal, otherwise verification/read error with the mismatch position retained.
;
; Effects:
;   Consumes input and uses the cassette sector machinery.
; -----------------------------------------------------------------------------
CAS_VERIFY_DATA:
    CALL F762H
    RET Z
    CALL F772H
    RET NZ
    LD A,FFH
    LD (0BF1H),A
    LD A,(0BF3H)
    DEC A
    JR NZ,F63FH

; VERIFY advances DE and BC only on equal bytes. E8H returns at the mismatch with the failing
; address and remaining count intact.

; -----------------------------------------------------------------------------
; COMPARE CASSETTE DATA AGAINST MEMORY
; -----------------------------------------------------------------------------
;
; Reads bytes through CAS_CHIN and returns the first mismatch with its remaining length.
;
; VERIFY sets 0BF1H and repeatedly obtains a byte, compares it with (DE), and advances DE/BC only
; on equality. A mismatch returns E8H with DE at the failing address and BC as the unprocessed
; count.
;
; For unbuffered files the physical block reader performs the same comparison while decoding, so
; verification still includes header, length, sector sequence, and CRC checks.
;
; Entry:
;   DE=memory address; BC=length; input file open.
;
; Exit:
;   A=00 when all bytes match; E8H/read error at first failure.
;
; Effects:
;   Consumes cassette data and updates input state.
; -----------------------------------------------------------------------------
CAS_VERIFY_COMPARE_LOOP:
    PUSH BC
    PUSH DE
    CALL F59EH
    LD L,C
    POP DE
    POP BC
    OR A
    RET NZ
    LD A,(DE)
    CP L
    LD A,E8H
    JP NZ,F5EBH
    INC DE
    DEC BC
    LD A,B
    OR C
    JR NZ,F618H
    RET

LF630:
    JP P,F6ADH

; CAS-BKIN uses character input for buffered files and physical sector input for unbuffered files.

; -----------------------------------------------------------------------------
; CASSETTE BLOCK INPUT
; -----------------------------------------------------------------------------
;
; Loads a memory block from a buffered or unbuffered cassette file.
;
; Buffered files are serviced by repeated CAS_CHIN calls. Unbuffered files pass DE and BC to the
; physical block reader, while the verify flag selects comparison instead of storing bytes.
; File-open, EOF, and physical-read errors are propagated without losing the current cassette
; state.
;
; Entry:
;   DE=destination; BC=length.
;
; Exit:
;   A=00 on success or cassette/memory/STOP error.
; -----------------------------------------------------------------------------
CAS_BKIN:
    CALL F762H
    RET Z
    CALL F772H
    RET NZ
    LD A,(0BF3H)
    DEC A

; Buffered BKIN loops through CAS_CHIN; unbuffered BKIN passes DE/BC to the physical reader, where
; 0BF1H selects store versus compare.

; -----------------------------------------------------------------------------
; SELECT BUFFERED OR UNBUFFERED BLOCK INPUT
; -----------------------------------------------------------------------------
;
; Dispatches block input through character reads or direct physical sectors.
;
; The file type at 0BF3H is decremented to distinguish buffered input from unbuffered input.
; Buffered transfers call the character loop so sector rollover and EOF are centralized.
;
; Unbuffered transfers store DE/BC in the physical-reader workspace and invoke the sector reader
; directly; 0BF1H selects storing versus VERIFY comparison.
;
; Entry:
;   DE=destination; BC=length; input type at 0BF3H.
;
; Exit:
;   A=00 on completion or first cassette/memory/STOP error.
;
; Effects:
;   Updates 0D09H-0D10H and may write the destination range.
; -----------------------------------------------------------------------------
CAS_BLOCK_INPUT_MODE:
    LD HL,F59EH
    JP Z,F26CH
    LD (0D10H),DE
    LD (0D09H),BC
    CALL F5D7H
    JP F5F4H

; CAS-CHOUT appends one character to the output buffer and flushes a full 256-byte sector.

; -----------------------------------------------------------------------------
; CASSETTE CHARACTER OUTPUT
; -----------------------------------------------------------------------------
;
; Buffers one output character and writes a sector when the 256-byte buffer fills.
;
; The routine validates an output file, stores C in the output buffer, decrements the remaining
; name/sector count, and when the 256-byte buffer is full calls the physical block writer.
; Unbuffered files defer actual output to CAS_BKOUT, while buffered files flush automatically at
; the sector boundary.
;
; Entry:
;   C=character; output file is open.
;
; Exit:
;   A=00 when buffered; carry marks a completed physical write; errors identify EOF, protection,
;   or STOP.
;
; Effects:
;   Updates 0E26H/0E28H/0E2AH-0E32H output state.
; -----------------------------------------------------------------------------
CAS_CHOUT:
    CALL F76BH
    RET Z
    LD A,(0E2AH)
    OR A
    LD A,ECH
    RET NZ
    LD A,C
    LD (0E2EH),A
    LD HL,0E2FH
    LD A,(HL)
    OR A
    JR Z,F66DH
    DEC (HL)
    JP Z,F689H

; A full buffered output sector contains exactly 256 bytes. At the boundary the physical writer is
; called, then the pending next byte becomes the first byte of a new sector.

; -----------------------------------------------------------------------------
; APPEND BYTE TO CASSETTE BUFFER
; -----------------------------------------------------------------------------
;
; Stores one output byte and flushes exactly at the 256-byte boundary.
;
; The character in C is written at the pointer represented by 0E26H/0E28H; the remaining-byte
; count is decremented and the next pointer advances.
;
; When the count reaches zero the physical writer is called for the full sector. The successful
; flush resets the count to one and places the pending character at the new buffer start.
;
; Entry:
;   C=character; output file open and not at EOF.
;
; Exit:
;   A=00 for buffered append, carry after a physical flush, or output error.
;
; Effects:
;   Writes 0D26H-0E25H and updates 0E26H-0E32H.
; -----------------------------------------------------------------------------
CAS_BUFFERED_OUTPUT_APPEND:
    LD DE,(0E26H)
    LD HL,0100H
    OR A
    SBC HL,DE
    JP Z,F689H
    INC DE
    LD (0E26H),DE
    LD HL,(0E28H)
    LD (HL),C
    INC HL
    LD (0E28H),HL
    XOR A
    RET

; Physical output is invoked when the buffered sector reaches capacity; partial output remains
; pending for CLOSE.

; -----------------------------------------------------------------------------
; FLUSH FULL CASSETTE SECTOR
; -----------------------------------------------------------------------------
;
; Sends a full 256-byte buffered sector and prepares the next one.
;
; 0E2CH is set to the output buffer start and the physical writer is called. On success the next
; output pointer and one-sector count are reset so the just-written sector cannot be repeated.
;
; A failure decrements/stores the output error and leaves the open state for CLOSE/error
; reporting.
;
; Entry:
;   Output buffer contains 256 bytes; output metadata is current.
;
; Exit:
;   Next output sector ready or sticky output error.
;
; Effects:
;   Writes tape and updates sector/source counters.
; -----------------------------------------------------------------------------
CAS_OUTPUT_FULL_SECTOR:
    LD HL,0D26H
    LD (0E2CH),HL
    CALL F972H
    JR C,F699H

LF694:
    LD HL,0E2AH
    DEC (HL)
    RET

LF699:
    LD HL,0001H
    LD (0E26H),HL
    LD A,(0E2EH)
    LD HL,0D26H
    LD (HL),A
    INC HL
    LD (0E28H),HL
    XOR A
    SCF
    RET

; CAS-BKOUT flushes a partial buffer, then writes the requested block through the physical writer.

; -----------------------------------------------------------------------------
; CASSETTE BLOCK OUTPUT
; -----------------------------------------------------------------------------
;
; Writes a memory block as one or more physical cassette sectors.
;
; Buffered output first flushes any partial sector, then records DE/BC for the physical writer.
; Unbuffered output invokes the physical block routine directly. The file-end and open-state flags
; are maintained so CLOSE can flush the last partial sector exactly once.
;
; Entry:
;   DE=source; BC=length.
;
; Exit:
;   A=00 or cassette/STOP error.
;
; Effects:
;   Writes headers/data/CRC through CAS_WRITE_PHYSICAL_BLOCK and updates output state.
; -----------------------------------------------------------------------------
CAS_BKOUT:
    CALL F76BH
    RET Z
    LD A,(0D14H)
    DEC A
    LD HL,F657H
    JP Z,F24BH
    LD A,(0E2AH)
    OR A
    LD A,ECH
    RET NZ
    PUSH BC
    PUSH DE
    LD HL,0E2FH
    LD A,(HL)
    LD (HL),00H
    OR A
    SCF
    CALL NZ,F689H
    POP DE
    POP BC
    JR NC,F694H
    LD (0E26H),BC
    LD (0E2CH),DE
    JP F566H

; Motor control selects b6/b7 of PORT05 for the left/right cassette connector and preserves other
; bits.

; -----------------------------------------------------------------------------
; CASSETTE MOTOR CONTROL
; -----------------------------------------------------------------------------
;
; Selects or stops the left/right cassette motor while preserving unrelated port bits.
;
; A selects the read/write side and D distinguishes on from off. The corresponding b6/b7 motor bit
; is combined with the port-05 mirror, interrupts are masked around the write, and the mirror is
; updated. CAS_STOP_MOTOR clears both motor bits before restoring the normal interrupt state.
;
; Entry:
;   A=drive selection; D=on/off convention.
;
; Exit:
;   Cassette motor control lines updated.
;
; Effects:
;   Writes port 05H and 0B12H atomically with respect to interrupts.
; -----------------------------------------------------------------------------
CAS_MOTOR_CONTROL:
    LD L,40H
    OR A
    JR Z,F6E4H
    ADD HL,HL

; REMRED can swap the physical read/write side. CAS_MOTOR_CONTROL masks interrupts while
; preserving divider, sound, and motor bits not being changed.

; -----------------------------------------------------------------------------
; SELECT CASSETTE MOTOR ROUTING
; -----------------------------------------------------------------------------
;
; Converts REMRED selection into the left/right motor bit while preserving unrelated port-05
; state.
;
; The drive selector maps to bit 6 or bit 7, then REMRED can swap the chosen side for read/write
; routing. Interrupts are disabled around the port-05 mirror update.
;
; The routine writes the resulting value to both 0B12H and port 05H; sound enable, IRQ, and
; divider bits remain unchanged.
;
; Entry:
;   A=drive/read-write selection; D=on/off convention; REMRED at 0B6CH.
;
; Exit:
;   Selected motor bit changed atomically.
;
; Effects:
;   Writes port 05H and 0B12H; briefly masks interrupts.
; -----------------------------------------------------------------------------
CAS_MOTOR_SELECT_BITS:
    LD A,(0B6CH)
    AND L
    JR Z,F6EEH
    LD A,C0H
    XOR L
    LD L,A

LF6EE:
    DI
    LD A,(0B12H)
    OR L
    INC D
    DEC D
    JR Z,F6F8H
    XOR L

LF6F8:
    OUT (05H),A
    LD (0B12H),A
    EI
    RET

; Stop both motors and restore the quiet port-05 state after cassette transfer.

; -----------------------------------------------------------------------------
; STOP BOTH CASSETTE MOTORS
; -----------------------------------------------------------------------------
;
; Clears motor bits and leaves the normal port-05 state for restoration.
;
; The helper masks interrupts, clears bits 7-6 of the port-05 mirror, writes the quiet value to
; hardware, then returns to the caller's interrupt state.
;
; It is used by CLOSE and the physical transfer restore path, not as a substitute for restoring
; the caller's full port-05 value.
;
; Effects:
;   Stops both cassette motors and updates 0B12H.
; -----------------------------------------------------------------------------
CAS_STOP_MOTORS:
    DI
    LD A,(0B12H)
    AND 3FH
    JR F6F8H

; Clear cassette workspace 0BF0H-0E33H, reset CRC/MUDDLE, EOF/protection, and cassette sound
; state.
; CAS_WORK_INIT clears 0BF0H-0E33H, resets PROTECT/EOF/MUDDLE, chooses left-side read/write
; routing (80H), and stops both motors.

; -----------------------------------------------------------------------------
; CASSETTE WORKSPACE INITIALIZATION
; -----------------------------------------------------------------------------
;
; Clears cassette buffers, flags, CRC seed, and motor state.
;
; The initializer clears the 0BF0H-0E33H cassette work area, resets PROTECT and EOF, sets
; MUDDLE/CRC to zero, selects the default motor-control mask, and silences cassette-related sound
; bits in PORT05. It is called at startup and when a file is closed or an aborted transfer is
; unwound.
;
; Effects:
;   Erases cassette input/output buffers and restores quiet hardware state.
; -----------------------------------------------------------------------------
CAS_WORK_INIT:
    XOR A
    LD HL,0BF0H
    LD DE,0BF1H
    LD BC,0244H
    LD (HL),A
    LDIR
    LD (0B6DH),A
    LD (0B6EH),A
    LD HL,0000H
    LD (0B6FH),HL
    LD A,80H
    LD (0B6CH),A
    LD A,(0B12H)
    AND 3FH
    LD (0B12H),A
    OUT (05H),A
    RET

; Display a cassette status string through the selected output device; entries are length-prefixed
; at F741H.

; -----------------------------------------------------------------------------
; CASSETTE STATUS TEXT TABLE
; -----------------------------------------------------------------------------
;
; Length-prefixed Searching, Found, and Reading strings used during OPEN.
;
; The table contains control prefixes, the text strings, and small formatting fragments used by
; the cassette open path. OPEN selects a string pointer and sends it through the selected output
; device.
;
; These are data, not executable entry points; the embedded bytes following the text include
; device-class call fragments used by the ROM's compact formatter.
;
; Effects:
;   Read by cassette status display helpers.
; -----------------------------------------------------------------------------
CASSETTE_STATUS_STRINGS:
    LD B,(HL)

LF731:
    INC HL
    PUSH BC
    PUSH HL
    LD C,(HL)
    RST 30H
    LD HL,C1E1H
    DJNZ F731H
    RET

LF73C:
    LD HL,F741H
    JR F730H

; "Reading:" cassette status text.
; Embedded status text: Reading:, Searching, and Found:.
    DB 02H, 0DH, 0AH, 09H, 52H, 65H, 61H, 64H, 69H, 6EH, 67H, 3AH, 20H              ; |....Reading: |

; "Searching" cassette status text.
    DB 09H, 53H, 65H, 61H, 72H, 63H, 68H, 69H, 6EH, 67H                             ; |.Searching|

; "Found:" cassette status text.
    DB 09H, 46H, 6FH, 75H, 6EH, 64H, 3AH, 20H, 20H, 20H, AFH, 32H, F1H, 0BH, 3AH, F3H ; |.Found:   .2..:.|
    DB 0BH, 18H, 03H, 3AH, 14H, 0DH, B7H, 3EH, E9H, C9H, 21H, 0BH, 0DH, 7EH, B7H, C8H ; |...:...>..!..~..|
    DB 36H, ECH, C9H                                                                ; |6..|

; Physical reader measures pilot/sync timing, validates the 6AH marker and sector metadata, then
; decodes bytes and CRC.
; The physical reader starts with pilot timing calibration, then synchronizes before accepting
; marker 6AH and metadata.

; -----------------------------------------------------------------------------
; READ PHYSICAL CASSETTE BLOCK
; -----------------------------------------------------------------------------
;
; Synchronizes to tape, decodes a sector header/data stream, and verifies its CRC.
;
; The reader enables cassette timing, measures the pilot and synchronization waveform, and decodes
; the 6AH marker, block type, file type, protection flag, sector count, and byte count. It reads
; each data byte while updating the CRC, compares the received CRC, stores the sector-end marker,
; and updates the next-buffer address and remaining count. Header/name mismatch, invalid sector
; numbering, short reads, CRC failure, and CTRL+ESC all have distinct error paths.
;
; Entry:
;   Cassette timing state, destination pointer at 0D10H, requested length at 0D09H.
;
; Exit:
;   Decoded block in memory/buffer; A=00 on success or an E7-EAH/STOP error.
;
; Effects:
;   Uses ports 04H, 50H, 58H, 59H, 5BH and temporarily replaces the interrupt vector.
; -----------------------------------------------------------------------------
CAS_READ_PHYSICAL_BLOCK:
    LD (0E33H),SP
    XOR A
    LD D,A
    CALL F6DEH
    CALL FA7CH

; Pilot periods are averaged/scaled into D. Unstable measurements restart calibration instead of
; allowing the header parser to drift.

; -----------------------------------------------------------------------------
; CALIBRATE CASSETTE PILOT
; -----------------------------------------------------------------------------
;
; Measures repeated pilot periods and derives the expected full-wave timing.
;
; The reader resets the timing divider, samples a run of pilot periods through CAS_READ_BIT,
; accumulates them, and scales the result into D. It repeats on unstable measurements until the
; interval is within the accepted tolerance.
;
; The calibrated period is retained for bit classification and is independent of the later
; header/data byte count.
;
; Entry:
;   Cassette input active; timing interrupt enabled.
;
; Exit:
;   D carries the expected full-wave period or the reader restarts on unstable pilot.
;
; Effects:
;   Reads port 59H and timing counter; updates border/timing state.
; -----------------------------------------------------------------------------
CAS_READ_PILOT_CALIBRATION:
    XOR A
    LD (0BF0H),A
    EXX
    LD HL,0000H
    LD B,00H
    EXX
    LD A,DCH
    OUT (04H),A
    LD C,00H
    CALL F93CH
    LD HL,0000H
    LD B,20H
    LD D,H

LF7A1:
    CALL F938H
    ADD HL,DE
    DJNZ F7A1H
    ADD HL,HL
    ADD HL,HL
    ADD HL,HL
    LD A,H
    RL L
    ADC A,B
    LD D,A
    LD HL,0400H

LF7B2:
    CALL F938H
    EXX
    ADD A,B
    LD B,A
    JR NC,F7BBH
    INC HL

LF7BB:
    EXX
    LD A,E
    SUB D
    JR NC,F7C2H
    NEG

LF7C2:
    CP 03H
    JR NC,F787H
    DEC HL
    LD A,H
    OR L
    JR NZ,F7B2H
    EXX
    ADD HL,HL
    ADD HL,HL
    ADD HL,HL
    ADD HL,HL
    ADD HL,HL
    ADD HL,HL
    LD A,H
    RL L
    ADC A,00H
    EXX
    PUSH AF
    LD A,88H
    LD (0BF0H),A
    LD A,E8H
    OUT (04H),A
    CALL F93CH
    LD HL,0000H
    PUSH HL
    LD B,H
    LD D,H

; Calibrate expected one/zero pulse periods from the pilot waveform before consuming the header.

LF7EB:
    EX (SP),HL
    CALL F92BH
    ADD HL,DE
    ADD HL,DE
    DJNZ F7EBH
    LD A,H
    RL L
    ADC A,B
    LD D,A
    POP HL
    LD A,H
    RL L
    ADC A,B
    LD H,A
    LD L,D
    POP DE
    CALL F92BH

LF803:
    LD A,L
    LD L,H
    LD H,A
    CALL F92BH
    SUB H
    JR NC,F813H
    ADD A,02H
    JR C,F803H
    JP F787H

; Decode marker 6AH, block type, file type, protection, sector number, and sector byte count.
; The physical stream is accepted only after CAS_READ_BYTE returns marker 6AH. The next bytes
; define block type, file type, protection, sector number/count, and payload count.

; -----------------------------------------------------------------------------
; DECODE SYNC AND 6AH MARKER
; -----------------------------------------------------------------------------
;
; Reads the synchronization byte and rejects a stream without marker 6AH.
;
; After pilot calibration the reader switches divider timing, calls CAS_READ_BYTE, and compares
; the returned byte with 6AH. A mismatch restarts pilot acquisition rather than treating arbitrary
; tape noise as a header.
;
; The following bytes are decoded as block type, file type, protection, sector count, and byte
; count before payload decoding begins.
;
; Entry:
;   D=calibrated period; cassette reader state initialized.
;
; Exit:
;   Metadata decode begins only when the marker is 6AH.
;
; Effects:
;   Advances the physical stream and CRC state.
; -----------------------------------------------------------------------------
CAS_READ_SYNC_MARKER:
    CP 04H
    JR C,F803H
    LD A,DCH
    OUT (04H),A
    CALL F92BH
    LD IY,0000H
    LD IX,(0D10H)
    CALL F919H
    EXX
    LD HL,(0B6FH)
    LD DE,(0D09H)
    EXX
    CALL F919H
    CP 6AH
    JP NZ,F787H
    CALL F919H
    LD HL,0D13H
    CP (HL)
    JR Z,F84CH
    LD A,(HL)
    CP FFH
    JP Z,F787H
    JP F8FDH

LF84C:
    LD (0D0FH),A
    CALL F919H
    LD (0BF3H),A
    CALL F919H
    LD (0D0CH),A
    CALL F919H
    LD B,A
    PUSH BC
    JR F868H

LF862:
    PUSH BC
    EXX
    LD HL,(0B6FH)
    EXX

LF868:
    CALL F919H
    LD HL,0D0DH
    CP (HL)
    JP NZ,F8FDH
    CALL F919H
    LD B,A

; For each sector, update CRC while storing or comparing bytes; reject wrong length, sequence, or
; CRC.
; Each sector's CRC is checked after its payload and end marker. The reader increments 0D0DH only
; after the received CRC equals the computed CRC.

; -----------------------------------------------------------------------------
; DECODE AND CHECK ONE CASSETTE SECTOR
; -----------------------------------------------------------------------------
;
; Stores or compares payload bytes, checks the sector marker and CRC, then advances state.
;
; The loop reads the sector byte count, obtains each payload byte through CAS_READ_BYTE, and
; either stores it at IX or compares it against the caller's memory when VERIFY is set.
;
; After payload it reads the sector-end marker and two CRC bytes, compares the received pair with
; the computed CRC, stores the next buffer address/count, increments the sector number, and
; repeats when more bytes remain.
;
; Entry:
;   IX=destination/buffer; DE=remaining requested bytes; current CRC in HL'.
;
; Exit:
;   Sector state advanced or E7/E8/EA-style read error.
;
; Effects:
;   Writes input buffers or compares memory; updates 0D05H-0D10H and CRC.
; -----------------------------------------------------------------------------
CAS_READ_SECTOR_LOOP:
    CALL F919H
    EX AF,AF'
    EXX
    LD A,D
    OR E
    DEC DE
    EXX
    JP Z,F901H
    LD A,(0BF3H)
    DEC A
    JR Z,F897H
    LD A,(0BF1H)
    OR A
    JR Z,F897H
    EX AF,AF'
    CP (IX+00H)
    JR Z,F89BH
    JP F909H

LF897:
    EX AF,AF'
    LD (IX+00H),A

LF89B:
    INC IX
    INC IY
    DJNZ F876H
    CALL F919H
    LD (0D0EH),A
    EXX
    PUSH HL
    EXX
    CALL F919H
    CP A
    EX AF,AF'
    POP HL
    LD B,H
    CALL F919H
    LD C,L
    LD H,A
    EX AF,AF'
    LD L,A
    SBC HL,BC
    POP BC
    JR NZ,F8FDH
    LD (0D05H),IY
    LD (0D10H),IX
    LD HL,0D0DH
    INC (HL)
    EXX
    LD (0D09H),DE
    EXX
    DJNZ F862H
    LD A,(0BF3H)
    DEC A
    JR Z,F8E3H
    LD A,(0D13H)
    CP FFH
    JR Z,F8E3H
    EXX
    LD A,D
    OR E
    JR NZ,F901H

LF8E3:
    JP FABDH

LF8E6:
    LD A,F5H
    LD (0E2AH),A
    JR F8F2H

LF8ED:
    LD A,F5H
    LD (0D0BH),A

LF8F2:
    LD HL,0B62H
    SET 3,(HL)
    LD B,00H

LF8F9:
    DJNZ F8F9H
    JR F90EH

; Map physical-reader failure to EA/EB/E7/E8/E9-style cassette status and restore interrupt state.
; Physical reader errors are normalized before CAS_RESTORE_INTERRUPTS: EAH for structural/length
; failure, E7H for read failure, and E8H for VERIFY mismatch.

; -----------------------------------------------------------------------------
; MAP PHYSICAL READ FAILURE
; -----------------------------------------------------------------------------
;
; Converts sequence, verify, and physical errors into cassette status and restores interrupts.
;
; A sector-length/sequence failure becomes EAH; a normal physical read failure becomes E7H; VERIFY
; mismatch becomes E8H. The chosen code is stored at 0D0BH.
;
; The status is saved across CAS_RESTORE_INTERRUPTS, the stack is restored from 0E33H, and the
; same error reaches OPEN, CHIN, or BKIN without leaking tape interrupt state.
;
; Entry:
;   Reader failure condition and saved stack at 0E33H.
;
; Exit:
;   A=cassette status; normal interrupt configuration restored.
;
; Effects:
;   Writes 0D0BH and invokes the complete restore path.
; -----------------------------------------------------------------------------
CAS_READ_FAILURE_MAP:
    LD A,EAH
    JR F90BH

LF901:
    LD A,(0BF1H)
    OR A
    LD A,E7H
    JR Z,F90BH

LF909:
    LD A,E8H

LF90B:
    LD (0D0BH),A

LF90E:
    PUSH AF
    CALL FABDH
    POP AF
    OR A
    LD SP,(0E33H)
    RET

; Assemble eight measured bits into H; each bit also passes through the CRC update.

; -----------------------------------------------------------------------------
; READ ONE CASSETTE BYTE
; -----------------------------------------------------------------------------
;
; Samples eight timed cassette bits and assembles them into a byte.
;
; H is initialized as the bit accumulator. For each bit the routine measures a pulse period
; relative to the calibrated D value, feeds the bit into the CRC helper, rotates it into H, and
; repeats until all eight bits are collected.
;
; Entry:
;   D=expected full-wave period; cassette input timing active.
;
; Exit:
;   A=decoded byte or an abort status.
; -----------------------------------------------------------------------------
CAS_READ_BYTE:
    LD H,80H

; CAS_READ_BYTE rotates bits into H in the same order that CAS_WRITE_BYTE emits them; the CRC
; update happens once per measured bit.

; -----------------------------------------------------------------------------
; ASSEMBLE EIGHT TAPE BITS
; -----------------------------------------------------------------------------
;
; Classifies eight measured periods and rotates them into a byte.
;
; H starts at 80H. Each full-period measurement is compared with D, the resulting bit is passed to
; CAS_CRC_UPDATE, and RR H shifts the new bit into the accumulator until the high marker exits.
;
; The routine returns the assembled byte in A; the physical reader's byte ordering therefore
; follows the tape serializer's RRC sequence.
;
; Entry:
;   D=expected full-wave period; timing interrupt active.
;
; Exit:
;   A=decoded byte; CRC alternate HL' updated.
;
; Effects:
;   Reads timing counter and updates CRC.
; -----------------------------------------------------------------------------
CAS_READ_BYTE_BITS:
    CALL F938H
    CP D
    PUSH AF
    SBC A,A
    CALL FAF7H
    POP AF
    RR H
    JR NC,F91BH
    LD A,H
    RET

; Measure one signal transition using port 59H bit 5 and the periodic interrupt counter E.

; -----------------------------------------------------------------------------
; MEASURE CASSETTE HALF-BIT
; -----------------------------------------------------------------------------
;
; Waits for one cassette signal transition and returns its elapsed tick count.
;
; The routine samples port 59H bit 5, waits for the opposite level, counts periodic interrupts in
; E, resets the frequency divider/interrupt acknowledgement as needed, and returns the transition
; interval. It is the low-level timing primitive used by byte and block decoding.
; -----------------------------------------------------------------------------
CAS_READ_HALF_BIT:
    IN A,(59H)
    AND 20H
    XOR 20H
    LD C,A
    LD E,00H
    EI
    HALT
    JR F947H

; Measure a full square-wave period, periodically check CTRL+ESC, acknowledge timing interrupts,
; and return E.

; -----------------------------------------------------------------------------
; MEASURE CASSETTE BIT PERIOD
; -----------------------------------------------------------------------------
;
; Measures a complete cassette square-wave period and detects STOP.
;
; The routine waits for the selected input level and then its opposite, counting in E while
; polling CTRL+ESC. It resets the divider at the transition, acknowledges the interrupt,
; optionally toggles the border for activity indication, and returns the measured period.
; -----------------------------------------------------------------------------
CAS_READ_BIT:
    LD E,00H
    EI
    HALT

; Full-period measurement waits for the selected level then its complement, counts timing
; interrupts in E, acknowledges the divider, and watches CTRL+ESC.

; -----------------------------------------------------------------------------
; MEASURE ONE FULL TAPE PERIOD
; -----------------------------------------------------------------------------
;
; Waits for both signal transitions and returns the interrupt tick count.
;
; The routine waits for the selected port-59 bit level and then its complement, incrementing E on
; each timing interrupt. At the transition it resets/acknowledges the divider and optionally
; toggles the border for activity feedback.
;
; Port 58 is polled for CTRL+ESC through the timing path; a stop branches to the reader abort code
; rather than returning a misleading short period.
;
; Entry:
;   C contains the expected cassette input level; E is the counter.
;
; Exit:
;   E=measured full period or STOP/reader failure.
;
; Effects:
;   Reads ports 58H, 59H, 5BH and acknowledges the timing divider.
; -----------------------------------------------------------------------------
CAS_READ_BIT_TRANSITIONS:
    INC E
    CALL Z,F969H
    IN A,(59H)
    XOR C
    AND 20H
    JR Z,F93CH

LF947:
    INC E
    CALL Z,F969H
    IN A,(59H)
    XOR C
    AND 20H
    JR NZ,F947H
    IN A,(5BH)
    OUT (07H),A

; Reset the cassette timing divider and optionally toggle the border to show tape activity.

LF956:
    LD A,(0BF0H)
    OR A
    JR Z,F969H
    CP 88H
    LD A,A0H
    JR Z,F964H
    LD A,88H

LF964:
    LD (0BF0H),A
    OUT (00H),A

LF969:
    IN A,(58H)
    AND 18H
    JP Z,F8EDH
    LD A,E
    RET

; Physical writer emits pilot, sync, 6AH marker, metadata, sector data, sector terminators, and
; CRC.

; -----------------------------------------------------------------------------
; WRITE PHYSICAL CASSETTE BLOCK
; -----------------------------------------------------------------------------
;
; Emits pilot, synchronization, header, data sectors, CRC, and trailer waveform.
;
; The writer starts the selected motor and waits for speed stabilization, enables the tape timing
; interrupt, emits a pilot whose length depends on header/data type, and writes synchronization,
; marker, block metadata, sector counts, data bytes, sector-end markers, and per-sector CRC. It
; closes with five trailer periods and restores the system's previous interrupt state.
;
; Entry:
;   DE=source; BC=length; file type/protection and MUDDLE are in cassette work variables.
;
; Exit:
;   Carry/A status indicates completed or aborted physical transfer.
;
; Effects:
;   Drives port 50H and sound/timing hardware; may change border and interrupt vectors.
; -----------------------------------------------------------------------------
CAS_WRITE_PHYSICAL_BLOCK:
    LD (0E33H),SP
    XOR A
    LD D,A
    DEC A
    CALL F6DEH
    LD BC,0000H

; Header pilot length is 40H groups for header blocks and 20H groups for data blocks. Marker 6AH
; follows two sync periods and an empty sync byte.

; -----------------------------------------------------------------------------
; EMIT CASSETTE PILOT AND HEADER
; -----------------------------------------------------------------------------
;
; Writes pilot, synchronization, marker, and block metadata before sector payload.
;
; The pilot length depends on E32H: header blocks use 40H groups of 256 periods and data blocks
; use 20H groups. Two sync periods, an empty byte, and marker 6AH follow.
;
; The writer then emits block type, file type, protection, sector count, and first sector byte
; count before entering the payload loop.
;
; Entry:
;   DE=source/buffer; BC=length; output metadata and MUDDLE initialized.
;
; Exit:
;   Tape positioned at the first sector payload.
;
; Effects:
;   Drives port 50H, divider, border, and tape timing interrupt.
; -----------------------------------------------------------------------------
CAS_WRITE_HEADER_PREAMBLE:
    EX (SP),HL
    DEC BC
    LD A,B
    OR C
    JR NZ,F97FH
    CALL FA7CH
    LD A,88H
    LD (0BF0H),A
    LD BC,0014H
    LD A,(0E32H)
    OR A
    JR Z,F999H
    LD BC,0028H

LF999:
    CALL FA31H
    CALL FA62H
    CALL FA62H
    CALL FA3DH
    LD HL,(0B6FH)
    EXX
    LD C,6AH
    CALL FA3DH
    LD IY,(0E2CH)
    LD A,(0E32H)
    LD C,A
    CALL FA3DH
    LD A,(0D14H)
    LD C,A
    CALL FA3DH
    LD A,(0E30H)
    LD C,A
    CALL FA3DH
    LD HL,(0E26H)
    LD C,H
    LD A,L
    OR A
    JR Z,F9D0H
    INC C

; Each sector's byte count is encoded as 00H for a full 256-byte sector or the remaining count for
; the final sector.
; Writer emits 00H as the sector byte count for a full 256-byte sector; nonzero count is the final
; partial sector length. End marker follows payload, then CRC low/high.

; -----------------------------------------------------------------------------
; EMIT CASSETTE SECTORS
; -----------------------------------------------------------------------------
;
; Writes count, payload, end marker, and CRC for each sector.
;
; The sector byte-count field is zero for a full 256-byte payload; a nonzero remaining count
; denotes the final partial sector. Each payload byte updates the CRC through CAS_WRITE_BYTE.
;
; The sector-end marker is 00H until the last sector, then FFH. The CRC low byte precedes the high
; byte, and the source pointer/remaining count/sector number are advanced before another sector is
; emitted.
;
; Entry:
;   IY=source; HL=remaining count; E31H=sector number; CRC in HL'.
;
; Exit:
;   All requested sectors serialized or tape error/STOP.
;
; Effects:
;   Updates E26H/E2CH/E31H and writes payload/timing.
; -----------------------------------------------------------------------------
CAS_WRITE_SECTOR_LOOP:
    CALL FA3DH
    JR F9DAH

LF9D5:
    EXX
    LD HL,(0B6FH)
    EXX

LF9DA:
    LD A,(0E31H)
    LD C,A
    CALL FA3DH
    LD A,H
    OR A
    LD D,L
    JR Z,F9E8H
    XOR A
    LD D,A

LF9E8:
    LD C,D
    CALL FA3DH

LF9EC:
    LD C,(IY+00H)
    INC IY
    DEC HL
    CALL FA3DH
    DEC D
    JR NZ,F9ECH
    LD A,H
    OR L
    LD A,(0E2BH)
    JR Z,FA00H
    XOR A

; Finish tape output with five periods, mark the data block state, and restore the previous
; interrupt configuration.
; The writer emits five trailer periods, clears the data/header phase, and restores the full
; pre-tape interrupt state.

; -----------------------------------------------------------------------------
; TERMINATE PHYSICAL CASSETTE BLOCK
; -----------------------------------------------------------------------------
;
; Writes the five-period trailer, marks data phase complete, and restores interrupts.
;
; After the final CRC the writer emits five trailer periods, clears the write-phase byte at 0E32H,
; and enters CAS_RESTORE_INTERRUPTS.
;
; The restore call is shared by success and abort paths, so the caller sees a valid carry/status
; result only after motors, vector byte, page selection, cursor, and interrupt enables are
; restored.
;
; Effects:
;   Writes tape trailer and restores global system state.
; -----------------------------------------------------------------------------
CAS_WRITE_TRAILER:
    LD C,A
    CALL FA3DH
    EX DE,HL
    EXX
    LD C,L
    CALL FA3DH
    LD C,H
    CALL FA3DH
    EXX
    EX DE,HL
    LD (0E26H),HL
    LD (0E2CH),IY
    LD A,(0E31H)
    INC A
    LD (0E31H),A
    LD A,H
    OR L
    JR NZ,F9D5H
    LD BC,0501H
    CALL FA31H
    EI
    HALT
    XOR A
    LD (0E32H),A
    JP FABDH

; Emit B*C waveform transitions for pilot, sync, and trailer timing.

; -----------------------------------------------------------------------------
; WRITE PERIOD COUNT
; -----------------------------------------------------------------------------
;
; Outputs B*C cassette half-period transitions.
;
; The nested counters emit one polarity transition B times and repeat that group C times. The
; helper is used for pilot, synchronization, and trailer waveform generation.
;
; Entry:
;   B and C define the product number of transitions.
; -----------------------------------------------------------------------------
CAS_WRITE_PERIODS:
    CALL FA5DH
    CALL FA5DH
    DJNZ FA31H
    DEC C
    JR NZ,FA31H
    RET

; Serialize one byte as eight timed bit pairs and update the running CRC.

; -----------------------------------------------------------------------------
; WRITE ONE CASSETTE BYTE
; -----------------------------------------------------------------------------
;
; Serializes eight bits as timed pairs of tape transitions and updates CRC.
;
; Each bit of C selects the one- or zero-bit PITCH timing, a transition is emitted, the CRC is
; updated, the complementary transition is emitted, and the process repeats eight times.
;
; Entry:
;   C=byte to write.
;
; Effects:
;   Drives the cassette output waveform and updates the running CRC.
; -----------------------------------------------------------------------------
CAS_WRITE_BYTE:
    LD B,08H

; Bytes are written LSB first: RRC C selects the bit, one/zero timing is emitted, CRC is updated,
; and the complementary transition is emitted.

; -----------------------------------------------------------------------------
; SERIALIZE ONE TAPE BYTE
; -----------------------------------------------------------------------------
;
; Emits eight least-significant-bit-first bit pairs and updates CRC.
;
; RRC C exposes the next bit in bit 7. CAS_SET_BIT_TIMING chooses DEH for one or CEH for zero,
; CAS_CRC_UPDATE consumes the bit, and a complementary transition is emitted before the next bit.
;
; The exact two-transition-per-bit pattern is the physical format; changing only the divider value
; without preserving the complementary transition breaks decoding.
;
; Entry:
;   C=byte to write.
;
; Exit:
;   Eight timed bit pairs emitted; CRC alternate HL' advanced.
;
; Effects:
;   Drives port 50H and the shared divider.
; -----------------------------------------------------------------------------
CAS_WRITE_BYTE_BITS:
    RRC C
    CALL FA4FH
    BIT 7,C
    CALL FAF7H
    CALL FA4FH
    DJNZ FA3FH
    RET

; PITCH=00DEH represents a one bit; PITCH=00CEH represents a zero bit.
; Tape timing constants are D6H pilot, DEH one, CEH zero, and BCH sync. They are divider low
; bytes, not Z80 cycle counts.

; -----------------------------------------------------------------------------
; SELECT CASSETTE BIT TIMING
; -----------------------------------------------------------------------------
;
; Chooses the 0-bit or 1-bit PITCH divisor and emits one half-bit.
;
; The byte's bit value selects PITCH=00CEH for zero or 00DEH for one. The helper then transfers
; the selected period to the tone divider and creates one output transition.
; -----------------------------------------------------------------------------
CAS_SET_BIT_TIMING:
; -----------------------------------------------------------------------------
; SELECT ONE/ZERO PULSE PERIOD
; -----------------------------------------------------------------------------
;
; Maps the current bit to DEH or CEH timing and emits one transition.
;
; The bit is examined in C bit 7. A one selects the timing byte DEH at FAF4H; a zero selects CEH
; at FAF5H. The selected divider value is consumed by CAS_SET_TIMING.
;
; Pilot and synchronization callers use the same primitive with D6H at FAF3H and BCH at FAF6H.
;
; Entry:
;   C bit 7 contains the bit value; timing interrupt active.
;
; Exit:
;   One half-bit transition emitted.
;
; Effects:
;   Changes port 04H divider value and toggles cassette output.
; -----------------------------------------------------------------------------
CAS_WRITE_BIT_TIMING:
    BIT 7,C
    JR Z,FA58H
    LD A,(FAF4H)
    JR FA65H

LFA58:
    LD A,(FAF5H)
    JR FA65H

; Timing primitive uses FAF3H-FAF6H constants: D6H pilot, DEH one, CEH zero, BCH synchronization.

; -----------------------------------------------------------------------------
; CASSETTE TIMING OUTPUT PRIMITIVE
; -----------------------------------------------------------------------------
;
; Emits one timed transition while servicing the cassette interrupt path.
;
; This primitive maps pilot, sync, one-bit, and zero-bit timing to the low-byte constants at
; FAF3H-FAF6H, waits for the timing interrupt, toggles the tape output at port 50H, acknowledges
; the divider, and returns the activity count. CTRL+ESC aborts the transfer.
; -----------------------------------------------------------------------------
CAS_SET_TIMING:
    LD A,(FAF3H)
    JR FA65H

LFA62:
    LD A,(FAF6H)

; Each timed transition waits for the timing interrupt, toggles port 50H, writes the divider low
; byte to port 04H, acknowledges the source, and checks stop state.

LFA65:
    EX AF,AF'
    IN A,(58H)
    AND 18H
    JP Z,F8E6H
    EI
    HALT
    OUT (50H),A
    EX AF,AF'
    OUT (04H),A
    IN A,(5BH)
    OUT (07H),A
    CALL F956H
    RET

; Tape timing takes over interrupts: disable cards/cursor/sound, save the old interrupt opcode at
; 0BF2H, and watch only CTRL+ESC.
; Tape takeover sets SER-OK to FFH, disables sound/cards/cursor, selects only the CTRL+ESC
; keyboard row, and replaces the first byte at 0038H with C9H.

; -----------------------------------------------------------------------------
; ENABLE TAPE TIMING INTERRUPT
; -----------------------------------------------------------------------------
;
; Temporarily disables unrelated interrupts and installs the cassette timing service.
;
; The routine disables expansion-card interrupts, silences sound while preserving motor bits,
; marks the serial clock invalid, restricts keyboard observation to CTRL+ESC, disables the cursor,
; resets the divider, acknowledges the previous interrupt source, and replaces the first byte of
; the interrupt routine with RET. The original byte is saved at 0BF2H.
;
; Effects:
;   Changes port mirrors, CRTC cursor state, interrupt vector, and INT-DES.
; -----------------------------------------------------------------------------
CAS_ENABLE_TAPE_INTERRUPT:
    DI
    XOR A
    OUT (58H),A
    OUT (59H),A
    OUT (5AH),A
    OUT (5BH),A
    OUT (04H),A
    DEC A
    LD (0B71H),A
    LD A,(0B11H)
    AND F0H
    OR 07H
    OUT (03H),A
    LD A,(0B12H)
    AND EFH
    LD (0B12H),A
    AND C0H
    OR 2FH
    OUT (05H),A
    XOR A
    LD (0B14H),A
    LD A,0AH
    OUT (70H),A
    LD A,23H
    OUT (71H),A
    IN A,(5BH)
    OUT (07H),A
    LD HL,0038H
    LD A,(HL)
    LD (HL),C9H
    LD (0BF2H),A
    RET

; Restore motors, page selection, interrupt enables, cursor service, and the saved interrupt
; opcode.

; -----------------------------------------------------------------------------
; RESTORE SYSTEM INTERRUPTS AFTER TAPE I/O
; -----------------------------------------------------------------------------
;
; Stops cassette motors and restores the saved interrupt configuration.
;
; The routine restores port-03 and port-05 mirrors, re-enables each previously active card
; interrupt, restores the cursor service, reinstates the saved first byte of the interrupt routine
; from 0BF2H, and returns carry to the physical transfer caller.
;
; Effects:
;   Restores the pre-tape interrupt, motor, cursor, and page state.
; -----------------------------------------------------------------------------
CAS_RESTORE_INTERRUPTS:
    DI
    CALL F6FFH
    LD A,(0B11H)
    OUT (03H),A
    LD A,(0B12H)
    OUT (05H),A
    LD A,(0B1FH)
    LD B,A
    BIT 0,B
    JR Z,FADBH
    LD A,0AH
    OUT (70H),A
    LD A,03H
    OUT (71H),A

; Restore writes saved port mirrors, re-enables only IRQ-STAT sources that were active, restores
; CRTC cursor state, and puts the saved 0038H opcode back before EI.

; -----------------------------------------------------------------------------
; RESTORE SAVED INTERRUPT SOURCES
; -----------------------------------------------------------------------------
;
; Reinstates cursor, card, keyboard, and vector state after tape timing.
;
; The path first stops motors and writes the saved port-03/port-05 mirrors. It uses IRQ-STAT to
; re-enable only the sources that were previously active, restoring the CRTC cursor when bit 0 was
; set.
;
; The original first byte at 0038H is restored from 0BF2H, carry is set for a completed restore,
; and EI returns to the normal interrupt chain.
;
; Entry:
;   Saved port mirrors, IRQ-STAT, and original vector byte.
;
; Exit:
;   Normal interrupt configuration restored; carry set.
;
; Effects:
;   Writes ports 03H/05H/58H-5BH, CRTC register 0AH, and address 0038H.
; -----------------------------------------------------------------------------
CAS_RESTORE_IRQ_SOURCES:
    LD A,B
    RLCA
    RLCA
    OUT (5BH),A
    RLCA
    OUT (5AH),A
    RLCA
    OUT (59H),A
    RLCA
    OUT (58H),A
    LD A,(0BF2H)
    LD (0038H),A
    XOR A
    SCF
    EI
    RET

; Cassette work bytes used by cassette routines.

; -----------------------------------------------------------------------------
; CASSETTE TIMING CONSTANTS
; -----------------------------------------------------------------------------
;
; Divider low bytes for pilot, one, zero, and synchronization periods.
;
; The four bytes are D6H (pilot), DEH (one), CEH (zero), and BCH (sync). CAS_READ uses the
; measured periods derived from these values; CAS_WRITE uses them directly.
;
; These are low-byte constants for the shared divider, not CPU cycle counts. The high divider
; nibble is supplied by the port-05 setup.
;
; Effects:
;   Read-only EXTH data used by tape timing primitives.
; -----------------------------------------------------------------------------
CAS_TIMING_CONSTANTS:
    SUB DEH
    ADC A,BCH

; CRC feedback toggles H bit 3 and L bit 4 when the incoming bit and CRC high bit require it.
; CRC feedback uses alternate HL: combine the incoming bit with H bit 7, toggle H bit 3/L bit 4
; when feedback is set, then shift the pair with ADC HL,HL.

; -----------------------------------------------------------------------------
; CASSETTE CRC UPDATE
; -----------------------------------------------------------------------------
;
; Updates the two-byte cassette CRC for one decoded or emitted bit.
;
; The input carry/zero state identifies the bit and HL' contains the current CRC. The routine
; shifts the CRC and, when the feedback bit is set, toggles H bit 3 and L bit 4. MUDDLE at 0B6FH
; supplies the initial per-file/sector seed, allowing intentional nonzero seeds as a simple
; protection value.
;
; Entry:
;   Z=bit value; HL'=current CRC.
;
; Exit:
;   HL' contains the updated CRC.
; -----------------------------------------------------------------------------
CAS_CRC_UPDATE:
    EXX
    LD A,80H
    JR NZ,FAFDH
    XOR A

; -----------------------------------------------------------------------------
; CRC FEEDBACK STEP
; -----------------------------------------------------------------------------
;
; Updates the two-byte tape CRC using the incoming bit and the high CRC bit.
;
; The bit state is combined with H bit 7. When feedback is asserted, H bit 3 and L bit 4 are
; toggled before ADC HL,HL shifts the checksum pair.
;
; The routine runs under EXX so the CRC pair can remain in HL' while the caller uses the main
; register set for payload pointers.
;
; Entry:
;   Z identifies the bit value; HL' contains the current CRC.
;
; Exit:
;   HL' contains the next CRC value.
;
; Effects:
;   Changes alternate HL and flags.
; -----------------------------------------------------------------------------
CAS_CRC_FEEDBACK_STEP:
    XOR H
    RLA
    JR NC,FB0AH
    LD A,H
    XOR 08H
    LD H,A
    LD A,L
    XOR 10H
    LD L,A
    SCF

LFB0A:
    ADC HL,HL
    EXX
    RET

; Initialization bytes copied to RAM addresses 0B00H-0B48H; includes the I/O assignment table.
; U0 template copied by EXT_INIT: I/O assignments, interrupt descriptors, card bridges, and reset
; vectors.
; The U0 default assignment bytes are copied at reset and later reused by card error recovery;
; runtime selector edits must not mutate the EXTH source template.

; -----------------------------------------------------------------------------
; U0 INITIALIZATION TEMPLATE
; -----------------------------------------------------------------------------
;
; Bytes copied into U0 RAM at 0B00H-0B48H during EXT_INIT.
;
; This template supplies the default input/output assignment tables, interrupt descriptors,
; expansion-call stubs, and system vectors copied into U0. It includes the RAM-resident jump
; bridges that save and restore the active page around SYS/extension calls.
; -----------------------------------------------------------------------------
U0_INIT_TEMPLATE:
; -----------------------------------------------------------------------------
; U0 ASSIGNMENT TEMPLATE BYTES
; -----------------------------------------------------------------------------
;
; ROM bytes copied into the U0 input/output selector tables during reset.
;
; The first 10H bytes at FB0EH are the input and output class defaults. The input half maps video,
; keyboard, editor, sound, printer, cassette, cards, and kernel; the output half carries the
; corresponding built-in output selectors.
;
; EXT_INIT copies the bytes rather than referencing them in ROM, because the SYS dispatcher must
; be able to update assignments at runtime.
;
; Effects:
;   Read-only source for U0 0B00H-0B0FH.
; -----------------------------------------------------------------------------
U0_DEFAULT_ASSIGNMENT_BYTES:
    RST 38H
    LD BC,FF02H
    RST 38H
    DEC B
    LD B,FFH
    NOP
    RST 38H
    LD (BC),A
    RST 38H
    INC B
    DEC B
    LD B,FFH
    JP 0B23H
    NOP
    NOP
    NOP
    NOP
    NOP
    PUSH AF
    LD A,70H
    OUT (02H),A
    JP C412H
    EX (SP),HL
    LD A,(HL)

; The bridge template contains executable RST/interrupt bytes. Its RAM copy is checked at reset,
; so a user overwrite changes warm-reset eligibility.

; -----------------------------------------------------------------------------
; U0 RST30 AND INTERRUPT TEMPLATE
; -----------------------------------------------------------------------------
;
; Source bytes for the fixed RAM RST entry points and interrupt entry.
;
; The template is copied to U0 0030H-003FH and contains the RST30 inline-byte bridge and the
; interrupt entry transfer. It is integrity-checked at reset against the copy at U0 0B23H onward.
;
; The bytes are executable only after the U0 page is visible; they are not ordinary SYS ROM
; routines and must not be called while another page occupies page 0.
;
; Effects:
;   Read-only EXTH source copied into U0 RAM.
; -----------------------------------------------------------------------------
U0_RST_AND_IRQ_TEMPLATE:
    INC HL
    EX (SP),HL
    EX AF,AF'
    PUSH AF
    LD A,(0003H)
    PUSH AF
    LD A,70H
    LD (0003H),A
    OUT (02H),A
    JP C363H
    EX AF,AF'
    POP AF
    LD (0003H),A
    OUT (02H),A
    POP AF
    EX AF,AF'
    RET
    LD (0003H),A
    OUT (02H),A
    POP AF
    EI
    RET

; "MOPS" cartridge signature text.
; Card identification strings: MOPS signature, VGB, RS232, DISK, and CISL.
; MOPS/VGB/RS232/DISK/CISL strings are discovery data. The MOPS signature is the gate before an
; unknown card can provide executable vectors.

; -----------------------------------------------------------------------------
; EXPANSION DEVICE IDENTIFIERS
; -----------------------------------------------------------------------------
;
; MOPS signature and device-name strings used while identifying expansion cards.
;
; A compatible card begins with the ASCII signature MOPS followed by its device name. The table
; also contains the built-in VGB/game-cartridge identifier, RS232 serial identifier, DISK
; identifier, and CISL text used by startup and card dispatch.
; -----------------------------------------------------------------------------
EXPANSION_DEVICE_STRINGS:
; -----------------------------------------------------------------------------
; EXPANSION IDENTIFIER STRINGS
; -----------------------------------------------------------------------------
;
; MOPS signature and built-in VGB, RS232, DISK, and CISL identifiers.
;
; Startup compares fixed four-byte MOPS and built-in names before accepting a connector. The
; strings are length-prefixed where they are copied to U0 descriptors.
;
; The adjacent text/format data is also used by card status and identification paths; treat the
; full table as data rather than attempting to execute through it.
;
; Effects:
;   Read-only EXTH data used during card discovery and display.
; -----------------------------------------------------------------------------
EXPANSION_ID_STRING_TABLE:
    LD C,L
    LD C,A
    LD D,B
    LD D,E

; "VGB" device identifier.
    INC BC
    LD D,(HL)
    LD B,A
    LD B,D

; "RS232" device identifier.
    DEC B
    LD D,D
    LD D,E
    LD (3233H),A

; "DISK" device identifier.
    INC B
    LD B,H
    LD C,C
    LD D,E
    LD C,E

; "CISL" text.
    LD B,E
    LD C,C
    LD D,E
    LD C,H
    EX AF,AF'
    EX AF,AF'
    LD A,6BH
    LD H,E
    LD A,A
    LD H,E
    LD H,E
    NOP
    NOP
    EX AF,AF'
    EX AF,AF'
    LD A,(HL)
    LD L,B
    LD H,B
    LD A,H
    LD H,B
    LD A,(HL)
    NOP
    NOP
    EX AF,AF'
    EX AF,AF'
    INC A
    JR FB9CH
    JR FB9EH
    INC A
    NOP
    NOP
    EX AF,AF'
    EX AF,AF'
    LD A,6BH
    LD H,E
    LD H,E
    LD H,E
    LD A,00H
    NOP
    INC D
    NOP
    LD A,63H
    LD H,E
    LD H,E
    LD H,E
    LD A,00H

LFB9C:
    NOP
    INC D

LFB9E:
    INC D
    LD A,63H
    LD H,E
    LD H,E
    LD H,E
    LD A,00H
    NOP
    EX AF,AF'
    EX AF,AF'
    LD L,E
    LD H,E
    LD H,E
    LD H,E
    LD H,E
    LD A,00H
    NOP
    INC D
    NOP
    LD H,E
    LD H,E
    LD H,E
    LD H,E
    LD H,E
    LD A,00H
    NOP
    INC D
    INC D
    LD (HL),A
    LD H,E
    LD H,E
    LD H,E
    LD H,E
    LD A,00H
    NOP
    NOP
    NOP
    NOP
    NOP
    RRA
    RRA
    JR FBE5H
    JR FBE7H
    JR FBE9H
    JR FBEBH
    RRA
    RRA
    NOP
    NOP
    NOP
    NOP
    JR FBF3H
    JR FBF5H
    JR FBF7H
    JR FBF9H
    JR FBFBH
    JR FBFDH

LFBE5:
    JR FBFFH

LFBE7:
    RRA
    RRA

LFBE9:
    JR FC03H

LFBEB:
    JR FC05H
    NOP
    NOP
    NOP
    NOP
    RST 38H
    RST 38H

LFBF3:
    JR FC0DH

LFBF5:
    JR FC0FH

LFBF7:
    JR FC11H

LFBF9:
    JR FC13H

LFBFB:
    RST 38H
    RST 38H

LFBFD:
    JR FC17H

LFBFF:
    JR FC19H
    RST 38H
    RST 20H

LFC03:
    DB C3H, 99H                                                                     ; |..|

LFC05:
    SBC A,C
    ADD A,C
    SBC A,C
    SBC A,C
    RST 38H
    RST 38H
    EX AF,AF'
    EX AF,AF'

LFC0D:
    EX AF,AF'
    INC A

LFC0F:
    LD B,3EH

LFC11:
    LD H,(HL)
    DB 3EH                                                                          ; |>|

LFC13:
    NOP
    NOP
    EX AF,AF'
    EX AF,AF'

LFC17:
    EX AF,AF'
    INC A

LFC19:
    LD H,(HL)
    LD A,(HL)
    LD H,B
    INC A
    NOP
    NOP
    EX AF,AF'
    EX AF,AF'
    NOP
    JR C,FC3CH
    JR FC3EH
    INC A
    NOP
    NOP
    EX AF,AF'
    EX AF,AF'
    EX AF,AF'
    INC A
    LD H,(HL)
    LD H,(HL)
    LD H,(HL)
    INC A
    NOP
    NOP
    NOP
    INC H
    NOP
    INC A
    LD H,(HL)
    LD H,(HL)
    LD H,(HL)
    INC A
    NOP

LFC3C:
    NOP
    INC H

LFC3E:
    INC H
    NOP
    INC A
    LD H,(HL)
    LD H,(HL)
    LD H,(HL)
    INC A
    NOP
    NOP
    EX AF,AF'
    EX AF,AF'
    EX AF,AF'
    LD H,(HL)
    LD H,(HL)
    LD H,(HL)
    LD H,(HL)
    LD A,00H
    NOP
    NOP
    INC H
    NOP
    LD H,(HL)
    LD H,(HL)
    LD H,(HL)
    LD H,(HL)
    LD A,00H
    NOP
    INC H
    INC H
    NOP
    LD H,(HL)
    LD H,(HL)
    LD H,(HL)
    LD H,(HL)
    LD A,00H
    NOP
    NOP
    NOP
    NOP
    NOP
    RET M
    RET M
    JR FC85H
    JR FC87H
    JR FC89H
    JR FC8BH
    RET M
    RET M
    NOP
    NOP
    NOP
    NOP
    NOP
    NOP
    NOP
    NOP
    RST 38H
    RST 38H
    NOP
    NOP
    NOP
    NOP
    JR FC9DH

LFC85:
    JR FC9FH

LFC87:
    RET M
    RET M

LFC89:
    JR FCA3H

LFC8B:
    JR FCA5H
    JR FCA7H
    JR FCA9H
    RST 38H
    RST 38H
    NOP
    NOP
    NOP
    NOP
    RST 38H
    JP 9F99H
    SBC A,A
    SBC A,A

LFC9D:
    SBC A,C
    DB C3H                                                                          ; |.|

LFC9F:
    RST 38H
    RST 38H
    RST 38H
    DB C3H                                                                          ; |.|

LFCA3:
    SBC A,C
    SBC A,A

LFCA5:
    DB C3H, F9H                                                                     ; |..|

LFCA7:
    SBC A,C
    DB C3H                                                                          ; |.|

LFCA9:
    RST 38H
    RST 38H
    NOP
    NOP
    NOP
    NOP
    NOP
    NOP
    NOP
    NOP
    NOP
    NOP
    EXX
    PUSH BC
    PUSH DE
    PUSH HL
    LD HL,(172EH)
    PUSH HL
    EX (SP),IY
    XOR A
    LD B,A
    LD C,A
    EXX
    LD H,A
    LD L,A
    LD D,A
    LD E,A
    LD B,A
    LD C,A

LFCC9:
    LD A,(IY+00H)
    INC IY
    PUSH HL
    PUSH BC
    LD HL,FF3FH
    LD BC,000BH
    CPIR
    JR NZ,FD45H
    SLA C
    LD HL,FF4AH
    ADD HL,BC
    LD A,(HL)
    INC HL
    LD H,(HL)
    LD L,A
    POP BC
    EX (SP),HL
    LD A,L
    OR A
    RET

LFCE9:
    LD A,40H
    JP C,803EH
    JR NZ,FD47H
    PUSH AF
    OR C
    LD C,A
    POP AF
    XOR 03H
    AND C
    LD C,A
    JR FCC9H
    JR NZ,FD47H
    SET 1,C
    JR FCC9H
    JR NZ,FD47H
    INC L
    JR FCC9H
    INC L
    INC H
    EXX
    LD A,B
    OR C
    EXX
    JR NZ,FCC9H
    DEC H
    LD A,(IY-01H)
    CP 2AH
    LD E,A
    JR Z,FCC9H
    LD E,30H
    JR FCC9H

LFD1A:
    LD A,04H
    LD HL,FD5CH
    JP FFF0H

LFD22:
    INC L
    EXX
    LD A,B
    OR C
    EXX
    JR Z,FCC9H
    INC H
    JR FCC9H
    EXX
    LD A,B
    OR C
    JR NZ,FD35H
    PUSH IY
    POP BC
    DEC BC

LFD35:
    EXX
    INC D
    JR FCC9H
    EXX
    LD A,B
    OR C
    JR NZ,FD1AH
    PUSH IY
    POP BC
    DEC BC
    EXX
    JR FCC9H

LFD45:
    POP BC
    POP HL

LFD47:
    EXX
    LD A,B
    OR C
    JR NZ,FD50H
    PUSH IY
    POP BC
    DEC BC

LFD50:
    POP IY
    EXX
    LD (171CH),HL
    LD A,D
    CP 04H
    JR NC,FD68H
    OR A
    JP NZ,FD1AH
    LD A,(IY+08H)
    AND 7FH
    SUB 3FH
    ADD A,H
    LD L,A

LFD68:
    PUSH BC
    LD A,(IY+06H)
    OR A
    JR Z,FD80H
    LD A,(IY+08H)
    AND 80H
    JR Z,FD80H
    XOR (IY+08H)
    LD (IY+08H),A
    POP BC
    SET 0,C
    DB 3EH                                                                          ; |>|

LFD80:
    POP BC
    LD A,(IY+08H)
    SUB 3FH
    LD B,A
    EXX
    LD E,C
    LD D,B
    EXX
    XOR A
    LD H,A
    LD L,A
    OR D
    JR NZ,FD96H
    OR B
    JP M,FD96H
    LD L,B

LFD96:
    EXX
    DEC DE
    OR A
    SBC HL,DE
    ADD HL,DE
    LD A,(DE)
    EXX
    JR Z,FDA2H
    JR NC,FDBBH

LFDA2:
    CP 2CH
    JR Z,FDA7H
    SCF

LFDA7:
    INC D
    DEC D
    JR NZ,FDB6H
    INC L
    DEC L
    JP M,FDB8H
    JR Z,FDB8H
    JR NC,FD96H
    DEC L
    OR A

LFDB6:
    JR NC,FD96H

LFDB8:
    INC H
    JR FD96H

LFDBB:
    BIT 1,C
    JR Z,FDC0H
    DEC H

LFDC0:
    BIT 0,C
    JR NZ,FDC9H
    LD A,C
    AND FCH
    JR Z,FDCAH

LFDC9:
    DEC H

LFDCA:
    BIT 7,H
    JP NZ,FD1AH
    LD A,L
    DEC A
    JP P,FD1AH
    INC D
    DEC D
    JR NZ,FDECH
    XOR A
    BIT 7,B
    JR NZ,FDDEH
    LD A,B

LFDDE:
    LD L,A
    OR A
    JR NZ,FDF0H
    INC H
    DEC H
    JR Z,FDF0H
    SET 2,C
    LD L,01H
    JR FDF0H

LFDEC:
    LD L,H
    LD A,B
    SUB H
    LD B,A

LFDF0:
    INC D
    DEC D
    JR NZ,FDFAH
    INC E
    DEC E
    JR NZ,FDFAH
    LD E,20H

LFDFA:
    CALL NZ,FF62H
    INC H

LFDFE:
    DEC H
    JR Z,FE14H
    INC D
    DEC D
    JR NZ,FE14H
    BIT 2,C
    JR Z,FE0EH
    LD A,H
    DEC A
    CALL Z,FF60H

LFE0E:
    LD A,E
    CALL FF8DH
    JR FDFEH

LFE14:
    LD A,E
    CP 20H
    CALL Z,FF62H
    EXX
    LD E,C
    LD D,B
    EXX
    INC B
    DEC B
    JR Z,FE25H
    JP P,FE29H

LFE25:
    LD A,L
    DEC A
    JR Z,FE3FH

LFE29:
    INC L

LFE2A:
    DEC L
    JR Z,FE3FH
    EXX

LFE2E:
    DEC DE
    LD A,(DE)
    CP 2CH
    JR Z,FE2EH
    EXX
    JR FE2AH

LFE37:
    CALL FF96H
    LD B,04H
    LD C,B
    JR FE72H

LFE3F:
    PUSH DE
    LD C,B
    PUSH BC
    LD E,B
    DEC E
    LD A,(IY+08H)
    SUB 3BH
    LD C,A
    SUB 04H
    LD HL,(171CH)
    DEC H
    ADD A,H
    JP M,FE37H
    CP H
    JR NC,FE5AH
    LD A,H
    LD C,04H

LFE5A:
    ADD A,04H
    LD B,A
    LD L,B

LFE5E:
    DEC B
    LD A,B
    CP 10H
    LD A,00H
    CALL C,FF87H
    OR A
    JR NZ,FE72H
    LD A,B
    DEC A
    CP C
    JR NC,FE5EH
    LD L,00H
    DB D2H                                                                          ; |.|

LFE72:
    LD C,B
    INC C
    LD B,04H

LFE76:
    EXX
    EX DE,HL
    OR A
    SBC HL,BC
    ADD HL,BC
    EX DE,HL
    JR Z,FE96H
    LD A,(DE)
    INC DE
    EXX
    CP 2CH
    JR Z,FE91H
    LD A,B
    CP 10H
    LD A,00H
    CALL C,FF87H
    ADD A,30H
    INC B

LFE91:
    CALL FF8DH
    JR FE76H

LFE96:
    LD A,(BC)
    CP 2EH
    JR NZ,FEE0H

LFE9B:
    CALL FF8DH
    INC BC
    LD A,(BC)
    CP 2CH
    JR Z,FE9BH
    EXX
    LD A,D
    OR A
    JR NZ,FEB5H
    LD A,(171DH)
    CPL
    CP E
    JR NC,FEB5H
    XOR A
    INC E
    JP M,FEDBH

LFEB5:
    EXX
    LD A,(BC)
    CP 2AH
    JR Z,FEC6H
    CP 25H
    JR Z,FEC6H
    CP 23H
    JR NZ,FEE0H
    EXX
    JR FED2H

LFEC6:
    EXX
    LD A,B
    SUB C
    JR C,FED2H
    OR L
    JR Z,FEDAH
    LD A,F0H
    JR FEDAH

LFED2:
    LD A,B
    CP 10H
    LD A,00H
    CALL C,FF87H

LFEDA:
    INC B

LFEDB:
    EXX
    ADD A,30H
    JR FE9BH

LFEE0:
    LD A,(BC)
    CP 5EH
    EXX
    POP BC
    POP DE
    LD B,C
    JR NZ,FF30H
    LD A,(IY+06H)
    OR A
    JR NZ,FEF0H
    LD B,A

LFEF0:
    LD A,45H
    CALL FF8DH
    BIT 7,B
    LD A,2BH
    JR Z,FF01H
    LD A,B
    NEG
    LD B,A
    LD A,2DH

LFF01:
    CALL FF8DH

LFF04:
    DEC D
    LD A,D
    CP 04H
    JR C,FF14H
    LD A,30H
    CALL FF8DH
    EXX
    INC BC
    EXX
    JR FF04H

LFF14:
    LD A,B
    LD BC,0AFFH

LFF18:
    SUB B
    INC C
    JR NC,FF18H
    ADD A,B
    LD B,A
    LD A,C
    ADD A,30H
    CALL FF8DH
    LD A,B
    ADD A,30H
    CALL FF8DH
    EXX
    INC BC
    INC BC
    INC BC
    INC BC
    EXX

LFF30:
    EXX
    LD (172EH),BC
    POP HL
    POP DE
    POP BC
    EXX
    LD HL,E67AH
    JP FFF0H
    DEC HL
    DEC L
    INC H
    INC A
    LD A,2AH
    DEC H
    INC HL
    INC L
    LD E,(HL)
    LD L,39H
    DB FDH, 2CH                                                                     ; |.,|
    DB FDH, C9H                                                                     ; |..|
    CALL M,FD22H
    DEC B
    DB FDH, 05H                                                                     ; |..|
    DB FDH, 00H                                                                     ; |..|
    DB FDH, 00H                                                                     ; |..|
    DB FDH, FAH, FCH, ECH                                                           ; |....|
    CALL M,FCE9H

LFF60:
    LD E,30H

LFF62:
    BIT 1,C
    LD A,24H
    CALL NZ,FF8DH
    BIT 0,C
    LD A,2DH
    JR NZ,FF8DH
    LD A,C
    AND F8H
    ADD A,A
    LD A,20H
    JR C,FF8DH
    RET P
    LD A,2BH
    JR FF8DH

LFF7C:
    DEC A
    RET M
    PUSH AF
    LD A,20H
    CALL FF8DH
    POP AF
    JR FF7CH

LFF87:
    PUSH HL
    LD HL,F7CEH
    JR FF91H

LFF8D:
    PUSH HL
    LD HL,FEB3H

LFF91:
    CALL FFF0H
    POP HL
    RET

LFF96:
    LD HL,FA14H
    JP FFF0H
    LD HL,(172EH)
    LD A,(HL)
    LD DE,0000H
    CP 3CH
    JR Z,FFADH
    INC E
    CP 3EH
    JR NZ,FFB2H
    INC E

LFFAD:
    INC D
    INC HL
    LD (172EH),HL

LFFB2:
    LD A,(HL)
    CP 23H
    JR Z,FFADH
    CP 25H
    JR Z,FFADH
    CP 2AH
    JR Z,FFADH
    LD A,(IY+01H)
    SUB D
    NEG
    JP M,FD1AH
    DEC E
    JP M,FFD2H
    LD C,A
    JR NZ,FFD1H
    SRL C

LFFD1:
    SUB C

LFFD2:
    PUSH AF
    LD A,C
    CALL P,FF7CH
    POP AF
    LD HL,E64FH
    JP FFF0H

; "(c)1985ISL" text.
    JR Z,0023H
    ADD HL,HL
    LD SP,3839H
    DEC (HL)
    LD C,C
    LD D,E
    LD C,H

LFFE8:
    LD A,04H
    JP F29CH
    NOP
    NOP
    NOP

; FFF0H selects U0-U1-VID-EXT page 3 while preserving AF; FFF9H performs JP (HL).
; FFF0H is not a normal leaf routine: it changes page 02H and falls into FFF9H JP (HL). Return
; through the RAM bridge or the caller's page will remain EXTH.

; -----------------------------------------------------------------------------
; PAGE-AND-CALL GATEWAY
; -----------------------------------------------------------------------------
;
; Selects SYS/EXTH page 3 and enters the target routine in HL.
;
; FFF0H saves the caller's accumulator, selects the U0-U1-VID-EXT mapping in the page register,
; restores AF, and falls through to FFF9H. FFF9H performs the indirect JP (HL). This tiny gateway
; lets RAM-resident stubs call extension or card code while preserving the original page selection
; for the return bridge.
;
; Entry:
;   HL=target routine; AF and the current page state belong to the caller.
;
; Exit:
;   Control enters the selected target and eventually returns through the RAM stub.
;
; Effects:
;   Changes the page register and uses the CPU stack for the saved accumulator.
; -----------------------------------------------------------------------------
EXT_GATEWAY:
; -----------------------------------------------------------------------------
; EXTH PAGE-AND-CALL GATEWAY
; -----------------------------------------------------------------------------
;
; Maps U0-U1-VID-EXT page 3 and jumps through HL while preserving AF.
;
; FFF0H pushes AF, writes 70H to the mapper and U0 0003H, pops AF, and falls through to FFF9H's JP
; (HL). It is the common entry for card initialization, card IRQs, and cassette return stubs.
;
; The target must return through a RAM bridge that restores the caller's page. A direct RET from
; arbitrary card code is safe only when the card obeys that bridge contract.
;
; Entry:
;   HL=target; AF and current page belong to caller.
;
; Exit:
;   Control transfers to target under U0-U1-VID-EXT mapping.
;
; Effects:
;   Changes page register and uses the stack for AF.
;
; Destroys:
;   Page state until the paired RAM return bridge executes.
; -----------------------------------------------------------------------------
EXT_PAGE_CALL_GATEWAY:
    PUSH AF
    LD A,70H
    LD (0003H),A
    OUT (02H),A
    POP AF

; Indirect gateway target. Card and extension callers return through RAM bridges that restore the
; saved page.

LFFF9:
    JP (HL)
    LD A,E
    AND 1FH
    DEC DE
    DB FEH                                                                          ; |.|

LFFFF:
    INC B
