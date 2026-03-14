/**
 * Static completion candidates for the Z80 Assembly language that do NOT
 * depend on compilation output (instructions, registers, pragmas, directives).
 *
 * Each entry carries enough metadata for Monaco's CompletionItemProvider
 * (resolved in Phase 4) to build a rich completion item.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompletionKind = "instruction" | "register" | "pragma" | "directive" | "keyword";

export type StaticCompletionItem = {
  /** The text shown in the completion list and inserted. */
  readonly label: string;
  /** Category for the Monaco icon / sort group. */
  readonly kind: CompletionKind;
  /** Short one-line description displayed in the completion tooltip. */
  readonly detail: string;
  /**
   * Text to insert.  Uses Monaco snippet syntax: `$1`, `${1:placeholder}`, etc.
   * Falls back to `label` when omitted.
   */
  readonly insertText?: string;
  /** True when this is a ZX Spectrum Next extension opcode. */
  readonly next?: boolean;
};

// ---------------------------------------------------------------------------
// Z80 instruction mnemonics
// ---------------------------------------------------------------------------

const instructions: StaticCompletionItem[] = [
  // A
  { label: "adc", kind: "instruction", detail: "Add with carry", insertText: "adc ${1:dst}, ${2:src}" },
  { label: "add", kind: "instruction", detail: "Add", insertText: "add ${1:dst}, ${2:src}" },
  { label: "and", kind: "instruction", detail: "Logical AND with A", insertText: "and ${1:src}" },
  // B
  { label: "bit", kind: "instruction", detail: "Test bit", insertText: "bit ${1:b}, ${2:r}" },
  // C
  { label: "call", kind: "instruction", detail: "Call subroutine", insertText: "call ${1:addr}" },
  { label: "ccf",  kind: "instruction", detail: "Complement carry flag" },
  { label: "cp",   kind: "instruction", detail: "Compare A with operand", insertText: "cp ${1:src}" },
  { label: "cpd",  kind: "instruction", detail: "Compare and decrement" },
  { label: "cpdr", kind: "instruction", detail: "Compare, decrement and repeat" },
  { label: "cpi",  kind: "instruction", detail: "Compare and increment" },
  { label: "cpir", kind: "instruction", detail: "Compare, increment and repeat" },
  { label: "cpl",  kind: "instruction", detail: "Complement A" },
  // D
  { label: "daa",  kind: "instruction", detail: "Decimal adjust A" },
  { label: "dec",  kind: "instruction", detail: "Decrement", insertText: "dec ${1:r}" },
  { label: "di",   kind: "instruction", detail: "Disable interrupts" },
  { label: "djnz", kind: "instruction", detail: "Decrement B and jump if non-zero", insertText: "djnz ${1:offset}" },
  // E
  { label: "ei",   kind: "instruction", detail: "Enable interrupts" },
  { label: "ex",   kind: "instruction", detail: "Exchange registers", insertText: "ex ${1:r1}, ${2:r2}" },
  { label: "exx",  kind: "instruction", detail: "Exchange BC/DE/HL with shadows" },
  // H
  { label: "halt", kind: "instruction", detail: "Halt processor" },
  // I
  { label: "im",   kind: "instruction", detail: "Set interrupt mode", insertText: "im ${1:mode}" },
  { label: "in",   kind: "instruction", detail: "Input from port", insertText: "in ${1:r}, (${2:port})" },
  { label: "inc",  kind: "instruction", detail: "Increment", insertText: "inc ${1:r}" },
  { label: "ind",  kind: "instruction", detail: "Input and decrement" },
  { label: "indr", kind: "instruction", detail: "Input, decrement and repeat" },
  { label: "ini",  kind: "instruction", detail: "Input and increment" },
  { label: "inir", kind: "instruction", detail: "Input, increment and repeat" },
  // J
  { label: "jp",   kind: "instruction", detail: "Unconditional/conditional jump", insertText: "jp ${1:addr}" },
  { label: "jr",   kind: "instruction", detail: "Relative jump", insertText: "jr ${1:offset}" },
  // L
  { label: "ld",   kind: "instruction", detail: "Load / move", insertText: "ld ${1:dst}, ${2:src}" },
  { label: "ldd",  kind: "instruction", detail: "Load and decrement" },
  { label: "lddr", kind: "instruction", detail: "Load, decrement and repeat" },
  { label: "ldi",  kind: "instruction", detail: "Load and increment" },
  { label: "ldir", kind: "instruction", detail: "Load, increment and repeat" },
  // N
  { label: "neg",  kind: "instruction", detail: "Negate A" },
  { label: "nop",  kind: "instruction", detail: "No operation" },
  // O
  { label: "or",   kind: "instruction", detail: "Logical OR with A", insertText: "or ${1:src}" },
  { label: "otdr", kind: "instruction", detail: "Output, decrement and repeat" },
  { label: "otir", kind: "instruction", detail: "Output, increment and repeat" },
  { label: "out",  kind: "instruction", detail: "Output to port", insertText: "out (${1:port}), ${2:r}" },
  { label: "outd", kind: "instruction", detail: "Output and decrement" },
  { label: "outi", kind: "instruction", detail: "Output and increment" },
  // P
  { label: "pop",  kind: "instruction", detail: "Pop from stack", insertText: "pop ${1:rr}" },
  { label: "push", kind: "instruction", detail: "Push to stack", insertText: "push ${1:rr}" },
  // R
  { label: "res",  kind: "instruction", detail: "Reset bit", insertText: "res ${1:b}, ${2:r}" },
  { label: "ret",  kind: "instruction", detail: "Return from subroutine" },
  { label: "reti", kind: "instruction", detail: "Return from interrupt" },
  { label: "retn", kind: "instruction", detail: "Return from NMI" },
  { label: "rl",   kind: "instruction", detail: "Rotate left through carry", insertText: "rl ${1:r}" },
  { label: "rla",  kind: "instruction", detail: "Rotate A left through carry" },
  { label: "rlc",  kind: "instruction", detail: "Rotate left circular", insertText: "rlc ${1:r}" },
  { label: "rlca", kind: "instruction", detail: "Rotate A left circular" },
  { label: "rld",  kind: "instruction", detail: "Rotate left digit (BCD)" },
  { label: "rr",   kind: "instruction", detail: "Rotate right through carry", insertText: "rr ${1:r}" },
  { label: "rra",  kind: "instruction", detail: "Rotate A right through carry" },
  { label: "rrc",  kind: "instruction", detail: "Rotate right circular", insertText: "rrc ${1:r}" },
  { label: "rrca", kind: "instruction", detail: "Rotate A right circular" },
  { label: "rrd",  kind: "instruction", detail: "Rotate right digit (BCD)" },
  { label: "rst",  kind: "instruction", detail: "Restart (call fixed address)", insertText: "rst ${1:addr}" },
  // S
  { label: "sbc",  kind: "instruction", detail: "Subtract with carry", insertText: "sbc ${1:dst}, ${2:src}" },
  { label: "scf",  kind: "instruction", detail: "Set carry flag" },
  { label: "set",  kind: "instruction", detail: "Set bit", insertText: "set ${1:b}, ${2:r}" },
  { label: "sla",  kind: "instruction", detail: "Shift left arithmetic", insertText: "sla ${1:r}" },
  { label: "sll",  kind: "instruction", detail: "Shift left logical (undocumented)", insertText: "sll ${1:r}" },
  { label: "sra",  kind: "instruction", detail: "Shift right arithmetic", insertText: "sra ${1:r}" },
  { label: "srl",  kind: "instruction", detail: "Shift right logical", insertText: "srl ${1:r}" },
  { label: "sub",  kind: "instruction", detail: "Subtract", insertText: "sub ${1:src}" },
  // X
  { label: "xor",  kind: "instruction", detail: "Logical XOR with A", insertText: "xor ${1:src}" },

  // --- ZX Spectrum Next extended instructions
  { label: "brlc",    kind: "instruction", detail: "Barrel shift left circular (Next)", next: true },
  { label: "bsla",    kind: "instruction", detail: "Barrel shift left arithmetic (Next)", next: true },
  { label: "bsra",    kind: "instruction", detail: "Barrel shift right arithmetic (Next)", next: true },
  { label: "bsrf",    kind: "instruction", detail: "Barrel shift right fill ones (Next)", next: true },
  { label: "bsrl",    kind: "instruction", detail: "Barrel shift right logical (Next)", next: true },
  { label: "lddrx",   kind: "instruction", detail: "Load, decrement and repeat with exclusion (Next)", next: true },
  { label: "lddx",    kind: "instruction", detail: "Load and decrement with exclusion (Next)", next: true },
  { label: "ldirx",   kind: "instruction", detail: "Load, increment and repeat with exclusion (Next)", next: true },
  { label: "ldix",    kind: "instruction", detail: "Load and increment with exclusion (Next)", next: true },
  { label: "ldpirx",  kind: "instruction", detail: "Load from port indirect with repetition (Next)", next: true },
  { label: "ldws",    kind: "instruction", detail: "Load with stride (Next)", next: true },
  { label: "mirror",  kind: "instruction", detail: "Mirror bits of A (Next)", next: true },
  { label: "mul",     kind: "instruction", detail: "Unsigned multiply D*E → DE (Next)", next: true },
  { label: "nextreg", kind: "instruction", detail: "Write Next register", insertText: "nextreg ${1:reg}, ${2:val}", next: true },
  { label: "outinb",  kind: "instruction", detail: "Output to port (BC), increment B (Next)", next: true },
  { label: "pixelad", kind: "instruction", detail: "Pixel address calculation (Next)", next: true },
  { label: "pixeldn", kind: "instruction", detail: "Pixel address down (Next)", next: true },
  { label: "setae",   kind: "instruction", detail: "Set bits in A from E (Next)", next: true },
  { label: "swapnib", kind: "instruction", detail: "Swap nibbles of A (Next)", next: true },
  { label: "test",    kind: "instruction", detail: "Test bits of A (Next)", insertText: "test ${1:n}", next: true },
];

