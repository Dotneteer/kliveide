import { MonacoAwareCustomLanguageInfo } from "../../abstractions/CustomLanguageInfo";

/**
 * Language provider for Turbo Pascal 3.0 (classic Pascal) .pas files
 */
export const turboPascalLanguageProvider: MonacoAwareCustomLanguageInfo = {
  id: "pasta80",
  extensions: [".pas"],
  icon: "file-code",
  allowBuildRoot: true,
  supportsKlive: true,
  options: {
    comments: {
      lineComment: "//",
      blockComment: ["{", "}"]
    },
    brackets: [
      ["(", ")"],
      ["[", "]"]
    ],
    autoClosingPairs: [
      { open: "(", close: ")" },
      { open: "[", close: "]" },
      { open: "'", close: "'", notIn: ["string", "comment"] }
    ],
    surroundingPairs: [
      { open: "(", close: ")" },
      { open: "[", close: "]" },
      { open: "'", close: "'" }
    ]
  },
  supportsBreakpoints: false,
  languageDef: {
    ignoreCase: true,
    defaultToken: "",

    blockKeywords: ["begin", "end"],

    keywords: [
      "and",
      "array",
      "case",
      "const",
      "div",
      "do",
      "downto",
      "else",
      "file",
      "for",
      "function",
      "goto",
      "if",
      "in",
      "label",
      "mod",
      "nil",
      "not",
      "of",
      "or",
      "packed",
      "procedure",
      "program",
      "record",
      "repeat",
      "set",
      "shl",
      "shr",
      "string",
      "then",
      "to",
      "type",
      "unit",
      "until",
      "uses",
      "var",
      "while",
      "with",
      "xor",
      "interface",
      "implementation",
      "forward",
      "external",
      "inline",
      "interrupt",
      "absolute",
      "overlay"
    ],

    builtinTypes: [
      "boolean",
      "byte",
      "char",
      "integer",
      "longint",
      "real",
      "shortint",
      "single",
      "double",
      "extended",
      "comp",
      "text",
      "word",
      "pointer"
    ],

    builtinConstants: [
      "true",
      "false",
      "maxint",
      "maxlongint"
    ],

    builtinFunctions: [
      "abs",
      "addr",
      "append",
      "arctan",
      "assign",
      "blockread",
      "blockwrite",
      "chr",
      "close",
      "concat",
      "copy",
      "cos",
      "dec",
      "delete",
      "dispose",
      "eof",
      "eoln",
      "erase",
      "exit",
      "exp",
      "filepos",
      "filesize",
      "fillchar",
      "flush",
      "free",
      "freemem",
      "getdir",
      "getmem",
      "halt",
      "hi",
      "inc",
      "insert",
      "ioresult",
      "keypressed",
      "length",
      "ln",
      "lo",
      "mark",
      "maxavail",
      "memavail",
      "mkdir",
      "move",
      "new",
      "odd",
      "ofs",
      "ord",
      "paramcount",
      "paramstr",
      "pi",
      "pos",
      "pred",
      "ptr",
      "read",
      "readkey",
      "readln",
      "release",
      "rename",
      "reset",
      "rewrite",
      "rmdir",
      "round",
      "runfinalize",
      "runerror",
      "seek",
      "seekeof",
      "seekeoln",
      "seg",
      "setlength",
      "settextbuf",
      "sin",
      "sizeof",
      "sqr",
      "sqrt",
      "str",
      "succ",
      "swap",
      "trunc",
      "truncate",
      "upcase",
      "val",
      "write",
      "writeln"
    ],

    operators: [
      "+", "-", "*", "/",
      ":=", "=", "<>", "<", ">", "<=", ">=",
      "@", "^", "..", ":"
    ],

    symbols: /[=><!~?:&|+\-*\/\^%@.]+/,
    hexdigits: /[0-9a-fA-F]+/,
    digits: /[0-9]+/,

    tokenizer: {
      root: [
        // Compiler directives: {$...}
        [/\{\$[^}]*\}/, "annotation"],

        // Block comments: { ... }
        [/\{/, "comment", "@braceComment"],

        // Block comments: (* ... *)
        [/\(\*/, "comment", "@parenStarComment"],

        // Identifiers and keywords
        [
          /[a-zA-Z_][a-zA-Z0-9_]*/,
          {
            cases: {
              "@blockKeywords": "keyword.block",
              "@keywords": "keyword",
              "@builtinTypes": "type",
              "@builtinConstants": "constant",
              "@builtinFunctions": "support.function",
              "@default": "identifier"
            }
          }
        ],

        // Whitespace
        { include: "@whitespace" },

        // Delimiters and operators
        [/[()\[\]]/, "@brackets"],
        [
          /@symbols/,
          {
            cases: {
              "@operators": "delimiter",
              "@default": ""
            }
          }
        ],

        // Hex numbers: $FF00
        [/\$(@hexdigits)/, "number.hex"],

        // Decimal numbers
        [/@digits/, "number"],

        // Strings: '...' (single-quoted, '' is an escaped quote)
        [/'/, "string", "@pascalString"],

        // Char literals: #65 or #$41
        [/#\$(@hexdigits)/, "string"],
        [/#(@digits)/, "string"],

        // Semicolons and commas
        [/[;,.]/, "delimiter"]
      ],

      braceComment: [
        // Nested compiler directives inside a comment are still comment
        [/[^}]+/, "comment"],
        [/\}/, "comment", "@pop"]
      ],

      parenStarComment: [
        [/[^(*]+/, "comment"],
        [/\*\)/, "comment", "@pop"],
        [/[(*]/, "comment"]
      ],

      whitespace: [
        [/[ \t\r\n]+/, ""]
      ],

      pascalString: [
        // '' inside string is an escaped quote
        [/''/, "string.escape"],
        [/[^']+/, "string"],
        [/'/, "string", "@pop"]
      ]
    }
  },

  darkTheme: {
    rules: [
      { token: "keyword.block", foreground: "c586c0", fontStyle: "bold" },
      { token: "keyword", foreground: "569cd6", fontStyle: "bold" },
      { token: "type", foreground: "4ec9b0" },
      { token: "constant", foreground: "9cdcfe" },
      { token: "support.function", foreground: "dcdcaa" },
      { token: "identifier", foreground: "9cdcfe" },
      { token: "string", foreground: "ce9178" },
      { token: "string.escape", foreground: "d7ba7d" },
      { token: "number", foreground: "b5cea8" },
      { token: "number.hex", foreground: "b5cea8" },
      { token: "comment", foreground: "6a9955" },
      { token: "annotation", foreground: "c586c0" },
      { token: "delimiter", foreground: "d4d4d4" }
    ],
    colors: {}
  },

  lightTheme: {
    rules: [
      { token: "keyword.block", foreground: "af00db", fontStyle: "bold" },
      { token: "keyword", foreground: "0000ff", fontStyle: "bold" },
      { token: "type", foreground: "008080" },
      { token: "constant", foreground: "098658" },
      { token: "support.function", foreground: "795e26" },
      { token: "identifier", foreground: "000000" },
      { token: "string", foreground: "a31515" },
      { token: "string.escape", foreground: "a5673f" },
      { token: "number", foreground: "098658" },
      { token: "number.hex", foreground: "098658" },
      { token: "comment", foreground: "008000" },
      { token: "annotation", foreground: "af00db" },
      { token: "delimiter", foreground: "000000" }
    ],
    colors: {}
  }
};
