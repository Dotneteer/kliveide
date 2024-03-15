import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";
import { MonacoAwareCustomLanguageInfo } from "../../abstractions/CustomLanguageInfo";

/**
 * Language provider for the .asm.z80 extension
 */
export const ksxLanguageProvider: MonacoAwareCustomLanguageInfo = {
  id: "ksx",
  extensions: [".ksx"],
  icon: "file-code",
  allowBuildRoot: false,
  supportsKlive: true,
  options: {
    wordPattern:
      /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,

    comments: {
      lineComment: "//",
      blockComment: ["/*", "*/"]
    },

    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"]
    ],

    onEnterRules: [
      {
        // e.g. /** | */
        beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
        afterText: /^\s*\*\/$/,
        action: {
          indentAction: monacoEditor.languages.IndentAction.IndentOutdent,
          appendText: " * "
        }
      },
      {
        // e.g. /** ...|
        beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
        action: {
          indentAction: monacoEditor.languages.IndentAction.None,
          appendText: " * "
        }
      },
      {
        // e.g.  * ...|
        beforeText: /^(\t|(\ \ ))*\ \*(\ ([^\*]|\*(?!\/))*)?$/,
        action: {
          indentAction: monacoEditor.languages.IndentAction.None,
          appendText: "* "
        }
      },
      {
        // e.g.  */|
        beforeText: /^(\t|(\ \ ))*\ \*\/\s*$/,
        action: {
          indentAction: monacoEditor.languages.IndentAction.None,
          removeText: 1
        }
      }
    ],

    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"', notIn: ["string"] },
      { open: "'", close: "'", notIn: ["string", "comment"] },
      { open: "`", close: "`", notIn: ["string", "comment"] },
      { open: "/**", close: " */", notIn: ["string"] }
    ]
  },
  supportsBreakpoints: false,

  languageDef: {
    ignoreCase: false,
    defaultToken: "invalid",
    keywords: [
      "as",
      "case",
      "const",
      "default",
      "delete",
      "false",
      "from",
      "function",
      "in",
      "instanceof",
      "is",
      "let",
      "null",
      "number",
      "object",
      "string",
      "true",
      "typeof",
      "undefined",
      "of"
    ],

    statements: [
      "break",
      "catch",
      "continue",
      "do",
      "else",
      "export",
      "finally",
      "for",
      "if",
      "import",
      "return",
      "switch",
      "throw",
      "try",
      "while"
    ],

    operators: [
      "<=",
      ">=",
      "==",
      "!=",
      "===",
      "!==",
      "=>",
      "+",
      "-",
      "**",
      "*",
      "/",
      "%",
      "++",
      "--",
      "<<",
      "</",
      ">>",
      ">>>",
      "&",
      "|",
      "^",
      "!",
      "~",
      "&&",
      "||",
      "??",
      "?",
      ":",
      "=",
      "+=",
      "-=",
      "*=",
      "**=",
      "/=",
      "%=",
      "<<=",
      ">>=",
      ">>>=",
      "&=",
      "|=",
      "^=",
      "@"
    ],

    // we include these common regular expressions
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    escapes:
      /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
    digits: /\d+(_+\d+)*/,
    octaldigits: /[0-7]+(_+[0-7]+)*/,
    binarydigits: /[0-1]+(_+[0-1]+)*/,
    hexdigits: /[[0-9a-fA-F]+(_+[0-9a-fA-F]+)*/,

    regexpctl: /[(){}\[\]\$\^|\-*+?\.]/,
    regexpesc:
      /\\(?:[bBdDfnrstvwWn0\\\/]|@regexpctl|c[A-Z]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4})/,

    // The main tokenizer for our languages
    tokenizer: {
      root: [[/[{}]/, "delimiter.bracket"], { include: "common" }],

      common: [
        // identifiers and keywords
        [
          /[a-z_$][\w$]*/,
          {
            cases: {
              "@keywords": "keyword",
              "@statements": "statement",
              "@default": "identifier"
            }
          }
        ],
        // special identifiers
        [/[#@][\w$]*/, "type.identifier"],

        [/[A-Z][\w\$]*/, "type.identifier"], // to show class names nicely
        // [/[A-Z][\w\$]*/, 'identifier'],

        // whitespace
        { include: "@whitespace" },

        // regular expression: ensure it is terminated before beginning (otherwise it is an opeator)
        [
          /\/(?=([^\\\/]|\\.)+\/([dgimsuy]*)(\s*)(\.|;|,|\)|\]|\}|$))/,
          { token: "regexp", bracket: "@open", next: "@regexp" }
        ],

        // delimiters and operators
        [/[()\[\]]/, "@brackets"],
        [/[<>](?!@symbols)/, "@brackets"],
        [/!(?=([^=]|$))/, "delimiter"],
        [
          /@symbols/,
          {
            cases: {
              "@operators": "delimiter",
              "@default": ""
            }
          }
        ],

        // numbers
        [/(@digits)[eE]([\-+]?(@digits))?/, "number.float"],
        [/(@digits)\.(@digits)([eE][\-+]?(@digits))?/, "number.float"],
        [/0[xX](@hexdigits)n?/, "number.hex"],
        [/0[oO]?(@octaldigits)n?/, "number.octal"],
        [/0[bB](@binarydigits)n?/, "number.binary"],
        [/(@digits)n?/, "number"],

        // delimiter: after number because of .\d floats
        [/[;,.]/, "delimiter"],

        // strings
        [/"([^"\\]|\\.)*$/, "string.invalid"], // non-teminated string
        [/'([^'\\]|\\.)*$/, "string.invalid"], // non-teminated string
        [/"/, "string", "@string_double"],
        [/'/, "string", "@string_single"],
        [/`/, "string", "@string_backtick"]
      ],

      whitespace: [
        [/[ \t\r\n]+/, ""],
        [/\/\*\*(?!\/)/, "comment.doc", "@jsdoc"],
        [/\/\*/, "comment", "@comment"],
        [/\/\/.*$/, "comment"]
      ],

      comment: [
        [/[^\/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[\/*]/, "comment"]
      ],

      jsdoc: [
        [/[^\/*]+/, "comment.doc"],
        [/\*\//, "comment.doc", "@pop"],
        [/[\/*]/, "comment.doc"]
      ],

      // We match regular expression quite precisely
      regexp: [
        [
          /(\{)(\d+(?:,\d*)?)(\})/,
          [
            "regexp.escape.control",
            "regexp.escape.control",
            "regexp.escape.control"
          ]
        ],
        [
          /(\[)(\^?)(?=(?:[^\]\\\/]|\\.)+)/,
          [
            "regexp.escape.control",
            { token: "regexp.escape.control", next: "@regexrange" }
          ]
        ],
        [
          /(\()(\?:|\?=|\?!)/,
          ["regexp.escape.control", "regexp.escape.control"]
        ],
        [/[()]/, "regexp.escape.control"],
        [/@regexpctl/, "regexp.escape.control"],
        [/[^\\\/]/, "regexp"],
        [/@regexpesc/, "regexp.escape"],
        [/\\\./, "regexp.invalid"],
        [
          /(\/)([dgimsuy]*)/,
          [
            { token: "regexp", bracket: "@close", next: "@pop" },
            "keyword.other"
          ]
        ]
      ],

      regexrange: [
        [/-/, "regexp.escape.control"],
        [/\^/, "regexp.invalid"],
        [/@regexpesc/, "regexp.escape"],
        [/[^\]]/, "regexp"],
        [
          /\]/,
          {
            token: "regexp.escape.control",
            next: "@pop",
            bracket: "@close"
          }
        ]
      ],

      string_double: [
        [/[^\\"]+/, "string"],
        [/@escapes/, "string.escape"],
        [/\\./, "string.escape.invalid"],
        [/"/, "string", "@pop"]
      ],

      string_single: [
        [/[^\\']+/, "string"],
        [/@escapes/, "string.escape"],
        [/\\./, "string.escape.invalid"],
        [/'/, "string", "@pop"]
      ],

      string_backtick: [
        [/\$\{/, { token: "delimiter.bracket", next: "@bracketCounting" }],
        [/[^\\`$]+/, "string"],
        [/@escapes/, "string.escape"],
        [/\\./, "string.escape.invalid"],
        [/`/, "string", "@pop"]
      ],

      bracketCounting: [
        [/\{/, "delimiter.bracket", "@bracketCounting"],
        [/\}/, "delimiter.bracket", "@pop"],
        { include: "common" }
      ]
    }
  },
  darkTheme: {
    rules: [
      {
        token: "keyword",
        foreground: "569cd6"
      },
      {
        token: "statement",
        foreground: "c586c0"
      },
      {
        token: "string.escape",
        foreground: "d7ba7d"
      },
      {
        token: "identifier",
        foreground: "9cdcfe"
      },
      {
        token: "comment",
        foreground: "6a9955"
      }
    ],
    colors: {}
  },
  lightTheme: {
    rules: [
      {
        token: "keyword",
        foreground: "0000ff"
      },
      {
        token: "statement",
        foreground: "af00db"
      },
      {
        token: "string.escape",
        foreground: "ee0000"
      },
      {
        token: "identifier",
        foreground: "0070c1"
      },
      {
        token: "comment",
        foreground: "008000"
      }
    ],
    colors: {}
  }
};
