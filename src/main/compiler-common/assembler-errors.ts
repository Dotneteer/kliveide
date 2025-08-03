export type ErrorCodes =
  // --- Z80 Compiler Error Codes
  // --- Missing or faulty tokens
  | "Z0001"
  | "Z0002"
  | "Z0003"
  | "Z0004"
  | "Z0005"
  | "Z0006"
  | "Z0007"
  | "Z0008"

  // --- Missing or faulty language elements
  | "Z0101"
  | "Z0102"
  | "Z0103"
  | "Z0104"
  | "Z0105"
  | "Z0106"
  | "Z0107"
  | "Z0108"
  | "Z0109"
  | "Z0110"
  | "Z0111"
  | "Z0112"
  | "Z0113"
  | "Z0114"

  // --- Directive error messages
  | "Z0201"
  | "Z0202"
  | "Z0203"
  | "Z0204"
  | "Z0205"
  | "Z0206"
  | "Z0207"
  | "Z0208"

  // --- Pragma messages
  | "Z0302"
  | "Z0303"
  | "Z0304"
  | "Z0305"
  | "Z0306"
  | "Z0307"
  | "Z0308"
  | "Z0309"
  | "Z0310"
  | "Z0311"
  | "Z0312"
  | "Z0313"
  | "Z0314"
  | "Z0315"
  | "Z0316"
  | "Z0317"
  | "Z0318"
  | "Z0319"
  | "Z0320"
  | "Z0321"
  | "Z0322"
  | "Z0323"
  | "Z0324"
  | "Z0325"
  | "Z0326"
  | "Z0327"
  | "Z0328"
  | "Z0329"
  | "Z0330"

  // --- Instructions
  | "Z0401"
  | "Z0402"
  | "Z0403"
  | "Z0404"
  | "Z0405"
  | "Z0406"
  | "Z0407"
  | "Z0408"
  | "Z0409"
  | "Z0410"
  | "Z0411"
  | "Z0412"
  | "Z0413"
  | "Z0414"

  // --- Labels and symbols
  | "Z0501"
  | "Z0502"
  | "Z0503"
  | "Z0504"
  | "Z0505"

  // --- Expressions and operands
  | "Z0601"
  | "Z0602"
  | "Z0603"
  | "Z0604"
  | "Z0605"
  | "Z0606"

  // --- Statements
  | "Z0701"
  | "Z0702"
  | "Z0703"
  | "Z0704"
  | "Z0705"
  | "Z0706"
  | "Z0707"
  | "Z0708"
  | "Z0709"

  // --- Structs
  | "Z0801"
  | "Z0802"
  | "Z0803"
  | "Z0804"
  | "Z0805"
  | "Z0806"
  | "Z0807"
  | "Z0808"
  | "Z0809"
  | "Z0810"

  // --- Modules
  | "Z0901"
  | "Z0902"
  | "Z0903"

  // --- Macros
  | "Z1001"
  | "Z1002"
  | "Z1003"
  | "Z1004"
  | "Z1005"
  | "Z1006"
  | "Z1007"
  | "Z1008"
  | "Z1009"
  | "Z1010"
  | "Z1011"
  | "Z1012"
  | "Z1013"
  | "Z1014"

  // --- Others
  | "Z2000"

  // --- M6510 Compiler Error Codes
  | "M1001"
  | "M1002"
  | "M1003"
  | "M1004"
  | "M1005"
  | "M1006"
  | "M1007"
  | "M1008";

