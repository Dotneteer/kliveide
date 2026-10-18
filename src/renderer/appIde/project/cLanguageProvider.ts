import { MonacoAwareCustomLanguageInfo } from "../../abstractions/CustomLanguageInfo";

/**
 * C source (`.c`, `.h`), built by z88dk (`.plans/Z88DK_INTEGRATION_PLAN.md` §6). Monaco ships a C
 * tokenizer, which stays: when its `c` language is registered, `ensureLanguage` leaves it alone and
 * this provider only adds what Klive needs - breakpoints in the glyph margin, the compiler's name and
 * the generated theme. The grammar below is a fallback for a Monaco build without its C language.
 */
export const cLanguageProvider: MonacoAwareCustomLanguageInfo = {
  id: "c",
  extensions: [".c", ".h"],
  icon: "@file-c",
  allowBuildRoot: true,
  supportsKlive: true,
  options: {
    comments: { lineComment: "//", blockComment: ["/*", "*/"] },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"]
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"', notIn: ["string"] },
      { open: "'", close: "'", notIn: ["string", "comment"] }
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  supportsBreakpoints: true,
  fullLineBreakpoints: true,
  // --- A gutter click asks the compiler whether the line can hold a breakpoint (not a blank,
  // --- comment, brace or preprocessor line)
  instantSyntaxCheck: true,
  compiler: "Z88dkCompiler",
  languageDef: {
    defaultToken: "",
    keywords: [
      "auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else",
      "enum", "extern", "float", "for", "goto", "if", "inline", "int", "long", "register",
      "return", "short", "signed", "sizeof", "static", "struct", "switch", "typedef", "union",
      "unsigned", "void", "volatile", "while"
    ],
    tokenizer: {
      root: [
        [/^\s*#\s*\w+/, "keyword.directive"],
        [/[a-zA-Z_]\w*/, { cases: { "@keywords": "keyword", "@default": "identifier" } }],
        [/\/\/.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],
        [/"([^"\\]|\\.)*"/, "string"],
        [/'([^'\\]|\\.)*'/, "string"],
        [/0[xX][0-9a-fA-F]+[uUlL]*/, "number.hex"],
        [/\d+[uUlL]*/, "number"],
        [/[{}()[\]]/, "@brackets"],
        [/[;,.]/, "delimiter"]
      ],
      comment: [
        [/[^/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[/*]/, "comment"]
      ]
    }
  }
};
