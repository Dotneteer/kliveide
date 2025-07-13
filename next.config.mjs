import nextra from "nextra";

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
    { "include": "#instruction" },
    { "include": "#label" },
    { "include": "#operator" },
    { "include": "#register" },
    { "include": "#identifier" }
  ],
  "repository": {
    "comment": {
      "patterns": [
        {
          "name": "comment.line.double-slash.z80klive",
          "match": "//.*$"
        },
        {
          "name": "comment.line.semicolon.z80klive",
          "match": ";.*$"
        },
        {
          "name": "comment.block.z80klive",
          "begin": "/\\*",
          "end": "\\*/"
        }
      ]
    },
    "string": {
      "patterns": [
        {
          "name": "string.quoted.double.z80klive",
          "begin": "\"",
          "end": "\"",
          "patterns": [
            {
              "name": "constant.character.escape.z80klive",
              "match": "\\\\[\"'\\\\aAbBfFiIoOpPtT0xX]"
            }
          ]
        },
        {
          "name": "string.quoted.single.z80klive",
          "begin": "'",
          "end": "'",
          "patterns": [
            {
              "name": "constant.character.escape.z80klive",
              "match": "\\\\[\"'\\\\aAbBfFiIoOpPtT0xX]"
            }
          ]
        }
      ]
    },
    "pragma": {
      "patterns": [
        {
          "name": "keyword.control.pragma.z80klive",
          "match": "\\.(?i:org|defb|defw|defm|defn|equ|var|disp|include|repeat|until|loop|align|defgx|defg|defh|skip|fillb|defs|defc|extern|global|model|bank|segment|trace|cleartrace)"
        }
      ]
    },
    "directive": {
      "patterns": [
        {
          "name": "keyword.control.directive.z80klive",
          "match": "#(?i:include|if|ifdef|ifndef|else|elif|endif|define|undef|line|error)"
        }
      ]
    },
    "number": {
      "patterns": [
        {
          "name": "constant.numeric.hex.z80klive",
          "match": "(?i:#[0-9a-f]+|\\$[0-9a-f]+|0x[0-9a-f]+|[0-9][0-9a-f]*h)"
        },
        {
          "name": "constant.numeric.binary.z80klive",
          "match": "(?i:%[01]+|0b[01]+|[01]+b)"
        },
        {
          "name": "constant.numeric.decimal.z80klive",
          "match": "[0-9]+"
        },
        {
          "name": "constant.numeric.octal.z80klive",
          "match": "(?i:[0-7]+[oqOQ])"
        },
        {
          "name": "constant.language.boolean.z80klive",
          "match": "(?i:\\.false|\\.true|false|true)"
        }
      ]
    },
    "statement": {
      "patterns": [
        {
          "name": "keyword.control.statement.z80klive",
          "match": "\\.(?i:if|else|elif|endif|proc|endp|macro|endm|while|endw|repeat|until|loop|break|continue|goto|for|next)"
        }
      ]
    },
    "instruction": {
      "patterns": [
        {
          "name": "support.function.z80klive",
          "match": "(?i:adc|add|and|bit|call|ccf|cp|cpd|cpdr|cpi|cpir|cpl|daa|dec|di|djnz|ei|ex|exx|halt|im|in|inc|ind|indr|ini|inir|jp|jr|ld|ldd|lddr|ldi|ldir|neg|nop|or|otdr|otir|out|outd|outi|pop|push|res|ret|reti|retn|rl|rla|rlc|rlca|rld|rr|rra|rrc|rrca|rrd|rst|sbc|scf|set|sl1|sla|sll|sli|sra|srl|sub|xor)"
        }
      ]
    },
    "label": {
      "patterns": [
        {
          "name": "entity.name.function.z80klive",
          "match": "^\\s*[A-Za-z_@#$?][A-Za-z0-9_@#$?]*:"
        }
      ]
    },
    "operator": {
      "patterns": [
        {
          "name": "keyword.operator.z80klive",
          "match": "[\\+\\-\\*/%&|\\^~<>!=]"
        }
      ]
    },
    "register": {
      "patterns": [
        {
          "name": "variable.language.register.z80klive",
          "match": "(?i:a|b|c|d|e|h|l|i|r|ixh|ixl|iyh|iyl|af|bc|de|hl|ix|iy|sp|af')"
        },
        {
          "name": "variable.language.condition.z80klive",
          "match": "(?i:nz|z|nc|c|po|pe|p|m)"
        }
      ]
    },
    "identifier": {
      "patterns": [
        {
          "name": "variable.other.identifier.z80klive",
          "match": "[A-Za-z_@#$?][A-Za-z0-9_@#$?]*"
        }
      ]
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
        const { getHighlighter } = await import("shiki");
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