// ---------------------------------------------------------------------------
// Registers
// ---------------------------------------------------------------------------

const registers: StaticCompletionItem[] = [
  // 8-bit general-purpose
  { label: "a",  kind: "register", detail: "Accumulator (8-bit)" },
  { label: "b",  kind: "register", detail: "General-purpose register (8-bit)" },
  { label: "c",  kind: "register", detail: "General-purpose / port register (8-bit)" },
  { label: "d",  kind: "register", detail: "General-purpose register (8-bit)" },
  { label: "e",  kind: "register", detail: "General-purpose register (8-bit)" },
  { label: "h",  kind: "register", detail: "High byte of HL (8-bit)" },
  { label: "l",  kind: "register", detail: "Low byte of HL (8-bit)" },
  // 8-bit special
  { label: "i",  kind: "register", detail: "Interrupt vector base register" },
  { label: "r",  kind: "register", detail: "Memory refresh register" },
  // 8-bit index
  { label: "xh", kind: "register", detail: "High byte of IX (undocumented)" },
  { label: "xl", kind: "register", detail: "Low byte of IX (undocumented)" },
  { label: "yh", kind: "register", detail: "High byte of IY (undocumented)" },
  { label: "yl", kind: "register", detail: "Low byte of IY (undocumented)" },
  // 16-bit
  { label: "hl", kind: "register", detail: "16-bit register pair HL" },
  { label: "bc", kind: "register", detail: "16-bit register pair BC" },
  { label: "de", kind: "register", detail: "16-bit register pair DE" },
  { label: "sp", kind: "register", detail: "Stack pointer (16-bit)" },
  { label: "ix", kind: "register", detail: "Index register IX (16-bit)" },
  { label: "iy", kind: "register", detail: "Index register IY (16-bit)" },
  // Special
  { label: "af",  kind: "register", detail: "Accumulator + flags pair" },
  { label: "af'", kind: "register", detail: "Shadow accumulator + flags pair" },
];

