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

*(This article is obsolete)*

If you want to try the latest source code version of Klive, follow these steps:

1. **Make sure that the newest Node.js is set up on your machine.** You can download it from here: https://nodejs.org/en/.
1. **Make sure that Visual Studio Code is installed on your computer.** If not, or it is older than v1.46.0, visit https://code.visualstudio.com/download for the newest version.
3. Fork this repository, and clone it.
3. Run `npm run bootstrap` to install and setup the packages.
4. Open the project folder in VS Code (or in your preferred coding tool). Take care that the current working directory (as always) should be the project folder.

Follow these steps to build and run the Klive Emulator in development mode:

1. Start a new command-line program (a terminal window in VS Code), and execute the `npm run build`.
2. When the build completes, issue an `npm start` command; it will launch the Emulator. Please note, the process is alive unless you close the Emulator.
3. Open a new VS Code instance with the `packages/kliveide-vsext` folder.
4. Press Ctrl+F5, or select the **Run\|Run Without Debugging** command.
5. In a few seconds, VS Code compiles the extension package and launches a new VS Code instance, the _Extension Development Host_. The Klive IDE VS Code extension runs within that host. To check that it works, select the **Debug** tag in VS Code's activity bar. This action displays the **Z80 REGISTERS** view at the bottom.

![Klive setup]({{ site.baseurl }}/assets/images/tutorials/klive-setup-test.png)


