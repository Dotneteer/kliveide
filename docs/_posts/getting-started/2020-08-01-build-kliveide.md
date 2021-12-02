---
layout: documents
categories: 
  - "Setup"
title:  "Build Klive IDE"
alias: build-kliveide
seqno: 30
selector: tutorial
permalink: "getting-started/build-kliveide"
---

> *Note*: I'm using VS Code to develop Klive. However, if you prefer any other tool, you may use that one.

## Get and Build Klive

If you want to try the latest source code version of Klive, follow these steps:

1. **Make sure that the newest Node.js is set up on your machine.** You can download the newest version from [here](https://nodejs.org/en/).
2. Fork this [repository](https://github.com/Dotneteer/kliveide), and clone it.
3. Run `npm install` to prepare all dependencies to build the code.

Follow these steps to build and run the Klive Emulator in development mode:

1. Execute `npm run build`.
2. When the build completes, issue an `npm start` command to launch the Emulator.

![Klive setup]({{ site.baseurl }}/assets/images/tutorials/emulator-starts.png)

## How the Build Works

> Klive uses TypeScript and WebAssembly as its core technologies. WebAssembly is the key to providing outstanding performance for the emulator engine.

Native WebAssembly programming is not very productive. To create a WA binary, you generally use a host language (C, C++, AssemblyScript, Rust, or another dozen).
I created my programming language (WAT#) and compiler (Watson) to compile WAT# to WA binaries.

WAT# allows you to use native WebAssembly concepts like linear memory, tables, globals, etc., directly in the language.

The build process takes these steps:

1. Invokes the Watson compiler for all virtual machines.
- First, the WAT# compiler creates WebAssembly text format (`.wat`) files.
- Second, the `wat2wasm` tool generates WebAssembly binaries (`.wasm`)
2. Runs Webpack to create the bundle files for Klive IDE. This step creates these bundles:
- `preload.bundles.js`: This script file prepares the communication between the *main process* and *renderer processes* of Klive IDE. The main process is a Node.js process to access resources (files and others) on your computer. The renderer processes run in a browser and display the Emulator and IDE windows.
- `main.bundle.js`: The script for the main process
- `emu-renderer.bundle.js`: The renderer script for the emulator process
- `ide-renderer.bundle.js`: The renderer script for the IDE process

## Continuous Build

While developing the code, you can use the `npm run dev` command to provide a continuous build. As you change the code, the script automatically rebuilds the project. You can test the code in another terminal window by closing the previous app and starting it again with `npm start`.

> *Note*: Klive does not support hot reloading.

## Creating Setup Kits

The project's `package.json` file contains three commands to build platform-specific setup kits:
- `npm run build:linux`: Creates the installation package (`KliveSetup-{version}.AppImage`) for Linux
- `npm run build:win`: Creates the installation executable (`KliveSetup-{version}.exe`) for Windows
- `npm run build:mac`: Creates the installation package (`KliveSetup-{version}.pkg`) for Mac

