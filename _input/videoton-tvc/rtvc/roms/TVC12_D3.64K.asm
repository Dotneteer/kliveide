; -----------------------------------------------------------------------------
; TVC BASIC 1.2 SYS upper ROM overlay - TVC12_D3.64K
; Source: roms/TVC12_D3.64K
; ORG: E000H
; Size: 8192 bytes
; Instructions use CPU-visible addresses at ORG; the ROM bank is recorded separately.
; Physical bank: SYS offset 2000H
; CPU-visible aliases: E000H, 2000H
; Data ranges: E6BDH-E6C6H, E7E4H-E811H, E87BH-E895H, FB5BH-FD73H, FD74H-FF46H, FF47H-FF4EH, FFB1H-FFE9H, FFEDH-FFFFH
; Auto labels: branch and call targets are emitted as Lxxxx.
; This is a standalone listing; all required technical explanations are embedded here.
; Technical descriptions are based on the Kaszanyiczki and Ludanyi TVC ROM references.
; -----------------------------------------------------------------------------

; =============================================================================
; TVC BASIC RUNTIME REFERENCE
; =============================================================================
; This is a standalone implementation reference for TVC BASIC 1.2. It consolidates the runtime
; model described by the Kaszanyiczki ROM listing and the TVC ROM program book; ROM bytes and the
; current disassembly remain authoritative for exact instruction boundaries.
; The BASIC is a tokenizing interpreter, not a text-to-machine-code compiler. Input is first
; converted to a compact intermediate form, then a statement or function dispatcher executes that
; form while maintaining a separate BASIC stack and symbol store.
; The reference is attached to the SYS upper-ROM listing anchor so it can be shown as contextual
; assembler documentation even when the described state lives in U0 RAM or another ROM overlay. No
; behavior depends on this anchor address.

; =============================================================================
; PROGRAM LINE STORAGE
; =============================================================================
; A stored BASIC line is a length-prefixed record: the first byte is the record length, the next
; two bytes are the binary line number, and the remaining bytes contain tokenized statements and
; literal characters.
; The payload ends with FFH, the line terminator. A zero length byte at the next record marks the
; end of the program; it is not a zero-length ordinary line.
; Statements within a line are separated by the colon token. The REM and exclamation-comment forms
; cause the interpreter to skip payload until a statement terminator or the line terminator, so
; comment text need not be parsed as expressions.
; Line numbers are stored as ordinary little-endian binary data rather than printable digits. The
; records are kept in ascending line-number order, which lets insertion, replacement, LIST,
; DELETE, GOTO, and GOSUB locate lines by scanning the length chain.
; The current program base is VLOMEM; TEXT identifies the program start. The line record itself is
; compact, but the length byte includes the stored tokenized payload and terminator and therefore
; must be treated as the movement unit when compacting memory.

; =============================================================================
; TOKENIZATION AND COMPACT SOURCE
; =============================================================================
; The editor delivers an ASCII paragraph into BUFFER. The tokenizer walks it left to right,
; recognizes keywords using the ROM keyword table, and emits one-byte tokens for keywords,
; punctuation, and selected operators while retaining ordinary characters and digits.
; Keyword-table entries are stored as character strings with the final character marked in bit 7;
; the associated token is emitted after a match. This permits abbreviations and the compact
; representation used by the interpreter without making the stored program depend on display text.
; Quoted strings are copied as data and are not keyword-expanded. Numeric text is converted into
; the BASIC numeric representation during expression evaluation; a numeric literal in a tokenized
; line is therefore not necessarily a sequence of printable decimal digits at execution time.
; The tokenizer returns the beginning of the compact COMMAND record. It reports malformed input
; through the common error path; the caller can then list the offending line, discard the
; uncommitted tail, and request another editor paragraph.
; A useful disassembler invariant is that token bytes and ASCII bytes can coexist in one payload.
; Do not decode every byte above 7FH as text: primary statement tokens, secondary keywords,
; operators, and encoded messages occupy that same byte space.

; =============================================================================
; STATEMENT AND FUNCTION DISPATCH
; =============================================================================
; The first token of a statement is its primary token. A primary-token jump table selects the
; routine that implements the statement; secondary tokens such as TO, STEP, AT, USING, commas, and
; parentheses are meaningful only while that primary routine is active.
; A statement routine consumes tokens through the shared next-token machinery, validates the
; required punctuation and operand types, then either performs the operation or leaves the
; interpreter at the next statement boundary.
; The same tokenized representation serves immediate commands and stored program lines. The
; difference is execution context: an immediate COMMAND record is run once, while a stored record
; updates current-line and next-line state and returns to the line scheduler.
; Function calls use the expression evaluator rather than the statement dispatcher. A function
; routine receives its argument on the BASIC stack, performs any type/range checks, and leaves one
; result in the stack representation expected by the surrounding expression.
; The primary-token table and the RST18 table are compact indirection layers. Their entries are
; data-driven dispatch, so a raw listing should label the table and its selectors separately from
; the routines they reach.

; =============================================================================
; BASIC WORKSPACE AND EXECUTION POINTERS
; =============================================================================
; The U0 BASIC work area records interpreter state independently of the CPU stack. FLAG at 1700H
; includes running-program, open-file, trace, and OK-message state; TYPE at 1708H records the
; current symbol type; and 1701H records the expected operand type (string or number).
; START (170CH) is the current line address, the following-line pointer is at 170EH, and the next
; statement address is at 1710H. DATA line and item pointers occupy 1712H-1715H; the current INPUT
; data pointer is at 1716H.
; The RST18 continuation pointer at 1718H identifies the next function byte in a sequence. The
; saved BASIC-stack pointer at 171AH is used at statement boundaries and while unwinding immediate
; commands.
; VLOMEM (1720H) is the program base, TEXT (1722H) is the first program byte, CHAIN (1724H) links
; the symbol store, and TOP (1726H) is the next free symbol-table byte. COMMAND begins at 1732H
; and BUFFER at 1831H.
; X at 19C0H and Y at 19C7H are the two floating-point work registers used by RST18 arithmetic.
; The file-name and header buffers follow them; changing the BASIC base changes which RAM is
; available to the program, stack, and symbols.

; =============================================================================
; BASIC STACK AND NUMERIC REPRESENTATION
; =============================================================================
; The BASIC stack is a typed, variable-size data stack in high RAM. It grows downward from HIMEM
; and is addressed by IY, not by the Z80 SP. It holds expression operands, strings, FOR and GOSUB
; frames, return information, and temporary values.
; Every element begins with a type byte. Numeric values use the 09H element type and occupy nine
; bytes in the arithmetic stack format; string elements carry a string type and a length/data
; body. Control frames have their own type and layout and must not be mistaken for numbers.
; A numeric element contains packed-decimal mantissa data and a final exponent/sign byte. The
; exponent is biased around 40H and the high sign bit is used for negative values; zero is
; represented by a zero mantissa and is normalized by the arithmetic helpers.
; The stack format is decimal-oriented and supports a broad exponent range. Arithmetic routines
; align exponents, operate on packed decimal digits with DAA correction, normalize the result, and
; report overflow or division-by-zero through the BASIC error path.
; Most binary arithmetic consumes the upper operand and replaces the lower operand with the
; result, advancing IY by one element size. Any caller that borrows stack storage must preserve
; the element type and restore IY exactly at the boundary it promises.

; =============================================================================
; RST18 BASIC-STACK LANGUAGE
; =============================================================================
; RST 18H is followed by a sequence of BASIC function bytes. The dispatcher saves the continuation
; address in 1718H, executes each selected operation, and continues until the high bit of the
; final function byte is set.
; The sequence behaves like a small postfix language: operands are pushed, then operations consume
; the top values. Two-operand arithmetic leaves one result; unary operations modify or replace the
; top number; stack movement operations copy values to X, Y, or a symbol entry.
; The documented primitive vocabulary includes addition, subtraction, multiplication, division,
; NEG, loading a ROM numeric constant, loading X or Y, copying to X/Y, destructive copies, DUP,
; VAR, and NUM for evaluating a parenthesized expression.
; The X and Y work registers are six/seven-byte numeric work areas used by transcendental and
; conversion routines; they are not independent BASIC variables. RST18 callers must assume that
; arithmetic helpers use them and the BASIC workspace unless a routine explicitly documents
; preservation.
; A function-byte sequence is compact but context-sensitive: it expects IY to identify a valid
; BASIC stack element and may call the expression evaluator or error handler. It is useful for
; hand-written ROM clients, but it is not a general Z80 ABI.

; =============================================================================
; SYMBOL TABLE AND VARIABLE LIFETIME
; =============================================================================
; Symbols are kept in a linked chain between CHAIN and TOP. Each entry begins with a little-endian
; link to the next entry, followed by a name length and name bytes, then a type byte and
; type-specific data.
; The type byte distinguishes scalar versus array, string versus numeric, ordinary variable versus
; DEFined function, and user-created versus built-in symbol. The interpreter uses these bits both
; for lookup and for rejecting incompatible assignments or redeclarations.
; A lookup can find an existing built-in symbol and create a user symbol with the same spelling
; only where the statement rules permit it. DEF and DIM explicitly check for duplicate
; declarations and raise the Variable declared twice error when the type/name rules disallow
; reuse.
; Scalar numeric data is stored in the numeric format; scalar strings carry a length and character
; data. VARPTR and machine-code interfaces expose addresses of data, but such pointers become
; invalid if symbol storage is compacted or the BASIC workspace is reinitialized.
; NEW and any operation that changes the stored program reinitialize the symbol administration,
; DATA pointers, and arithmetic stack. The old bytes may remain in RAM, but the live chain and TOP
; no longer describe them.

; =============================================================================
; ARRAYS AND STRINGS
; =============================================================================
; DIM creates a symbol-table entry marked as an array and appends its dimension metadata and
; element storage at TOP. Dimension bounds are inclusive from zero, so DIM A(10) allocates eleven
; numeric elements.
; A numeric array may have multiple dimensions. The evaluator consumes each index expression,
; checks its range, and folds the indices into the array's linear element address; a bad or
; missing subscript reaches the standard error handler.
; String arrays carry an element maximum length after the dimension information. Undimensioned
; strings use the default short-string capacity; DIM permits larger fixed-capacity elements, so
; the assignment and concatenation paths must enforce the stored capacity rather than merely the
; current length.
; String values are length-prefixed or otherwise length-tracked in their stack and symbol
; representations. Operations copy only the declared/current character count, and string
; comparisons stop at the shorter operand before applying length ordering.
; The string and numeric paths share token and stack infrastructure but are not interchangeable. A
; type mismatch is raised when an expression, assignment, INPUT field, or function argument
; selects the wrong representation.

; =============================================================================
; EXPRESSION EVALUATION AND PRECEDENCE
; =============================================================================
; The numeric evaluator reads tokenized source through HL' and pushes each completed value onto
; the BASIC stack. Parenthesized arguments are evaluated recursively; the caller supplies the
; closing-token expectation and receives IY at the resulting value.
; The evaluator has distinct paths for numeric literals, quoted strings, symbol references, array
; elements, built-in functions, and user DEF functions. It records the expected type before
; dispatch so a string result cannot silently enter numeric arithmetic.
; Parentheses bind first, followed by exponentiation, multiplication/division,
; addition/subtraction, relational comparisons, NOT, AND, and OR/XOR. Operators at a common level
; are normally consumed left to right by the token-walking code.
; Relational operators produce a numeric truth value suitable for IF and ON. Numeric comparisons
; use sign, biased exponent, and packed digits; string comparisons use character order and then
; length when the common prefix is equal.
; Expression errors include malformed delimiters, missing arguments, undefined or incorrectly
; typed symbols, bad subscripts, divide by zero, and numeric overflow. The evaluator leaves the
; error path rather than returning an ambiguous partial stack value.

; =============================================================================
; PROGRAM EDITING AND STORAGE MAINTENANCE
; =============================================================================
; After tokenization, the line insertion routine scans the ordered program records for the target
; number. An existing record with the same number is removed before the replacement is inserted; a
; line whose payload is immediately terminated is treated as a deletion.
; Insertion creates room by moving the remainder of the program toward higher addresses. Deletion
; compacts the remainder toward lower addresses. The movement length is derived from the old
; program end and record length, so stale pointers into the program must not be retained across
; the operation.
; The BASIC workspace initializer is called after a program mutation. It clears the arithmetic
; stack, resets END/running state, reinitializes DATA traversal, clears user symbols, reseeds the
; random state, and moves TOP to the new end of the symbol area.
; LIST and LLIST locate records by line range and send the tokenized payload through the output
; path; DELETE uses the same line-range scanner and compaction helper. A missing line is a search
; result, not a memory fault.
; NEW marks the active program empty by writing a zero at its base and reinitializes the
; associated state; it need not erase every old program byte. This is an implementation caveat for
; memory inspectors, not a supported recovery interface.

; =============================================================================
; EXECUTION STATE AND CONTROL FLOW
; =============================================================================
; The line scheduler follows START, the next-line pointer, and the next-statement pointer. At each
; boundary it can service TRACE, test STOP-FLAG, discard transient expression values, and select
; the next primary token.
; RUN initializes execution state, closes or resets file context as required, sets the
; running-program flag, and starts at TEXT or at the requested line. Immediate commands use the
; COMMAND buffer and return after restoring the saved BASIC-stack depth.
; FOR frames and GOSUB frames live on the BASIC stack, not the CPU stack. END/STOP and error
; unwinding inspect those typed frames so the interpreter can restore or discard nested control
; state without confusing it with numeric operands.
; GOTO and GOSUB resolve a binary line number through the ordered record scanner. RETURN requires
; a matching GOSUB frame; NEXT requires a matching FOR frame and updates the control variable
; before deciding whether to loop or discard the frame.
; CONTINUE reuses saved current-line and next-statement state after a stoppable interruption when
; the required execution context still exists. If the program is not resumable, it raises Cannot
; Continue rather than guessing a location.

; =============================================================================
; LOGICAL I/O AND FUNCTION CLASSES
; =============================================================================
; TVC I/O is addressed to logical function classes rather than hard-wired devices. The input and
; output assignment tables at 0B00H-0B0FH map video, keyboard, editor, sound, printer,
; cassette/storage, expansion cards, and kernel services to implementations.
; A logical class can be redirected by changing its assignment byte. This is why PRINT, INPUT,
; LIST, editor reads, and file operations share common front ends while still reaching different
; low-level routines.
; The first three device function ordinals have a uniform meaning across classes: interrupt
; service, single-character transfer, and block transfer. Device-specific functions follow those
; common entries and may be unsupported for a given assignment.
; The class selected by a BASIC peripheral qualifier is kept in the BASIC workspace. A separate
; selected-device byte and the assignment table determine the eventual implementation, so a
; peripheral number in source is not itself a ROM routine address.
; Kernel class calls are not redirected. Expansion-card assignments are validated specially and
; may transfer into the extension ROM; invalid class/device combinations return a function-call
; error before the device routine is entered.

; =============================================================================
; RST30 FUNCTION-CALL CONVENTION
; =============================================================================
; An OS function call is encoded as RST 30H followed by one function byte. The dispatcher extracts
; direction from bit 7, function class from bits 6-4, and the routine ordinal from bits 3-0.
; At the common call boundary, DE and BC carry operation parameters or lengths and may receive
; auxiliary results. The selected low-level routine returns A=00 for success; any nonzero A is a
; device- or dispatcher-defined error code.
; The dispatcher saves the function byte and the relevant CPU state, resolves the class through
; the input or output assignment table, validates the target device, and then invokes the selected
; ordinal. Callers must not assume that a successful device call preserves all general registers.
; Character I/O normally uses C for the byte; block I/O uses BC for the count and HL for the
; implementation entry in the device interface. Exact register preservation belongs to the
; individual device routine, while A's error contract belongs to the common dispatcher.
; RST30 is a compact TVC OS ABI, not an ordinary CALL to a stable address. It depends on the
; page-0 RAM gateway and current assignment tables, so a standalone machine-code client should
; preserve the documented page state and handle nonzero A.

; =============================================================================
; PRINT, LPRINT, AND USING
; =============================================================================
; PRINT selects the current output class, optionally processes AT and a peripheral qualifier, then
; walks a list of expressions separated by comma, semicolon, or TAB controls. LPRINT follows the
; same engine with printer class selected by default.
; A comma advances to the next output tabulation position; a semicolon suppresses the separator;
; TAB evaluates its argument and positions the selected video/editor-compatible output. A bare
; PRINT emits a line ending, while a trailing separator suppresses the normal final line ending.
; Numeric values are converted from the nine-byte BASIC stack format into ASCII in the
; numeric-format workspace before output. Zero, sign, decimal placement, and optional exponent
; notation are decided by this conversion rather than by the tokenized literal spelling.
; USING copies its format string into a dedicated BASIC buffer, scans literal characters
; separately from format controls, and remembers the first unused format byte between values. It
; then applies the next numeric or string value to that format and emits padding or literal text
; through the normal character output path.
; The format language includes digit/decimal placeholders, exponent selection, forced or trailing
; signs, fill characters, and left/right string alignment. A malformed format, wrong value type,
; or insufficient/invalid format structure returns through the BASIC error path.

; =============================================================================
; INPUT AND EDITOR LINE ACQUISITION
; =============================================================================
; BASIC line input obtains an edited paragraph through the editor/logical input path, stores it in
; BUFFER, and then tokenizes it into COMMAND. The same route serves immediate commands and
; numbered program lines.
; The editor's character input is stateful: an initial call starts a paragraph, subsequent calls
; can return more characters, and a terminating RETURN completes the paragraph. The caller must
; honor the editor's continuation and error status rather than treating every return as a complete
; line.
; CTRL+ESC sets STOP-FLAG and aborts the current input/execution path. End-of-file and device
; errors are returned as status values and are converted to BASIC errors or a controlled retry by
; the higher-level INPUT routine.
; INPUT parses comma-separated fields according to the destination symbol type. Numeric fields
; accept signed decimal/exponent syntax and are converted through ASCII_TO_FP; string fields
; retain character data subject to the destination capacity and quoting rules.
; The input parser assigns each field before requesting the next one. Missing fields, excess
; variables, malformed numbers, type mismatches, and a device-level failure are distinct cases
; even when the user-visible recovery is another input prompt.

; =============================================================================
; ERROR MODEL, MESSAGES, AND STOP
; =============================================================================
; RST 08H is the BASIC error gateway. A code may follow the RST instruction in ROM, or a caller
; may enter the alternate gateway with the code already in A. Code zero is a no-error return for
; the latter path.
; The general handler unwinds the active interpreter context, selects the appropriate output
; class, prints the error prefix and message, and appends line context when a stored program was
; running. It then restores a safe immediate-command state or leaves the program stopped.
; Messages are stored compactly as code/length/text records. Shared fragments such as Cannot, No,
; Bad, Argument, and missing are combined with token-specific text, so the byte table is not a
; simple array of null-terminated C strings.
; The BASIC table includes errors for unrecognized input, missing lines or arguments, bad
; arguments/subscripts, no memory, divide by zero, overflow, type mismatch, duplicate
; declarations, file failures, and BASIC corruption. Device and extension codes may use a separate
; system-error presentation.
; CHECK_STOP_FLAG polls 0B16H. When set, STOP clears the flag, records the current execution
; context, prints STOP and the current line, and returns through the same resumable machinery used
; by CONTINUE. A STOP is therefore a controlled interpreter transition, not a CPU reset.

; =============================================================================
; DIRECT CALLS, EXTENSIONS, AND CAVEATS
; =============================================================================
; The page-0 RAM gateway contains the copied BASIC error entries, the RST18 dispatcher entry, and
; the extension/function-call forwarding code. These addresses are initialized at startup and
; should be treated as gateways rather than immutable ROM routines.
; EXT selects one of seven user subroutine slots in USRTAB at 0021H-002EH. The table holds
; little-endian addresses; BASIC can pass values in HL, DE, and BC, and a user routine must return
; with RET. The slot contents are cleared or reinitialized by BASIC setup operations.
; USR(address [, parameter]) enters machine code at the requested address with the parameter in HL
; and interprets the returned HL as the numeric result. The call crosses the BASIC numeric
; conversion boundary, so a routine should preserve the required interpreter state and return a
; valid signed integer result.
; RST18 is suitable for compact numeric helpers when the caller owns a valid BASIC stack frame.
; RST30 is suitable for OS/device services when the caller follows the function-byte and A-status
; contract. Neither interface guarantees that arbitrary RAM pointers survive program edits, NEW,
; LOMEM, or symbol-table compaction.
; ROM overlays and extension mappings matter at every direct-call boundary. A routine reached
; through a page switch may return with a different mapping expectation than it had on entry; use
; the current ROM listing and the gateway code as the authority for exact paging, register
; preservation, and re-entry behavior.
; When extending this reference, prefer semantic invariants and data-layout diagrams over copying
; listing prose. Keep byte-level labels in the address-local annotation fragments and use this
; sectioned file for the cross-routine contracts that remain useful outside one disassembly page.

ORG E000H, SYS0, 2000H

    OR C
    DB DBH                                                                          ; |.|

; DEF routine.
    AND 81H
    CP 01H
    JP NZ,FD5AH
    BIT 2,(IX+00H)
    JR Z,E02EH
    EXX
    PUSH HL
    PUSH DE
    EXX
    POP HL
    DEC HL
    BIT 7,(HL)
    JR Z,E04EH
    RES 7,(HL)
    SET 2,(HL)
    INC HL
    LD DE,(170CH)
    LD (HL),E
    INC HL
    LD (HL),D
    INC HL
    POP DE
    LD (HL),E
    INC HL
    LD (HL),D
    INC HL
    LD (1726H),HL

LE02E:
    EXX
    LD C,01H

LE031:
    DEC C
    DB 3EH                                                                          ; |>|

LE033:
    INC C

LE034:
    LD A,(HL)
    CP FEH
    JP NC,E04BH
    INC HL
    CP 96H
    JR Z,E033H
    CP 95H
    JR Z,E031H
    CP FDH
    JR NZ,E034H
    INC C
    DEC C
    JR NZ,E034H

LE04B:
    JP DB81H

LE04E:
    RST 08H
    RRCA

LE050:
    CALL FC43H

; DIM routine.
    OR A
    JP M,FD5AH
    BIT 0,A
    JP Z,FD5AH
    EXX
    LD A,C
    AND 88H
    JR Z,E04EH
    AND 08H
    CALL NZ,F40BH
    DEC DE
    LD A,(DE)
    XOR 81H
    LD (1701H),A
    LD (DE),A
    INC DE
    LD A,FFH
    LD (DE),A
    PUSH DE
    INC DE
    LD (1726H),DE
    EXX
    CALL FC43H
    BIT 1,(IX+01H)
    JR NZ,E0A3H
    CP A8H
    JR NZ,E0A3H
    CALL FB16H
    INC A
    JR Z,E0E4H
    DEC A
    LD C,A
    POP HL
    LD (1726H),HL
    DEC HL
    RES 0,(HL)
    CALL F3C1H

LE099:
    EXX
    LD A,B
    EXX
    CP A4H
    JR Z,E050H
    JP DBB4H

LE0A3:
    LD A,96H
    CALL FD54H
    SCF

LE0A9:
    CALL NC,FC43H
    CALL FAC4H
    JP M,FB14H
    INC HL
    EX DE,HL
    LD HL,(1726H)
    LD (HL),E
    INC HL
    LD (HL),D
    INC HL
    LD (1726H),HL
    EX DE,HL
    CALL FA2BH
    POP HL
    INC (HL)
    PUSH HL
    CALL NZ,F512H
    EXX
    LD A,B
    EXX
    CP A4H
    JR Z,E0A9H
    LD A,95H
    CALL FD54H
    POP HL
    INC (HL)
    BIT 1,(IX+01H)
    JR NZ,E0E9H
    CP A8H
    LD A,12H
    CALL Z,FB16H
    INC A

LE0E4:
    JP Z,FB14H
    DEC A
    LD C,A

LE0E9:
    PUSH BC
    RST 18H
    INC C
    ADD A,L
    LD H,CDH
    SUB E
    OR F2H
    OR C
    CALL M,C3CDH
    DB FAH, C1H                                                                     ; |..|

LE0F8:
    PUSH HL
    CALL F3BBH
    POP HL
    DEC HL
    LD A,L
    OR H
    JR NZ,E0F8H
    JR E099H

