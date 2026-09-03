import nextra from "nextra";
import { createHighlighter } from "shiki";

// Z80 assembly language grammar embedded directly to avoid file system operations
const z80Language = {
  "name": "Z80 Assembly",
  "scopeName": "source.z80klive",
  "patterns": [
    { "include": "#comment" },
    { "include": "#string" },
    { "include": "#dma" },
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
      "match": "(?i)(\\.org|\\.bank|\\.savenex|\\.xorg|\\.ent|\\.xent|\\.equ|\\.var|\\.disp|\\.defb|\\.db|\\.defw|\\.dw|\\.defm|\\.dm|\\.defn|\\.dn|\\.defh|\\.dh|\\.defs|\\.ds|\\.defc|\\.dc|\\.defg|\\.dg|\\.defgx|\\.dgx|\\.skip|\\.extern|\\.fillb|\\.fillw|\\.model|\\.injectopt|\\.align|\\.trace|\\.tracehex|\\.rndseed|\\.error|\\.includebin|\\.include_bin|\\.incbin|\\.comparebin|\\.zxbasic|\\.onsuccess)\\b|\\b(org|bank|savenex|xorg|ent|xent|equ|var|disp|defb|db|defw|dw|defm|dm|defn|dn|defh|dh|defs|ds|defc|dc|defg|dg|defgx|dgx|skip|extern|fillb|fillw|model|injectopt|align|trace|tracehex|rndseed|error|includebin|include_bin|incbin|comparebin|zxbasic|onsuccess)\\b"
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
    "dma": {
      "begin": "(?i)(\\.dma|(?<![.\\w])dma)(?=\\s|$)",
      "end": "$",
      "beginCaptures": {
        "1": { "name": "keyword.control.pragma.z80klive" }
      },
      "patterns": [
        { "include": "#comment" },
        { "include": "#dmasubcmd" },
        { "include": "#dmaparams" },
        { "include": "#number" },
        { "include": "#operator" },
        { "include": "#identifier" }
      ]
    },
    "dmasubcmd": {
      "name": "keyword.control.statement.z80klive",
      "match": "(?i)\\b(wr[0-5]|reset|load|enable|disable|continue|readmask|cmd)\\b"
    },
    "dmaparams": {
      "name": "keyword.control.z80klive",
      "match": "(?i)\\b(a_to_b|b_to_a|search_transfer|transfer|search|memory|io|increment|decrement|fixed|4t|3t|2t|continuous|burst|byte|auto_restart|dma_enable|int_enable|stop_on_match)\\b"
    },
    "identifier": {
      "name": "variable.other.identifier.z80klive",
      "match": "(\\.(?![0-9])[_@!?\\.0-9A-Za-z]*)|([_@`A-Za-z][_@!?\\.0-9A-Za-z]*)"
    }
  }
};

const customTheme = {
  // Shiki v3 requires `name` and `type` on a theme registration.
  name: "z80klive-dark",
  type: "dark",
  colors: {
    "editor.background": "#1E1E1E",
    "editor.foreground": "#a4a4a4"
  },
  // Must be `tokenColors`, not the TextMate `settings` key: rehype-pretty-code
  // identifies a single theme purely by `Object.hasOwn(theme, "tokenColors")`.
  // With `settings` it treats the object as a MAP of themes, reads its values as
  // theme names, and fails with "Theme `dark` not found" (from `type: "dark"`).
  // Shiki itself accepts either spelling.
  tokenColors: [
    {
      scope: ["comment"],
      settings: {
        foreground: "#6a9955"
      }
    },
    {
      scope: ["string"],
      settings: {
        foreground: "#FF6B35"
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

// Where the site will be served from, e.g. "/kliveide" in production or
// "/kliveide/preview/<branch>" for a branch preview. Deployment path is a
// deployment concern, not a NODE_ENV concern: coupling the two is what made it
// impossible to publish a preview at a different path.
// Production default lives in .env.production; dev leaves it empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const withNextra = nextra({
  // `theme` / `themeConfig` are gone in Nextra 4 - the theme is now applied by
  // <Layout> in app/layout.tsx, and NextraConfigSchema rejects unknown keys.
  mdxOptions: {
    remarkPlugins: [],
    rehypePlugins: [],
    rehypePrettyCodeOptions: {
      // A single theme object (rather than a keyed map) makes rehype-pretty-code
      // emit inline `style="color:#..."`, matching the Nextra 3 output. A keyed
      // map would switch it to CSS variables and silently drop every colour.
      theme: customTheme,
      getHighlighter: async (options) => {
        // The option key stays `getHighlighter` (it belongs to rehype-pretty-code);
        // only the Shiki function it calls was renamed.
        return await createHighlighter({
          ...options,
          // rehype-pretty-code forwards only the theme *name* in `options.themes`;
          // the registration object itself has to be supplied here or shiki throws
          // "Theme `z80klive-dark` is not included in this bundle".
          themes: [customTheme],
          // Every language used by a code fence anywhere in content/ must be
          // listed. Shiki v3 THROWS on an unregistered language ("Language `asm`
          // not found"), where Shiki 0.14 silently fell back to plain text - so
          // adding a fence in a new language will fail the build until it is
          // added here. ("text" needs no registration.)
          langs: [
            "javascript",
            "typescript",
            "jsx",
            "tsx",
            "json",
            "yaml",
            "html",
            "css",
            "bash",
            "shell",
            "markdown",
            "asm",
            "diff",
            {
              ...z80Language,
              name: "z80klive",
              scopeName: "source.z80klive",
              aliases: ["z80-assembly"]
            }
          ]
        });
      }
    }
  }
});

export default withNextra({
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
  basePath,
  assetPrefix: basePath ? `${basePath}/` : ""
});

// If you have other Next.js configurations, you can pass them as the parameter:
// export default withNextra({ /* other next.js config */ })