const path = require("path");

function srcPaths(src) {
  return path.join(__dirname, src);
}

function createConfig(source, dest) {
  return {
    entry: source,
    devtool: isEnvDevelopment ? "source-map" : false,
    mode: isEnvProduction ? "production" : "development",
    externals: {
      vscode: "commonjs vscode dom",
    },
    output: {
      path: srcPaths("out/assets"),
      filename: dest,
    },
    node: { __dirname: false, __filename: false },
    resolve: {
      alias: {
        "@": srcPaths("src"),
      },
      extensions: [".mjs", ".js", ".json", ".ts"],
      mainFields: ["svelte", "browser", "module", "main"],
    },
    module: {
      rules: [
        {
          test: /\.svelte$/,
          use: {
            loader: "svelte-loader",
            options: {
              emitCss: true,
              hotReload: true,
            },
          },
        },
        {
          test: /\.(ts|tsx)$/,
          exclude: /node_modules/,
          loader: "ts-loader",
        },
        {
          test: /\.(scss|css)$/,
          use: ["style-loader", "css-loader"],
        },
        {
          test: /\.(jpg|png|svg|ico|icns)$/,
          loader: "file-loader",
          options: {
            name: "[path][name].[ext]",
          },
        },
      ],
    },
  };
}

const isEnvProduction = process.env.NODE_ENV === "production";
const isEnvDevelopment = process.env.NODE_ENV === "development";

module.exports = [
  createConfig(
    "./src/custom-editors/disassembly/disassembly.js",
    "disass.bundle.js"
  ),
  createConfig(
    "./src/custom-editors/memory/memory.js",
    "memory.bundle.js"
  ),
];