; ELSE routine.
    BIT 0,(IX+02H)
    JP Z,FD5AH
    JP DBBBH

; END routine.
    LD HL,0000H
    LD (170EH),HL
    JP DADAH

; EXT routine.
    CALL FB1BH
    CP 07H
    JP NC,FB14H
    ADD A,A
    PUSH AF
    EXX
    LD A,B
    EXX
    CP A4H
    JR NZ,E13EH
    CALL FABAH
    EX DE,HL
    CP A4H
    JR NZ,E13EH
    CALL FABAH
    CP A4H
    JR NZ,E13EH
    PUSH HL
    CALL FABAH
    LD C,L
    LD B,H
    POP HL

LE13E:
    EX (SP),HL
    PUSH DE
    LD E,H
    LD D,00H
    LD HL,0021H
    ADD HL,DE
    LD E,(HL)
    INC HL
    LD D,(HL)
    LD A,D
    OR E
    JP Z,DBB1H
    LD (0016H),DE
    POP DE
    LD HL,DBB1H
    EX (SP),HL
    EX DE,HL
    JP 0015H

; FOR routine.

; BASIC_FOR - Implements the BASIC FOR statement.
; Entry: Tokenized loop variable, limits, and optional step
; Effects: Pushes a FOR frame on the BASIC stack.
BASIC_FOR:
    CP 03H
    JR Z,E167H
    AND 82H
    JP NZ,FD5AH
    RST 08H
    DB 0EH                                                                          ; |.|

LE167:
    CALL F42EH
    LD A,9AH
    CALL FD54H
    CALL FC8EH
    PUSH HL
    CALL F0A7H
    POP HL
    PUSH HL
    CALL FB28H
    LD A,B4H
    CALL FD54H
    CALL F0A7H
    LD DE,FFEEH
    ADD IY,DE
    CP B8H
    JR Z,E195H
    EX AF,AF'
    LD HL,0001H
    CALL FA2BH
    EX AF,AF'
    SCF

LE195:
    CALL NC,F0A4H
    CP FDH
    JP C,FD5AH
    PUSH IY
    POP HL
    POP DE
    DEC HL
    LD (HL),D
    DEC HL
    LD (HL),E
    LD DE,(170CH)
    DEC HL
    LD (HL),D
    DEC HL
    LD (HL),E
    EXX
    PUSH HL
    EXX
    POP DE
    DEC HL
    LD (HL),D
    DEC HL
    LD (HL),E
    DEC HL
    LD (HL),2BH
    PUSH HL
    POP IY
    JP DBB1H

LE1BE:
    CP F5H
    RST 10H
    EXX

LE1C2:
    DEC HL
    LD A,(HL)
    CP ECH
    JR NZ,E1C2H
    JP FFA4H

; INPUT routine.

; BASIC_INPUT - Implements the BASIC INPUT statement.
; Entry: Tokenized variable list and optional prompt
; Effects: Reads text and assigns BASIC variables.
BASIC_INPUT:
    EX AF,AF'
    SCF
    EX AF,AF'
    LD HL,E2EBH
    LD (IX+05H),20H
    SCF

LE1D6:
    CALL NC,FC43H
    CP BAH
    JR NZ,E1FCH

; INPUT PROMPT routine.
    CALL FC43H
    CALL F294H
    PUSH IY
    CALL FA21H
    POP HL
    INC HL
    EXX
    LD A,B
    EXX

LE1ED:
    EX AF,AF'
    OR A
    EX AF,AF'
    CP A4H
    JR Z,E1D6H
    CP FDH
    JR Z,E204H
    JR NC,E207H

LE1FA:
    RST 08H
    DB 01H                                                                          ; |.|

LE1FC:
    CALL FBFBH
    JR Z,E1EDH
    EX AF,AF'
    JR NC,E1FAH

LE204:
    CALL NC,FC43H

LE207:
    LD A,(1705H)
    CP 20H
    CALL Z,FE7FH
    RST 30H
    INC H
    CALL FF4FH
    JR NZ,E1BEH
    INC HL
    LD (1716H),HL
    DB F6H                                                                          ; |.|

; READ routine.
    SCF
    EX AF,AF'
    EXX
    LD A,B
    EXX
    SCF

LE221:
    CALL NC,FC43H
    CP FDH
    JP NC,DBB4H
    AND 81H
    CP 01H
    JP NZ,FD5AH
    EX AF,AF'
    JR NC,E27CH
    LD HL,(1714H)
    LD A,L
    OR H
    JR Z,E268H

LE23A:
    LD A,(HL)
    INC HL
    CP 20H
    JR Z,E23AH
    DEC HL
    CP 21H
    JR Z,E25EH
    CP FDH
    JR C,E27CH

LE249:
    EXX
    PUSH HL
    PUSH DE
    PUSH BC
    CALL FCC5H
    EXX
    POP BC
    POP DE
    POP HL
    EXX
    INC HL

LE256:
    CP FBH
    JR Z,E23AH
    CP FEH
    JR C,E249H

LE25E:
    LD HL,(1712H)
    LD E,(HL)
    LD D,00H
    ADD HL,DE
    LD (1712H),HL

LE268:
    LD HL,(1712H)
    LD A,(HL)
    OR A
    JR Z,E27AH
    INC HL
    INC HL
    INC HL

LE272:
    LD A,(HL)
    INC HL
    CP 20H
    JR Z,E272H
    JR E256H

LE27A:
    RST 08H
    RLCA

LE27C:
    EX AF,AF'
    PUSH HL
    EXX
    PUSH BC
    CALL F42FH
    POP BC
    BIT 1,C
    EX (SP),HL
    JR NZ,E294H
    CALL F8A1H
    EX (SP),HL
    CALL FB41H
    JR E2B0H

LE292:
    RST 08H
    INC C

LE294:
    CALL FC8EH
    CALL F914H
    EX AF,AF'
    JR NC,E2A6H
    EX AF,AF'
    JR NC,E292H
    RLA
    JP C,F912H
    JR E2ACH

LE2A6:
    EX AF,AF'
    PUSH HL
    CALL EC7FH
    POP HL

LE2AC:
    EX (SP),HL
    CALL FB28H

LE2B0:
    POP HL
    EX AF,AF'
    JR NC,E2CEH
    EX AF,AF'

LE2B5:
    LD A,(HL)
    INC HL
    CP 20H
    JR Z,E2B5H
    CP 2CH
    JR Z,E2C9H
    DEC HL
    CP 21H
    JR Z,E2C9H
    BIT 7,(HL)
    JP Z,E292H

LE2C9:
    LD (1714H),HL

LE2CC:
    JR E2DCH

LE2CE:
    EX AF,AF'

LE2CF:
    LD A,(HL)
    INC HL
    CP 2CH
    JR Z,E2D9H
    INC A
    JR NZ,E2CFH
    DEC HL

LE2D9:
    LD (1716H),HL

LE2DC:
    EXX
    LD A,B
    EXX
    CP FDH
    JP NC,DBB4H
    CP A4H
    JP Z,E221H
    RST 08H
    LD BC,3F02H
    DB 20H                                                                          ; | |

; IF routine.

; BASIC_IF - Implements the BASIC IF statement.
; Entry: Tokenized condition and branch statement
; Effects: Changes interpreter control flow.
BASIC_IF:
    SET 0,(IX+02H)
    CALL F0A7H
    LD A,(IY+06H)
    OR A
    EX AF,AF'
    CALL FA1BH
    EXX
    PUSH HL
    EXX
    POP HL
    LD A,B5H
    CALL FD54H
    EX AF,AF'
    JR Z,E31CH
    EX AF,AF'
    JR E314H

LE30C:
    INC HL
    PUSH HL
    EXX
    POP HL
    EXX
    CALL FC43H

LE314:
    CP 02H
    JP Z,E3B2H
    JP DB81H

LE31C:
    LD IY,(171AH)

LE320:
    CALL FCC5H
    CP F4H
    JR Z,E30CH
    CP FEH
    JP NC,DBBBH
    PUSH HL
    EXX
    POP HL
    EXX
    JR E320H

; ON routine.
    SET 0,(IX+02H)
    CALL FB1BH
    LD B,A
    EXX
    LD A,B
    EXX
    CP EFH
    JR Z,E3AFH
    CP F0H
    JR NZ,E369H
    CALL E357H
    CALL FBDEH
    LD IY,(171AH)
    PUSH HL
    CALL FCD1H
    EX DE,HL
    POP HL
    JR E38EH

LE357:
    CALL FC43H
    DEC B
    RET Z
    EXX
    PUSH HL
    EXX
    POP HL
    CALL FC43H
    JR NC,E36BH
    CP A4H
    JR Z,E357H

LE369:
    RST 08H
    DB 01H                                                                          ; |.|

LE36B:
    POP DE
    LD IY,(171AH)

LE370:
    EXX
    CALL FCC5H
    CP F4H
    JR Z,E30CH
    CP FEH
    JP NC,FB14H
    PUSH HL
    EXX
    POP HL
    JR E370H

; GOSUB routine.

; BASIC_GOSUB - Implements the BASIC GOSUB statement.
; Entry: Target line from tokenized statement
; Effects: Pushes a return frame and branches to a BASIC line.
BASIC_GOSUB:
    CALL FBDEH
    CALL FC43H
    JR C,E369H
    EXX
    PUSH HL
    EXX
    POP DE

LE38E:
    PUSH HL
    CALL FC8EH
    PUSH IY
    POP HL
    DEC HL
    LD A,(1702H)
    LD (HL),A
    LD BC,(170CH)
    DEC HL
    LD (HL),B
    DEC HL
    LD (HL),C
    DEC HL
    LD (HL),D
    DEC HL
    LD (HL),E
    DEC HL
    LD (HL),06H
    PUSH HL
    POP IY
    POP HL
    JR E3B9H

LE3AF:
    CALL E357H

; GOTO routine.

; BASIC_GOTO - Implements the BASIC GOTO statement.
; Entry: Target line from tokenized statement
; Effects: Branches to a BASIC line.
BASIC_GOTO:
    CALL FBDEH
    LD IY,(171AH)

LE3B9:
    JP DE29H
    DEC HL
    EXX
    CALL FC43H

; LET routine.

; BASIC_LET - Implements BASIC assignment.
; Entry: Tokenized variable and expression
; Effects: Updates a BASIC variable.
BASIC_LET:
    AND FDH
    CP 01H
    JP NZ,FD5AH
    EXX
    BIT 2,C
    JP NZ,FD5AH
    BIT 3,C
    CALL NZ,F40BH
    LD (IX+01H),C
    EXX
    CALL F42EH
    EXX
    LD A,B
    EXX
    PUSH HL
    CALL E3E8H
    POP HL
    CALL FB3BH
    JP DBB1H

LE3E8:
    SUB 96H
    JR NZ,E44AH
    BIT 1,C
    JP NZ,FD5AH
    INC HL
    PUSH HL
    LD C,(HL)
    LD B,A
    CALL FD27H
    LD A,D
    CP E
    JR NC,E3FEH
    LD A,E
    DEC A

LE3FE:
    LD D,A
    LD A,C
    SUB D
    POP HL
    PUSH IY
    PUSH HL
    PUSH DE
    PUSH BC
    JR C,E417H
    JR Z,E417H
    ADD HL,BC
    LD C,A
    PUSH IY
    POP DE
    DEC DE
    LDDR
    INC DE
    PUSH DE
    POP IY

LE417:
    CALL E44AH
    POP BC
    POP DE
    POP HL
    LD A,E
    PUSH IY
    POP DE
    INC DE
    CP 02H
    JR C,E432H
    DEC A
    CP C
    JR NC,E42BH
    LD C,A

LE42B:
    ADD HL,BC
    INC C
    DEC C
    JR Z,E432H
    LDDR

LE432:
    POP HL
    DEC HL
    OR A
    SBC HL,DE
    INC H
    DEC H
    JP NZ,F912H
    INC L
    JP Z,F912H
    DEC L
    EX DE,HL
    LD (HL),E
    DEC HL
    LD (HL),01H
    PUSH HL
    POP IY
    RET

LE44A:
    LD A,9AH
    CALL FD54H
    JP F28DH

; LOMEM routine.
    CALL FAC4H
    LD DE,(1720H)
    OR A
    SBC HL,DE
    ADD HL,DE
    JP C,FB14H
    LD DE,(1722H)
    SBC HL,DE
    JP Z,DBB4H
    PUSH HL
    CALL C,FC86H
    LD C,L
    LD B,H
    EX DE,HL
    JR C,E485H
    POP DE
    PUSH DE
    PUSH HL
    INC D
    JP Z,FB14H
    CALL FC99H
    POP HL
    PUSH HL
    CALL DCC9H
    POP HL
    ADD HL,BC
    JR E48DH

LE485:
    OR A
    SBC HL,BC
    PUSH HL
    CALL DCE9H
    POP HL

LE48D:
    LD (1722H),HL
    POP BC
    BIT 2,(IX+00H)
    JR Z,E4A3H
    LD HL,(170CH)
    ADD HL,BC
    LD (170CH),HL
    PUSH BC
    EXX
    POP DE
    ADD HL,DE
    EXX

LE4A3:
    CALL DCFCH
    JP DBB1H

LE4A9:
    RST 08H
    EX AF,AF'

LE4AB:
    EXX
    LD A,B
    EXX
    CP A4H
    JP NZ,DBB4H
    CALL FC43H

; NEXT routine.

; BASIC_NEXT - Implements the BASIC NEXT statement.
; Entry: Optional loop variable from tokenized statement
; Effects: Updates or removes a FOR loop frame.
BASIC_NEXT:
    SET 2,(IX+00H)
    JR NC,E4E3H
    CP 03H
    JR Z,E4C7H
    AND 82H
    JP NZ,FD5AH
    RST 08H
    DB 0EH                                                                          ; |.|

LE4C7:
    CALL F42EH
    EX DE,HL
    DB 21H                                                                          ; |!|

LE4CC:
    ADD IY,BC
    LD A,2BH
    CALL FCE7H
    JR C,E4A9H
    LD C,05H
    ADD HL,BC
    LD C,2BH
    LD A,(HL)
    CP E
    JR NZ,E4CCH
    INC HL
    LD A,(HL)
    CP D
    JR NZ,E4CCH

LE4E3:
    LD A,2BH
    CALL FCE7H
    JR C,E4A9H
    INC HL
    LD E,(HL)
    INC HL
    LD D,(HL)
    PUSH DE
    INC HL
    LD E,(HL)
    INC HL
    LD D,(HL)
    PUSH DE
    INC HL
    LD E,(HL)
    INC HL
    LD D,(HL)
    PUSH DE
    INC HL
    EX DE,HL
    LD DE,0022H
    ADD IY,DE
    CALL FA63H
    DEC DE
    LD HL,FFF7H
    ADD HL,DE
    LD BC,0009H
    LDDR
    INC DE
    PUSH DE
    POP IY
    BIT 7,(IY+08H)
    PUSH AF
    CALL F493H
    POP AF
    POP HL
    PUSH AF
    PUSH IY
    CALL FB28H
    POP IY
    CALL F693H
    POP BC
    POP DE
    POP HL
    LD A,C
    RLA
    JR NC,E533H
    JR Z,E536H
    JP P,E4ABH
    XOR A

LE533:
    JP M,E4ABH

LE536:
    LD (170CH),DE
    LD DE,FFD5H
    ADD IY,DE
    JP DB81H

; OUT routine.

; BASIC_OUT - Implements the BASIC OUT statement.
; Entry: Port and byte expressions
; Effects: Writes a hardware I/O port.
BASIC_OUT:
    CALL FB1BH
    LD C,A
    LD A,A4H
    CALL FD54H
    CALL FB1BH
    OUT (C),A
    JP DBB1H

; POKE routine.

; BASIC_POKE - Implements the BASIC POKE statement.
; Entry: Address and byte expressions
; Effects: Writes memory, including video-memory address translation.
BASIC_POKE:
    CALL FCFFH
    LD A,A4H
    CALL FD54H
    CALL FB1BH
    LD C,A
    CALL FFE7H
    JR C,E567H
    DI
    OUT (02H),A

LE567:
    LD (HL),C
    LD A,70H
    OUT (02H),A
    EI
    JP DBB1H

; LPRINT routine.
    LD C,40H
    DB 11H                                                                          ; |.|

; BASIC_PRINT - Implements BASIC PRINT and OUTPUT.
; Entry: Tokenized print list and formatting
; Effects: Writes to the selected output device.
BASIC_PRINT:
    LD C,20H
    LD (IX+05H),C
    EX AF,AF'
    XOR A
    EX AF,AF'
    SCF

LE57C:
    CALL NC,FC43H
    CP AFH
    JR NZ,E5A6H
    CALL FC43H
    CALL F294H
    LD HL,1831H
    LD (HL),7FH
    PUSH HL
    CALL FB41H
    POP HL
    INC HL
    LD E,(HL)
    LD D,00H
    INC HL
    LD (172EH),HL
    ADD HL,DE
    LD (HL),D
    LD (1730H),HL
    EX AF,AF'
    SET 0,A
    EX AF,AF'
    JR E5BAH

LE5A6:
    CP B0H
    JR NZ,E5CCH
    CALL FB16H
    LD C,A
    LD A,A4H
    CALL FD54H
    CALL FB1BH
    LD B,A
    CALL E68BH

LE5BA:
    EXX
    LD A,B
    EXX
    EX AF,AF'
    OR A
    EX AF,AF'
    DB FEH                                                                          ; |.|

LE5C1:
    AND H
    JR Z,E57CH
    CP FDH
    JR Z,E5D6H
    JR NC,E5D9H

LE5CA:
    RST 08H
    DB 01H                                                                          ; |.|

LE5CC:
    CALL FC00H
    JR Z,E5BDH
    EX AF,AF'
    JR C,E5CAH
    EX AF,AF'
    SCF

LE5D6:
    CALL NC,FC43H

LE5D9:
    EX AF,AF'
    SCF
    EX AF,AF'

LE5DC:
    EX AF,AF'
    BIT 0,A
    PUSH AF
    CALL NZ,E69CH
    POP AF
    EX AF,AF'
    EXX
    LD A,B
    EXX
    CP A4H
    JR NZ,E5F2H
    LD A,09H
    CALL FE9AH
    DB C2H                                                                          ; |.|

LE5F2:
    CP A0H
    JR NZ,E5FEH
    CALL FC43H
    EX AF,AF'
    OR A
    JP E67FH

LE5FE:
    CP B6H
    JR NZ,E617H
    LD A,96H
    CALL FD51H
    CALL FB1BH
    LD B,A
    LD A,95H
    CALL FD54H
    LD C,00H
    CALL E68BH
    JR E67DH

LE617:
    CP FDH
    JR NC,E683H
    EX AF,AF'
    BIT 0,A
    PUSH AF
    JR Z,E638H
    EX AF,AF'
    LD HL,(172EH)
    LD DE,(1730H)
    OR A
    SBC HL,DE
    JR C,E639H
    LD HL,1833H
    LD (172EH),HL
    CALL E69CH
    EX AF,AF'

LE638:
    EX AF,AF'

LE639:
    EXX
    LD A,B
    EXX
    CP 02H
    JR NC,E665H
    CALL F294H
    RLA
    JR NC,E669H
    POP AF
    LD HL,FF9CH
    JP NZ,FFF0H
    OR FFH
    PUSH IY
    POP HL
    INC HL
    PUSH AF
    CALL FE7FH
    CALL FA21H

LE65A:
    POP AF
    DEC A
    JP M,E67DH
    PUSH AF
    CALL FEC7H
    JR E65AH

LE665:
    CALL F0A7H
    RLA

LE669:
    JP NC,FD5AH
    POP AF
    LD HL,FCB5H
    JP NZ,FFF0H
    PUSH IY
    POP HL
    INC HL
    CALL FEBAH
    CALL FA1BH

LE67D:
    EX AF,AF'
    SCF

LE67F:
    EX AF,AF'
    JP E5DCH

LE683:
    EX AF,AF'
    CALL C,FE93H
    EX AF,AF'
    JP DBB4H

LE68B:
    LD A,(1705H)
    CP 20H
    JR Z,E695H
    CP 00H
    RET NZ

LE695:
    OR 03H
    CALL 001BH
    RST 10H
    RET

LE69C:
    LD DE,(1730H)
    LD HL,(172EH)

LE6A3:
    LD A,(HL)
    OR A
    SBC HL,DE
    RET NC
    ADD HL,DE
    PUSH HL
    LD HL,E6BDH
    LD BC,000AH
    CPIR
    POP HL
    RET Z
    CALL FE9AH
    INC HL
    LD (172EH),HL
    JR E6A3H

; Special format-control characters used by PRINT USING.
    DB 3CH, 3EH, 23H, 2AH, 25H, 2BH, 2DH, 24H, 5EH, 2EH                             ; |<>#*%+-$^.|

; RANDOMIZE routine.
    LD A,R
    LD (1709H),A
    LD HL,(0B1DH)
    LD (170AH),HL
    CALL E6D8H
    JP DBB1H

LE6D8:
    LD B,10H
    LD A,(1709H)
    LD HL,(170AH)

LE6E0:
    LD C,A
    RRCA
    RRCA
    RRCA
    XOR C
    RLA
    RLA
    ADC HL,HL
    LD A,C
    ADC A,A
    DJNZ E6E0H
    LD (170AH),HL
    LD (1709H),A
    RET

; RESTORE routine.
    LD HL,(1722H)
    CP 02H
    JR NZ,E701H
    CALL FBDEH
    CALL FC43H

LE701:
    LD (1712H),HL
    LD HL,0000H
    LD (1714H),HL
    JP DBB4H

LE70D:
    RST 08H
    ADD HL,BC

; RETURN routine.

; BASIC_RETURN - Implements the BASIC RETURN statement.
; Entry: BASIC stack contains a GOSUB frame
; Effects: Restores BASIC execution position.
BASIC_RETURN:
    LD A,06H
    CALL FCE7H
    JR C,E70DH
    SET 2,(IX+00H)
    INC HL
    LD E,(HL)
    INC HL
    LD D,(HL)
    INC HL
    LD C,(HL)
    INC HL
    LD B,(HL)
    LD (170CH),BC
    INC HL
    LD A,(HL)
    LD (1702H),A
    INC HL
    PUSH HL
    POP IY
    EX DE,HL
    JP DB81H

; GRAPHICS routine.

; BASIC_GRAPHICS - Implements the BASIC GRAPHICS statement.
; Entry: Tokenized graphics parameters
; Effects: Calls graphics OS routines.
BASIC_GRAPHICS:
    CALL FB1BH
    LD C,00H
    CP 02H
    JR Z,E747H
    INC C
    CP 04H
    JR Z,E747H
    INC C
    CP 10H
    JP NZ,FB14H

LE747:
    RST 30H
    INC B
    RST 10H
    JP DBB1H

LE74D:
    RST 30H
    EX AF,AF'

LE74F:
    CALL FC43H
    JR NC,E78DH

; PLOT routine.

; BASIC_PLOT - Implements the BASIC PLOT statement.
; Entry: Tokenized coordinates and optional PAINT modifier
; Effects: Updates graphics position and video memory.
BASIC_PLOT:
    JR NC,E782H
    CP BEH
    JR NZ,E75FH

; PLOT PAINT routine.
    RST 30H
    LD A,(BC)
    RST 10H
    JR E77AH

LE75F:
    CP A0H
    JR Z,E74DH
    CP A4H
    JR Z,E784H
    CALL FAC4H
    LD C,L
    LD B,H
    LD A,A4H
    CALL FD54H
    CALL FAC4H
    EX DE,HL
    PUSH AF
    RST 30H
    LD B,D7H
    POP AF

LE77A:
    CP A0H
    JR Z,E74DH
    CP A4H
    JR Z,E784H

LE782:
    RST 30H
    EX AF,AF'

LE784:
    RST 30H
    ADD HL,BC
    EXX
    LD A,B
    EXX
    CP FDH
    JR C,E74FH

LE78D:
    JP DBB4H

; BASIC_SET - Dispatches BASIC SET subcommands such as MODE, INK, PAPER, and PALETTE.
; Entry: Tokenized SET subcommand and parameters
; Effects: Updates video, editor, or keyboard settings.
BASIC_SET:
    LD HL,E7E4H
    CALL FD12H
    JR C,E7DAH
    CALL FB1BH

