import { MonacoAwareCustomLanguageInfo } from "../../abstractions/CustomLanguageInfo";

/**
 * Language provider for the .asm.z80 extension
 */
export const sjasmZ80LanguageProvider: MonacoAwareCustomLanguageInfo = {
  id: "sjasmp",
  extensions: [".sjasm"],
  icon: "file-kz80-asm",
  depensOn: ["lua"],
  allowBuildRoot: true,
  supportsKlive: true,
  options: {
    comments: {
      lineComment: ";"
    }
  },
  supportsBreakpoints: true,
  fullLineBreakpoints: true,
  instantSyntaxCheck: true,
  compiler: "SjasmPCompiler",
  languageDef: {
    ignoreCase: true,
    keywords: [
      "nop",
      "rlca",
      "rrca",
      "rla",
      "rra",
      "daa",
      "cpl",
      "scf",
      "ccf",
      "halt",
      "exx",
      "di",
      "ei",
      "neg",
      "retn",
      "reti",
      "rld",
      "rrd",
      "ldi",
      "cpi",
      "ini",
      "outi",
      "ldd",
      "cpd",
      "ind",
      "outd",
      "ldir",
      "cpir",
      "inir",
      "otir",
      "lddr",
      "cpdr",
      "indr",
      "otdr",
      "ld",
      "inc",
      "dec",
      "ex",
      "exa",
      "add",
      "adc",
      "sub",
      "sbc",
      "and",
      "xor",
      "or",
      "cp",
      "djnz",
      "jr",
      "jp",
      "call",
      "ret",
      "rst",
      "push",
      "pop",
      "in",
      "out",
      "im",
      "rlc",
      "rrc",
      "rl",
      "rr",
      "sla",
      "sra",
      "sll",
      "srl",
      "bit",
      "res",
      "set",
      "ldix",
      "ldws",
      "ldirx",
      "lirx",
      "lddx",
      "lddrx",
      "ldrx",
      "ldpirx",
      "lprx",
      "outinb",
      "otib",
      "mul",
      "swapnib",
      "swap",
      "mirror",
      "mirr",
      "nextreg",
      "nreg",
      "pixeldn",
      "pxdn",
      "pixelad",
      "pxad",
      "setae",
      "stae",
      "test",
      "bsla",
      "bsra",
      "bsrl",
      "bsrf",
      "brlc"
    ],

    registers: [
      "af",
      "af'",
      "a",
      "f",
      "bc",
      "b",
      "c",
      "de",
      "d",
      "e",
      "hl",
      "h",
      "l",
      "i",
      "r",
      "sp",
      "xh",
      "hx",
      "ixh",
      "xl",
      "lx",
      "ixl",
      "ix",
      "yh",
      "hy",
      "yl",
      "ly",
      "iyh",
      "iyl",
      "iy"
    ],

    pseudoops: [
      "abyte",
      "abytec",
      "abytez",
      "align",
      "assert",
      "binary",
      "block",
      "bplist",
      "byte",
      "cspectmap",
      "d24",
      "db",
      "dc",
      "dd",
      "defarray",
      "defb",
      "defd",
      "defdevice",
      "defg",
      "defh",
      "define+",
      "define",
      "defl",
      "defm",
      "defs",
      "defw",
      "dephase",
      "device",
      "dg",
      "dh",
      "disp",
      "display",
      "dm",
      "ds",
      "dup",
      "dw",
      "dword",
      "dz",
      "edup",
      "emptytap",
      "emptytrd",
      "encoding",
      "end",
      "endlua",
      "endmod",
      "endmodule",
      "endt",
      "endw",
      "ent",
      "export",
      "fpos",
      "hex",
      "incbin",
      "inchob",
      "include",
      "includelua",
      "inctrd",
      "insert",
      "labelslist",
      "lua",
      "memorymap",
      "mmu",
      "module",
      "opt",
      "org",
      "outend",
      "output",
      "page",
      "phase",
      "relocate_end",
      "relocate_start",
      "relocate_table",
      "rept",
      "save3dos",
      ".saveasmdos",
      ".savebin",
      "savecdt",
      "savecpcsna",
      "savecpr",
      "savedev",
      "savehob",
      "savenex",
      "savesna",
      "savetap",
      "savetrd",
      "setbp",
      "setbreakpoint",
      "shellexec",
      "size",
      "sldopt",
      "slot",
      "tapend",
      "tapout",
      "textarea",
      "undefine",
      "unphase",
      "while",
      "word",
      "macro",
      "endm",
      "struct",
      "ends"
    ],

    operators: [
      "!",
      "~",
      "+",
      "-",
      "*",
      "/",
      "%",
      "<<",
      ">>",
      ">>>",
      "<?",
      ">?",
      "<",
      ">",
      "<=",
      ">=",
      "=",
      "==",
      "!=",
      "^",
      "|",
      "&&",
      "||",
      "$",
      "$$",
      "$$$",
      "$$$$",
      "low",
      "high",
      "not",
      "abs",
      "mod",
      "shl",
      "shr",
      "and",
      "xor",
      "or",
      "norel",
      "exist"
    ],

    condasm: ["if", "ifn", "ifdef", "ifndef", "ifused", "ifnused", "else", "elseif", "endif"],

    specops: [
      "$",
      "$$",
      "$$$",
      "$$$$",
      "low",
      "high",
      "not",
      "abs",
      "mod",
      "shl",
      "shr",
      "and",
      "xor",
      "or",
      "norel",
      "exist"
    ],

    conditions: ["z", "Z", "nz", "NZ", "nc", "NC", "po", "PO", "pe", "PE", "p", "P", "m", "M"],

    escapes: /\\(?:[\\?'"0ABDEFNRTVabdefnrtv])/,

    symbols: /[:,?+-\/*=><!~&|\/\^%]+/,

    tokenizer: {
      root: [
        [
          /lua\s*/,
          {
            token: "luadef",
            bracket: "@open",
            next: "@lua_block",
            nextEmbedded: "lua"
          }
        ],

        [/endlua\s*/, { token: "luadef", bracket: "@close" }],

        // --- Character literal
        [/'.'/, "string"],

        // --- Special registers
        [/af'|AF'/, "register"],

        // --- Binary literals
        [/(0b|%)[01]('?[01])*/, "number"],
        [/[01]('?[01])*[bB]/, "number"],

        // --- Hexadecimal literals
        [/[0-9]('?[0-9A-Fa-f])*[hH]/, "number"],
        [/(0x|\$|#)[0-9A-Fa-f]('?[0-9A-Fa-f])*/, "number"],

        // --- Octal literals
        [/(0q|%)[0-7]('?[0-7])*/, "number"],
        [/[0-7]('?[0-7])*[qoQO]/, "number"],

        // --- Decimal literal
        [/[0-9]+('?[0-9])*(dD)?/, "number"],

        // --- Keyword-like tokens
        [
          /[\._$@`A-Za-z][_@$!?\.0-9A-Za-z]*(\+?)/,
          {
            cases: {
              "@keywords": "keyword",
              "@pseudoops": "pseudoop",
              "@registers": "register",
              "@condasm": "condasm",
              "@specops": "specop",
              "@conditions": "condition",
              "@operators": "operator",
              "@default": "identifier"
            }
          }
        ],

        // --- Whitespace
        { include: "@whitespace" },

        // --- Binary literal
        [/%[01_]+/, "number"],

        // --- Octal literal
        [/[0-7]{1,6}(o|O|q|Q)/, "number"],

        // --- Decimal literal
        [/[0-9]+/, "number"],

        // --- Delimiters
        [/[()\[\]]/, "@brackets"],

        // --- Various operators
        [/@symbols/, { cases: { "@operators": "operator", "@default": "" } }],

        // --- Macro parameter
        [/{{/, { token: "macroparam", next: "@macroParam", log: "mp-beg" }],

        // strings
        [/"([^"\\]|\\.)*$/, "string.invalid"], // non-teminated string
        [/"/, { token: "string.quote", bracket: "@open", next: "@string" }]
      ],

      lua_block: [
        [/endlua\s*/, { token: "@rematch", next: "@pop", nextEmbedded: "@pop" }],
        [/"/, "string", "@string"]
      ],

      comment: [
        [/[^/*]+/, "comment"], // Match any text that is not a comment delimiter
        [/\/\*/, "comment", "@push"], // Handle nested block comments
        [/\*\//, "comment", "@pop"], // End of block comment
        [/[\/*]/, "comment"] // Match remaining comment characters
      ],

      string: [
        [/[^\\"]+/, "string"],
        [/@escapes/, "escape"],
        [/\\./, "string.escape.invalid"],
        [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }]
      ],

      whitespace: [
        [/[ \t\r\n]+/, "white"],
        [/\/\*/, "comment", "@comment"],
        [/\/\/.*$/, "comment"],
        [/;.*$/, "comment"]
      ],

      macroParam: [
        [/}}/, "macroparam", "@pop"],
        [/[\._@`a-zA-Z][_@!?\.0-9A-Za-z]*$/, "macroparam", "@pop"],
        [/[\._@`a-zA-Z][_@!?\.0-9A-Za-z]*/, "macroparam"],
        [/}[^}]/, "", "@pop"],
        [/}/, "macroparam"]
      ],

      specialReg: [[/af'|AF'/, "register"]]
    }
  },
  darkTheme: {
    rules: [
      {
        token: "comment",
        foreground: "6a9955"
      },
      {
        token: "keyword",
        foreground: "569cd6",
        fontStyle: "bold"
      },
      {
        token: "condasm",
        foreground: "c586c0"
      },
      {
        token: "pseudoop",
        foreground: "c586c0",
        fontStyle: "bold"
      },
      {
        token: "identifier",
        foreground: "dcdcaa"
      },
      {
        token: "register",
        foreground: "9cdcfe"
      },
      {
        token: "condition",
        foreground: "9cdcfe"
      },
      {
        token: "specop",
        foreground: "4fc1ff"
      },
      {
        token: "escape",
        foreground: "d7ba7d"
      },
      {
        token: "luadef",
        foreground: "ff8500"
      }
    ],
    colors: {}
  },
  lightTheme: {
    rules: [
      {
        token: "comment",
        foreground: "237122"
      },
      {
        token: "keyword",
        foreground: "0070c0",
        fontStyle: "bold"
      },
      {
        token: "condasm",
        foreground: "af00db"
      },
      {
        token: "pseudoop",
        foreground: "af00db",
        fontStyle: "bold"
      },
      {
        token: "identifier",
        foreground: "795e26"
      },
      {
        token: "register",
        foreground: "0089ba"
      },
      {
        token: "condition",
        foreground: "0089ba"
      },
      {
        token: "specop",
        foreground: "007acc"
      },
      {
        token: "escape",
        foreground: "a5673f"
      },
      {
        token: "luadef",
        foreground: "cc6600"
      }
    ],
    colors: {}
  }
};
