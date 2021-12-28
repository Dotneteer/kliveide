const path = require("path");
const lodash = require("lodash");

const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");

const APP_DIR = path.resolve(__dirname, "./src");
const PUBLIC_DIR = path.resolve(__dirname, "./public");
const MONACO_DIR = path.resolve(__dirname, "./node_modules/monaco-editor");

function srcPaths(src) {
  return path.join(__dirname, src);
}

const isEnvProduction = process.env.NODE_ENV === "production";
const isEnvDevelopment = process.env.NODE_ENV === "development";

const commonConfig = {
  devtool: isEnvDevelopment ? "source-map" : false,
  mode: isEnvProduction ? "production" : "development",
  output: { path: srcPaths("dist") },
  node: { __dirname: false, __filename: false },
  resolve: {
    alias: {
      "@abstractions": srcPaths("src/core/abstractions"),
      "@modules-core": srcPaths("src/modules/core"),
      "@modules-main": srcPaths("src/modules/main"),
      "@modules": srcPaths("src/modules"),
      "@core": srcPaths("src/core"),
      "@components": srcPaths("src/common-ui/components"),
      "@themes": srcPaths("src/common-ui/themes"),
      "@services": srcPaths("src/common-ui/services"),
      "@state": srcPaths("src/core/state"),
      "@messaging": srcPaths("src/core/messaging"),
      "@emu": srcPaths("src/emu"),
      "@ide": srcPaths("src/ide"),
      _: srcPaths("src"),
      _main: srcPaths("src/main"),
      _models: srcPaths("src/models"),
      _public: srcPaths("public"),
      _renderer: srcPaths("src/renderer"),
      _utils: srcPaths("src/utils"),
    },
    extensions: [".js", ".json", ".ts", ".tsx", ".scss", ".ttf"],
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        loader: "ts-loader",
      },
      {
        test: /\.(scss|css)$/,
        include: APP_DIR,
        use: ["style-loader", "css-loader", "sass-loader"],
      },
      {
        test: /\.(scss|css)$/,
        include: PUBLIC_DIR,
        use: ["style-loader", "css-loader", "sass-loader"],
      },
      {
        test: /\.(jpg|png|svg|ico|icns)$/,
        loader: "file-loader",
        options: {
          name: "[path][name].[ext]",
        },
      },
      {
        test: /\.worklet\.js$/,
        use: { loader: "worklet-loader" },
      },
      {
        test: /\.css$/,
        include: MONACO_DIR,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.ttf$/,
        use: ["file-loader"],
      },
    ],
  },
};

const mainConfig = lodash.cloneDeep(commonConfig);
mainConfig.entry = "./src/main/main.ts";
mainConfig.target = "electron-main";
mainConfig.output.filename = "main.bundle.js";
mainConfig.plugins = [
  new CopyPlugin({
    patterns: [
      {
        from: "./assets/*.png",
        to() {
          return "icons/[name][ext]";
        },
      },
      {
        from: "./build/*.wasm",
        to() {
          return "wasm/[name][ext]";
        },
      },
      {
        from: "./roms/**/*.rom",
        to() {
          return "roms/[name][ext]";
        },
      },
      {
        from: "./assets/*.tzx",
        to() {
          return "tapes/[name][ext]";
        },
      },
      {
        from: "./templates/**/*.*",
        to: ".",
      },
      {
        from: "package.json",
        to: "package.json",
        transform: (content, _path) => {
          // eslint-disable-line no-unused-vars
          const jsonContent = JSON.parse(content);

          delete jsonContent.devDependencies;
          delete jsonContent.scripts;
          delete jsonContent.build;

          jsonContent.main = "./main.bundle.js";
          jsonContent.scripts = { start: "electron ./main.bundle.js" };
          jsonContent.postinstall = "electron-builder install-app-deps";

          return JSON.stringify(jsonContent, undefined, 2);
        },
      },
    ],
  }),
];

const emuRendererConfig = lodash.cloneDeep(commonConfig);
emuRendererConfig.entry = "./src/emu/emu-renderer.tsx";
emuRendererConfig.target = "electron-renderer";
emuRendererConfig.output.filename = "emu-renderer.bundle.js";
emuRendererConfig.plugins = [
  new HtmlWebpackPlugin({
    template: path.resolve(__dirname, "./public/emu-index.html"),
    filename: "emu-index.html",
  }),
];

const ideRendererConfig = lodash.cloneDeep(commonConfig);
ideRendererConfig.entry = "./src/ide/ide-renderer.tsx";
ideRendererConfig.target = "electron-renderer";
ideRendererConfig.output.filename = "ide-renderer.bundle.js";
ideRendererConfig.plugins = [
  new HtmlWebpackPlugin({
    template: path.resolve(__dirname, "./public/ide-index.html"),
    filename: "ide-index.html",
  }),
  new MonacoWebpackPlugin({
    // available options are documented at https://github.com/Microsoft/monaco-editor-webpack-plugin#options
    languages: ["json", "javascript"],
  }),
];

const preloadConfig = {
  entry: "./src/preload.ts",
  target: "electron-preload",
  output: {
    path: path.join(__dirname, "dist"),
    filename: "preload.bundled.js",
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        loader: "ts-loader",
      },
    ],
  },
};

module.exports = [
  mainConfig,
  emuRendererConfig,
  ideRendererConfig,
  preloadConfig,
];