LE79B:
    LD E,00H

LE79D:
    LD (001FH),A
    LD HL,1941H
    PUSH HL
    LD B,7FH

LE7A6:
    DEC E
    JP P,E7B4H
    EXX
    LD A,B
    EXX
    CP A4H
    JR NZ,E7CDH
    CALL FC43H

LE7B4:
    CP 02H
    JR NC,E7C5H
    CALL F294H
    LD HL,193FH
    LD (HL),7FH
    CALL FB41H
    JR E7D2H

LE7C5:
    CALL FB1BH
    LD (HL),A
    INC HL
    DJNZ E7A6H
    INC B

LE7CD:
    LD (HL),00H
    INC HL
    DJNZ E7CDH

LE7D2:
    POP DE
    CALL 001EH
    RST 10H
    EXX
    LD A,B
    EXX

LE7DA:
    CP A0H
    JP NZ,DBB4H
    CALL FC43H
    JR E790H

; SET subcommand dispatch table; token plus relative routine selector.
    DB C3H, 11H, B7H, 12H, C4H, 13H, BCH, 14H, C7H, 15H, B9H, 16H, C8H, 24H, BDH, 2DH ; |.............$.-|
    DB AEH, 34H, 00H                                                                ; |.4.|

; SET MODE routine.
    DB 1EH, 00H, 21H                                                                ; |..!|

; SET STYLE routine.
    DB 1EH, 01H, 21H                                                                ; |..!|

; SET INK routine.
    DB 1EH, 02H, 21H                                                                ; |..!|

; SET PAPER routine.
    DB 1EH, 03H, 21H                                                                ; |..!|

; SET DELAY routine.
    DB 1EH, 1AH, 21H                                                                ; |..!|

; SET RATE routine.
    DB 1EH, 1CH, 16H, 00H, 21H, 4BH, 0BH, 19H, CDH, 1BH, FBH, 77H                   ; |....!K.....w|

LE812:
    EXX
    LD A,B
    EXX
    RET

; SET CHARACTER routine.
    POP HL
    POP HL
    CALL FB1BH
    LD C,A
    LD A,0BH
    JP E79BH

; SET PALETTE routine.
    POP HL
    POP HL
    LD A,0CH
    LD E,01H
    JP E79DH

; SET BORDER routine.
    CALL FB1BH
    ADD A,A
    LD (0B4FH),A
    JR E812H

; SOUND routine.

; BASIC_SOUND - Implements the BASIC SOUND statement.
; Entry: Tokenized pitch, volume, duration, and related parameters
; Effects: Programs sound through the OS sound routine.
BASIC_SOUND:
    LD HL,0D15H
    LD (172AH),HL
    LD HL,3207H
    LD (002CH),HL
    LD HL,0B15H
    LD (HL),FFH
    SCF

LE845:
    CALL NC,FC43H
    CP A0H
    JR Z,E86FH
    LD HL,E87BH
    CALL FD12H
    CP A4H
    JR Z,E845H
    PUSH AF
    LD DE,(172AH)
    LD BC,(002CH)
    RST 30H
    INC SP
    XOR A
    LD (0B15H),A
    POP AF
    CP FDH
    JR NC,E878H
    CP A0H
    JP NZ,FD5AH

LE86F:
    XOR A
    LD (0B15H),A
    CALL FC43H
    JR C,E845H

LE878:
    JP DBB4H

; SOUND subcommand dispatch table; same format as SET table.
    DB BBH, 05H, C6H, 0CH, B3H, 0BH, 00H, CDH, C4H, FAH, 22H, 2AH, 17H, F0H, CFH, 04H ; |.........."*....|
    DB F6H, 37H, 11H, 2CH, 00H, 38H, 01H, 13H, CDH, 1BH, FBH                        ; |.7.,.8.....|
    LD (DE),A
    EXX
    LD A,B
    EXX
    RET

; BASIC CLOSE routine.
    LD C,50H
    CALL FBEEH
    CP E1H
    JR Z,E8AFH
    SET 7,C
    CP FDH
    JR NC,E8B2H
    CP ECH
    JP NZ,FD5AH

LE8AF:
    CALL FC43H

LE8B2:
    LD A,C
    AND 7FH
    CP 50H
    JR Z,E8BDH
    CP 60H
    JR NZ,E8C7H

LE8BD:
    LD A,C
    OR 04H
    CALL 001BH
    RST 10H
    JP DBB1H

LE8C7:
    RST 08H
    RST 38H

; OPEN BASIC routine.

; BASIC_OPEN - Implements the BASIC OPEN statement.
; Entry: Tokenized file and device parameters
; Effects: Opens a file through the selected OS device.
BASIC_OPEN:
    LD C,50H
    CALL FBEEH
    EX AF,AF'
    LD A,C
    CP 50H
    JR Z,E8D8H
    CP 60H
    JR NZ,E8C7H

LE8D8:
    OR 03H
    LD C,A
    EX AF,AF'
    LD DE,19CEH
    CP E1H
    JR Z,E8F2H
    SET 7,C
    CP 02H
    JR C,E8F9H
    CP FDH
    JR NC,E905H
    CP ECH
    JP NZ,FD5AH

LE8F2:
    CALL FC43H
    CP 02H
    JR NC,E905H

LE8F9:
    PUSH BC
    CALL F294H
    PUSH IY
    CALL FA21H
    POP DE
    INC DE
    POP BC

LE905:
    LD A,C
    LD (0B6BH),A
    CALL 001BH
    RST 10H
    JP DBB1H

; GET routine.
    LD C,10H
    CALL FBEEH
    EX AF,AF'
    LD A,C
    OR 81H
    CALL 001BH
    PUSH IY
    POP HL
    CP ECH
    JR Z,E929H
    OR A
    RST 10H
    DEC HL
    LD (HL),C
    INC A
    DB 0EH                                                                          ; |.|

LE929:
    XOR A
    DEC HL
    LD (HL),A
    DEC HL
    LD (HL),01H
    EX AF,AF'
    CP FDH
    JP NC,DBB4H
    PUSH HL
    POP IY
    CP 01H
    JR NZ,E93FH
    EXX
    BIT 2,C

LE93F:
    JP NZ,FD5AH
    BIT 3,C
    CALL NZ,F40BH
    EXX
    CALL F42EH
    CALL FB41H
    JP DBB1H

; LOAD routine.

; BASIC_LOAD - Implements the BASIC LOAD statement.
; Entry: Tokenized filename and options
; Effects: Loads a BASIC program or data through an OS device.
BASIC_LOAD:
    CALL EA35H
    CALL DE10H
    PUSH HL
    LD DE,(19E1H)
    PUSH DE
    CALL FC99H
    POP BC
    POP DE
    PUSH DE
    LD A,(1705H)
    OR 82H
    CALL 001BH
    PUSH AF
    CALL NZ,DE10H
    POP AF
    RST 10H
    CALL DCFCH
    CALL EA5AH
    POP HL
    LD A,(19E3H)
    OR A
    JP Z,DADAH
    JP DE23H

; SAVE routine.

; BASIC_SAVE - Implements the BASIC SAVE statement.
; Entry: Tokenized filename and options
; Effects: Saves a BASIC program or data through an OS device.
BASIC_SAVE:
    XOR A
    CALL E9FBH
    LD DE,19EFH
    LD B,10H
    XOR A

LE98C:
    DEC DE
    LD (DE),A
    DJNZ E98CH
    PUSH DE
    INC A
    LD (19E0H),A
    LD A,(1707H)
    LD (19E3H),A
    CALL DD41H
    INC HL
    LD DE,(1722H)
    XOR A
    LD (1707H),A
    SBC HL,DE
    LD (19E1H),HL
    EX (SP),HL
    PUSH DE
    LD B,10H
    LD A,(1705H)
    OR 01H
    LD (001FH),A

LE9B8:
    LD C,(HL)
    INC HL
    PUSH BC
    CALL 001EH
    RST 10H
    POP BC
    DJNZ E9B8H
    POP DE
    POP BC
    LD A,(1705H)
    OR 02H
    CALL 001BH
    RST 10H
    CALL EA5AH
    JP DBB1H

; VERIFY routine.
    CALL EA35H
    CALL DD41H
    INC HL
    LD DE,(1722H)
    OR A
    SBC HL,DE
    LD BC,(19E1H)
    SBC HL,BC
    JP NZ,EA58H
    LD A,(1705H)
    OR 85H
    CALL 001BH
    RST 10H
    CALL EA5AH
    JP DBB1H

LE9F9:
    LD A,80H

LE9FB:
    SET 3,(IX+00H)
    PUSH AF
    LD C,50H
    CALL FBEEH
    EX AF,AF'
    LD A,C
    CP 50H
    JR Z,EA10H
    CP 60H
    JP NZ,E8C7H

LEA10:
    POP BC
    OR B
    LD (1705H),A
    OR 03H
    LD (001FH),A
    EX AF,AF'
    LD DE,19CEH
    CP 02H
    JR NC,EA2CH
    CALL F294H
    PUSH IY
    CALL FA21H
    POP DE
    INC DE

LEA2C:
    XOR A
    LD (0B6BH),A
    CALL 001EH
    RST 10H
    RET

LEA35:
    CALL E9F9H
    LD A,(1705H)
    OR 81H
    LD (001FH),A
    LD HL,19DFH
    PUSH HL
    LD B,10H

LEA46:
    PUSH BC
    CALL 001EH
    RST 10H
    LD (HL),C
    INC HL
    POP BC
    DJNZ EA46H
    POP HL
    OR (HL)
    JR NZ,EA58H
    INC HL
    INC A
    SUB (HL)
    RET Z

LEA58:
    RST 08H
    DB 10H                                                                          ; |.|

LEA5A:
    LD A,(1705H)
    OR 04H
    CALL 001BH
    RST 10H
    RES 3,(IX+00H)
    RET

; EVAL_NUMERIC_ARGUMENT - Evaluates a parenthesized numeric function argument onto the BASIC
; stack.
; Entry: HL' points into tokenized BASIC source
; Exit: Numeric value pushed on BASIC stack; IY updated
; Effects: Consumes source tokens and grows the BASIC stack.
EVAL_NUMERIC_ARGUMENT:
    LD A,96H
    CALL FD54H
    CALL F0A7H

LEA70:
    LD A,95H
    JP FD54H

LEA75:
    LD A,96H
    CALL FD54H
    CALL F294H
    LD A,95H
    JP FD54H
    LD HL,(1718H)
    LD A,(HL)
    INC HL
    LD (1718H),HL
    LD L,A
    XOR A
    LD H,A
    PUSH HL
    ADD HL,HL
    ADD HL,HL
    ADD HL,HL
    POP DE
    SBC HL,DE
    DB 11H                                                                          ; |.|

LEA95:
    LD DE,19C1H
    JR EAA2H

LEA9A:
    LD HL,19C7H
    JR EAA2H

LEA9F:
    LD HL,19C0H

LEAA2:
    CALL FC8EH
    LD DE,0006H
    ADD HL,DE
    PUSH IY
    POP DE
    DEC DE
    LDD
    XOR A
    LD (DE),A
    DEC DE
    LD BC,0006H
    LDDR
    LD A,09H
    LD (DE),A
    PUSH DE
    POP IY
    RET

LEABE:
    LD DE,19C7H
    JR EAC6H

LEAC3:
    LD DE,19C0H

LEAC6:
    CALL EAD5H
    PUSH HL
    POP IY
    RET

LEACD:
    LD DE,19C7H
    JR EAD5H

LEAD2:
    LD DE,19C0H

LEAD5:
    PUSH IY
    POP HL
    INC HL
    LD BC,0006H
    LDIR
    INC HL
    LDI
    RET
    NOP
    NOP
    INC BC
    LD B,C
    LD B,D
    LD D,E
    LD A,(BC)

; BASIC_ABS - Implements the BASIC ABS function.
; Entry: Argument on BASIC stack
; Exit: Absolute value on BASIC stack
BASIC_ABS:
    CALL EA68H
    RES 7,(IY+08H)
    RET

LEAF1:
    CALL FC43H
    CALL EA68H
    LD BC,0000H
    LD A,(IY+08H)
    AND 80H
    LD C,A
    PUSH BC
    CALL NZ,F726H
    RST 18H
    EX AF,AF'
    ADD A,L
    LD BC,93CDH
    OR FAH
    LD A,(DE)
    EX DE,HL
    JR Z,EB1AH
    POP BC
    LD B,02H
    PUSH BC
    RST 18H
    DEC B
    LD BC,0106H
    ADC A,D

LEB1A:
    RST 18H
    LD B,85H
    LD (BC),A
    CALL F693H
    JP M,EB3CH
    JR Z,EB3CH
    POP BC
    INC B
    PUSH BC
    RST 18H
    DEC B
    INC B
    LD B,02H
    DEC B
    NOP
    INC BC
    DEC B
    NOP
    INC BC
    LD B,00H
    DEC B
    INC BC
    LD B,00H
    DB 01H, 8AH                                                                     ; |..|

LEB3C:
    RST 18H
    LD B,0CH
    INC C
    INC C
    LD (BC),A
    EX AF,AF'
    DEC B
    LD B,02H
    DEC B
    DEC B
    NOP
    LD B,02H
    LD B,05H
    EX AF,AF'
    NOP
    LD B,02H
    DEC B
    RLCA
    NOP
    LD BC,8002H
    POP BC
    LD A,B
    CP 02H
    CALL NC,F726H
    PUSH BC
    LD HL,C214H
    DEC B
    JR Z,EB71H
    LD HL,C206H
    DEC B
    JR Z,EB71H
    LD HL,C20DH
    DEC B
    JR NZ,EB77H

LEB71:
    CALL EAA2H
    CALL F493H

LEB77:
    POP BC
    LD A,C
    XOR (IY+08H)
    LD (IY+08H),A
    RET
    JP PO,04EAH
    LD B,E
    LD C,B
    LD D,D
    INC H
    EX AF,AF'
    CALL EA68H
    CALL FB1AH
    PUSH IY
    POP HL
    DEC HL
    LD (HL),A
    DEC HL
    LD (HL),01H
    DEC HL
    LD (HL),01H
    PUSH HL
    POP IY
    RET
    ADD A,B
    EX DE,HL
    INC BC
    LD B,E
    LD C,A
    LD D,E
    LD A,(BC)

; BASIC_COS - Implements the BASIC COS function.
; Entry: Argument on BASIC stack
; Exit: Cosine on BASIC stack
BASIC_COS:
    CALL EA68H
    RST 18H
    DEC B
    INC HL
    ADD A,B
    JP EE5EH
    SBC A,L
    EX DE,HL
    INC BC
    LD B,L
    LD E,B
    LD D,B
    LD A,(BC)
    CALL EA68H

LEBB8:
    RST 18H
    INC C
    DEC B
    ADD HL,BC
    ADD A,D
    CALL ECAFH
    LD A,(IY+08H)
    LD C,A
    AND 7FH
    CP 43H
    JR C,EBD4H
    OR C
    JP P,F912H

LEBCE:
    CALL FA1BH
    JP F9F9H

LEBD4:
    CALL FA92H
    CALL FAC3H
    LD E,L
    LD D,H
    LD BC,007EH
    OR A
    ADC HL,BC
    JP M,EBCEH
    SLA C
    SBC HL,BC
    JP NC,F912H
    PUSH DE
    RST 18H
    ADD HL,BC
    DEC B
    LD A,(BC)
    LD (BC),A
    INC BC
    RLCA
    DEC B
    DEC BC
    LD (BC),A
    INC BC
    INC C
    INC C
    LD (BC),A
    EX AF,AF'
    DEC B
    DJNZ EBFFH

LEBFF:
    LD B,02H
    DEC B
    RRCA
    NOP
    DEC BC
    DEC B
    LD C,06H
    LD (BC),A
    DEC B
    DEC C
    NOP
    LD B,02H
    DEC B
    INC C
    NOP
    LD (BC),A
    EX AF,AF'
    RLCA
    LD B,03H
    LD BC,0005H
    NOP
    INC C
    NOP
    ADC A,D
    POP DE
    BIT 0,E
    JR Z,EC37H
    PUSH DE
    RST 18H
    LD B,05H
    JR NZ,EC2AH

LEC28:
    ADC A,D
    POP DE

LEC2A:
    INC D
    DEC D
    INC DE
    JR Z,EC37H
    JP M,EC37H
    LD HL,19C6H
    INC (HL)
    DEC DE

LEC37:
    LD HL,19C6H
    XOR A
    OR E
    RRA
    ADD A,(HL)
    AND 7FH
    LD (HL),A
    JP EA9FH
    XOR (HL)
    EX DE,HL
    INC B
    LD B,(HL)
    LD D,D
    LD B,L
    LD B,L
    LD A,(BC)
    PUSH IY
    POP HL
    LD DE,(1726H)
    OR A
    SBC HL,DE
    LD DE,0100H
    SBC HL,DE
    LD DE,7FFFH
    SBC HL,DE
    PUSH DE
    CALL FA2BH
    POP HL
    CALL FA2BH
    JP F493H
    LD B,H
    CALL PE,4902H
    LD C,(HL)
    LD A,(BC)

; BASIC_IN - Implements the BASIC IN function.
; Entry: Port expression on BASIC stack
; Exit: Port byte on BASIC stack
; Effects: Reads a hardware I/O port.
BASIC_IN:
    CALL EA68H
    CALL FB1AH
    LD C,A
    IN L,(C)
    LD H,00H
    JP FA2BH

LEC7F:
    RET NC
    RLA
    RET NC
    CALL FA1BH
    RST 18H
    ADD A,L
    DAA
    RET

LEC89:
    CALL FC43H
    RST 30H
    SUB E
    RST 10H
    PUSH IY
    POP HL
    DEC HL
    LD A,C
    OR A
    JR Z,EC9DH
    RST 30H
    SUB C
    RST 10H
    LD (HL),C
    DEC HL
    INC A

LEC9D:
    LD (HL),A
    DEC HL
    LD (HL),01H
    PUSH HL
    POP IY
    RET
    LD L,E
    CALL PE,4903H
    LD C,(HL)
    LD D,H
    LD A,(BC)
    CALL EA68H

LECAF:
    LD A,(IY+08H)
    AND 7FH
    SUB 40H
    JR C,ECD8H
    INC A
    PUSH AF
    CALL F707H
    CALL F9DFH
    POP AF
    ADD A,03H
    LD B,A

LECC4:
    LD A,00H
    CALL C,F7E3H
    INC B
    LD A,B
    CP 10H
    JR C,ECC4H
    CALL F707H
    CALL F9DFH
    JP F734H

LECD8:
    LD A,(IY+08H)
    OR A
    JP P,F9F9H
    CALL FA08H
    JP F726H
    AND L
    CALL PE,4902H
    LD C,A
    LD A,(BC)
    CALL EA68H
    CALL FB1AH
    LD L,A
    LD H,00H
    LD DE,1941H
    ADD HL,HL
    ADD HL,DE
    LD E,(HL)
    INC HL
    LD D,(HL)
    EX DE,HL
    JP FA2BH
    PUSH HL
    CALL PE,4C03H
    LD B,L
    LD C,(HL)
    LD A,(BC)
    CALL EA75H

LED0A:
    PUSH IY
    CALL FA21H
    POP HL

LED10:
    INC HL
    LD L,(HL)

LED12:
    LD H,00H
    JP FA2BH
    NOP
    DB EDH,03H
    LD C,H
    LD C,A
    LD B,A
    LD A,(BC)
    CALL EA68H

LED21:
    CALL EAC3H
    LD HL,19C5H
    XOR A
    LD D,A
    OR (HL)
    JP Z,FB14H
    INC HL
    LD E,(HL)
    INC E
    DEC E
    JP M,FB14H
    LD (HL),3FH
    PUSH DE
    PUSH HL
    RST 18H
    LD B,85H
    JR NZ,ED0AH
    SUB E
    OR E1H
    JR Z,ED45H
    JP P,ED49H

LED45:
    POP DE
    DEC DE
    INC (HL)
    PUSH DE

LED49:
    RST 18H
    LD B,05H
    NOP
    INC BC
    DEC B
    NOP
    INC BC
    LD B,05H
    LD BC,0100H
    EX AF,AF'
    INC C
    INC C
    LD (BC),A
    EX AF,AF'
    DEC B
    INC D
    LD (BC),A
    DEC B
    INC DE
    NOP
    LD B,02H
    DEC B
    LD (DE),A
    NOP
    LD B,02H
    LD B,05H
    RLA
    NOP
    LD B,02H
    DEC B
    LD D,00H
    LD B,02H
    DEC B
    DEC D
    NOP
    LD BC,1805H
    NOP
    ADD A,D
    POP HL
    LD DE,003FH
    OR A
    SBC HL,DE
    CALL FA2BH
    RST 18H
    NOP
    DEC B
    LD DE,C982H

LED8B:
    CALL FAA6H
    CALL EAD2H
    CALL F5FBH
    CALL ECAFH
    RST 18H
    LD (BC),A
    INC BC
    ADC A,H
    RES 7,(IY+08H)
    CALL EA9FH
    CALL F693H
    RET M
    JP F9F9H

LEDA9:
    CALL FC43H
    CALL EA75H
    PUSH IY
    CALL FA21H
    POP HL
    INC HL
    LD A,(HL)
    OR A
    JP Z,FB14H
    JP ED10H
    RLA
    DB EDH,04H
    LD D,B
    LD B,L
    LD B,L
    LD C,E
    LD A,(BC)

; BASIC_PEEK - Implements the BASIC PEEK function.
; Entry: Address expression on BASIC stack
; Exit: Byte value on BASIC stack
; Effects: Reads memory, including video-memory address translation.
BASIC_PEEK:
    CALL EA68H
    CALL FD02H
    CALL FFE7H
    JR C,EDD4H
    DI

; Memory paging: U U V S page layout.
    OUT (02H),A

LEDD4:
    LD L,(HL)
    LD A,70H
    OUT (02H),A
    EI
    JP ED12H
    CP (HL)
    DB EDH,02H
    LD D,B
    LD C,C
    LD A,(BC)
    RST 18H
    ADD A,L
    LD (DDC9H),HL
    DB EDH,03H
    LD D,D
    LD C,(HL)
    LD B,H
    LD A,(BC)
    CP 96H
    JR Z,EE02H
    CALL E6D8H
    CALL FA2BH
    RST 18H
    DEC B
    LD H,00H
    DEC B
    LD H,0CH
    NOP
    ADD A,C
    RET

LEE02:
    CALL EA68H
    CALL FAC3H
    BIT 7,H
    JP NZ,FB14H
    LD A,H
    OR L
    JP Z,FB14H
    PUSH HL
    XOR A

LEE14:
    INC A
    ADD HL,HL
    JR NC,EE14H
    DEC A
    POP HL
    DEC HL

LEE1B:
    PUSH HL
    PUSH AF
    CALL E6D8H
    POP AF
    LD B,A

LEE22:
    SRL H
    RR L
    DJNZ EE22H
    EX DE,HL
    POP HL
    OR A
    SBC HL,DE
    ADD HL,DE
    JR C,EE1BH
    EX DE,HL
    JP FA2BH
    RST 20H
    DB EDH,03H
    LD D,E
    LD B,A
    LD C,(HL)
    LD A,(BC)
    CALL EA68H
    LD A,(IY+06H)
    OR A
    RET Z
    LD A,(IY+08H)
    PUSH AF
    CALL FA08H
    POP AF
    AND 80H
    OR (IY+08H)
    LD (IY+08H),A
    RET
    INC (HL)
    XOR 03H
    LD D,E
    LD C,C
    LD C,(HL)
    LD A,(BC)

; BASIC_SIN - Implements the BASIC SIN function.
; Entry: Argument on BASIC stack
; Exit: Sine on BASIC stack
BASIC_SIN:
    CALL EA68H

LEE5E:
    RST 18H
    DEC B
    LD (2205H),HL
    ADD A,B
    CALL ED8BH
    LD A,(IY+08H)
    OR A
    RRA
    PUSH AF
    RST 18H
    ADC A,D

