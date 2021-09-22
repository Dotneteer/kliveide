import { CustomLanguageInfo } from "../document-area/DocumentFactory";

/**
 * Language provider for the .asm.z80 extension
 */
export const asmZ80LanguageProvider: CustomLanguageInfo = {
  id: "asm.z80",
  options: {
    comments: {
      lineComment: ";",
    },
  },
  languageDef: {
    keywords: ["hello"],
    // we include these common regular expressions
    symbols: /[=><!~?:&|+\-*\/\^%]+/,

    operators: [
      "=",
      ">",
      "<",
      "!",
      "~",
      "?",
      ":",
      "==",
      "<=",
      ">=",
      "!=",
      "&&",
      "||",
      "++",
      "--",
      "+",
      "-",
      "*",
      "/",
      "&",
      "|",
      "^",
      "%",
      "<<",
      ">>",
      ">>>",
      "+=",
      "-=",
      "*=",
      "/=",
      "&=",
      "|=",
      "^=",
      "%=",
      "<<=",
      ">>=",
      ">>>=",
    ],

    escapes: /\\(?:[ipfbIoatPC0\\"']|x[0-9A-Fa-f]{2})/,

    tokenizer: {
      root: [
        // identifiers and keywords
        [
          /[a-z_$][\w$]*/,
          {
            cases: {
              "@keywords": "keyword",
              "@default": "identifier",
            },
          },
        ],
        [/[A-Z][\w\$]*/, "type.identifier"], // to show class names nicely

        // whitespace
        { include: "@whitespace" },

        // delimiters and operators
        [/[{}()\[\]]/, "@brackets"],
        [/[<>](?!@symbols)/, "@brackets"],
        [/@symbols/, { cases: { "@operators": "operator", "@default": "" } }],

        // @ annotations.
        // As an example, we emit a debugging log message on these tokens.
        // Note: message are supressed during the first load -- change some lines to see them.
        [
          /@\s*[a-zA-Z_\$][\w\$]*/,
          { token: "annotation", log: "annotation token: $0" },
        ],

        // numbers
        [/\d*\.\d+([eE][\-+]?\d+)?/, "number.float"],
        [/0[xX][0-9a-fA-F]+/, "number.hex"],
        [/\d+/, "number"],

        // strings
        [/"([^"\\]|\\.)*$/, "string.invalid"], // non-teminated string
        [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],

        // characters
        [/'[^\\']'/, "string"],
        [/(')(@escapes)(')/, ["string", "string.escape", "string"]],
        [/'/, "string.invalid"],
      ],

      comment: [
        [/\*\//, "comment", "@pop"],
        [/[^\/*]+$/, "comment", "@pop"],
        [/[^\/*]+/, "comment"],
        [/[\/*]$/, "comment", "@pop"],
        [/[\/*]/, "comment"],
      ],

      string: [
        [/[^\\"]+/, "string"],
        [/@escapes/, "string.escape"],
        [/\\./, "string.escape.invalid"],
        [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
      ],

      whitespace: [
        [/[ \t\r\n]+/, { token: "white", log: "w1" }],
        [/\/\*/, { token: "comment", next: "@comment", log: "w2" }],
        [/\/\/.*$/, { token: "comment", log: "w3" }],
        [/;.*$/, { token: "comment", log: "w4" }],
      ],
    },
  },
};