// ---------------------------------------------------------------------------
// Pragmas / assembler directives (dot or bare keyword forms)
// ---------------------------------------------------------------------------

const pragmas: StaticCompletionItem[] = [
  { label: ".org",        kind: "pragma", detail: "Set origin address",              insertText: ".org ${1:address}" },
  { label: ".bank",       kind: "pragma", detail: "Set bank",                        insertText: ".bank ${1:n}" },
  { label: ".xorg",       kind: "pragma", detail: "Set extra origin",                insertText: ".xorg ${1:address}" },
  { label: ".ent",        kind: "pragma", detail: "Set entry point",                 insertText: ".ent ${1:address}" },
  { label: ".xent",       kind: "pragma", detail: "Set extra entry point",           insertText: ".xent ${1:address}" },
  { label: ".equ",        kind: "pragma", detail: "Define constant",                 insertText: ".equ ${1:value}" },
  { label: ".var",        kind: "pragma", detail: "Define variable",                 insertText: ".var ${1:value}" },
  { label: ".disp",       kind: "pragma", detail: "Set displacement",                insertText: ".disp ${1:offset}" },
  { label: ".db",         kind: "pragma", detail: "Define byte(s)",                  insertText: ".db ${1:bytes}" },
  { label: ".dw",         kind: "pragma", detail: "Define word(s)",                  insertText: ".dw ${1:words}" },
  { label: ".dm",         kind: "pragma", detail: "Define message (string bytes)",   insertText: ".dm \"${1:text}\"" },
  { label: ".ds",         kind: "pragma", detail: "Define space",                    insertText: ".ds ${1:size}" },
  { label: ".defb",       kind: "pragma", detail: "Define byte(s) (long form)",      insertText: ".defb ${1:bytes}" },
  { label: ".defw",       kind: "pragma", detail: "Define word(s) (long form)",      insertText: ".defw ${1:words}" },
  { label: ".defm",       kind: "pragma", detail: "Define string bytes (long form)", insertText: ".defm \"${1:text}\"" },
  { label: ".defn",       kind: "pragma", detail: "Define null-terminated string",   insertText: ".defn \"${1:text}\"" },
  { label: ".defh",       kind: "pragma", detail: "Define hex string bytes",         insertText: ".defh ${1:hexbytes}" },
  { label: ".defg",       kind: "pragma", detail: "Define graphic pattern",          insertText: ".defg ${1:pattern}" },
  { label: ".defgx",      kind: "pragma", detail: "Define extended graphic pattern", insertText: ".defgx ${1:pattern}" },
  { label: ".defc",       kind: "pragma", detail: "Define char codes",               insertText: ".defc \"${1:chars}\"" },
  { label: ".skip",       kind: "pragma", detail: "Skip bytes",                      insertText: ".skip ${1:count}" },
  { label: ".extern",     kind: "pragma", detail: "Declare external symbol",         insertText: ".extern ${1:name}" },
  { label: ".defs",       kind: "pragma", detail: "Define space (long form)",        insertText: ".defs ${1:size}" },
  { label: ".fillb",      kind: "pragma", detail: "Fill with byte value",            insertText: ".fillb ${1:count}, ${2:value}" },
  { label: ".fillw",      kind: "pragma", detail: "Fill with word value",            insertText: ".fillw ${1:count}, ${2:value}" },
  { label: ".model",      kind: "pragma", detail: "Set model type" },
  { label: ".align",      kind: "pragma", detail: "Align to boundary",               insertText: ".align ${1:boundary}" },
  { label: ".trace",      kind: "pragma", detail: "Emit trace value",                insertText: ".trace ${1:expr}" },
  { label: ".tracehex",   kind: "pragma", detail: "Emit trace value (hex)",          insertText: ".tracehex ${1:expr}" },
  { label: ".rndseed",    kind: "pragma", detail: "Set random seed",                 insertText: ".rndseed ${1:seed}" },
  { label: ".error",      kind: "pragma", detail: "Emit assembler error",            insertText: ".error \"${1:message}\"" },
  { label: ".includebin", kind: "pragma", detail: "Include binary file",             insertText: ".includebin \"${1:file}\"" },
  { label: ".comparebin", kind: "pragma", detail: "Compare binary file",             insertText: ".comparebin \"${1:file}\"" },
  { label: ".injectopt",  kind: "pragma", detail: "Inject compiler option" },
  { label: ".onsuccess",  kind: "pragma", detail: "Run on successful compilation" },
  { label: ".onerror",    kind: "pragma", detail: "Run on compilation error" },
  { label: ".savenex",    kind: "pragma", detail: "Save .nex output file" },
];