LEE6F:
    RST 18H
    LD B,85H
    INC HL
    POP AF
    PUSH AF
    CALL M,F726H
    CALL F693H
    POP BC
    PUSH BC
    JR Z,EE9AH
    XOR B
    JP M,EE93H
    RST 18H
    LD B,85H
    LD (EEF1H),HL
    LD B,B
    PUSH AF
    CALL P,F726H
    RST 18H
    NOP
    ADC A,D
    JR EE6FH

LEE93:
    POP AF
    XOR 80H
    PUSH AF
    JP M,EE6FH

LEE9A:
    RST 18H
    LD B,0CH
    INC C
    INC C
    LD (BC),A
    EX AF,AF'
    DEC B
    DEC E
    LD (BC),A
    DEC B
    INC E
    NOP
    LD B,02H
    DEC B
    DEC DE
    NOP
    LD B,02H
    DEC B
    LD A,(DE)
    NOP
    LD B,02H
    DEC B
    ADD HL,DE
    NOP
    LD B,02H
    LD (BC),A
    ADD A,B
    POP AF
    ADD A,A
    RET P
    JP F726H
    LD D,H
    XOR 03H
    LD D,E
    LD D,C
    LD D,D
    LD A,(BC)

; BASIC_SQR - Implements the BASIC SQR function.
; Entry: Argument on BASIC stack
; Exit: Square root on BASIC stack
BASIC_SQR:
    CALL EA68H
    BIT 7,(IY+08H)
    JP NZ,FB14H
    LD A,(IY+06H)
    OR A
    RET Z
    CALL EAC3H
    LD HL,19C6H
    LD A,(HL)
    SUB 3FH
    PUSH AF
    LD (HL),3FH
    RST 18H
    LD B,05H
    RRA
    LD (BC),A
    DEC B
    LD E,00H
    ADC A,E
    LD B,04H

LEEED:
    PUSH BC
    RST 18H
    RLCA
    LD B,07H
    LD BC,0307H
    DEC B
    NOP
    LD (BC),A
    NOP
    ADC A,E
    POP BC
    DJNZ EEEDH
    POP AF
    BIT 0,A
    JR Z,EF0BH
    PUSH AF
    RST 18H
    RLCA
    DEC B
    JR NZ,EF0AH
    ADC A,E
    POP AF

LEF0A:
    INC A

LEF0B:
    SRL A
    LD HL,19CDH
    ADD A,(HL)
    AND 7FH
    LD (HL),A
    JP EA9AH

LEF17:
    LD A,(IY+06H)
    OR A
    JR NZ,EF23H
    CALL FA1BH
    JP FA08H

LEF23:
    LD A,(IY+0FH)
    OR A
    JP Z,FA1BH
    LD A,(IY+08H)
    AND 7FH
    CP 43H
    JR NC,EF7DH
    CALL FA92H
    CALL FAC3H
    PUSH HL
    CALL FA92H
    CALL F767H
    POP HL
    PUSH HL
    CALL FA2BH
    CALL F693H
    POP HL
    JR NZ,EF7DH
    BIT 7,H
    PUSH AF
    CALL NZ,FC86H
    PUSH HL
    RST 18H
    LD A,(BC)
    LD A,(BC)
    ADD A,L
    DB 01H                                                                          ; |.|

LEF57:
    POP HL
    PUSH HL
    BIT 0,L
    JR Z,EF63H
    CALL EA9FH
    CALL F512H

LEF63:
    POP HL
    SRL H
    RR L
    LD A,H
    OR L
    JR Z,EF74H
    PUSH HL
    RST 18H
    LD B,06H
    LD (BC),A
    ADC A,D
    JR EF57H

LEF74:
    POP AF
    RET Z
    RST 18H
    DEC BC
    DEC B
    LD BC,8107H
    RET

LEF7D:
    CALL EABEH
    CALL ED21H
    CALL EA9AH
    CALL F512H
    JP EBB8H
    RET NZ
    XOR 04H
    LD D,E
    LD D,H
    LD D,D
    INC H
    EX AF,AF'
    CALL EA68H
    CALL F80EH
    CALL FA1BH
    JP FA7DH
    ADC A,H
    RST 28H
    RLCA
    LD D,E
    LD D,H
    LD D,D
    LD C,C
    LD C,(HL)
    LD B,A
    INC H
    EX AF,AF'
    LD A,96H
    CALL FD54H
    CALL FB1BH
    PUSH AF
    LD A,A4H
    CALL FD54H
    CP 02H
    JR NC,EFD0H
    CALL F294H
    LD A,(IY+01H)
    OR A
    JR Z,EFCDH
    LD A,(IY+02H)
    CALL FA21H
    DB 01H                                                                          ; |.|

LEFCD:
    POP BC
    PUSH AF
    SCF

LEFD0:
    CALL NC,FB1BH
    PUSH AF
    CALL EA70H
    POP DE
    PUSH IY
    POP HL
    DEC HL
    POP AF
    INC A
    JP Z,F912H
    DEC A
    JR Z,EFE9H
    LD B,A

LEFE5:
    LD (HL),D
    DEC HL
    DJNZ EFE5H

LEFE9:
    LD (HL),A
    DEC HL
    LD (HL),01H
    PUSH HL
    POP IY
    RET
    AND B
    RST 28H
    INC BC
    LD D,H
    LD B,C
    LD C,(HL)
    LD A,(BC)
    CALL EA68H
    CALL EACDH
    CALL EE5EH
    RST 18H
    RLCA
    DEC B
    INC HL
    ADD A,B
    CALL EE5EH
    JP F5FBH
    POP AF
    RST 28H
    INC BC
    LD D,L
    LD D,E
    LD D,D
    LD A,(BC)

; USR converts the BASIC argument to integer form, calls user machine code, then converts HL back
; to a BASIC number.

; -----------------------------------------------------------------------------
; BASIC USR FUNCTION
; -----------------------------------------------------------------------------
;
; Evaluates the USR machine-code function and converts its result back to a BASIC number.
;
; USR accepts a machine-code address and a numeric argument from the BASIC expression machinery.
; It validates the argument types, converts the BASIC number to the integer representation
; expected by user code, calls the supplied address, and converts the returned integer in HL back
; into the nine-byte BASIC floating-point format.
;
; Entry:
;   Machine-code address and numeric argument prepared by the expression evaluator.
;
; Exit:
;   A numeric result is pushed on the BASIC stack.
;
; Effects:
;   Calls arbitrary user machine code; user code may alter machine state and memory.
;
; Destroys:
;   AF, BC, DE, HL, IY and user-defined registers according to the called code.
; -----------------------------------------------------------------------------
BASIC_USR:
    LD A,96H
    CALL FD54H
    CALL F0A7H
    CP 95H
    JR Z,F029H
    LD A,A4H
    CALL FD54H
    CALL FAC4H
    LD A,95H

LF029:
    CALL FD54H
    LD DE,FA2BH
    PUSH DE
    PUSH HL
    CALL FD02H
    EX (SP),HL
    RET
    INC C
    RET P
    INC BC
    LD D,(HL)
    LD B,C
    LD C,H
    LD A,(BC)
    CALL EA75H
    PUSH IY
    POP HL
    INC HL
    PUSH HL
    LD C,(HL)
    LD B,00H
    ADD HL,BC
    INC HL
    LD A,(HL)
    LD (HL),B
    EX (SP),HL
    PUSH AF
    INC HL
    CALL F914H
    CALL EC7FH
    POP AF
    POP HL
    LD (HL),A
    DEC HL
    EX DE,HL
    PUSH IY
    POP HL
    LD BC,0009H
    ADD HL,BC
    DEC HL
    LDDR
    INC DE
    PUSH DE
    POP IY
    RET
    LD (HL),F0H
    LD B,56H
    LD B,C
    LD D,D
    LD D,B
    LD D,H
    LD D,D
    LD A,(BC)
    LD A,96H
    CALL FD54H
    AND FDH
    CP 01H

LF07C:
    JP NZ,FB14H
    EXX
    LD A,C
    AND 7FH
    LD (1708H),A
    AND 0CH
    JR NZ,F07CH
    EXX
    CALL F42EH
    CALL FA2BH
    JP EA70H
    LD L,C
    RET P
    LD B,56H
    LD B,L
    LD D,D
    LD C,(HL)
    LD D,L
    LD C,L
    LD A,(BC)
    LD HL,000CH
    JP FA2BH

LF0A4:
    CALL FC43H

; Numeric expression precedence is implemented as nested layers: relations, +/-, */,
; exponentiation, functions, parentheses, and variables.

; -----------------------------------------------------------------------------
; NUMERIC EXPRESSION EVALUATOR
; -----------------------------------------------------------------------------
;
; Evaluates the token stream for a numeric expression using BASIC operator precedence.
;
; The evaluator is layered from OR/XOR through AND, NOT, relations, addition/subtraction,
; multiplication/division, exponentiation, functions, parentheses, and variables. Each layer
; consumes the next token only when its operator is present, recursively evaluates higher-priority
; terms, then applies the operation to values on the BASIC stack.
;
; The routine is entered at different points depending on whether the first token has already been
; fetched. It leaves the expression result on the BASIC stack and carries the source pointer in
; the interpreter workspace.
;
; Entry:
;   HL' points into tokenized BASIC source; interpreter flags select fetched/not-fetched entry.
;
; Exit:
;   One numeric value remains on the BASIC stack; source pointer advances past the expression.
;
; Effects:
;   Consumes tokens and grows/shrinks the BASIC stack.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers, IY as stack pointer.
; -----------------------------------------------------------------------------
EVAL_NUMERIC_EXPRESSION:
    EXX
    LD A,B
    EXX
    CALL F0D7H

; The OR/XOR stage is a left-fold over already evaluated AND terms: fetch the operator, evaluate
; one right term, combine the integer pairs, and repeat. It is not a precedence-free scan of the
; whole source.

; -----------------------------------------------------------------------------
; OR/XOR EXPRESSION LOOP
; -----------------------------------------------------------------------------
;
; Consumes repeated OR and XOR operators after the higher-priority expression layer has produced a
; value.
;
; The loop fetches the next token, evaluates the right operand through the AND layer, combines the
; two integer-like values, and repeats while another OR/XOR token is present.
; -----------------------------------------------------------------------------
EXPR_OR_XOR_LOOP:
    EXX
    LD A,B
    EXX
    CP BFH
    JR Z,F0B8H
    CP B2H
    RET NZ
    SCF

LF0B8:
    PUSH AF
    CALL FC43H
    CALL F0D7H
    CALL FABFH
    POP AF
    JR C,F0CCH
    LD A,L
    OR E
    LD L,A
    LD A,H
    OR D
    JR F0D1H

LF0CC:
    LD A,L
    XOR E
    LD L,A
    LD A,H
    OR D

LF0D1:
    LD H,A
    CALL FA2BH
    JR F0ADH

; AND is evaluated below OR/XOR but above NOT. The loop leaves the source pointer at the first
; token that belongs to the relation or statement layer, allowing the enclosing parser to continue
; without refetching it.

; -----------------------------------------------------------------------------
; AND EXPRESSION LAYER
; -----------------------------------------------------------------------------
;
; Bridges the OR/XOR layer to repeated bitwise AND operations.
;
; This entry evaluates the next lower-priority term, then lets the adjacent loop recognize AND
; tokens and combine the two stack integers without disturbing the source continuation state.
; -----------------------------------------------------------------------------
EXPR_AND_LAYER:
    CALL F0F4H

LF0DA:
    EXX
    LD A,B
    EXX
    CP C9H
    RET NZ
    CALL FC43H
    CALL F0F4H
    CALL FABFH
    LD A,L
    AND E
    LD L,A
    LD A,H
    AND D
    LD H,A
    CALL FA2BH
    JR F0DAH

; NOT works on the integer conversion of the numeric stack value. The complemented pair is
; converted back to the BASIC numeric form; this is why NOT is a numeric/bitwise operator rather
; than a Boolean-only branch.

; -----------------------------------------------------------------------------
; NOT EXPRESSION STAGE
; -----------------------------------------------------------------------------
;
; Evaluates a NOT operand and complements its integer representation.
;
; The operand is converted from the BASIC stack to an integer pair, complemented, and placed back
; as a normalized numeric result. A non-integer or malformed operand follows the normal
; argument/type error path.
; -----------------------------------------------------------------------------
EXPR_NOT_LAYER:
    CP C2H
    JR NZ,F10AH
    CALL FC43H
    CALL F0F4H
    CALL FAC3H
    LD A,L
    CPL
    LD L,A
    LD A,H
    CPL
    LD H,A
    JP FA2BH

; Relation parsing deliberately has separate numeric and string branches. Both branches return
; flags that the common relation decoder can turn into a BASIC numeric truth value.

; -----------------------------------------------------------------------------
; RELATIONAL EXPRESSION STAGE
; -----------------------------------------------------------------------------
;
; Recognizes numeric and string relation operators and maps their comparison result to BASIC truth
; values.
;
; The stage first evaluates the additive operand, then dispatches to numeric or string comparison
; according to the values on the stack. It handles the six ordered/equality relations through one
; flag-to-result decoder.
; -----------------------------------------------------------------------------
EXPR_RELATION_LAYER:
    CP 02H
    JR C,F123H
    CALL F155H
    CP 99H
    RET C
    CP 9FH
    RET NC
    PUSH AF
    CALL FC43H
    CALL F155H
    CALL F693H
    JR F13AH

; For a string relation, the right expression is evaluated as a descriptor before comparison. The
; string data remains length-tracked, so embedded zero bytes do not terminate the comparison.

; -----------------------------------------------------------------------------
; STRING RELATION PATH
; -----------------------------------------------------------------------------
;
; Evaluates and compares a string right operand when the relation operator is applied to strings.
;
; The string expression is evaluated before the comparison helper consumes the two descriptors.
; The result is converted to the same numeric truth convention used by numeric relations.
; -----------------------------------------------------------------------------
EXPR_STRING_RELATION:
    CALL F294H
    CP 99H
    JP C,F35DH
    CP 9FH
    JP NC,F35DH
    PUSH AF
    CALL FC43H
    CALL F294H
    CALL F6D7H

LF13A:
    POP HL
    LD A,H
    CALL F142H
    JP FA2BH

; The rotate/branch decoder maps the relation token and CY/S/Z flags to the true/false numeric
; result, then reclaims both operands through the BASIC-stack integer path.

; -----------------------------------------------------------------------------
; RELATION FLAG DECODER
; -----------------------------------------------------------------------------
;
; Turns comparison flags and the relation token into a Boolean numeric result.
;
; The compact rotate/branch sequence classifies equality, less-than, greater-than, and their
; negated forms. It then pushes one numeric result while discarding the compared operands.
; -----------------------------------------------------------------------------
RELATION_RESULT_DECODE:
    LD HL,FFFFH
    RRCA
    JR NC,F149H
    RET M

LF149:
    RRCA
    JR NC,F14DH
    RET Z

LF14D:
    RRCA
    JR NC,F153H
    JR Z,F153H
    RET P

LF153:
    INC HL
    RET

; -----------------------------------------------------------------------------
; ADDITION/SUBTRACTION EXPRESSION LAYER
; -----------------------------------------------------------------------------
;
; Recognizes + and - tokens and combines the two evaluated numeric operands.
;
; The layer first evaluates the higher-priority multiplicative term. A minus operation is
; represented by negating the second operand before calling the shared floating-point addition
; routine, so addition and subtraction share the same stack operation.
;
; Entry:
;   Token stream and first operand on the BASIC stack.
;
; Exit:
;   The combined numeric result replaces the two operands.
;
; Effects:
;   Advances the source pointer and consumes one stack operand.
;
; Destroys:
;   AF, BC, DE, HL, IY.
; -----------------------------------------------------------------------------
EVAL_ADD_SUB:
    CALL F16CH
    CALL NZ,F181H
    INC E
    CALL NZ,F726H

LF15F:
    CALL F16CH
    RET NZ
    INC E
    CALL Z,F493H
    CALL NZ,F48EH
    JR F15FH

; The additive loop remembers whether the operator was plus or minus while evaluating the next
; multiplicative term. Minus is implemented by negating that term and entering the same FP_ADD
; machinery.

; -----------------------------------------------------------------------------
; ADD/SUBTRACT OPERATOR SCAN
; -----------------------------------------------------------------------------
;
; Fetches and classifies the next additive operator before the right term is evaluated.
;
; The helper distinguishes plus from minus, records the operation in E, and leaves the source
; pointer positioned for the multiplicative layer. Subtraction later reuses addition after sign
; inversion.
; -----------------------------------------------------------------------------
EXPR_ADD_SUB_OPERATOR:
    EXX
    LD A,B
    EXX
    LD E,FFH
    CP 98H
    JR Z,F179H
    CP A2H
    RET NZ
    INC E

LF179:
    CALL FC43H
    CALL F181H
    XOR A
    RET

; -----------------------------------------------------------------------------
; MULTIPLICATION/DIVISION EXPRESSION LAYER
; -----------------------------------------------------------------------------
;
; Recognizes * and / tokens and invokes the corresponding floating-point operation.
;
; After higher-priority factors have been evaluated, this layer checks for multiplication or
; division and retains the operation token while the right operand is evaluated. The selected
; routine then normalizes the result and reports divide-by-zero or range errors through the normal
; BASIC error path.
;
; Entry:
;   Token stream and left operand on BASIC stack.
;
; Exit:
;   Product or quotient replaces the two operands.
;
; Effects:
;   Consumes one BASIC-stack value and advances the source pointer.
;
; Destroys:
;   AF, BC, DE, HL, IY.
; -----------------------------------------------------------------------------
EVAL_MUL_DIV:
    CALL F1A2H

LF184:
    EXX
    LD A,B
    EXX
    CP A8H
    JR Z,F18EH
    CP A1H
    RET NZ

LF18E:
    LD D,A
    CALL FC43H
    CALL F1A2H
    PUSH DE
    LD A,D
    CP A8H
    CALL Z,F512H
    CALL NZ,F5FBH
    POP DE
    JR F184H

; Exponentiation is nested inside the multiplicative layer. Its right operand is a primary term,
; giving the parser a distinct power stage instead of treating ^ like * or /.

; -----------------------------------------------------------------------------
; POWER EXPRESSION STAGE
; -----------------------------------------------------------------------------
;
; Evaluates exponentiation with a higher-priority primary term on the right.
;
; The stage preserves the left value while it evaluates a primary exponent, calls the power
; implementation, and loops for any following power token. Its placement gives exponentiation
; priority over multiplication and division.
; -----------------------------------------------------------------------------
EXPR_POWER_LAYER:
    PUSH DE
    CALL F1BBH

LF1A6:
    POP DE
    EXX
    LD A,B
    EXX
    CP 9FH
    RET NZ
    PUSH DE
    CALL FC43H
    CALL F1BBH
    CALL EF17H
    JR F1A6H

LF1B9:
    RST 08H
    INC BC

; -----------------------------------------------------------------------------
; PRIMARY EXPRESSION TERMS
; -----------------------------------------------------------------------------
;
; Dispatches numeric functions, parentheses, constants, variables, and user-defined functions.
;
; This is the highest-level numeric-term parser. It recognizes built-in function tokens such as
; ORD and ATN, evaluates parenthesized expressions, resolves variables and symbols, and invokes
; the DEF-function machinery when a user-defined function token is encountered. Invalid token
; forms branch to NOT UNDERSTOOD, ARGUMENT MISSING, or TYPE MISMATCH errors.
;
; Entry:
;   Next token in the BASIC source.
;
; Exit:
;   A primary numeric value is placed on the BASIC stack.
;
; Effects:
;   May call function evaluators and symbol-table lookup routines.
;
; Destroys:
;   AF, BC, DE, HL, IY, interpreter temporaries.
; -----------------------------------------------------------------------------
EVAL_PRIMARY:
    PUSH AF
    CALL FC8EH
    POP AF
    CP C0H
    JP Z,EDA9H
    CP B1H
    JP Z,EAF1H
    CP 02H
    JP C,F35DH
    JP Z,FC43H
    CP FDH
    JR NC,F1B9H
    CP 96H
    JR NZ,F1E2H
    CALL F0A4H
    CP 95H
    JP Z,FC43H

; A primary token is either converted as a literal, resolved through the symbol chain, or
; dispatched to a built-in/user function. Terminators are rejected here so a missing expression
; becomes an argument error at the correct boundary.

; -----------------------------------------------------------------------------
; PRIMARY SYMBOL DISPATCH
; -----------------------------------------------------------------------------
;
; Separates literals, built-in terms, and symbol references at the primary-expression boundary.
;
; After token classification, this path enters numeric conversion for literals or symbol lookup
; for names. It also rejects statement terminators and invalid token classes before they can
; corrupt the BASIC stack.
; -----------------------------------------------------------------------------
PRIMARY_SYMBOL_DISPATCH:
    CP 03H
    JP NZ,FD5AH
    CALL F42EH
    BIT 3,C
    JP NZ,DBADH
    BIT 2,C
    JP Z,FA63H

; Array and DEF references temporarily reuse global BASIC pointers. The saved current-line, CHAIN,
; TOP, and type values are the protection against nested function evaluation corrupting the
; enclosing expression.

; -----------------------------------------------------------------------------
; ARRAY/DEF SYMBOL PATH
; -----------------------------------------------------------------------------
;
; Builds the execution frame for an array element or user-defined function reference.
;
; The routine saves the current line, symbol-chain pointers, and expected type while it evaluates
; subscripts or DEF arguments. The saved context permits nested expressions to use the same global
; workspace and still return to the caller.
; -----------------------------------------------------------------------------
ARRAY_OR_DEF_SYMBOL:
    LD D,(IX+01H)
    PUSH DE
    PUSH HL
    SUB 96H
    SUB 01H
    SBC A,A
    PUSH AF
    LD A,C
    JR Z,F216H
    EX AF,AF'
    CALL FC43H
    OR A
    JP M,FD5AH
    LD (IX+01H),A
    CALL F28DH
    LD A,95H
    CALL FD54H
    EX AF,AF'

; A DEF call records the caller's BASIC execution context before it evaluates formal arguments and
; the function body. The return path must restore the symbol-chain boundary as well as the source
; pointer.

; -----------------------------------------------------------------------------
; DEF ARGUMENT FRAME SETUP
; -----------------------------------------------------------------------------
;
; Stores the current BASIC execution context while a user-defined function body is evaluated.
;
; The frame records the caller line and statement pointers, symbol-chain boundary, and TOP value,
; then evaluates the formal/actual arguments. A type-bit check prevents a string function from
; entering the numeric return path.
; -----------------------------------------------------------------------------
DEF_ARGUMENT_FRAME:
    EX AF,AF'
    POP AF
    LD HL,(1726H)
    EX (SP),HL
    PUSH HL
    LD HL,(1724H)
    EX (SP),HL
    EXX
    PUSH HL
    LD HL,(170CH)
    PUSH HL
    PUSH BC
    EXX
    LD E,(HL)
    INC HL
    LD D,(HL)
    INC HL
    LD (170CH),DE
    LD E,(HL)
    INC HL
    LD D,(HL)
    EX DE,HL
    EXX
    LD C,A
    CALL FC43H
    SUB 96H
    SUB 01H
    SBC A,A
    XOR C
    JP NZ,FD5AH
    XOR C
    JR Z,F26DH
    CALL FC43H
    AND 81H
    CP 01H
    JP NZ,FD5AH
    EXX
    BIT 7,C
    CALL Z,F40BH
    LD A,C
    XOR (IX+01H)
    AND 02H
    JP NZ,F35DH
    PUSH DE
    EXX
    POP HL
    CALL FB3BH
    CALL FC43H
    LD A,95H
    CALL FD54H

; Restoring the saved context is part of the function ABI: leaving the temporary DEF symbol or
; changed TOP visible would make later variable lookup depend on call history.

; -----------------------------------------------------------------------------
; RESTORE DEF CONTEXT
; -----------------------------------------------------------------------------
;
; Restores the caller's line, symbol, and type state after a DEF function returns.
;
; The saved pointers are popped in the reverse order used by the function frame. Restoring TOP and
; CHAIN is essential because temporary function symbols must not remain visible to the enclosing
; expression.
; -----------------------------------------------------------------------------
RESTORE_DEF_CONTEXT:
    LD A,9AH
    CALL FD54H
    EX AF,AF'
    LD (IX+01H),A
    CALL F28DH
    POP BC
    POP HL
    LD (170CH),HL
    POP HL
    EXX
    POP HL
    LD (1724H),HL
    POP HL
    LD (1726H),HL
    POP AF
    LD (1701H),A
    RET

