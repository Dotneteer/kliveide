import nextra from "nextra";
import { getHighlighter } from "shiki";

// Z80 assembly language grammar embedded directly to avoid file system operations
const z80Language = {
  "name": "Z80 Assembly",
  "scopeName": "source.z80klive",
  "patterns": [
    { "include": "#comment" },
    { "include": "#string" },
    { "include": "#pragma" },
    { "include": "#directive" },
    { "include": "#number" },
    { "include": "#statement" },
    { "include": "#keyword" },
    { "include": "#function" },
    { "include": "#boolean" },
    { "include": "#register" },
    { "include": "#condition" },
    { "include": "#label" },
    { "include": "#macroparam" },
    { "include": "#identifier" },
    { "include": "#operator" }
  ],
  "repository": {
    "comment": {
      "patterns": [
        { "name": "comment.line.semicolon.z80klive", "match": ";.*" },
        { "name": "comment.line.double-slash.z80klive", "match": "//.*" },
        {
          "name": "comment.block.z80klive",
          "begin": "/\\*\\*",
          "end": "\\*\\*/"
        },
        {
          "name": "comment.block.z80klive",
          "begin": "/\\*(?!\\*)",
          "end": "\\*/"
        }
      ]
    },
    "keyword": {
      "name": "keyword.control.z80klive",
      "match": "(?i)\\b(nop|rlca|rrca|rla|rra|daa|cpl|scf|ccf|halt|exx|di|ei|neg|retn|reti|rld|rrd|ldi|cpi|ini|outi|ldd|cpd|ind|outd|ldir|cpir|inir|otir|lddr|cpdr|indr|otdr|ld|inc|dec|ex|add|adc|sub|sbc|and|xor|or|cp|djnz|jr|jp|call|ret|rst|push|pop|in|out|im|rlc|rrc|rl|rr|sla|sra|sll|srl|bit|res|set|ldix|ldws|ldirx|lirx|lddx|lddrx|ldrx|ldpirx|lprx|outinb|otib|mul|swapnib|swap|mirror|mirr|nextreg|nreg|pixeldn|pxdn|pixelad|pxad|setae|stae|test|bsla|bsra|bsrl|bsrf|brlc)\\b"
    },
    "pragma": {
      "name": "keyword.control.pragma.z80klive",
      "match": "(?i)(\\.org|\\.bank|\\.xorg|\\.ent|\\.xent|\\.equ|\\.var|\\.disp|\\.defb|\\.db|\\.defw|\\.dw|\\.defm|\\.dm|\\.defn|\\.dn|\\.defh|\\.dh|\\.defs|\\.ds|\\.defc|\\.dc|\\.defg|\\.dg|\\.defgx|\\.dgx|\\.skip|\\.extern|\\.fillb|\\.fillw|\\.model|\\.injectopt|\\.align|\\.trace|\\.tracehex|\\.rndseed|\\.error|\\.includebin|\\.include_bin|\\.incbin|\\.comparebin|\\.zxbasic|\\.onsuccess)\\b|\\b(org|bank|xorg|ent|xent|equ|var|disp|defb|db|defw|dw|defm|dm|defn|dn|defh|dh|defs|ds|defc|dc|defg|dg|defgx|dgx|skip|extern|fillb|fillw|model|injectopt|align|trace|tracehex|rndseed|error|includebin|include_bin|incbin|comparebin|zxbasic|onsuccess)\\b"
    },
    "string": {
      "patterns": [
        { "name": "string.quoted.single.z80klive", "match": "'.'" },
        {
          "name": "string.quoted.double.z80klive",
          "begin": "\"",
          "end": "\"",
          "patterns": [
            {
              "name": "constant.character.escape.z80klive",
              "match": "\\\\([ipfbIoatPC\\\\'\"0]|x[0-9a-fA-F]{1,2})"
            }
          ]
        }
      ]
    },
    "number": {
      "patterns": [
        {
          "name": "constant.numeric.hexadecimal.z80klive",
          "match": "(#[0-9a-fA-F]*[0-9][0-9a-fA-F]*)|(\\b0x[0-9a-fA-F]+\\b)|(\\$[0-9a-fA-F]+)|(\\b[0-9a-fA-F]+[hH]\\b)"
        },
        {
          "name": "constant.numeric.binary.z80klive",
          "match": "(%[01_]+)|(\\b0b[01_]+\\b)|(\\b[01_]+[bB]\\b)"
        },
        { "name": "constant.numeric.octal.z80klive", "match": "\\b([0-7]+[oOqQ])\\b" },
        {
          "name": "constant.numeric.real.z80klive",
          "match": "\\b[0-9]+\\.[0-9]*([eE][+-]?[0-9]+)?\\b|\\.[0-9]+([eE][+-]?[0-9]+)?\\b|\\b[0-9]+[eE][+-]?[0-9]+\\b"
        },
        { "name": "constant.numeric.decimal.z80klive", "match": "\\b[0-9]+\\b" }
      ]
    },
    "statement": {
      "name": "keyword.control.statement.z80klive",
      "match": "(?i)(\\.macro|\\.mend|\\.proc|\\.endp|\\.pend|\\.loop|\\.endl|\\.lend|\\.repeat|\\.until|\\.while|\\.endw|\\.wend|\\.ifused|\\.ifnused|\\.if|\\.elif|\\.else|\\.endif|\\.for|\\.to|\\.step|\\.next|\\.break|\\.continue|\\.endmodule|\\.endscope|\\.moduleend|\\.scopeend|\\.struct|\\.ends|\\.local|\\.endm|\\.module|\\.scope)\\b|\\b(macro|mend|proc|endp|pend|loop|endl|lend|repeat|until|while|endw|wend|ifused|ifnused|if|elif|else|endif|for|to|step|next|break|continue|endmodule|endscope|moduleend|scopeend|struct|ends|local|endm|module|scope)\\b"
    },
    "directive": {
      "name": "keyword.control.directive.z80klive",
      "match": "(?i)(#ifdef|#ifndef|#define|#undef|#ifmod|#ifnmod|#endif|#else|#if|#include|#line)\\b"
    },
    "register": {
      "name": "variable.language.register.z80klive",
      "match": "(?i)\\b(af'|af|a|f|bc|b|c|de|d|e|hl|h|l|i|r|sp|ixh|ixl|ix|iyh|iyl|iy|xh|xl|yh|yl)\\b"
    },
    "condition": {
      "name": "variable.language.condition.z80klive",
      "match": "(?i)\\b(z|nz|c|nc|po|pe|p|m)\\b"
    },
    "function": {
      "name": "support.function.z80klive",
      "match": "(?i)\\b(textof|ltextof|hreg|lreg|def|isreg8|isreg8std|isreg8spec|isreg8idx|isreg16|isreg16std|isreg16idx|isregindirect|iscport|isindexedaddr|iscondition|isexpr|isregaf|isrega|isregbc|isregb|isregc|isregde|isregd|isrege|isreghl|isregh|isregl|isregi|isregr|isregsp|isregxh|isregxl|isregix|isregyh|isregyl|isregiy|\\.cnt|\\$cnt)\\b"
    },
    "boolean": {
      "name": "constant.language.boolean.z80klive",
      "match": "(?i)\\b(true|false|\\.true|\\.false)\\b"
    },
    "operator": {
      "name": "keyword.operator.z80klive",
      "match": "::|:=|==|===|!=|!==|<=|>=|<<|<\\?|>>|>\\?|:|\\?|\\+|-|\\*|/|\\||\\^|!|~|%|&|<|>"
    },
    "macroparam": {
      "name": "variable.parameter.macro.z80klive",
      "begin": "{{",
      "end": "}}",
      "patterns": [{ "match": "[\\._@`a-zA-Z][_@!?\\.0-9A-Za-z]*" }]
    },
    "identifier": {
      "name": "variable.other.identifier.z80klive",
      "match": "(\\.(?![0-9])[_@!?\\.0-9A-Za-z]*)|([_@`A-Za-z][_@!?\\.0-9A-Za-z]*)"
    }
  }
};