// ---------------------------------------------------------------------------
// Structural / control-flow keywords
// ---------------------------------------------------------------------------

const keywords: StaticCompletionItem[] = [
  { label: ".macro",     kind: "keyword", detail: "Define a macro",            insertText: "${1:Name}: .macro(${2:params})\n\t$3\n.endm" },
  { label: ".endm",      kind: "keyword", detail: "End macro definition" },
  { label: ".proc",      kind: "keyword", detail: "Begin procedure",           insertText: "${1:Name}: .proc\n\t$2\n.endp" },
  { label: ".endp",      kind: "keyword", detail: "End procedure" },
  { label: ".loop",      kind: "keyword", detail: "Begin loop",                insertText: ".loop ${1:count}\n\t$2\n.endl" },
  { label: ".endl",      kind: "keyword", detail: "End loop" },
  { label: ".repeat",    kind: "keyword", detail: "Begin repeat…until block",  insertText: ".repeat\n\t$1\n.until ${2:condition}" },
  { label: ".until",     kind: "keyword", detail: "End repeat block" },
  { label: ".while",     kind: "keyword", detail: "Begin while loop",          insertText: ".while ${1:condition}\n\t$2\n.endw" },
  { label: ".endw",      kind: "keyword", detail: "End while loop" },
  { label: ".if",        kind: "keyword", detail: "Conditional assembly",      insertText: ".if ${1:condition}\n\t$2\n.endif" },
  { label: ".elif",      kind: "keyword", detail: "Else-if branch" },
  { label: ".else",      kind: "keyword", detail: "Else branch" },
  { label: ".endif",     kind: "keyword", detail: "End conditional" },
  { label: ".ifused",    kind: "keyword", detail: "Conditional: if symbol used" },
  { label: ".ifnused",   kind: "keyword", detail: "Conditional: if symbol not used" },
  { label: ".for",       kind: "keyword", detail: "For loop",                  insertText: ".for ${1:var} = ${2:from} to ${3:to}\n\t$4\n.next" },
  { label: ".next",      kind: "keyword", detail: "End for loop" },
  { label: ".break",     kind: "keyword", detail: "Break out of loop" },
  { label: ".continue",  kind: "keyword", detail: "Continue loop" },
  { label: ".module",    kind: "keyword", detail: "Begin module scope",        insertText: "${1:Name}: .module\n\t$2\n.endmodule" },
  { label: ".endmodule", kind: "keyword", detail: "End module scope" },
  { label: ".struct",    kind: "keyword", detail: "Define structure",          insertText: "${1:Name}:\n.struct\n\t$2\n.ends" },
  { label: ".ends",      kind: "keyword", detail: "End structure definition" },
];