; -----------------------------------------------------------------------------
; NUMERIC/STRING EVALUATOR GATE
; -----------------------------------------------------------------------------
;
; Selects the evaluator path from the expected operand type stored in the interpreter state.
;
; The gate branches to numeric expression evaluation for numeric contexts and to the string
; evaluator for string contexts. This shared boundary is why assignment and function routines can
; request a typed expression without duplicating token walking.
; -----------------------------------------------------------------------------
NUMERIC_STRING_GATE:
    BIT 1,(IX+01H)
    JP NZ,F0A7H

; -----------------------------------------------------------------------------
; STRING EXPRESSION EVALUATOR
; -----------------------------------------------------------------------------
;
; Evaluates concatenation and string terms onto the BASIC stack.
;
; The string evaluator mirrors the numeric precedence structure but operates on string descriptors
; and data. It resolves string variables, literals, and concatenation, moving descriptors and
; payloads while preserving the stack's length-prefixed representation.
;
; Entry:
;   HL' points into tokenized BASIC source.
;
; Exit:
;   A string value is placed on the BASIC stack.
;
; Effects:
;   Allocates stack space and may copy string bytes.
;
; Destroys:
;   AF, BC, DE, HL, IY.
; -----------------------------------------------------------------------------
EVAL_STRING_EXPRESSION:
    EXX
    LD A,B
    EXX
    CALL F2E0H

; String concatenation is an in-place stack compaction operation. Length is checked before bytes
; are moved; the new descriptor is committed only after the combined payload fits.

; -----------------------------------------------------------------------------
; STRING CONCATENATION LOOP
; -----------------------------------------------------------------------------
;
; Combines successive string terms while retaining a single length-tracked stack value.
;
; The loop locates both string payloads, adds their lengths, moves bytes to close the old stack
; gap, and writes a new descriptor. Overflow is detected before the result is committed, so a
; failed concatenation does not leave a partially valid string.
; -----------------------------------------------------------------------------
STRING_CONCAT_LOOP:
    EXX
    LD A,B
    EXX
    CP 97H
    RET NZ
    CALL FC43H
    CALL F2E0H
    PUSH IY
    POP HL
    INC HL
    LD E,L
    LD D,H
    LD C,(HL)
    LD B,00H
    ADD HL,BC
    INC HL
    PUSH HL
    POP IY
    INC HL
    LD C,(HL)
    CALL FC8EH
    PUSH HL
    ADD HL,BC
    LD A,C
    OR A
    LD A,(DE)
    JR Z,F2C2H
    LDDR

LF2C2:
    POP HL
    ADD A,(HL)
    LD (DE),A
    JP C,F912H
    CP FFH
    JP Z,F912H
    LD C,(HL)
    LD E,L
    LD D,H
    DEC DE
    DEC DE
    ADD HL,BC
    EX DE,HL
    LD C,A
    INC BC
    LDDR
    EX DE,HL
    LD (HL),01H
    PUSH HL
    POP IY
    JR F29AH

; The string term layer keeps descriptor length separate from source-token length. This
; distinction is essential when a string contains encoded characters or an embedded byte that
; resembles a BASIC token.

; -----------------------------------------------------------------------------
; STRING TERM LAYER
; -----------------------------------------------------------------------------
;
; Evaluates a string term and prepares it for concatenation or comparison.
;
; This stage handles the string primary path and returns with IY at a length-prefixed value. The
; caller can then test the concatenation token without confusing string length bytes with source
; tokens.
; -----------------------------------------------------------------------------
STRING_TERM_LAYER:
    CALL F32DH

LF2E3:
    EXX
    LD A,B
    EXX
    CP 96H
    RET NZ
    CALL FD27H
    PUSH IY
    POP HL
    INC HL
    LD A,(HL)
    LD C,A
    LD B,00H
    CP D
    JR C,F2F8H
    LD A,D

; -----------------------------------------------------------------------------
; STRING LENGTH CONTROL
; -----------------------------------------------------------------------------
;
; Copies only the permitted portion of a string operand when a destination length limits it.
;
; The routine compares source and requested lengths, selects the smaller count, and moves the
; selected bytes into the new stack location. It preserves the descriptor convention used by
; subsequent string functions.
; -----------------------------------------------------------------------------
STRING_COPY_TRUNCATE:
    LD D,A
    OR A
    JR Z,F309H
    LD A,C
    CP E
    JR C,F309H
    INC E
    DEC E
    JR NZ,F305H
    INC E

; When a string result is shortened, the copy path selects the permitted count first and then
; moves bytes backward into the new stack slot. The source descriptor is not modified until the
; new value is complete.

LF305:
    LD A,D
    SUB E
    JR NC,F30DH

LF309:
    ADD HL,BC
    XOR A
    JR F318H

LF30D:
    INC A
    PUSH HL
    ADD HL,BC
    EX DE,HL
    LD C,H
    POP HL
    ADD HL,BC
    LD C,A
    LDDR
    EX DE,HL

LF318:
    LD (HL),A
    DEC HL
    LD (HL),01H
    PUSH HL
    POP IY
    JR F2E3H
    CALL FAC4H
    LD D,00H
    INC H
    RET Z
    DEC D
    DEC H
    RET NZ
    LD D,L
    RET

; String primary dispatch rejects numeric symbol types before allocation. The same check is used
; by string functions and assignment, producing Type mismatch instead of interpreting numeric
; bytes as characters.

; -----------------------------------------------------------------------------
; STRING PRIMARY DISPATCH
; -----------------------------------------------------------------------------
;
; Dispatches string literals, string functions, and string symbol references.
;
; The dispatch validates the token class, recognizes the string function prefix, then asks symbol
; lookup for the name/type descriptor. Numeric symbols and malformed delimiters are rejected
; before string storage is allocated.
; -----------------------------------------------------------------------------
STRING_PRIMARY_DISPATCH:
    CALL FC8EH
    EXX
    PUSH BC
    EXX
    POP BC
    LD A,B
    CP 01H
    JP C,FC43H
    JR Z,F347H
    CP 04H
    JR C,F35DH
    CP FDH
    JP C,FD5AH
    RST 08H
    INC BC

; -----------------------------------------------------------------------------
; STRING SYMBOL DISPATCH
; -----------------------------------------------------------------------------
;
; Resolves a string symbol and selects scalar, array, or function data handling.
;
; Type bits decide whether the descriptor is copied directly, indexed through array metadata, or
; passed to a function path. The helper is shared by string assignment and expression evaluation.
; -----------------------------------------------------------------------------
STRING_SYMBOL_DISPATCH:
    LD A,C
    CP C5H
    JP Z,EC89H
    CALL F42EH
    BIT 3,C
    JP NZ,DBADH
    BIT 2,C
    JP NZ,F1F4H
    JP FA7CH

LF35D:
    RST 08H
    DB 0EH                                                                          ; |.|

; -----------------------------------------------------------------------------
; CREATE SYMBOL TABLE ENTRY
; -----------------------------------------------------------------------------
;
; Creates or extends a linked BASIC symbol entry and records its type and value address.
;
; The symbol routines maintain the linked table used for numeric and string variables. Names are
; copied into the symbol area, a type byte records the value kind, and the data pointer identifies
; the storage or function body. Memory exhaustion and duplicate declarations are reported through
; BASIC errors.
;
; Entry:
;   Parsed symbol name and type in interpreter work variables.
;
; Exit:
;   HL/DE identify the new symbol entry and its data area.
;
; Effects:
;   Allocates and writes symbol-table memory.
;
; Destroys:
;   AF, BC, DE, HL, IY.
; -----------------------------------------------------------------------------
SYMBOL_CREATE:
    CALL FC8EH
    LD DE,(1724H)
    LD HL,(1726H)
    LD (1724H),HL
    LD (HL),E
    INC HL
    LD (HL),D
    INC HL
    LD C,00H
    PUSH HL
    LD DE,(1728H)

; Name creation copies only the BASIC identifier alphabet and counts the name separately from its
; type suffix. TOP is updated after the length byte is written, so an interrupted creation cannot
; expose a half-name through CHAIN.

; -----------------------------------------------------------------------------
; SYMBOL NAME COPY LOOP
; -----------------------------------------------------------------------------
;
; Copies an input symbol name into the linked symbol-table entry while counting valid characters.
;
; Characters are accepted from the BASIC name alphabet, with dollar and period handled as
; type/name delimiters. The count is written before finalization so lookup can distinguish a
; complete name from a prefix.
; -----------------------------------------------------------------------------
SYMBOL_NAME_COPY:
    LD A,(DE)
    CP FDH
    JR NC,F3A3H
    CP 20H
    JR C,F39CH
    CP 24H
    JR Z,F39DH
    CP 2EH
    JR Z,F39CH
    CP 30H
    JR C,F3A3H
    CP 3AH
    JR C,F39CH
    CP 3FH
    JR C,F3A3H
    CP 60H
    JR C,F39CH
    CP A9H
    JR C,F3A3H

LF39C:
    SCF

LF39D:
    INC DE
    INC C
    INC HL
    LD (HL),A
    JR C,F377H

LF3A3:
    LD A,(HL)
    INC HL
    LD (1726H),HL
    EX (SP),HL
    LD (HL),C
    POP HL
    RET

; -----------------------------------------------------------------------------
; INITIALIZE SYMBOL DATA
; -----------------------------------------------------------------------------
;
; Initializes the fixed numeric data area for a newly created scalar or numeric array entry.
;
; The helper clears the initial bytes and advances TOP according to the selected symbol kind.
; Clearing is deliberate: an undefined scalar reads as numeric zero rather than stale RAM.
; -----------------------------------------------------------------------------
INIT_NUMERIC_SYMBOL:
    CALL FC8EH
    LD HL,(1726H)
    LD B,06H
    XOR A

LF3B5:
    LD (HL),A
    INC HL
    DJNZ F3B5H
    JR F3CEH

; -----------------------------------------------------------------------------
; INITIALIZE STRING/ARRAY DATA
; -----------------------------------------------------------------------------
;
; Reserves and initializes variable-sized string or array symbol storage.
;
; The path records the element length/dimension information, advances TOP over the requested data,
; and leaves the symbol descriptor pointing at the allocated region. Memory exhaustion is reported
; before the table link is made live.
; -----------------------------------------------------------------------------
INIT_STRING_OR_ARRAY_SYMBOL:
    BIT 1,(IX+01H)
    JR NZ,F3ACH

LF3C1:
    CALL FC8EH
    LD HL,(1726H)
    LD (HL),C
    INC HL
    LD B,00H
    LD (HL),B
    ADD HL,BC
    INC HL

LF3CE:
    LD (1726H),HL
    RET

; -----------------------------------------------------------------------------
; LOOK UP BASIC SYMBOL
; -----------------------------------------------------------------------------
;
; Searches the linked symbol table for a name and returns its descriptor.
;
; The lookup compares the source name against each linked entry, handling quoted and tokenized
; characters and stopping at name boundaries. A matching entry returns its type and data address;
; a missing symbol follows the variable-creation or undefined-name error path selected by the
; caller.
;
; Entry:
;   Name pointer and symbol-table chain.
;
; Exit:
;   HL = symbol entry/data address; C = type byte or status.
;
; Effects:
;   Reads symbol-table memory.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
SYMBOL_LOOKUP:
    LD (1728H),HL
    LD HL,1725H
    DB 3EH                                                                          ; |>|

; Symbol lookup follows little-endian links from CHAIN toward older entries. A zero link is the
; defined end condition; it is not an instruction address or a valid empty symbol.

; -----------------------------------------------------------------------------
; ADVANCE SYMBOL CHAIN
; -----------------------------------------------------------------------------
;
; Loads the next linked symbol entry while scanning for a name match.
;
; The link is read little-endian from the preceding entry. A zero link ends the search; otherwise
; the candidate name length and bytes become the comparison window.
; -----------------------------------------------------------------------------
SYMBOL_CHAIN_NEXT:
    POP HL
    LD D,(HL)
    DEC HL
    LD E,(HL)
    LD A,E
    OR D
    LD HL,(1728H)
    RET Z
    EX DE,HL
    INC HL
    PUSH HL
    INC HL
    LD B,(HL)

; The name comparison checks the delimiter after a matching prefix. This prevents a short variable
; name from aliasing a longer one and handles $/token terminators as part of the BASIC name
; grammar.

; -----------------------------------------------------------------------------
; COMPARE SYMBOL NAME
; -----------------------------------------------------------------------------
;
; Compares input name bytes with a candidate entry and enforces the name boundary.
;
; A full byte match is not enough: the following source byte must terminate the name or carry its
; type delimiter. This avoids treating A as a match for ARRAY and handles tokenized keyword bytes
; safely.
; -----------------------------------------------------------------------------
SYMBOL_NAME_COMPARE:
    LD A,(DE)
    INC DE
    INC HL
    CP (HL)
    JR NZ,F3D9H
    DJNZ F3E8H
    CP 24H
    JR Z,F404H
    LD A,(DE)
    CP 20H
    JR Z,F404H
    CP FDH
    JR NC,F404H
    CP A9H
    JR NC,F3D9H
    RLA
    JR NC,F3D9H

; A matched entry has its construction marker cleared before the type byte is returned. Callers
; therefore see a stable scalar/array/string/function classification, not the temporary marker
; used while allocating the entry.

; -----------------------------------------------------------------------------
; RETURN SYMBOL MATCH
; -----------------------------------------------------------------------------
;
; Returns the matched type byte and data address to the expression or statement caller.
;
; The high-bit marker used during table construction is cleared before the type is exposed. The
; returned pointer is advanced past the descriptor header so callers can read scalar data or array
; metadata directly.
; -----------------------------------------------------------------------------
SYMBOL_MATCH_RETURN:
    POP AF
    INC HL
    RES 7,(HL)
    SCF
    JR F428H

; Symbol creation writes the descriptor and initializes its data area before publishing the link.
; This ordering is what lets an out-of-memory or duplicate-declaration error leave the live chain
; consistent.

; -----------------------------------------------------------------------------
; CREATE SYMBOL VALUE AREA
; -----------------------------------------------------------------------------
;
; Completes a newly created symbol by choosing its type and allocating its initial value area.
;
; The helper distinguishes string, numeric, and function descriptors, writes the final type byte,
; and invokes the appropriate initializer. The symbol is linked only after the name and descriptor
; are coherent.
; -----------------------------------------------------------------------------
SYMBOL_CREATE_VALUE:
    CALL F35FH
    SUB 24H
    JR Z,F414H
    LD A,02H

LF414:
    LD (HL),A
    PUSH HL
    INC HL
    LD (1726H),HL
    JR NZ,F422H
    LD C,12H
    CALL F3C1H
    XOR A

LF422:
    CALL NZ,F3ACH
    POP HL
    SET 7,(HL)

LF428:
    LD C,(HL)
    INC HL
    EX DE,HL
    RET

LF42C:
    RST 08H
    DEC B

; BASIC numeric stack elements are nine bytes: identifier, overflow byte, exponent/sign byte, and
; seven packed BCD mantissa bytes.

; -----------------------------------------------------------------------------
; LOAD NUMBERS FROM BASIC STACK
; -----------------------------------------------------------------------------
;
; Converts the top stack numbers into the CPU register pairs used by arithmetic routines.
;
; The helper reads the second and first nine-byte numeric elements, invalidates their old stack
; positions as appropriate, and returns the operands in DE and HL. It is the common bridge between
; the compact BASIC-stack format and arithmetic code.
;
; Entry:
;   IY points at the BASIC-stack boundary; two numeric elements are present.
;
; Exit:
;   DE and HL contain the two numeric operands.
;
; Effects:
;   Advances or temporarily relocates the BASIC stack pointer.
;
; Destroys:
;   AF, BC, IY; DE and HL contain converted values.
; -----------------------------------------------------------------------------
STACK_TO_NUMERIC_REGS:
    EXX

; Stack operand walking is type-aware. Arithmetic callers cannot simply subtract nine from IY when
; a string or control frame is interposed; the helper follows the stored element layout.

; -----------------------------------------------------------------------------
; STACK OPERAND WALKER
; -----------------------------------------------------------------------------
;
; Walks typed BASIC-stack elements to locate operands for arithmetic and conversion helpers.
;
; The walker follows the element type and length rather than assuming every value is nine bytes.
; It is the bridge used when a numeric expression is embedded beside strings or control frames.
; -----------------------------------------------------------------------------
STACK_OPERAND_WALK:
    PUSH DE
    BIT 0,C
    LD A,C
    EXX
    POP HL
    LD C,A
    JP Z,FC43H
    LD A,96H
    CALL FD51H
    XOR A
    LD E,A
    LD D,A
    LD A,(HL)
    INC HL
    EX DE,HL
    PUSH BC

; The operand scan relocates selected values into the register/workspace arrangement expected by
; arithmetic code, then returns IY aligned at the next live stack element. This is the hidden
; contract behind many RST18 operations.

; -----------------------------------------------------------------------------
; SCAN STACK ELEMENTS
; -----------------------------------------------------------------------------
;
; Scans and relocates the requested number of stack elements before a conversion or arithmetic
; call.
;
; The loop skips elements by their type-dependent size, copies the selected value into the
; expected workspace, and leaves IY aligned on the next live element. This prevents temporary
; strings from being interpreted as floating-point operands.
; -----------------------------------------------------------------------------
STACK_ELEMENT_SCAN:
    PUSH HL
    PUSH AF
    LD A,A4H
    CALL NZ,FD54H
    CALL FAC4H
    EX DE,HL
    LD C,(HL)
    INC HL
    LD B,(HL)
    INC HL
    EX DE,HL
    OR A
    SBC HL,BC
    JR NC,F42CH
    ADD HL,BC
    POP AF
    PUSH AF
    PUSH DE

LF45E:
    DEC A
    JR Z,F46FH
    EX DE,HL
    LD C,(HL)
    INC HL
    LD B,(HL)
    INC HL
    PUSH HL
    PUSH AF
    CALL FCB3H
    POP AF
    POP DE
    JR F45EH

LF46F:
    POP DE
    POP AF
    POP BC
    ADD HL,BC
    DEC A
    JR NZ,F445H
    LD A,95H
    CALL FD54H
    EX DE,HL
    POP BC
    BIT 1,C
    LD BC,0006H
    JR NZ,F487H
    LD C,(HL)
    INC BC
    INC BC

LF487:
    PUSH HL
    CALL FCB3H
    POP DE
    ADD HL,DE
    RET

; -----------------------------------------------------------------------------
; FLOATING-POINT SUBTRACTION
; -----------------------------------------------------------------------------
;
; Subtracts the second nine-byte BASIC number from the first.
;
; Subtraction is implemented by negating the second operand and entering the shared addition
; algorithm at F493H. The operands remain in the packed BCD representation while exponents and
; signs are aligned, mantissas are added, and the result is normalized.
;
; Entry:
;   Two nine-byte BASIC numeric elements at the top of the stack.
;
; Exit:
;   The first operand contains x-y; one stack element is consumed and IY advances by nine.
;
; Effects:
;   Rewrites the first numeric element and may signal overflow.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers.
; -----------------------------------------------------------------------------
FP_SUB:
    PUSH AF
    CALL F726H
    POP AF

; -----------------------------------------------------------------------------
; FLOATING-POINT ADDITION
; -----------------------------------------------------------------------------
;
; Adds two packed-BCD BASIC numbers with exponent alignment and normalization.
;
; The routine compares exponents, shifts the smaller mantissa, handles opposite signs as
; subtraction, and adds seven packed mantissa bytes with BCD correction. Carry and leading-zero
; handling adjust the exponent; the normalized nine-byte result is left in the first operand slot.
;
; Entry:
;   Two nine-byte BASIC numeric elements at the top of the stack.
;
; Exit:
;   The first operand contains x+y; one stack element is consumed.
;
; Effects:
;   Rewrites stack data and can raise Overflow.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers.
;
; Note:
;   Numbers use an identifier byte, overflow byte, exponent/sign byte, and seven packed BCD
;   mantissa bytes.
; -----------------------------------------------------------------------------
FP_ADD:
    PUSH AF
    PUSH IY
    LD DE,0009H
    ADD IY,DE
    EX (SP),IY
    LD A,(IY+08H)
    AND 7FH
    LD C,A
    LD A,(IY+11H)
    AND 7FH
    SUB C
    JP P,F4BFH
    EX (SP),IY
    PUSH AF
    NEG
    CALL F790H
    POP BC
    EX (SP),IY
    LD A,(IY+11H)
    SUB B
    LD (IY+11H),A
    XOR A

; Floating addition first aligns the smaller exponent and then decides add versus subtract from
; sign bits. Opposite-sign cancellation can create leading zeroes, so the normalizer must run even
; when no arithmetic carry occurred.

; -----------------------------------------------------------------------------
; ALIGN FLOATING OPERANDS
; -----------------------------------------------------------------------------
;
; Aligns exponents and selects addition or magnitude subtraction according to operand signs.
;
; The smaller exponent is shifted toward the larger, while the sign XOR determines whether packed
; BCD addition or subtraction is required. Opposite-sign results are corrected for leading zeroes
; before the shared normalizer runs.
; -----------------------------------------------------------------------------
FP_ALIGN_OR_SUBTRACT:
    CALL NZ,F790H
    LD A,(IY+08H)
    XOR (IY+11H)
    RLCA
    CALL NC,F4F4H
    EX (SP),IY
    JR NC,F4EEH
    CALL F71CH
    EX (SP),IY
    CALL F71CH
    CALL F4F4H
    EX (SP),IY
    LD A,(IY+07H)
    OR A
    JR Z,F4EEH
    CALL F70CH
    LD A,80H
    XOR (IY+08H)
    LD (IY+08H),A

LF4EE:
    POP AF

LF4EF:
    CALL F734H
    POP AF
    RET

; The mantissa loop is decimal: ADC followed by DAA propagates carries in packed BCD. Treating
; these bytes as binary integers will give plausible-looking but incorrect emulator results.

; -----------------------------------------------------------------------------
; ADD PACKED BCD MANTISSAS
; -----------------------------------------------------------------------------
;
; Adds seven packed BCD mantissa bytes with decimal carry propagation.
;
; The byte loop uses ADC followed by DAA, preserving decimal digits rather than binary nibbles. A
; final carry changes the exponent and is subsequently folded into the normalized result.
; -----------------------------------------------------------------------------
FP_BCD_ADD_MANTISSA:
    PUSH AF
    PUSH IY
    POP DE
    LD HL,0009H
    ADD HL,DE
    LD B,07H

LF4FE:
    INC HL
    INC DE
    LD A,(DE)
    ADC A,(HL)
    DAA
    LD (HL),A
    DJNZ F4FEH
    POP AF
    RET

LF508:
    LD DE,0009H
    ADD IY,DE
    CALL F9F9H
    POP AF
    RET

; Multiplication expands mantissas to decimal digits and accumulates sixteen working digits before
; repacking.

; -----------------------------------------------------------------------------
; FLOATING-POINT MULTIPLICATION
; -----------------------------------------------------------------------------
;
; Multiplies two BASIC floating-point values using sixteen decimal working digits.
;
; Zero operands are handled first. Otherwise signs and exponents are combined, each seven-byte BCD
; mantissa is expanded into individual digits, and a table-driven long multiplication accumulates
; sixteen decimal digits. The result is packed, rounded/normalized, and placed in the first
; operand slot.
;
; Entry:
;   Two nine-byte BASIC numeric elements on the stack.
;
; Exit:
;   The first operand contains the product; one operand is consumed.
;
; Effects:
;   Uses temporary stack/memory working storage and can report overflow.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers.
; -----------------------------------------------------------------------------
FP_MUL:
    PUSH AF
    LD A,(IY+0FH)
    OR A
    JR Z,F508H
    LD A,(IY+06H)
    OR A
    JR Z,F508H
    LD A,(IY+11H)
    LD L,(IY+08H)
    XOR L
    LD H,A
    XOR L
    AND 7FH
    LD L,A
    LD A,(IY+08H)
    AND 7FH
    ADD A,L
    SUB 40H
    JR C,F508H
    JP M,F912H
    INC A
    JP M,F912H
    DEC A
    LD L,A
    PUSH HL
    EXX
    EX (SP),HL
    PUSH DE
    PUSH BC
    PUSH HL
    PUSH IY
    POP HL
    LD E,L
    LD D,H
    LD BC,0010H
    ADD HL,BC
    CALL F5E8H
    PUSH DE
    LD (HL),A
    DEC HL
    LD (HL),A
    DEC HL
    CALL F5E8H
    LD HL,000AH
    ADD HL,DE
    LD C,L
    LD B,H
    LD DE,0013H
    ADD HL,DE
    POP DE
    INC DE
    PUSH HL
    OR 02H
    EX AF,AF'
    EXX
    LD C,0CH
    EXX