const customTheme = {
  colors: {
    "editor.background": "#1E1E1E",
    "editor.foreground": "#a4a4a4"
  },
  settings: [
    {
      scope: ["comment"],
      settings: {
        foreground: "#6a9955"
      }
    },
    {
      scope: ["string"],
      settings: {
        foreground: "#cd3131"
      }
    },
    {
      scope: ["constant.character.escape.z80klive"],
      settings: {
        foreground: "#ff6000"
      }
    },
    {
      scope: ["constant.numeric", "constant.language.boolean"],
      settings: {
        foreground: "#4D8061"
      }
    },
    {
      scope: ["keyword.control.z80klive"],
      settings: {
        foreground: "#569cd6",
        fontStyle: "bold"
      }
    },
    {
      scope: ["keyword.control.statement.z80klive"],
      settings: {
        foreground: "#c586c0",
        fontStyle: "bold"
      }
    },
    {
      scope: ["keyword.control.pragma.z80klive"],
      settings: {
        foreground: "#c586c0",
        fontStyle: "normal"
      }
    },
    {
      scope: ["keyword.control.directive.z80klive"],
      settings: {
        foreground: "#569cd6",
        fontStyle: "normal"
      }
    },
    {
      scope: ["variable.language.register.z80klive", "variable.language.condition.z80klive"],
      settings: {
        foreground: "#2B7CB3"
      }
    },
    {
      scope: ["support.function.z80klive"],
      settings: {
        foreground: "#4fc1ff"
      }
    },
    {
      scope: ["keyword.operator.z80klive"],
      settings: {
        foreground: "#a4a4a4"
      }
    },
    {
      scope: ["entity.name.function.z80klive"],
      settings: {
        foreground: "#4EC9B0"
      }
    },
    {
      scope: ["variable.parameter.macro.z80klive"],
      settings: {
        foreground: "#c586c0",
        fontStyle: "italic"
      }
    },
    {
      scope: ["variable.other.identifier.z80klive"],
      settings: {
        foreground: "#B5890F"
      }
    },
    // JavaScript and general syntax highlighting
    {
      scope: [
        "keyword.control",
        "keyword.operator",
        "keyword.other",
        "keyword.declaration",
        "storage.type"
      ],
      settings: {
        foreground: "#4A9EFF",
        fontStyle: "bold"
      }
    },
    {
      scope: ["variable.language", "variable.other.constant"],
      settings: {
        foreground: "#4A9EFF"
      }
    },
    {
      scope: ["entity.name.function", "support.function"],
      settings: {
        foreground: "#FF8C42"
      }
    },
    {
      scope: ["entity.name.type", "entity.name.class"],
      settings: {
        foreground: "#4EC9B0"
      }
    },
    {
      scope: ["variable.parameter", "variable.other.readwrite"],
      settings: {
        foreground: "#2B7CB3"
      }
    },
    {
      scope: ["punctuation.definition.template-expression"],
      settings: {
        foreground: "#4A9EFF"
      }
    }
  ]
};

const withNextra = nextra({
  theme: "nextra-theme-docs",
  themeConfig: "./theme.config.tsx",
  mdxOptions: {
    remarkPlugins: [],
    rehypePlugins: [],
    rehypePrettyCodeOptions: {
      theme: {
        myTheme: customTheme,
      },
      getHighlighter: async (options) => {
        return await getHighlighter({
          ...options,
          langs: [
            "javascript",
            "typescript",
            "json",
            "html",
            "bash",
            {
              id: "z80klive",
              scopeName: "source.z80klive",
              grammar: z80Language,
              aliases: ["z80-assembly"]
            }
          ]
        });
      }
    }
  }
});

export default withNextra({
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true
  },
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.tmLanguage\.json$/,
      type: "json",
    });
    return config;
  },
  basePath: process.env.NODE_ENV === "production" ? "/kliveide" : "",
  assetPrefix: process.env.NODE_ENV === "production" ? "/kliveide/" : ""
});

// If you have other Next.js configurations, you can pass them as the parameter:
// export default withNextra({ /* other next.js config */ })