// ---------------------------------------------------------------------------
// Preprocessor directives
// ---------------------------------------------------------------------------

const directives: StaticCompletionItem[] = [
  { label: "#ifdef",   kind: "directive", detail: "Conditional: if symbol defined",     insertText: "#ifdef ${1:SYMBOL}\n\t$2\n#endif" },
  { label: "#ifndef",  kind: "directive", detail: "Conditional: if symbol not defined", insertText: "#ifndef ${1:SYMBOL}\n\t$2\n#endif" },
  { label: "#if",      kind: "directive", detail: "Conditional: if expression",         insertText: "#if ${1:condition}\n\t$2\n#endif" },
  { label: "#ifmod",   kind: "directive", detail: "Conditional: if model match" },
  { label: "#ifnmod",  kind: "directive", detail: "Conditional: if model not match" },
  { label: "#else",    kind: "directive", detail: "Else branch" },
  { label: "#endif",   kind: "directive", detail: "End conditional" },
  { label: "#define",  kind: "directive", detail: "Define symbol",                      insertText: "#define ${1:SYMBOL}" },
  { label: "#undef",   kind: "directive", detail: "Undefine symbol",                    insertText: "#undef ${1:SYMBOL}" },
  { label: "#include", kind: "directive", detail: "Include source file",                insertText: "#include \"${1:file.asm}\"" },
  { label: "#line",    kind: "directive", detail: "Override source line information",   insertText: "#line ${1:lineNo}" },
];