; Multiplication keeps guard digits beyond the seven stored mantissa bytes. Those digits allow the
; final pack/normalize stage to round at the correct decimal boundary instead of truncating each
; partial product.

; -----------------------------------------------------------------------------
; MULTIPLICATION DIGIT LOOP
; -----------------------------------------------------------------------------
;
; Accumulates one decimal digit product into the sixteen-digit multiplication workspace.
;
; Each source BCD digit selects a small product contribution, which is added into the working
; digits with decimal correction. The outer loop advances across both operands and leaves guard
; digits available for rounding.
; -----------------------------------------------------------------------------
FP_MUL_DIGIT_PRODUCT:
    POP HL
    PUSH HL
    PUSH BC
    LD A,(DE)
    EXX
    EX AF,AF'
    PUSH AF
    EX AF,AF'
    ADD A,A
    JR Z,F5B0H
    LD D,A
    ADD A,A
    ADD A,A
    ADD A,D
    LD D,A
    LD H,C0H
    LD E,00H
    LD B,10H
    EX AF,AF'

LF583:
    JP P,F58EH
    INC E
    DEC E
    JR Z,F5B0H

LF58A:
    EX AF,AF'
    XOR A
    JR F59BH

; The product inner loop uses a ROM lookup for a selected BCD digit. Zero digits bypass
; accumulation, which is both an optimization and a useful clue when distinguishing the table data
; from executable code.

; -----------------------------------------------------------------------------
; MULTIPLICATION TABLE LOOKUP
; -----------------------------------------------------------------------------
;
; Maps a packed BCD nibble to the product contribution used by the long-multiplication loop.
;
; The nibble is converted to an address in the multiplication table; unused/zero digits take a
; short path. The table-driven form keeps the inner decimal accumulation small enough for ROM.
; -----------------------------------------------------------------------------
FP_MUL_TABLE_LOOKUP:
    CP 0CH
    JR NC,F58AH
    EX AF,AF'
    EXX
    LD A,(BC)
    EXX
    ADD A,D
    ADD A,03H
    LD L,A
    LD A,(HL)

LF59B:
    ADD A,E
    DAA
    EXX
    ADD A,(HL)
    DAA
    LD (HL),00H
    RLD
    INC HL
    INC BC
    EXX
    RLCA
    RLCA
    RLCA
    RLCA
    LD E,A
    EX AF,AF'
    DEC A
    DJNZ F583H

; The product is packed only after all digit rows have been accumulated. Sign/exponent restoration
; occurs after packing, followed by the same FP_NORMALIZE path used by addition and division.

; -----------------------------------------------------------------------------
; PACK MULTIPLICATION RESULT
; -----------------------------------------------------------------------------
;
; Packs the accumulated decimal product back into the nine-byte stack format.
;
; The sixteen working digits are shifted into seven packed bytes, the sign and exponent are
; restored, and the result is placed at the surviving operand slot. Normalization then removes any
; leading zero or carry displacement.
; -----------------------------------------------------------------------------
FP_MUL_PACK_RESULT:
    POP AF
    INC A
    EX AF,AF'
    DEC C
    EXX
    POP BC
    DEC BC
    INC DE
    JR NZ,F56CH
    POP HL
    LD BC,000FH
    ADD HL,BC
    LD E,L
    LD D,H
    CALL F5DAH
    PUSH HL
    POP IY
    POP HL
    LD A,H
    AND 80H
    OR L
    LD (IY+08H),A
    LD (IY+00H),09H

LF5D3:
    POP BC
    POP DE
    POP HL
    EXX
    JP F4EFH

LF5DA:
    LD B,07H

LF5DC:
    LD A,(DE)
    DEC DE
    RLD
    LD A,(DE)
    DEC DE
    RLD
    DEC HL
    DJNZ F5DCH
    RET

LF5E8:
    LD B,07H

LF5EA:
    XOR A
    RLD
    LD (DE),A
    DEC DE
    XOR A
    RLD
    LD (DE),A
    DEC DE
    DEC HL
    DJNZ F5EAH
    XOR A
    RET

LF5F9:
    RST 08H
    DEC BC

; Division generates up to twelve quotient digits by repeated shifted subtraction; zero divisor
; raises error 0BH.

; -----------------------------------------------------------------------------
; FLOATING-POINT DIVISION
; -----------------------------------------------------------------------------
;
; Divides two BASIC floating-point values by repeated BCD subtraction and quotient-digit
; generation.
;
; A zero divisor raises Cannot divide by 0; a zero dividend returns zero. The routine aligns
; exponents and signs, repeatedly subtracts the divisor from a shifted remainder to generate
; twelve quotient digits, packs the result, and normalizes it. The compact implementation uses the
; BASIC stack and scratch area as a multi-precision decimal workspace.
;
; Entry:
;   Two nine-byte BASIC numeric elements on the stack.
;
; Exit:
;   The first operand contains x/y; one operand is consumed.
;
; Effects:
;   Uses scratch memory and can raise divide-by-zero or overflow errors.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers.
; -----------------------------------------------------------------------------
FP_DIV:
    PUSH AF
    LD A,(IY+06H)
    OR A
    JR Z,F5F9H
    LD A,(IY+0FH)
    OR A
    JP Z,FA1AH
    EXX
    PUSH HL
    PUSH DE
    PUSH BC
    PUSH IY
    LD DE,0009H
    ADD IY,DE
    LD L,(IY-01H)
    LD H,(IY+08H)
    EX (SP),HL
    LD (171CH),HL
    PUSH HL
    EX (SP),IY
    CALL F9F1H
    LD B,04H

; Division prepares a shifted decimal remainder rather than using the CPU divide instruction. The
; scratch layout is multi-precision state and may overlap reclaimed BASIC-stack bytes while the
; operation is active.

; -----------------------------------------------------------------------------
; DIVISION REMAINDER SETUP
; -----------------------------------------------------------------------------
;
; Aligns the divisor and remainder before generating quotient digits.
;
; The routine copies the divisor into the scratch layout, adjusts the exponent difference, and
; prepares the shifted remainder. The quotient loop can then compare/subtract fixed seven-byte BCD
; fields.
; -----------------------------------------------------------------------------
FP_DIV_SHIFTED_REMAINDER:
    LD HL,(171CH)
    EXX
    LD BC,FFF7H
    LD HL,(171CH)
    LD E,L
    LD D,H
    OR A
    SBC HL,BC
    EX DE,HL
    ADD HL,BC
    ADD HL,BC

; Each quotient digit is obtained by trial subtraction of a seven-byte BCD divisor. A failed trial
; restores the remainder; a successful trial advances the quotient digit before the next decimal
; shift.

; -----------------------------------------------------------------------------
; DIVISION BCD SUBTRACTION LOOP
; -----------------------------------------------------------------------------
;
; Subtracts the aligned divisor from the decimal remainder and records one quotient digit.
;
; Seven BCD bytes are compared/subtracted with decimal borrow handling. A nonnegative remainder
; increments the quotient digit; a negative trial restores the prior remainder and advances the
; shift instead.
; -----------------------------------------------------------------------------
FP_DIV_BCD_SUBTRACT:
    LD B,07H
    OR A

LF63B:
    INC DE
    LD A,(DE)
    EXX
    INC HL
    SBC A,(HL)
    EXX
    DAA
    INC HL
    LD (HL),A
    DJNZ F63BH
    AND F0H
    JR NZ,F65DH
    EXX
    CALL F7D2H
    INC A
    CALL F7E3H
    LD HL,(171CH)
    EXX
    LD BC,0007H
    LDDR
    JR F638H

; Division finalization combines the generated quotient, exponent difference, and sign XOR only
; after the remainder loop ends. This ordering explains why a zero dividend has a short path while
; a zero divisor raises error 0BH immediately.

; -----------------------------------------------------------------------------
; FINALIZE QUOTIENT
; -----------------------------------------------------------------------------
;
; Packs generated quotient digits, applies signs, and returns the division result to the stack.
;
; After the fixed number of quotient positions, the scratch remainder is discarded, the exponent
; difference is biased, and the sign XOR is written into the result. A final normalizer handles
; carry or leading-zero displacement.
; -----------------------------------------------------------------------------
FP_DIV_FINALIZE:
    EX (SP),IY
    CALL F784H
    EX (SP),IY
    EXX
    INC B
    LD A,B
    CP 10H
    JR C,F626H
    EXX
    LD HL,(171CH)
    DEC HL
    DEC HL
    LD BC,0008H
    LDDR
    POP IY
    POP HL
    LD A,H
    XOR L
    AND 80H
    LD C,A
    RES 7,H
    RES 7,L
    LD A,H
    SUB L
    ADD A,40H
    XOR C
    LD (IY+08H),A
    XOR C

LF68B:
    JP P,F5D3H
    CALL F9F9H
    JR F68BH

; Numeric comparison returns CY/S/Z like subtraction: less-than sets CY and S, equality sets Z.

; -----------------------------------------------------------------------------
; COMPARE BASIC NUMBERS
; -----------------------------------------------------------------------------
;
; Compares two packed floating-point values and returns Z/S/C flags without destroying their bytes
; immediately.
;
; Signs are compared first, then exponents and finally fourteen BCD mantissa digits. For x<y the
; routine returns carry and sign set; equality sets Z; x>y clears all three. The expression
; evaluator uses these flags to implement the six relation tokens.
;
; Entry:
;   Two numeric stack elements.
;
; Exit:
;   CY, S, and Z describe x versus y.
;
; Effects:
;   Adjusts IY to the first operand for the next stack operation.
;
; Destroys:
;   AF, DE, HL; stack values remain readable until overwritten.
; -----------------------------------------------------------------------------
FP_COMPARE:
    PUSH IY
    POP HL
    LD BC,0009H
    ADD HL,BC
    LD E,L
    LD D,H
    DEC DE
    ADD HL,BC
    PUSH HL
    POP IY
    DEC HL
    LD A,(HL)
    AND 80H
    RRCA
    LD C,A
    LD A,(DE)
    AND 80H
    RRCA
    SUB C
    RET NZ
    ADD A,C
    JR Z,F6B1H
    EX DE,HL

; Numeric comparison ignores the sign bit while comparing exponents and mantissas. Sign ordering
; is handled first, preventing a negative number with a large magnitude from being mistaken for a
; positive one.

; -----------------------------------------------------------------------------
; COMPARE NUMERIC MAGNITUDE
; -----------------------------------------------------------------------------
;
; Compares exponent and magnitude after equal signs have been established.
;
; The exponent bytes are compared without their sign bits, then the packed BCD digits are checked
; from most significant to least significant. Early return preserves the relation flags needed by
; the caller.
; -----------------------------------------------------------------------------
FP_COMPARE_MAGNITUDE:
    LD A,(DE)
    DEC DE
    AND 7FH
    LD C,A
    LD A,(HL)
    DEC HL
    AND 7FH
    SUB C
    RET NZ
    LD B,07H

; Packed mantissa comparison checks high nibble then low nibble for each byte. The first differing
; decimal digit determines the relation; no binary reinterpretation is involved.

; -----------------------------------------------------------------------------
; COMPARE BCD DIGITS
; -----------------------------------------------------------------------------
;
; Compares each high and low nibble of the mantissa in decimal order.
;
; The loop separates each packed byte into nibbles and exits on the first difference. Reaching the
; end without a difference sets equality, allowing relation decoding to share one path.
; -----------------------------------------------------------------------------
FP_COMPARE_BCD_DIGITS:
    LD A,(DE)
    AND F0H
    RRCA
    LD C,A
    LD A,(HL)
    AND F0H
    RRCA
    SUB C
    RET NZ
    LD A,(DE)
    AND 0FH
    LD C,A
    LD A,(HL)
    AND 0FH
    SUB C
    RET NZ
    DEC DE
    DEC HL
    DJNZ F6BEH
    RET

; -----------------------------------------------------------------------------
; COMPARE BASIC STRINGS
; -----------------------------------------------------------------------------
;
; Compares two length-prefixed strings lexicographically and returns relation flags.
;
; The shorter length limits byte comparison. Equal prefixes compare as equal until the remaining
; length decides the result. CY/S/Z are arranged like numeric comparison so the same relation
; evaluator can produce -1 or 0.
;
; Entry:
;   Two string elements on the BASIC stack.
;
; Exit:
;   CY, S, Z and A describe the lexical relation.
;
; Effects:
;   Leaves source strings intact for the immediate comparison, but the next stack write may
;   reclaim them.
;
; Destroys:
;   AF, BC, DE, HL, IY.
; -----------------------------------------------------------------------------
STRING_COMPARE:
    PUSH IY
    POP HL
    INC HL
    PUSH HL
    LD C,(HL)
    LD B,00H
    ADD HL,BC
    INC HL
    INC HL
    PUSH HL
    LD A,(HL)
    CP C
    JR C,F6E8H
    LD A,C

; String comparison stores the shorter length as the common-prefix bound but retains both original
; lengths. Thus equal prefixes are ordered by length, while a differing character wins
; immediately.

; -----------------------------------------------------------------------------
; LIMIT STRING COMPARISON
; -----------------------------------------------------------------------------
;
; Chooses the common-prefix length before bytewise string comparison.
;
; The shorter descriptor length bounds the CPI loop. The original lengths are retained so equal
; prefixes can be ordered by length after byte comparison.
; -----------------------------------------------------------------------------
STRING_COMPARE_LENGTH:
    LD C,(HL)
    ADD HL,BC
    INC HL
    PUSH HL
    POP IY
    LD C,A
    INC BC
    POP DE
    POP HL

; The byte comparison returns flags compatible with numeric relation handling. Length subtraction
; is performed only after CPI exhausts the shared prefix.

; -----------------------------------------------------------------------------
; COMPARE STRING BYTES
; -----------------------------------------------------------------------------
;
; Compares the common string prefix and then resolves a length-only difference.
;
; CPI scans the shared bytes; if they match, the saved lengths are subtracted to produce the
; relation. The result flags deliberately match numeric comparison semantics.
; -----------------------------------------------------------------------------
STRING_COMPARE_BYTES:
    LD A,(DE)
    INC DE
    CPI
    JP PO,F6FBH
    JR Z,F6F2H

LF6FB:
    DEC HL
    LD C,(HL)
    LD L,A
    LD H,B
    SBC HL,BC
    LD A,H
    RET Z
    RET M
    LD A,01H
    RET

LF707:
    BIT 7,(IY+08H)
    RET Z

LF70C:
    PUSH IY
    POP HL
    LD DE,0007H
    OR A

LF713:
    INC HL
    LD A,D
    SBC A,(HL)
    DAA
    LD (HL),A
    DEC E
    JR NZ,F713H
    RET

LF71C:
    BIT 7,(IY+08H)
    RET Z
    CALL F70CH
    JR F72BH

; Arithmetic routine 4: negates the sign of the 9-byte number on the BASIC Stack.

; -----------------------------------------------------------------------------
; NEGATE BASIC NUMBER
; -----------------------------------------------------------------------------
;
; Toggles the sign bit of a nonzero BASIC number.
;
; Zero is left unchanged. For a nonzero number the sign bit in the exponent/sign byte is inverted;
; mantissa and exponent remain untouched.
;
; Entry:
;   IY points to a BASIC numeric element.
;
; Exit:
;   The same value with its sign inverted.
;
; Effects:
;   Writes one stack byte.
;
; Destroys:
;   AF.
; -----------------------------------------------------------------------------
FP_NEGATE:
    LD A,(IY+06H)
    OR A
    RET Z

LF72B:
    LD A,80H
    XOR (IY+08H)
    LD (IY+08H),A
    RET

; -----------------------------------------------------------------------------
; NORMALIZE BASIC NUMBER
; -----------------------------------------------------------------------------
;
; Removes leading zero BCD digits or shifts a result until its exponent/mantissa are canonical.
;
; The normalizer handles zero, positive and negative exponent adjustments, and significant-digit
; shifts. It is shared by addition, multiplication, division, integer conversion, and decimal
; parsing; range violations use the BASIC overflow path.
;
; Entry:
;   IY points to a numeric element.
;
; Exit:
;   The element is normalized in place.
;
; Effects:
;   Rewrites exponent and packed mantissa bytes.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
FP_NORMALIZE:
    CALL F9DFH
    RET Z
    LD A,(IY+07H)
    OR A
    JR Z,F751H
    LD A,01H
    CALL F790H
    LD A,(IY+08H)
    AND 7FH
    CP 7EH
    JP Z,F912H
    INC (IY+08H)
    RET

; Normalization handles cancellation and underflow by decimal shifting, not by changing the type
; byte. If every mantissa byte becomes zero, it explicitly canonicalizes the exponent/sign to
; zero.

; -----------------------------------------------------------------------------
; LEFT-SHIFT NORMALIZATION
; -----------------------------------------------------------------------------
;
; Shifts a result toward its canonical leading digit while decreasing its exponent.
;
; When the most significant packed digits are zero, the helper shifts the mantissa left in decimal
; nibble steps and decrements the biased exponent. Reaching zero clears the complete numeric
; element instead of leaving a signed zero.
; -----------------------------------------------------------------------------
FP_SHIFT_LEFT_NORMALIZE:
    LD A,(IY+06H)
    AND F0H
    RET NZ
    CALL F784H
    LD A,(IY+08H)
    DEC (IY+08H)
    AND 7FH
    JR NZ,F751H
    JP F9F9H

; Rounding increments packed BCD digits with decimal carry. A carry out of the retained mantissa
; can change the exponent, so rounding is an arithmetic state transition rather than a
; display-only operation.

; -----------------------------------------------------------------------------
; ROUND PACKED DECIMAL
; -----------------------------------------------------------------------------
;
; Rounds a mantissa after decimal conversion or an arithmetic result exceeds the retained digits.
;
; The guard digit is examined and the retained BCD digits are incremented with DAA. Carry can
; propagate across the mantissa and re-enter normalization, so formatting and arithmetic share the
; same edge-case behavior.
; -----------------------------------------------------------------------------
FP_ROUND_BCD:
    PUSH HL
    PUSH IY
    POP HL
    INC HL
    LD A,(HL)
    CP 50H
    LD (HL),00H
    JR C,F782H
    LD B,06H

LF775:
    INC HL
    LD A,(HL)
    ADD A,01H
    DAA
    LD (HL),A
    JR NC,F77FH
    DJNZ F775H

LF77F:
    CALL F734H

LF782:
    POP HL
    RET

; RLD-based shifts preserve packed decimal nibbles while moving the mantissa. The displaced nibble
; is available to the caller as a guard digit for later rounding decisions.

; -----------------------------------------------------------------------------
; RIGHT-SHIFT DECIMAL MANTISSA
; -----------------------------------------------------------------------------
;
; Shifts packed BCD digits right when an exponent or multiplication carry requires it.
;
; RLD rotates successive nibbles through the mantissa while preserving decimal packing. The
; discarded nibble becomes a rounding candidate rather than silently disappearing.
; -----------------------------------------------------------------------------
FP_SHIFT_RIGHT_BCD:
    PUSH IY
    POP HL
    LD B,07H
    XOR A

LF78A:
    INC HL
    RLD
    DJNZ F78AH
    RET

; Decimal shifts are shared by exponent alignment, parsing, and formatting. Large requested shifts
; take the zero/overflow path rather than looping through unbounded memory.

; -----------------------------------------------------------------------------
; DECIMAL SHIFT HELPER
; -----------------------------------------------------------------------------
;
; Moves a BASIC mantissa by a requested number of decimal digit positions.
;
; Small shifts are implemented with nibble rotations and zero fill; larger shifts use the
; zero/overflow path. The helper is called by exponent alignment, normalization, and conversion
; code.
; -----------------------------------------------------------------------------
FP_DECIMAL_SHIFT:
    CP 0EH
    JR NC,F7C4H
    LD BC,00FFH
    PUSH IY
    POP HL
    PUSH HL
    LD E,L
    LD D,H

LF79D:
    INC HL
    SUB 02H
    INC C
    JR NC,F79DH
    JR Z,F7B7H
    INC DE
    PUSH AF
    LD A,07H
    SUB C
    LD C,A
    LDIR
    EX DE,HL
    SUB 08H
    CPL

LF7B1:
    LD (HL),B
    INC HL
    DEC A
    JR NZ,F7B1H
    POP AF

LF7B7:
    POP HL
    INC A
    RET NZ
    LD C,07H
    ADD HL,BC
    LD B,C

LF7BE:
    RRD
    DEC HL
    DJNZ F7BEH
    RET

LF7C4:
    LD C,(IY+08H)
    CALL F9F9H
    LD (IY+08H),C
    RET
    LD HL,FEB6H
    PUSH HL

; -----------------------------------------------------------------------------
; READ BCD NIBBLE
; -----------------------------------------------------------------------------
;
; Returns a selected high or low mantissa nibble for formatting or arithmetic.
;
; The nibble index is converted to a byte address relative to IY, then the requested half-byte is
; selected. Out-of-range positions read as zero, simplifying leading-zero suppression.
; -----------------------------------------------------------------------------
FP_GET_BCD_NIBBLE:
    PUSH HL
    PUSH BC
    CALL F7FDH
    JR C,F7DEH
    LD A,(HL)
    RLCA
    RLCA
    RLCA
    RLCA

LF7DE:
    AND 0FH
    POP BC
    POP HL
    RET

; -----------------------------------------------------------------------------
; WRITE BCD NIBBLE
; -----------------------------------------------------------------------------
;
; Updates one packed mantissa nibble without disturbing its neighbor.
;
; The helper masks or rotates the target nibble into place and writes it back to the numeric
; element. It is used by decimal parsing, multiplication packing, and integer conversion.
; -----------------------------------------------------------------------------
FP_SET_BCD_NIBBLE:
    PUSH HL
    PUSH BC
    CALL F7FDH
    LD B,F0H
    JR C,F7F7H
    SLA C
    SLA C
    SLA C
    SLA C
    LD A,(HL)
    LD B,0FH

LF7F7:
    AND B
    OR C
    LD (HL),A
    POP BC
    POP HL
    RET

LF7FD:
    PUSH IY
    POP HL
    SRL B
    PUSH AF
    LD A,08H
    SUB B
    LD C,A
    LD B,00H
    ADD HL,BC
    POP AF
    LD C,A
    LD A,(HL)
    RET

; Number formatting writes the decimal result into the BASIC formatting workspace beginning at
; 1931H.

; -----------------------------------------------------------------------------
; FORMAT NUMBER AS ASCII
; -----------------------------------------------------------------------------
;
; Converts the top BASIC number into the decimal text used by PRINT and error reporting.
;
; The formatter handles zero, sign, exponent, decimal placement, and fixed versus scientific
; notation. It extracts BCD digits, suppresses insignificant leading/trailing zeros, applies the
; configured formatting limits, and writes the result into the BASIC output workspace at 1931H.
;
; Entry:
;   IY points to a normalized BASIC number.
;
; Exit:
;   ASCII representation and length are stored in the formatting workspace.
;
; Effects:
;   Uses numeric formatting buffers and may round the displayed value.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers.
; -----------------------------------------------------------------------------
FP_TO_ASCII:
    LD A,(IY+06H)
    OR A
    LD HL,1931H
    LD (HL),30H
    JR Z,F897H
    BIT 7,(IY+08H)
    JR Z,F825H
    LD (HL),2DH
    INC HL
    CALL F726H

; The number formatter decides fixed versus E notation from exponent and significant-digit
; placement before writing digits. It therefore knows the final shape and length while emitting
; the mantissa.

