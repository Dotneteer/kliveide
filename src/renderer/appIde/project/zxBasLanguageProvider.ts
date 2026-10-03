import { MonacoAwareCustomLanguageInfo } from "../../abstractions/CustomLanguageInfo";
import { monarchWordLists } from "@common/kbasic/help";
import { BASIC_DECREASE_INDENT, BASIC_INCREASE_INDENT } from "@renderer/appIde/services/basic-structure";

const WORDS = monarchWordLists();

/** The operators written as symbols (the keyword operators come from the help data). */
export const OPERATOR_SYMBOLS = ["&", "*", "/", "+", "-", "<", "<=", ">", ">=", "=", "<>", ">>", "<<", "~", "|", "!", "^"];

/**
 * Language provider for ZX BASIC (`.zxbas`, `.bas`)
 */
export const zxBasLanguageProvider: MonacoAwareCustomLanguageInfo = {
  id: "zxbas",
  extensions: [".zxbas", ".bas"],
  icon: "file-zxbas",
  depensOn: ["zxbasm"],
  allowBuildRoot: true,
  supportsKlive: true,
  options: {
    comments: { lineComment: "'", blockComment: ["/'", "'/"] },
    brackets: [["(", ")"]],
    autoClosingPairs: [
      { open: "(", close: ")" },
      { open: '"', close: '"', notIn: ["string", "comment"] }
    ],
    surroundingPairs: [
      { open: "(", close: ")" },
      { open: '"', close: '"' }
    ],
    // --- A name without its sigil: `name$` is `name` plus the sigil, and `@` is the address-of operator
    wordPattern: /[A-Za-z_][A-Za-z0-9_]*/,
    indentationRules: {
      increaseIndentPattern: BASIC_INCREASE_INDENT,
      decreaseIndentPattern: BASIC_DECREASE_INDENT
    }
  },
  supportsBreakpoints: true,
  // --- The compiler (Klive BASIC or zxbc, as `zxbasic.compiler` says) decides which lines can hold one
  instantSyntaxCheck: true,
  exactErrorColumns: true,
  fullLineBreakpoints: true,
  languageDef: {
    ignoreCase: true,
    // --- The word lists come from the generated help data (plan E8); see `monarchWordLists`
    statements: WORDS.statements,
    operators: [...WORDS.operators, ...OPERATOR_SYMBOLS],
    functions: WORDS.functions,
    types: WORDS.types,
    directives: WORDS.directives,

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
  darkTheme: { rules: [], colors: {} },
  lightTheme: { rules: [], colors: {} },
};