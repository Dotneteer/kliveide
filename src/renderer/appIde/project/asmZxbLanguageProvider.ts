import { MonacoAwareCustomLanguageInfo } from "../abstractions/CustomLanguageInfo";

/**
 * Language provider for the .asm.z80 extension
 */
export const asmZxbLanguageProvider: MonacoAwareCustomLanguageInfo = {
  id: "zxbasm",
  extensions: [".zxb.asm"],
  icon: "file-zxb-asm",
  allowBuildRoot: true,
  supportsKlive: true,
  options: {
    comments: {
      lineComment: ";",
    },
  },
  supportsBreakpoints: true,
  compiler: "ZxbAsmCompiler",
  languageDef: {
    ignoreCase: true,
    keywords: [
      "ADC",
      "ADD",
      "AND",
      "BIT",
      "CALL",
      "CCF",
      "CP",
      "CPD",
      "CPDR",
      "CPI",
      "CPIR",
      "CPL",
      "DAA",
      "DEC",
      "DI",
      "DJNZ",
      "EI",
      "EX",
      "EXX",
      "HALT",
      "IM",
      "IN",
      "INC",
      "IND",
      "INDR",
      "INI",
      "INIR",
      "JP",
      "JR",
      "LD",
      "LDD",
      "LDDR",
      "LDI",
      "LDIR",
      "NEG",
      "NOP",
      "OR",
      "OTDR",
      "OTIR",
      "OUT",
      "OUTD",
      "OUTI",
      "POP",
      "PUSH",
      "RES",
      "RET",
      "RETI",
      "RETN",
      "RL",
      "RLA",
      "RLC",
      "RLCA",
      "RLD",
      "RR",
      "RRA",
      "RRC",
      "RRCA",
      "RRD",
      "RST",
      "SBC",
      "SCF",
      "SET",
      "SLA",
      "SLL",
      "SRA",
      "SRL",
      "SUB",
      "XOR",
      "LDIX",
      "LDWS",
      "LDIRX",
      "LDDX",
      "LDDRX",
      "LDPIRX",
      "OUTINB",
      "MUL",
      "SWAPNIB",
      "MIRROR",
      "NEXTREG",
      "PIXELDN",
      "PIXELAD",
      "SETAE",
      "TEST",
      "BSLA",
      "BSRA",
      "BSRL",
      "BSRF",
      "BRLC",
    ],

    registers: [
      "AF",
      "AF'",
      "A",
      "F",
      "BC",
      "B",
      "C",
      "DE",
      "D",
      "E",
      "HL",
      "H",
      "L",
      "I",
      "R",
      "SP",
      "IXH",
      "IXL",
      "IX",
      "IYH",
      "IYL",
    ],

    pragmas: [
      "ALIGN",
      "ORG",
      "DEFB",
      "DEFM",
      "DB",
      "DEFS",
      "DEFW",
      "DS",
      "DW",
      "EQU",
      "PROC",
      "ENDP",
      "LOCAL",
      "END",
      "INCBIN",
      "NAMESPACE",
    ],

    operators: [
      ",",
      "<<",
      ">>",
      "&",
      "|",
      "~",
      "+",
      "-",
      "*",
      "/",
      "%",
      "^",
      "<",
      ">",
      "<=",
      ">=",
      "=>",
      "<>",
      "=",
    ],

    conditions: ["Z", "NZ", "NC", "PO", "PE", "P", "M"],

    symbols: /[:,?+-\/*=><!~&|\/\^%]+/,

    tokenizer: {
      root: [
        // --- Special registers
        [/af'|AF'/, "register"],

        // --- Hexadecimal literal
        [
          /([0-9](_?[0-9a-fA-F])*[hH])|(\$[0-9a-fA-F](_?[0-9a-fA-F])*)|(0x[0-9a-fA-F](_?[0-9a-dA-F])*)/,
          "number",
        ],

        // --- Keyword-like tokens
        [
          /[._a-zA-Z][._a-zA-Z0-9]*/,
          {
            cases: {
              "@keywords": "keyword",
              "@pragmas": "pragma",
              "@registers": "register",
              "@conditions": "condition",
              "@default": "identifier",
            },
          },
        ],

        // --- Whitespace
        { include: "@whitespace" },

        // --- Directives
        [/#[ \t]*[a-z_]+[^\r\n]*/, "preproc"],

        // --- Binary literal
        [/(%[01](_?[01])*)|(0[bB](_?[01])+)/, "number"],

        // --- Decimal literal
        [/[0-9](_?\d)*/, "number"],

        // --- Delimiters
        [/[()\[\]]/, "@brackets"],

        // strings
        [/"([^"\\]|\\.)*$/, "string.invalid"], // non-teminated string
        [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],

        // --- Various operators
        [/@symbols/, { cases: { "@operators": "operator", "@default": "" } }],
      ],

      string: [
        [/[^\\"]+/, "string"],
        [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
      ],

      whitespace: [
        [/[ \t\r\n]+/, "white"],
        [/;.*$/, "comment"],
      ],

      specialReg: [[/af'|AF'/, "register"]],
    },
  },
  darkTheme: {
    rules: [
      {
        token: "comment",
        foreground: "6a9955",
      },
      {
        token: "keyword",
        foreground: "569cd6",
        fontStyle: "bold",
      },
      {
        token: "pragma",
        foreground: "c586c0",
      },
      {
        token: "identifier",
        foreground: "dcdcaa",
      },
      {
        token: "register",
        foreground: "9cdcfe",
      },
      {
        token: "condition",
        foreground: "9cdcfe",
      },
      {
        token: "preproc",
        foreground: "a0a0a0",
      },
    ],
    colors: {},
  },
};