; -----------------------------------------------------------------------------
; CHOOSE NUMBER DISPLAY FORM
; -----------------------------------------------------------------------------
;
; Chooses fixed-point or scientific notation from the exponent and significant-digit position.
;
; The formatter scans decimal positions, decides where the point belongs, and switches to an E
; suffix when the value cannot be represented compactly in fixed form. The decision occurs before
; digit emission so the output length byte remains correct.
; -----------------------------------------------------------------------------
FORMAT_FIXED_OR_EXPONENT:
    CALL F767H
    LD B,0EH

LF82A:
    DEC B
    LD A,B
    CP 04H
    CALL NC,F7D2H
    JR Z,F82AH
    LD C,B
    LD B,04H
    LD E,(IY+08H)
    LD A,E
    SUB 3BH
    LD D,A
    LD A,E
    CP 4AH
    JR NC,F858H
    CP 40H
    JR NC,F850H
    SUB C
    JR C,F859H
    CP 32H
    JR C,F859H
    LD B,D
    JR F85BH

LF850:
    LD A,C
    CP D
    JR NC,F85BH
    LD C,D
    OR A
    JR F85CH

LF858:
    SCF

LF859:
    LD D,05H

LF85B:
    INC C

LF85C:
    PUSH AF
    LD A,B

LF85E:
    CP D
    JR NZ,F864H
    LD (HL),2EH
    INC HL

; Digit emission reads BCD nibbles and adds 30H; the decimal point is inserted when the selected
; position is reached. Leading zero suppression changes the loop start, not the stored numeric
; value.

; -----------------------------------------------------------------------------
; EMIT FORMATTED DIGITS
; -----------------------------------------------------------------------------
;
; Extracts BCD nibbles, inserts the decimal point, and emits ASCII digits into the output
; workspace.
;
; Leading zero suppression and the first significant digit determine the loop bounds. Each
; selected BCD nibble receives 30H and is written sequentially; a deferred point is inserted at
; the chosen position.
; -----------------------------------------------------------------------------
FORMAT_DIGIT_LOOP:
    LD A,B
    SUB 04H
    LD A,00H
    CALL P,F7D2H
    ADD A,30H
    LD (HL),A
    INC HL
    INC B
    LD A,B
    CP C
    JR NZ,F85EH
    POP AF
    JR NC,F898H
    LD (HL),45H
    INC HL
    LD (HL),2BH
    LD A,E
    SUB 40H
    JR NC,F886H
    LD (HL),2DH
    NEG

; The exponent suffix is emitted as a signed decimal magnitude after E. The final count is derived
; from the workspace pointer, which keeps PRINT and error messages compatible with variable-width
; exponents.

; -----------------------------------------------------------------------------
; EMIT EXPONENT SUFFIX
; -----------------------------------------------------------------------------
;
; Appends the signed decimal exponent when scientific notation was selected.
;
; The biased exponent is converted to a signed magnitude and emitted after E and its sign. The
; final length is computed from the workspace base rather than from an assumed fixed width.
; -----------------------------------------------------------------------------
FORMAT_EXPONENT_DIGITS:
    INC HL
    LD B,FFH

LF889:
    INC B
    LD C,A
    SUB 0AH
    JR NC,F889H
    LD A,B
    ADD A,30H
    LD (HL),A
    INC HL
    SUB B
    ADD A,C
    LD (HL),A

LF897:
    INC HL

LF898:
    LD DE,1930H
    SCF
    SBC HL,DE
    EX DE,HL
    LD (HL),E
    RET

; -----------------------------------------------------------------------------
; COPY STRING TO BASIC STACK
; -----------------------------------------------------------------------------
;
; Copies a length-prefixed source string into newly allocated BASIC-stack space.
;
; The routine checks available stack memory, copies string bytes backwards where necessary to
; avoid overlap, writes the length and string identifier, and advances IY. It is used for literals
; and for converting input buffers into BASIC values.
;
; Entry:
;   HL = source string buffer.
;
; Exit:
;   A string element is allocated on the BASIC stack.
;
; Effects:
;   Allocates and copies stack memory; can raise Overflow.
;
; Destroys:
;   AF, BC, DE, HL, IY.
; -----------------------------------------------------------------------------
STRING_TO_STACK:
    PUSH DE
    PUSH BC
    LD E,FFH
    LD C,00H

LF8A7:
    LD A,(HL)
    INC HL
    CP 20H
    JR Z,F8A7H
    CP 22H
    JR NZ,F8B4H
    INC C

LF8B2:
    LD A,(HL)
    INC HL

LF8B4:
    INC E
    INC C
    DEC C
    JR Z,F8C7H
    CP FFH
    JR Z,F8D3H
    CP 22H
    JR NZ,F8B2H
    CP (HL)
    INC HL
    JR Z,F8B2H
    JR F8D3H

LF8C7:
    CP 2CH
    JR Z,F8D3H
    CP 21H
    JR Z,F8D3H
    CP FDH
    JR C,F8B2H

LF8D3:
    DEC HL
    PUSH HL
    PUSH DE
    LD B,E
    PUSH IY
    POP DE
    CALL FC8EH
    INC B

LF8DE:
    DEC B
    DEC DE
    JR Z,F8F8H
    DEC HL
    LD A,(HL)
    CP 22H
    JR NZ,F8EEH
    INC C
    DEC C
    JR Z,F8EEH
    DEC HL
    LD A,(HL)

LF8EE:
    LD (DE),A
    CP 20H
    JR NC,F8DEH
    OR 80H
    LD (DE),A
    JR F8DEH

LF8F8:
    EX DE,HL
    POP DE
    LD (HL),E
    DEC HL
    LD (HL),01H
    PUSH HL
    POP IY
    POP HL
    POP BC
    POP DE
    RET
    LD A,(HL)
    CP 22H
    JR Z,F8A1H
    CALL F914H
    JP NC,FD5AH
    RLA
    RET NC

LF912:
    RST 08H
    DEC C

; ASCII parsing accepts sign, decimal point, and optional signed E exponent; insignificant
; underflow becomes zero.

; -----------------------------------------------------------------------------
; PARSE ASCII NUMBER
; -----------------------------------------------------------------------------
;
; Parses decimal digits, a decimal point, and an optional E exponent into BASIC floating-point
; format.
;
; The parser skips spaces, records sign, collects significant digits into packed BCD bytes,
; adjusts the exponent for the decimal point, and accepts an optional signed E exponent. It
; retains the required precision, rounds/normalizes the result, and turns excessively small values
; into zero; malformed input and oversized exponents use the standard error status.
;
; Entry:
;   HL = first byte of an ASCII numeric string.
;
; Exit:
;   A normalized numeric element is pushed on the BASIC stack; source pointer/status indicate
;   success.
;
; Effects:
;   Allocates stack space and uses conversion workspace.
;
; Destroys:
;   AF, BC, DE, HL, IY.
; -----------------------------------------------------------------------------
ASCII_TO_FP:
    PUSH BC
    PUSH DE
    CALL F9F4H
    PUSH HL
    PUSH IY
    POP HL
    LD DE,0007H
    ADD HL,DE
    EX (SP),HL
    LD E,3FH
    LD B,0BH

; ASCII parsing tracks sign, decimal point, and significant-digit state in flags while packing
; digits into the numeric workspace. Once the precision limit is reached, later digits still
; influence rounding/overflow state even if they are not stored.

; -----------------------------------------------------------------------------
; SCAN INPUT SIGN AND DIGITS
; -----------------------------------------------------------------------------
;
; Consumes leading spaces/sign and packs decimal digits while parsing an ASCII number.
;
; The state flags distinguish sign, decimal point, and whether a significant digit has been seen.
; Each accepted digit is inserted into the seven-byte BCD mantissa until the precision limit is
; reached.
; -----------------------------------------------------------------------------
ASCII_SCAN_SIGN_DIGITS:
    LD A,(HL)
    INC HL
    CP 20H
    JR Z,F926H
    CP 2BH
    JR Z,F936H
    CP 2DH
    JR NZ,F938H
    SET 1,D

LF936:
    LD A,(HL)
    INC HL

LF938:
    CP 2EH
    JR Z,F969H
    SUB 3AH
    JR NC,F971H
    ADD A,0AH
    JR NC,F971H
    LD C,A
    SET 7,D
    LD A,D
    RRCA
    JR NZ,F954H
    BIT 2,D
    JR NZ,F956H
    JR NC,F936H
    DEC E
    JR F936H

; The decimal point changes the provisional exponent rather than moving already packed digits. A
; second point or a nonnumeric terminator exits through the parser's validation state.

; -----------------------------------------------------------------------------
; TRACK DECIMAL POINT
; -----------------------------------------------------------------------------
;
; Adjusts the provisional exponent as digits are consumed before and after the decimal point.
;
; Digits before the point advance the significant position; fractional digits decrease the
; exponent contribution. The state prevents a second decimal point from being accepted as part of
; the same number.
; -----------------------------------------------------------------------------
ASCII_DECIMAL_STATE:
    SET 2,D

LF956:
    JR C,F959H
    INC E

LF959:
    LD A,B
    DEC A
    JR Z,F936H
    LD B,A
    EX (SP),HL
    RRCA
    JR C,F963H
    DEC HL

LF963:
    LD A,C
    RLD
    EX (SP),HL
    JR F936H

LF969:
    SET 7,D
    BIT 0,D
    SET 0,D
    JR Z,F936H

LF971:
    EX (SP),HL
    DEC B
    BIT 0,B
    JR Z,F97AH
    XOR A
    RLD

; An optional E exponent is parsed after the mantissa and combined with the decimal-point
; adjustment. The parser accepts a signed exponent but rejects an exponent marker with no valid
; digits.

; -----------------------------------------------------------------------------
; SCAN E EXPONENT
; -----------------------------------------------------------------------------
;
; Recognizes an optional E exponent and folds its signed value into the numeric exponent.
;
; The parser accepts an optional exponent sign, accumulates decimal exponent digits, applies the
; sign, and combines the result with the decimal-point adjustment. Excessive exponent magnitude is
; flagged before final normalization.
; -----------------------------------------------------------------------------
ASCII_SCAN_EXPONENT:
    POP HL
    DEC HL
    LD A,(HL)
    CALL FBC8H
    CP 45H
    LD A,E
    JR NZ,F9C5H
    SET 7,D
    INC HL
    LD A,(HL)
    CP 98H
    JR Z,F99BH
    CP 2BH
    JR Z,F99BH
    CP A2H
    JR Z,F999H
    CP 2DH
    JR NZ,F99CH

LF999:
    SET 5,D

LF99B:
    INC HL

LF99C:
    LD B,00H
    DEC HL

LF99F:
    INC HL
    LD A,(HL)
    SUB 3AH
    JR NC,F9B7H
    ADD A,0AH
    JR NC,F9B7H
    LD C,A
    LD A,B
    ADD A,A
    LD B,A
    ADD A,A
    ADD A,A
    ADD A,B
    ADD A,C
    LD B,A
    JP P,F99FH
    SET 6,D

LF9B7:
    LD A,B
    BIT 5,D
    JR Z,F9BEH
    NEG

LF9BE:
    ADD A,E
    CP 7FH
    JR C,F9C5H
    SET 6,D

; Parsed values are finalized by writing the biased exponent/sign byte, applying the leading
; minus, testing zero, and normalizing. This makes tiny underflow results canonical zero and keeps
; sign handling consistent with arithmetic.

; -----------------------------------------------------------------------------
; FINALIZE PARSED NUMBER
; -----------------------------------------------------------------------------
;
; Stores sign/exponent state, normalizes the parsed mantissa, and returns parser status.
;
; The finalizer writes the biased exponent/sign byte, toggles the sign for a leading minus,
; detects an all-zero mantissa, and calls the common normalizer. Underflow therefore becomes
; canonical zero rather than a denormal stack value.
; -----------------------------------------------------------------------------
ASCII_FP_FINALIZE:
    PUSH DE
    LD (IY+08H),A
    BIT 1,D
    CALL NZ,F726H
    CALL F9DFH
    POP DE
    LD A,D
    RRA
    AND D
    AND 20H
    LD A,D
    RLA
    CALL NZ,F9F9H
    POP DE
    POP BC
    RET

; The zero test scans all mantissa bytes and clears the exponent/sign byte when none is nonzero.
; It is called after cancellation and parsing, so negative zero cannot survive as a distinct BASIC
; value.

; -----------------------------------------------------------------------------
; TEST NUMERIC ZERO
; -----------------------------------------------------------------------------
;
; Scans all mantissa bytes and canonicalizes an all-zero value.
;
; A zero mantissa forces the exponent/sign byte to zero. This shared check keeps zero signless
; after parsing, arithmetic cancellation, and conversion.
; -----------------------------------------------------------------------------
FP_TEST_ZERO:
    PUSH HL
    PUSH IY
    POP HL
    LD B,07H
    XOR A

LF9E6:
    INC HL
    OR (HL)
    JR NZ,F9EFH
    DJNZ F9E6H
    LD (IY+08H),A

LF9EF:
    POP HL
    RET

LF9F1:
    CALL FC8EH

; Numeric allocation advances IY by exactly nine bytes. Every caller must initialize the
; identifier and all numeric fields before another routine treats the new stack element as valid.

; -----------------------------------------------------------------------------
; ALLOCATE NUMERIC STACK ELEMENT
; -----------------------------------------------------------------------------
;
; Makes room for a nine-byte numeric element immediately above the current BASIC stack value.
;
; The helper moves IY by the fixed numeric element size and is used by ASCII parsing, integer
; conversion, and arithmetic result construction. The allocation is logical; callers must
; initialize every byte before exposing the element.
; -----------------------------------------------------------------------------
FP_ALLOCATE_NUMERIC:
    LD DE,FFF7H
    ADD IY,DE

; Clearing a numeric element is a logical constructor: type 09H is written first, then eight data
; bytes are zeroed. The arithmetic routines depend on this invariant for zero fast paths.

; -----------------------------------------------------------------------------
; CLEAR NUMERIC ELEMENT
; -----------------------------------------------------------------------------
;
; Initializes a newly allocated numeric element as a zero value.
;
; The identifier byte is set to 09H and the eight following bytes are cleared. Later conversion
; code can fill only the mantissa/exponent fields while retaining a valid type marker.
; -----------------------------------------------------------------------------
FP_CLEAR_NUMERIC:
    PUSH IY
    EX (SP),HL
    LD (HL),09H
    LD B,08H
    XOR A

LFA01:
    INC HL
    LD (HL),A
    DJNZ FA01H
    POP HL
    SCF
    RET

LFA08:
    CALL F9F9H
    LD (IY+08H),40H
    LD (IY+06H),10H
    RET
    LD HL,FEB6H
    PUSH HL
    JR F9F9H

LFA1A:
    POP AF

; -----------------------------------------------------------------------------
; DISCARD STACK NUMBER
; -----------------------------------------------------------------------------
;
; Reclaims one nine-byte BASIC numeric element by moving IY backward.
;
; Discarding a value only changes the BASIC stack boundary; its bytes are not cleared. This
; inexpensive primitive is used when integer conversion, failed parsing, or expression evaluation
; no longer needs the original value.
;
; Entry:
;   IY points above a numeric element.
;
; Exit:
;   IY is moved back by nine bytes.
;
; Effects:
;   Reclaims stack space without memory clearing.
;
; Destroys:
;   IY.
; -----------------------------------------------------------------------------
DISCARD_NUMBER:
    LD DE,0009H
    ADD IY,DE
    RET

; -----------------------------------------------------------------------------
; DISCARD STACK STRING
; -----------------------------------------------------------------------------
;
; Reclaims a length-prefixed BASIC string from the stack.
;
; The length byte is read and IY is moved backward over the identifier, length, and payload. As
; with numeric discard, the data is logically dead but not erased.
;
; Entry:
;   IY points above a string element.
;
; Exit:
;   IY points to the preceding stack element.
;
; Effects:
;   Reclaims variable-sized stack space.
;
; Destroys:
;   AF, IY.
; -----------------------------------------------------------------------------
DISCARD_STRING:
    LD E,(IY+01H)
    LD D,00H
    INC DE
    INC DE
    ADD IY,DE
    RET

; -----------------------------------------------------------------------------
; PUSH INTEGER ON BASIC STACK
; -----------------------------------------------------------------------------
;
; Converts signed HL into the normalized nine-byte BASIC numeric representation.
;
; The integer is shifted into decimal digit positions, with carry becoming an additional digit
; when required. The routine chooses an exponent, writes the identifier/sign/mantissa bytes, and
; finishes through normalization.
;
; Entry:
;   HL = signed integer.
;
; Exit:
;   HL's value is pushed as a BASIC number.
;
; Effects:
;   Allocates nine bytes on the BASIC stack.
;
; Destroys:
;   AF, BC, DE, HL, IY.
; -----------------------------------------------------------------------------
INTEGER_TO_STACK:
    CALL F9F1H
    INC IY
    LD (171CH),IY
    DEC IY
    PUSH HL
    CALL FC83H
    SCF

LFA3B:
    ADC HL,HL
    JR NC,FA3BH
    LD C,01H
    JR FA52H

LFA43:
    INC B
    INC C
    DB 3EH                                                                          ; |>|

LFA46:
    LD B,C

LFA47:
    INC DE
    LD A,(DE)
    ADC A,A
    DAA
    LD (DE),A
    DJNZ FA47H
    JR C,FA43H
    ADC HL,HL

LFA52:
    LD DE,(171CH)
    JR NZ,FA46H
    POP AF
    AND 80H
    OR 49H
    LD (IY+08H),A
    JP F734H

LFA63:
    CALL FC8EH
    LD BC,0005H
    ADD HL,BC
    PUSH IY
    POP DE
    DEC DE
    LDD
    XOR A
    LD (DE),A
    DEC DE
    INC BC
    LDDR
    LD (DE),A
    LD A,09H
    DEC DE
    JR FA8DH

LFA7C:
    INC HL

LFA7D:
    LD C,(HL)
    LD B,00H
    CALL FC8EH
    ADD HL,BC
    INC BC
    PUSH IY
    POP DE
    DEC DE
    LDDR
    LD A,01H

LFA8D:
    LD (DE),A
    PUSH DE
    POP IY
    RET

LFA92:
    CALL FC8EH
    PUSH IY
    POP DE
    DEC DE
    LD HL,0009H
    LD C,L
    LD B,H
    ADD HL,DE
    LDDR
    INC DE
    PUSH DE
    POP IY
    RET

LFAA6:
    CALL FC8EH
    PUSH IY
    POP HL
    DEC HL
    LD E,L
    LD D,H
    LD BC,0012H
    ADD HL,BC
    LDDR
    INC DE
    PUSH DE
    POP IY
    RET

LFABA:
    CALL FC43H
    JR FAC4H

LFABF:
    CALL FAC3H
    EX DE,HL

; -----------------------------------------------------------------------------
; CONVERT STACK NUMBER TO INTEGER
; -----------------------------------------------------------------------------
;
; Converts a BASIC number to signed HL with range checking.
;
; The exponent determines how many BCD digits participate. The routine repeatedly multiplies the
; accumulating HL by ten, adds each digit, applies the sign, and discards the original stack
; number. Values outside the signed integer range raise Bad argument or Overflow through the
; caller's selected path.
;
; Entry:
;   IY points to a BASIC numeric element.
;
; Exit:
;   HL = signed integer; the source stack element is reclaimed.
;
; Effects:
;   Reads and invalidates stack data.
;
; Destroys:
;   AF, BC, DE, HL, IY.
; -----------------------------------------------------------------------------
STACK_NUMBER_TO_INTEGER:
    DB F6H                                                                          ; |.|

LFAC4:
    SCF

LFAC5:
    PUSH BC
    PUSH DE
    CALL C,F0A7H
    LD A,(IY+08H)
    PUSH AF
    AND 7FH
    SBC HL,HL
    CP 45H
    JR NC,FB14H
    SUB 40H
    JR C,FB06H
    ADD A,05H
    LD C,A
    LD B,04H

LFADF:
    LD A,H
    AND E0H
    JR NZ,FB14H
    ADD HL,HL
    LD E,L
    LD D,H
    ADD HL,HL
    ADD HL,HL
    ADD HL,DE
    JR C,FB14H
    CALL F7D2H
    LD E,A
    LD D,00H
    ADD HL,DE
    JR C,FB14H
    INC B
    LD A,C
    CP B
    JR NZ,FADFH
    POP AF
    PUSH AF
    OR A
    CALL M,FC86H
    POP AF
    XOR H
    JP M,FB14H
    DB 3EH                                                                          ; |>|

LFB06:
    POP AF
    LD DE,0009H
    ADD IY,DE
    LD A,H
    OR A
    EXX
    LD A,B
    EXX
    POP DE
    POP BC
    RET

LFB14:
    RST 08H
    INC B

; -----------------------------------------------------------------------------
; CONVERT STACK NUMBER TO BYTE
; -----------------------------------------------------------------------------
;
; Converts a BASIC number to A after requiring an integer byte-sized value.
;
; The helper delegates to integer conversion, verifies that the high byte is empty or
; sign-compatible, and returns the low byte. It is used for ports, character codes, and other
; byte-valued BASIC arguments.
;
; Entry:
;   Numeric element on BASIC stack.
;
; Exit:
;   A = byte value; flags/status indicate validity.
;
; Effects:
;   Reclaims the source numeric element.
;
; Destroys:
;   AF, BC, DE, HL, IY.
; -----------------------------------------------------------------------------
STACK_NUMBER_TO_BYTE:
    CALL FC43H
    DB 3EH                                                                          ; |>|

LFB1A:
    DB F6H                                                                          ; |.|

LFB1B:
    SCF
    PUSH HL
    CALL FAC5H
    INC H
    DEC H
    JP NZ,FB14H
    LD A,L
    POP HL
    RET

; Arithmetic routine 13: moves from BASIC Stack to the address in HL; 9 bytes freed from Stack.

LFB28:
    CALL F767H
    EX DE,HL
    PUSH IY
    POP HL
    INC HL
    INC HL
    LD BC,0005H
    LDIR
    INC HL
    LDI
    JR FB57H

LFB3B:
    BIT 1,(IX+01H)
    JR NZ,FB28H

LFB41:
    LD C,(HL)
    INC HL
    PUSH IY
    POP DE
    INC DE
    LD A,(DE)
    INC C
    JR NZ,FB4CH
    DEC C

LFB4C:
    CP C
    JP NC,F912H
    LD C,A
    LD B,00H
    INC BC
    EX DE,HL
    LDIR

LFB57:
    PUSH HL
    POP IY
    RET

; Bytes copied into RAM at initialization (addresses 0008H-002FH): error handlers, RST 18H entry,
; and function call dispatcher.
    DB E1H, 7EH, B7H, E5H, 00H, 00H, 00H, 00H, C8H, E1H, C3H, 5CH, FDH, C3H, 00H, 00H ; |.~.........\....|

; Character matrix table for character codes 128-160, ten bytes per character.
    DB C3H, 82H, FBH, 32H, 1FH, 00H, F7H, 00H, C9H, 00H, 00H, 00H, 00H, 00H, 00H, 00H ; |...2............|
    DB 00H, 00H, 00H, 00H, 00H, 00H, 00H                                            ; |.......|

; RST 18 operation bytes are threaded through the jump table and advance the next-byte pointer at
; 1718H-1719H.
; RST18 dispatch saves the continuation pointer in 1718H-1719H and executes a sequence of
; operation bytes. The high bit marks the final byte; intermediate operations may push, copy,
; delete, or combine typed stack values.

