import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import nextra from "nextra";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const z80Language = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "page-components/syntax/z80-assembly.tmLanguage.json"),
    "utf8"
  )
);

const customDarkTheme = {
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
      scope: ["constant.character.escape.z80-klive"],
      settings: {
        foreground: "#ff6000"
      }
    },
    {
      scope: ["constant.numeric", "constant.language.boolean"],
      settings: {
        foreground: "#B5CEA8"
      }
    },
    {
      scope: ["keyword.control.z80-klive"],
      settings: {
        foreground: "#569cd6",
        fontStyle: "bold"
      }
    },
    {
      scope: ["keyword.control.statement.z80-klive"],
      settings: {
        foreground: "#c586c0",
        fontStyle: "bold"
      }
    },
    {
      scope: ["keyword.control.pragma.z80-klive"],
      settings: {
        foreground: "#c586c0",
        fontStyle: "normal"
      }
    },
    {
      scope: ["keyword.control.directive.z80-klive"],
      settings: {
        foreground: "#569cd6",
        fontStyle: "normal"
      }
    },
    {
      scope: ["variable.language.register.z80-klive", "variable.language.condition.z80-klive"],
      settings: {
        foreground: "#9CDCFE"
      }
    },
    {
      scope: ["support.function.z80-klive"],
      settings: {
        foreground: "#4fc1ff"
      }
    },
    {
      scope: ["keyword.operator.z80-klive"],
      settings: {
        foreground: "#a4a4a4"
      }
    },
    {
      scope: ["entity.name.function.z80-klive"],
      settings: {
        foreground: "#4EC9B0"
      }
    },
    {
      scope: ["variable.parameter.macro.z80-klive"],
      settings: {
        foreground: "#c586c0",
        fontStyle: "italic"
      }
    },
    {
      scope: ["variable.other.identifier.z80-klive"],
      settings: {
        foreground: "#dcdcaa"
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
        foreground: "#9CDCFE"
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

const customLightTheme = {
  colors: {
    "editor.background": "#FFFFFF",
    "editor.foreground": "#000000"
  },
  settings: [
    {
      scope: ["comment"],
      settings: {
        foreground: "#008000"
      }
    },
    {
      scope: ["string"],
      settings: {
        foreground: "#8B0000"
      }
    },
    {
      scope: ["constant.character.escape.z80-klive"],
      settings: {
        foreground: "#FF8C00"
      }
    },
    {
      scope: ["constant.numeric", "constant.language.boolean"],
      settings: {
        foreground: "#098658"
      }
    },
    {
      scope: ["keyword.control.z80-klive"],
      settings: {
        foreground: "#0000FF",
        fontStyle: "bold"
      }
    },
    {
      scope: ["keyword.control.statement.z80-klive"],
      settings: {
        foreground: "#AF00DB",
        fontStyle: "bold"
      }
    },
    {
      scope: ["keyword.control.pragma.z80-klive"],
      settings: {
        foreground: "#AF00DB",
        fontStyle: "normal"
      }
    },
    {
      scope: ["keyword.control.directive.z80-klive"],
      settings: {
        foreground: "#0000FF",
        fontStyle: "normal"
      }
    },
    {
      scope: ["variable.language.register.z80-klive", "variable.language.condition.z80-klive"],
      settings: {
        foreground: "#267f99"
      }
    },
    {
      scope: ["support.function.z80-klive"],
      settings: {
        foreground: "#795E26"
      }
    },
    {
      scope: ["keyword.operator.z80-klive"],
      settings: {
        foreground: "#000000"
      }
    },
    {
      scope: ["entity.name.function.z80-klive"],
      settings: {
        foreground: "#795E26"
      }
    },
    {
      scope: ["variable.parameter.macro.z80-klive"],
      settings: {
        foreground: "#AF00DB",
        fontStyle: "italic"
      }
    },
    {
      scope: ["variable.other.identifier.z80-klive"],
      settings: {
        foreground: "#001080"
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
        foreground: "#7C3AED",
        fontStyle: "bold"
      }
    },
    {
      scope: ["variable.language", "variable.other.constant"],
      settings: {
        foreground: "#0066CC"
      }
    },
    {
      scope: ["entity.name.function", "support.function"],
      settings: {
        foreground: "#D2691E"
      }
    },
    {
      scope: ["entity.name.type", "entity.name.class"],
      settings: {
        foreground: "#267f99"
      }
    },
    {
      scope: ["variable.parameter", "variable.other.readwrite"],
      settings: {
        foreground: "#001080"
      }
    },
    {
      scope: ["punctuation.definition.template-expression"],
      settings: {
        foreground: "#7C3AED"
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
        dark: customDarkTheme,
        light: customLightTheme
      },
      getHighlighter: async (options) => {
        const { getHighlighter } = await import("shiki");
        return await getHighlighter({
          ...options,
          langs: [
            "javascript",
            "typescript",
            "json",
            "markdown",
            "html",
            "css",
            "bash",
            {
              id: "z80-klive",
              scopeName: "source.z80-klive",
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
  basePath: process.env.NODE_ENV === "production" ? "/kliveide" : "",
  assetPrefix: process.env.NODE_ENV === "production" ? "/kliveide/" : ""
});

// If you have other Next.js configurations, you can pass them as the parameter:
// export default withNextra({ /* other next.js config */ })
