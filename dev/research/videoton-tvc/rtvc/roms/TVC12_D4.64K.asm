; -----------------------------------------------------------------------------
; TVC BASIC 1.2 SYS lower ROM - TVC12_D4.64K
; Source: roms/TVC12_D4.64K
; ORG: C000H
; Size: 8192 bytes
; Instructions use CPU-visible addresses at ORG; the ROM bank is recorded separately.
; Physical bank: SYS offset 0000H
; CPU-visible aliases: C000H, 0000H
; Data ranges: C003H-C228H, C334H-C337H, C4ACH-C4B6H, C545H-C572H, C5B4H-C973H, C974H-C98EH, C9EAH-C9F1H, CB7FH-CBDCH, CF98H-D012H, D170H-D190H, D7BFH-D905H, D92AH-D9C7H, DA84H-DB05H, DBF6H-DC20H
; Auto labels: branch and call targets are emitted as Lxxxx.
; This is a standalone listing; all required technical explanations are embedded here.
; Technical descriptions are based on the Kaszanyiczki and Ludanyi TVC ROM references.
; -----------------------------------------------------------------------------

; =============================================================================
; CPU ADDRESS SPACE AND TVC PAGING
; =============================================================================
; The Z80 sees one 64 KiB address space at 3.125 MHz; every address in an ASM listing is a CPU
; address after the current page mapping has been applied.
; The four 16 KiB CPU pages are 0000H-3FFFH, 4000H-7FFFH, 8000H-BFFFH, and C000H-FFFFH. Port 02
; selects the physical segment visible in each page.
; Physical segments are SYS (system ROM), EXT (extension ROM), VID (video RAM), CART (cartridge
; ROM), and U0-U3 (four RAM pages). A physical segment is not a CPU address: the same CPU range
; can expose SYS or EXT.
; U0, U1, U2, and U3 may occupy only CPU pages 0, 1, 2, and 3 respectively. VID is page 2 only;
; EXT is page 3 only. SYS and CART can be mapped in page 0 or page 3.
; The normal 64K arrangement exposes SYS at C000H-FFFFH, U0 at 0000H-3FFFH, U1 at 4000H-7FFFH, U2
; at 8000H-BFFFH, and U3 at C000H-FFFFH when the corresponding page is selected.
; The lower half of the EXT page can instead expose expansion-card I/O memory. Port 03 bits 7-6
; select which card IOMEM is visible there; preserve the keyboard-row bits in the same register.
; A ROM routine that calls or returns through a RAM bridge must treat the page register as part of
; its calling convention. Do not infer a SYS/EXT identity from a CPU address alone.
; The U0 page is the fixed RAM workspace: RST bridges, I/O assignment table, system variables,
; editor buffers, and the Z80 stack live there before BASIC's high-memory allocations.
; Physical offsets in standalone annotations identify the ROM bank and offset. The CPU address is
; a view established by paging and is deliberately not the identity of a SYS or EXT annotation.

; =============================================================================
; TVC HARDWARE PORT CONTRACTS
; =============================================================================
; Port 00 is the border latch. Port 01 is the Centronics printer data register. Port 02 is the
; four-page memory mapper.
; Port 03 combines expansion-card selection in bits 7-6 with keyboard matrix row selection in bits
; 3-0. Port 04 is the low byte of the 12-bit sound/serial divider; port 05 contains its high
; nibble and enable bits.
; Port 05: bits 3-0 are PITCH high nibble, bit 4 enables sound, bit 5 enables sound IRQ, bit 6
; controls the left cassette motor, and bit 7 controls the right cassette motor.
; Port 06: bits 6-2 select sound volume, bit 7 produces the printer STROBE pulse, and bits 1-0
; select the colour mode (00=2 colour, 01=4 colour, 10 or 11=16 colour).
; Ports 10/11, 20/21, 30/31, and 40/41 are the four serial-card USART data and command/status
; pairs. The slot's card IOMEM must be selected before accessing its pair.
; Port 50 drives the cassette write signal by toggling its output. Port 58 reads the selected
; keyboard row. Port 59 reads keyboard/cassette/printer status: bit 5 is cassette input, bit 6 is
; the colour switch, and bit 7 is printer ACK.
; Ports 5A and 5B provide the joystick/light-pen or analogue input interface used by the system
; I/O routines; their exact interpretation depends on the selected input operation.
; Ports 60-63 are palette entries. Port 70 selects a 6845 CRT-controller register and port 71
; reads or writes that register.
; The ROM mirrors writable port state in U0 variables 0B11H-0B13H. Update a mirror and use
; read-modify-write when changing one field so keyboard selection, motors, sound, printer, and
; colour bits do not get lost.
; I/O reads and writes may be routed through the RST30 class dispatcher; a routine that reaches
; hardware directly still has to preserve the mapper and any port mirror required by its caller.

; =============================================================================
; RAM-RESIDENT CALL BRIDGES
; =============================================================================
; U0 0B00H-0B0FH is the device assignment table. Input selectors occupy 0B00H-0B07H and output
; selectors 0B08H-0B0FH; each byte names a device class and its selected slot.
; The default input classes are video, keyboard, editor, sound, printer, cassette, cards, and
; connector select at 0B00H-0B07H. The output table at 0B08H-0B0FH follows the same order.
; The RST30 function byte is encoded as direction in bit 7, device class in bits 6-4, and routine
; number in bits 3-0. Bit 7 clear denotes an input/read operation; set denotes output/write.
; For each class, routine 0 is the interrupt service, routine 1 is character I/O, and routine 2 is
; block I/O unless the class documents a narrower set. The dispatcher supplies the selected device
; context.
; RST30 is bridged through RAM because a RST instruction cannot itself select the desired ROM
; page. The bridge reads the byte after the RST, saves the current page at 0003H, maps the
; selected SYS/U0/U1/U2 page, and enters the ROM dispatcher.
; The normal bridge entry is U0 0B23H. It consumes the post-RST function byte and enters the
; common SYS dispatch path (the SYS-side implementation is reached at the documented C363H entry).
; The bridge return at U0 0B37H restores the saved page and AF before returning to the interrupted
; caller. Code invoking RST30 must leave the inline function byte immediately after the
; instruction.
; The interrupt bridge at U0 0B41H performs the corresponding page restore, restores AF, enables
; interrupts, and returns. Interrupt handlers must not bypass this tail unless they restore the
; same state themselves.
; RST18 is BASIC's token/function dispatch bridge: BASIC maintains the next RST18 code pointer in
; its workspace and uses the tokenized stream to select the implementation routine.
; Because these bridges are RAM code, their bytes and labels belong to the U0 physical workspace
; in a listing even though callers often see them as fixed CPU addresses.

; =============================================================================
; SYSTEM VARIABLES AND INTERRUPT STATE
; =============================================================================
; 0B10H INT-DES is the active-low interrupt-source mask: bit 0 video/cursor, bit 1 keyboard, bit 2
; editor, bit 3 sound, and bits 4-7 expansion cards 3 through 0. A zero bit enables that source.
; 0B11H mirrors port 03. Bits 7-6 select the expansion card IOMEM and bits 3-0 select the keyboard
; matrix row; all unrelated bits must be preserved when either field changes.
; 0B12H mirrors port 05. Bits 7-6 are the cassette motor controls, bit 5 sound IRQ enable, bit 4
; sound enable, and bits 3-0 the divider high nibble.
; 0B13H mirrors port 06. Bit 7 is printer STROBE, bit 6 is hardware-dependent, bits 5-2 are sound
; volume, and bits 1-0 are the 2/4/16-colour mode selector.
; 0B14H SOUND-ACT is FF while a timed tone is active; 0B15H TONE-REPLACE is FF when a new tone
; should replace an existing one instead of waiting for it to finish.
; 0B16H STOP-FLAG becomes FF on CTRL+ESC and is polled by long-running BASIC, editor, graphics,
; and file operations to provide a cooperative break.
; 0B17H-0B18H hold the minimum stack address reserved by paint/fill algorithms (normally 0F10H).
; U0's CPU stack starts near 0EACH and leaves roughly 100 bytes for nested calls.
; 0B19H-0B1AH HI-MEM is the highest usable RAM address, normally BFFFH on a 64K machine; BASIC's
; downward-growing stack and allocations must not cross it.
; 0B1BH U3-STAT is zero when U3 RAM is good and FF when it failed the memory test. 0B1CH records
; the assigned serial-card base slot or FF for no assignment.
; 0B1DH-0B1EH TIME is a two-byte software clock incremented by the periodic interrupt. 0B1FH
; IRQ-STAT enables cursor/video (bit 0), sound (bit 1), and card 0-3 (bits 2-5).
; 0B20H INT-FLAG is FF while the interrupt routine owns the shared state. 0B21H WARM-FLAG is FF
; during a warm reset; 0B22H COLD-FLAG requests a cold reset and is consumed by initialization.

; =============================================================================
; VIDEO WORKSPACE AND DRAWING STATE
; =============================================================================
; 0B49H-0B4AH is a temporary saved SP used by graphics routines. 0B4BH L-MODE selects overwrite
; (0), OR (1), AND (2), or XOR (3) raster composition.
; 0B4CH L-STYLE selects the line style; 0B4DH INK and 0B4EH PAPER hold logical colours; 0B4FH
; BORDER packs intensity in bit 7, green in bit 5, red in bit 3, and blue in bit 1.
; 0B50H V-FLAG selects character-cell overwrite behaviour: 0 replaces fully, 1 preserves old
; pixels where the new character is background, 2 draws inverse, and 3 leaves the cell unchanged.
; 0B73H is the current colour mode (00=2 colour, 01=4 colour, 02=16 colour). 0B74H is the pen
; state (FF down, 00 up) and 0B75H is the fill byte used by area operations.
; 0B76H-0B77H hold the current video-RAM address. Logical X at 0B78H-0B79H and logical Y at
; 0B7AH-0B7BH are transformed to physical X at 0B7CH-0B7DH and physical Y at 0B7EH-0B7FH.
; The horizontal coordinate is mode scaled: physical pixels per logical unit are 2, 4, or 8 for
; 2-, 4-, and 16-colour modes. The physical raster is 1024 by 960 pixels; logical Y is
; quarter-height.
; 0B83H is the line-pattern byte. The drawing code interprets it as one of the available
; dashed/solid styles and advances the pattern as pixels are emitted.
; The 6845 registers at ports 70H/71H determine display timing and the visible text/graphics base.
; Palette writes use 60H-63H; changing mode also requires the port-06 mirror to agree with the
; hardware.
; Editor row descriptors and cursor state use the mode-derived row length and character width;
; graphics routines should not assume a fixed 40-column text stride.
; Video routines commonly save and restore the mapper around VID access. A pointer is meaningful
; only while page 2 exposes VID and the corresponding video address registers/work variables are
; current.

; =============================================================================
; KEYBOARD WORKSPACE AND MATRIX SCAN
; =============================================================================
; The keyboard is a 10-row by 8-column matrix. Select a row by writing the low nibble of port 03
; and read the active-low column bits from port 58.
; 0B51H-0B5AH PICTURE stores the current ten-row matrix image; 0B5BH-0B64H OLD-PIC stores the
; previous image. Difference scanning identifies newly pressed and released keys.
; 0B65H DELAY-KEY is the initial key-repeat delay in 20 ms units (default 1EH, approximately 0.6
; s). 0B67H RATE-KEY is the repeat period (default 03H, approximately 60 ms).
; 0B66H LOCK-KEY records the modifier lock state: CTRL bit 0, SHIFT bit 1, and ALT bit 3. 0B68H
; HOLD-KEY is FF when CTRL+P hold processing is disabled.
; 0BE5H is the pending-key marker (00 none, FF a translated key is waiting at 0BE9H). 0BE7H
; records lock activity, 0BE8H the current modifier (00/02/04/08 for shift/ctrl/alt), and 0BE9H
; the key code.
; 0BEAH and 0BEBH are repeat-delay and repeat-rate counters. 0BECH-0BEDH identify the differing
; matrix address and 0BEEH contains the single differing bit mask.
; A scan must preserve the selected expansion-card bits in port 03 while changing the keyboard
; row. The interrupt path acknowledges a key by copying the new matrix into OLD-PIC after deciding
; whether it is a press, release, or repeat.
; The translated key code is consumed by editor/BASIC input through the keyboard device class, not
; by reading port 58 directly. CTRL+ESC sets STOP-FLAG for cooperative break.
; Keyboard and cursor interrupts share the INT-DES and IRQ-STAT gating variables; code that polls
; the matrix while interrupts are active must account for a concurrently updated PICTURE image.

; =============================================================================
; CASSETTE AND FILE WORKSPACE
; =============================================================================
; 0BF0H saves the border while cassette I/O is active. 0BF1H VERIFY is nonzero for
; compare-with-memory mode. 0BF2H saves the first byte of the interrupt vector while tape timing
; temporarily installs its own handler.
; 0BF3H records an open-read file: 00 none, 01 buffered, 03 unbuffered. 0BF4H-0C04H is the
; requested filename (length byte followed by up to 16 characters); 0C05H-0C15H is the name read
; from tape.
; 0C16H-0D04H is the input buffer. 0D05H-0D06H counts bytes read, 0D07H-0D08H points to the next
; input byte, and 0D09H-0D0AH counts bytes remaining.
; 0D0BH is the input error; 0D0CH is protection; 0D0DH is the sector number; 0D0EH is the
; sector-end marker (00 intermediate, FF final); 0D0FH distinguishes header (FF) from data (00).
; 0D10H-0D11H retain the first destination address. 0D13H is the read phase (FF opening a file, 00
; continuing an existing file).
; 0D14H is the output file state (00 none), 0D15H-0D25H the output filename, and 0D26H-0E25H the
; output buffer. 0E26H-0E27H counts bytes to store and 0E28H-0E29H points at the next output
; address.
; 0E2AH is output error; 0E2CH-0E2DH is source start; 0E2EH is current output character; 0E2FH is
; output type (01 buffered, 03 unbuffered); 0E30H is protection; 0E32H is write phase (FF header,
; 00 data).
; A cassette sector carries a 256-byte data payload plus framing, type, sequence, protection, and
; CRC information. MUDDLE at 0B6FH-0B70H is the CRC seed and can act as a file protection
; password.
; 0B6BH BUFFER selects unbuffered (00) or buffered (FF) file handling. 0B6CH REMRED selects
; motor/head routing: 00 left read/right write, 40 right read/write, 80 left read/write, C0 left
; write/right read.
; 0B6DH PROTECT is nonzero when writes are inhibited; 0B6EH EOF becomes nonzero after the final
; byte; 0B71H SER-OK is zero when the divider is synchronized for serial and FF after sound/tape
; invalidates that timing.
; Tape input uses port 59 bit 5 and writes by toggling port 50. Motor controls are port 05 bits
; 6-7; tape timing shares the periodic interrupt and must restore the saved vector, border,
; divider, and mapper on exit.

; =============================================================================
; EDITOR WORKSPACE AND CPU STACK
; =============================================================================
; 0E48H is the cursor blink counter; 0E49H is cursor Y and 0E4AH cursor X. 0E4BH-0E4CH points into
; the ASCII line buffer, while 0E4DH records the cursor/line position state.
; 0E4EH-0E4FH saves the prior cursor position. 0E50H-0E67H contains 24 row descriptors used to
; translate editor rows into video addresses and wrap rules.
; 0E68H-0E6AH is a mode-dependent jump or dispatch value. 0E6BH is row length (40, 20, or 10);
; 0E6CH is character width (1, 2, or 4) in the selected colour mode.
; 0E6DH-0E94H stores the saved cursor glyph/attributes (40 bytes). 0E95H and 0E96H are the ink and
; paper lines used when restoring the cursor cell.
; 0EACH-16ABH is the CPU stack area. The stack grows downward from its high end; paint/fill
; routines use 0B17H as a lower safety limit so a large recursive operation cannot overwrite
; workspace.
; 0C16H-0D04H and 0D26H-0E25H are also editor/file buffers. Routines must preserve the ownership
; convention: the editor may reuse a buffer only when no cassette operation has it open.
; Editor input is device-class routed. The keyboard interrupt writes a translated code to 0BE9H
; and the editor consumes it, updating cursor coordinates, row descriptors, and video RAM through
; the active mode.
; When switching video modes, recompute row length and character width and rebuild row
; descriptors; retaining a 40-column descriptor table in a 16-colour mode produces incorrect
; cursor and wrap addresses.

; =============================================================================
; BASIC WORKSPACE AND TOKENIZED PROGRAM FORMAT
; =============================================================================
; BASIC work variables occupy 1700H-19EFH. 1700H flags TRACE (bit 0), suppress-OK (bit 1), running
; (bit 2), and file-open (bit 3).
; 1701H pending-value type is 01 string or 03 number; 1702H is the conditional-execution flag;
; 1704H holds the byte after RST18; 1705H is function class; 1706H is the selected device number.
; 1707H AUTORUN is FF when an autorun request is pending. 1708H is symbol type; 1709H-170BH hold
; RND state. 170CH current-line, 170EH next-line, and 1710H next-statement pointers walk the
; tokenized program.
; 1712H-1714H are DATA line and byte pointers; 1716H is the INPUT data pointer; 1718H points to
; the next RST18 code; 171AH snapshots the BASIC stack pointer.
; 1720H VLOMEM is the low-memory/base boundary; 1722H is program/TEXT start; 1724H is the end of
; the chained symbol area; 1726H TOP is the next free symbol byte; 172AH holds the current sound
; PITCH.
; 1732H-1830H is the command buffer. 1831H-192FH is the INPUT buffer. 19C0H-19C6H and 19C7H-19D0H
; are floating-point X and Y registers.
; 19CEH-19DEH holds the current filename; 19DFH-19EEH is the cassette header workspace. 19EFH is
; reserved by the ROM, so user/free U0 allocation starts after it.
; A stored BASIC line begins with its byte length, then a two-byte binary line number, then
; tokenized text, and an FF line terminator. A 00 length marks the end of the program.
; The BASIC evaluation stack grows downward from HI-MEM. Each element starts with a type marker,
; allowing numeric and string values to share the stack while variable-length payloads are
; addressed relative to that marker.
; The tokenizer and statement handlers exchange pointers rather than source strings: current byte,
; next statement, DATA, INPUT, and RST18 pointers must remain consistent when a handler skips or
; consumes a clause.

; =============================================================================
; DEVICE CLASSES AND RST30 DISPATCH SEMANTICS
; =============================================================================
; The eight device classes are video, keyboard, editor, sound, printer, cassette, cards, and
; connector/slot selection. Their input selector bytes are U0 0B00H-0B07H and output selector
; bytes U0 0B08H-0B0FH.
; The documented default selector values are input FF, 01, 02, FF, FF, 05, 06, and a
; connector-select value; output FF, FF, 02, FF, 04, 05, 06, and FF or a serial slot.
; The function byte after RST30 encodes class and direction, so BASIC and editor code can use the
; same bridge for console, printer, tape, sound, and card operations without knowing the concrete
; device routine address.
; Routine number 0 is the class interrupt hook, 1 is character transfer, and 2 is block transfer.
; A block call commonly receives a pointer/count pair in registers or workspace and returns a
; count or error code according to the class.
; Character input returns the translated character or a no-data indication; character output
; consumes the character and may block until the selected device accepts it. Callers should test
; the documented carry/error convention before advancing a BASIC pointer.
; Card dispatch first selects the card through port 03 bits 7-6 and then accesses the card's USART
; or IOMEM. Connector selection is separate from the logical cards class because it controls which
; physical slot is presented in the EXT lower half.
; The dispatcher may change the current page and shared port mirrors. RST30 callers therefore
; return through the bridge and must not assume a page, AF, or device-selection register survives
; a failed operation.
; Interrupt entry and device calls share INT-DES, IRQ-STAT, INT-FLAG, and the 0B41H tail. A
; routine that masks a source should restore the prior active-low mask rather than blindly
; enabling all devices.

; =============================================================================
; SOUND AND SERIAL CLOCK CONTRACT
; =============================================================================
; The 12-bit PITCH divider is written as high nibble in port 05 bits 3-0 and low byte in port 04.
; The usable divisor is 4096 minus PITCH; zero divisor is not a valid operating point.
; The divider output is 3125/(4096-PITCH) kHz. For serial cards the clock is 1562500/(4096-PITCH)
; Hz, and the tone/IRQ output is 195312.5/(4096-PITCH) Hz.
; Port 05 bit 4 enables the sound output and bit 5 enables sound interrupts. Port 06 bits 6-2
; select volume. The ROM stores the same fields in 0B12H and 0B13H.
; 0B14H SOUND-ACT and 0BEFH duration counter let the periodic interrupt terminate a timed tone.
; 0B15H TONE-REPLACE controls whether a new tone takes over immediately.
; 0B69H BAUD encodes 110, 150, 300, 600, 1200, 2400, 4800, 9600, and 19200 baud as values 00H
; through 08H.
; 0B6AH FORMAT defaults to EEH: two stop bits, no parity, eight data bits, and a 16-times clock.
; Serial initialization translates BAUD and FORMAT into the selected USART command/mode registers.
; Sound or cassette activity changes the shared divider. 0B71H SER-OK is cleared only when the
; divider remains synchronized for serial; serial code must reprogram or reject a transfer after
; an invalidating device operation.
; A sound routine should preserve the port-05 high-nibble and motor bits while changing PITCH or
; sound enables. Direct port writes that omit the mirror can silently stop tape motors or leave
; the interrupt mask inconsistent.

; =============================================================================
; CASSETTE SIGNAL, FRAMING, AND CRC CONTRACT
; =============================================================================
; Cassette input is sampled at port 59 bit 5; output is generated by toggling port 50. The left
; and right motor controls are port 05 bits 6 and 7 and are routed by REMRED at 0B6CH.
; The tape front-end records a header block followed by one or more data blocks. A block
; identifies its type, sector number, end marker, protection value, payload length, and CRC; the
; final block has an FF end marker.
; MUDDLE at 0B6FH-0B70H seeds the checksum/CRC transformation. Matching the seed is part of the
; protection check, so VERIFY and protected loads must not overwrite it before the header is
; accepted.
; VERIFY at 0BF1H selects compare mode: the reader decodes tape data into its buffer and compares
; it with the destination instead of storing it. EOF at 0B6EH is set only after the final block
; has been consumed.
; Buffered mode accumulates a sector in 0C16H-0D04H or 0D26H-0E25H and updates the next-byte
; pointer/count fields. Unbuffered mode streams bytes while still maintaining the header,
; protection, and error state.
; The tape interrupt temporarily replaces the vector byte at 0038H and saves its original first
; byte at 0BF2H. Every exit path, including checksum or motor errors, must restore that byte and
; the previous interrupt/page state.
; Input and output error bytes at 0D0BH and 0E2AH are sticky for the current operation. A caller
; should inspect them before closing the file or advancing the BASIC program pointer.
; The border save at 0BF0H is part of the user-visible tape contract: cassette routines may change
; border colour while synchronizing and restore it after motors stop.

; =============================================================================
; CALLER-SAFE STATE AND ERROR HANDLING
; =============================================================================
; ROM entry points generally preserve the mapper only through the RAM bridge or their documented
; return path. A direct SYS/EXT call must establish the expected page and restore it before
; returning to BASIC or the editor.
; Shared state includes port mirrors, interrupt masks, tape buffers, cursor/video variables, and
; BASIC pointers. Treat these as live workspaces rather than constants: interrupts can update them
; between any two instructions unless the source is masked.
; STOP-FLAG is the common cooperative cancellation mechanism. Long loops should poll it at a safe
; point, restore hardware state, and return the class-specific error rather than jumping directly
; to warm reset.
; Cassette and serial errors are represented in workspace bytes and often leave the carry/error
; result set at the API boundary. Callers must not assume a failed block consumed the requested
; count.
; BASIC handlers must update current-line/current-statement and DATA/INPUT pointers only after
; successful parsing or transfer. On syntax, type, device, or tape error, preserve enough state
; for the error reporter to identify the current statement.
; The stack, U0 buffers, and HI-MEM boundary are shared by graphics and BASIC. Before reserving a
; temporary buffer, compare its end with HI-MEM and the paint stack floor at 0B17H-0B18H.
; Use the ROM image as byte authority when a prose map and a disassembly label disagree. The
; physical bank/offset is authoritative for annotations; CPU addresses and book names are
; explanatory views.

ORG C000H, SYS0, 0000H


; -----------------------------------------------------------------------------
; RESET VECTOR
; -----------------------------------------------------------------------------
;
; Transfers control from the Z80 reset address to the BASIC system initializer.
;
; At power-on the SYS ROM is mapped into page 0, so the processor fetches this instruction at CPU
; address 0000H. The same physical byte normally appears at C000H when SYS occupies page 3.
;
; The target is written as BASIC_COLD_START@SYS0 because execution is still using the
; page-0 SYS mapping. It is the page-0 alias of BASIC_COLD_START at C229H.
;
; Entry:
;   PC = 0000H after reset, with SYS mapped into page 0.
;
; Exit:
;   Control transfers to BASIC_COLD_START through its 0229H alias.
;
; Effects:
;   Begins machine initialization.
; -----------------------------------------------------------------------------
RESET_VECTOR:
    JP BASIC_COLD_START@SYS0