; -----------------------------------------------------------------------------
; RST 18H BASIC STACK DISPATCH
; -----------------------------------------------------------------------------
;
; Executes the compact arithmetic and stack-operation bytecode following an RST 18H instruction.
;
; RST 18H is a threaded helper language used throughout BASIC. The dispatcher saves the
; return/source pointer, fetches each operation byte, and uses a jump table to perform stack
; arithmetic, conversions, duplication, deletion, symbol copies, and control helpers. The
; operation stream may contain several bytes, so the dispatcher advances 1718H-1719H until the
; terminating operation returns to the interpreter.
;
; The mechanism lets math-heavy BASIC routines express repeated stack transformations in a few
; bytes while keeping the actual algorithms in reusable subroutines.
;
; Entry:
;   The byte following RST 18H selects the operation; 1718H/1719H tracks the next byte.
;
; Exit:
;   Operation-specific values and stack pointer updates.
;
; Effects:
;   Manipulates BASIC stack elements, IY, and interpreter workspace.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers, IY.
;
; Note:
;   The first 48 bytes copied to U0 RAM include the RST 18H entry and the ordinary error/call
;   stubs.
; -----------------------------------------------------------------------------
RST18_DISPATCH:
    DB 22H, 1EH, 17H, 32H, 04H, 17H, 2AH, 18H, 17H, E3H, 7EH, 23H, 22H, 18H, 17H, 87H ; |"..2..*...~#"...|
    DB F5H, C6H, C7H, 6FH, 26H, C0H, 7EH, 23H, 66H, 6FH, 22H, 16H, 00H, 2AH, 1EH, 17H ; |...o&.~#fo"..*..|
    DB 3AH, 04H, 17H, CDH, 15H, 00H, 32H, 04H, 17H, 22H, 1EH, 17H, 2AH, 18H, 17H, F1H ; |:.....2.."..*...|
    DB 30H, D8H, E3H, 22H, 18H, 17H, 2AH, 1EH, 17H, 3AH, 04H, 17H, C9H, 1AH, 04H, 05H ; |0.."..*..:......|
    DB C0H, FEH, FFH, C8H, E6H, 7FH, FEH, 20H, 38H, 09H, FEH, 61H, D8H, FEH, 7BH, D0H ; |....... 8..a..{.|
    DB E6H, DFH, C9H, FEH, 10H, D8H, FEH, 19H, D0H, E6H, EFH, C9H, FEH, 02H, C2H, 5AH ; |...............Z|
    DB FDH, CDH, C3H, FAH, CDH, 44H, DDH, D0H, CFH, 02H, 0EH, 20H, CDH, FDH, FBH, C0H ; |.....D..... ....|
    DB FEH, FDH, 28H, 4DH, FEH, FEH, D0H, CFH, 01H, 0EH, 20H, DDH, 71H, 05H, D9H, 78H ; |..(M...... .q..x|
    DB D9H, FEH, A7H, C0H, CDH, 16H, FBH, E6H, 07H, 87H, 87H, 87H, 87H, 32H, 05H, 17H ; |.............2..|
    DB 4FH, AFH, D9H, 78H, D9H, C9H, DDH, 36H, 05H, 20H, 3AH, 4EH, 0BH, 4FH, 3AH, 4DH ; |O..x...6. :N.O:M|
    DB 0BH, B9H, C0H, 3CH, 32H, 4DH, 0BH, 3AH, 13H, 0BH, CBH, 4FH, C8H, 79H, 2FH, 32H ; |...<2M.:...O.y/2|
    DB 4DH, 0BH, C9H, DDH, CBH, 00H, 5EH, C8H, DDH, CBH, 00H, 9EH, F7H, 54H, F7H, D4H ; |M.....^......T..|
    DB C9H, D9H, 7EH, 47H, FEH, FEH, 30H, 30H, 23H, FEH, C5H, 28H, 2FH, FEH, 80H, 30H ; |..~G..00#..(/..0|
    DB 27H, FEH, 20H, 28H, EDH, 2BH, 06H, 00H, FEH, 22H, 37H, 28H, 17H, CBH, C8H, FEH ; |'. (.+..."7(....|
    DB 41H, 38H, 11H, FEH, 5BH, 3FH, 38H, 0CH, CDH, D2H, F3H, D4H, 0BH, F4H, 79H, E6H ; |A8..[?8.......y.|
    DB 02H, F6H, 01H, 47H, DCH, 05H, F9H, 78H, D9H, FEH, FDH, C9H, 4FH, 06H, 01H, 18H ; |...G...x....O...|
    DB F6H, CBH, 7CH, C8H, 2BH, 7DH, 2FH, 6FH, 7CH, 2FH, 67H, C9H, E5H, D5H, 11H, 00H ; |..|.+}/o|/g.....|
    DB 01H, CDH, 99H, FCH, D1H, E1H, C9H, 2AH, 26H, 17H, 19H, 38H, 12H, EBH, FDH, E5H ; |.......*&..8....|
    DB E1H, EDH, 52H, 38H, 0AH, EDH, 62H, 39H, EDH, 5BH, 17H, 0BH, EDH, 52H, D0H, CFH ; |..R8..b9.[...R..|
    DB 06H, AFH, 6FH, 67H, 3EH, 10H, 3DH, F8H, EDH, 6AH, CBH, 21H, CBH, 10H, 30H, F6H ; |..og>.=..j.!..0.|
    DB 19H, 18H, F3H, CDH, D1H, FCH, D0H, FEH, CAH, D0H, CDH, D5H, FCH, 18H, F7H, D9H ; |................|
    DB E5H, D9H, E1H, 7EH, FEH, FEH, D0H, 23H, FEH, FDH, 20H, F7H, 7EH, 23H, FEH, 20H ; |...~...#.. .~#. |
    DB 28H, FAH, 2BH, 37H, C9H, 06H, 00H, FDH, E5H, E1H, 4EH, B9H, C8H, 0CH, 0DH, 37H ; |(.+7......N....7|
    DB C8H, 0DH, 20H, 02H, 23H, 4EH, 0CH, 09H, E5H, FDH, E1H, 18H, EDH, CDH, A7H, F0H ; |.. .#N..........|
    DB 21H, 00H, 80H, E5H, CDH, 2BH, FAH, CDH, 93H, F4H, CDH, C3H, FAH, D1H, 19H, C9H ; |!....+..........|
    DB 4FH, 7EH, B7H, 79H, C8H, 96H, 23H, 5EH, 23H, 20H, F6H, 57H, 19H, CDH, 43H, FCH ; |O~.y..#^# .W..C.|
    DB CDH, ADH, DBH, 37H, C9H, CDH, 43H, FCH, 1EH, 01H, 28H, 08H, CDH, 45H, FDH, 5AH ; |...7..C...(..E.Z|
    DB FEH, FDH, 20H, 0AH, CDH, 43H, FCH, 16H, FFH, FEH, 95H, C4H, 45H, FDH, 3EH, 95H ; |.. ..C......E.>.|
    DB C3H, 54H, FDH, CDH, C4H, FAH, 16H, 00H, 24H, C8H, 15H, 25H, C0H, 55H, C9H, CDH ; |.T......$..%.U..|
    DB 43H, FCH, D9H, B8H, D9H, CAH, 43H, FCH, 3EH, 01H                             ; |C.....C.>.|

; BASIC_ERROR receives the numeric error code in A, unwinds interpreter state, prints a matching
; message, and returns to the command loop.

; -----------------------------------------------------------------------------
; BASIC ERROR HANDLER
; -----------------------------------------------------------------------------
;
; Unwinds the current BASIC operation, selects an error message, and returns to the command loop.
;
; A contains the error code. The handler saves the interpreter context, recognizes STOP and
; special system errors, frees or resets transient stack state, and selects the matching
; length-prefixed message from the error table. It prints the message and current line context,
; restores the command environment, and resumes BASIC in its normal ready/error state.
;
; Entry:
;   A = BASIC error code; interpreter context and current line are active.
;
; Exit:
;   Control returns to the BASIC command loop after reporting the error.
;
; Effects:
;   Unwinds stack/interpreter state and writes screen output.
;
; Destroys:
;   AF, BC, DE, HL, IY and transient interpreter state.
; -----------------------------------------------------------------------------
BASIC_ERROR:
    DB FDH, 2AH, 1AH, 17H, FEH, F5H, CAH, A3H                                       ; |.*......|

; Error dispatch preserves enough current-line and command context to distinguish an immediate
; error from a program error. It unwinds transient stack state before emitting the message so
; stale expression values do not become live after recovery.
    DB FFH, F5H, FEH, 06H, CCH, FCH, DCH, CDH, 35H, FCH, CDH, 18H, FCH, CDH, 79H, FEH ; |........5.....y.|

; " " text prefix for BASIC error messages.
    DB 06H, 0DH, 0AH, 2AH, 2AH, 2AH, 20H, F1H, CBH, 7FH, 20H, 18H, 21H, C6H, FDH, 01H ; |...*** ... .!...|
    DB FFH, FFH, 03H, 09H, 4EH, 23H, 0CH, 0DH, 28H, 04H, B9H, 4EH, 20H, F4H, 23H, CDH ; |....N#..(..N .#.|
    DB DDH, FEH, 18H, 18H, 6FH, CDH, 79H, FEH                                       ; |....o.y.|

; "System error" text.
    DB 0DH, 53H, 79H, 73H, 74H, 65H, 6DH, 20H, 65H, 72H, 72H, 6FH, 72H, 20H, AFH, 67H ; |.System error .g|
    DB 47H, CDH, 1BH, FFH, CDH, 79H, FEH, 04H, 2EH, 0BH, 0DH, 0AH, DDH, CBH, 00H, CEH ; |G....y..........|
    DB 2AH, 0CH, 17H, AFH, CDH, 2DH, DDH, C3H, 0EH, E1H                             ; |*....-....|

; BASIC error message table; entries contain code, length, text, and FFH terminator.
    DB 01H, 0FH, 4EH, 6FH, 74H, 20H, 75H, 6EH, 64H, 65H, 72H, 73H, 74H, 6FH, 6FH, 64H ; |..Not understood|
    DB FFH, 02H, 06H, 4CH, 69H, 6EH                                                 ; |...Lin|

; Error-message records are code/length/text entries terminated by FFH; TVC token codes may appear
; inside the text.

; -----------------------------------------------------------------------------
; BASIC ERROR MESSAGE DATA
; -----------------------------------------------------------------------------
;
; Length-prefixed error texts indexed by BASIC error code.
;
; Entries contain an error code, a length, encoded text, and an FFH terminator. Messages include
; Not understood, Line, Argument missing, Bad argument, Subscript, Out of memory, Syntax,
; Overflow, Type mismatch, Variable declared twice, File, BASIC corrupted, and Cannot divide by 0.
; Some characters use TVC token/character codes rather than plain ASCII.
;
; Entry:
;   Selected by BASIC_ERROR.
;
; Exit:
;   Text span consumed by PRINT_LENGTH_TEXT.
;
; Effects:
;   Read-only ROM data.
;
; Destroys:
;   None.
; -----------------------------------------------------------------------------
BASIC_ERROR_MESSAGES:
    DB 65H, 93H, FFH, 03H                                                           ; |e...|

; The message table is compact code/length/text data, not a null-terminated string array. Shared
; token-coded fragments are expanded by the print helper, which is why raw ROM bytes may not read
; as ordinary ASCII.
    DB 04H, 41H, 92H, 93H, FFH, 04H, 04H, 91H, 61H, 92H, FFH, 05H, 0BH, 91H, 73H, 75H ; |.A......a.....su|
    DB 62H, 73H, 63H, 72H, 69H, 70H, 74H, FFH, 06H, 08H, 90H, 6DH, 65H, 6DH, 6FH, 72H ; |bscript....memor|
    DB 79H, FFH, 07H, 03H, 90H, FBH, FFH, 08H, 03H, 90H, F2H, FFH, 09H, 03H, 90H, F0H ; |y...............|
    DB FFH, 0AH, 03H, 8FH, F8H, FFH, 0BH, 0DH, 8FH, 64H, 69H, 76H, 69H, 64H, 65H, 20H ; |.........divide |
    DB 62H, 79H, 20H, 30H, FFH, 0CH, 03H, 8FH, DBH, FFH, 0DH, 09H, 4FH, 76H, 65H, 72H ; |by 0........Over|
    DB 66H, 6CH, 6FH, 77H, FFH, 0EH, 0EH, 54H, 79H, 70H, 65H, 20H, 6DH, 69H, 73H, 6DH ; |flow...Type mism|
    DB 61H, 74H, 63H, 68H, FFH, 0FH, 18H, 56H, 61H, 72H, 69H, 61H, 62H, 6CH, 65H, 20H ; |atch...Variable |
    DB 64H, 65H, 63H, 6CH, 61H, 72H, 65H, 64H, 20H, 74H, 77H, 69H, 63H, 65H, FFH, 10H ; |declared twice..|
    DB 06H, 91H, 66H, 69H, 6CH, 65H, FFH, 00H, 0FH, 42H, 41H, 53H, 49H, 43H, 20H, 63H ; |..file...BASIC c|
    DB 6FH, 72H, 72H, 75H, 70H, 74H, 65H, 64H, FFH                                  ; |orrupted.|

; Inline strings begin at the return address with a length byte; the helper skips the embedded
; bytes before returning.

; -----------------------------------------------------------------------------
; PRINT INLINE TEXT
; -----------------------------------------------------------------------------
;
; Prints a length-prefixed string embedded immediately after the call site.
;
; The routine takes the return address as a pointer to a length byte, prints that many characters
; through the video device, advances past the inline bytes, and returns using the adjusted
; address. It is the compact mechanism used by error and status messages embedded in ROM code.
;
; Entry:
;   Return address points to a one-byte length followed by text.
;
; Exit:
;   Text is displayed; return address skips the embedded string.
;
; Effects:
;   Writes screen output and changes the effective return address.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
PRINT_INLINE_TEXT:
    DB E3H, CDH, 7FH, FEH, E3H, C9H                                                 ; |......|

; -----------------------------------------------------------------------------
; PRINT LENGTH-PREFIXED TEXT
; -----------------------------------------------------------------------------
;
; Outputs a counted string, interpreting PRINT control characters and special formatting codes.
;
; HL points to a length byte followed by characters. The routine loops through the string, sends
; ordinary characters to the video output, handles CR/LF and special codes, and can format numeric
; values encountered by PRINT's inline control stream. It is shared by error messages, STOP
; reporting, and BASIC PRINT.
;
; Entry:
;   HL = length-prefixed text.
;
; Exit:
;   Text and formatting effects appear on the active output device.
;
; Effects:
;   Calls video/printer output paths and advances HL through the source.
;
; Destroys:
;   AF, BC, DE, HL, alternate registers.
; -----------------------------------------------------------------------------
PRINT_LENGTH_TEXT:
    DB 7EH, 23H, B7H, C8H, C5H, 47H, 7EH, 23H, CDH, 9AH, FEH, 10H, F9H, C1H, C9H, 3EH ; |~#...G~#.......>|
    DB 0BH, CCH, 9AH, FEH, 3EH, 0DH, CDH, 9AH, FEH, 3EH, 0AH, F5H, C5H, D5H, 4FH, CDH ; |....>....>....O.|
    DB A6H, FEH, D7H, D1H, C1H, F1H, C9H, 11H, 7FH, 00H                             ; |..........|

; -----------------------------------------------------------------------------
; PRINT FORMAT DISPATCH
; -----------------------------------------------------------------------------
;
; Handles numeric formatting, separators, and PRINT special-character cases.
;
; This continuation recognizes the PRINT control stream, chooses numeric or string output, inserts
; spaces and line breaks, and routes special tokens through the compact table near FF11H. Decimal
; constants at FF19H support integer column formatting.
;
; Entry:
;   PRINT state and current token/value.
;
; Exit:
;   Formatted output is emitted; flags report line/field status.
;
; Effects:
;   Uses formatting workspace and output device routines.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
PRINT_NUMBER_OR_SPECIAL:
    DB 3AH, 05H, 17H, F6H, 01H, B2H, A3H                                            ; |:......|

; PRINT's continuation chooses numeric, string, separator, and special-token paths while
; preserving the USING cursor between values. A trailing separator changes whether the common
; line-ending path runs.
    DB C3H, 1BH, 00H, CDH, 9AH, FEH, E1H, C3H, F0H, FFH, FDH, CBH, 08H, 7EH, CCH, C7H ; |.............~..|
    DB FEH, CDH, 0EH, F8H, CDH, 7FH, FEH, 3EH, 20H, 18H, CFH, 87H, FEH, 40H, 1FH, CDH ; |.......> ....@..|
    DB 9AH, FEH, FEH, 22H, 20H, 09H, B9H, 28H, 02H, 41H, 0EH, 78H, 0EH, AFH, 4FH, 7EH ; |..." ..(.A.x..O~|
    DB 23H, 3CH, C8H, 3DH, F2H, CBH, FEH, E5H, 0CH, 0DH, F5H, FEH, FBH, 28H, 04H, FEH ; |#<.=.........(..|
    DB FCH, 38H, 02H, 0EH, FFH, FEH, FDH, 20H, 03H, F1H, 0CH, F5H, F1H, 20H, 12H, 2FH ; |.8..... ..... ./|
    DB 21H, 6DH, DEH, CBH, 7EH, 23H, 28H, FBH, 3DH, 20H, F8H, 7EH, 23H, CBH, 7FH, CBH ; |!m..~#(.= .~#...|
    DB BFH, CDH, 9AH, FEH, 28H, F5H, E1H, 18H, C6H                                  ; |....(....|

; Decimal place constants 1000, 100, 10, and 1 support compact integer output.

; -----------------------------------------------------------------------------
; PRINT INTEGER IN HL
; -----------------------------------------------------------------------------
;
; Formats a signed integer in HL as decimal text.
;
; The routine repeatedly subtracts decimal place constants 1000, 100, 10, and 1, suppresses
; leading zeroes, and emits the resulting digits through the text output helper. It is used for
; line numbers and compact integer portions of PRINT output.
;
; Entry:
;   HL = signed integer.
;
; Exit:
;   Decimal digits are emitted.
;
; Effects:
;   Writes output through PRINT_LENGTH_TEXT/VID_CHOUT.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
PRINT_INTEGER_HL:
    DB 06H, FFH, 9FH, E6H, 20H, 4FH                                                 ; |.... O|

; Integer output uses decimal place constants and suppresses leading zeroes before emitting
; digits. This helper is also used for line numbers, so its sign/width behavior affects
; diagnostics as well as PRINT.
    DB E5H, 21H, 47H, FFH, 5EH, 23H, 56H, 23H, E3H, AFH, EDH, 52H, 3CH, 30H, FBH, 19H ; |.!G.^#V#...R<0..|
    DB 3DH, 28H, 07H, 0EH, 30H, 81H, CDH, 9AH, FEH, 79H, A9H, C4H, 9AH, FEH, E3H, 1DH ; |=(..0....y......|

; PRINT special-character dispatch table.
    DB 20H, E2H, E1H, 79H, A0H, 20H, 81H, C9H                                       ; | ..y. ..|

; Binary constants 1000, 100, 10, and 1 for decimal conversion.
    DB E8H, 03H, 64H, 00H, 0AH, 00H, 01H, 00H                                       ; |..d.....|

; The edited BASIC line is accumulated at 1831H, translated to input/token codes, and terminated
; with FFH.

; -----------------------------------------------------------------------------
; READ AND TOKENIZE BASIC LINE
; -----------------------------------------------------------------------------
;
; Invokes the editor to read a command/program line and stores its compact representation in the
; BASIC input buffer.
;
; The routine supplies the editor with the 1831H input buffer, loops for edited characters,
; handles ESC/CTRL+ESC and STOP, translates accepted screen codes into BASIC token/input codes,
; enforces the maximum line length, and terminates the buffer with FFH. The resulting count byte
; and data are ready for the tokenizer and command interpreter.
;
; Entry:
;   Editor and keyboard state; destination buffer at 1831H.
;
; Exit:
;   BASIC input buffer contains length-prefixed tokenizable line; A=00H on success.
;
; Effects:
;   Uses the editor, writes the BASIC input buffer, and may return STOP/error status.
;
; Destroys:
;   AF, BC, DE, HL.
; -----------------------------------------------------------------------------
BASIC_LINE_INPUT:
    LD HL,1831H
    PUSH HL
    LD B,00H

LFF55:
    PUSH BC
    LD DE,80FFH
    DB CDH                                                                          ; |.|

; Line input stores editor results in the 1831H buffer, translates accepted character codes,
; bounds the count, and appends FFH. CTRL+ESC and editor end/error status must terminate the
; acquisition before tokenization.
    XOR C
    CP D1H
    LD B,D
    JR Z,FF72H

LFF60:
    POP HL
    LD B,00H
    LD (HL),B
    INC HL
    LD (HL),FFH
    DEC HL
    CP F5H
    JR Z,FF9BH
    CP ECH
    JR Z,FF9BH
    OR A
    RST 10H

LFF72:
    LD A,(0B16H)
    OR A
    LD A,F5H
    JR NZ,FF60H
    LD A,C
    CP 0DH
    JR Z,FF92H
    CP 20H
    JR C,FF55H
    SUB 80H
    JR C,FF8CH
    CP 20H
    JR NC,FF8CH
    LD C,A

LFF8C:
    LD A,B
    CP FBH
    JR NC,FF55H
    INC B

LFF92:
    INC HL
    LD (HL),C
    JR NZ,FF55H
    LD (HL),FFH
    XOR A
    POP HL
    LD (HL),B

LFF9B:
    OR A
    RET

; STOP-FLAG at 0B16H is polled by long-running routines; CTRL+ESC clears it and enters STOP
; reporting.

; -----------------------------------------------------------------------------
; STOP AND CTRL-ESC HANDLER
; -----------------------------------------------------------------------------
;
; Checks STOP-FLAG and reports STOP with the current BASIC line context.
;
; A zero STOP-FLAG returns immediately. When CTRL+ESC has set 0B16H, the routine clears the flag,
; restores the interpreter/output state, prints STOP and the current line information, and returns
; to the command loop. The same path is used by long-running numeric, I/O, and tape operations
; that poll for user interruption.
;
; Entry:
;   STOP-FLAG at 0B16H and current BASIC interpreter context.
;
; Exit:
;   Returns when no stop is pending; otherwise resumes BASIC after STOP handling.
;
; Effects:
;   Clears STOP-FLAG and emits STOP/line output.
;
; Destroys:
;   AF, BC, DE, HL, interpreter temporaries.
; -----------------------------------------------------------------------------
CHECK_STOP_FLAG:
    LD A,(0B16H)
    OR A
    RET Z
    EXX

; STOP routine.
    EXX

; STOP polling is intentionally cheap: a zero byte returns immediately. When set, it is cleared
; before STOP text and line context are printed, preventing an old CTRL+ESC event from
; retriggering after CONTINUE.

LFFA4:
    XOR A
    LD (0B16H),A
    CALL FC35H
    CALL FC18H
    CALL FE79H

; "STOP" message text.
    DB 06H, 0DH, 0AH, 53H, 54H, 4FH, 50H, DDH, CBH, 00H, 56H, 28H, 22H, 22H, 10H, 17H ; |...STOP...V(""..|
    DB 2AH, 0CH, 17H, 22H, 0EH, 17H, CDH, 79H, FEH                                  ; |*.."...y.|

; " at line " message text.
    DB 09H, 20H, 61H, 74H, 20H, 6CH, 69H, 6EH, 65H, 20H, 2AH, 0CH, 17H, 23H, 5EH, 23H ; |. at line *..#^#|
    DB 56H, EBH, B7H, CDH, 19H, FFH, AFH, CDH, 8EH, FEH, C3H, DAH, DAH, 7CH, FEH, C0H ; |V............|..|
    RET C
    RES 6,H
    DB 3EH, 50H, C9H                                                                ; |>P.|

; Extension gateway mapping: EXTH occupies page 3 and SYS is restored in page 0 before JP (HL).
; The extension bridge changes the page map before JP (HL): EXTH is selected in the high extension
; window while SYS remains available in page 0. Callers must treat the target's mapping and return
; convention as part of the ABI.

; -----------------------------------------------------------------------------
; BRIDGE TO EXTENSION ROM
; -----------------------------------------------------------------------------
;
; Switches the memory map and jumps to an EXTH routine addressed by HL.
;
; This fixed gateway saves AF, maps EXTH into page 3 and SYS into page 0 through port 02H,
; restores AF, and performs JP (HL). It is the standard bridge for BASIC and system code that
; needs extension-ROM services while preserving the U0-resident call convention.
;
; Entry:
;   HL = target address in the extension ROM mapping.
;
; Exit:
;   Control transfers to HL with EXTH selected in page 3 and SYS in page 0.
;
; Effects:
;   Changes memory paging; does not return unless the extension target returns through its own
;   convention.
;
; Destroys:
;   Memory mapping and normal return assumptions; AF is restored before the jump.
; -----------------------------------------------------------------------------
CALL_EXTENSION_HL:
    DB F5H, 3EH, F0H, 32H, 03H, 00H, D3H, 02H, F1H, E9H, 79H, FEH, 0DH, 28H, 13H, FEH ; |.>.2......y..(..|