export const errorMessages: Record<string, string> = {
  // --- Missing or faulty tokens
  Z0001: "Invalid token at the end of the line: {0}",
  Z0002: "A line cannot start with this token: {0}",
  Z0003: "A comma expected",
  Z0004: "'(' expected",
  Z0005: "')' expected",
  Z0006: "'}}' expected",
  Z0007: "'=' expected",
  Z0008: "'to' expected",

  // --- Missing or faulty language elements
  Z0101: "Register A expected",
  Z0102: "Register B expected",
  Z0103: "Register DE expected",
  Z0104: "Register D expected",
  Z0105: "Register E expected",
  Z0106: "BC, DE, HL, or SP expected",
  Z0107: "An identifier expected",
  Z0108: "A string literal expected",
  Z0109: "The lreg and hreg functions accept only a bc, de, hl, ix, or iy as their argument.",
  Z0110: "A byte-emitting pragma expected",
  Z0111: "An expression expected",
  Z0112: "A mnemonic, a register, or a register indirection expression expected.",
  Z0113: "Operand expected",
  Z0114: "Cannot parse an integer literal",

  // --- Directive error messages
  Z0201: "Cannot find include file: '{0}'",
  Z0202: "Include file '{0}' is included more than once into the same parent source file",
  Z0203: "Include file '{0}' causes circular file reference",
  Z0204: "Error reading include file: '{0}' ({1})",
  Z0205: "Missing #endif directive",
  Z0206:
    "An #ifmod or #ifnmod directive cen be used only with these identifiers: 'SPECTRUM48', 'SPECTRUM128', 'SPECTRUMP3', 'NEXT'.",
  Z0207: "Unexpected #else directive",
  Z0208: "Unexpected #endif directive",

  // --- Pragma messages
  Z0302: "A .model pragma can be used only once.",
  Z0303:
    "A .model pragma can have only these values: 'SPECTRUM48', 'SPECTRUM128', 'SPECTRUMP3', 'NEXT'.",
  Z0304: "An .equ pragma must have a label",
  Z0305: "The .bank pragma cannot have a label.",
  Z0306: "The .bank pragma's value must be between 0 and 7.",
  Z0307: "The .bank pragma's offset value must be between 0 and #03fff.",
  Z0308: "The .bank pragma cannot be used with the current model type.",
  Z0309: "You have already used the .bank pragma for bank {0}.",
  Z0310: "The {0} pragma can be used only in the global scope.",
  Z0311: "A .var pragma must have a label",
  Z0312: "A .var pragma cannot redefine a non-.var-created symbol",
  Z0313: ".skip to {0} is invalid, as this address is less then the current address, {1}",
  Z0314: "Only one .xorg pragma can be used within a code segment.",
  Z0315: ".defm/.defn pragma requires a string argument.",
  Z0316: ".defh pragma requires a string argument.",
  Z0317: ".defh pragma requires a string with even hexadecimal digits.",
  Z0318:
    ".align pragma must be used with a parameter value between 1 and #4000; {0} is an invalid value.",
  Z0319: ".includebin pragma requires a string argument.",
  Z0320: "Invalid .includebin offset value (negative, or greater than the file length).",
  Z0321: "Invalid .includebin length value (negative, or segment exceends the file length).",
  Z0322: "Cannot open file '{0}' used in .includebin pragma ({0}).",
  Z0323: "Emitting the .includebin segment would overflow the current segment.",
  Z0324: ".defgx pragma requires a string argument.",
  Z0325: "Cannot use an empty pattern with .defg/.defgx pragma.",
  Z0326: "The .comparebin pragma expects a string as its first argument.",
  Z0327: "Invalid .comparebin offset value (negative, or greater than the file length).",
  Z0328: "Invalid .comparebin length value (negative, or segment exceends the file length).",
  Z0329: "Cannot open file '{0}' used in .comparebin pragma ({1}).",
  Z0330: ".comparebin fails: {0}.",

  // --- Instructions
  Z0401: "Unexpected error when emitting code for mnemonic '{0}'.",
  Z0402: "The jr instructions cannot be used with the pe, po, p, or m conditions.",
  Z0403: "Relative jump distance should be between -128 and 127. {0} is invalid.",
  Z0404:
    "The rst instruction can be used only with #00, #08, #10, #18, #20, #28, #30, or #38 arguments. #{0} is invalid.",
  Z0405: "Interrupt mode can only be 0, 1, or 2. '{0}' is invalid.",
  Z0406: "Output value can only be 0",
  Z0407: "Bit index should be between 0 and 7. '{0}' is invalid",
  Z0408: "The first operand must be 'a' when using the two-argument form of the ALU operation.",
  Z0409: "The first argument of an 8-bit ALU operation can only be 'a'.",
  Z0410: "The current assembly address overflew $FFFF",
  Z0411: "The emitted code overflows the segment/bank.",
  Z0412: "The pop instruction cannot be used with an expression operand",
  Z0413: "The push and pop instructions can use only these registers: af, bc, de, hl, ix, and iy.",
  Z0414:
    "To use this Spectrum Next-specific instruction, you need to set .model type to NEXT explicitly.",

  // --- Labels and symbols
  Z0501: "Label '{0}' is already defined",
  Z0502: "Variable {0} is already declared, it cannot be used as a .for-loop variable again.",
  Z0503: "The {0} section in .if/.ifused/.ifnused cannot have a label.",
  Z0504: "You cannot define a local symbol with a temporary name ({0}).",
  Z0505: "This local symbol is already declared: ({0}).",

  // --- Expressions and operands
  Z0601: "A string value is used where a numeric value is expected.",
  Z0602: "An integral value is expected.",
  Z0603: "A numeric expression expected.",
  Z0604: "Invalid operand",
  Z0605: "Identifier '{0}' is not defined yet.",
  Z0606: "Expression evaluation error: {0}",

  // --- Statements
  Z0701: "Missing end statement for {0}.",
  Z0702: "Loop counter cannot be greater than 65535 (#FFFF).",
  Z0703: "Too many errors detected while compiling a loop, further processing aborted.",
  Z0704: "Orphan '{0}' statement found without a corresponding '{1}' statement.",
  Z0705: "$CNT cannot be used outside of loop constructs.",
  Z0706: "The .step value in a .for-loop cannot be zero.",
  Z0707: ".break cannot be used outside of loop constructs.",
  Z0708: ".continue cannot be used outside of loop constructs.",
  Z0709: ".if/.ifused/.ifnused cannot have an {0} section after a detected .else section.",

  // --- Structs
  Z0801: "The .struct size of {0} is {1} byte(s). The invocation wants to emit {2} bytes.",
  Z0802: "The .struct definition of {0} does not have a field named {1}.",
  Z0803: "Field assignment instruction cannot be used outside of .struct invocation.",
  Z0804: "You cannot define a struct without a name.",
  Z0805: "You cannot define a struct with a temporary name ({0}).",
  Z0806: "Structure name '{0}' has already been declared.",
  Z0807: "The .ends statement cannot have a label.",
  Z0808: "Structures can use only pragmas that emit bytes, words, strings, or reserve space.",
  Z0809: "A .struct invocation ({0}) cannot have arguments.",
  Z0810: "Duplicated field label {0} in a .struct definition.",

  // --- Modules
  Z0901: "You cannot define a module without a name.",
  Z0902: "You cannot define a module with a temporary name ({0}).",
  Z0903: "Module with name '{0}' already exists.",

  // --- Macros
  Z1001: "Duplicated .macro argument: {0}.",
  Z1002: "You cannot define a macro without a name.",
  Z1003: "You cannot define a macro with a temporary name ({0}).",
  Z1004: "Macro name '{0}' has already been declared.",
  Z1005: "Macro definition cannot be nested into another macro definition.",
  Z1006: "Unknown macro argument ('{0}') is used in a macro definition.",
  Z1007: "Unknown macro: {0}.",
  Z1008:
    "The declaration of macro {0} contains {1} argument(s), but it is invoked with more parameters ({2}).",
  Z1009: "A macro-time function accepts only macro parameters.",
  Z1010: "Cannot pass a macro parameter template in a macro argument.",
  Z1011: "Macro parameter can only be used within a macro declaration.",
  Z1012: "Error in macro invocation",
  Z1013:
    "The '{0}' label matches a structure name. If you want to invoke it, use parentheses like '{0}(...)'.",
  Z1014:
    "The '{0}' label matches a macro name. If you want to invoke it, use parentheses like '{0}(...)'.",

  // --- Others
  Z2000: "ERROR: {0}",

  // --- M6510 Compiler Error Codes
  M1001: "Unexpected error when emitting code for mnemonic '{0}'.",
  M1002: "The {0} instruction does not support immediate addressing.",
  M1003: "The {0} instruction does not support indexing with register X.",
  M1004: "The {0} instruction does not support indirect addressing",
  M1005: "The {0} instruction cannot use A as its operand.",
  M1006: "The {0} instruction does not support indexing with register Y.",
  M1007: "The {0} instruction does not support indirect indexing without register X or Y.",
  M1008: "The {0} instruction does not support zero page or absolute addressing."
};