// ---------------------------------------------------------------------------
// Block snippet templates
// ---------------------------------------------------------------------------

const snippets: StaticCompletionItem[] = [
  { label: ".macro\u2026endm",        kind: "snippet", detail: "Macro block skeleton",            insertText: "${1:Name}: .macro(${2:params})\n\t$3\n.endm" },
  { label: ".proc\u2026endp",         kind: "snippet", detail: "Procedure block skeleton",        insertText: "${1:Name}: .proc\n\t$2\n.endp" },
  { label: ".loop\u2026endl",         kind: "snippet", detail: "Loop N-times block skeleton",     insertText: ".loop ${1:count}\n\t$2\n.endl" },
  { label: ".repeat\u2026until",      kind: "snippet", detail: "Repeat\u2026until block skeleton", insertText: ".repeat\n\t$1\n.until ${2:condition}" },
  { label: ".while\u2026endw",        kind: "snippet", detail: "While loop block skeleton",       insertText: ".while ${1:condition}\n\t$2\n.endw" },
  { label: ".for\u2026next",          kind: "snippet", detail: "For loop block skeleton",         insertText: ".for ${1:var} = ${2:from} .to ${3:to}\n\t$4\n.next" },
  { label: ".struct\u2026ends",       kind: "snippet", detail: "Structure definition skeleton",   insertText: "${1:Name}: .struct\n\t$2\n.ends" },
  { label: ".module\u2026endmodule",  kind: "snippet", detail: "Module scope skeleton",           insertText: "${1:Name}: .module\n\t$2\n.endmodule" },
  { label: ".if\u2026endif",          kind: "snippet", detail: "If block skeleton",               insertText: ".if ${1:condition}\n\t$2\n.endif" },
  { label: ".if\u2026else\u2026endif",kind: "snippet", detail: "If/else block skeleton",          insertText: ".if ${1:condition}\n\t$2\n.else\n\t$3\n.endif" },
  { label: "#ifdef\u2026endif",       kind: "snippet", detail: "#ifdef block skeleton",           insertText: "#ifdef ${1:SYMBOL}\n\t$2\n#endif" },
  { label: "#ifndef\u2026endif",      kind: "snippet", detail: "#ifndef block skeleton",          insertText: "#ifndef ${1:SYMBOL}\n\t$2\n#endif" },
  { label: "#if\u2026endif",          kind: "snippet", detail: "#if block skeleton",              insertText: "#if ${1:condition}\n\t$2\n#endif" },
];

// ---------------------------------------------------------------------------
// Combined export
// ---------------------------------------------------------------------------

/** All static completion items for Z80 Assembly. */
export const Z80_COMPLETION_ITEMS: readonly StaticCompletionItem[] = [
  ...instructions,
  ...registers,
  ...pragmas,
  ...keywords,
  ...directives
];

/** Only Z80 instruction mnemonic completion items. */
export const Z80_INSTRUCTION_ITEMS: readonly StaticCompletionItem[] = instructions;

/** Only register completion items. */
export const Z80_REGISTER_ITEMS: readonly StaticCompletionItem[] = registers;

/** Only pragma completion items. */
export const Z80_PRAGMA_ITEMS: readonly StaticCompletionItem[] = pragmas;

/** Only keyword (structural) completion items. */
export const Z80_KEYWORD_ITEMS: readonly StaticCompletionItem[] = keywords;

/** Only preprocessor directive completion items. */
export const Z80_DIRECTIVE_ITEMS: readonly StaticCompletionItem[] = directives;
