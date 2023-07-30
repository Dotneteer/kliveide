import { MonacoAwareCustomLanguageInfo } from "../../abstractions/CustomLanguageInfo";

/**
 * Language provider for the .asm.z80 extension
 */
export const zxBasLanguageProvider: MonacoAwareCustomLanguageInfo = {
  id: "zxbas",
  extensions: [".zxbas"],
  icon: "file-zxbas",
  depensOn: ["zxbasm"],
  allowBuildRoot: true,
  supportsKlive: true,
  options: {
  },
  supportsBreakpoints: true,
  languageDef: {
    ignoreCase: true,
    statements: [
      "AS",
      "BEEP",
      "BIN",
      "BORDER",
      "BRIGHT",
      "CAT",
      "CIRCLE",
      "CLEAR",
      "CLOSE#",
      "CLS",
      "CONTINUE",
      "COPY",
      "DATA",
      "DEF FN",
      "DIM",
      "DRAW",
      "ERASE",
      "FLASH",
      "FORMAT",
      "FOR",
      "GO",
      "GOSUB",
      "GOTO",
      "IF",
      "INK",
      "INPUT",
      "INVERSE",
      "LET",
      "LIST",
      "LLIST",
      "LOAD",
      "LPRINT",
      "MERGE",
      "MOVE",
      "NEW",
      "NEXT",
      "ON",
      "OUT",
      "OVER",
      "PAPER",
      "PAUSE",
      "PLOT",
      "POKE",
      "PRINT",
      "RANDOMIZE",
      "READ",
      "RESTORE",
      "RETURN",
      "RUN",
      "SAVE",
      "SUB",
      "VERIFY",
      "AT",
      "LINE",
      "STEP",
      "TAB",
      "THEN",
      "TO",
      "STOP",
      "DO",
      "ELSE",
      "ELSEIF",
      "EXIT",
      "FUNCTION",
      "LOOP",
      "WEND",
      "WHILE",
      "BOLD",
      "ByRef",
      "ByVal",
      "CONST",
      "DECLARE",
      "FastCall",
      "ITALIC",
      "StdCall",
      "SUB",
      "UNTIL",
      "BANK",
      "LAYER",
      "PALETTE",
      "SPRITE",
      "TILE",
      "TO",
      "REMOUNT",
      "PWD",
      "CD",
      "MKDIR",
      "RMDIR",
    ],

    operators: [
      "AND",
      "NOT",
      "OR",
      "bAND",
      "bNOT",
      "bOR",
      "bXOR",
      "MOD",
      "SHL",
      "SHR",
      "XOR",
      "&",
      "*",
      "/",
      "+",
      "-",
      "<",
      "<=",
      ">",
      ">=",
      "=",
      "<>",
      ">>",
      "<<",
      "~",
    ],

    functions: [
      "ABS",
      "ACS",
      "ASN",
      "ATN",
      "ATTR",
      "CHR$",
      "CODE",
      "COS",
      "EXP",
      "FN",
      "INKEY$",
      "INT",
      "IN",
      "LEN",
      "LN",
      "PEEK",
      "PI",
      "POINT",
      "RND",
      "SCREEN$",
      "SGN",
      "SIN",
      "SQR",
      "STR$",
      "TAN",
      "USR",
      "VAL$",
      "VAL",
      "ASC",
      "CAST",
      "CHR",
      "CSRLIN",
      "HEX",
      "HEX16",
      "GetKey",
      "MultiKeys",
      "GetKeyScanCode",
      "LBOUND",
      "LCase",
      "STR",
      "POS",
      "SCREEN",
      "UCase",
    ],

    types: [
      "byte",
      "ubyte",
      "integer",
      "uinteger",
      "long",
      "ulong",
      "string",
      "fixed",
      "float",
    ],

    directives: [
      "#include",
      "#once",
      "#define",
      "#undef",
      "#ifdef",
      "#ifndef",
      "#else",
      "#endif",
      "#init",
      "#line",
      "#require",
      "#pragma",
    ],

    symbols: /[:,?+-\/*=><!~&|\/\^%]+/,

    escapes:
      /\\(\s\s|\s\'|\'\s|\'\'|\s\.|\s:|\'\.|\':|\.\s|\.\'|:\s|:\'|\.\.|\.:|:\.|::|\\|`|#[0-9]{3}|\*|i[0-8]|p[0-8]|b[01]|f[01]|[A-U])/,

    tokenizer: {
      root: [
        // --- Whitespace
        { include: "@whitespace" },

        [
          /asm\s*/,
          {
            token: "asmdel",
            bracket: "@open",
            next: "@asm_block",
            nextEmbedded: "zxbasm",
          },
        ],

        [/end\s+asm\s*/, { token: "asmdel", bracket: "@close" }],

        // --- Keyword-like tokens
        [
          /[$a-zA-Z][$0-9A-Za-z]*/,
          {
            cases: {
              "@statements": "statement",
              "@operators": "operator",
              "@functions": "function",
              "@types": "type",
              "@default": "identifier",
            },
          },
        ],

        // --- Directives
        [
          /#[$a-zA-Z][$0-9A-Za-z]*/,
          {
            cases: {
              "@directives": "directive",
              "@default": "identifier",
            },
          },
        ],

        // --- Decimal literal
        [/[0-9]+/, "number"],

        // --- Real literal
        [/[0-9]*(\.[0-9]+)([eE][+-]?[0-9]+)?/, "number"],

        // --- Various operators
        [/@symbols/, { cases: { "@operators": "operator", "@default": "" } }],

        // strings
        [/"([^"\\]|\\.)*$/, "string.invalid"], // non-teminated string
        [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],
      ],

      asm_block: [
        [
          /end\s+asm\s*/,
          { token: "@rematch", next: "@pop", nextEmbedded: "@pop" },
        ],
        [/"/, "string", "@string"],
      ],

      whitespace: [
        [/[ \t\r\n]+/, "white"],
        [/\/'/, "comment", "@comment"],
        [/(REM|\').*$/, "comment"],
      ],

      comment: [
        [/[^\/']+/, "comment"],
        [/\/\'/, "comment", "@push"], // nested comment
        ["\\'/", "comment", "@pop"],
        [/[\/']/, "comment"],
      ],

      string: [
        [/[^\\"]+/, "string"],
        [/@escapes/, "escape"],
        [/\\./, "string.escape.invalid"],
        [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
      ],
    },
  },
  darkTheme: {
    rules: [
      {
        token: "comment",
        foreground: "6a9955",
      },
      {
        token: "directive",
        foreground: "c0c0c0",
      },
      {
        token: "statement",
        foreground: "c586c0",
        fontStyle: "bold",
      },
      {
        token: "identifier",
        foreground: "dcdcaa",
      },
      {
        token: "function",
        foreground: "4fc1ff",
      },
      {
        token: "escape",
        foreground: "d7ba7d",
      },
      {
        token: "asmdel",
        foreground: "ff8500",
      },
      {
        token: "pragma",
        foreground: "c586c0",
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
        token: "macroparam",
        foreground: "c586c0",
        fontStyle: "italic",
      },
    ],
    colors: {},
  },
};