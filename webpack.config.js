const lodash = require("lodash");
const path = require("path");

const CopyPkgJsonPlugin = require("copy-pkg-json-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

function srcPaths(src) {
  return path.join(__dirname, src);
}

const isEnvProduction = process.env.NODE_ENV === "production";
const isEnvDevelopment = process.env.NODE_ENV === "development";

const commonConfig = {
  devtool: isEnvDevelopment ? "source-map" : false,
  mode: isEnvProduction ? "production" : "development",
  output: { path: path.join(__dirname, "dist") },
  node: { __dirname: false, __filename: false },
  resolve: {
    alias: {
      "@": srcPaths("src"),
      "@main": srcPaths("src/main"),
      "@public": srcPaths("public"),
      "@renderer": srcPaths("src/renderer"),
    },
    extensions: [".mjs", ".js", ".json", ".ts"],
  },
  module: {
    rules: [
      {
        test: /\.svelte$/,
        use: {
          loader: "svelte-loader",
          options: {
            emitCss: true,
            hotReload: isEnvDevelopment,
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

const mainConfig = lodash.cloneDeep(commonConfig);
mainConfig.entry = "./src/main/main.ts";
mainConfig.target = "electron-main";
mainConfig.output.filename = "main.bundle.js";
mainConfig.plugins = [
  new CopyPkgJsonPlugin({
    remove: ["scripts", "devDependencies", "build"],
    replace: {
      main: "./main.bundle.js",
      scripts: { start: "electron ./main.bundle.js" },
      postinstall: "electron-builder install-app-deps",
    },
  }),
  new CopyPlugin({
    patterns: [
      { from: "./public/assets/*.png", to: "icons", flatten: true },
      { from: "./build/*.wasm", to: "wasm", flatten: true },
    ],
  }),
];

const rendererConfig = lodash.cloneDeep(commonConfig);
rendererConfig.entry = "./src/renderer/main.js";
rendererConfig.target = "electron-renderer";
rendererConfig.output.filename = "renderer.bundle.js";
rendererConfig.resolve.mainFields = ["svelte", "browser", "module", "main"];
rendererConfig.plugins = [
  new HtmlWebpackPlugin({
    template: path.resolve(__dirname, "./public/index.html"),
  }),
];

module.exports = [mainConfig, rendererConfig];