; -----------------------------------------------------------------------------
; BCD DIGIT MULTIPLICATION TABLE
; -----------------------------------------------------------------------------
;
; BCD products for decimal digits 0 through 9.
;
; This is a 10 by 10 multiplication table. Rows select one decimal digit and columns select the
; other. Each result is stored as packed BCD rather than ordinary binary, so the product of 7 and
; 8 appears as 56H.
; -----------------------------------------------------------------------------
BCD_MULTIPLICATION_TABLE:
    DB 00H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 01H, 02H, 03H, 04H, 05H ; |................|
    DB 06H, 07H, 08H, 09H, 00H, 02H, 04H, 06H, 08H, 10H, 12H, 14H, 16H, 18H, 00H, 03H ; |................|
    DB 06H, 09H, 12H, 15H, 18H, 21H, 24H, 27H, 00H, 04H, 08H, 12H, 16H, 20H, 24H, 28H ; |.....!$'..... $(|
    DB 32H, 36H, 00H, 05H, 10H, 15H, 20H, 25H, 30H, 35H, 40H, 45H, 00H, 06H, 12H, 18H ; |26.... %05@E....|
    DB 24H, 30H, 36H, 42H, 48H, 54H, 00H, 07H, 14H, 21H, 28H, 35H, 42H, 49H, 56H, 63H ; |$06BHT...!(5BIVc|
    DB 00H, 08H, 16H, 24H, 32H, 40H, 48H, 56H, 64H, 72H, 00H, 09H, 18H, 27H, 36H, 45H ; |...$2@HVdr...'6E|
    DB 54H, 63H, 72H, 81H                                                           ; |Tcr.|

; -----------------------------------------------------------------------------
; BASIC STATEMENT DISPATCH TABLE
; -----------------------------------------------------------------------------
;
; Jump table for primary BASIC statement tokens.
;
; The table contains little-endian handler addresses for BASIC statement tokens from FFH down to
; D0H. The entries cover line termination and REM, followed by DATA, CLOSE, CLS, CONTINUE, DEF,
; DELETE, DIM, ELSE, END, FOR, GET, GOSUB, GOTO, GRAPHICS, IF, INPUT, LET, LIST, LLIST, LOAD,
; LOMEM, NEW, NEXT, OK, ON, OPEN, OUTPUT, OUT, PLOT, POKE, PRINT, RANDOMIZE, READ, RESTORE,
; RETURN, RUN, SAVE, SET, SOUND, STOP, TRACE, VERIFY, EXT, and LPRINT.
; -----------------------------------------------------------------------------
BASIC_STATEMENT_JUMP_TABLE:
    DB BBH, DBH, BBH, DBH, 80H, DBH, BBH, DBH, F2H, DFH, 9BH, E8H, FCH, DFH, 65H, DDH ; |..............e.|
    DB 02H, E0H, 93H, DDH, 53H, E0H, 04H, E1H, 0EH, E1H, 5CH, E1H, 10H, E9H, 82H, E3H ; |....S.....\.....|
    DB B2H, E3H, 33H, E7H, EEH, E2H, CBH, E1H, C1H, E3H, 85H, DDH, 80H, DDH, 51H, E9H ; |..3...........Q.|
    DB 52H, E4H, 08H, DEH, B6H, E4H, 06H, DBH, 32H, E3H, C9H, E8H, 73H, E5H, 42H, E5H ; |R.......2...s.B.|
    DB 54H, E7H, 53H, E5H, 73H, E5H, C7H, E6H, 1BH, E2H, F4H, E6H, 0FH, E7H, 1BH, DEH ; |T.S.s...........|
    DB 82H, E9H, 90H, E7H, 33H, E8H, A3H, FFH, 31H, DEH, D3H, E9H, 17H, E1H, 70H, E5H ; |....3...1.....p.|

; -----------------------------------------------------------------------------
; RST 18H ARITHMETIC DISPATCH TABLE
; -----------------------------------------------------------------------------
;
; Jump table for RST 18H arithmetic operations 0 through 14.
;
; Each little-endian address selects one operation in the BASIC arithmetic-stack interpreter. Most
; operations consume or produce a nine-byte stack value addressed by IY.
;
; Note:
;   Operations 0-3 perform add, divide, multiply, and subtract on the top two stack values and
;   advance IY by nine bytes. Operation 4 negates the top value. Operations 5-11 move numbered
;   constants or the X and Y arithmetic registers to and from the stack. Operation 12 copies the
;   top value down one slot, operation 13 stores the top value at HL, and operation 14 evaluates a
;   function argument onto the stack.
; -----------------------------------------------------------------------------
RST18_JUMP_TABLE:
    DB 93H, F4H, FBH, F5H, 12H, F5H, 8EH, F4H, 26H, F7H, 82H, EAH, 9FH, EAH, 9AH, EAH ; |........&.......|
    DB D2H, EAH, CDH, EAH, C3H, EAH, BEH, EAH, 92H, FAH, 28H, FBH, 68H, EAH         ; |..........(.h.|

; -----------------------------------------------------------------------------
; INTELLIGENT SOFTWARE COPYRIGHT
; -----------------------------------------------------------------------------
;
; Copyright text embedded between the RST 18H table and the numeric constants.
;
; The bytes contain the ASCII text Copyright (c) 1984 Intelligent Software Ltd.
; -----------------------------------------------------------------------------
INTELLIGENT_SOFTWARE_COPYRIGHT:
    DB 43H, 6FH, 70H, 79H, 72H, 69H, 67H, 68H, 74H, 20H, 28H, 63H, 29H, 20H, 31H, 39H ; |Copyright (c) 19|
    DB 38H, 34H, 20H, 20H, 49H, 6EH, 74H, 65H, 6CH, 6CH, 69H, 67H, 65H, 6EH, 74H, 20H ; |84  Intelligent |
    DB 53H, 6FH, 66H, 74H, 77H, 61H, 72H, 65H, 20H, 4CH, 74H, 64H                   ; |Software Ltd|

; -----------------------------------------------------------------------------
; NUMBERED FLOATING-POINT CONSTANTS
; -----------------------------------------------------------------------------
;
; Forty constants stored in the BASIC arithmetic-stack number format.
;
; Each entry occupies seven bytes: a six-byte BCD mantissa followed by a characteristic byte. The
; arithmetic stack normally adds overflow and bookkeeping bytes around this representation, so the
; ROM table stores only the constant payload.
;
; The published listing identifies entry 0 as 0.5, entry 1 as 1.0, entry 34 as PI, and entry 35 as
; PI/2. Other entries are addressed by number from the RST 18H constant-loading operation.
; -----------------------------------------------------------------------------
NUMBERED_FP_CONSTANTS:
    DB 00H, 00H, 00H, 00H, 00H, 50H, 3FH, 00H, 00H, 00H, 00H, 00H, 10H, 40H, 31H, 24H ; |.....P?......@1$|
    DB 19H, 49H, 79H, 26H, 3FH, 57H, 07H, 08H, 05H, 32H, 17H, 40H, 69H, 75H, 80H, 50H ; |.Iy&?W...2.@iu.P|
    DB 20H, 73H, 3FH, 74H, 48H, 34H, 08H, 40H, 14H, C0H, 98H, 88H, 84H, 26H, 00H, 72H ; | s?tH4.@.....&.r|
    DB BFH, 19H, 89H, 03H, 25H, 20H, 43H, 40H, 99H, 45H, 58H, 22H, 52H, 47H, 40H, 07H ; |....% C@.EX"RG@.|
    DB 38H, 96H, 88H, 85H, 86H, 3FH, 00H, 00H, 00H, 00H, 51H, 11H, 40H, 23H, 70H, 49H ; |8....?....Q.@#pI|
    DB 46H, 25H, 29H, 3CH, 06H, 95H, 88H, 64H, 44H, 50H, 42H, 63H, 75H, 99H, 82H, 00H ; |F%)<...dDPBcu...|
    DB 14H, 41H, 16H, 65H, 64H, 73H, 28H, 33H, 3EH, 01H, 79H, 97H, 92H, 08H, 10H, 43H ; |.A.eds(3>.y....C|
    DB 97H, 10H, 08H, 94H, 20H, 11H, 42H, 99H, 92H, 50H, 58H, 02H, 23H, 40H, 90H, 37H ; |.... .B..PX.#@.7|
    DB 14H, 68H, 15H, 29H, C0H, 57H, 15H, 49H, 03H, 63H, 31H, 40H, 78H, 14H, 60H, 81H ; |.h.).W.I.c1@x.`.|
    DB 35H, 67H, BFH, 42H, 95H, 06H, 04H, 07H, 10H, C1H, 21H, 40H, 81H, 69H, 96H, 16H ; |5g.B......!@.i..|
    DB 41H, 67H, 54H, 04H, 80H, 90H, 81H, C0H, 07H, 38H, 96H, 88H, 85H, 86H, 3FH, 88H ; |AgT......8....?.|
    DB 60H, 66H, 66H, 66H, 16H, BFH, 56H, 20H, 07H, 33H, 33H, 83H, 3DH, 31H, 82H, 32H ; |`fff..V .33.=1.2|
    DB 08H, 84H, 19H, BCH, 78H, 06H, 71H, 39H, 52H, 27H, 3AH, 60H, 40H, 46H, 83H, 86H ; |....x.q9R':`@F..|
    DB 23H, B8H, 00H, 00H, 00H, 07H, 36H, 22H, 3FH, 00H, 00H, 00H, 27H, 44H, 89H, 3FH ; |#.....6"?...'D.?|
    DB 17H, 60H, 76H, 27H, 62H, 31H, 3FH, 31H, 51H, 79H, 57H, 29H, 57H, 41H, 59H, 53H ; |.`v'b1?1QyW)WAYS|
    DB 26H, 59H, 41H, 31H, 40H, 79H, 26H, 63H, 79H, 70H, 15H, 40H, 20H, 51H, 75H, 19H ; |&YA1@y&cyp.@ Qu.|
    DB 47H, 10H, 40H, 98H, 55H, 77H, 98H, 35H, 52H, 3FH, 00H, 00H, 00H, 80H, 76H, 32H ; |G.@.Uw.5R?....v2|
    DB 44H, 00H, 99H, 99H, 99H, 99H, 99H, 7EH                                       ; |D......~|

; -----------------------------------------------------------------------------
; SYSTEM INITIALIZATION
; -----------------------------------------------------------------------------
;
; Initializes the TVC after power-on and selects the warm- or cold-reset path.
;
; Initialization disables maskable interrupts, selects Z80 interrupt mode 1, establishes temporary
; SYS and EXTH mappings, clears the palette, programs the 6845 CRT controller, and decides whether
; destructive RAM tests are required.
;
; The EXTH routine at F13DH checks the RAM-resident U0 system stubs and WARM-FLAG. Its result is
; returned in the alternate accumulator and combined with COLD-FLAG at 0B22H. A valid U0 image
; permits warm reset; damaged U0 state or an explicit cold-reset request forces memory testing.
;
; Cold initialization tests U0, video RAM, U1, U2, and optional U3 RAM. U0 failure is fatal and
; produces a flashing border. The highest usable address discovered in U1/U2 is stored in HI-MEM
; at 0B19H. Warm initialization skips these destructive tests and uses a delay loop that allows a
; second RESET press to force the cold path.
;
; Entry:
;   Entered from RESET_VECTOR with SYS available through its page-0 alias.
;
; Exit:
;   Continues through WARM_RESET and EXTH initialization with RAM availability recorded in system
;   variables and AF'.
;
; Effects:
;   Changes paging and hardware state. The cold path destructively tests and clears RAM.
;
; Destroys:
;   AF, BC, DE, HL, SP, alternate AF, and the current memory mapping.
;
; Note:
;   The bytes at C26AH-C26BH deliberately form overlapping instructions. The cold path executes LD
;   A,08H from C26AH, while the warm-candidate path enters at C26BH and decodes the same 08H byte
;   as EX AF,AF'.
; -----------------------------------------------------------------------------
BASIC_COLD_START:
    DI
    IM 1
    LD A,40H
    OUT (02H),A
    JP LC233@SYS0
; Page-0 SYS continuation: M=40H keeps SYS in page 0, so this lands via the 0233H alias.
LC233:
    LD A,C0H
    OUT (02H),A
    JP F13DH
    LD A,40H

; Memory paging: S U V S page layout.
    OUT (02H),A
    JP C241H

LC241:
    LD A,50H

; Memory paging: U U V S page layout.
    OUT (02H),A
    XOR A
    LD BC,0460H

LC249:
    OUT (C),A
    INC C
    DJNZ C249H
    LD HL,C545H
    LD B,10H

LC253:
    LD A,B
    DEC A
    OUT (70H),A
    LD A,(HL)
    OUT (71H),A
    INC HL
    DJNZ C253H
    LD A,80H

; Send one STROBE pulse.
    OUT (06H),A
    LD A,(0B22H)
    INC A
    JR NZ,C26BH
    LD (0B21H),A
    DB 3EH                                                                          ; |>|

LC26B:
    EX AF,AF'
    INC A
    JR Z,C2BBH
    LD SP,BFFFH
    LD HL,0000H
    CALL C33EH
    JR Z,C27FH

LC27A:
    DEC A
    OUT (00H),A
    JR C27AH

LC27F:
    LD SP,16ACH
    LD HL,8000H
    CALL C33EH
    JR Z,C28EH
    LD A,88H
    OUT (C),A

LC28E:
    LD A,70H

; Memory paging: U U U S page layout.
    OUT (02H),A
    LD HL,4000H
    CALL C33EH
    CALL Z,C33EH
    DEC HL
    LD (0B19H),HL
    LD A,40H
    OUT (02H),A
    LD SP,BFFFH
    JP LC2A9@SYS0
; Page-0 SYS continuation: M=40H keeps SYS in page 0, so this lands via the 02A9H alias.
LC2A9:
    LD A,80H
    OUT (02H),A
    LD HL,C000H
    CALL MEMORY_TEST_PAGE0@SYS0
    LD A,00H
    JR Z,C2B8H
    DEC A

LC2B8:
    EX AF,AF'
    JR C2C2H

LC2BB:
    LD H,A
    LD L,A

LC2BD:
    DEC HL
    LD A,H
    OR L
    JR NZ,C2BDH

; -----------------------------------------------------------------------------
; COMMON RESET CONTINUATION
; -----------------------------------------------------------------------------
;
; Converges the warm and cold reset paths and rebuilds the operating environment.
;
; SYS is restored in page 0, EXTH is selected in page 3, and control passes to EXT_INIT at F000H.
; The extension initializer rebuilds the U0 RAM stubs and initializes expansion-card descriptors
; before returning to SYS.
;
; After EXT_INIT, the routine acknowledges or disables interrupt sources, resets the border and
; printer/audio state, then calls the built-in video, keyboard, sound, and cassette initializers
; through the table at C555H.
;
; Entry:
;   AF' retains the U3 test result on the cold path; user RAM is preserved on the warm path.
;
; Exit:
;   Built-in devices and RAM-resident operating-system support are initialized.
;
; Effects:
;   Changes paging, stack position, I/O ports, and U0 system variables.
; -----------------------------------------------------------------------------
WARM_RESET:
    LD A,40H
    OUT (02H),A
    JP LC2C9@SYS0
; Page-0 SYS continuation: M=40H keeps SYS in page 0, so this lands via the 02C9H alias.
LC2C9:
    LD A,C0H
    OUT (02H),A
    LD SP,16ACH
    JP F000H
    XOR A
    LD (0B11H),A
    OUT (03H),A

; Clear cursor/sound interrupt.
    OUT (07H),A
    OUT (58H),A
    OUT (59H),A
    OUT (5AH),A
    OUT (5BH),A
    OUT (00H),A
    LD (0B4FH),A
    LD A,80H
    OUT (06H),A
    LD (0B13H),A
    LD HL,C555H
    LD BC,0470H

LC2F5:
    PUSH BC
    LD E,(HL)
    INC HL
    LD D,(HL)
    INC HL
    PUSH HL
    EX DE,HL
    CALL C321H
    POP HL
    POP BC
    LD A,C

; Memory paging: U U U S page layout.
    OUT (02H),A
    DJNZ C2F5H

; -----------------------------------------------------------------------------
; SIDE-CARTRIDGE AUTOSTART
; -----------------------------------------------------------------------------
;
; Checks for the MOPS cartridge signature and transfers control to the cartridge entry point.
;
; The side cartridge is mapped into page 3 and its first four bytes are compared with the ASCII
; signature MOPS stored at C334H. If all bytes match, HL has advanced to cartridge offset 0004H
; and JP (HL) starts the cartridge immediately after the signature.
;
; If the signature is absent, the normal SYS mapping is restored, the mapping byte is saved in
; P-SAVE at 0003H, interrupts are enabled, and startup continues at BASIC_INIT.
;
; Exit:
;   Transfers to cartridge offset 0004H on success; otherwise continues normal BASIC startup.
;
; Effects:
;   Temporarily maps the side cartridge and may transfer control outside the system ROM.
; -----------------------------------------------------------------------------
CARTRIDGE_AUTOSTART:
    LD A,60H
    OUT (02H),A
    JP LC30D@SYS0
; Page-0 SYS continuation: M=60H keeps SYS in page 0, so this lands via the 030DH alias.
LC30D:
    LD A,20H

; Memory paging: S U U C page layout.
    OUT (02H),A
    LD HL,C000H
    LD DE,0334H
    LD B,04H

LC319:
    LD A,(DE)
    CP (HL)
    JR NZ,C322H
    INC DE
    INC HL
    DJNZ C319H

; JUMP_HL - Transfers control to the address in HL.
; Entry: HL = target address
; Exit: Control continues at the address in HL.
; Effects: Does not return by itself.
JUMP_HL:
    JP (HL)

LC322:
    LD A,60H
    OUT (02H),A
    JP C329H

LC329:
    LD A,70H

; Memory paging: U U U S page layout.
    OUT (02H),A
    LD (0003H),A
    EI
    JP D9EFH

; -----------------------------------------------------------------------------
; MOPS CARTRIDGE SIGNATURE
; -----------------------------------------------------------------------------
;
; Four-byte ASCII signature recognized by the side-cartridge autostart check.
;
; A cartridge beginning with MOPS is entered at the byte immediately after this four-character
; signature. The spelling is MOPS, matching the stored bytes 4DH, 4FH, 50H, 53H.
; -----------------------------------------------------------------------------
MOPS_SIGNATURE:
    DB 4DH, 4FH, 50H, 53H                                                           ; |MOPS|
; Page-0 entry to the RAM page test below: called with HL preset while SYS is in page 0
; (M=80H), so the call reaches C338H through its 0338H alias.
MEMORY_TEST_PAGE0:
    PUSH HL
    CALL LC348@SYS0
    JR C342H

; -----------------------------------------------------------------------------
; 16 KIB RAM PAGE TEST
; -----------------------------------------------------------------------------
;
; Destructively fills, verifies, and clears one complete 16 KiB memory page.
;
; The first pass fills the page with 55H. Every byte is decremented, compared with 54H, and
; cleared after a successful comparison. The second pass repeats the operation with AAH and
; expects A9H. This detects stuck bits and many address- or data-line faults.
;
; Two entry paths reach the same physical test body because SYS may be visible in page 0 or page
; 3. The sequence around C347H-C348H deliberately overlaps: the page-3 fall-through path treats
; 01H as the start of LD BC,553EH, while a direct call to C348H decodes LD A,55H.
;
; Entry:
;   HL = first address of the 16 KiB page under test.
;
; Exit:
;   Z is set when the full page passes. On failure NZ is set and the test stops at the first
;   mismatching cell. On success HL advances to the address after the page.
;
; Effects:
;   Overwrites the entire tested page and leaves every successfully tested byte cleared to zero.
;
; Destroys:
;   AF, BC, DE, HL, and all original contents of the tested page.
; -----------------------------------------------------------------------------
MEMORY_TEST:
    PUSH HL
    CALL C348H

LC342:
    POP DE
    RET NZ
    EX DE,HL
    LD A,AAH
    DB 01H                                                                          ; |.|

LC348:
    LD A,55H
    PUSH HL
    LD E,L
    LD D,H
    INC DE
    LD (HL),A
    LD BC,3FFFH
    LDIR
    POP HL
    LD B,40H
    DEC A

LC358:
    DEC (HL)
    CPI
    DEC HL
    LD (HL),00H
    RET NZ
    INC HL
    RET PO
    JR C358H

; -----------------------------------------------------------------------------
; RST 30H OPERATING-SYSTEM DISPATCHER
; -----------------------------------------------------------------------------
;
; Decodes and invokes the operating-system function selected by the byte following RST 30H.
;
; The U0 RAM entry at 0030H jumps to a RAM-resident prologue at 0B23H. That prologue obtains the
; function byte, saves the caller's paging state, maps SYS, and transfers here after preserving
; the caller's alternate accumulator.
;
; Bit 7 selects the input or output assignment table, bits 6-4 select the function class, and bits
; 3-0 select a routine within that class. Class 7 is the non-redirectable kernel class. Other
; classes are resolved through the U0 device-assignment tables and may dispatch to a built-in jump
; table or an expansion-card routine in EXTH.
;
; The dispatcher preserves the caller's main and alternate working registers. Device routines
; return an error code in A; zero means success. Both normal and error exits unwind through the
; common RAM epilogue at 0B37H.
;
; Entry:
;   The byte after RST 30H is the function code. Function-specific parameters are supplied in
;   registers and U0 work variables.
;
; Exit:
;   A = 00H on success or a non-zero operating-system error code; other results are
;   function-specific.
;
; Effects:
;   May change paging and call SYS, EXTH, cartridge, or expansion-card handlers.
;
; Destroys:
;   Internal flags and dispatcher work state; the main caller register set is restored by
;   RST30_RETURN.
; -----------------------------------------------------------------------------
RST30_DISPATCH:
    PUSH HL
    PUSH IX
    PUSH IY
    EXX
    PUSH BC
    PUSH DE
    PUSH HL
    EXX
    EX AF,AF'
    CALL C37EH

; -----------------------------------------------------------------------------
; RST 30H COMMON RETURN
; -----------------------------------------------------------------------------
;
; Restores the register sets saved by RST30_DISPATCH and returns through the U0 epilogue.
;
; The final jump to 0B37H restores the caller's alternate accumulator and previous paging
; configuration before returning to the instruction after the RST 30H function byte.
;
; Exit:
;   Function-specific
;
; Effects:
;   Restores paging and caller state.
; -----------------------------------------------------------------------------
RST30_RETURN:
    EXX
    POP HL
    POP DE
    POP BC
    EXX
    POP IY
    POP IX
    POP HL
    JP 0B37H

LC37E:
    PUSH AF
    PUSH BC
    PUSH DE
    LD C,A
    OR A
    EX AF,AF'
    LD HL,0B01H
    LD A,(HL)
    CP 02H
    JR NZ,C38DH
    DEC (HL)

LC38D:
    LD DE,0B00H
    LD A,C
    RLCA
    JR C,C397H
    LD DE,0B08H

LC397:
    AND E0H
    RLCA
    RLCA
    RLCA
    LD B,A
    LD A,C
    AND 0FH
    LD C,A
    LD A,B
    CP 07H
    JR Z,C3D8H
    LD L,B
    XOR A
    LD H,A
    ADD HL,DE
    DEC A
    CP (HL)
    JR NZ,C3B3H
    LD A,C
    CP 03H
    JR NC,C3D0H

LC3B3:
    LD A,(HL)
    RES 7,A
    CP 07H
    JR C,C3C0H
    LD A,FEH

LC3BC:
    POP DE
    POP BC
    JR C3FCH

LC3C0:
    BIT 7,(HL)
    JR Z,C3CAH
    LD HL,F166H

LC3C7:
    JP FFF0H

LC3CA:
    LD A,C
    CP 03H
    JR NC,C3D0H
    LD B,(HL)

LC3D0:
    LD A,B
    CP 06H
    LD HL,F16CH
    JR Z,C3C7H

LC3D8:
    LD DE,C55DH
    LD L,B
    LD H,00H
    ADD HL,HL
    ADD HL,DE
    LD E,(HL)
    INC HL
    LD D,(HL)
    EX DE,HL
    LD A,(HL)
    DEC A
    CP C
    LD A,FFH
    JR C,C3BCH
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
    EX AF,AF'
    POP DE
    POP BC
    CALL C321H

LC3FC:
    OR A
    POP HL
    RET Z
    PUSH AF
    LD A,(0B20H)
    INC A
    JR Z,C410H
    PUSH BC
    PUSH DE
    LD A,H
    LD HL,F1E6H
    JR C3C7H
    POP DE
    POP BC

LC410:
    POP AF
    RET

; RST 38H interrupt entry; interrupt mode 1 dispatches here.
; RST 38H enters here after the RAM stub has selected the standard U0-U1-U2-SYS mapping.
; P-SAVE is saved before any register or paging work so the interrupted program can resume
; transparently.

; -----------------------------------------------------------------------------
; RST 38H INTERRUPT ENTRY
; -----------------------------------------------------------------------------
;
; Preserves the complete Z80 register context around the system interrupt service routine.
;
; Interrupt mode 1 arrives here through the RAM stub at 0038H after that stub has established the
; standard U0-U1-U2-SYS mapping. The first byte saves P-SAVE, the paging value that must be
; restored when the interrupt is complete.
;
; The handler pushes AF, the main register pairs, IX and IY, then exchanges to the alternate AF
; and register set and saves those as well. C437H can therefore use the CPU freely, including the
; alternate registers, without changing the interrupted program's observable state.
;
; After the core handler returns, the exact reverse sequence restores both register sets. Control
; then jumps to the RAM epilogue at 0B41H, which restores the caller's mapping and re-enables
; interrupts before returning through the machine's interrupt-return path.
;
; Entry:
;   Entered by the RAM RST 38H stub with the interrupt request still being serviced.
;
; Exit:
;   Returns to 0B41H with the interrupted register context restored.
;
; Effects:
;   Temporarily uses the stack, I/O ports, system variables, and all Z80 register sets.
;
; Destroys:
;   No caller registers; all main and alternate registers are saved and restored.
;
; Note:
;   The physical ROM routine is normally visible at C412H; the CPU reaches it after the RAM stub
;   has selected the standard SYS mapping.
; -----------------------------------------------------------------------------
IRQ_HANDLER:
    LD A,(0003H)
    PUSH AF
    PUSH HL
    PUSH DE
    PUSH BC
    PUSH IX
    PUSH IY

; Exchange to AF' and EXX make the alternate accumulator and register pairs part of the interrupt
; frame.
    EX AF,AF'
    PUSH AF
    EXX
    PUSH HL
    PUSH DE
    PUSH BC

; The complete interrupt service body is isolated behind IRQ_CORE; all register restoration
; follows the call.
    CALL C437H
    POP BC
    POP DE
    POP HL
    EXX
    POP AF
    EX AF,AF'
    POP IY
    POP IX
    POP BC
    POP DE
    POP HL
    POP AF
    JP 0B41H

; Core interrupt handler.
; INT-FLAG is FFH while interrupt work is in progress.

; -----------------------------------------------------------------------------
; SYSTEM INTERRUPT DISPATCH
; -----------------------------------------------------------------------------
;
; Ticks the system clock, services internal device requests, and dispatches expansion-card
; interrupts.
;
; INT-FLAG at 0B20H is set to FFH for the duration of this routine. The two-byte interrupt counter
; at 0B1DH is incremented, and BORDER at 0B4FH is written to port 00H on every interrupt so the
; configured border colour is continuously enforced.
;
; Port 59H reports the interrupt sources with active-low status bits. Bit 4 identifies the
; cursor/sound request; it is acknowledged by setting the corresponding bit in the value sent to
; port 07H. C47DH handles the internal video, keyboard, editor, and sound work according to the
; active-low INT-DES mask at 0B10H.
;
; The lower four status bits represent expansion-card requests. IRQ-STAT at 0B1FH supplies the
; card-enable mask. A four-iteration loop rotates the enable and request bits together, writes bit
; 7 to ports 58H-5BH only for cards that both request and are permitted to interrupt, then enters
; the expansion dispatcher at F227H through the common EXT jump at FFF0H.
;
; Entry:
;   Hardware interrupt status at port 59H and device masks in INT-DES/IRQ-STAT.
;
; Exit:
;   All enabled pending interrupt sources have been acknowledged and dispatched.
;
; Effects:
;   Updates INT-FLAG and the interrupt counter; writes border, acknowledge, and card-enable I/O
;   ports.
;
; Destroys:
;   AF, BC, DE, HL internally; IRQ_HANDLER restores the saved context.
;
; Note:
;   The card loop uses D for IRQ-STAT enable bits and H for the active-low card request bits; C
;   remains synchronized with the port number being tested.
; -----------------------------------------------------------------------------
IRQ_CORE:
    LD A,FFH

; Set INTFLAG while servicing an interrupt.
    LD (0B20H),A

; The two-byte interrupt counter at 0B1DH advances once per accepted interrupt.
    LD HL,(0B1DH)

; Increment HL.
    INC HL
    LD (0B1DH),HL

; Load BORDER system variable into A.
; BORDER is written on every interrupt, keeping the configured border colour applied.
    LD A,(0B4FH)
    OUT (00H),A

; Port 59H reports active-low interrupt sources; bit 4 is the cursor/sound request.
    IN A,(59H)
    LD C,A
    BIT 4,A
    SET 4,C

; Clear cursor/sound interrupt.
; Writing port 07H acknowledges the cursor/sound interrupt after its status bit has been
; inspected.
    OUT (07H),A
    CALL Z,C47DH

; OR F0H leaves only the four expansion-card request bits to be tested.
    LD A,C
    OR F0H
    INC A
    JR Z,C478H

; IRQ-STAT supplies the enable mask; its two low bits are reserved for cursor and sound.
    LD A,(0B1FH)
    RRCA
    RRCA
    LD H,C
    LD L,C

; C addresses ports 58H through 5BH while B counts the four expansion-card slots.
    LD BC,0458H
    LD D,A

; A becomes 80H only when the current card is enabled; H carry skips the write when that card did
; not request service.

LC465:
    XOR A
    RRC D
    RRA
    RRC H
    JR C,C46FH
    OUT (C),A

LC46F:
    INC C
    DJNZ C465H

; C is restored before the expansion handoff so the original active-card mask reaches EXT.
    LD C,L
    LD HL,C478H
    JR C4A3H

; INT-FLAG is cleared only after internal and expansion interrupt work has completed.

LC478:
    XOR A
    LD (0B20H),A
    RET

; INT-DES bits are active low and order the built-in devices as video, keyboard, editor, sound
; when rotated.

; -----------------------------------------------------------------------------
; INTERNAL DEVICE INTERRUPTS
; -----------------------------------------------------------------------------
;
; Runs the interrupt-time function 0 of the built-in video, keyboard, editor, and sound devices.
;
; INT-DES at 0B10H is active low and orders the devices from bit 7 to bit 0 as expansion cards 3
; through 0, sound, editor, keyboard, and video. This routine rotates the mask four times so the
; internal devices are visited in video, keyboard, editor, sound order.
;
; For each active device, the device number is converted into B and C=00H is selected as the
; interrupt-time function. Four copies of the C499H return address are placed on the stack before
; entering the normal device-function dispatcher at C3D8H. That makes the ordinary jump-table
; mechanism usable without losing the loop state.
;
; Function 0 performs no video work, scans the keyboard and updates the key/repeat state, blinks
; the editor cursor, or advances and eventually stops a timed sound. The saved mapping and loop
; registers are recovered after each device call.
;
; Entry:
;   INT-DES at 0B10H; the internal-device interrupt mask is active low.
;
; Exit:
;   Each requested internal device has received function 0.
;
; Effects:
;   Calls device jump tables and temporarily changes the paging configuration through the common
;   dispatcher.
;
; Destroys:
;   AF, BC, DE, HL internally; the caller's interrupt frame is preserved.
; -----------------------------------------------------------------------------
INTERNAL_IRQ_DISPATCH:
    PUSH BC
    LD A,(0B10H)
    LD C,A
    LD B,04H

; A zero carry from RR C identifies an internal device that must receive function 0.

LC484:
    RR C
    PUSH BC
    JR C,C499H

; Subtracting the loop count converts the four-pass counter into device numbers 0 through 3.
    LD A,04H
    SUB B
    LD B,A
    LD C,00H

; Four copies of the return continuation protect the stack while the normal device dispatcher
; runs.
    LD HL,C499H
    PUSH HL
    PUSH HL
    PUSH HL
    PUSH HL
    JP C3D8H

; Restore the normal U U U S mapping before testing the next internal device.

LC499:
    LD A,70H
    OUT (02H),A
    POP BC
    DJNZ C484H
    LD HL,C4AAH

; F227H in EXT receives the active expansion-card interrupt mask in C.

; -----------------------------------------------------------------------------
; EXPANSION INTERRUPT HANDOFF
; -----------------------------------------------------------------------------
;
; Transfers pending expansion-card interrupt service to the EXT ROM dispatcher.
;
; After the four internal device slots have been considered, the lower four bits of C still
; contain the original active-low expansion request mask. C4A3 pushes the common return address,
; loads F227H, the EXT ROM entry for card interrupt service, and jumps through FFF0H.
;
; The EXT dispatcher selects each requested card, maps its memory into the appropriate page, and
; calls the routine address stored at the card's 0C00EH-0C00FH entry. On return it restores the
; previous mapping and eventually returns to C4AAH, where C is recovered and the system interrupt
; routine finishes.
;
; Entry:
;   C low four bits contain pending expansion-card requests; HL points at the internal return
;   continuation.
;
; Exit:
;   Control returns after EXT has serviced the requested cards.
;
; Effects:
;   May page expansion memory and execute code outside SYS.
;
; Destroys:
;   EXT-specific working registers; the SYS interrupt frame is restored by the outer handler.
; -----------------------------------------------------------------------------
EXPANSION_IRQ_DISPATCH:
    PUSH HL
    LD HL,F227H
    JP FFF0H
    POP BC
    RET

; Kernel routine jump table; first byte is the routine count, followed by routine addresses.
; The kernel table contains five entries; function 0 is the required RET placeholder.

; -----------------------------------------------------------------------------
; KERNEL FUNCTION TABLE
; -----------------------------------------------------------------------------
;
; Counted jump table for the five kernel-class operating-system functions.
;
; The first byte is 05H, followed by five little-endian addresses. Function 0 is C509H, a RET-only
; placeholder reserved by the uniform interrupt-function convention. Functions 1 through 4 are
; HI-MEM-SET, SLOT-ASN, IO-ASN, and SLOT-NUM at C4B7H, C4D0H, C4E2H, and C50EH.
;
; Kernel calls are class 7 calls in the RST 30H operating-system encoding. They are not redirected
; through the ordinary input/output assignment tables; the dispatcher reaches this table directly.
;
; Entry:
;   Function index selected by the RST 30H dispatcher.
;
; Exit:
;   A target address for the selected kernel function.
;
; Effects:
;   Read-only table; no state changes.
;
; Note:
;   The two-byte entry at C4ADH is intentionally present even though function 0 does no work.
; -----------------------------------------------------------------------------
KERNEL_JUMP_TABLE:
    DB 05H, 09H, C5H, B7H, C4H, D0H, C4H, E2H, C4H, 0EH, C5H                        ; |...........|

; HI_MEM_SET (KERNEL 01) expects the number of bytes to reserve above HI_MEM in DE; on success DE
; returns the new HI_MEM+1, on failure A returns FBh.
; HI-MEM-SET reserves memory downward and leaves 1EACH bytes below the new boundary.

; -----------------------------------------------------------------------------
; KERNEL 01 - HI-MEM-SET
; -----------------------------------------------------------------------------
;
; Reserves a requested block below the BASIC high-memory limit while preserving stack space.
;
; DE supplies the number of bytes to reserve. The routine subtracts that size from HI-MEM at 0B19H
; and rejects the request with error FBH if it crosses below the current limit.
;
; A second subtraction checks that at least 1EACH bytes remain. This is the protected lower
; boundary, leaving approximately 2 KiB for the system stack and its required safety margin. If
; the check passes, the new HI-MEM is stored and DE returns one byte above it, the start of the
; reserved area.
;
; The carry flag is used as the fast failure path, while A is initialized to FBH before either
; check and is cleared only on success.
;
; Entry:
;   DE = requested byte count; HI-MEM at 0B19H is the current upper limit.
;
; Exit:
;   DE = first address of the reserved area, A=00H on success or A=FBH on failure.
;
; Effects:
;   Updates HI-MEM at 0B19H only when the request is accepted.
;
; Destroys:
;   HL and flags; DE is replaced by the returned start address.
; -----------------------------------------------------------------------------
HI_MEM_SET:
    LD HL,(0B19H)
    LD A,FBH
    OR A
    SBC HL,DE
    RET C
    PUSH HL
    LD DE,1EACH
    SBC HL,DE
    POP HL
    RET C
    LD D,H
    LD E,L
    INC DE
    LD (0B19H),HL
    XOR A
    RET

; SLOT-ASN chooses the class-6 input table at 0B07H or output table at 0B0FH from B.

; -----------------------------------------------------------------------------
; KERNEL 02 - SLOT-ASN
; -----------------------------------------------------------------------------
;
; Assigns a named expansion-card unit to the class-6 input or output slot.
;
; DE points to the length-prefixed card identifier, C is the unit number on that card, and B
; selects the table: B=FFH requests input assignment, any other B requests output assignment. The
; routine chooses the corresponding class-6 entry at 0B07H or 0B0FH.
;
; SLOT_NUM at C50EH searches the four expansion-card descriptors and returns the card's physical
; slot. If no matching card and unit exist, A=FDH is returned. Otherwise C is stored into the
; selected assignment entry and A=00H indicates success.
;
; Entry:
;   DE = card identifier; C = card unit; B = FFH for input or another value for output.
;
; Exit:
;   A=00H and the class-6 assignment is updated, or A=FDH when the card is absent.
;
; Effects:
;   Writes one byte in the input or output assignment table.
;
; Destroys:
;   HL and flags; DE and BC are used as parameters and are not promised on exit.
; -----------------------------------------------------------------------------
SLOT_ASN:
    LD HL,0B07H
    INC B
    JR Z,C4D9H
    LD HL,0B0FH

LC4D9:
    PUSH HL
    CALL C50EH
    POP HL
    OR A
    RET NZ
    LD (HL),C
    RET

; IO-ASN rejects class, device, and FFH unassigned entries before writing the assignment byte.

; -----------------------------------------------------------------------------
; KERNEL 03 - IO-ASN
; -----------------------------------------------------------------------------
;
; Changes the device assigned to an input or output function class.
;
; B supplies the function class (0 through 6), C the desired device number, and D selects the
; input table when FFH or the output table otherwise. The routine locates the class entry in the
; selected table, verifies that the class and device are valid, and rejects FFH assignment
; entries.
;
; On success the selected input/output slot is overwritten with C and A=00H is returned. Invalid
; class, unassigned class, out-of-range device, or unassigned device produces A=FEH without
; changing the table.
;
; Entry:
;   B = function class; C = device number; D = FFH for input, otherwise output.
;
; Exit:
;   A=00H on success or A=FEH on assignment error.
;
; Effects:
;   May update one byte in the input or output assignment table.
;
; Destroys:
;   DE, HL and flags; BC carries the request and is not promised on exit.
; -----------------------------------------------------------------------------
IO_ASN:
    LD HL,0B00H
    INC D
    JR Z,C4EBH
    LD HL,0B08H

LC4EB:
    PUSH HL
    LD A,06H
    CP B
    JR C,C50AH
    LD E,B
    LD D,00H
    ADD HL,DE
    LD E,(HL)
    INC E
    JR Z,C50AH
    POP DE
    PUSH HL
    EX DE,HL
    CP C
    JR C,C50AH
    LD E,C
    XOR A
    LD D,A
    ADD HL,DE
    LD E,(HL)
    INC E
    JR Z,C50AH
    POP HL
    LD (HL),C
    RET

LC50A:
    POP HL
    LD A,FEH
    RET

; Four card descriptors are spaced 30H bytes apart from IX=0040H.

; -----------------------------------------------------------------------------
; KERNEL 04 - SLOT-NUM
; -----------------------------------------------------------------------------
;
; Finds the physical expansion-card slot containing a named card unit.
;
; DE points to the card's length-prefixed identifier and C supplies its unit number. Four card
; descriptors are searched at IX=0040H, then IX+0030H, IX+0060H, and IX+0090H. Each descriptor
; begins with the identifier and carries its unit-number field at offset seven.
;
; A matching identifier and unit return A=00H, C=the zero-based slot number (0 through 3), and IX
; pointing at the matching card's I/O buffer. If all four descriptors differ, A=FDH is returned.
;
; Entry:
;   DE = card identifier; C = unit number (normally 0 through 3).
;
; Exit:
;   A=00H, C=slot number, IX=matching descriptor/buffer; or A=FDH if absent.
;
; Effects:
;   Read-only search of the U0 expansion-card descriptor area.
;
; Destroys:
;   AF, BC, DE, HL, IX and flags; only the documented result registers are meaningful.
; -----------------------------------------------------------------------------
SLOT_NUM:
    PUSH DE
    LD IX,0040H
    LD B,04H

LC515:
    PUSH IX
    POP HL
    PUSH BC
    LD A,(DE)
    INC A
    LD B,A

LC51C:
    LD A,(DE)
    CP (HL)
    JR NZ,C537H
    INC HL
    INC DE
    DJNZ C51CH
    POP BC
    PUSH IX
    POP HL

; Descriptor offset seven contains the card unit number used with the identifier comparison.
    LD DE,0007H
    ADD HL,DE
    LD A,(HL)
    CP C
    JR NZ,C538H

; A=04H minus the restored slot counter yields the zero-based physical slot number.
    LD A,04H
    SUB B
    LD C,A
    XOR A

LC535:
    POP DE
    RET

LC537:
    POP BC

LC538:
    LD DE,0030H
    ADD IX,DE
    POP DE
    PUSH DE
    DJNZ C515H
    LD A,FDH
    JR C535H

; Initial values for the 6845 video controller registers after reset.
; Sixteen bytes initialize CRTC registers R0 through R15 via ports 70H/71H.

; -----------------------------------------------------------------------------
; 6845 CRT CONTROLLER RESET VALUES
; -----------------------------------------------------------------------------
;
; Sixteen initial values written to the Motorola 6845-compatible CRT controller registers.
;
; The reset code selects controller registers 0 through 15 through port 70H and writes these bytes
; through port 71H: FFH, 0EH, 00H, 00H, 03H, 03H, 03H, 00H, 42H, 3CH, 02H, 4DH, 32H, 4BH, 40H,
; 63H.
;
; The table is ordered by CRTC register number, not by a software structure. Its values establish
; the TV timing, displayed character width/height, sync positions, and display start state used
; before the video OS takes over.
;
; Entry:
;   Consumed by the reset loop at C24EH-C25BH.
;
; Exit:
;   No direct return value; hardware registers are initialized.
;
; Effects:
;   Indirectly programs the CRT controller when the reset loop writes the table.
; -----------------------------------------------------------------------------
CRTC_RESET_VALUES:
    DB FFH, 0EH, 00H, 00H, 03H, 03H, 03H, 00H, 42H, 3CH, 02H, 4DH, 32H, 4BH, 40H, 63H ; |........B<.M2K@c|

; Startup initialization routine table: sets four-color mode, initializes keyboard, RET,
; initializes cassette workspace.
; Startup calls the four pointers in order: video, keyboard, sound, and cassette initialization.

; -----------------------------------------------------------------------------
; STARTUP DEVICE INITIALIZATION TABLE
; -----------------------------------------------------------------------------
;
; Four routine pointers used to initialize the built-in video, keyboard, sound, and cassette
; devices.
;
; The table contains C9F2H, D5ECH, D960H, and D9E2H. Reset iterates over these pointers with C=the
; mapping byte 70H and invokes each routine through C321H, allowing the same startup loop to
; initialize the devices in a uniform way.
;
; The first entry enters SET_4_COLOR_MODE, the second initializes the keyboard, the third is the
; sound initialization entry, and the fourth establishes cassette state. The values are pointers
; rather than calls so the reset code can keep the common paging and stack protocol in one place.
;
; Entry:
;   Read by the reset initialization loop at C2EFH.
;
; Exit:
;   Device initializers are called in table order.
;
; Effects:
;   Indirectly initializes video, keyboard, sound, and cassette state.
; -----------------------------------------------------------------------------
STARTUP_DEVICE_INIT_TABLE:
    DB F2H, C9H, ECH, D5H, 60H, D9H, E2H, D9H                                       ; |....`...|

; Class pointers: video, keyboard, editor, sound, printer, cassette, expansion placeholder,
; kernel.

; -----------------------------------------------------------------------------
; DEVICE FUNCTION TABLE POINTERS
; -----------------------------------------------------------------------------
;
; Main table that maps the eight RST 30H function classes to their counted device jump tables.
;
; The eight little-endian pointers are the tables for video (C974H), keyboard (D5E3H), editor
; (CF98H), sound (D92AH), printer (D8FFH), cassette (D9BBH), expansion (0000H), and kernel
; (C4ACH). The 0000H expansion entry is a deliberate placeholder because expansion cards supply
; their own table through the EXT path.
;
; RST30_DISPATCH uses the class bits of the function code to index this table. Keeping all device
; table addresses together lets the common dispatcher apply the same count-and-function-number
; protocol to built-in and extension-backed devices.
;
; Entry:
;   Class number selected by the RST 30H dispatcher.
;
; Exit:
;   Pointer to the selected counted jump table.
;
; Effects:
;   Read-only table.
; -----------------------------------------------------------------------------
DEVICE_JUMP_TABLE_POINTERS:
    DB 74H, C9H, E3H, D5H, 98H, CFH, 2AH, D9H, FFH, D8H, BBH, D9H, 00H, 00H, ACH, C4H ; |t.....*.........|

; OUT_CHARS_SAFE checks HI-MEM before invoking the selected device once per source byte.

; -----------------------------------------------------------------------------
; BOUNDED BLOCK OUTPUT HELPER
; -----------------------------------------------------------------------------
;
; Checks the BASIC high-memory boundary, invokes a device byte-output routine, and advances
; through a block.
;
; The caller supplies BC as the number of bytes, DE as the source address, and HL as the device
; routine. The helper first verifies the source range against HI-MEM at 0B19H and returns FAH if
; the requested block would cross it.
;
; On each iteration C receives the next byte, DE/HL are exchanged as required by the calling
; convention, and C58EH performs the indirect CALL (HL). A non-zero device error is returned
; immediately; otherwise CPI advances HL and decrements BC until the count is exhausted.
;
; Entry:
;   BC = byte count; DE = memory source; HL = device output routine.
;
; Exit:
;   A=00H on completion, FAH on high-memory violation, or the device's non-zero error code.
;
; Effects:
;   Reads the caller's memory block and calls the selected device for every byte.
;
; Destroys:
;   AF, BC, DE, HL and flags.
; -----------------------------------------------------------------------------
OUT_CHARS_SAFE:
    DB EBH, E5H, D5H, C5H, E5H, D5H                                                 ; |......|
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

; The synthetic stack continuation makes JP (HL) at C58EH behave as an indirect CALL.
    CALL C58EH
    POP BC
    POP DE
    POP HL
    OR A
    RET NZ
    CPI
    RET PO
    JR C56EH

; -----------------------------------------------------------------------------
; INDIRECT CALL PRIMITIVE
; -----------------------------------------------------------------------------
;
; Transfers control to the address held in HL for the block-I/O helpers.
;
; The helper routines cannot use an ordinary CALL with a variable target. C58EH is the shared
; two-byte primitive that performs JP (HL); the surrounding stack layout makes that non-returning
; jump behave as a call and resumes at the continuation after the target executes RET.
;
; Entry:
;   HL = target routine address; the stack contains the synthetic return continuation.
;
; Exit:
;   Target routine runs and returns to the helper continuation.
;
; Effects:
;   Transfers control indirectly; no fixed device semantics are imposed here.
; -----------------------------------------------------------------------------
CALL_HL:
    JP (HL)

; IN_CHARS_SAFE mirrors OUT_CHARS_SAFE and writes each successful device byte to the destination
; block.

; -----------------------------------------------------------------------------
; BOUNDED BLOCK INPUT HELPER
; -----------------------------------------------------------------------------
;
; Invokes a device byte-input routine repeatedly while protecting the high-memory boundary.
;
; BC is the requested byte count, DE the destination address, and HL the device input routine.
; Before each byte the helper checks DE against HI-MEM and returns FAH if the destination would
; exceed the usable area.
;
; The device result is returned in A. On success the byte is stored at (DE), the destination is
; advanced, and the count is decremented. A non-zero device error stops the operation and restores
; the saved caller registers.
;
; Entry:
;   BC = byte count; DE = destination; HL = device input routine.
;
; Exit:
;   A=00H on completion, FAH on boundary violation, or a device error; bytes are stored at DE
;   onward.
;
; Effects:
;   Writes the input block to caller memory and invokes the selected device for every byte.
;
; Destroys:
;   AF, BC, DE, HL and flags.
; -----------------------------------------------------------------------------
IN_CHARS_SAFE:
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
    CALL C58EH
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
    JR C58FH

; Built-in character matrix table for character codes 32-127, ten bytes per character.
; Ninety-six fixed glyphs, character codes 20H-7FH, occupy ten bytes per character.

; -----------------------------------------------------------------------------
; FIXED 8-BY-10 CHARACTER MATRIX
; -----------------------------------------------------------------------------
;
; The built-in 96-character glyph set for character codes 20H through 7FH.
;
; Each character occupies ten bytes. The first eight bytes are the visible 8-bit raster rows; the
; remaining two bytes provide the blank vertical spacing used by the character renderer. The table
; therefore occupies 960 bytes and ends immediately before VIDEO_JUMP_TABLE at C974H.
;
; The set covers ASCII space through DEL, including punctuation, digits, upper- and lower-case
; letters, and the TVC cursor glyph at code 7FH. The video character-output routine indexes this
; table after selecting the high-bit character bank for the alternate TVC glyph range.
;
; Entry:
;   Character code used as an index, with ten bytes per entry.
;
; Exit:
;   A ten-byte raster consumed by the video character renderer.
;
; Effects:
;   Read-only ROM data.
; -----------------------------------------------------------------------------
FIXED_CHARACTER_GLYPHS:
    DB 00H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 18H, 18H, 18H, 18H, 18H ; |................|
    DB 00H, 18H, 00H, 00H, 00H, 36H, 36H, 36H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 36H ; |.....666.......6|
    DB 36H, 7FH, 36H, 7FH, 36H, 36H, 00H, 00H, 00H, 18H, 3EH, 58H, 3CH, 1AH, 7CH, 18H ; |6.6.66....>X<.|.|
    DB 00H, 00H, 00H, 60H, 66H, 0CH, 18H, 30H, 66H, 06H, 00H, 00H, 00H, 10H, 28H, 28H ; |...`f..0f.....((|
    DB 30H, 54H, 48H, 34H, 00H, 00H, 00H, 18H, 18H, 30H, 00H, 00H, 00H, 00H, 00H, 00H ; |0TH4.....0......|
    DB 00H, 0CH, 18H, 30H, 30H, 30H, 18H, 0CH, 00H, 00H, 00H, 30H, 18H, 0CH, 0CH, 0CH ; |...000.....0....|
    DB 18H, 30H, 00H, 00H, 00H, 00H, 10H, 54H, 38H, 38H, 54H, 10H, 00H, 00H, 00H, 00H ; |.0.....T88T.....|
    DB 18H, 18H, 7EH, 18H, 18H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 18H, 18H ; |..~.............|
    DB 30H, 00H, 00H, 00H, 00H, 00H, 7CH, 7CH, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 00H ; |0.....||........|
    DB 00H, 00H, 18H, 18H, 00H, 00H, 00H, 00H, 06H, 0CH, 18H, 30H, 60H, 00H, 00H, 00H ; |...........0`...|
    DB 00H, 3CH, 66H, 6EH, 7EH, 76H, 66H, 3CH, 00H, 00H, 00H, 18H, 38H, 18H, 18H, 18H ; |.<fn~vf<....8...|
    DB 18H, 18H, 00H, 00H, 00H, 3CH, 66H, 06H, 1CH, 30H, 60H, 7EH, 00H, 00H, 00H, 7EH ; |.....<f..0`~...~|
    DB 06H, 0CH, 1CH, 06H, 46H, 3CH, 00H, 00H, 00H, 0CH, 1CH, 2CH, 4CH, 7EH, 0CH, 0CH ; |....F<.....,L~..|
    DB 00H, 00H, 00H, 7EH, 60H, 7CH, 06H, 06H, 46H, 3CH, 00H, 00H, 00H, 3CH, 60H, 60H ; |...~`|..F<...<``|
    DB 7CH, 66H, 66H, 3CH, 00H, 00H, 00H, 7EH, 06H, 0CH, 18H, 30H, 60H, 60H, 00H, 00H ; ||ff<...~...0``..|
    DB 00H, 3CH, 66H, 66H, 3CH, 66H, 66H, 3CH, 00H, 00H, 00H, 3CH, 66H, 66H, 3EH, 06H ; |.<ff<ff<...<ff>.|
    DB 0CH, 38H, 00H, 00H, 00H, 00H, 00H, 18H, 18H, 00H, 18H, 18H, 00H, 00H, 00H, 00H ; |.8..............|
    DB 00H, 18H, 18H, 00H, 18H, 18H, 30H, 00H, 00H, 06H, 0CH, 18H, 30H, 18H, 0CH, 06H ; |......0.....0...|
    DB 00H, 00H, 00H, 00H, 00H, 7CH, 00H, 7CH, 00H, 00H, 00H, 00H, 00H, 30H, 18H, 0CH ; |.....|.|.....0..|
    DB 06H, 0CH, 18H, 30H, 00H, 00H, 00H, 3CH, 66H, 06H, 0CH, 18H, 00H, 18H, 00H, 00H ; |...0...<f.......|
    DB 00H, 3EH, 63H, 67H, 6BH, 6FH, 60H, 3CH, 00H, 00H, 00H, 1CH, 3EH, 63H, 63H, 7FH ; |.>cgko`<....>cc.|
    DB 63H, 63H, 00H, 00H, 00H, 7EH, 63H, 63H, 7EH, 63H, 63H, 7EH, 00H, 00H, 00H, 3EH ; |cc...~cc~cc~...>|
    DB 63H, 60H, 60H, 60H, 63H, 3EH, 00H, 00H, 00H, 7EH, 33H, 33H, 33H, 33H, 33H, 7EH ; |c```c>...~33333~|
    DB 00H, 00H, 00H, 7EH, 60H, 60H, 7CH, 60H, 60H, 7EH, 00H, 00H, 00H, 7EH, 60H, 60H ; |...~``|``~...~``|
    DB 7CH, 60H, 60H, 60H, 00H, 00H, 00H, 3EH, 63H, 60H, 60H, 67H, 63H, 3EH, 00H, 00H ; ||```...>c``gc>..|
    DB 00H, 63H, 63H, 63H, 7FH, 63H, 63H, 63H, 00H, 00H, 00H, 3CH, 18H, 18H, 18H, 18H ; |.ccc.ccc...<....|
    DB 18H, 3CH, 00H, 00H, 00H, 06H, 06H, 06H, 06H, 66H, 66H, 3CH, 00H, 00H, 00H, 63H ; |.<.......ff<...c|
    DB 66H, 6CH, 78H, 6CH, 66H, 63H, 00H, 00H, 00H, 60H, 60H, 60H, 60H, 60H, 60H, 7EH ; |flxlfc...``````~|
    DB 00H, 00H, 00H, 63H, 77H, 6BH, 63H, 63H, 63H, 63H, 00H, 00H, 00H, 66H, 66H, 76H ; |...cwkcccc...ffv|
    DB 6EH, 66H, 66H, 66H, 00H, 00H, 00H, 3EH, 63H, 63H, 63H, 63H, 63H, 3EH, 00H, 00H ; |nfff...>ccccc>..|
    DB 00H, 7EH, 63H, 63H, 7EH, 60H, 60H, 60H, 00H, 00H, 00H, 3EH, 63H, 63H, 63H, 6BH ; |.~cc~```...>ccck|
    DB 67H, 3EH, 01H, 00H, 00H, 7EH, 63H, 63H, 7EH, 6CH, 66H, 63H, 00H, 00H, 00H, 3EH ; |g>...~cc~lfc...>|
    DB 63H, 60H, 3EH, 03H, 63H, 3EH, 00H, 00H, 00H, 7EH, 5AH, 18H, 18H, 18H, 18H, 18H ; |c`>.c>...~Z.....|
    DB 00H, 00H, 00H, 63H, 63H, 63H, 63H, 63H, 63H, 3EH, 00H, 00H, 00H, 63H, 63H, 63H ; |...cccccc>...ccc|
    DB 63H, 36H, 1CH, 08H, 00H, 00H, 00H, 63H, 63H, 63H, 6BH, 6BH, 3EH, 14H, 00H, 00H ; |c6.....ccckk>...|
    DB 00H, 66H, 66H, 3CH, 18H, 3CH, 66H, 66H, 00H, 00H, 00H, 66H, 66H, 3CH, 18H, 18H ; |.ff<.<ff...ff<..|
    DB 18H, 18H, 00H, 00H, 00H, 7EH, 06H, 0CH, 18H, 30H, 60H, 7EH, 00H, 00H, 00H, 3CH ; |.....~...0`~...<|
    DB 30H, 30H, 30H, 30H, 30H, 3CH, 00H, 00H, 00H, 00H, 60H, 30H, 18H, 0CH, 06H, 00H ; |00000<....`0....|
    DB 00H, 00H, 00H, 3CH, 0CH, 0CH, 0CH, 0CH, 0CH, 3CH, 00H, 00H, 00H, 18H, 3CH, 66H ; |...<.....<....<f|
    DB 42H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 7EH, 00H, 00H ; |B............~..|
    DB 00H, 30H, 30H, 18H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 00H, 3CH, 06H, 3EH ; |.00..........<.>|
    DB 66H, 3EH, 00H, 00H, 00H, 60H, 60H, 7CH, 66H, 66H, 66H, 7CH, 00H, 00H, 00H, 00H ; |f>...``|fff|....|
    DB 00H, 1EH, 30H, 30H, 30H, 1EH, 00H, 00H, 00H, 06H, 06H, 3EH, 66H, 66H, 66H, 3EH ; |..000......>fff>|
    DB 00H, 00H, 00H, 00H, 00H, 3CH, 66H, 7EH, 60H, 3CH, 00H, 00H, 00H, 0CH, 18H, 18H ; |.....<f~`<......|
    DB 3CH, 18H, 18H, 18H, 00H, 00H, 00H, 00H, 00H, 3EH, 66H, 66H, 66H, 3EH, 06H, 3CH ; |<........>fff>.<|
    DB 00H, 60H, 60H, 7CH, 66H, 66H, 66H, 66H, 00H, 00H, 00H, 18H, 00H, 38H, 18H, 18H ; |.``|ffff.....8..|
    DB 18H, 3CH, 00H, 00H, 00H, 18H, 00H, 38H, 18H, 18H, 18H, 18H, 18H, 70H, 00H, 60H ; |.<.....8.....p.`|
    DB 60H, 66H, 6CH, 78H, 6CH, 66H, 00H, 00H, 00H, 18H, 18H, 18H, 18H, 18H, 18H, 18H ; |`flxlf..........|
    DB 00H, 00H, 00H, 00H, 00H, 76H, 6BH, 6BH, 6BH, 6BH, 00H, 00H, 00H, 00H, 00H, 7CH ; |.....vkkkk.....||
    DB 66H, 66H, 66H, 66H, 00H, 00H, 00H, 00H, 00H, 3CH, 66H, 66H, 66H, 3CH, 00H, 00H ; |ffff.....<fff<..|
    DB 00H, 00H, 00H, 7CH, 66H, 66H, 66H, 7CH, 60H, 60H, 00H, 00H, 00H, 3EH, 66H, 66H ; |...|fff|``...>ff|
    DB 66H, 3EH, 06H, 06H, 00H, 00H, 00H, 36H, 38H, 30H, 30H, 30H, 00H, 00H, 00H, 00H ; |f>.....68000....|
    DB 00H, 1EH, 30H, 1CH, 06H, 3CH, 00H, 00H, 00H, 18H, 18H, 3CH, 18H, 18H, 18H, 0CH ; |..0..<.....<....|
    DB 00H, 00H, 00H, 00H, 00H, 66H, 66H, 66H, 66H, 3EH, 00H, 00H, 00H, 00H, 00H, 66H ; |.....ffff>.....f|
    DB 66H, 66H, 3CH, 18H, 00H, 00H, 00H, 00H, 00H, 63H, 63H, 6BH, 3EH, 14H, 00H, 00H ; |ff<......cck>...|
    DB 00H, 00H, 00H, 66H, 3CH, 18H, 3CH, 66H, 00H, 00H, 00H, 00H, 00H, 66H, 66H, 66H ; |...f<.<f.....fff|
    DB 66H, 3EH, 06H, 3CH, 00H, 00H, 00H, 7EH, 0CH, 18H, 30H, 7EH, 00H, 00H, 00H, 0EH ; |f>.<...~..0~....|
    DB 18H, 18H, 70H, 18H, 18H, 0EH, 00H, 00H, 00H, 18H, 18H, 18H, 00H, 18H, 18H, 18H ; |..p.............|
    DB 00H, 00H, 00H, 70H, 18H, 18H, 0EH, 18H, 18H, 70H, 00H, 00H, 00H, 00H, 00H, 33H ; |...p.....p.....3|
    DB 6BH, 66H, 00H, 00H, 00H, 00H, 00H, 7EH, 7EH, 7EH, 7EH, 7EH, 7EH, 7EH, 00H, 00H ; |kf.....~~~~~~~..|

; VIDEO routine jump table; first byte is the routine count, followed by routine addresses.
; The video table has 13 callable functions; function 0 is the interrupt placeholder RET.

; -----------------------------------------------------------------------------
; VIDEO FUNCTION TABLE
; -----------------------------------------------------------------------------
;
; Counted jump table for the thirteen built-in video operating-system functions.
;
; The count byte is 0DH. The entries are the interrupt placeholder C9A9H, character output CC94H,
; block output CC86H, character positioning CF4BH, video mode C9F4H, clear screen CA49H, absolute
; pen movement CADAH, relative pen movement CAD7H, pen down CBF3H, pen up CBFFH, paint CD48H,
; character definition CF2CH, and palette definition CA38H.
;
; The common RST 30H dispatcher obtains this table through DEVICE_JUMP_TABLE_POINTERS. The first
; entry is reserved for function 0, which is used by the interrupt dispatcher and is a RET because
; the video device has no periodic interrupt work of its own.
;
; Entry:
;   Video function number selected by the operating-system dispatcher.
;
; Exit:
;   Target address for the selected video operation.
;
; Effects:
;   Read-only table.
; -----------------------------------------------------------------------------
VIDEO_JUMP_TABLE:
    DB 0DH, A9H, C9H, 94H, CCH, 86H, CCH, 4BH, CFH, F4H, C9H, 49H, CAH, DAH, CAH, D7H ; |.......K...I....|
    DB CAH, F3H, CBH, FFH, CBH, 48H, CDH, 2CH, CFH, 38H, CAH                        ; |.....H.,.8.|

; Video routines run with the video-memory mapping selected and P-SAVE preserved.

; CALL_WITH_SYS_PAGED - Pages SYS into page 3, invokes the routine in HL, then restores paging.
; Entry: HL = target routine; target must finish with RET
; Exit: Target-specific
; Effects: Temporarily changes the memory map and return address.
CALL_WITH_SYS_PAGED:
; -----------------------------------------------------------------------------
; VIDEO-MEMORY PAGING WRAPPER
; -----------------------------------------------------------------------------
;
; Maps the video-memory configuration, calls a routine in SYS, and restores the caller's paging
; state.
;
; The return address is taken from the stack and the current P-SAVE byte at 0003H is preserved.
; The wrapper writes 50H to the memory-map port, selecting the video-memory configuration while
; retaining SYS for the executing code, then arranges C9A1H as the continuation after the target's
; RET.
;
; The called video routine can use the mapped video memory without needing to know or preserve the
; caller's mapping. C9A1H restores the saved P-SAVE value and returns to the caller through the
; original stack address. This wrapper is the protection boundary used by the graphics routines
; that access video RAM.
;
; Entry:
;   HL = video routine address; the target must return with RET.
;
; Exit:
;   Target-specific result after the original paging value has been restored.
;
; Effects:
;   Temporarily changes port 02H and P-SAVE at 0003H.
;
; Destroys:
;   AF and the temporary stack frame; the called routine determines other register effects.
; -----------------------------------------------------------------------------
CALL_WITH_VIDEO_PAGED:
; -----------------------------------------------------------------------------
; VIDEO RAM PAGING GUARD
; -----------------------------------------------------------------------------
;
; Temporarily maps video RAM, then arranges for the caller's RET to restore the original mapping.
;
; This is the video driver's central paging wrapper. It removes the caller's return address, saves
; the current page configuration, selects U-U-V-S so the video RAM is visible at 8000H, and
; replaces the saved return address with VIDEO_PAGE_RESTORE at C9A1H.
;
; The caller therefore runs with the video page selected and returns into the restore tail. That
; tail restores the saved page register while preserving the caller's A result, then returns to
; the caller's caller. The unusual return-address surgery lets deeply nested video routines share
; one small paging mechanism.
;
; Entry:
;   Called with a normal return address on the stack.
;
; Exit:
;   The caller resumes with video RAM visible; its eventual RET restores the previous mapping.
;
; Effects:
;   Changes port 02H paging and uses the stack to splice VIDEO_PAGE_RESTORE into the return path.
;
; Destroys:
;   AF is preserved across the restore tail; HL and the stack are used internally.
;
; Note:
;   VIDEO 00 is just the restore-tail RET at C9A9H. The wrapper is used by drawing, text output,
;   paint, and cursor routines.
; -----------------------------------------------------------------------------
VIDEO_PAGE_GUARD:
    POP HL
    LD A,(0003H)
    PUSH AF
    LD A,50H
    LD (0003H),A
    OUT (02H),A
    PUSH HL
    LD HL,C9A1H
    EX (SP),HL
    JP (HL)

; This continuation restores P-SAVE and port 02H after the mapped video routine returns.

; -----------------------------------------------------------------------------
; VIDEO PAGING WRAPPER RETURN
; -----------------------------------------------------------------------------
;
; Restores the saved memory map after a video routine returns.
;
; C98FH arranges a return through this continuation. The alternate accumulator holds the saved
; paging value while the target routine runs; C9A1H exchanges back, restores AF and P-SAVE, writes
; port 02H, and returns through the caller's original address.
;
; Entry:
;   Saved paging value in the stack/alternate accumulator as established by C98FH.
;
; Exit:
;   Original caller mapping and return address restored.
;
; Effects:
;   Writes P-SAVE and port 02H.
; -----------------------------------------------------------------------------
VIDEO_PAGE_RETURN:
    EX AF,AF'
    POP AF
    LD (0003H),A
    OUT (02H),A
    EX AF,AF'
    RET

; Double the selector because each jump-table entry is a little-endian word.

; JUMP_TABLE_DISPATCH - Selects a target from a ROM jump table.
; Entry: Table and selector are caller-specific
; Effects: Transfers control to the selected entry.
JUMP_TABLE_DISPATCH:
; -----------------------------------------------------------------------------
; WORD JUMP-TABLE LOOKUP
; -----------------------------------------------------------------------------
;
; Reads the address of entry A from a table of little-endian word pointers at HL.
;
; The selector in A is doubled because every table entry is a two-byte address. The resulting
; offset is added to HL, the low and high bytes are read, and DE returns the selected target
; address. The source table and selector are intentionally generic so the helper can serve several
; video subsystems.
;
; Entry:
;   HL = first table entry; A = zero-based entry number.
;
; Exit:
;   DE = selected little-endian target address.
;
; Effects:
;   Read-only table access.
;
; Destroys:
;   AF and HL; DE contains the result.
; -----------------------------------------------------------------------------
JUMP_TABLE_LOOKUP:
; -----------------------------------------------------------------------------
; WORD JUMP-TABLE LOOKUP
; -----------------------------------------------------------------------------
;
; Loads the A-th two-byte entry from the table addressed by HL into DE.
;
; The index is doubled, added to HL, and the little-endian word at that address is returned in DE.
; Video line-direction dispatch and line-crossing dispatch both use this compact helper.
;
; Entry:
;   HL = table base; A = zero-based entry number.
;
; Exit:
;   DE = selected table word.
;
; Effects:
;   HL is advanced to the selected entry; flags follow the arithmetic.
;
; Destroys:
;   AF, HL; DE receives the result.
; -----------------------------------------------------------------------------
TABLE_LOOKUP_WORD:
    ADD A,A
    LD E,A
    LD D,00H
    ADD HL,DE
    LD E,(HL)
    INC HL
    LD D,(HL)
    RET

; The graphics X limit is 03FFH, or 1023 decimal.

; -----------------------------------------------------------------------------
; CHECK AND MIRROR X
; -----------------------------------------------------------------------------
;
; Checks a physical x coordinate and returns its distance from the right edge.
;
; The legal physical x range is 0..03FFH. The routine computes 03FFH-BC, leaving carry set when BC
; was outside the range. Drawing callers use that carry as the F9H off-screen error path.
;
; Entry:
;   BC = physical x coordinate.
;
; Exit:
;   HL = 03FFH - BC; carry indicates an invalid coordinate.
;
; Effects:
;   No memory or hardware effects.
;
; Destroys:
;   AF, HL.
; -----------------------------------------------------------------------------
CHECK_X_COORDINATE:
    LD HL,03FFH
    OR A
    SBC HL,BC
    RET

; The graphics Y limit is 03BFH, or 959 decimal.

; -----------------------------------------------------------------------------
; CHECK AND MIRROR Y
; -----------------------------------------------------------------------------
;
; Checks a physical y coordinate and returns its distance from the top edge.
;
; The physical y range is 0..03BFH (959). The result 03BFH-DE converts the external bottom-origin
; graphics coordinate into the top-origin video-memory coordinate used by the driver.
;
; Entry:
;   DE = physical y coordinate.
;
; Exit:
;   HL = 03BFH - DE; carry indicates an invalid coordinate.
;
; Effects:
;   No memory or hardware effects.
;
; Destroys:
;   AF, HL.
; -----------------------------------------------------------------------------
CHECK_Y_COORDINATE:
    LD HL,03BFH
    OR A
    SBC HL,DE
    RET

; Mode plus one is the right-shift count used to convert logical coordinates to packed-pixel
; coordinates.

; -----------------------------------------------------------------------------
; GRAPHICS MODE COORDINATE TRANSFORM
; -----------------------------------------------------------------------------
;
; Converts a logical coordinate into a mode-dependent physical coordinate by shifting it by the
; graphics resolution.
;
; The mode byte at 0B73H is incremented and used as the shift count. C9C6H then divides HL by 2,
; 4, or 8 for the 2-, 4-, or 16-colour pixel packing modes. This removes the mode-dependent
; horizontal or vertical sub-pixel component before address generation.
;
; Entry:
;   HL = logical coordinate; current video mode is stored at 0B73H.
;
; Exit:
;   HL = mode-scaled physical coordinate.
;
; Effects:
;   No direct memory or hardware writes.
;
; Destroys:
;   AF, B and flags; HL contains the transformed value.
; -----------------------------------------------------------------------------
LOGICAL_TO_PHYSICAL_COORDINATE:
    LD A,(0B73H)
    LD B,A
    INC B

; SRL H/RR L performs an unsigned divide of HL by a power of two.

; -----------------------------------------------------------------------------
; MODE-SCALED DIVISION
; -----------------------------------------------------------------------------
;
; Divides HL by 2 to the power of B using paired logical shifts.
;
; The caller sets B to 1, 2, or 3 to scale a physical coordinate for 4-, 16-, or 2-pixel-per-byte
; layouts. The routine preserves the quotient in HL and is used repeatedly while building pixel
; addresses.
;
; Entry:
;   HL = unsigned value; B = number of right shifts.
;
; Exit:
;   HL = floor(original HL / 2^B).
;
; Effects:
;   No memory or hardware effects.
;
; Destroys:
;   AF, B; HL is replaced by the quotient.
; -----------------------------------------------------------------------------
SHIFT_HL_RIGHT:
    SRL H
    RR L
    DJNZ C9C6H
    RET

; Graphics preparation derives the line-style and paper/ink video values before drawing.

; -----------------------------------------------------------------------------
; GRAPHICS POINT PREPARATION
; -----------------------------------------------------------------------------
;
; Builds the mode-dependent state used by the pixel, line, and fill routines.
;
; The routine obtains the current line-style bit pattern, converts paper and ink colours through
; the mode helper, stores the resulting video values in 0B93H and 0B94H, and prepares IY for the
; line-crossing write routine. C9E2H then exposes the pixel address and bit mask previously
; prepared by PIXEL_ADDRESS.
;
; Entry:
;   Current video mode, line style, paper/ink colours, and pixel working state.
;
; Exit:
;   Graphics work variables and IY are ready for a pixel or line operation.
;
; Effects:
;   Updates 0B83H, 0B93H, 0B94H and related graphics state.
;
; Destroys:
;   AF, DE and flags; internal graphics routines determine the remaining register effects.
; -----------------------------------------------------------------------------
PREPARE_GRAPHICS_POINT:
; -----------------------------------------------------------------------------
; PREPARE DRAWING STATE
; -----------------------------------------------------------------------------
;
; Builds the line-style, PAPER, INK, crossing-mode, pixel-mask, and pixel-address state consumed
; by drawing helpers.
;
; The routine obtains the selected line pattern from LINE_STYLE_TABLE, derives the mode-specific
; PAPER and INK byte values, selects the crossing-mode implementation through LINE_MODE_TABLE, and
; finally obtains the current pixel's video byte address and mask. The results are kept in the
; video work variables at 0B75H-0B94H and in IY.
;
; Its multiple calls are intentional: the same preparation is shared by beam movement, character
; output, and paint. The internal state lets the tight pixel routines avoid repeating mode and
; palette calculations.
;
; Entry:
;   Current video variables, especially L_STYLE, L_MODE, GR_MODE, INK, PAPER, and the current
;   physical beam position.
;
; Exit:
;   IY points at the selected pixel-write implementation; video work variables contain the derived
;   bytes and address.
;
; Effects:
;   Reads video variables and updates the video work area.
;
; Destroys:
;   AF, BC, DE, HL; IY is deliberately changed.
; -----------------------------------------------------------------------------
PREPARE_DRAW_STATE:
    CALL CB6DH

LC9D0:
    CALL CC05H
    LD (0B93H),A
    LD DE,0040H

LC9D9:
    CALL CB8FH
    CALL CC0DH

LC9DF:
    LD (0B94H),A

; Return the prepared pixel mask in A/C and video-memory address in HL.

; -----------------------------------------------------------------------------
; PIXEL ADDRESS WORK-STATE ACCESS
; -----------------------------------------------------------------------------
;
; Loads the current pixel bit mask and video-memory address from graphics variables.
;
; The bit mask at 0B75H is returned in A/C and the prepared video-memory address at 0B76H is
; returned in HL. READ_PIXEL_COLOR and the drawing primitives use this compact interface after
; PIXEL_ADDRESS has performed the mode-dependent address calculation.
;
; Entry:
;   PIXEL_ADDRESS has populated 0B75H and 0B76H.
;
; Exit:
;   A/C = pixel mask; HL = video-memory byte address.
;
; Effects:
;   Read-only access to graphics work variables.
;
; Destroys:
;   AF, C and HL contain the returned state.
; -----------------------------------------------------------------------------
GET_PIXEL_WORK_STATE:
    LD A,(0B75H)
    LD C,A
    LD HL,(0B76H)
    RET

; Initial palette bytes when the hardware color switch is on.

; -----------------------------------------------------------------------------
; RESET PALETTE TABLE
; -----------------------------------------------------------------------------
;
; Four-byte palette defaults for the color-switch-on and color-switch-off configurations.
;
; The first quartet is 00H, 50H, 44H, 41H for normal color operation; the second at C9EEH is 00H,
; 55H, 50H, 44H for monochrome operation. VMODE selects one quartet and PAL_DEF writes it to
; palette ports 60H-63H.
;
; Entry:
;   No call inputs; entries are read as four consecutive bytes.
;
; Exit:
;   Palette values consumed by PAL_DEF.
;
; Effects:
;   Read-only ROM data.
;
; Destroys:
;   None.
; -----------------------------------------------------------------------------
DEFAULT_PALETTE_TABLE:
    DB 00H, 50H, 44H, 41H                                                           ; |.PDA|

; Initial palette bytes when the hardware color switch is off.
    DB 00H, 55H, 50H, 44H                                                           ; |.UPD|

; The startup entry selects C=01H (four-colour mode) and falls through into VID_MODE.

; -----------------------------------------------------------------------------
; VIDEO INITIALIZATION ENTRY
; -----------------------------------------------------------------------------
;
; Selects four-colour mode and falls through to the general video-mode routine.
;
; The startup table calls this entry as the first built-in device initializer. It loads C=01H, the
; TVC four-colour mode code, and immediately continues at VID_MODE (C9F4H), so initialization and
; an ordinary VIDEO 04 function call share the same mode-setting implementation.
;
; VID_MODE clears the mode-dependent graphics variables, records the mode at 0B73H, clears the
; screen, programs the mode-specific palette, and updates the port-06 mode bits.
;
; Entry:
;   No external parameters for startup; C is set internally to 01H.
;
; Exit:
;   Video mode 01H is requested through VID_MODE.
;
; Effects:
;   Updates video mode state, screen memory, palette, and hardware mode bits through the
;   fall-through routine.
;
; Destroys:
;   As specified by VID_MODE; C remains the selected mode during its setup.
; -----------------------------------------------------------------------------
SET_4_COLOR_MODE:
    LD C,01H

; VMODE routine (VIDEO 04); sets the video display mode.
; Video initialization enters VID_MODE with C=01H, selecting the four-color default mode.

; -----------------------------------------------------------------------------
; VIDEO 04 - SELECT DISPLAY MODE
; -----------------------------------------------------------------------------
;
; Selects 2-, 4-, or 16-color video mode, resets drawing attributes, clears the display, and
; installs the corresponding palette.
;
; C is the mode code: 00H selects mode 2, 01H selects mode 4, and 02H selects mode 16. Values 03H
; and above return F7H. A valid selection resets L_MODE, PAPER, V_FLAG, and L_STYLE, chooses the
; default INK color according to the hardware color switch, records GR_MODE at 0B73H, and enters
; CLS.
;
; The routine updates only the low two bits of the port-06H shadow at 0B13H, preserving unrelated
; video control bits. It then chooses the color or monochrome default palette table and falls
; through to PAL_DEF. The reset entry at C9F2H supplies C=01H, making the power-on default the
; four-color mode.
;
; Entry:
;   C = 00H (mode 2), 01H (mode 4), or 02H (mode 16).
;
; Exit:
;   A = 00H on success; A = F7H for an unsupported mode.
;
; Effects:
;   Changes the video mode, palette ports, drawing defaults, screen contents, and editor state
;   through CLS.
;
; Destroys:
;   AF, BC, DE, HL; video paging is handled by called routines.
;
; Note:
;   The public VIDEO jump-table entry is function 04. The entry at C9F2H is the video initializer,
;   not a separate algorithm.
; -----------------------------------------------------------------------------
VID_MODE:
    LD A,C
    CP 03H
    LD A,F7H
    RET NC
    XOR A
    LD (0B4BH),A
    LD (0B4EH),A
    LD (0B50H),A
    INC A
    LD (0B4CH),A
    CP C
    JR NC,CA15H
    IN A,(59H)
    RLCA
    RLCA
    LD A,0FH
    JR NC,CA15H
    LD A,0CH

LCA15:
    LD (0B4DH),A
    LD A,C
    LD (0B73H),A
    PUSH BC
    CALL CA49H
    POP BC
    LD A,C
    LD HL,0B13H
    XOR (HL)
    AND FCH
    XOR C
    LD (HL),A
    OUT (06H),A
    IN A,(59H)
    RLCA
    RLCA
    LD DE,C9EEH
    JR NC,CA38H
    LD DE,C9EAH

; PAL routine (VIDEO 0C); defines palette colors.

; -----------------------------------------------------------------------------
; VIDEO 12 - DEFINE PALETTE
; -----------------------------------------------------------------------------
;
; Writes four palette bytes from memory to palette registers 0 through 3.
;
; DE addresses four consecutive bytes. Each byte is sent to ports 60H, 61H, 62H, and 63H in order.
; VMODE reaches this tail after selecting the appropriate default quartet, but software can call
; the VIDEO 12 function directly to install arbitrary palette values.
;
; Entry:
;   DE = address of four palette bytes.
;
; Exit:
;   A = 00H always.
;
; Effects:
;   Writes palette hardware ports 60H-63H.
;
; Destroys:
;   AF, DE.
; -----------------------------------------------------------------------------
PAL_DEF:
    LD A,(DE)
    OUT (60H),A
    INC DE
    LD A,(DE)
    OUT (61H),A
    INC DE
    LD A,(DE)
    OUT (62H),A
    INC DE
    LD A,(DE)
    OUT (63H),A
    XOR A
    RET

; CLS routine (VIDEO 05); clears the screen.

; -----------------------------------------------------------------------------
; VIDEO 05 - CLEAR SCREEN
; -----------------------------------------------------------------------------
;
; Clears the 15-KiB video display area to PAPER, resets the editor, raises the beam, and homes the
; graphics position.
;
; CLS enters the video paging guard, initializes the editor workspace, derives the current PAPER
; byte, and fills 8000H-BAFFH (3C00H bytes) with that value. It then calls B_OFF and clears the
; physical beam coordinates BC and DE to zero. This is a complete display reset rather than only a
; memory fill.
;
; Entry:
;   No public arguments.
;
; Exit:
;   A is the status returned by the final video operation (normally 00H).
;
; Effects:
;   Destructively rewrites video RAM and resets editor/cursor state and pen state.
;
; Destroys:
;   AF, BC, DE, HL, IY; video paging is restored by VIDEO_PAGE_GUARD.
; -----------------------------------------------------------------------------
VID_CLS:
    CALL C98FH
    CALL CFD4H
    CALL CC05H
    DB 21H, 00H                                                                     ; |!.|

; CLS fills 3C00H bytes from 8000H through BAFFH: the 15-KiB display area.
    ADD A,B
    LD DE,8001H
    LD (HL),A
    LD BC,3BFFH
    LDIR
    CALL CBFFH
    LD B,A
    LD C,A
    LD D,A
    LD E,A

; Mode-specific PAPER and INK line bytes at 0B93H and 0B94H feed point and character rendering.

; -----------------------------------------------------------------------------
; PIXEL ADDRESS AND MASK
; -----------------------------------------------------------------------------
;
; Converts a physical pixel coordinate into the corresponding video-RAM byte address and bit mask.
;
; The physical x coordinate is divided by 16 to obtain the byte-column contribution and again by
; the current graphics mode to obtain the logical x coordinate. The low three bits select one of
; the mode-dependent leftmost-pixel masks at CAB4H. The y coordinate is mirrored against 03BFH,
; divided by four for the logical row, and combined with the x byte-column to form 8000H + row*40H
; + column.
;
; The routine records the physical and logical coordinates in the video work variables, stores the
; selected bit mask at 0B75H, and stores the video byte address at 0B76H-0B77H. It deliberately
; does not perform range checking; B_ABS performs that before calling it.
;
; Entry:
;   BC = physical x (0..03FFH); DE = physical y (0..03BFH).
;
; Exit:
;   A = 00H; 0B75H = pixel mask; 0B76H-0B77H = video byte address; related logical coordinates are
;   saved in the work area.
;
; Effects:
;   Updates video work variables only.
;
; Destroys:
;   AF, BC, DE, HL.
;
; Note:
;   CAB4H contains the mode masks 80H, 88H, and AAH. The address formula is the same foundation
;   used by line drawing and point output.
; -----------------------------------------------------------------------------
PIXEL_ADDRESS:
    LD (0B7EH),DE

LCA69:
    LD (0B7CH),BC
    LD HL,(0B7CH)
    PUSH HL
    LD B,04H
    CALL C9C6H
    EX (SP),HL
    CALL C9C1H
    LD (0B78H),HL
    LD C,A
    LD A,L
    LD HL,CAB4H
    ADD HL,BC
    AND 07H
    INC A
    LD B,A
    LD A,(HL)
    DB 1EH                                                                          ; |.|

LCA89:
    RRCA
    DJNZ CA89H
    LD (0B75H),A
    LD DE,(0B7EH)
    LD HL,03BFH
    XOR A
    SBC HL,DE
    LD B,02H
    CALL C9C6H
    LD (0B7AH),HL
    LD H,L
    SRL H
    RRA
    SRL H
    RRA
    LD L,A
    POP BC
    ADD HL,BC
    LD DE,8000H
    ADD HL,DE
    LD (0B76H),HL
    XOR A
    RET

; Mode-dependent leftmost-pixel masks: 80H for mode 2, 88H for mode 4, and AAH for mode 16.
    ADD A,B
    ADC A,B
    XOR D

; -----------------------------------------------------------------------------
; PIXEL COLOR SELECTOR
; -----------------------------------------------------------------------------
;
; Applies the INK/PAPER and overwrite rules before plotting one character pixel.
;
; Carry identifies whether the incoming pixel belongs to INK or PAPER. The current overwrite mode
; decides whether that color is effective; the helper then dispatches through IY to one of the
; four crossing-mode implementations. The adjacent entry at CABEH is the line-drawing variant,
; which always treats an accepted INK point as drawable.
;
; Entry:
;   Carry = INK/PAPER selector; A = overwrite mode; HL = video byte; C = pixel mask; IY = selected
;   crossing implementation.
;
; Exit:
;   The selected bit operation is applied, or the routine returns without changing memory.
;
; Effects:
;   May modify the video byte at HL.
;
; Destroys:
;   AF; other registers are inputs to the selected implementation.
; -----------------------------------------------------------------------------
PLOT_CHARACTER_PIXEL:
    JR NC,CAC5H
    AND 01H
    JR Z,CAC0H
    RET

LCABE:
    JR NC,CAC8H

LCAC0:
    LD A,(0B94H)
    JP (IY)

LCAC5:
    AND 02H
    RET NZ

LCAC8:
    LD A,(0B93H)
    JP (IY)

; -----------------------------------------------------------------------------
; PIXEL CROSSING OPERATIONS
; -----------------------------------------------------------------------------
;
; Implements overwrite, XOR, AND, and OR pixel writes without disturbing unrelated bits in the
; video byte.
;
; The four entry points are selected by L_MODE through the table at CBA0H. The mode-0 entry
; performs the direct overwrite operation, the mode-1 entry XORs the selected mask, the mode-2
; entry ANDs it, and the mode-3 entry ORs it. Each operation combines the incoming color byte with
; the existing video byte so the other pixels packed into that byte survive.
;
; Entry:
;   HL = video byte address; C = selected pixel bits; A = INK or PAPER line byte.
;
; Exit:
;   The selected operation updates (HL).
;
; Effects:
;   Writes one video-RAM byte.
;
; Destroys:
;   AF.
;
; Note:
;   Entry labels CACD, CAD3, CAC8, and CACF are intentionally adjacent dispatch points; use the
;   table rather than treating CACD as the only entry.
; -----------------------------------------------------------------------------
PLOT_PIXEL_CROSSING:
    AND (HL)
    XOR (HL)
    AND C
    XOR (HL)
    LD (HL),A
    RET
    AND C
    OR (HL)
    LD (HL),A
    RET

; BREL routine (VIDEO 07); sets pen position relative to current point.

; -----------------------------------------------------------------------------
; VIDEO 07 - MOVE BEAM RELATIVELY
; -----------------------------------------------------------------------------
;
; Adds a relative graphics displacement to the current beam position and delegates to B_ABS.
;
; The relative x and y offsets in BC and DE are added to the stored beam coordinates by CC7AH. The
; resulting absolute position then follows the same range checks, pen-state handling, and line
; drawing as B_ABS.
;
; Entry:
;   BC = signed/unsigned x displacement; DE = y displacement in the graphics calling convention.
;
; Exit:
;   A = 00H on success or F9H when the new point is outside the display.
;
; Effects:
;   Updates the beam position and may draw a line.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
B_REL:
    CALL CC7AH

; BABS routine (VIDEO 06); sets pen position to absolute coordinates.

; -----------------------------------------------------------------------------
; VIDEO 06 - MOVE BEAM ABSOLUTELY
; -----------------------------------------------------------------------------
;
; Moves the graphics beam to an absolute point, optionally drawing the line from the previous
; point.
;
; B_ABS enters the paging guard, mirrors and validates x and y, and returns F9H if either
; coordinate is outside the physical display. With the pen raised it only computes and stores the
; new pixel address. With the pen lowered it saves the old logical point, prepares drawing state,
; computes both endpoint addresses, chooses direction and major-axis line helpers, and plots the
; points until the endpoint is reached.
;
; The line algorithm is an integer incremental method: the larger coordinate difference determines
; the number of steps, while an error accumulator decides when to step along the smaller axis.
; Eight dispatch cases cover the signs of x and y and which magnitude is greater.
;
; Entry:
;   BC = new physical x; DE = new physical y.
;
; Exit:
;   A = 00H on success; A = F9H for an off-screen point.
;
; Effects:
;   Updates 0B78H-0B7BH beam coordinates and may write many video bytes.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers, and IY.
;
; Note:
;   DRAW_LINE at CAEDH is the continuation used only when B_STAT at 0B74H indicates pen down.
; -----------------------------------------------------------------------------
B_ABS:
    CALL C98FH
    LD A,F9H
    CALL C9B3H
    CALL NC,C9BAH
    RET C
    LD A,(0B74H)
    OR A
    JP Z,CA65H

; -----------------------------------------------------------------------------
; INTEGER LINE DRAWER
; -----------------------------------------------------------------------------
;
; Plots an inclusive line between the previous beam point and the newly selected point.
;
; The routine stores endpoint deltas, initializes the line-style and crossing state, compares
; absolute x and y differences, and selects one of eight directional step routines from the tables
; at CBDBH and CBE3H. The major-axis difference drives the loop; a signed accumulator determines
; when the minor axis advances.
;
; The active pixel mask and video byte address are advanced by V15 (CBA8H), then V8 (CABE/CAC0)
; applies the current line style and color. This keeps the high-level graphics call independent of
; the packed-pixel representation of the three display modes.
;
; Entry:
;   Saved old and new logical coordinates in the video work area; prepared line state.
;
; Exit:
;   The video RAM contains the line through the endpoint; beam state remains at the endpoint.
;
; Effects:
;   Writes video RAM according to L_STYLE, L_MODE, INK, PAPER, and B_STAT.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers, IY, stack temporaries.
; -----------------------------------------------------------------------------
DRAW_LINE:
    EXX
    LD BC,(0B78H)
    LD DE,(0B7AH)
    PUSH BC
    PUSH DE
    CALL C9CDH
    EXX
    CALL CA65H
    LD BC,(0B78H)
    LD DE,(0B7AH)
    XOR A
    EX DE,HL
    POP DE
    CALL CB61H
    POP DE
    PUSH HL
    LD H,B
    LD L,C
    CALL CB61H
    PUSH HL
    LD HL,CBDBH
    CALL C9AAH
    LD (0B86H),DE
    POP HL
    POP DE
    PUSH HL
    SBC HL,DE
    POP HL
    JR C,CB28H
    EX DE,HL

LCB28:
    LD B,H
    LD C,L
    PUSH DE
    ADC A,00H
    SBC HL,DE
    PUSH HL
    SRL D
    RR E
    ADD HL,DE
    PUSH HL
    LD HL,CBE3H
    CALL C9AAH
    LD (0B84H),DE
    POP HL
    POP DE
    EXX
    EX (SP),HL
    LD A,H
    LD B,L
    INC B
    INC A
    EX AF,AF'
    POP HL
    JR CB50H

LCB4C:
    EX AF,AF'

LCB4D:
    DB CDH, A8H                                                                     ; |..|

LCB4F:
    DB CBH                                                                          ; |.|

LCB50:
    LD A,(0B83H)
    RLCA
    LD (0B83H),A
    CALL CABEH
    DJNZ CB4DH
    EX AF,AF'
    DEC A
    JR NZ,CB4CH
    RET

; -----------------------------------------------------------------------------
; SIGNED DIFFERENCE HELPER
; -----------------------------------------------------------------------------
;
; Returns the absolute difference of HL and DE while encoding the subtraction direction in A and
; carry.
;
; If HL is at least DE, the difference remains in HL and the carry is clear. Otherwise the
; operands are exchanged and negated so HL is still an absolute magnitude, while A/carry preserve
; which original operand was larger. DRAW_LINE uses that compact sign information to choose a
; directional stepping case.
;
; Entry:
;   HL = minuend; DE = subtrahend.
;
; Exit:
;   HL = absolute difference; A/carry describe the original ordering.
;
; Effects:
;   No memory effects.
;
; Destroys:
;   AF, DE; HL is replaced.
; -----------------------------------------------------------------------------
ABSOLUTE_DIFFERENCE:
    SBC HL,DE
    JR NC,CB6BH
    EX DE,HL
    LD HL,0001H
    SBC HL,DE

LCB6B:
    RLA
    RET

; Active line-style pattern byte at 0B83H is rotated as each line pixel is emitted.

; -----------------------------------------------------------------------------
; LOAD LINE STYLE
; -----------------------------------------------------------------------------
;
; Loads the selected L_STYLE bit pattern into the current line-pattern work byte.
;
; L_STYLE is reduced to a 0..0FH index and used to select one byte from LINE_STYLE_TABLE at CB7FH.
; The resulting pattern is written to 0B83H and rotated as each line pixel is emitted, producing
; dotted, dashed, or solid lines.
;
; Entry:
;   L_STYLE at 0B4CH, normally 1..14.
;
; Exit:
;   0B83H contains the active pattern byte.
;
; Effects:
;   Updates video work state.
;
; Destroys:
;   AF, BC, HL.
; -----------------------------------------------------------------------------
LOAD_LINE_STYLE:
    LD A,(0B4CH)
    DEC A
    AND 0FH
    LD C,A
    LD HL,CB7FH
    LD B,00H
    ADD HL,BC
    LD A,(HL)
    LD (0B83H),A
    RET

; Line style bit-pattern table; 16 bytes, 14 unique patterns.

; -----------------------------------------------------------------------------
; LINE STYLE PATTERNS
; -----------------------------------------------------------------------------
;
; Sixteen-byte table of line-pattern bitmaps used by the beam line drawer.
;
; The table contains the solid, dashed, dotted, and mixed line patterns selected by L_STYLE.
; Fourteen patterns are distinct; the remaining entries repeat the solid pattern or provide
; aliases. The active byte is rotated once per plotted point.
;
; Entry:
;   Indexed by L_STYLE-1, masked to four bits.
;
; Exit:
;   One 8-bit pattern per table entry.
;
; Effects:
;   Read-only ROM data.
;
; Destroys:
;   None.
; -----------------------------------------------------------------------------
LINE_STYLE_TABLE:
    DB FFH, AAH, CCH, EEH, 88H, DAH, E4H, F6H, FAH, FEH, FCH, F8H, F0H, EAH, FFH, FFH ; |................|

; -----------------------------------------------------------------------------
; SELECT PIXEL CROSSING MODE
; -----------------------------------------------------------------------------
;
; Selects the pixel operation entry point corresponding to L_MODE and leaves it in IY.
;
; The low two bits of L_MODE index LINE_MODE_TABLE at CBA0H. The selected word is loaded into IY,
; so the tight plot routines can dispatch with JP (IY) without branching on mode for every pixel.
;
; Entry:
;   L_MODE at 0B4EH.
;
; Exit:
;   IY = crossing-mode implementation address.
;
; Effects:
;   Updates IY only.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
SELECT_CROSSING_MODE:
    DB D5H, 3AH, 4BH, 0BH, E6H, 03H, 21H, A0H, CBH, CDH, AAH, C9H, D5H, FDH, E1H, D1H ; |.:K...!.........|
    DB C9H                                                                          ; |.|

; Line crossing mode dispatch table selected by L_MODE.

; -----------------------------------------------------------------------------
; PIXEL OPERATION DISPATCH TABLE
; -----------------------------------------------------------------------------
;
; Word table mapping the four L_MODE values to the overwrite, XOR, AND, and OR pixel writers.
;
; Each two-byte entry points into the adjacent bit-manipulation implementations at CACDH onward.
; The table is consumed by SELECT_CROSSING_MODE, and its compact dispatch is shared by character
; output and graphics.
;
; Entry:
;   Index 0..3 from L_MODE.
;
; Exit:
;   A pixel-writer address for IY.
;
; Effects:
;   Read-only ROM data.
;
; Destroys:
;   None.
; -----------------------------------------------------------------------------
LINE_MODE_TABLE:
    DB CEH, CAH, D3H, CAH, CDH, CAH, CFH, CAH                                       ; |........|

; -----------------------------------------------------------------------------
; LINE PIXEL STEPPER
; -----------------------------------------------------------------------------
;
; Uses the signed error accumulator and direction tables to advance one line pixel.
;
; The routine examines the accumulator in HL', chooses one of the directional entries selected by
; DRAW_LINE, adjusts the video-byte address in HL and pixel mask in C, and returns the updated
; state. The entry points below the dispatcher cover left/right and up/down combinations,
; including byte-boundary crossings.
;
; Entry:
;   HL' = error accumulator; BC'/DE' = positive and negative increments; HL = video address; DE =
;   0040H row stride; C = pixel mask.
;
; Exit:
;   HL and C identify the next pixel; the accumulator is updated.
;
; Effects:
;   No memory effects itself; caller then plots the selected pixel.
;
; Destroys:
;   AF, BC, DE, HL and alternates according to selected path.
; -----------------------------------------------------------------------------
STEP_LINE_PIXEL:
    DB D9H, CBH, 7CH, 28H, 08H, 09H, D9H, DDH, 2AH, 84H, 0BH, DDH, E9H, 19H, D9H, DDH ; |..|(....*.......|
    DB 2AH, 86H, 0BH, DDH, E9H, B7H, EDH, 52H, CBH, 01H, D0H, 2DH, C9H, CBH, 09H, 30H ; |*......R...-...0|
    DB 01H, 2CH, B7H, EDH, 52H, C9H, CBH, 01H, 30H, 01H, 2DH, 19H, C9H, 19H, CBH, 09H ; |.,..R...0.-.....|
    DB D0H, 2CH, C9H                                                                ; |.,.|

; Helper table used by BABS/BREL line drawing.
    DB D5H, CBH                                                                     ; |..|
    ADC A,CBH
    PUSH BC
    RES 7,L
    SET 2,(HL)
    SET 2,E
    SET 0,B
    SET 2,E
    SET 2,(HL)
    SET 1,D
    SET 0,B
    SET 1,D
    DB CBH                                                                          ; |.|

; BON routine (VIDEO 08); pen down (starts drawing).
; B_STAT: zero means the beam is raised; nonzero means subsequent beam movement draws.

; -----------------------------------------------------------------------------
; VIDEO 08 - LOWER BEAM
; -----------------------------------------------------------------------------
;
; Turns the graphics pen on and plots the current point using INK and the selected crossing mode.
;
; B_ON enters the video paging guard, prepares drawing state, calls the INK pixel writer, and
; records B_STAT=FFH. Subsequent B_ABS or B_REL movements draw lines from the current point.
;
; Entry:
;   No public arguments.
;
; Exit:
;   A = 00H.
;
; Effects:
;   May modify the current pixel and sets pen-down state at 0B74H.
;
; Destroys:
;   AF, BC, DE, HL, IY.
; -----------------------------------------------------------------------------
B_ON:
    CALL C98FH
    CALL C9D9H
    CALL CAC0H
    LD A,FFH
    DB 26H                                                                          ; |&|

; BOFF routine (VIDEO 09); pen up (stops drawing).

; -----------------------------------------------------------------------------
; VIDEO 09 - RAISE BEAM
; -----------------------------------------------------------------------------
;
; Turns the graphics pen off so future beam moves do not draw.
;
; B_OFF writes zero to B_STAT at 0B74H and returns a zero status. CLS uses it while homing the
; beam; the routine deliberately does not erase or move the current point.
;
; Entry:
;   No public arguments.
;
; Exit:
;   A = 00H.
;
; Effects:
;   Updates pen state only.
;
; Destroys:
;   AF.
; -----------------------------------------------------------------------------
B_OFF:
    XOR A
    LD (0B74H),A
    XOR A
    RET

LCC05:
    LD A,(0B4EH)
    CALL CC10H
    LD B,A
    RET

LCC0D:
    LD A,(0B4DH)

LCC10:
    LD HL,(0B73H)
    SRL L
    JR C,CC20H
    SRL L
    JR C,CC31H
    AND 01H
    RRA
    SBC A,A
    RET

LCC20:
    AND 03H
    RRA
    RL L
    RRA
    SBC A,A
    RR L
    RRA
    SRA A
    SRA A
    SRA A
    RET

LCC31:
    AND 0FH
    LD H,04H

LCC35:
    RRA
    RR L
    SRA L
    DEC H
    JR NZ,CC35H
    LD A,L
    RET

; -----------------------------------------------------------------------------
; READ LAST PIXEL COLOR
; -----------------------------------------------------------------------------
;
; Decodes the selected pixel from video RAM according to the current graphics mode.
;
; The routine uses the address and mask left by PIXEL_ADDRESS, extracts the pixel bits from the
; selected video byte, and expands the mode-specific bit encoding into the TVC color code returned
; to the caller. It is the read-side companion to the plot helpers.
;
; Entry:
;   Video work variables 0B73H, 0B75H, and 0B76H-0B77H identify the last pixel.
;
; Exit:
;   A = decoded pixel color code.
;
; Effects:
;   Reads video RAM; no writes.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
READ_PIXEL_COLOR:
    CALL C9E2H
    LD A,(0B73H)
    LD B,A
    LD A,C
    AND (HL)
    SRL B
    JR C,CC56H
    SRL B
    JR C,CC65H
    ADD A,FFH
    RLA
    AND 01H
    RET

LCC56:
    ADD A,F0H
    RL C
    AND 0FH
    ADD A,FFH
    RLA
    RR C
    RLA
    AND 03H
    RET

LCC65:
    ADD A,C0H
    RLA
    AND 7FH
    ADD A,E0H
    RLA
    AND 3FH
    ADD A,F0H
    RLA
    AND 1FH
    ADD A,F8H
    RLA
    AND 0FH
    RET

; -----------------------------------------------------------------------------
; ADD RELATIVE BEAM COORDINATES
; -----------------------------------------------------------------------------
;
; Adds a relative x/y displacement to the stored physical beam coordinates.
;
; BC is added to the x coordinate at 0B7CH and DE to the y coordinate at 0B7EH. The result is
; returned in BC/DE and is immediately suitable for B_ABS range checks.
;
; Entry:
;   BC = x displacement; DE = y displacement; stored beam coordinates in 0B7CH/0B7EH.
;
; Exit:
;   BC/DE = resulting absolute coordinates.
;
; Effects:
;   No direct hardware effects; reads the beam work area.
;
; Destroys:
;   AF, HL, BC, DE replaced.
; -----------------------------------------------------------------------------
ADD_BEAM_OFFSET:
    LD HL,(0B7CH)
    ADD HL,BC
    LD B,H
    LD C,L
    LD HL,(0B7EH)
    ADD HL,DE
    EX DE,HL
    RET

; -----------------------------------------------------------------------------
; VIDEO 02 - BLOCK OUTPUT
; -----------------------------------------------------------------------------
;
; Sends a counted character block to the video character-output routine.
;
; The source pointer is moved to HL and each byte is passed through VID_CHOUT. CPI advances the
; source and decrements the count while preserving the block loop. The generic OS block-output
; wrapper normally supplies bounds checking, although the reference notes a ROM defect in that
; generic path.
;
; Entry:
;   DE = source address; BC = byte count.
;
; Exit:
;   A = status from character output after the last byte.
;
; Effects:
;   Writes screen/editor state through VID_CHOUT.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
VID_BKOUT:
    EX DE,HL

LCC87:
    PUSH HL
    PUSH BC
    LD C,(HL)
    CALL CC94H
    POP BC
    POP HL
    CPI
    RET PO
    JR CC87H

; -----------------------------------------------------------------------------
; VIDEO 01 - CHARACTER OUTPUT
; -----------------------------------------------------------------------------
;
; Outputs one character, handling control characters and dispatching printable glyphs to the
; mode-specific renderer.
;
; Control codes below 20H are recognized as line feed (0AH) and carriage return (0DH); other
; control values are ignored with success. Codes 20H..DFH are rendered, while E0H and above are
; rejected. The routine validates and normalizes the beam position, selects the glyph matrix,
; plots ten character rows, and advances by one character cell.
;
; A printable character is rendered using the fixed matrix at C474H or the programmable matrix at
; 0740H, depending on bit 7 of the code. After output it checks the next x position and wraps or
; returns an error as appropriate. The D2BH/D31H tails implement carriage return and line feed.
;
; Entry:
;   C = character code.
;
; Exit:
;   A = 00H on success, or the relevant off-screen/error status.
;
; Effects:
;   Writes video RAM and updates beam coordinates.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers, IY.
; -----------------------------------------------------------------------------
VID_CHOUT:
    CALL C98FH
    LD A,C
    CP 20H
    JR NC,CCA8H
    CP 0AH
    JP Z,CD31H
    CP 0DH
    JP Z,CD2BH
    XOR A
    RET

LCCA8:
    CP E0H
    LD A,00H
    RET NC
    EXX
    LD DE,FFDCH
    LD A,(0B73H)
    LD B,A
    LD A,01H
    INC B

LCCB8:
    ADD A,A
    DJNZ CCB8H
    LD (0B82H),A
    LD L,A
    ADD A,A
    ADD A,L
    ADD A,A
    ADD A,L
    LD C,A
    XOR A
    CALL CC7AH
    CALL C9BAH
    RET C
    CALL C9B3H
    JR NC,CCD7H
    CALL CD2BH
    CALL CD31H

; -----------------------------------------------------------------------------
; RENDER GLYPH AT PIXEL POSITION
; -----------------------------------------------------------------------------
;
; Renders the character in C at the supplied pixel coordinates without the public coordinate
; checks.
;
; The code selects the fixed or programmable ten-byte glyph matrix, rotates each glyph row into
; the current mode's packed-pixel representation, and invokes the pixel selector for each of eight
; points per row. Ten raster rows are processed. This is the low-level engine used by VID_CHOUT
; after it has validated the requested position.
;
; Entry:
;   C = character code; BC/DE = physical pixel position; current video drawing attributes are
;   installed.
;
; Exit:
;   Video RAM contains the glyph; beam is advanced by one character cell.
;
; Effects:
;   Writes video RAM and updates beam work variables.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers, IY.
; -----------------------------------------------------------------------------
VID_CHOUT_AT:
    CALL C9D0H
    EXX
    LD DE,C474H
    BIT 7,C
    JR Z,CCE5H
    LD DE,0740H

LCCE5:
    RES 7,C
    LD B,00H
    LD H,B
    LD L,C
    ADD HL,HL
    ADD HL,HL
    ADD HL,BC
    ADD HL,HL
    ADD HL,DE
    LD B,0AH
    LD A,(0B50H)
    LD E,A
    DEC HL

LCCF7:
    INC HL
    LD C,(HL)
    EXX
    LD B,08H
    JR CD01H

LCCFE:
    CALL CBD6H

LCD01:
    EXX
    RL C
    LD A,E
    EXX
    CALL CAB7H
    DJNZ CCFEH
    CALL CBD3H
    LD B,07H

LCD10:
    CALL CBC0H
    DJNZ CD10H
    EXX
    DJNZ CCF7H
    LD A,(0B82H)
    ADD A,A
    ADD A,A
    ADD A,A
    LD C,A
    CALL CC7AH
    CALL C9B3H
    JR NC,CD2EH
    LD BC,CD31H
    PUSH BC

LCD2B:
    LD BC,0000H

LCD2E:
    JP CA69H

LCD31:
    LD DE,FFB4H
    CALL CC7AH
    XOR A
    CALL C9BAH
    RET C
    LD DE,FFD8H
    LD BC,0000H
    CALL CC7AH
    JP CA65H

; FILL routine (VIDEO 0A); fills closed shapes with color.

; -----------------------------------------------------------------------------
; VIDEO 10 - FLOOD FILL
; -----------------------------------------------------------------------------
;
; Fills a connected graphics region using the current color and crossing rules.
;
; PAINT prepares the pixel address and crossing implementation, samples the boundary/test color,
; and performs a scanline-style flood fill. It maintains a stack of pending spans in the caller's
; stack area, checks the high-memory boundary before growing that stack, and processes neighboring
; spans until no work remains.
;
; The fill operates on packed video bytes and masks, so it handles the three modes through the
; same crossing-mode and pixel helpers. If the stack would cross the configured low-memory
; boundary, the routine stops safely rather than corrupting the system workspace.
;
; Entry:
;   Current beam point and video drawing attributes.
;
; Exit:
;   A = 00H on completion; the region is filled or the operation terminates at the memory guard.
;
; Effects:
;   Writes a potentially large region of video RAM and temporarily uses SP.
;
; Destroys:
;   AF, BC, DE, HL, IY, stack contents below the saved SP.
;
; Note:
;   The algorithm is intentionally iterative; the explicit span stack avoids recursive calls in
;   ROM.
; -----------------------------------------------------------------------------
PAINT:
    CALL C98FH
    LD (0B88H),SP
    LD IY,CACFH
    CALL CC3FH
    CALL CC10H
    LD (0B8AH),A
    LD E,A
    CALL CC0DH
    XOR E
    LD HL,0000H
    RET Z
    LD (0B91H),HL
    PUSH HL
    LD HL,(0B7CH)
    LD B,04H
    CALL C9C6H
    PUSH HL
    CALL C9DFH
    LD A,40H
    POP DE
    SUB E
    LD B,A
    LD (0B8DH),HL
    LD (0B8BH),BC
    LD B,01H
    JR CDA3H

LCD85:
    POP HL
    LD A,H
    OR L
    RET Z
    POP BC
    LD (0B91H),HL
    LD (0B8BH),BC
    POP HL
    LD DE,0040H
    ADD HL,DE
    LD (0B8DH),HL
    LD B,02H
    LD DE,BC00H
    SBC HL,DE
    JP NC,CE63H

LCDA3:
    EXX

LCDA4:
    CALL CE92H
    JR C,CD85H
    LD HL,(0B91H)
    LD A,H
    RES 7,H
    RES 6,H
    LD (0B8FH),HL
    EX DE,HL
    BIT 6,A
    JR Z,CDC2H
    RLCA
    EXX
    XOR B
    EXX
    AND 01H
    JP NZ,CE62H

LCDC2:
    LD HL,(0B8DH)
    LD BC,(0B8BH)
    LD A,(0B8AH)
    XOR (HL)
    AND C
    JR NZ,CE2FH
    LD A,40H
    SUB B
    INC A
    LD B,A
    LD DE,0000H
    JR CDE5H

LCDDA:
    LD A,(0B8AH)
    XOR (HL)
    AND C
    JR NZ,CDECH
    CALL CAC0H
    INC DE

LCDE5:
    RLC C
    JR NC,CDDAH
    DEC L
    DJNZ CDDAH

LCDEC:
    LD A,40H
    SUB B
    INC A
    LD B,A
    RRC C
    JR NC,CDF7H
    INC L
    DEC B

LCDF7:
    PUSH HL
    PUSH BC
    PUSH DE
    LD HL,(0B8DH)
    LD BC,(0B8BH)
    CALL CE7AH
    EX (SP),HL
    LD A,H
    OR L
    JR Z,CE0BH
    SET 7,H

LCE0B:
    ADD HL,DE
    EX (SP),HL

LCE0D:
    PUSH HL
    LD HL,(0B8FH)
    OR A
    SBC HL,DE
    POP DE
    EX (SP),HL
    PUSH AF
    LD A,80H
    BIT 7,H
    JR NZ,CE26H
    JR C,CE28H
    EXX
    RRC B
    RLC B
    EXX
    RRA

LCE26:
    XOR H
    LD H,A

LCE28:
    POP AF
    EX (SP),HL
    JR C,CE62H
    JR Z,CE62H
    EX DE,HL

LCE2F:
    CALL CE92H
    JP C,CD85H
    LD A,E
    OR A
    JR NZ,CE3AH
    DEC D

LCE3A:
    LD A,(0B8AH)
    XOR (HL)
    AND C
    JR Z,CE4CH
    DEC E
    JR Z,CE5EH

LCE44:
    RRC C
    JR NC,CE3AH
    INC L
    DEC B
    JR CE3AH

LCE4C:
    LD A,E
    OR A
    JR NZ,CE51H
    INC D

LCE51:
    LD (0B8FH),DE
    PUSH HL
    EX (SP),HL
    PUSH BC
    CALL CE7AH
    PUSH DE
    JR CE0DH

LCE5E:
    DEC D
    JP P,CE44H

LCE62:
    EXX

LCE63:
    DEC B
    JP Z,CD85H
    EXX
    LD HL,(0B8DH)
    LD DE,FF80H
    ADD HL,DE
    LD (0B8DH),HL
    BIT 7,H
    JP Z,CD85H
    JP CDA4H

LCE7A:
    LD DE,0000H

LCE7D:
    LD A,(0B8AH)
    XOR (HL)
    AND C
    RET NZ
    INC DE
    LD A,(0B94H)
    AND C
    XOR (HL)
    LD (HL),A
    RRC C
    JR NC,CE7DH
    INC L
    DJNZ CE7DH
    RET

LCE92:
    PUSH HL
    PUSH DE
    LD HL,FFEAH
    ADD HL,SP
    LD DE,(0B17H)
    SBC HL,DE
    JP NC,CEC9H
    PUSH BC
    EXX
    PUSH BC
    LD HL,(0B88H)
    DEC HL
    DEC HL
    DEC HL
    LD D,H
    LD E,L

LCEAC:
    LD C,L
    LD B,H
    LD HL,0009H
    ADD HL,SP
    OR A
    SBC HL,BC
    LD H,B
    LD L,C
    JR NZ,CECCH
    LD BC,000AH
    LDDR
    EX DE,HL
    LD SP,HL
    INC SP
    OR A
    EX DE,HL
    SBC HL,DE
    CCF
    POP BC
    EXX
    POP BC

LCEC9:
    POP DE
    POP HL
    RET

LCECC:
    CALL CEFEH
    ADD HL,BC
    LD BC,BC00H
    SBC HL,BC
    JR NC,CEDDH
    ADD HL,BC
    CALL CF14H
    JR Z,CEECH

LCEDD:
    CALL CEFDH
    OR A
    SBC HL,BC
    LD BC,8000H
    SBC HL,BC
    ADD HL,BC
    CALL NC,CF14H

LCEEC:
    EXX
    LD BC,0006H
    JR NZ,CEF7H
    LDDR
    JP CEACH

LCEF7:
    OR A
    SBC HL,BC
    JP CEACH

LCEFD:
    EXX

LCEFE:
    PUSH HL
    EXX
    POP HL
    LD D,(HL)
    DEC HL
    LD E,(HL)
    DEC HL
    DEC HL
    LD B,(HL)
    DEC HL
    LD A,(HL)
    AND 3FH
    DEC HL
    LD L,(HL)
    LD H,A
    LD A,B
    LD BC,0040H
    EX DE,HL
    RET

LCF14:
    LD C,A
    LD A,(0B8AH)
    LD B,A

LCF19:
    LD A,B
    XOR (HL)
    AND C
    RET Z
    DEC E
    JR Z,CF27H

LCF20:
    RRC C
    JR NC,CF19H
    INC HL
    JR CF19H

LCF27:
    DEC D
    JP P,CF20H
    RET

; DEFC routine (VIDEO 0B); defines a character with specified code.

; -----------------------------------------------------------------------------
; VIDEO 11 - DEFINE CHARACTER
; -----------------------------------------------------------------------------
;
; Copies a ten-byte glyph definition into the programmable character matrix.
;
; Codes below E0H are not programmable and return F8H. For E0H..FFH, bit 7 is removed, the code is
; multiplied by ten, and the ten source bytes at DE are copied into the programmable matrix
; beginning at 0740H. The ten bytes describe ten raster rows, each with eight logical pixels.
;
; Entry:
;   C = programmable character code E0H..FFH; DE = ten-byte glyph source.
;
; Exit:
;   A = 00H on success; A = F8H for a fixed/non-programmable code.
;
; Effects:
;   Writes the programmable character matrix.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
CH_DEF:
    LD A,C
    CP E0H
    JR NC,CF32H
    OR A

LCF32:
    LD A,F8H
    RET P
    RES 7,C
    LD B,00H
    LD L,C
    LD H,B
    ADD HL,HL
    ADD HL,HL
    ADD HL,BC
    ADD HL,HL
    LD BC,0740H
    ADD HL,BC
    EX DE,HL
    LD BC,000AH
    LDIR
    XOR A
    RET

; BTEXT routine (VIDEO 03); positions pen to normal character position.

; -----------------------------------------------------------------------------
; VIDEO 03 - CHARACTER POSITION
; -----------------------------------------------------------------------------
;
; Rounds a graphics beam position to the nearest normal character-cell origin.
;
; The routine converts the requested physical coordinates into a character-grid position based on
; the active mode's pixel density, preserves the original x/y direction conventions, validates the
; resulting point, and calls PIXEL_ADDRESS. It is used when software wants text output aligned to
; the normal ten-raster-row character cells.
;
; Entry:
;   BC/DE = requested physical beam coordinates.
;
; Exit:
;   A = 00H on success; A = F9H for an invalid position; beam work variables hold the aligned
;   position.
;
; Effects:
;   Updates beam and pixel-address work variables.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
CH_POS:
    PUSH BC
    LD HL,0000H
    DEC B
    JP M,CF54H
    LD L,B

LCF54:
    LD A,(0B73H)
    ADD A,04H
    LD B,A

LCF5A:
    ADD HL,HL
    DJNZ CF5AH
    PUSH HL
    LD DE,FFD8H
    LD HL,03BFH
    LD B,C
    DEC B
    JP M,CF6EH
    JR Z,CF6EH

LCF6B:
    ADD HL,DE
    DJNZ CF6BH

LCF6E:
    EX DE,HL
    POP BC
    EXX
    LD BC,(0B7CH)
    LD DE,(0B7EH)
    EXX
    POP HL
    LD A,L
    OR A
    JR NZ,CF83H
    EXX
    PUSH DE
    EXX
    POP DE

LCF83:
    LD A,H
    OR A
    JR NZ,CF8BH
    EXX
    PUSH BC
    EXX
    POP BC

LCF8B:
    LD A,F9H
    CALL C9B3H
    RET C
    CALL C9BAH
    RET C
    JP CA65H

; EDITOR routine jump table; first byte is the routine count, followed by routine addresses.

; -----------------------------------------------------------------------------
; EDITOR DEVICE JUMP TABLE
; -----------------------------------------------------------------------------
;
; Counted table of the five public editor functions.
;
; The count byte is 05H. Entries select ED_INT, ED_CHIN_OUT, ED_BKIN_OUT, CU_POS, and CU_FIX
; respectively. The operating-system function dispatcher uses this table in the same way as the
; VIDEO table, allowing callers to use function numbers instead of hard-coded implementation
; addresses.
;
; Entry:
;   Function number selected by the OS dispatcher.
;
; Exit:
;   A routine address from the table.
;
; Effects:
;   Read-only ROM data.
;
; Destroys:
;   None.
; -----------------------------------------------------------------------------
EDITOR_JUMP_TABLE:
    DB 05H, A3H, CFH, 52H, D0H, 41H, D0H, 1DH, D0H, 13H, D0H                        ; |...R.A.....|

; Cursor blink phase at 0E48H: 00H..14H shows the saved cell and 80H..94H shows the cursor
; overlay.

; -----------------------------------------------------------------------------
; EDITOR 00 - CURSOR INTERRUPT
; -----------------------------------------------------------------------------
;
; Times the cursor blink and temporarily overlays the cursor glyph without damaging the underlying
; screen.
;
; The interrupt entry increments the cursor phase at 0E48H. Phases 00H..14H leave the saved
; character visible; phases 80H..94H show a cursor glyph. When the cursor is shown, LOCK_KEY
; selects the normal, inverse CTRL, inverse SHIFT, or inverse ALT cursor code (7FH, 9EH, 9FH, or
; 8FH).
;
; At the transition points the routine jumps to CU_SAVE_SCREEN at D420H or CU_RESTORE_SCREEN at
; D491H. Those helpers copy the complete character-shaped video area, not merely an ASCII code, so
; the cursor can overlay arbitrary graphics and restore them exactly.
;
; Entry:
;   No public arguments; invoked by the cursor/sound interrupt service.
;
; Exit:
;   No public return value.
;
; Effects:
;   May save, overwrite, and restore ten raster rows at the current cursor position; updates blink
;   phase.
;
; Destroys:
;   AF, BC, DE, HL, IY according to the save/restore path.
; -----------------------------------------------------------------------------
ED_INT:
    DB 3EH, 50H, D3H, 02H, 21H, 48H, 0EH, EDH, 4BH, 49H, 0EH, 34H, 3EH, 94H, 96H, 28H ; |>P..!H..KI.4>..(|
    DB 1CH, FEH, 80H, C0H, 77H, 3AH, 66H, 0BH, 16H, 7FH, B7H, 28H, 0CH, 16H, 9EH, 0FH ; |....w:f....(....|
    DB 38H, 07H, 16H, 9FH, 0FH, 38H, 02H, 16H, 8FH, 7AH, C3H, 20H, D4H, 77H, C3H, 91H ; |8....8...z. .w..|
    DB D4H                                                                          ; |.|

; EDITOR_INIT installs the RAM renderer dispatch at 0E68H, row width at 0E6BH, and character width
; at 0E6CH.

; -----------------------------------------------------------------------------
; EDITOR INITIALIZATION
; -----------------------------------------------------------------------------
;
; Clears the editor workspace, homes the cursor, initializes row metadata, and installs
; mode-specific render parameters.
;
; The routine clears 0E48H..0E67H, which contains cursor state and one occupancy byte for each of
; the 24 character rows. It sets the cursor to row 1, column 1 and fills the ASCII screen buffer
; at 0100H with spaces.
;
; It then indexes EDITOR_MODE_TABLE at D007H using GR_MODE and copies the selected renderer entry,
; row width, and bytes-per-character into the editor work area. The three descriptors are mode 2:
; D3ADH/40 columns/1 byte, mode 4: D3BCH/20 columns/2 bytes, and mode 16: D3D9H/10 columns/4
; bytes. Subsequent editor operations therefore avoid repeated mode tests.
;
; Entry:
;   GR_MODE at 0B73H.
;
; Exit:
;   Cursor and editor workspace reset; 0E68H renderer dispatch and 0E6BH row width are installed.
;
; Effects:
;   Clears the editor ASCII buffer and internal row metadata; does not itself clear video RAM (CLS
;   does that around this call).
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
EDITOR_INIT:
    DB 21H, 48H, 0EH, 06H, 20H, AFH, 77H, 23H, 10H, FCH, 21H, 01H, 01H, 22H, 49H, 0EH ; |!H.. .w#..!.."I.|
    DB 21H, 00H, 01H, 11H, 01H, 01H, 01H, FFH, 05H, 36H, 20H, EDH, B0H, 3AH, 73H, 0BH ; |!........6 ..:s.|
    DB 87H, 87H, 21H, 07H, D0H, 4FH, 09H, 11H, 68H, 0EH, 3EH, C3H, 12H, 13H, 0EH, 04H ; |..!..O..h.>.....|
    DB EDH, B0H, C9H                                                                ; |...|

; Editor mode descriptor table; each four-byte entry holds routine address, row width, and bits
; per pixel.

; -----------------------------------------------------------------------------
; EDITOR MODE DESCRIPTORS
; -----------------------------------------------------------------------------
;
; Three four-byte descriptors containing renderer address, row width, and video bytes per
; character.
;
; Entries are D3ADH,40H,01H for mode 2; D3BCH,20H,02H for mode 4; and D3D9H,10H,04H for mode 16.
; EDITOR_INIT copies the selected descriptor into RAM so the editor can render and move rows using
; a mode-independent set of helpers.
;
; Entry:
;   Index = GR_MODE (0..2).
;
; Exit:
;   Renderer entry and geometry constants.
;
; Effects:
;   Read-only ROM data.
;
; Destroys:
;   None.
; -----------------------------------------------------------------------------
EDITOR_MODE_TABLE:
    DB ADH, D3H, 40H, 01H, BCH, D3H, 20H, 02H, D9H, D3H, 10H, 04H                   ; |..@... .....|

; CFIX routine (EDITOR 04); notes the current cursor position.
; Current and saved editor cursor positions are kept at 0E49H and 0E4EH as one-based column/row
; pairs.

; -----------------------------------------------------------------------------
; EDITOR 04 - SAVE CURSOR POSITION
; -----------------------------------------------------------------------------
;
; Copies the current cursor position to the saved-position pair and marks it valid for the next
; input operation.
;
; The current row/column pair at 0E49H is copied to 0E4EH. Writing 80H to 0E4DH tells ED_CHIN_OUT
; and ED_BKIN_OUT to begin returning characters at this saved position rather than at the start of
; the paragraph. This permits a caller to place a prompt or other prefix before a subsequent input
; field.
;
; Entry:
;   No public arguments.
;
; Exit:
;   No public return value.
;
; Effects:
;   Updates saved cursor position and input-start state.
;
; Destroys:
;   AF, HL.
; -----------------------------------------------------------------------------
CU_FIX:
    LD HL,(0E49H)
    LD (0E4EH),HL
    LD A,80H
    JR D039H

; -----------------------------------------------------------------------------
; EDITOR 03 - POSITION CURSOR
; -----------------------------------------------------------------------------
;
; Validates and installs a requested editor row and column.
;
; B is the one-based column and C the one-based row. A zero in either register leaves that
; coordinate unchanged. The accepted column range is 1..16, 1..32, or 1..64 depending on mode;
; rows range from 1 to 24. Invalid coordinates return F6H without changing the corresponding valid
; position.
;
; Entry:
;   B = column (mode-dependent); C = row; zero means retain the current coordinate.
;
; Exit:
;   A = 00H on success; A = F6H for an impossible position.
;
; Effects:
;   Updates 0E49H cursor coordinates and clears the cursor-positioning status.
;
; Destroys:
;   AF, HL.
; -----------------------------------------------------------------------------
CU_POS:
    LD HL,(0E49H)
    LD A,B
    OR A
    JR Z,D02BH
    LD A,(0E6BH)
    CP B
    JR C,D03EH
    LD H,B

LD02B:
    LD A,C
    OR A
    JR Z,D035H
    LD A,18H
    CP C
    JR C,D03EH
    LD L,C

LD035:
    LD (0E49H),HL

LD038:
    XOR A

LD039:
    LD (0E4DH),A
    XOR A
    RET

LD03E:
    LD A,F6H
    RET

; -----------------------------------------------------------------------------
; EDITOR 02 - BLOCK INPUT/OUTPUT
; -----------------------------------------------------------------------------
;
; Routes counted block transfers through the editor's character input or output path.
;
; The routine prepares INK and PAPER line bytes, selects the generic OUT-CHARS or IN-CHARS
; wrapper, and supplies the editor-specific character routine as the per-byte operation. Output
; stores characters into the editor screen at the cursor; input reads the paragraph represented by
; the editor's ASCII buffer.
;
; The documented return codes are 00H for success and FAH when the transfer crosses the allowed
; high-memory boundary. The reference notes a defect in the generic boundary-checking wrapper, so
; callers should not assume every overrun is recovered cleanly.
;
; Entry:
;   DE = transfer buffer; BC = byte count; OS direction selects input or output.
;
; Exit:
;   A = 00H or FAH/error from the block transfer.
;
; Effects:
;   Reads/writes caller memory and editor ASCII/video state.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers.
; -----------------------------------------------------------------------------
ED_BKIN_OUT:
    EXX
    CALL D449H
    EXX
    LD HL,D0B7H
    JP P,C56DH
    LD HL,D058H
    JP C58FH

; Input-start state at 0E4DH: 00H starts a new edit, 01H requests the next character of a
; completed paragraph, and 80H uses CU_FIX's saved position.

; -----------------------------------------------------------------------------
; EDITOR 01 - CHARACTER INPUT/OUTPUT
; -----------------------------------------------------------------------------
;
; Implements interactive editor input and programmatic character output, including repeat reads
; from a completed paragraph.
;
; For output, the routine treats C as the character to insert and follows the same editor path as
; keyboard input. For input, it validates the saved cursor position, saves the underlying screen
; cell, enables the keyboard interrupt path, waits for a character, restores the screen cell, and
; then dispatches ESC, RETURN, or an ordinary printable/control code.
;
; A completed paragraph can be read back through repeated calls without another key press: the
; routine walks the editor ASCII buffer, returns each character, and finally emits RETURN while
; resetting the input state. ESC invalidates the paragraph and returns 1BH; CTRL+ESC propagates
; the STOP error.
;
; Entry:
;   For output, C = character code. For input, no character argument; the editor and keyboard
;   interrupt state provide it.
;
; Exit:
;   Input returns C = character and A = 00H, or an error code; output returns A = 00H on success.
;
; Effects:
;   Updates editor ASCII/video buffers, cursor state, and keyboard interrupt state.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers.
; -----------------------------------------------------------------------------
ED_CHIN_OUT:
    CALL D449H
    JP P,D0B7H
    LD A,50H
    LD (0003H),A
    OUT (02H),A
    LD A,(0E4DH)
    RRCA
    JP C,D0FAH

LD066:
    CALL D39CH
    LD BC,(0E49H)
    PUSH BC
    LD DE,(0E4EH)

LD072:
    LD A,C
    CP E
    JR C,D07CH
    JR NZ,D081H
    LD A,B
    CP D
    JR NC,D08BH

LD07C:
    CALL D038H
    JR D08BH

LD081:
    DEC C
    JR Z,D07CH
    DEC HL
    BIT 7,(HL)
    LD D,01H
    JR NZ,D072H

LD08B:
    POP BC
    CALL D477H
    LD A,13H
    LD (0E48H),A
    LD HL,0B10H
    RES 2,(HL)
    RST 30H
    SUB C
    SET 2,(HL)
    PUSH AF
    PUSH BC
    LD BC,(0E49H)
    CALL D491H
    POP BC
    POP AF
    RET NZ
    LD A,C
    CP 1BH
    JR Z,D038H
    CP 0DH
    JR Z,D0EBH
    CALL D124H
    JR D066H

LD0B7:
    LD A,50H
    LD (0003H),A
    OUT (02H),A
    LD HL,D038H
    PUSH HL
    LD A,C
    CP 0DH
    JR NZ,D0CDH
    LD A,01H
    LD (0E4AH),A
    RET

LD0CD:
    CP 0AH
    JR NZ,D0E6H
    LD BC,(0E49H)

LD0D5:
    LD A,C
    CALL D39FH
    INC C
    JR C,D0D5H
    DEC C
    PUSH BC
    CALL D363H
    POP AF
    LD (0E4AH),A
    RET

LD0E6:
    CALL D124H
    XOR A
    RET

LD0EB:
    LD A,(0E4DH)
    RLCA
    LD BC,(0E4EH)
    CALL NC,D370H
    LD (0E49H),BC

LD0FA:
    LD BC,(0E49H)
    LD A,C
    CALL D39FH
    CP B
    JR C,D11CH
    CALL D384H
    INC B
    LD A,(0E6BH)
    CP B
    JR NC,D112H
    LD B,01H
    INC C

LD112:
    LD (0E49H),BC
    LD C,(HL)
    LD A,01H
    JP D039H

LD11C:
    CALL D363H
    LD C,0DH
    JP D038H

; Editor state: 0E50H..0E67H contains 24 row occupancy bytes; low seven bits hold character count
; and bit 7 marks a full row. The ASCII screen itself is 24 rows of 40 bytes at 0100H.

; -----------------------------------------------------------------------------
; EDITOR CHARACTER AND COMMAND DISPATCH
; -----------------------------------------------------------------------------
;
; Stores printable characters in the ASCII screen, renders them, advances the cursor, and
; dispatches eleven editor commands.
;
; Codes 20H..DFH are written to the current ASCII-buffer position, rendered through the
; mode-specific routine at 0E68H, and followed by cursor advancement. When a row becomes full, the
; routine creates or shifts an editor row and preserves the row occupancy metadata.
;
; Control codes and codes above DFH are looked up in the table at D170H. The table maps LEFT,
; RIGHT, UP, DOWN, INS, DC, DEL, DL, IL, CEL, and TAB to their shared entry points. Each command
; maintains the paragraph model: row bytes at 0E50H..0E67H hold character counts, with bit 7
; marking a full row.
;
; Entry:
;   A = character or editor command code; 0E49H = current cursor position.
;
; Exit:
;   Editor buffers, display, and cursor reflect the character or command; flags indicate
;   command-specific outcomes.
;
; Effects:
;   Can move large portions of both the 0100H ASCII screen and video display; may insert/delete
;   rows and alter saved cursor state.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers, and stack temporaries.
;
; Note:
;   This is the main editor engine. D157H is its command-table search continuation; D191H-D1A3H
;   share the four cursor-arrow entry points.
; -----------------------------------------------------------------------------
EDITOR_CHAR_DISPATCH:
    CP 20H
    JR C,D157H
    CP E0H
    JR NC,D157H
    EX AF,AF'
    CALL D384H
    EX AF,AF'
    LD (HL),A
    LD BC,(0E49H)
    PUSH BC
    CALL D420H
    POP BC
    LD A,C
    CALL D39FH
    CP B
    JR NC,D143H
    LD (HL),B

LD143:
    INC B
    LD A,(0E6BH)
    CP B
    JR NC,D152H
    LD B,01H
    INC C
    BIT 7,(HL)
    CALL Z,D2CBH

LD152:
    LD (0E49H),BC
    RET

LD157:
    LD HL,D170H
    LD B,0BH

LD15C:
    CP (HL)
    INC HL
    LD E,(HL)
    INC HL
    LD D,(HL)
    INC HL
    JR Z,D167H
    DJNZ D15CH
    RET

LD167:
    LD BC,(0E49H)
    LD A,(0E6BH)
    EX DE,HL
    JP (HL)

; Built-in editor function jump table; entries contain control character and routine address.
; Control-code table: LEFT=13H, RIGHT=04H, UP=05H, DOWN=18H, INS=16H, DC=07H, DEL=08H, DL=19H,
; IL=0EH, CEL=0BH, TAB=09H.

; -----------------------------------------------------------------------------
; EDITOR COMMAND TABLE
; -----------------------------------------------------------------------------
;
; Eleven control-code/address pairs used by EDITOR_CHAR_DISPATCH.
;
; The entries select LEFT (13H), RIGHT (04H), UP (05H), DOWN (18H), INS (16H), DC (07H), DEL
; (08H), DL (19H), IL (0EH), CEL (0BH), and TAB (09H). Each pair stores the control code followed
; by a little-endian routine address.
;
; Entry:
;   A = editor control code.
;
; Exit:
;   Matching command entry address, or no action if the code is absent.
;
; Effects:
;   Read-only ROM data.
;
; Destroys:
;   None.
; -----------------------------------------------------------------------------
EDITOR_COMMAND_TABLE:
    DB 13H, 91H, D1H, 04H, 98H, D1H, 05H, 95H, D1H, 18H, 9EH, D1H, 16H, 05H, D2H, 07H ; |................|
    DB 87H, D2H, 08H, 78H, D2H, 19H, FDH, D1H, 0EH, F7H, D1H, 0BH, A8H, D1H, 09H, CDH ; |...x............|
    DB D1H                                                                          ; |.|

; -----------------------------------------------------------------------------
; EDITOR CURSOR ARROW HANDLER
; -----------------------------------------------------------------------------
;
; Shared four-entry handler for LEFT, UP, RIGHT, and DOWN cursor movement.
;
; The four command-table targets are arranged to fall through one another. LEFT decrements the
; column and, at column zero, falls through to UP; UP decrements the row; RIGHT increments the
; column and, at the row end, falls through to DOWN; DOWN increments the row but refuses to pass
; row 24. The resulting coordinates are stored at 0E49H.
;
; Entry:
;   BC = current one-based column/row; entry point identifies direction; 0E6BH = active row width.
;
; Exit:
;   BC and 0E49H contain the accepted cursor position.
;
; Effects:
;   Updates cursor coordinates only; boundary moves are ignored.
;
; Destroys:
;   AF, BC.
; -----------------------------------------------------------------------------
EDITOR_CURSOR_ARROWS:
    DEC B
    JR NZ,D1A3H
    LD B,A
    DEC C
    JR D1A2H
    INC B
    CP B
    JR NC,D1A3H
    LD B,01H
    INC C
    LD A,C
    CP 19H

LD1A2:
    RET Z

LD1A3:
    LD (0E49H),BC
    RET

; -----------------------------------------------------------------------------
; CEL - CLEAR TO PARAGRAPH END
; -----------------------------------------------------------------------------
;
; Deletes the text from the cursor through the end of its paragraph, including any now-empty rows.
;
; The current row is cleared from the cursor to its recorded end, the matching ASCII-buffer bytes
; are blanked, and the row occupancy byte is corrected. Following rows are removed with the
; row-delete helper until a non-full row marks the paragraph boundary.
;
; Entry:
;   Current cursor at 0E49H; row metadata at 0E50H..0E67H.
;
; Exit:
;   Paragraph tail is blank; cursor remains at its original position.
;
; Effects:
;   Writes video RAM and ASCII buffer; may delete multiple rows.
;
; Destroys:
;   AF, BC, DE, HL, stack temporaries.
; -----------------------------------------------------------------------------
EDITOR_CLEAR_TO_END:
    PUSH BC
    CALL D4ADH
    POP BC
    CALL D384H
    DEC B
    LD A,(0E6BH)
    SUB B

LD1B5:
    LD (HL),20H
    INC HL
    DEC A
    JR NZ,D1B5H
    CALL D39CH
    LD (HL),B
    INC C
    INC HL

LD1C1:
    RET NC

LD1C2:
    LD B,(HL)
    LD A,C
    EXX
    CALL D31EH
    EXX
    RLC B
    JR D1C1H

; -----------------------------------------------------------------------------
; TAB - ADVANCE TO NEXT TAB STOP
; -----------------------------------------------------------------------------
;
; Moves the cursor to the next tab position or starts a new row when the current row has no room.
;
; The current column is rounded up to the next multiple-of-eight tab stop in zero-based
; coordinates. If that position exceeds the active row width, the row is marked full and the
; cursor advances to the next row; otherwise the row occupancy metadata is extended when necessary
; and the new position is stored.
;
; Entry:
;   Current cursor and row occupancy metadata.
;
; Exit:
;   Cursor moves to the next tab stop; row state is updated.
;
; Effects:
;   May create a new editor row and alter ASCII/video buffers through row helpers.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
EDITOR_TAB:
    CALL D39CH
    EX AF,AF'
    LD A,B
    DEC A
    AND F8H
    ADD A,09H
    LD B,A
    LD A,(0E6BH)
    CP B
    JR NC,D1E8H
    OR 80H
    LD (HL),A
    LD B,01H
    INC C
    EX AF,AF'
    CALL NC,D2CBH

LD1E8:
    LD A,C
    CALL D39FH
    DEC B
    CP B
    JR NC,D1F1H
    LD (HL),B

LD1F1:
    INC B
    LD (0E49H),BC
    RET
    CALL D370H
    JP D2D6H
    CALL D370H
    CALL D39CH
    JR D1C2H

; -----------------------------------------------------------------------------
; INS - INSERT CHARACTER SPACE
; -----------------------------------------------------------------------------
;
; Inserts one character position at the cursor and carries overflow through the rest of the
; paragraph.
;
; INS scans row occupancy to find the paragraph end, computes how many rows must shift, and
; inserts space by moving ASCII and video content from the bottom upward. The last row may be
; discarded only when the paragraph already occupies the full screen; carry reports that loss
; condition.
;
; On the final inserted row the cursor column is used as the insertion point; earlier rows begin
; at column one. Full-row markers, row counts, and the saved cursor position are adjusted while
; the character data propagates.
;
; Entry:
;   Current cursor position and row metadata.
;
; Exit:
;   A new blank character position exists at the cursor; carry signals a full-screen overflow.
;
; Effects:
;   Moves large ASCII and video ranges and may insert a display row.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers, stack temporaries.
; -----------------------------------------------------------------------------
EDITOR_INSERT_CHAR:
    CALL D39CH
    CP B
    RET C
    LD E,01H
    JR D210H

LD20E:
    INC HL
    INC E

LD210:
    LD A,(HL)
    RLCA
    INC C
    JR C,D20EH
    INC (HL)
    LD A,(0E6BH)
    CP (HL)
    JR NZ,D233H
    LD A,E
    ADD A,C
    CP 31H
    JR NZ,D226H
    DEC (HL)
    SCF
    JR D234H

LD226:
    PUSH DE
    PUSH BC
    CALL D2CBH
    POP AF
    POP DE
    LD B,A
    LD A,C
    DEC A
    CALL D39FH

LD233:
    OR A

LD234:
    EX AF,AF'
    OR A
    DEC C
    DEC E
    PUSH DE
    PUSH BC
    PUSH HL
    PUSH AF
    JR Z,D240H
    LD B,01H

LD240:
    PUSH BC
    CALL D592H
    POP BC
    LD DE,0E6BH
    LD A,(DE)
    LD H,A
    LD L,C
    CALL D387H
    PUSH HL

LD24F:
    EX AF,AF'
    JR NC,D254H
    DEC HL
    INC B

LD254:
    LD A,(DE)
    SUB B
    LD C,A
    LD B,00H
    LD D,H
    LD E,L
    DEC HL
    JR Z,D260H
    LDDR

LD260:
    POP HL
    LD BC,FFC0H
    ADD HL,BC
    LD B,(HL)
    POP AF
    JR NZ,D26BH
    LD B,20H

LD26B:
    LD A,B
    LD (DE),A
    POP HL
    POP BC
    POP DE
    DEC HL
    JR NZ,D234H
    LD (0E49H),BC
    RET

; -----------------------------------------------------------------------------
; DEL - DELETE BEFORE CURSOR
; -----------------------------------------------------------------------------
;
; Moves the cursor left, then removes the character now under it.
;
; The compact entry decrements the column; at column zero it moves to the previous row's last
; occupied position when that row belongs to the paragraph. It then falls through to
; EDITOR_DELETE_AT, so DEL and DC share the same shift-left implementation.
;
; Entry:
;   Current cursor position and row occupancy metadata.
;
; Exit:
;   Cursor is moved left when possible and the character at the resulting position is removed.
;
; Effects:
;   May shift paragraph text and video contents left.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
EDITOR_DELETE_BEFORE:
    DEC B
    JR NZ,D283H
    DEC C
    RET Z
    LD A,C
    CALL D39FH
    RET NC
    LD B,A

LD283:
    LD (0E49H),BC

; -----------------------------------------------------------------------------
; DC - DELETE AT CURSOR
; -----------------------------------------------------------------------------
;
; Deletes the character at the cursor and shifts the remainder of the paragraph left across row
; boundaries.
;
; If the cursor is already at paragraph end there is no work. Otherwise the routine computes the
; number of bytes from the deletion point to the row end, shifts the following characters left,
; and pulls the first character from the next full row into the vacated last position. It
; continues until a non-full row is reached, then clears the final spare character and updates row
; metadata.
;
; Entry:
;   Current cursor, row metadata, and editor buffers.
;
; Exit:
;   The character at the cursor is gone; the remaining paragraph is contiguous.
;
; Effects:
;   Writes video RAM and ASCII buffer; may delete a row.
;
; Destroys:
;   AF, BC, DE, HL, stack temporaries.
; -----------------------------------------------------------------------------
EDITOR_DELETE_AT:
    CALL D39CH
    CP B
    RET C

LD28C:
    EX AF,AF'
    LD A,(HL)
    AND 7FH
    SUB B
    JR C,D2C3H
    PUSH HL
    PUSH AF
    PUSH DE
    PUSH BC
    CALL D542H
    POP BC
    POP DE
    LD H,B
    LD L,C
    CALL D387H
    EX AF,AF'
    LD A,(HL)
    JR NC,D2A6H
    LD (DE),A

LD2A6:
    LD D,H
    LD E,L
    INC HL
    POP AF
    PUSH BC
    JR Z,D2B2H
    LD C,A
    LD B,00H
    LDIR

LD2B2:
    LD A,20H
    LD (DE),A
    POP BC
    INC C
    LD B,01H
    POP HL
    BIT 7,(HL)
    INC HL
    SCF
    JR NZ,D28CH
    DEC HL
    DEC (HL)
    RET

LD2C3:
    DEC HL
    DEC (HL)
    RES 7,(HL)
    LD A,C
    JP D31EH

; -----------------------------------------------------------------------------
; INSERT EDITOR ROW
; -----------------------------------------------------------------------------
;
; Makes a blank row at the requested position and rolls lower rows down when necessary.
;
; The requested row is marked occupied, then the next row is inspected. If the display bottom is
; reached, the routine performs a screen roll; otherwise it shifts lower video rows, row metadata,
; and the corresponding 40H-byte ASCII rows downward. The new row is cleared to spaces and any
; saved cursor row below the insertion is incremented.
;
; Entry:
;   HL = row-metadata address; C = one-based row number to make available.
;
; Exit:
;   A blank row exists at row C; metadata and saved cursor state are consistent.
;
; Effects:
;   Moves screen and ASCII-buffer rows; may discard the bottom row.
;
; Destroys:
;   AF, BC, DE, HL, stack temporaries.
; -----------------------------------------------------------------------------
EDITOR_INSERT_ROW:
    SET 7,(HL)
    LD A,C
    CP 19H
    JR Z,D311H
    INC HL
    LD A,(HL)
    OR A
    RET Z

LD2D6:
    PUSH BC
    CALL D509H
    POP BC
    PUSH BC
    LD A,19H
    SUB C
    LD HL,0E66H
    LD DE,0E67H
    PUSH DE
    LD B,00H
    LD C,A
    LDDR
    INC DE
    EX DE,HL
    LD (HL),C
    POP HL
    RES 7,(HL)
    RRA
    RR C
    RRA
    RR C
    LD B,A
    LD HL,06BFH
    LD DE,06FFH
    LDDR
    LD B,40H
    LD A,20H

LD304:
    INC DE
    LD (DE),A
    DJNZ D304H
    POP BC
    LD HL,0E4EH
    LD A,(HL)
    SUB C
    RET C
    INC (HL)
    RET

; -----------------------------------------------------------------------------
; ROLL EDITOR SCREEN UP
; -----------------------------------------------------------------------------
;
; Deletes the first display row, shifts all following rows upward, and homes the cursor on the
; last row.
;
; This is the full-screen form of row deletion. It delegates to EDITOR_DELETE_ROW with row 1, then
; places the cursor at row 24, column 1. It is used when insertion reaches the bottom of a full
; display.
;
; Entry:
;   Editor row state.
;
; Exit:
;   Rows have moved up; cursor is at the first column of row 24.
;
; Effects:
;   Moves video and ASCII rows and discards the old top row.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
EDITOR_ROLL_SCREEN:
    LD A,01H
    CALL D31EH
    LD BC,0118H
    LD (0E49H),BC
    RET

; -----------------------------------------------------------------------------
; DELETE EDITOR ROW
; -----------------------------------------------------------------------------
;
; Removes the selected row and shifts all lower rows upward in both representations of the screen.
;
; The routine adjusts or invalidates the saved cursor row, moves video rows and 40H-byte ASCII
; rows upward, clears the final row to spaces, and shifts row occupancy bytes. It can begin at any
; row, making it the common primitive for CEL, DC, insert overflow handling, and screen roll.
;
; Entry:
;   A = one-based row number to delete.
;
; Exit:
;   Rows below A occupy their preceding positions; the final row is blank.
;
; Effects:
;   Writes video RAM, ASCII buffer, row metadata, and saved cursor state.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
EDITOR_DELETE_ROW:
    PUSH AF
    LD C,A
    LD HL,0E4EH
    SUB (HL)
    CALL Z,D039H
    JR NC,D32AH
    DEC (HL)

LD32A:
    CALL D4E0H
    POP BC
    LD A,B
    CALL D39FH
    PUSH HL
    LD L,B
    LD H,01H
    CALL D387H
    EX DE,HL
    LD HL,0040H
    ADD HL,DE
    LD A,18H
    SUB B
    PUSH AF
    JR Z,D34FH
    LD C,00H
    RRA
    RR C
    RRA
    RR C
    LD B,A
    LDIR

LD34F:
    LD B,40H

LD351:
    DEC HL
    LD (HL),20H
    DJNZ D351H
    POP AF
    LD C,A
    POP HL
    LD D,H
    LD E,L
    INC HL
    JR Z,D360H
    LDIR

LD360:
    XOR A
    LD (DE),A
    RET

; -----------------------------------------------------------------------------
; MOVE CURSOR TO NEXT ROW
; -----------------------------------------------------------------------------
;
; Advances the cursor to column one of the next row, inserting a row if the display is full.
;
; At ordinary rows it increments C, sets B=1, and stores the position. At row 24 it falls through
; to the screen-roll path so typing can continue while preserving the editor's bottom-of-screen
; behavior.
;
; Entry:
;   Current cursor row in C.
;
; Exit:
;   Cursor is at column one of the following row.
;
; Effects:
;   May roll the screen and update buffers.
;
; Destroys:
;   AF, BC.
; -----------------------------------------------------------------------------
EDITOR_NEXT_ROW:
    LD A,C
    CP 18H
    JR Z,D311H
    INC C
    LD B,01H
    LD (0E49H),BC
    RET

; -----------------------------------------------------------------------------
; FIND PARAGRAPH START
; -----------------------------------------------------------------------------
;
; Moves the cursor to the first row of the paragraph containing it.
;
; The routine walks upward through row occupancy bytes until it finds an empty row or the top of
; the display. It then stores column one of the first occupied row as the cursor position.
; Paragraph boundaries are therefore defined by blank rows, not by explicit delimiters.
;
; Entry:
;   Current cursor position and row occupancy metadata.
;
; Exit:
;   0E49H points to column one of the containing paragraph's first row.
;
; Effects:
;   Updates cursor position only.
;
; Destroys:
;   AF, BC, HL.
; -----------------------------------------------------------------------------
EDITOR_PARAGRAPH_START:
    LD BC,(0E49H)

LD374:
    OR A
    DEC C
    LD A,C
    CALL NZ,D39FH
    JR C,D374H
    INC C
    LD B,01H
    LD (0E49H),BC
    RET

; -----------------------------------------------------------------------------
; CURSOR TO ASCII BUFFER ADDRESS
; -----------------------------------------------------------------------------
;
; Converts the one-based editor cursor position into an address in the 0100H ASCII screen.
;
; The row is multiplied by 40H and the column is added after converting both coordinates to
; zero-based values. The resulting address is stored in 0E4BH-0E4CH and returned in HL. This is
; the central bridge between cursor operations and the editor's logical screen.
;
; Entry:
;   0E49H = one-based cursor row/column.
;
; Exit:
;   HL and 0E4BH-0E4CH = address of the cursor's ASCII byte.
;
; Effects:
;   Updates the cached ASCII address.
;
; Destroys:
;   AF, HL.
; -----------------------------------------------------------------------------
ASCII_CURSOR_ADDRESS:
    LD HL,(0E49H)

LD387:
    DEC H
    DEC L
    LD A,H
    ADD A,A
    ADD A,A
    LD H,L
    RR H
    RRA
    RR H
    RRA
    LD L,A
    LD A,H
    ADD A,01H
    LD H,A
    LD (0E4BH),HL
    RET

; -----------------------------------------------------------------------------
; ROW STATUS LOOKUP
; -----------------------------------------------------------------------------
;
; Returns the occupancy byte and its address for the cursor's current row.
;
; The row number in 0E49H is converted to an address in 0E50H..0E67H. The returned A value has bit
; 7 normalized away as the character count; carry preserves whether the row was full.
;
; Entry:
;   A or 0E49H = current one-based row.
;
; Exit:
;   HL = row-status byte; A = count with bit 7 clear; carry = row-full flag.
;
; Effects:
;   No writes.
;
; Destroys:
;   AF, HL.
; -----------------------------------------------------------------------------
ROW_STATUS_ADDRESS:
    LD A,(0E49H)

LD39F:
    ADD A,4FH
    LD L,A
    LD A,0EH
    ADC A,00H
    LD H,A
    LD A,(HL)
    RLCA
    OR A
    RR A
    RET

; Editor renderers write ten raster rows. Their widths are one, two, and four video bytes for
; modes 2, 4, and 16.

; -----------------------------------------------------------------------------
; EDITOR GLYPH RENDERER - MODE 2
; -----------------------------------------------------------------------------
;
; Renders one ten-row glyph using one video byte per character row.
;
; The renderer reads each glyph byte, combines it with the INK/PAPER line bytes, and writes one
; byte at each of ten video rows separated by 40H. Its geometry is 40 characters per row and one
; packed video byte per character.
;
; Entry:
;   HL = glyph source; DE/HL and B/C = editor-selected destination and colors.
;
; Exit:
;   One glyph is present in video RAM.
;
; Effects:
;   Writes ten video bytes.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers.
; -----------------------------------------------------------------------------
EDITOR_RENDER_MODE2:
    LD DE,0040H
    EXX

LD3B1:
    LD A,(HL)
    EXX
    AND C
    XOR B
    LD (HL),A
    ADD HL,DE
    EXX
    INC HL
    DJNZ D3B1H
    RET

; -----------------------------------------------------------------------------
; EDITOR GLYPH RENDERER - MODE 4
; -----------------------------------------------------------------------------
;
; Renders one glyph in four-color mode, packing two logical pixels per video byte.
;
; The renderer transforms each pair of glyph pixels into the two-bit color representation required
; by mode 4 and writes two adjacent bytes per raster row, for ten rows. It is selected through the
; descriptor copied by EDITOR_INIT.
;
; Entry:
;   Glyph source and editor color work state.
;
; Exit:
;   One mode-4 glyph is present in video RAM.
;
; Effects:
;   Writes twenty video bytes.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers.
; -----------------------------------------------------------------------------
EDITOR_RENDER_MODE4:
    EXX

LD3BD:
    LD A,(HL)
    EXX
    LD D,A
    RRCA
    RRCA
    RRCA
    RRCA
    XOR D
    AND C
    LD E,A
    AND 0FH
    XOR D
    AND C
    XOR B
    LD (HL),A
    INC L
    XOR E
    LD (HL),A
    LD DE,003FH
    ADD HL,DE
    EXX
    INC HL
    DJNZ D3BDH
    RET

; -----------------------------------------------------------------------------
; EDITOR GLYPH RENDERER - MODE 16
; -----------------------------------------------------------------------------
;
; Renders one glyph in sixteen-color mode, packing one two-bit glyph pair into each of four bytes
; per raster row.
;
; The mode-16 renderer expands each glyph row into four video bytes using the INK/PAPER pair and
; the TVC two-bit pixel encoding. Ten raster rows are written with a four-byte character width,
; giving ten characters per display row.
;
; Entry:
;   Glyph source and editor color work state.
;
; Exit:
;   One mode-16 glyph is present in video RAM.
;
; Effects:
;   Writes forty video bytes.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers.
; -----------------------------------------------------------------------------
EDITOR_RENDER_MODE16:
    EXX

LD3DA:
    LD A,(HL)
    EXX
    RLA
    LD E,A
    SBC A,A
    LD D,A
    RL E
    SBC A,A
    XOR D
    AND 55H
    XOR D
    AND C
    XOR B
    LD (HL),A
    INC L
    RL E
    SBC A,A
    LD D,A
    RL E
    SBC A,A
    XOR D
    AND 55H
    XOR D
    AND C
    XOR B
    LD (HL),A
    INC L
    RL E
    SBC A,A
    LD D,A
    RL E
    SBC A,A
    XOR D
    AND 55H
    XOR D
    AND C
    XOR B
    LD (HL),A
    INC L
    RL E
    SBC A,A
    LD D,A
    RL E
    SBC A,A
    XOR D
    AND 55H
    XOR D
    AND C
    XOR B
    LD (HL),A
    LD DE,003DH
    ADD HL,DE
    EXX
    INC HL
    DJNZ D3DAH
    RET

; The cursor backup buffer at 0E6DH..0E94H holds the raw video cell under the cursor.

; -----------------------------------------------------------------------------
; SAVE CHARACTER CELL UNDER CURSOR
; -----------------------------------------------------------------------------
;
; Copies the complete video character cell under the cursor to the cursor backup buffer.
;
; The routine derives the cursor's video address, selects the active character width (1, 2, or 4
; bytes), and copies ten raster rows into 0E6DH..0E94H. Saving raw video bytes preserves graphics
; or unusual colors that would be lost if the cursor remembered only an ASCII code.
;
; Entry:
;   A = cursor glyph code for subsequent rendering; BC = cursor position.
;
; Exit:
;   0E6DH..0E94H contains the original ten-row cell.
;
; Effects:
;   Reads video RAM and writes the cursor backup buffer.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers.
; -----------------------------------------------------------------------------
CU_SAVE_SCREEN:
    EX AF,AF'
    CALL D459H
    PUSH HL
    EX AF,AF'
    LD C,A
    LD B,00H
    LD L,C
    LD H,B
    ADD HL,HL
    ADD HL,HL
    ADD HL,BC
    ADD HL,HL
    BIT 7,C
    LD BC,C474H
    JR Z,D439H
    LD BC,0240H

LD439:
    ADD HL,BC
    LD B,0AH
    EXX
    LD A,(0E96H)
    LD B,A
    LD A,(0E95H)
    LD C,A
    POP HL
    JP 0E68H

; -----------------------------------------------------------------------------
; EDITOR INK/PAPER BYTE PREPARATION
; -----------------------------------------------------------------------------
;
; Derives the mode-specific INK and PAPER line bytes used by the editor renderers.
;
; The helper calls the video color conversion routines, stores PAPER at 0E96H, and stores INK XOR
; PAPER at 0E95H. The XOR form makes the renderer's pairwise pixel operations compact while
; retaining the displayed INK/PAPER colors.
;
; Entry:
;   Current video color variables and GR_MODE.
;
; Exit:
;   0E95H = transformed INK byte; 0E96H = PAPER byte.
;
; Effects:
;   Updates editor color work variables.
;
; Destroys:
;   AF, BC.
; -----------------------------------------------------------------------------
EDITOR_COLOR_BYTES:
    EX AF,AF'
    CALL CC05H
    LD (0E96H),A
    CALL CC0DH
    XOR B
    LD (0E95H),A
    EX AF,AF'
    RET

; Video cell address formula: 8000H + (row*10)*40H + column*character_width.

; -----------------------------------------------------------------------------
; EDITOR CURSOR TO VIDEO ADDRESS
; -----------------------------------------------------------------------------
;
; Converts an editor row/column pair into the first video byte of its character cell.
;
; The column is zero-based and scaled by one, two, or four according to mode. The row is
; multiplied by ten raster lines and by 40H bytes per raster line; the base 8000H is folded in
; through the carry before the final address is assembled. The result is the cell's first video
; byte.
;
; Entry:
;   BC = one-based editor column/row; 0B73H = graphics mode.
;
; Exit:
;   HL = first video byte of the character cell.
;
; Effects:
;   No writes.
;
; Destroys:
;   AF, DE, HL.
; -----------------------------------------------------------------------------
EDITOR_VIDEO_ADDRESS:
    DEC B
    LD A,(0B73H)
    OR A
    JR Z,D465H

LD460:
    SLA B
    DEC A
    JR NZ,D460H

LD465:
    DEC C
    LD A,C
    ADD A,A
    ADD A,A
    ADD A,C
    ADD A,A
    LD H,A
    XOR A
    SRL H
    RRA
    SCF
    RR H
    RRA
    OR B
    LD L,A
    RET

; -----------------------------------------------------------------------------
; SAVE CURSOR CELL
; -----------------------------------------------------------------------------
;
; Copies the ten-raster-row cell at the cursor into the editor backup area.
;
; CU_SAVE_CELL calls EDITOR_VIDEO_ADDRESS, then copies the active character width from each of ten
; raster rows to 0E6DH. Its raw-cell strategy keeps the cursor overlay reversible even when the
; underlying cell is not text.
;
; Entry:
;   BC = cursor position; editor mode descriptor active.
;
; Exit:
;   Backup buffer contains the original cell.
;
; Effects:
;   Reads video RAM and writes 0E6DH..0E94H.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
CU_SAVE_CELL:
    CALL D459H
    LD DE,0E6DH
    LD A,(0E6CH)
    LD C,A
    LD B,0AH

LD483:
    PUSH BC
    PUSH HL
    LD B,00H
    LDIR
    POP HL
    LD C,40H
    ADD HL,BC
    POP BC
    DJNZ D483H
    RET

; -----------------------------------------------------------------------------
; RESTORE CELL UNDER CURSOR
; -----------------------------------------------------------------------------
;
; Restores the saved ten-row cursor cell to video RAM after the cursor overlay is removed.
;
; The inverse of CU_SAVE_CELL: it derives the current cell address and copies the saved width
; bytes from 0E6DH..0E94H back into ten raster rows. ED_INT uses it at the end of the visible
; cursor phase.
;
; Entry:
;   BC = cursor position; backup buffer populated by CU_SAVE_CELL.
;
; Exit:
;   Underlying video cell is restored exactly.
;
; Effects:
;   Writes video RAM.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
CU_RESTORE_SCREEN:
    CALL D459H
    LD DE,0E6DH
    LD A,(0E6CH)
    LD C,A
    LD B,0AH

LD49D:
    EX DE,HL
    PUSH BC
    PUSH DE
    LD B,00H
    LDIR
    EX DE,HL
    POP HL
    LD C,40H
    ADD HL,BC
    POP BC
    DJNZ D49DH
    RET

; -----------------------------------------------------------------------------
; CLEAR CHARACTER ROW TAIL
; -----------------------------------------------------------------------------
;
; Clears the cursor row from a selected character position through its right edge.
;
; The routine computes the number of character-width bytes remaining in the row, fills ten raster
; rows with the PAPER byte, and leaves the cursor's row visually blank to the right. It is used by
; insertion and deletion operations before the corresponding ASCII-buffer shift.
;
; Entry:
;   HL = cursor cell video address; editor mode and PAPER byte active.
;
; Exit:
;   The row tail is filled with PAPER.
;
; Effects:
;   Writes up to ten raster rows in video RAM.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
CU_CLEAR_ROW_TAIL:
    CALL D459H
    LD A,(0E96H)
    EX AF,AF'
    LD A,3FH
    SUB L
    AND 3FH
    JR Z,D4D3H
    LD C,A
    LD A,L
    LD B,0AH

LD4BF:
    AND 3FH
    OR L
    LD L,A
    EX AF,AF'
    LD (HL),A
    LD D,H
    LD E,L
    INC E
    PUSH BC
    LD B,00H
    LDIR
    POP BC
    EX DE,HL
    EX AF,AF'
    DJNZ D4BFH
    RET

; -----------------------------------------------------------------------------
; CLEAR ONE CHARACTER CELL
; -----------------------------------------------------------------------------
;
; Fills one ten-raster-row character cell with the current PAPER byte.
;
; HL identifies the first video byte of the cell. The active character width determines how many
; adjacent bytes are filled on each of ten raster rows, with a 40H step between rows.
;
; Entry:
;   HL = cell start address.
;
; Exit:
;   Cell is filled with PAPER.
;
; Effects:
;   Writes video RAM.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
CU_CLEAR_CELL:
    LD DE,0040H
    LD B,0AH
    LD A,(0E96H)

LD4DB:
    LD (HL),A
    ADD HL,DE
    DJNZ D4DBH
    RET

; Video row deletion moves the rows below the selected row upward, then fills the bottom
; ten-raster-row strip with PAPER.

; -----------------------------------------------------------------------------
; MOVE VIDEO ROWS UP
; -----------------------------------------------------------------------------
;
; Deletes a character row from the display by copying all following rows upward and clearing the
; bottom row.
;
; C is the one-based row. If it is row 24, only that row is cleared. Otherwise the routine
; computes the byte span from the next row through the final row and performs one bulk move, then
; fills the final ten-raster-row strip with PAPER.
;
; Entry:
;   C = character row 1..24.
;
; Exit:
;   Rows below C occupy the preceding row; the bottom row is blank.
;
; Effects:
;   Moves and clears video RAM.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
EDITOR_DELETE_ROW_VIDEO:
    LD A,C
    CP 18H
    JR Z,D4F9H
    LD B,01H
    CALL D459H
    EX DE,HL
    LD HL,B980H
    OR A
    SBC HL,DE
    LD B,H
    LD C,L
    LD HL,0280H
    ADD HL,DE
    LDIR

LD4F9:
    LD HL,B980H
    LD DE,B981H

LD4FF:
    LD BC,027FH
    LD A,(0E96H)
    LD (HL),A
    LDIR
    RET

; Video row insertion moves lower rows downward and clears the newly available ten-raster-row
; strip.

; -----------------------------------------------------------------------------
; MOVE VIDEO ROWS DOWN
; -----------------------------------------------------------------------------
;
; Inserts a blank character row on the display by shifting lower rows down.
;
; The routine computes the number of rows from C to the bottom, multiplies by ten raster lines and
; 40H bytes per line, moves the block backward, and clears the newly available row. Row 24 is
; simply cleared because there is no lower row to preserve.
;
; Entry:
;   C = character row 1..24.
;
; Exit:
;   A blank row exists at C; lower rows have moved down.
;
; Effects:
;   Moves and clears video RAM.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
EDITOR_INSERT_ROW_VIDEO:
    LD A,18H
    SUB C
    JR Z,D4F9H
    LD C,A
    ADD A,A
    ADD A,A
    ADD A,C
    ADD A,A
    LD B,A
    XOR A
    SRL B
    RRA
    SRL B
    RRA
    LD C,A
    LD HL,B97FH
    LD DE,BBFFH
    LDDR
    INC HL
    LD D,H
    LD E,L
    INC DE
    JR D4FFH

; -----------------------------------------------------------------------------
; MOVE CHARACTER CELLS
; -----------------------------------------------------------------------------
;
; Copies a rectangular run of character-width video cells across ten raster rows.
;
; The active mode supplies the cell width in bytes. For each of ten raster rows, the routine uses
; HL as source, DE as destination, and BC as byte count, then advances both addresses by 40H.
; Entering at D52EH/D530H bypasses the default setup and permits callers to move arbitrary byte
; widths.
;
; Entry:
;   HL = source cell; DE = destination; mode-derived width/count.
;
; Exit:
;   The requested cells are copied.
;
; Effects:
;   Writes video RAM; source remains unchanged.
;
; Destroys:
;   AF, BC, DE, HL.
;
; Note:
;   This primitive is reused for editor insertion, deletion, row shifts, and can support user
;   screen manipulation when called with valid parameters.
; -----------------------------------------------------------------------------
EDITOR_MOVE_CELLS:
    LD A,(0E6CH)
    LD C,A

; Alternate entry into MOVE_CELLS: callers can supply their own byte count and bypass the default
; character-width setup.

LD52E:
    LD B,0AH

LD530:
    PUSH BC
    PUSH HL
    PUSH DE
    LD B,00H
    LDIR
    LD C,40H
    POP HL
    ADD HL,BC
    EX DE,HL
    POP HL
    ADD HL,BC
    POP BC
    DJNZ D530H
    RET

; SHIFT_LEFT propagates a full-row overflow by importing the next row's first character into the
; freed final cell.

; -----------------------------------------------------------------------------
; SHIFT CHARACTERS LEFT
; -----------------------------------------------------------------------------
;
; Moves a row's suffix left from a selected position and carries a full-row overflow into the next
; row.
;
; A gives the number of characters to move, B the starting column, C the row, and HL the
; row-status byte. The routine converts the character count to mode-specific video bytes, calls
; MOVE_CELLS, clears the vacated tail, and, when the row was full, imports the next row's first
; character into the freed final cell.
;
; Entry:
;   A = character count (Z means zero); B = start column; C = row; HL = row-status byte.
;
; Exit:
;   The row suffix has moved left and occupancy metadata is corrected.
;
; Effects:
;   Writes video RAM and may propagate data across rows.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
EDITOR_SHIFT_LEFT:
    JR Z,D562H
    PUSH HL
    PUSH BC
    LD E,A
    LD A,(0B73H)
    OR A
    JR Z,D552H

LD54D:
    SLA E
    DEC A
    JR NZ,D54DH

LD552:
    CALL D459H
    LD C,E
    LD D,H
    LD A,(0E6CH)
    ADD A,L
    LD E,A
    EX DE,HL
    CALL D52EH
    POP BC
    POP HL

LD562:
    LD B,(HL)
    BIT 7,B
    JR Z,D578H
    PUSH BC
    RES 7,B
    CALL D459H
    EX DE,HL
    POP BC
    INC C
    LD B,01H
    CALL D459H
    JP D52AH

; -----------------------------------------------------------------------------
; CLEAR CELL AT POSITION
; -----------------------------------------------------------------------------
;
; Clears one character cell at a supplied editor row and column.
;
; The routine computes the cell address from B/C, determines the active width (1, 2, or 4 bytes),
; fills that width with PAPER on each of ten raster rows, and advances by 40H between rows.
;
; Entry:
;   B = one-based column; C = one-based row.
;
; Exit:
;   Selected cell is blank.
;
; Effects:
;   Writes video RAM.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
EDITOR_CLEAR_CELL_AT:
    CALL D459H
    LD C,0AH
    LD DE,0040H

LD580:
    LD A,(0E6CH)
    LD B,A
    LD A,(0E96H)
    PUSH HL

LD588:
    LD (HL),A
    INC HL
    DJNZ D588H
    POP HL
    ADD HL,DE
    DEC C
    JR NZ,D580H
    RET

; SHIFT_RIGHT is the screen-side primitive used by INS; its Z flag chooses clearing versus
; importing the previous row's final character.

; -----------------------------------------------------------------------------
; SHIFT CHARACTERS RIGHT
; -----------------------------------------------------------------------------
;
; Moves a row suffix right to make an insertion slot, optionally importing the previous row's last
; character.
;
; Z selects whether the original position is cleared or filled from the previous row. The routine
; obtains the row's final occupied character, calculates the mode-specific byte count, copies
; cells rightward across ten raster rows, and then repairs the original position and row metadata.
; INS enters here for the first cell of a row.
;
; Entry:
;   Z = clear original slot or import previous-row character; B = starting column; C = row; HL =
;   row-status byte.
;
; Exit:
;   A right-shifted insertion space exists; the original position is repaired according to Z.
;
; Effects:
;   Writes video RAM and may move one character across a row boundary.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
EDITOR_SHIFT_RIGHT:
    PUSH AF
    LD A,(HL)
    AND 7FH
    SUB B
    JR Z,D5CEH
    LD E,A
    LD A,(0B73H)
    OR A
    JR Z,D5A5H

LD5A0:
    SLA E
    DEC A
    JR NZ,D5A0H

LD5A5:
    PUSH HL
    PUSH BC
    LD B,(HL)
    RES 7,B
    CALL D459H
    DEC HL
    LD C,E
    LD B,00H
    EX DE,HL
    LD A,(0E6CH)
    LD L,A
    LD H,B
    ADD HL,DE
    EX DE,HL
    LD B,0AH

LD5BB:
    PUSH BC
    PUSH HL
    PUSH DE
    LD B,00H
    LDDR
    LD C,40H
    POP HL
    ADD HL,BC
    EX DE,HL
    POP HL
    ADD HL,BC
    POP BC
    DJNZ D5BBH
    POP BC
    POP HL

LD5CE:
    POP AF
    JR Z,D578H
    EX DE,HL
    PUSH BC
    CALL D459H
    POP BC
    EX DE,HL
    DEC C
    DEC HL
    LD B,(HL)
    RES 7,B
    CALL D459H
    JP D52AH

; KEYBOARD routine jump table; first byte is the routine count, followed by routine addresses.
; Keyboard OS service table: count followed by KBD-INT, KBD-CHIN, a reserved NOP, and KBD-STAT
; entries.

; -----------------------------------------------------------------------------
; KEYBOARD SERVICE TABLE
; -----------------------------------------------------------------------------
;
; Counted OS dispatch table for the keyboard device.
;
; The first byte gives the number of keyboard functions. The following little-endian pointers
; select the interrupt scanner, character input, the deliberately empty block function, and
; keyboard status. The table is the stable OS-facing entry mechanism; the routines below are the
; implementation behind those entries.
;
; Note:
;   Function 0 is called from the periodic interrupt service; function 1 waits for a character;
;   function 2 is a compatibility NOP; function 3 reports availability.
; -----------------------------------------------------------------------------
KEYBOARD_JUMP_TABLE:
    INC B
    DEC L
    SUB 18H
    SUB 2CH
    SUB 12H
    DB D6H                                                                          ; |.|

; -----------------------------------------------------------------------------
; KEYBOARD INITIALIZATION
; -----------------------------------------------------------------------------
;
; Restores keyboard timing, lock state, matrices, and transient state to power-on defaults.
;
; The initializer selects a roughly 0.6-second auto-repeat delay (DELAY-KEY), a 60-ms repeat rate
; (RATE-KEY), and clears LOCK-KEY. It zeroes both ten-byte keyboard matrices, PICTURE at 0B51H and
; OLD-PIC at 0B5BH, then clears the remaining keyboard work area at 0BE5H-0BEDH. The result is an
; explicitly empty keyboard state rather than a scan-dependent state left over from reset.
;
; Entry:
;   No input; normally reached during system device initialization.
;
; Exit:
;   Keyboard variables and matrices contain their default values.
;
; Effects:
;   Clears pending key, modifier, repeat, and HOLD state.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
KEYBOARD_INIT:
    LD A,1EH
    LD (0B65H),A
    LD A,03H
    DB 32H                                                                          ; |2|

; DELAY-KEY default is 1EH (about 0.6 s at 20 ms ticks); RATE-KEY default is 03H (about 60 ms
; between repeats); LOCK-KEY starts clear.
    LD H,A
    DEC BC
    XOR A
    LD (0B66H),A
    LD HL,0B51H
    LD DE,0B52H
    DB 01H                                                                          ; |.|

; Clear PICTURE and OLD-PIC, each ten bytes for the ten physical keyboard rows.
    INC DE
    NOP
    LD (HL),A
    LDIR

; Clear keyboard event and repeat work bytes at 0BE5H-0BEFH.
    LD HL,0BE5H
    LD DE,0BE6H
    LD C,09H
    LD (HL),A
    LDIR
    RET

; KB STATUS routine (BILL 03); checks if a key is pressed.
; C=00 means no pending key; C=FF means the code in 0BE9H is ready. A=00 reports a healthy
; keyboard service.

; -----------------------------------------------------------------------------
; KEYBOARD STATUS
; -----------------------------------------------------------------------------
;
; Reports whether the interrupt scanner has a character waiting.
;
; The scanner marks 0BE5H when it has accepted a key code. This routine copies that marker to C
; and returns A=00 as the device-health status. C=00 means no key is pending; C=FF means KB_CHIN
; can consume the code in 0BE9H.
;
; Entry:
;   No device-specific input.
;
; Exit:
;   C=00 or FF; A=00.
;
; Effects:
;   Does not consume the pending character.
; -----------------------------------------------------------------------------
KB_STATUS:
    LD A,(0BE5H)
    LD C,A
    XOR A
    RET

; KB CHIN routine (BILL 01); reads the pressed key code.
; Poll the pending-key marker until the interrupt scanner publishes a code; acknowledge it before
; checking STOP-FLAG.

; -----------------------------------------------------------------------------
; KEYBOARD CHARACTER INPUT
; -----------------------------------------------------------------------------
;
; Waits until the interrupt scanner publishes a key code, then returns it.
;
; The routine polls the pending-key byte at 0BE5H. Until the interrupt routine sets it, the loop
; yields only by being interrupted and continues polling. Once set, the character code is copied
; from 0BE9H to C and the pending marker is acknowledged by clearing 0BE5H.
;
; Entry:
;   No input; the keyboard interrupt routine supplies the code asynchronously.
;
; Exit:
;   C=character code and A=00 on success. A=F5H indicates the STOP condition generated by
;   CTRL+ESC.
;
; Effects:
;   Consumes one pending key and observes STOP-FLAG at 0B16H.
;
; Destroys:
;   AF, C, HL.
; -----------------------------------------------------------------------------
KB_CHIN:
    LD HL,0BE5H

LD61B:
    LD A,(HL)
    OR A
    JR Z,D61BH
    LD A,(0BE9H)
    LD C,A
    LD (HL),00H
    LD A,(0B16H)
    OR A

; CTRL+ESC is reported to character consumers as status F5H after the pending key has been
; acknowledged.
    RET Z
    LD A,F5H

; -----------------------------------------------------------------------------
; KEYBOARD BLOCK FUNCTION
; -----------------------------------------------------------------------------
;
; Empty keyboard block-I/O entry retained for the uniform OS device interface.
;
; Keyboard has no block transfer operation. The counted jump table nevertheless reserves function
; 2 so all device classes have the same function numbering. The entry is a single return and
; performs no work.
; -----------------------------------------------------------------------------
KB_BLOCK_NOP:
    RET

; KBD-INT runs from the periodic interrupt path: scan, decode one transition, queue a code, and
; manage auto-repeat/HOLD.

; -----------------------------------------------------------------------------
; KEYBOARD INTERRUPT SERVICE
; -----------------------------------------------------------------------------
;
; Scans, debounces, decodes, and queues keyboard transitions on each periodic interrupt.
;
; This is the keyboard's main worker and is invoked by the interrupt dispatcher. It canonicalizes
; LOCK-KEY to one of CTRL, SHIFT, or ALT-LOCK states, scans the ten physical rows into PICTURE,
; and gives special treatment to the LOCK key so a held lock key changes mode only once and
; suppresses other key processing until it is released.
;
; For ordinary scans it compares PICTURE with OLD-PIC, selects one newly pressed bit, and asks
; KEY_MATRIX_DECODE for the code in C. A successful code is published in 0BE9H and marked
; available in 0BE5H; the repeat counter is reloaded from DELAY-KEY. CTRL+P enters HOLD, where
; scanning continues internally until another accepted key releases the hold. CTRL+ESC sets
; STOP-FLAG and is returned as the F5H status by character consumers.
;
; Entry:
;   Periodic interrupt context; IY is used for the keyboard work area during scanning.
;
; Exit:
;   A newly accepted code is queued in 0BE9H; E=FF indicates no new code or HOLD.
;
; Effects:
;   Updates PICTURE, OLD-PIC, modifier locks, repeat counters, STOP-FLAG, and pending-key state.
;
; Destroys:
;   AF, BC, DE, HL and alternate register pairs as required by helpers.
;
; Note:
;   Auto-repeat is suppressed for ordinary matrix transitions until DELAY-KEY expires, then
;   proceeds at RATE-KEY. Joystick directions in the last two rows receive alternating repeat
;   treatment when two directions are held.
; -----------------------------------------------------------------------------
KB_INT:
    LD A,(0B66H)

; LOCK-KEY uses only CTRL, SHIFT, and ALT-LOCK bits; NEG/AND leaves at most the lowest asserted
; lock bit.
    AND 0BH
    LD B,A
    NEG
    AND B
    LD (0B66H),A
    CALL D7A5H
    LD HL,0BE7H
    BIT 5,(IY+06H)
    JR Z,D652H
    LD A,(HL)
    OR A
    RET NZ

; While LOCK is held, modifier changes are applied once and ordinary key decoding is suspended
; until release.
    DEC (HL)
    LD A,01H
    CALL D790H
    LD (0B66H),A
    RET NZ

; Decode the current modifier combination, then ask KEY_MATRIX_DECODE for one newly pressed matrix
; bit.

LD652:
    LD (HL),B
    LD A,04H
    CALL D790H
    LD (0BE8H),A

LD65B:
    XOR A

; On a new code, publish C in 0BE9H, set 0BE5H=FFH, reload the repeat delay at 0BEAH, and return
; to the interrupt dispatcher.

LD65C:
    CALL D6C7H
    INC E
    JR Z,D672H
    LD A,C
    LD (0BE9H),A
    LD A,FFH
    LD (0BE5H),A
    LD A,(0B65H)
    LD (0BEAH),A
    RET

LD672:
    LD A,(HL)
    OR A
    JR NZ,D65CH

; Auto-repeat decrements DELAY-KEY first and RATE-KEY second; a code is generated only when one of
; the counters expires.
    LD HL,0BEAH
    CALL D6C0H
    INC HL
    CALL NC,D6C0H
    RET NC
    LD A,(0BEEH)
    LD C,A
    LD DE,(0BECH)
    LD HL,0B64H
    SBC HL,DE
    EX DE,HL
    JR Z,D69BH
    OR A
    EX DE,HL
    LD HL,0B64H
    SBC HL,DE
    EX DE,HL
    JR NZ,D6A4H

; Joystick directions in the last two rows alternate when two directions are held, preventing one
; direction from starving the other.

LD69B:
    LD D,66H
    AND D
    JR Z,D6A4H
    XOR D
    AND (HL)
    JR NZ,D6B5H

LD6A4:
    LD A,C
    AND (HL)
    JR NZ,D6B5H
    LD HL,0B5BH
    LD B,0AH

LD6AD:
    LD (HL),A
    INC HL
    DJNZ D6ADH
    LD (0BEBH),A
    RET

; If the held key disappeared from OLD-PIC, clear its repeat state; otherwise temporarily remove
; its old bit and let normal edge decoding repeat it.

LD6B5:
    CPL
    AND (HL)
    LD (HL),A
    LD A,(0B67H)
    LD (0BEBH),A
    JR D65BH

; A one-byte countdown helper returns Z when the counter is zero and carry when this decrement
; reached zero.

LD6C0:
    LD A,(HL)
    OR A
    RET Z
    DEC (HL)
    RET NZ
    SCF
    RET

; Compare current PICTURE against OLD-PIC; equal bits are stable, while only newly asserted bits
; survive for decoding.

; -----------------------------------------------------------------------------
; KEYBOARD MATRIX DECODER
; -----------------------------------------------------------------------------
;
; Converts one newly pressed matrix bit into a mode-dependent TVC character or function code.
;
; The routine compares each of the ten PICTURE bytes with the corresponding OLD-PIC byte. Stable
; bits disappear; a newly asserted bit is isolated with two's-complement masking, written back to
; OLD-PIC, and retained with its row/column location. This edge detector means a key is accepted
; once per press rather than once per scan.
;
; The isolated bit chooses one of eight ten-byte columns in the keyboard code tables. A key value
; combines the current modifier keys (SHIFT, CTRL, ALT) with the persistent LOCK-KEY state: SHIFT
; and ALT are reversible, while CTRL remains effective regardless of lock mode. The selected table
; supplies C. The routine also handles CTRL+P HOLD and tests CTRL+ESC, preserving HL=0BE6H as the
; HOLD-state location for its caller.
;
; Entry:
;   Z=0 requests a fresh physical scan; IY points at PICTURE.
;
; Exit:
;   C=accepted keyboard code; E=FF if no new key or HOLD; HL=0BE6H for HOLD bookkeeping.
;
; Effects:
;   Updates OLD-PIC, modifier state, HOLD/STOP handling, and selected keyboard work bytes.
;
; Destroys:
;   AF, BC, DE, HL and alternate register pairs.
;
; Note:
;   A keyboard row contains eight bits and there are ten rows, so each mode table is 8x10=80
;   bytes. The matrix table uses bits b7 through b0 as the eight columns and row numbers 0 through
;   9 within each column.
; -----------------------------------------------------------------------------
KEY_MATRIX_DECODE:
    CALL NZ,D7A5H
    RES 3,(IY+06H)
    RES 4,(IY+07H)
    RES 0,(IY+07H)
    RES 5,(IY+06H)
    LD HL,0BE6H
    LD DE,000AH
    EXX
    LD HL,0B65H
    LD DE,0B5BH

LD6E7:
    DEC DE
    DEC HL
    EXX
    DEC E
    RET M
    EXX
    LD A,(DE)
    LD B,A
    XOR (HL)
    CPL
    AND (HL)
    LD (HL),A
    XOR B
    JR Z,D6E7H
    LD B,A
    NEG

; Two's-complement masking isolates the lowest newly pressed bit so simultaneous transitions are
; accepted one at a time.
    AND B
    LD B,A
    XOR (HL)
    LD (HL),A
    LD A,B
    LD (0BECH),HL
    LD (0BEEH),A
    LD A,50H

; Store the active bit and its row address; these values index the eight-column, ten-row code
; tables.

LD706:
    SUB 0AH
    SRL B
    JR NC,D706H
    EXX
    ADD A,E
    LD E,A
    LD A,(0BE8H)
    LD B,A
    LD A,(0B66H)
    XOR B
    LD B,A
    PUSH HL
    CALL D747H
    POP HL
    LD A,(0B68H)
    INC A
    RET Z
    LD A,(HL)
    OR A
    LD A,C
    JR Z,D73CH
    LD A,(0B11H)
    AND F0H
    OR 07H
    OUT (03H),A
    IN A,(58H)
    AND 18H
    JR Z,D740H
    XOR A
    LD (0B16H),A
    JR D740H

LD73C:
    CP 10H
    JR Z,D743H

LD740:
    LD (HL),00H
    RET

LD743:
    DEC (HL)
    LD E,FFH
    RET

; KEY_CODE_TABLE_SELECT: B combines persistent LOCK-KEY and currently held modifiers to select one
; of four code tables.

; -----------------------------------------------------------------------------
; KEYBOARD CODE-TABLE SELECTOR
; -----------------------------------------------------------------------------
;
; Selects the normal, SHIFT-lock, CTRL-lock, or ALT-lock code table and returns the code for a
; matrix position.
;
; DE identifies the matrix position and B is the combined lock/modifier key. The selector uses a
; small state matrix: the SHIFT and ALT combinations toggle their corresponding lock state, while
; CTRL always selects the CTRL interpretation. It then indexes one of the four 80-byte tables and
; returns the byte in C.
;
; Exit:
;   C=the code corresponding to the selected matrix position and modifier state.
;
; Effects:
;   If the selected code is CTRL+ESC, sets STOP-FLAG and returns the ESC code path.
; -----------------------------------------------------------------------------
KEY_CODE_TABLE_SELECT:
    LD HL,D784H
    PUSH HL
    LD HL,D85FH
    BIT 2,B
    RET NZ
    BIT 0,B
    JR Z,D774H
    LD HL,D7BFH
    ADD HL,DE
    LD A,(HL)
    CP 61H
    JR C,D774H
    CP 7BH
    JR C,D76AH
    CP 90H
    JR C,D774H
    CP 99H
    JR NC,D774H

; CTRL table is independent of lock state; SHIFT/ALT cases choose the table that implements their
; reversible lock behavior.

LD76A:
    LD HL,D80FH
    BIT 1,B
    RET Z
    LD HL,D7BFH
    RET

LD774:
    LD HL,D80FH
    BIT 1,B
    RET NZ
    LD HL,D8AFH
    BIT 3,B
    RET NZ
    POP HL
    LD HL,D7BFH

; Normal-table result is returned in C; CTRL+ESC sets STOP-FLAG and returns the ESC code path.
    ADD HL,DE
    LD C,(HL)
    LD A,C
    CP FFH
    RET NZ
    LD (0B16H),A
    LD C,1BH
    RET

; Modifier helper gives CTRL priority, then reports SHIFT=02H, ALT=08H, or no modifier=00H.

; -----------------------------------------------------------------------------
; MODIFIER KEY STATE
; -----------------------------------------------------------------------------
;
; Reports currently held CTRL, SHIFT, and ALT modifier keys.
;
; The caller supplies the CTRL result in A. If CTRL is active it is preserved; otherwise the
; routine checks the keyboard matrix for SHIFT and then ALT, returning 02H, 08H, or 00H. This
; deliberately gives CTRL priority because it is not a reversible lock in the table-selection
; rules.
;
; Exit:
;   A=modifier selector: 04H for CTRL supplied by the caller, 02H for SHIFT, 08H for ALT, or 00H
;   for none.
; -----------------------------------------------------------------------------
KEY_MODIFIER_STATE:
    BIT 4,(IY+07H)
    RET NZ
    LD A,02H
    BIT 3,(IY+06H)
    RET NZ
    BIT 0,(IY+07H)
    LD A,08H
    RET NZ
    XOR A
    RET

; KEY_MATRIX_READ preserves the upper nibble of PORT03 and selects rows 0..9 through its lower
; nibble.

; -----------------------------------------------------------------------------
; PHYSICAL KEYBOARD SCAN
; -----------------------------------------------------------------------------
;
; Selects rows 0 through 9 on port 03H and stores the active-low matrix in PICTURE.
;
; The upper four bits of the port-03 mirror are preserved; the lower nibble selects a keyboard
; row. For each row the routine writes the row number to port 03H, reads port 58H, complements the
; active-low result, and stores one byte at 0B51H. IY is set to the beginning of this ten-byte
; PICTURE matrix for the decoder.
;
; Entry:
;   Port-03 mirror at 0B11H and a physically connected keyboard matrix.
;
; Exit:
;   Ten bytes at 0B51H-0B5AH, one per row; IY points to 0B51H.
;
; Effects:
;   Writes the row-select port and replaces the current keyboard picture.
;
; Destroys:
;   AF, BC, DE, HL, IY.
; -----------------------------------------------------------------------------
KEY_MATRIX_READ:
    LD A,(0B11H)
    AND F0H
    LD C,A
    LD HL,0B51H
    PUSH HL
    POP IY
    LD B,0AH

; Read port 58H, complement its active-low columns, and store one row byte at PICTURE; repeat for
; all ten rows.

LD7B3:
    LD A,C
    OUT (03H),A
    IN A,(58H)
    CPL
    LD (HL),A
    INC C
    INC HL
    DJNZ D7B3H
    RET

; Keyboard matrix decode tables for normal, SHIFT, CTRL, and ALT modes.
; Normal keyboard code table: 8 columns x 10 rows, indexed by matrix bit and row number.

; -----------------------------------------------------------------------------
; KEYBOARD CODE TABLES
; -----------------------------------------------------------------------------
;
; Four 80-byte lookup tables for normal, SHIFT-lock, CTRL-lock, and ALT-lock keyboard modes.
;
; Each table is organized as eight columns of ten rows. The matrix bit selects a column and the
; row number selects an element; each byte is the resulting ASCII, control, joystick, or function
; code. Values marked FFH represent unused matrix positions. The table layout is part of the
; decoder algorithm, not merely a printable-character catalogue.
;
; Note:
;   The normal table begins at D7BFH, SHIFT-lock at D80FH, CTRL-lock at D85FH, and ALT-lock at
;   D8AFH. The final column is followed immediately by printer-table data, so the 320-byte extent
;   must remain a single data region when disassembling.
; -----------------------------------------------------------------------------
KEYBOARD_CODE_TABLES:
    DB 34H, 37H, 72H, 75H, 66H, 6AH, 76H, 6DH, 2AH, 2AH, 31H, 94H, 71H, 70H, 61H, 91H ; |47rufjvm**1.qpa.|
    DB 79H, 2DH, 13H, F3H, 92H, 93H, 40H, 96H, 3CH, 98H, 2AH, 20H, 04H, E4H, 36H, 2AH ; |y-....@.<.* ..6*|
    DB 7AH, 5BH, 68H, 0DH, 6EH, 2AH, 01H, E1H, 30H, 97H, 3BH, 95H, 5CH, 90H, 2AH, 1BH ; |z[h.n*..0.;.\.*.|
    DB 06H, E6H, 32H, 39H, 77H, 6FH, 73H, 6CH, 78H, 2EH, 18H, F8H, 33H, 38H, 65H, 69H ; |..29woslx...38ei|
    DB 64H, 6BH, 63H, 2CH, 05H, E5H, 35H, 5EH, 74H, 5DH, 67H, 08H, 62H, 2AH, 16H, 43H ; |dkc,..5^t]g.b*.C|

; SHIFT-lock keyboard code table.
    DB 21H, 3DH, 52H, 55H, 46H, 4AH, 56H, 4DH, 2AH, 2AH, 27H, 84H, 51H, 50H, 41H, 81H ; |!=RUFJVM**'.QPA.|
    DB 59H, 5FH, 13H, F3H, 82H, 83H, 60H, 86H, 3EH, 88H, 2AH, 20H, 04H, E4H, 2FH, 23H ; |Y_....`.>.* ../#|
    DB 5AH, 7BH, 48H, 0DH, 4EH, 2AH, 01H, E1H, 26H, 87H, 24H, 85H, 7CH, 80H, 2AH, 1BH ; |Z{H.N*..&.$.|.*.|
    DB 06H, E6H, 22H, 29H, 57H, 4FH, 53H, 4CH, 58H, 3AH, 18H, F8H, 2BH, 28H, 45H, 49H ; |..")WOSLX:..+(EI|
    DB 44H, 4BH, 43H, 3FH, 05H, E5H, 25H, 7EH, 54H, 7DH, 47H, 07H, 42H, 2AH, 16H, 49H ; |DKC?..%~T}G.B*.I|

; CTRL-lock keyboard code table; control/function codes are independent of persistent SHIFT/ALT
; lock state.
    DB 8BH, 9CH, 12H, 15H, 06H, 0AH, 16H, 0DH, 2AH, 2AH, 99H, DCH, 11H, 10H, 01H, D9H ; |........**......|
    DB 19H, 1FH, 13H, F3H, DAH, DBH, 00H, DEH, 3CH, 98H, 2AH, 20H, 04H, E4H, 8CH, 8EH ; |........<.* ....|
    DB 1AH, 1BH, 08H, 0DH, 0EH, 2AH, 01H, E1H, 89H, DFH, 3BH, DDH, 1CH, CFH, 2AH, FFH ; |.....*....;...*.|
    DB 06H, E6H, 8AH, 9DH, 17H, 0FH, 13H, 0CH, 18H, 2EH, 18H, F8H, 9AH, 8DH, 05H, 09H ; |................|
    DB 04H, 0BH, 03H, 2CH, 05H, E5H, 9BH, 1EH, 14H, 1DH, 07H, 08H, 02H, 2AH, 16H, 53H ; |...,.........*.S|

; ALT-lock keyboard code table.
    DB A4H, A7H, C2H, C5H, B6H, BAH, C6H, BDH, 2AH, 2AH, A1H, D4H, C1H, C0H, B1H, D1H ; |........**......|
    DB C9H, ADH, 13H, F3H, D2H, D3H, B0H, D6H, ACH, D8H, 2AH, 20H, 04H, E4H, A6H, AAH ; |..........* ....|
    DB CAH, CBH, B8H, 0DH, BEH, 2AH, 01H, E1H, A0H, D7H, ABH, D5H, CCH, D0H, 2AH, 1BH ; |.....*........*.|
    DB 06H, E6H, A2H, A9H, C7H, BFH, C3H, BCH, C8H, AEH, 18H, F8H, A3H, A8H, B5H, B9H ; |................|
    DB B4H, BBH, B3H, AFH, 05H, E5H, A5H, CEH, C4H, CDH, B7H, 08H, B2H, 2AH, 16H, 4CH ; |.............*.L|

; PRINTER routine jump table.
; Printer OS service table: reserved function, PR-CHOUT, and PR-BKOUT.

; -----------------------------------------------------------------------------
; PRINTER SERVICE TABLE
; -----------------------------------------------------------------------------
;
; Counted OS dispatch table for parallel-printer character and block output.
;
; The table has three function slots. Function 0 is the uniform-device-interface placeholder,
; function 1 points to PAR_CHOUT, and function 2 points to PAR_BKOUT. The device logic itself is
; intentionally small because the printer performs character rendering and reports readiness
; through ACK.
; -----------------------------------------------------------------------------
PRINTER_JUMP_TABLE:
    DB 03H, 29H, D9H, 0CH, D9H, 06H, D9H                                            ; |.).....|

; Block output delegates each byte to PR-CHOUT through the bounded C56DH helper; DE is source and
; BC is count.

; -----------------------------------------------------------------------------
; PARALLEL PRINTER BLOCK OUTPUT
; -----------------------------------------------------------------------------
;
; Routes a memory block through the printer character-output routine with HI-MEM checking.
;
; DE points to the first ASCII character and BC gives the block length. PAR_BKOUT supplies
; PAR_CHOUT as the per-character worker to the shared bounded block-output helper at C56DH. The
; helper checks the usable high-memory limit and propagates STOP or memory-limit status.
;
; Entry:
;   DE=source address; BC=character count.
;
; Exit:
;   A=00 success, F5H for CTRL+ESC, or FAH for a high-memory violation.
;
; Effects:
;   Sends each character to the parallel printer and may stop early on user abort.
; -----------------------------------------------------------------------------
PAR_BKOUT:
    LD HL,D90CH
    JP C56DH

; PR-CHOUT waits for ACK on port 59H bit 7, writes C to port 01H, and pulses port 06H bit 7 low
; then high.

; -----------------------------------------------------------------------------
; PARALLEL PRINTER CHARACTER OUTPUT
; -----------------------------------------------------------------------------
;
; Waits for printer ACK, writes one character, and generates the STROBE pulse.
;
; The routine first checks STOP-FLAG so CTRL+ESC can abort output. It polls bit 7 of port 59H
; until the printer acknowledges readiness. Interrupts are disabled while the character is written
; to port 01H and the STROBE line on port 06H is driven low then high, preserving all unrelated
; port-06 bits from PORT06. Interrupts are then restored and A=00 reports success.
;
; Entry:
;   C=character code; port mirrors at 0B13H and 0B16H provide control state.
;
; Exit:
;   A=00 success or F5H after CTRL+ESC.
;
; Effects:
;   Writes printer data and STROBE hardware; briefly masks interrupts.
;
; Destroys:
;   AF; port state is changed only in printer data and STROBE bits.
; -----------------------------------------------------------------------------
PAR_CHOUT:
    LD A,(0B16H)
    INC A
    DB 3EH                                                                          ; |>|

; Interrupts are disabled only around the data/STROBE sequence so the printer sees a clean pulse.
    PUSH AF
    RET Z
    IN A,(59H)
    RLCA
    JR NC,D90CH
    DI
    LD A,C
    OUT (01H),A
    LD A,(0B13H)
    AND 7FH
    OUT (06H),A
    OR 80H
    OUT (06H),A
    EI
    XOR A
    RET

; SOUND routine jump table.
; Sound service table: SOUND-INT, two reserved NOP functions, and TONE-SET.

; -----------------------------------------------------------------------------
; SOUND SERVICE TABLE
; -----------------------------------------------------------------------------
;
; Counted OS dispatch table for sound interrupt service and tone setup.
;
; The four slots are SOUND-INT, two reserved NOP entries, and TONE-SET. The empty slots preserve
; the same function numbering discipline used for the other devices, while the interrupt slot is
; enabled only while a tone is active.
; -----------------------------------------------------------------------------
SOUND_JUMP_TABLE:
    DB 04H, 33H, D9H, 60H, D9H, 60H, D9H, 61H, D9H                                  ; |.3.`.`.a.|

; SOUND-INT decrements the 20-ms duration counter and turns off sound when it reaches zero or
; STOP-FLAG is set.

; -----------------------------------------------------------------------------
; SOUND INTERRUPT SERVICE
; -----------------------------------------------------------------------------
;
; Counts down the active tone and disables sound when its duration or STOP request expires.
;
; SOUND-ACTIVE at 0B14H is FFH while a tone is running. On each periodic interrupt the routine
; checks STOP-FLAG and decrements the remaining duration at 0BEFH. When the count reaches zero, or
; CTRL+ESC requests an abort, it clears SOUND-ACTIVE and the duration, removes SOUND from INT-DES,
; and clears the sound-enable and sound-interrupt bits in the port-05 mirror.
;
; Entry:
;   Periodic interrupt context; duration and port mirrors are maintained by TONE_SET.
;
; Exit:
;   Sound remains active while duration is nonzero; otherwise the hardware is silenced.
;
; Effects:
;   Updates 0B14H, 0BEFH, INT-DES at 0B10H, and port-05 mirror at 0B12H.
;
; Destroys:
;   AF and temporary registers.
; -----------------------------------------------------------------------------
TONE_INT:
    DB 3AH, 14H, 0BH, 3CH, C0H, 3AH, 16H, 0BH, 3CH, 28H, 08H, 3AH, EFH, 0BH, 3DH, 32H ; |:..<.:..<(.:..=2|
    DB EFH, 0BH                                                                     ; |..|

; Disable SOUND in INT-DES and clear port-05 sound and sound-interrupt bits while preserving
; unrelated port state.
    DB C0H, 32H, 14H, 0BH, 32H, EFH, 0BH, 3AH, 10H, 0BH, F6H, 08H, 32H, 10H, 0BH, 3AH ; |.2..2..:....2..:|
    DB 12H, 0BH, E6H, CFH, 32H, 12H, 0BH, D3H, 05H, 3EH, F5H                        ; |....2....>.|

; Reserved sound functions are a single RET; the slots exist for uniform function numbering.

; -----------------------------------------------------------------------------
; SOUND RESERVED FUNCTION
; -----------------------------------------------------------------------------
;
; Empty sound-device entry used for reserved function slots.
;
; Both sound functions 1 and 2 point here. The single RET keeps the service table uniform without
; introducing an operation that the BASIC 1.2 ROM does not implement.
; -----------------------------------------------------------------------------
TONE_NOP:
    DB C9H                                                                          ; |.|

; TONE-SET input: B duration in 20-ms units, C volume 0..15, DE 12-bit PITCH divider.

; -----------------------------------------------------------------------------
; PROGRAM AND START A TONE
; -----------------------------------------------------------------------------
;
; Programs pitch, volume, duration, and interrupt participation for a new tone.
;
; B supplies duration in 20-ms units, C supplies a 0-15 volume, and DE supplies the 12-bit PITCH
; divider. If the previous tone is not marked interruptible, the routine waits until it is nearly
; complete; otherwise it replaces it. It records the new duration in the sound work area and
; translates the four-bit volume into the port-06 bit positions b5-b2.
;
; The high PITCH nibble is written through the port-05 mirror with the sound-enable bit set, and
; the low PITCH byte is sent to port 04H. SOUND-ACTIVE is asserted and the sound bit is enabled in
; INT-DES. Because the same divider supplies serial timing, SER-OK at 0B71H is cleared to indicate
; that the serial clock is no longer trustworthy while sound is active. A zero duration disables
; the tone instead of enabling the interrupt service.
;
; Entry:
;   B=duration in 20-ms ticks; C=volume 0..15; DE=PITCH (0..4095; 4095 denotes no audible tone).
;
; Exit:
;   A=00 on successful setup, or F5H after CTRL+ESC.
;
; Effects:
;   Programs ports 04H-06H and sound work variables; may replace an active tone and alter
;   serial-clock validity.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
TONE_SET:
    DB 3AH, 15H, 0BH, 3CH, 28H, 07H, 3AH, EFH, 0BH, D6H, 02H, 30H, F3H, AFH, 32H, 14H ; |:..<(.:....0..2.|
    DB 0BH, 3AH, 16H                                                                ; |.:.|

; Map volume bits b3..b0 into port-06 bits b5..b2 and preserve the remaining PORT06 mirror bits.
    DB 0BH, 3CH, 28H, CEH, 78H, B7H, 20H, 05H, CDH, 46H, D9H, AFH, C9H, 32H, EFH, 0BH ; |.<(.x. ..F...2..|
    DB 79H, E6H, 0FH, 07H, 07H, 4FH                                                 ; |y....O|

; Enable the tone with PITCH high nibble through port 05H and write the low PITCH byte to port
; 04H.
    DB 3AH, 13H, 0BH, E6H, C3H, B1H, 32H, 13H, 0BH, D3H, 06H, 7AH, E6H, 0FH, F6H, 10H ; |:.....2....z....|
    DB 57H, 3AH, 12H, 0BH, E6H, C0H, B2H, 32H, 12H, 0BH, D3H, 05H, 7BH, D3H, 04H    ; |W:.....2....{..|

; Mark SOUND-ACTIVE and route sound interrupts through INT-DES; SER-OK is cleared because the
; divider no longer supplies serial timing.
    DB 3EH, FFH, 32H, 14H, 0BH, 32H, 71H, 0BH, 3AH, 10H, 0BH, E6H, F7H, 32H, 10H, 0BH ; |>.2..2q.:....2..|
    DB AFH, C9H                                                                     ; |..|

; CASSETTE routine jump table.
; Cassette service table: reserved, character I/O, block I/O, open/create, close, and verify.

; -----------------------------------------------------------------------------
; CASSETTE SERVICE TABLE
; -----------------------------------------------------------------------------
;
; Counted dispatch table for cassette operations whose implementations live in EXTH.
;
; The six slots cover the reserved function, character I/O, block I/O, open/create, close, and
; verify. D4 contains only small forwarding stubs; the actual cassette protocol, buffering, CRC,
; and motor handling are implemented in the extension ROM.
; -----------------------------------------------------------------------------
CASSETTE_JUMP_TABLE:
    DB 06H, E7H, D9H, D2H, D9H, D7H, D9H, C8H, D9H, CDH, D9H, DCH, D9H              ; |.............|

; Cassette operations are forwarding stubs; the selected EXTH routine is entered through the
; common FFF0H gateway.

; -----------------------------------------------------------------------------
; CASSETTE OPEN OR CREATE FORWARDER
; -----------------------------------------------------------------------------
;
; Forwards cassette open/create to EXTH through the common bank-switch gateway.
;
; Entry:
;   OS cassette calling convention.
;
; Exit:
;   Status returned by EXTH cassette code.
;
; Effects:
;   Selects the extension-ROM implementation through the FFF0H gateway.
; -----------------------------------------------------------------------------
CAS_OPEN_CREATE:
    LD HL,F3E2H
    JR D9DFH

; -----------------------------------------------------------------------------
; CASSETTE CLOSE FORWARDER
; -----------------------------------------------------------------------------
;
; Forwards cassette close to EXTH through the common bank-switch gateway.
;
; Entry:
;   OS cassette calling convention.
;
; Exit:
;   Status returned by EXTH cassette code.
;
; Effects:
;   Selects the extension-ROM implementation through the FFF0H gateway.
; -----------------------------------------------------------------------------
CAS_CLOSE:
    LD HL,F3E7H
    JR D9DFH

; -----------------------------------------------------------------------------
; CASSETTE CHARACTER I/O FORWARDER
; -----------------------------------------------------------------------------
;
; Forwards cassette character input/output to EXTH.
;
; Entry:
;   OS cassette character-I/O calling convention.
;
; Exit:
;   Character or status returned by EXTH.
;
; Effects:
;   Selects the extension-ROM implementation through the FFF0H gateway.
; -----------------------------------------------------------------------------
CAS_CHIN_OUT:
    LD HL,F3D8H
    JR D9DFH

; -----------------------------------------------------------------------------
; CASSETTE BLOCK I/O FORWARDER
; -----------------------------------------------------------------------------
;
; Forwards cassette block input/output to EXTH.
;
; Entry:
;   OS cassette block-I/O calling convention.
;
; Exit:
;   Status returned by EXTH.
;
; Effects:
;   Selects the extension-ROM implementation through the FFF0H gateway.
; -----------------------------------------------------------------------------
CAS_BKIN_OUT:
    LD HL,F3DDH
    JR D9DFH

; CAS VERIFY routine (CAS 05); verifies cassette data.

; -----------------------------------------------------------------------------
; CASSETTE VERIFY FORWARDER
; -----------------------------------------------------------------------------
;
; Forwards cassette verification to EXTH.
;
; Entry:
;   OS cassette calling convention.
;
; Exit:
;   Verification status returned by EXTH.
;
; Effects:
;   Selects the extension-ROM implementation through the FFF0H gateway.
; -----------------------------------------------------------------------------
CAS_VERIFY:
    LD HL,F3ECH

LD9DF:
    JP FFF0H

; CAS_INIT forwards cassette work-area initialization to EXTH.

; -----------------------------------------------------------------------------
; CASSETTE INITIALIZATION FORWARDER
; -----------------------------------------------------------------------------
;
; Forwards cassette initialization to EXTH.
;
; Entry:
;   No device-specific input.
;
; Exit:
;   Status returned by EXTH.
;
; Effects:
;   Selects the extension-ROM implementation through the FFF0H gateway.
; -----------------------------------------------------------------------------
CAS_INIT:
    LD HL,F3F1H
    JR D9DFH
    RET
    JR Z,DA4DH
    ADD HL,HL
    JR NZ,DA36H
    LD D,E
    LD C,H

; BASIC workspace begins here; IX is based at 1700H and cold start clears the workspace through
; 19EFH.

; -----------------------------------------------------------------------------
; BASIC WORKSPACE INITIALIZATION
; -----------------------------------------------------------------------------
;
; Builds the BASIC workspace, clears program state, initializes devices, and enters the sign-on
; path.
;
; IX is set to the 16-byte BASIC status area at 1700H. On a cold start the routine clears
; 1700H-19EFH, installs the initial error/dispatch stubs, and sets VLOMEM and TEXT to 19EFH. It
; then initializes program pointers, BASIC-stack state, DATA pointers, the symbol-chain boundary,
; random-number seed state, and TOP.
;
; After device initialization it invokes the startup display: the palette is loaded, the VIDEOTON
; and TV COMPUTER picture is drawn, and the routine waits for the first key. The sign-on text is
; emitted using embedded length-prefixed strings. Once input arrives it selects four-colour mode,
; prints the BASIC 1.2 copyright banner and free-byte count, and converges with the warm-reset
; continuation before entering the command loop.
;
; Entry:
;   Entry from reset/cartridge handling with warm/cold status already established.
;
; Exit:
;   Initialized BASIC environment; control eventually reaches BASIC_COMMAND_LOOP.
;
; Effects:
;   May erase the BASIC workspace and resets program, symbol, stack, editor, video, keyboard, and
;   cassette state.
;
; Destroys:
;   AF, BC, DE, HL, IX and stack contents used during initialization.
;
; Note:
;   The user program begins at TEXT/VLOMEM, while the BASIC stack grows down from HI-MEM. The
;   source books describe this routine as the boundary between system startup and the high-level
;   BASIC interpreter.
; -----------------------------------------------------------------------------
BASIC_INIT:
    LD HL,1700H
    PUSH HL
    POP IX
    LD A,(0B21H)
    OR A
    JP NZ,DAD3H
    LD BC,02EFH

LD9FF:
    LD (HL),A
    CPI
    JP PE,D9FFH

; Initialize TEXT/VLOMEM, BASIC stack boundary, DATA pointers, symbol-chain boundary, and TOP.
    LD (1720H),HL
    LD (1722H),HL
    LD HL,FB5BH
    LD DE,0008H
    LD BC,0027H
    LDIR
    CALL DE10H

; Startup animation uses RST 30H video calls and loops until a keyboard event is available.

; -----------------------------------------------------------------------------
; BASIC SIGN-ON SCREEN
; -----------------------------------------------------------------------------
;
; Constructs the animated TV Computer sign-on display and waits for the first key.
;
; The routine uses RST 30H video calls to position and print VIDEOTON, TV COMPUTER, and the
; multicolour title. It varies the colour parameters while emitting the title, pauses briefly, and
; repeats the animation until the keyboard service reports a key. The subsequent text and
; free-memory calculation establish the normal BASIC screen before command entry.
;
; Entry:
;   Video and keyboard OS services initialized; IX points to BASIC state.
;
; Exit:
;   Sign-on display shown; returns after a key has been detected and acknowledged.
;
; Effects:
;   Writes video state, palette/colour variables, and consumes the first key event.
; -----------------------------------------------------------------------------
STARTUP_SCREEN:
    LD DE,DC15H
    RST 30H
    INC C
    LD A,02H
    LD (0B4FH),A
    LD (IX+05H),00H
    LD BC,0303H
    LD A,0CH

LDA2C:
    PUSH BC
    PUSH AF
    RST 30H
    INC BC
    CALL DBF2H
    POP AF
    PUSH AF
    DB CDH                                                                          ; |.|

LDA36:
    INC C
    CALL C,F2CDH
    IN A,(CDH)
    SUB E
    CP F1H
    POP BC
    INC B
    INC C
    INC C
    SUB 02H
    JR NC,DA2CH
    LD BC,0D15H
    RST 30H
    INC BC
    DB CDH                                                                          ; |.|

LDA4D:
    DB F2H, DBH                                                                     ; |..|

LDA4F:
    LD BC,0B12H
    RST 30H
    INC BC
    LD HL,DBFFH
    LD B,(HL)

LDA58:
    INC HL
    LD A,(HL)
    CALL FE9AH
    PUSH HL
    PUSH BC

LDA5F:
    CALL E6D8H
    AND 03H
    JR Z,DA5FH
    POP BC
    POP HL
    LD (0B4DH),A

LDA6B:
    DEC C
    JR NZ,DA6BH
    DJNZ DA58H
    RST 30H
    SUB E
    INC C
    JR NZ,DA4FH
    RST 30H
    SUB C
    LD C,01H
    RST 30H
    INC B
    LD (0B4FH),A
    CALL FC18H
    CALL FE79H

; TVC BASIC 1.2 copyright sign-on text.
; Embedded BASIC 1.2 sign-on text: TV COMPUTER BASIC 1.2 and Copyright 1985 VIDEOTON.
    DB 32H, 54H, 56H, 20H, 43H, 4FH, 4DH, 50H, 55H, 54H, 45H, 52H, 20H, 42H, 41H, 53H ; |2TV COMPUTER BAS|
    DB 49H, 43H, 20H, 31H, 2EH, 32H, 0DH, 0AH, 43H, 6FH, 70H, 79H, 72H, 69H, 67H, 68H ; |IC 1.2..Copyrigh|
    DB 74H, 20H, 31H, 39H, 38H, 35H, 20H, 56H, 49H, 44H, 45H, 4FH, 54H, 4FH, 4EH, 0DH ; |t 1985 VIDEOTON.|
    DB 0AH, 0DH, 0AH, CDH, 4CH, ECH, CDH, C1H, FEH, CDH, 1BH, FAH, CDH, 79H, FEH    ; |....L........y.|

; "bytes free" text.
; Embedded bytes-free message and the code that computes the available BASIC workspace.
    DB 0FH, 20H, 62H, 79H, 74H, 65H, 73H, 20H, 66H, 72H, 65H, 65H, 0DH, 0AH, 0DH, 0AH ; |. bytes free....|
    DB AFH, 32H, 21H, 0BH, CDH, FCH, DCH, 31H, ACH, 16H, 21H, 03H, 17H, 7EH, B7H, 36H ; |.2!....1..!..~.6|
    DB 00H, C4H, 10H, DEH, DDH, 36H, 05H, 20H, DDH, CBH, 00H, 96H, DDH, CBH, 00H, 4EH ; |.....6. .......N|
    DB 20H, 0AH, CDH, 18H, FCH, CDH, 79H, FEH                                       ; | .....y.|

; "ok" text followed by clear-to-end-of-line control character.
; Embedded OK prompt followed by the editor clear-to-end-of-line control sequence.
    DB 03H, 6FH, 6BH, 0BH, DDH, CBH, 00H, 8EH, CDH, 93H, FEH                        ; |.ok........|

; Read a complete editor paragraph into INPUT at 1831H, tokenize it into COMMAND, and classify
; line-numbered versus immediate input.

; -----------------------------------------------------------------------------
; BASIC COMMAND INPUT LOOP
; -----------------------------------------------------------------------------
;
; Reads one edited input line, tokenizes it, and classifies it as a stored program line or
; immediate command.
;
; The loop prints the OK prompt through the video/editor services, obtains a complete line in the
; 1831H INPUT buffer, and handles empty input, CTRL+ESC, and file-end status. TOKENIZE_BASIC_LINE
; converts keywords to one-byte tokens and writes the compact result to the 1732H COMMAND buffer.
;
; The first value in COMMAND is parsed as a possible line number. A valid 1..9999 number selects
; the program-line insertion path at DB2AH; otherwise the routine constructs an immediate command
; and dispatches it. A blank line or a line beginning with the '*' escape returns to the prompt
; without interpretation.
;
; Entry:
;   Editor-produced line in 1831H INPUT buffer.
;
; Exit:
;   Stored/updated program line or immediate statement execution.
;
; Effects:
;   Updates COMMAND, BASIC stack, program text, and interpreter state.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers.
; -----------------------------------------------------------------------------
BASIC_COMMAND_LOOP:
    CALL FF4FH
    CP F5H
    JP Z,FFA3H
    CP ECH
    JR Z,DAF5H
    CALL DC19H
    LD E,L
    LD D,H
    INC HL
    CALL F914H
    JR C,DB2AH
    LD A,(HL)
    CP A8H
    JR Z,DB25H
    INC A
    JR NZ,DB61H

LDB25:
    CALL FA1BH
    JR DB06H

LDB2A:
    RLA
    JR C,DB61H
    LD B,(HL)
    LD A,(IY+08H)
    CP 40H
    JR C,DB61H
    CP 44H
    JR NC,DB61H
    LD A,(IY+06H)
    OR A
    JR Z,DB61H

LDB3F:
    LD A,(HL)
    INC HL
    CP 20H
    JR Z,DB3FH
    DEC HL
    EX DE,HL
    LD A,(HL)
    INC HL
    ADD A,02H
    SBC HL,DE
    ADD A,L
    LD C,A
    CALL FAC3H
    EX DE,HL
    DEC HL
    LD (HL),D
    DEC HL
    LD (HL),E
    DEC HL
    LD (HL),C
    LD (170CH),HL
    CALL DCAFH
    JR DB06H

LDB61:
    EX DE,HL
    CALL FA1BH
    LD C,(HL)
    XOR A
    LD (HL),A
    DEC HL
    LD (HL),A
    DEC HL
    INC C
    INC C
    LD (HL),C

LDB6E:
    LD (170CH),HL
    INC HL
    BIT 0,(IX+00H)
    CALL NZ,DE4DH
    RES 0,(IX+02H)
    INC HL
    INC HL
    EXX

; Primary-token interpreter dispatch: token values index the jump table and transfer control to a
; statement handler.

; -----------------------------------------------------------------------------
; BASIC STATEMENT DISPATCH
; -----------------------------------------------------------------------------
;
; Fetches the next tokenized BASIC statement and jumps through the primary-token handler table.
;
; The interpreter keeps the current token pointer in the alternate register set. It skips spaces,
; recognizes statement terminators and REM, and transforms the descending token value into an
; index into the primary statement jump table at the beginning of the ROM. The target address is
; loaded from the table and entered with the BASIC stack and interpreter state prepared.
;
; When a statement completes, handlers return here or to the related continuation labels. The same
; machinery executes immediate commands and stored program lines; the distinction is represented
; by the current line pointers and the interpreter flags rather than by a second evaluator.
;
; Entry:
;   HL' points into tokenized BASIC text; BASIC state and IX are valid.
;
; Exit:
;   Control transfers to the handler selected by the next primary token.
;
; Effects:
;   Updates current-statement pointers and uses the CPU stack as a handler-return boundary.
; -----------------------------------------------------------------------------
BASIC_NEXT_STATEMENT:
    EXX

LDB81:
    CALL FF9DH
    LD (171AH),IY

LDB88:
    LD A,(HL)
    CP FEH
    JR NC,DBBBH
    INC HL
    CP 20H
    JR Z,DB88H
    CP CAH
    JP C,E3BCH
    PUSH AF
    EXX
    CPL
    ADD A,A
    ADD A,67H
    LD L,A
    LD H,C0H
    LD A,(HL)
    INC L
    LD H,(HL)
    LD L,A
    POP AF
    CP FBH
    CALL C,FC43H
    LD SP,16ACH
    JP (HL)

LDBAE:
    CALL FC43H

LDBB1:
    EXX
    LD A,B
    EXX
    CP FDH
    JR Z,DB80H
    JP C,FD5AH

; REM routine.
; REM handling skips to the next colon, exclamation/REM boundary, or line terminator without
; executing the remainder.

; -----------------------------------------------------------------------------
; REM STATEMENT
; -----------------------------------------------------------------------------
;
; Skips the remainder of a BASIC statement line as a comment.
;
; REM is handled by advancing from the current line pointer over its length-prefixed body until a
; statement separator or FFH line end. No expression evaluation or output occurs. This same
; boundary logic supports the exclamation/comment spelling accepted by the tokenizer.
; -----------------------------------------------------------------------------
BASIC_REM_ENTRY:
    LD HL,(170CH)
    LD C,(HL)
    XOR A
    LD B,A
    ADD HL,BC

LDBC2:
    OR (HL)
    JR NZ,DB6EH

LDBC5:
    LD A,(IY+00H)
    CP 2BH
    JR Z,DBDAH
    CP 06H
    JR Z,DBDAH

LDBD0:
    BIT 2,(IX+00H)
    JP Z,DADAH
    JP E10EH

LDBDA:
    LD E,(IY+03H)
    LD D,(IY+04H)
    LD HL,1831H
    SBC HL,DE
    JR C,DBD0H
    LD C,A
    LD B,00H
    ADD IY,BC
    LD (171AH),IY
    JR DBC5H

LDBF2:
    CALL FE79H
    EX AF,AF'

; "VIDEOTON" sign-on text.
    DB 56H, 49H, 44H, 45H, 4FH, 54H, 4FH, 4EH, C9H, 0CH                             ; |VIDEOTON..|

; "TV COMPUTER" sign-on text.
    DB 54H, 56H, 20H, 20H, 43H, 4FH, 4DH, 50H, 55H, 54H, 45H, 52H, 3DH, F8H, F5H, CDH ; |TV  COMPUTER=...|
    DB C7H, FEH, F1H, 18H, F7H                                                      ; |.....|

; Cold-start sign-on picture palette bytes.
    DB 01H, 44H, 54H, 51H                                                           ; |.DTQ|

; TOKENIZE_BASIC_LINE writes compact output to COMMAND; quoted text is copied literally and
; keyword matching resumes after the closing quote.

; -----------------------------------------------------------------------------
; BASIC LINE TOKENIZER
; -----------------------------------------------------------------------------
;
; Converts editable ASCII input into the compact tokenized BASIC representation.
;
; HL starts at the editor's INPUT buffer and DE tracks the source characters. The tokenizer scans
; the descending keyword table at DE6DH, replacing recognized words with their token byte while
; preserving spaces, numbers, punctuation, and other non-keyword characters. Quoted strings and
; colon separators suppress keyword recognition where BASIC treats text literally.
;
; The high bit on the final character of each keyword table entry marks the end of that word. The
; output is written through IY into the COMMAND buffer at 1732H; the routine stores the resulting
; length and terminates the compact line with FFH. This is lexical compression only: statement
; validity is checked later by the handler selected from the token.
;
; Entry:
;   HL=editor INPUT buffer, whose first byte is its length and whose body ends with FFH.
;
; Exit:
;   HL/IY identify the compact COMMAND line at 1732H/1735H.
;
; Effects:
;   Writes tokenized BASIC text and updates command length.
;
; Destroys:
;   AF, BC, DE, HL, IY and alternate AF.
; -----------------------------------------------------------------------------
TOKENIZE_BASIC_LINE:
    DB FDH, E5H, EBH, FDH, 21H, 35H, 17H, 01H                                       ; |....!5..|
    NOP
    NOP

LDC23:
    INC DE

LDC24:
    LD HL,DE6EH
    LD A,FEH
    EX AF,AF'

LDC2A:
    INC IY
    LD (171CH),DE
    CALL FBBFH
    LD (IY+00H),A
    INC A
    JR Z,DC9FH
    LD A,B
    OR A
    JR Z,DC41H
    CP 3AH
    JR NZ,DC4BH

LDC41:
    LD A,(DE)
    CP 22H
    JR NZ,DC4BH
    LD C,B
    LD B,A
    INC DE
    JR DC2AH

LDC4B:
    CALL FBBFH
    INC DE
    OR A
    JR Z,DC60H
    CP B
    JR NZ,DC60H
    LD B,C
    LD C,00H
    CP 22H
    JR Z,DC24H
    LD A,FDH
    JR DC88H

LDC60:
    INC B
    DEC B
    JR NZ,DC2AH
    XOR (HL)
    ADD A,A
    JR NZ,DC8DH
    INC HL
    JR NC,DC4BH
    EX AF,AF'
    LD C,B
    CP A6H
    JR Z,DC79H
    CP A5H
    JR Z,DC79H
    CP A3H
    JR NZ,DC7BH

; Keyword-table matches use the high bit on the final character; recognized words become one-byte
; tokens while numbers and punctuation remain unchanged.

LDC79:
    SUB 08H

LDC7B:
    CP FDH
    JR Z,DC88H
    CP FBH
    JR C,DC88H
    LD B,A
    JR NZ,DC88H
    LD B,3AH

LDC88:
    LD (IY+00H),A
    JR DC24H

LDC8D:
    LD DE,(171CH)

LDC91:
    BIT 7,(HL)
    INC HL
    JR Z,DC91H
    EX AF,AF'
    DEC A
    EX AF,AF'
    LD A,(HL)
    INC A
    JR Z,DC23H
    JR DC4BH

; Finalize tokenized line: store its length and append FFH as the line terminator.

LDC9F:
    PUSH IY
    POP HL
    INC HL
    LD (HL),A
    LD DE,1735H
    OR A
    SBC HL,DE
    EX DE,HL
    LD (HL),E
    POP IY
    RET

; Insert a new numbered line: build its stored length/line-number format, make room with block
; moves, and reinitialize BASIC pointers.

; -----------------------------------------------------------------------------
; INSERT BASIC PROGRAM LINE
; -----------------------------------------------------------------------------
;
; Builds and inserts a numbered line, moving later program text to make room.
;
; The command loop has already converted the line number to a two-byte binary value and
; constructed the stored line length. This helper finds the ordered insertion point, removes an
; old line with the same number when present, moves the remainder of the program, and copies the
; new line into the gap. Because addresses change, it finishes by reinitializing the BASIC stack,
; DATA pointers, random state, and user symbols.
;
; Entry:
;   HL=new line source; B=first body character offset; C=stored line length.
;
; Exit:
;   Program text contains the new line in ascending order.
;
; Effects:
;   Moves program bytes and invalidates user symbol definitions.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
BASIC_INSERT_LINE:
    LD (171CH),HL
    PUSH BC
    CALL DD45H
    CALL NC,DCE6H
    POP BC
    INC B
    RET Z
    LD B,00H
    CALL DCC9H
    EX DE,HL
    LD HL,(171CH)
    LDIR
    JR DCFCH

; -----------------------------------------------------------------------------
; MAKE ROOM IN BASIC PROGRAM
; -----------------------------------------------------------------------------
;
; Frees a region in the program area by shifting later bytes toward the high-memory end.
;
; The insertion path supplies a start address and byte count. This helper finds the current
; program end, computes the number of bytes that must move, and performs the overlapping transfer
; so the new line can be copied into the resulting gap. It is bounded by the BASIC memory layout
; and the HI-MEM stack boundary.
;
; Entry:
;   HL=region start; BC=number of bytes to reserve.
;
; Exit:
;   The requested gap is available at HL.
;
; Effects:
;   Moves program storage and causes subsequent addresses to change.
; -----------------------------------------------------------------------------
BASIC_FREE_SPACE:
    CALL DCFCH
    CALL FC8EH
    PUSH BC
    PUSH HL
    CALL DD41H
    POP DE
    PUSH HL
    OR A
    SBC HL,DE
    LD C,L
    LD B,H
    POP DE
    POP HL
    PUSH HL
    ADD HL,DE
    EX DE,HL
    INC BC
    LDDR
    INC HL
    POP BC
    RET

; -----------------------------------------------------------------------------
; DELETE BASIC PROGRAM LINE
; -----------------------------------------------------------------------------
;
; Deletes one stored line by moving the remainder of the program over it.
;
; Given the line's length-byte address, the helper computes the line end and the current program
; end, then performs an overlapping backward transfer to close the gap. The caller retains its
; LIST/LLIST/DELETE mode flags and continues range processing after the deletion.
;
; Entry:
;   HL=line length-byte address.
;
; Exit:
;   The line is absent and subsequent lines are contiguous.
;
; Effects:
;   Moves program bytes and changes the program end; callers normally reinitialize BASIC workspace
;   afterward.
; -----------------------------------------------------------------------------
BASIC_DELETE_LINE:
    LD C,(HL)
    LD B,00H
    PUSH HL
    ADD HL,BC
    PUSH HL
    CALL DD41H
    POP DE
    OR A
    SBC HL,DE
    LD C,L
    LD B,H
    EX DE,HL
    POP DE
    PUSH DE
    INC BC
    LDIR
    POP HL

; -----------------------------------------------------------------------------
; RESET BASIC EXECUTION WORKSPACE
; -----------------------------------------------------------------------------
;
; Clears transient interpreter state after program edits or before execution.
;
; This common initializer places IY at the BASIC stack boundary, clears the END and DATA state
; pointers, restores the built-in symbol-chain boundary, seeds the random-number state, and sets
; the current program pointer and TOP. Program editing uses it because moving lines invalidates
; stack and symbol addresses; RUN uses the same reset before starting execution.
;
; Entry:
;   BASIC program pointers and HI-MEM are valid.
;
; Exit:
;   Transient workspace and execution pointers are reset.
;
; Effects:
;   Overwrites BASIC stack state and discards user symbols.
; -----------------------------------------------------------------------------
BASIC_WORKSPACE_INIT:
    PUSH HL
    PUSH DE
    PUSH BC
    LD IY,(0B19H)
    LD HL,0000H
    LD (IY+00H),L
    LD (170EH),HL
    LD (1714H),HL
    LD HL,F094H
    LD (1724H),HL
    LD HL,1709H
    LD (HL),L
    LD (170AH),HL
    LD HL,(1722H)
    LD (1712H),HL
    CALL DD41H
    INC HL
    LD (1726H),HL
    POP BC
    POP DE
    POP HL
    RET

; -----------------------------------------------------------------------------
; EMIT ONE STORED BASIC LINE
; -----------------------------------------------------------------------------
;
; Formats a stored line number and emits its tokenized body through the selected output class.
;
; The helper skips the line length byte, reads the binary line number, prints it in the selected
; device class, and then emits the tokenized body until its FFH line terminator. It is shared by
; LIST and by diagnostic/error paths that need to display a line. The carry result distinguishes a
; normal program listing from a line being edited or reported.
;
; Entry:
;   HL=stored line length byte; output class is already selected.
;
; Exit:
;   The line is formatted and emitted; carry identifies the caller's listing mode.
;
; Effects:
;   Uses the active OS output device and advances through the line.
; -----------------------------------------------------------------------------
BASIC_PRINT_LINE:
    PUSH AF
    INC HL
    LD E,(HL)
    INC HL
    LD D,(HL)
    INC HL
    PUSH HL
    EX DE,HL
    CALL FF19H
    POP HL
    CALL FEDDH
    POP AF
    RET NC
    JP FE8EH

; Any program edit invalidates user symbols and resets the BASIC stack through the common
; workspace initializer.

LDD41:
    LD HL,FFFFH

LDD44:
    EX DE,HL

; Search length-prefixed program lines in ascending order; zero length marks the end and supplies
; the append position.

; -----------------------------------------------------------------------------
; FIND BASIC LINE
; -----------------------------------------------------------------------------
;
; Searches the ordered BASIC program for a line number or insertion point.
;
; The program is a sequence of length-prefixed lines beginning at TEXT (1722H). FIND_BASIC_LINE
; walks the length bytes and two-byte binary line numbers in ascending order. It stops on an exact
; match, on the first larger line, or at the zero length byte marking the program end.
;
; Entry:
;   DE=requested binary line number; 1722H points to the program.
;
; Exit:
;   HL points at the matching line's length byte or insertion position; Z marks an exact match and
;   carry distinguishes an intervening position.
;
; Effects:
;   Reads program text but does not modify it.
; -----------------------------------------------------------------------------
FIND_BASIC_LINE:
    LD HL,(1722H)
    LD BC,0000H

LDD4B:
    ADD HL,BC
    LD C,(HL)
    INC C
    DEC C
    SCF
    RET Z
    PUSH DE
    INC HL
    LD E,(HL)
    INC HL
    LD D,(HL)
    DEC HL
    DEC HL
    EX (SP),HL
    OR A
    SBC HL,DE
    ADD HL,DE
    EX DE,HL
    POP HL
    RET Z
    JR NC,DD4BH
    RET

LDD63:
    RST 08H
    LD A,(BC)

; CONTINUE routine.
; CONTINUE restores the saved line and statement pointers; zero saved address is the END state and
; raises Cannot Continue.

; -----------------------------------------------------------------------------
; CONTINUE STATEMENT
; -----------------------------------------------------------------------------
;
; Resumes a stopped BASIC program from the saved next-statement pointer.
;
; CONTINUE rejects an already-running program and raises Cannot Continue when the saved pointer at
; 170EH is zero (the END state). Otherwise it sets the running flag, restores the saved line
; pointer at 170CH and statement pointer at 1710H, and re-enters the common interpreter dispatch.
;
; Entry:
;   Interpreter flags and saved execution pointers.
;
; Exit:
;   Program execution resumes or error 0AH is raised.
;
; Effects:
;   Sets the running-program flag and restores execution context.
; -----------------------------------------------------------------------------
BASIC_CONTINUE:
    BIT 2,(IX+00H)
    JP NZ,DBB1H
    SET 2,(IX+00H)
    LD HL,(170EH)
    LD A,H
    OR L
    JR Z,DD63H
    LD (170CH),HL
    LD HL,(1710H)
    JP DB81H

; LLIST routine.
; LLIST selects printer output and falls into the shared LIST range parser.

; -----------------------------------------------------------------------------
; LLIST ENTRY
; -----------------------------------------------------------------------------
;
; Selects printer-class output before entering the shared LIST machinery.
;
; LLIST differs from LIST only in its initial device-class flag. It marks printer output and then
; falls into the common range parser and line emitter, preserving the distinction in the flags
; carried through the shared code.
; -----------------------------------------------------------------------------
BASIC_LLIST_ENTRY:
    LD C,40H
    OR C
    JR DD88H

; LIST routine.
; LIST selects editor output unless a #device reference overrides it; LLIST, LIST, and DELETE
; share this range-processing core.

; -----------------------------------------------------------------------------
; LIST AND LLIST STATEMENTS
; -----------------------------------------------------------------------------
;
; Parses optional line ranges and emits selected BASIC lines to the chosen device.
;
; LIST selects the editor/video class by default, while LLIST enters through a flag selecting
; printer output. Optional '#' device syntax can replace that class. The shared parser accepts a
; start, an end, either one alone, or a start-end range; it walks the ordered program and emits or
; deletes lines according to the carried mode flags.
;
; For output, each line is decoded from its stored length and binary line number and sent through
; the common listing formatter. The range parser uses 0000H and FFFFH as open-ended bounds and
; treats a comma as the separator for another range. CTRL+ESC is checked through the output path
; so long listings remain abortable.
;
; Entry:
;   Tokenized LIST/LLIST parameters and program text at TEXT.
;
; Exit:
;   Selected source lines sent to the active output class.
;
; Effects:
;   Reads program storage, invokes character/block output, and updates temporary parser state.
; -----------------------------------------------------------------------------
BASIC_LIST:
    LD C,20H
    XOR A

LDD88:
    PUSH AF
    CALL FBEEH
    POP AF
    JR NZ,DD94H
    LD A,C
    CP 20H
    LD D,F6H

LDD94:
    SCF
    EX AF,AF'
    EXX
    LD A,B
    EXX
    LD HL,0000H
    LD DE,FFFFH
    CP FDH
    JR NC,DDD1H
    JR DDB6H

LDDA5:
    EXX
    LD A,B
    EXX
    CP A4H
    JR Z,DDB3H
    EX AF,AF'
    JP C,DBB1H
    JP DADAH

LDDB3:
    CALL FC43H

LDDB6:
    CALL DDFBH
    INC D
    JR NZ,DDC4H
    CP A2H
    JP NZ,FD5AH
    LD DE,0100H

LDDC4:
    DEC D
    PUSH DE
    CP A2H
    JR NZ,DDD0H
    CALL FC43H
    CALL DDFBH

LDDD0:
    POP HL

LDDD1:
    PUSH DE
    CALL DD44H
    POP DE

LDDD6:
    LD A,(HL)
    OR A
    JR Z,DDA5H
    INC HL
    LD C,(HL)
    INC HL
    LD B,(HL)
    DEC HL
    DEC HL
    EX DE,HL
    SBC HL,BC
    ADD HL,BC
    EX DE,HL
    JR C,DDA5H
    PUSH DE
    EX AF,AF'
    JR NC,DDF0H
    CALL DD2DH
    JR DDF4H

LDDF0:
    CALL DCE6H
    OR A

LDDF4:
    EX AF,AF'
    CALL FF9DH
    POP DE
    JR DDD6H

; A single line-number parameter is converted to an open-ended range; comma introduces another
; range.

; -----------------------------------------------------------------------------
; PARSE LIST RANGE PARAMETER
; -----------------------------------------------------------------------------
;
; Converts an optional line-number parameter into an open or closed LIST range.
;
; The routine reads a number previously placed on the BASIC stack and returns it in DE; if no
; number is present it returns FFFFH as an open bound. LIST and LLIST use this helper for forms
; such as LIST 100, LIST -200, and LIST 100-200 while preserving the current range separator
; state.
;
; Entry:
;   BASIC stack may contain a parsed line number; A carries the preceding-token flag.
;
; Exit:
;   DE=line bound or FFFFH for an omitted bound.
; -----------------------------------------------------------------------------
BASIC_LIST_RANGE_PARAM:
    LD DE,FFFFH
    CP 02H
    RET NZ
    CALL FAC3H
    EX DE,HL
    JP FC43H

; NEW routine.
; NEW marks the current program empty at TEXT, clears TRACE, and enters common BASIC workspace
; initialization.

; -----------------------------------------------------------------------------
; NEW STATEMENT
; -----------------------------------------------------------------------------
;
; Invalidates the current program and reinitializes the BASIC execution workspace.
;
; NEW clears TRACE, writes zero at the current program base (the zero length marks no program),
; resets TEXT and program pointers, and enters the common BASIC workspace initializer. The old
; bytes are not physically erased, but they are outside the live program after the boundary is
; reset.
;
; Effects:
;   Clears the current program logically, BASIC stack, DATA pointers, and user symbol chain.
; -----------------------------------------------------------------------------
BASIC_NEW:
    LD HL,DADAH
    PUSH HL
    RES 0,(IX+00H)

LDE10:
    LD HL,(1720H)
    LD (1722H),HL
    LD (HL),00H
    JP DCFCH

; RUN routine.
; RUN selects TEXT or an optional line, initializes execution/file state, sets the running flag,
; and dispatches the first statement.

; -----------------------------------------------------------------------------
; RUN STATEMENT
; -----------------------------------------------------------------------------
;
; Initializes execution and starts the current BASIC program, optionally at a specified line.
;
; RUN chooses the program start at TEXT or converts an optional line number into a line pointer.
; It invokes the common BASIC workspace/file initialization, sets the running-program flag, clears
; transient interpreter flags, and enters the statement dispatcher at the first selected line.
;
; Entry:
;   Optional tokenized line number.
;
; Exit:
;   Control transfers to the first statement to execute.
;
; Effects:
;   Resets execution state and closes/initializes device files as required.
; -----------------------------------------------------------------------------
BASIC_RUN:
    LD HL,(1722H)
    CP 02H
    CALL Z,FBDEH
    CALL DCFCH
    CALL FC3EH
    SET 2,(IX+00H)
    XOR A
    JP DBC2H

; TRACE parses ON/OFF and retains the selected trace device class separately from the general
; output class.

; -----------------------------------------------------------------------------
; TRACE ON/OFF
; -----------------------------------------------------------------------------
;
; Enables or disables line-number tracing for a running BASIC program.
;
; TRACE first accepts an optional output-class/device selection, then requires ON or OFF. The
; state is stored in the interpreter flags and the chosen trace class is kept separately at 1706H.
; When enabled, the per-line helper prints the current line number between angle brackets before
; executing its statements.
;
; Effects:
;   Updates trace-enable state and trace output class.
; -----------------------------------------------------------------------------
BASIC_TRACE:
    CALL FBECH
    LD (IX+06H),C
    CP E3H
    JR Z,DE46H
    CP C1H
    JP NZ,FD5AH

; TRACE OFF routine.
    RES 0,(IX+00H)
    JR DE4AH

; TRACE ON routine.

LDE46:
    SET 0,(IX+00H)

LDE4A:
    JP DBAEH

; When TRACE is enabled for a running program, emit '<', the current decimal line number, and '>'
; before its statements.

; -----------------------------------------------------------------------------
; TRACE LINE EMITTER
; -----------------------------------------------------------------------------
;
; Prints the current BASIC line number when TRACE is enabled.
;
; The helper returns immediately unless a program is running and TRACE is enabled. It temporarily
; applies the trace output class, writes '<', formats the binary line number in decimal through
; the BASIC output helpers, and writes '>'.
;
; Entry:
;   HL points at the current line number.
;
; Exit:
;   Trace text emitted to the configured device.
;
; Effects:
;   Uses the active output class and preserves interpreter continuation state.
; -----------------------------------------------------------------------------
BASIC_TRACE_LINE:
    BIT 2,(IX+00H)
    RET Z
    LD A,(1706H)
    LD (1705H),A
    PUSH HL
    LD E,(HL)
    INC HL
    LD D,(HL)
    EX DE,HL
    LD A,3CH
    CALL FE9AH
    LD B,00H
    CALL FF1BH
    POP HL
    LD A,3EH
    JP FE9AH

; BASIC keyword table ordered by descending token value; the high bit marks the last byte of each
; keyword.
; Keyword strings are stored with the final character's high bit set; the descending table covers
; statements, secondary words, and operators.

; -----------------------------------------------------------------------------
; BASIC KEYWORD TABLE
; -----------------------------------------------------------------------------
;
; Descending keyword strings used by the tokenizer to produce BASIC tokens.
;
; The table stores keyword characters in the order expected by TOKENIZE_BASIC_LINE. The high bit
; on the final character terminates each word; the table then continues with the next keyword and
; eventually punctuation/operator spellings. It includes primary statements, secondary keywords
; such as PITCH and VOLUME, and symbolic operators.
;
; Note:
;   This is data, not executable code. A disassembler must keep the high-bit terminators and the
;   immediately following token associations intact.
; -----------------------------------------------------------------------------
BASIC_KEYWORD_TABLE:
    RST 38H
    AND C
    CP D
    LD D,D
    LD B,L
    CALL 4144H
    LD D,H
    POP BC
    LD B,E
    LD C,H
    LD C,A
    LD D,E
    PUSH BC
    LD B,E
    LD C,H
    OUT (43H),A
    LD C,A
    LD C,(HL)
    LD D,H
    LD C,C
    LD C,(HL)
    LD D,L
    PUSH BC
    LD B,H
    LD B,L
    ADD A,44H
    LD B,L
    LD C,H
    LD B,L
    LD D,H
    PUSH BC
    LD B,H
    LD C,C
    CALL 4C45H
    LD D,E
    PUSH BC
    LD B,L
    LD C,(HL)
    CALL NZ,4F46H
    JP NC,4547H
    CALL NC,4F47H
    LD D,E
    LD D,L
    JP NZ,4F47H
    LD D,H
    RST 08H
    LD B,A
    LD D,D
    LD B,C
    LD D,B
    LD C,B
    LD C,C
    LD B,E
    OUT (49H),A
    ADD A,49H
    LD C,(HL)
    LD D,B
    LD D,L
    CALL NC,454CH
    CALL NC,494CH
    LD D,E
    CALL NC,4C4CH
    LD C,C
    LD D,E
    CALL NC,4F4CH
    LD B,C
    CALL NZ,4F4CH
    LD C,L
    LD B,L
    CALL 454EH
    RST 10H
    LD C,(HL)
    LD B,L
    LD E,B
    CALL NC,CB4FH
    LD C,A
    ADC A,4FH
    LD D,B
    LD B,L
    ADC A,4FH
    LD D,L
    LD D,H
    LD D,B
    LD D,L
    CALL NC,554FH
    CALL NC,4C50H
    LD C,A
    CALL NC,4F50H
    LD C,E
    PUSH BC
    LD D,B
    LD D,D
    LD C,C
    LD C,(HL)
    CALL NC,4152H
    LD C,(HL)
    LD B,H
    LD C,A
    LD C,L
    LD C,C
    LD E,D
    PUSH BC
    LD D,D
    LD B,L
    LD B,C
    CALL NZ,4552H
    LD D,E
    LD D,H
    LD C,A
    LD D,D
    PUSH BC
    LD D,D
    LD B,L
    LD D,H
    LD D,L
    LD D,D
    ADC A,52H
    LD D,L
    ADC A,53H
    LD B,C
    LD D,(HL)
    PUSH BC
    LD D,E
    LD B,L
    CALL NC,4F53H
    LD D,L
    LD C,(HL)
    CALL NZ,5453H
    LD C,A
    RET NC
    LD D,H
    LD D,D
    LD B,C
    LD B,E
    PUSH BC
    LD D,(HL)
    LD B,L
    LD D,D
    LD C,C
    LD B,(HL)
    EXX
    LD B,L
    LD E,B
    CALL NC,504CH
    LD D,D
    LD C,C
    LD C,(HL)
    CALL NC,A1A1H
    AND C
    AND C
    AND C
    AND C
    LD B,C
    LD C,(HL)
    CALL NZ,4843H
    LD B,C
    LD D,D
    LD B,C
    LD B,E
    LD D,H
    LD B,L
    JP NC,4544H
    LD C,H
    LD B,C
    EXX
    LD B,H
    LD D,L
    LD D,D
    LD B,C
    LD D,H
    LD C,C
    LD C,A
    ADC A,49H
    LD C,(HL)
    LD C,E
    LD B,L
    LD E,C
    AND H
    LD C,C
    LD C,(HL)
    BIT 1,L
    LD C,A
    LD B,H
    PUSH BC
    LD C,(HL)
    LD C,A
    CALL NC,464FH
    ADD A,4FH
    LD D,D
    CALL NZ,D24FH
    LD D,B
    LD B,C
    LD C,C
    LD C,(HL)
    CALL NC,4150H
    LD C,H
    LD B,L
    LD D,H
    LD D,H
    PUSH BC
    LD D,B
    LD B,C
    LD D,B
    LD B,L
    JP NC,4950H
    LD D,H
    LD B,E
    RET Z
    LD D,B
    LD D,D
    LD C,A
    LD C,L
    LD D,B
    CALL NC,4152H
    LD D,H
    PUSH BC
    LD D,E
    LD D,H
    LD B,L
    RET NC
    LD D,E
    LD D,H
    LD E,C
    LD C,H
    PUSH BC
    LD D,H
    LD B,C
    JP NZ,4854H
    LD B,L
    ADC A,54H
    RST 08H
    LD D,(HL)
    LD C,A
    LD C,H
    LD D,L
    LD C,L
    PUSH BC
    LD E,B
    LD C,A
    JP NC,5441H
    ADC A,41H
    CALL NC,5355H
    LD C,C
    LD C,(HL)
    RST 00H
    LD B,D
    LD C,A
    LD D,D
    LD B,H
    LD B,L
    JP NC,A1A1H
    AND C
    AND C
    AND C
    XOR D
    AND E
    DEC A
    CP (HL)
    LD A,BCH
    XOR H
    DEC A
    CP H
    XOR L
    XOR A
    CP E
    SBC A,3EH
    CP L
    INC A
    CP (HL)
    CP (HL)
    INC A
    CP L
    CP L
    CP H
    XOR E
    AND (HL)
    XOR B
    XOR C
    RST 38H
    JR NZ,E044H
    LD L,C
    LD (HL),E
    LD (HL),E
    LD L,C
    LD L,(HL)
    RST 20H
    LD (HL),D
    LD H,A
    LD (HL),L
    LD L,L
    LD H,L
    LD L,(HL)
    CALL P,6142H
    LD H,H
    AND B
    LD C,(HL)
    LD L,A
    AND B
    LD B,E
    LD H,C
    LD L,(HL)
    LD L,(HL)
    LD L,A
    LD (HL),H
    AND B

; DATA routine.
; DATA performs no immediate computation; advance to the next statement boundary and leave values
; for READ's DATA-pointer search.

; -----------------------------------------------------------------------------
; DATA STATEMENT
; -----------------------------------------------------------------------------
;
; Skips DATA contents until the next statement separator or line end.
;
; DATA statements are not executed at their definition point. This entry advances over their
; comma-separated text until it reaches a colon, REM marker, or the line terminator, leaving the
; DATA pointer machinery to READ.
; -----------------------------------------------------------------------------
BASIC_DATA_ENTRY:
    EXX

LDFF3:
    LD A,(HL)
    CP FDH
    JP NC,DB81H
    INC HL
    JR DFF3H

; CLS BASIC routine.
; CLS is a thin BASIC wrapper around the video clear-screen function.

; -----------------------------------------------------------------------------
; CLS STATEMENT
; -----------------------------------------------------------------------------
;
; Implements BASIC CLS by invoking the video-class clear-screen function.
;
; CLS is a thin BASIC wrapper around the operating-system video service. It supplies the video
; function selector and returns through the common statement continuation after the screen has
; been cleared.
;
; Effects:
;   Clears the selected display and updates video cursor state as defined by the video service.
; -----------------------------------------------------------------------------
BASIC_CLS:
    RST 30H
    DEC B
    RST 10H
    DB C3H                                                                          ; |.|
